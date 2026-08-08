# Innova Admin

Plataforma empresarial privada de **Innova Space Education SPA** integrada al sitio público `innova-space-edu.cl`.

## Acceso

- Sitio público: `https://www.innova-space-edu.cl/`
- Plataforma: `https://www.innova-space-edu.cl/admin.html`
- Cuenta administrativa inicial autorizada: `contacto@innova-space-edu.cl`
- El primer registro exige confirmación del correo en Supabase Auth.
- Las acciones críticas de usuarios exigen MFA/TOTP (`aal2`).

## Componentes

### Frontend estático

Archivos principales:

- `admin.html`: shell, login, MFA y navegación.
- `admin.css`: interfaz responsive.
- `admin.js`: lógica de proyectos, documentos, cotizaciones, facturas, MIRA, auditor y usuarios.
- `admin-config.js`: configuración pública de Supabase y backend.
- `admin-nav.js`: acceso transparente desde la navegación del sitio público.

GitHub Pages valida la sintaxis JavaScript antes de publicar.

### Backend MIRA / Render

`backend/server.js` mantiene las rutas públicas existentes y agrega:

- `POST /api/admin/mira`: MIRA Business. Requiere JWT válido y usuario empresarial activo.
- `POST /api/admin/notify`: notificación administrativa manual. Requiere rol `superadmin` o `admin`.

El backend valida el JWT contra Supabase Auth y el rol contra `company_users` mediante RLS.

### Supabase

Proyecto actual: `alogqktilzgylzomzwem`.

Todas las entidades del sistema usan prefijo `company_` para aislarlas de otros datos existentes:

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

Bucket privado: `company-files`.

RLS está habilitado en todas las tablas empresariales y en el bucket. Los roles son:

- `superadmin`
- `admin`
- `finance`
- `project_manager`
- `viewer`

## Agente Auditor

Función SQL: `company_run_audit()`.

Revisa, entre otras condiciones:

- proyectos vencidos;
- cotizaciones vencidas;
- facturas pendientes vencidas;
- cotizaciones aprobadas sin factura asociada;
- proyectos activos sin actividad reciente.

Edge Function: `company-auditor`.

La función usa un token interno almacenado en Supabase Vault y puede enviar un resumen por correo utilizando el backend corporativo ya desplegado.

Cron activo:

```text
company-auditor-daily
0 12 * * * UTC
```

Corresponde a las 08:00 en Chile mientras rige UTC-4.

## Usuarios

Edge Function: `company-user-admin`.

Permite al superadministrador invitar y modificar usuarios. Exige:

1. sesión válida;
2. perfil activo en `company_users`;
3. rol `superadmin`;
4. nivel de autenticación `aal2` mediante MFA/TOTP.

La cuenta principal `contacto@innova-space-edu.cl` no puede ser degradada ni deshabilitada por esta función.

## Facturas y DTE

El sistema acepta PDF o XML. Cuando se importa XML DTE se leen directamente campos como:

- TipoDTE
- Folio
- FchEmis
- FchVenc
- RUTEmisor
- RznSoc
- RUTRecep
- MntNeto
- MntExe
- IVA
- MntTotal

El archivo original siempre queda almacenado en el bucket privado. Los PDF con texto se procesan localmente en el navegador con PDF.js para proponer datos, que deben revisarse antes de guardar.

## Documentos y cotizaciones

Los documentos se almacenan como HTML/JSON y poseen historial automático en `company_document_versions`. El frontend permite exportar a PDF.

Las cotizaciones se guardan como datos estructurados y calculan subtotal, descuento, neto, IVA y total. También generan un documento asociado para vista y exportación.

## Seguridad

- La publishable key utilizada en el frontend es pública por diseño; nunca se expone `service_role`.
- Storage es privado y utiliza URLs firmadas para lectura.
- RLS protege todas las entidades empresariales.
- MFA protege cambios de usuarios.
- MIRA Business valida JWT y rol en el servidor.
- El auditor usa Vault para su token interno.
- `admin.html` incluye `noindex`, `nofollow` y `noarchive`.
- El registro inicial de Auth está protegido por confirmación de correo.

## Despliegue

El frontend se despliega automáticamente desde `main` mediante `.github/workflows/pages.yml`.

El backend sigue el despliegue existente de `backend/server.js` en Render.

Antes de publicar, GitHub Actions ejecuta `node --check` sobre los archivos JavaScript críticos.
