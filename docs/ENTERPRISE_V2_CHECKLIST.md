# Innova Admin Enterprise v2 — checklist de integración

Esta ampliación extiende la plataforma existente; no crea módulos paralelos de Proyectos, Documentos, Cotizaciones o Facturas.

## Núcleo unificado

- Clientes y proveedores se almacenan en `company_parties` y se reutilizan por RUT normalizado.
- Proyectos usan `client_party_id` además de los campos históricos para compatibilidad.
- Cotizaciones usan `client_party_id` y pueden vincularse a órdenes de compra y facturas.
- Facturas pueden vincularse a cotización, orden de compra, contrato y contraparte.
- Cada factura genera o sincroniza un movimiento de tesorería en `company_transactions`.
- Los archivos empresariales usan `company_files`, con metadatos, categoría, contraparte, vencimiento y hash SHA-256 para evitar copias duplicadas.
- `company_entity_links` permite relacionar documentos y registros sin duplicar información.

## Módulos empresariales

- Clientes y proveedores
- Órdenes de compra
- Contratos y convenios
- Tesorería / cuentas por cobrar y pagar
- Conciliación bancaria
- RR.HH.
- Activos y garantías
- Tributario
- Archivo empresarial
- Aprobaciones
- Vencimientos

## Controles de integridad

- RLS habilitado en todas las tablas empresariales.
- Índices únicos parciales para evitar duplicados tributarios.
- Normalización de RUT en entidades relacionadas.
- Dedupe de archivos mediante SHA-256.
- Integración automática de factura a contraparte y tesorería.
- Búsqueda global ampliada a entidades empresariales.
- Auditor empresarial ampliado para vencimientos, cuentas y documentos.

## Despliegue

El frontend sigue desplegándose mediante GitHub Pages desde `main` y el dominio definido en `CNAME`. El bundle Enterprise v2 se carga después de `admin.js`, de modo que conserva las funciones existentes y añade las nuevas vistas y enlaces.