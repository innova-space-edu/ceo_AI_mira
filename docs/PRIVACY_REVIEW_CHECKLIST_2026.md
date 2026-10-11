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

- [ ] Confirmar razón social exacta, RUT, domicilio postal completo y facultades vigentes del representante legal de Innova.
- [ ] Identificar encargados de prevención si existen, y responsable interno de solicitudes e incidentes.
- [ ] Inventariar flujos reales de datos por módulo y por cliente, incluidos menores, fotos, audios, documentos, calificaciones, PIE/NEE, RUT y metadatos.
- [ ] Confirmar bases de licitud por finalidad, edad y categoría de dato; documentar autorizaciones para divulgación de imágenes y trabajos.
- [ ] Completar calendario de conservación por categoría, almacenamiento/backup, borrado y devolución al término del contrato.
- [ ] Identificar persona jurídica contratante, región, DPA vigente, subencargados y acuerdos de transferencia internacional de Supabase, Vercel, Cloudflare, IA, correo y otros proveedores **efectivamente activos**. No suponer que marcas mencionadas implican tratamientos.
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
