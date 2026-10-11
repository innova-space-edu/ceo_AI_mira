# Revisión legal y técnica — paquete Ley 21.719 (octubre 2026)

**Estado:** PROPUESTA NO APROBADA · Dominio previsto: innova-space-edu.cl  
**Repositorio:** innova-space-edu/ceo_AI_mira  
**Alcance:** política corporativa, DPA modelo y protocolos públicos para EDUAI y Sello Tecnológico.

## Hallazgos observables en código (11-10-2026)

- EDUAI: existen `app/privacidad/page.tsx`, `app/terminos/page.tsx`, `app/seguridad/page.tsx` y `app/gobernanza-ia/page.tsx`, fechadas 24-07-2026.
- Sello Tecnológico: el README documenta Supabase Auth, RLS, Storage, perfiles con nombre/RUT/curso, evaluaciones, evidencias, mensajería y publicaciones en la comunidad. No se observó ruta pública `src/app/privacidad` en el árbol de archivos revisado.
- Sello: el README señala una asignación inicial de rol docente por dominio @colprovidencia.cl. Verificar el algoritmo real, comprobación del dominio y los privilegios resultantes antes de utilizarlo como control de acceso.
- Web corporativa: ya existe `documentos.html` y condiciones comerciales en `legal.js`. El DPA propuesto no debe confundirse con esas condiciones generales.

## Bloqueos para aprobar/publicar documentos definitivos

- [x] Recibidos del titular y agregados al borrador: Innova Space Edu SpA, RUT 78.220.699-0, representante legal Iván Eduardo Morales Sandoval. Pendiente contrastar con antecedentes societarios y vigencia del poder.
- [x] Domicilio legal recibido del titular e incorporado al borrador: Libertad 514, Vallenar, Región de Atacama, Chile, código postal 1611076. Pendiente contrastarlo con documentación societaria.
- [ ] Identificar encargados de prevención si existen, y responsable interno de solicitudes e incidentes.
- [ ] Inventariar flujos reales de datos por módulo y por cliente, incluidos menores, fotos, audios, documentos, calificaciones, PIE/NEE, RUT y metadatos.
- [ ] Confirmar bases de licitud por finalidad, edad y categoría de dato; documentar autorizaciones para divulgación de imágenes y trabajos.
- [x] Incorporado calendario de eliminación anual escolar propuesto: aviso de al menos 30 días, recordatorio 7 días, cierre por institución y supresión elegible de producción hasta 30 días después; sujeto a aprobación del responsable y excepciones legales.
- [x] Plan Supabase informado por el titular: Free para EDUAI y Sello Tecnológico, con región primaria us-west-2 (EE. UU.) comprobada para ambos proyectos.
- [ ] Diseñar, configurar, documentar y probar copias externas cifradas de PostgreSQL y archivos Storage, porque el plan Free no incluye respaldos automáticos garantizados ni PITR; verificar RPO/RTO y periodicidad aceptados.
- [ ] Determinar retención técnica efectiva de logs, Auth, cachés, respaldos externos y copias operacionales de proveedores; no confundir la inexistencia de backups incluidos en Free con prueba de borrado total inmediato.
- [ ] Aprobar y probar la exportación de datos de usuarios, padres/apoderados y establecimientos, y la protección de registros académicos oficiales.
- [x] Localizados DPA Supabase Pte. Ltd v1 (01-08-2026), política de responsabilidad compartida, Terms y DPA Cloudflare Inc. v6.4 (03-04-2026) aportado por el titular; enlace a lista de subencargados.
- [x] Observados en Supabase dos proyectos activos, `sello-tecnologico` y `Edu-AI`, con región primaria `us-west-2` (EE. UU.) al 11-10-2026.
- [ ] Comprobar la identidad del cliente contractual, aceptación del DPA de cada proveedor y condiciones del servicio específico.
- [ ] Completar subencargados reales y acuerdos de transferencia internacional de Supabase, Vercel, Cloudflare, IA, correo y otros proveedores **efectivamente activos**. No suponer que marcas mencionadas implican tratamientos.
- [ ] Definir y obtener autorizaciones escritas específicas de subencargados por contrato institucional (art. 15 bis).
- [ ] Validar mediante pruebas RLS, roles, compartición de archivos y buckets, páginas públicas, enlaces temporales, MFA, backups y respuesta a incidentes.
- [ ] Validar qué módulos de IA envían qué datos, regiones, retención y condiciones de entrenamiento.
- [ ] Evaluar necesidad de EIPD según art. 15 ter para tratamientos de riesgo elevado.
- [ ] Actualizar y enlazar la documentación visible dentro de EDUAI y Sello Tecnológico evitando textos contradictorios.
- [ ] Revisar jurídicamente política/DPA/protocolos, aprobar versión, fecha de vigencia y firmar DPA concreto por institución.
- [ ] Solo tras aprobación, eliminar las advertencias de borrador y fusionar/publicar en el dominio.

## Norma primaria consultada

- Ley 19.628 y reforma Ley 21.719: https://www.bcn.cl/leychile/navegar?idNorma=1209272
- Art. 14 ter: información pública mínima. Art. 15 bis: encargo escrito. Art. 16 quáter: menores.
- Entrada en vigor general: 01-12-2026.

El material público evita describir la topología y los detalles internos que podrían facilitar ataques. Los protocolos operativos específicos y las evidencias sensibles deben permanecer privados.

## Fuentes del análisis de proveedores (11-10-2026)

- Supabase DPA (versión 1 de 01-08-2026): https://supabase.com/legal/customer-resources/data-processing-addendum
- Supabase GDPR y responsabilidad compartida: https://supabase.com/docs/guides/security/gdpr-compliance
- Supabase Terms: https://supabase.com/terms
- Supabase backups por plan (Free: exportación recomendada mediante Supabase CLI db dump, sin backups automáticos garantizados): https://supabase.com/docs/guides/platform/backups
- Supabase precios y alcance del plan Free: https://supabase.com/pricing
- Supabase borrado de Storage mediante API (no SQL solo): https://supabase.com/docs/guides/storage/management/delete-objects
- Cloudflare DPA, versión 6.4, 03-04-2026: PDF entregado por el cliente para revisión; conservar copia documental en lugar interno autorizado, no versionar datos contractuales de clientes ni publicar el PDF sin validar sus condiciones.
- Cloudflare lista de subencargados: https://www.cloudflare.com/gdpr/subprocessors/
- Cloudflare caché/purga: https://developers.cloudflare.com/cache/how-to/purge-cache/purge-everything/

**Observaciones:** el contrato Supabase utiliza autorización general de subencargados (cláusula 6), igual que Cloudflare (cláusula 4.3), mientras que el artículo 15 bis chileno establece autorización específica y por escrito para delegación por el encargado. Revisar jurídicamente el esquema de cadena responsable institucional → Innova → proveedor → subencargados antes de aprobar.
