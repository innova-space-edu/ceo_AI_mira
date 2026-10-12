# Estado público de implementación — privacidad
**Versión:** 1.2 · 12 de octubre de 2026 · Innova Space Edu SpA

Documento de seguimiento público; no es certificado de cumplimiento, contrato firmado ni informe de seguridad. Los expedientes técnicos y matrices completas se custodian con acceso restringido.

## Recursos publicados
- [x] Centro de privacidad, política general de tratamiento y contacto.
- [x] DPA modelo público sin firmas, para individualización y aprobación por cada relación.
- [x] Protocolos, derechos, menores, uso de IA e incidentes.
- [x] Resúmenes públicos diferenciados [RAT EDUAI](../rat-eduai.html) y [RAT Sello Tecnológico](../rat-sello.html).
- [x] [Acta de gobernanza y designación](../acta-gobernanza-2026.html) con estado de ratificación pendiente.
- [x] Biblioteca corporativa con 13 PDF: tres originales históricos sin sobrescribir y diez PDF generados desde documentos públicos, incluidos RAT EDUAI, RAT Sello y acta en borrador. Los tres también conservan páginas web.
- [x] Criterios de conservación, devolución y respaldos publicados como propuestas sujetas a contratos y pruebas.
- [x] Aviso de transición operativa desde el 15 de noviembre de 2026 para cuentas anteriores, diferente de la vigencia general de Ley 21.719 desde 1 de diciembre de 2026.

## Inventarios técnicos realizados al 12-10-2026
- EDUAI: 22 tratamientos agrupados, 142 tablas y 18 buckets. Supabase principal en us-west-2, Estados Unidos.
- Sello: 18 tratamientos agrupados, 86 tablas y 6 buckets. Supabase principal en us-west-2, Estados Unidos.
- En ambos casos existen matrices internas por tabla, categoría, proveedor, conservación y medidas con validaciones abiertas. No se publican hallazgos técnicos explotables ni datos de titulares.
- Esthefano Gonzalo Morales Campaña ha sido propuesto como delegado responsable interno; su aceptación y la ratificación societaria siguen pendientes.

## Acciones pendientes de verificación y cierre
- [ ] Ratificación y firma del acta por autoridad competente y delegado.
- [ ] Formalización de los DPA por institución y de los subencargos/transferencias internacionales que correspondan.
- [ ] Aprobación de bases de licitud y plazos por tratamiento e institución.
- [ ] Verificación de RLS, roles, APIs, segregación de datos y almacenamiento.
- [ ] Pruebas de permisos, revocación, autorización familiar y correo transaccional.
- [ ] EIPD cuando proceda, especialmente proctoring, voz y publicación de imágenes de NNA.
- [ ] Copias cifradas, restauración, conservación, eliminación y reintroducción desde backups.
- [ ] Seguimiento de incidencias, solicitudes de derechos y formación con evidencia verificable.

## Alcance corporativo
Innova Space Edu SpA presta servicios de creación, despliegue, alojamiento y mantenimiento de sitios y plataformas web, desarrollo de EDUAI y Sello Tecnológico, servidores e intranets, modelos de IA, investigación, seguridad y remodelación. La finalidad y el rol jurídico se documentan por actividad y contrato.

**Contacto:** contacto@innova-space-edu.cl

## Estado funcional actualizado de EDUAI (12-10-2026)
- [x] Video Studio en mantenimiento (sin lanzamiento de generación de video); rutas de nuevos trabajos y procesador bloqueadas en producción.
- [x] Recargas y video premium deshabilitados en la configuración de Supabase (ambos indicadores en `false`). Las órdenes históricas no prueban cobros efectivos y se conservan para trazabilidad.
- [ ] Revisar los registros E17 de pagos, créditos y facturación, regularización de órdenes pendientes o rechazadas, documentación PSP (Mercado Pago cuando corresponda) y regla R14 de conservación.
- [ ] Fusionar, desplegar y verificar controles E13 de clonación vocal administrativa exclusiva; el PR #245 por sí solo no acredita control implementado. No afecta transcripción ni síntesis de voz genérica.
- [ ] Pruebas de extremo a extremo de autorizaciones familiares, representación legal y registro de actas/versiones en EDUAI y Sello.
- [ ] Resolver resultado fallido de auditoría de dependencias EDUAI separado del build que completó con éxito.
- [ ] Pruebas directas de endpoints desplegados de video/pagos (rechazo a usuarios autenticados y tráfico sin autorización).

## Proveedor y hosting: distinción entre capacidad y operación
- EDUAI y Sello son servicios desarrollados por Innova. Los módulos planificados, en mantenimiento o sujetos a permisos no se declaran operativos.
- Integraciones contractuales pendientes: DPA y transferencias de Supabase, Vercel, Cloudflare y proveedores de IA según la operación; documentación del PSP solo si procede.
- Servidores, intranets, modelos de IA, investigación, ciberseguridad y remodelación figuran como capacidades y proyectos ofrecidos. No presumir que equipamiento o intranets personales sean hospedaje corporativo contratado.
