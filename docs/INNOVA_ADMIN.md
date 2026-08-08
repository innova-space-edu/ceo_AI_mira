# Innova Admin

Plataforma empresarial privada de **Innova Space Education SPA** integrada al sitio público `innova-space-edu.cl`.

## Acceso

- Sitio público: `https://www.innova-space-edu.cl/`
- Plataforma: `https://www.innova-space-edu.cl/admin.html`
- Cuenta administrativa inicial autorizada: `contacto@innova-space-edu.cl`
- El primer registro exige confirmación del correo en Supabase Auth.
- Las acciones críticas de usuarios exigen MFA/TOTP (`aal2`).

## Arquitectura funcional

Innova Admin conserva los módulos originales y agrega una capa empresarial conectada. La regla principal es **no crear módulos paralelos para la misma información**: proyectos, documentos, cotizaciones y facturas existentes se enriquecen y se relacionan con las nuevas entidades.

### Comercial

- Proyectos
- Clientes y proveedores unificados por RUT
- Cotizaciones
- Órdenes de compra de clientes y proveedores
- Facturas y DTE

### Gestión empresarial

- Documentos editables
- Contratos y convenios
- Archivo empresarial
- Activos y garantías

### Finanzas y administración

- Tesorería y cuentas por cobrar/pagar
- Conciliación bancaria por CSV
- Tributario: F29, F50, PPM, IVA, renta, DJ, patentes y otros
- Recursos humanos
- Aprobaciones y vencimientos

### Inteligencia y control

- MIRA Business
- Agente Auditor
- búsqueda global empresarial
- expediente 360° por proyecto
- ficha 360° por factura

## Componentes

### Frontend estático

Archivos principales:

- `admin.html`: shell, login, MFA y navegación.
- `admin.css`: interfaz responsive.
- `admin.js`: núcleo original de proyectos, documentos, cotizaciones, facturas, MIRA, auditor y usuarios.
- `admin-config.js`: configuración pública de Supabase y autorrelleno DTE/PDF.
- `admin-nav.js`: acceso desde la navegación del sitio público.
- `assets/admin-enterprise/loader.js`: carga la ampliación empresarial v2.
- `assets/admin-enterprise/enterprise-*.b64`: bundle empresarial comprimido y dividido para publicación estática.

El CI reconstruye el bundle, lo descomprime y ejecuta `node --check` antes de permitir el merge.

### Backend MIRA / Render

`backend/server.js` mantiene las rutas públicas existentes y agrega:

- `POST /api/admin/mira`: MIRA Business. Requiere JWT válido y usuario empresarial activo.
- `POST /api/admin/notify`: notificación administrativa manual. Requiere rol `superadmin` o `admin`.

El backend valida el JWT contra Supabase Auth y el rol contra `company_users` mediante RLS.

## Supabase

Proyecto actual: `alogqktilzgylzomzwem`.

Entidades principales del sistema:

### Núcleo existente

- `company_users`
- `company_projects`
- `company_files`
- `company_documents`
- `company_document_versions`
- `company_quotations`
- `company_invoices`
- `company_meetings`
- `company_alerts`
- `company_activity`
- `company_settings`

### Enterprise v2

- `company_parties`: una sola ficha por RUT, con varios roles posibles (cliente, proveedor, empresa, trabajador, socio u otro).
- `company_purchase_orders`: órdenes de compra recibidas o emitidas.
- `company_contracts`: contratos y convenios con ciclo de aprobación.
- `company_transactions`: tesorería; una factura genera o actualiza un movimiento vinculado automáticamente.
- `company_bank_movements`: cartolas y conciliación bancaria.
- `company_employees`: fichas de RR.HH.
- `company_assets`: activos, responsables, ubicación, factura y garantía.
- `company_tax_records`: control tributario por período.
- `company_approvals`: flujos de revisión/aprobación.
- `company_deadlines`: vencimientos y recordatorios.
- `company_entity_links`: relaciones sin duplicar archivos o entidades.
- `company_templates`: plantillas empresariales.

Bucket privado: `company-files`.

RLS está habilitado en todas las tablas empresariales y en el bucket. Los roles son:

- `superadmin`
- `admin`
- `finance`
- `project_manager`
- `viewer`

## Estrategia contra duplicados

La plataforma aplica deduplicación en varios niveles:

1. **Clientes/proveedores:** RUT normalizado único; una misma entidad puede tener varios roles en lugar de crear fichas repetidas.
2. **Facturas DTE:** combinación única de TipoDTE + folio + RUT emisor cuando los tres datos están presentes.
3. **Archivos:** SHA-256 único. Si el mismo archivo ya existe, se reutiliza y se crea una relación en `company_entity_links` cuando corresponde, sin subir otra copia.
4. **Facturas y tesorería:** `company_transactions.invoice_id` es único, de modo que una factura solo puede originar un movimiento financiero automático.
5. **Órdenes de compra:** número + dirección + contraparte evitan registros equivalentes repetidos.
6. **Activos, trabajadores, obligaciones tributarias y vencimientos:** cuentan con claves o fingerprints únicos según su naturaleza.

Los registros históricos antiguos no se borran automáticamente. Se bloquea la creación de nuevos duplicados y se reutilizan relaciones existentes.

## Expediente 360°

Al abrir un proyecto se consultan de manera relacionada:

- archivos;
- documentos editables;
- reuniones;
- cotizaciones;
- facturas;
- órdenes de compra;
- contratos;
- movimientos de tesorería;
- activos.

La factura 360° muestra además proyecto, contraparte, orden de compra, cotización, contrato y estado de tesorería.

## Tesorería y conciliación

Las facturas sincronizan automáticamente un registro en `company_transactions`:

- venta → ingreso/cobro;
- compra → egreso/pago;
- pendiente/parcial/pagada/anulada → estado equivalente en tesorería.

El módulo puede importar CSV bancarios y evita volver a insertar el mismo movimiento mediante fingerprint. La conciliación automática busca coincidencia por sentido del movimiento, monto exacto y cercanía de fecha; solo concilia automáticamente cuando la coincidencia es única.

## Agente Auditor

Función SQL: `company_run_audit()`.

Revisa, entre otras condiciones:

- proyectos vencidos;
- cotizaciones vencidas;
- facturas pendientes vencidas;
- cotizaciones aprobadas sin factura asociada;
- contratos próximos a vencer;
- obligaciones tributarias próximas o vencidas;
- garantías próximas a vencer;
- órdenes de compra atrasadas;
- pagos/cobros vencidos;
- vencimientos manuales.

Edge Function: `company-auditor`.

La función usa un token interno almacenado en Supabase Vault y puede enviar un resumen por correo utilizando el backend corporativo ya desplegado.

## Facturas y DTE

El sistema acepta PDF o XML. El XML DTE se utiliza como fuente estructurada cuando está disponible. En PDF, PDF.js extrae el texto digital y el parser chileno detecta TipoDTE, folio, RUT, fechas, neto, exento, IVA y total, incluyendo DTE cuyo orden interno de texto difiere del orden visual.

Antes de guardar se comprueba el SHA-256 del archivo y la identidad tributaria del DTE para no crear otra factura ni otro archivo iguales.

## Seguridad

- La publishable key del frontend es pública por diseño; nunca se expone `service_role`.
- Storage es privado y utiliza URLs firmadas para lectura.
- RLS protege todas las entidades empresariales.
- Las funciones de trigger `SECURITY DEFINER` no son ejecutables por `anon` ni por usuarios autenticados vía RPC.
- Las funciones auxiliares que se usan desde RLS o auditoría validan sesión/rol internamente.
- MFA protege cambios de usuarios.
- MIRA Business valida JWT y rol en el servidor.
- `admin.html` incluye `noindex`, `nofollow` y `noarchive`.

## Despliegue

El frontend se despliega automáticamente desde `main` mediante `.github/workflows/pages.yml`. El directorio `assets` se copia completo, por lo que la ampliación Enterprise forma parte del artefacto de GitHub Pages.

El backend sigue el despliegue existente de `backend/server.js` en Render.

Antes de publicar, GitHub Actions valida JavaScript, reconstruye el bundle empresarial comprimido y comprueba que los archivos requeridos estén incluidos en el despliegue.
