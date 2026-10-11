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

## Continuidad y servidor interno — requisitos nuevos (propuesta)

- [x] Titular prevé almacenamiento de respaldos de empresa en servidor interno y disco externo nominal de 1 TB. **No existe constatación técnica de instalación ni copias reales.**
- [x] Borrador de política pública de respaldos añadido como `continuidad-respaldos.html`, sujeto a aprobación formal.
- [ ] Confirmar que el servidor interno efectivamente pertenece y es administrado por Innova Space Edu SpA, su país real de alojamiento, personal con acceso y custodia.
- [x] Primera medición no destructiva en Supabase de tamaño de bases y metadatos de Storage para ambos proyectos, realizada el 11-10-2026. Los resultados individuales exactos deben conservarse en el informe privado del proyecto, no en políticas públicas.
- [ ] Validar cifras contra el panel de facturación/Storage, incluir logs, configuraciones, archivos fuera de Storage y crecimiento esperado por ciclo escolar; comprobar espacio disponible y salud del disco de 1 TB.
- [ ] Diseñar permisos, cifrado en reposo y tránsito, aislamiento de red, custodia y recuperación de claves, MFA y registro de accesos privilegiados.
- [ ] Implementar exportación programada e incremental donde sea compatible; respaldos independientes de base de datos y objetos Storage, manifiestos y hashes de integridad. No exponer secretos en scripts/repositorios.
- [ ] Documentar rotación realista de copias según espacio y política de caducidad, incluyendo respaldo de año escolar y excepciones legales. No copiar indiscriminadamente datos fuera de propósito.
- [ ] Añadir segunda copia cifrada independiente (desconectada o fuera del recinto), especialmente contra pérdida simultánea, ransomware, incendio y robo. Un único disco conectado no es estrategia 3-2-1.
- [ ] ATENCIÓN: revisar inmediatamente Storage Usage de la organización Supabase Free; suma de metadatos de archivos de ambos proyectos cercana a cuota de 1 GB compartida por organización. Confirmar consumo facturable y método compatible de reducir o migrar Storage sin borrar datos sujetos a custodia.
- [ ] Acordar RPO/RTO por servicio con responsable institucional, configurar alertas de fallo y ocupación y ejecutar restauración completa aislada con acta; revisar mensualmente en primera fase.
- [ ] Diseñar registro mínimo de supresiones/tombstones para que los datos eliminados legítimamente no reaparezcan al restaurar respaldos anteriores.
- [ ] Revisar si las copias internas requieren controles adicionales por datos de menores/sensibles; documentar accesos, ubicación, incidentes y transferencias si existieran sistemas remotos.
- [ ] Probar el mecanismo de borrado seguro del medio y sus copias y documentar cómo se ejecutará el cierre escolar sin destruir documentos sujetos a conservación obligatoria.
- [ ] Antes de migrar la base de producción, verificar disponibilidad de red, corte eléctrico, UPS, capacidad, monitoreo, recuperación, endpoint HTTPS y custodia de Supabase Auth/Realtime/Storage/RLS; la migración no está aprobada ni hecha.

## Plantillas para la ejecución documental

- Matriz de retención y aprobación por categoría: `docs/PLANTILLA_MATRIZ_CONSERVACION_2026.md`.
- Registro de copias y acta de restauración: `docs/PLANTILLA_RESPALDOS_CONTINUIDAD_2026.md`.
- Toda copia rellenada con datos reales, claves, registros de acceso o nombres de estudiantes debe alojarse en almacenamiento privado de la empresa, nunca en este repositorio público.

## Consentimiento e información granular de EDUAI (fase en desarrollo)

- [x] Definidas categorías de tratamiento y diferencia entre aceptación necesaria de condiciones y permisos opcionales por finalidad.
- [x] Política y DPA corporativos contienen advertencia sobre datos personales o sensibles aportados sin solicitud del modelo; no se configura renuncia de derechos ni exención de responsabilidad.
- [ ] Migración auditada y desplegada del registro por cuenta y evento de permisos (`eduai_privacy_choices`).
- [ ] Revisar y probar que todas las API opcionales respetan preferencias registradas, incluida generación, archivos, voz, publicación y analítica.
- [ ] Completar procedimientos especiales para publicaciones públicas, voz clonada, datos sensibles y menores; casillas de menores no acreditan representación.
- [ ] Verificar una base jurídica específica por tratamiento y que el rechazo opcional no bloquee funciones básicas.
- [ ] Establecer migración de cuentas activas, información en lenguaje claro, revocación efectiva, fechas/versiones y retención de evidencia proporcionada.
- [ ] Confirmar la correspondencia con la PR de EDUAI [#239](https://github.com/innova-space-edu/eduai-platform/pull/239), pendiente de aprobación y sin despliegue.

## Autorizaciones familiares EDUAI y Sello — plan en PR (11/10/2026)

- [x] Documentado método de cuestionario por menor y plataforma, firma electrónica simple, opciones separadas y verificación institucional independiente.
- [x] Los enlaces se generan con token aleatorio almacenado como hash y se preparan para compartir por correo o WhatsApp, **sin envío automático** y sin datos de estudiantes en el mensaje.
- [x] Declarado que ClaveÚnica no está conectada: no ofrecer autenticación estatal sin habilitación normativa; firma avanzada solo con PSC acreditado.
- [x] Pantallas y rutas iniciales en [EDUAI PR #239](https://github.com/innova-space-edu/eduai-platform/pull/239) y [Sello PR #38](https://github.com/innova-space-edu/sello-tecnologico/pull/38), sin despliegue.
- [ ] Aplicar y probar migraciones/RLS/servicios con datos sintéticos, crear y resolver invitaciones en entornos separados.
- [ ] Revisar legalmente cada finalidad opcional y distinguir las actividades obligatorias que no deben depender de consentimiento innecesario.
- [ ] Validar identidad y representación con un canal independiente, incluyendo cuidado personal y conflictos de representación.
- [ ] Integrar OTP u otro sistema de comprobación segura del destinatario y protección contra enlaces reenviados.
- [ ] Implementar aplicación efectiva de cada decisión en todas las API, publicación, medios y agentes; probar revocación y despublicación donde corresponda.
- [ ] Verificar cuentas existentes, adolescentes con capacidad legal propia, comunicación a familias y alternativas de acceso a prestaciones escolares.
- [ ] Evaluar documentación íntegra de firma, comprobante descargable, política de retención de evidencias, custodia en servidor empresarial y transferencias internacionales.
- [ ] Realizar revisión legal de ClaveÚnica, PSC acreditado y firma avanzada únicamente si se aprueba un proveedor real y una habilitación normativa.

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
- Supabase cuotas compartidas por organización y medición: https://supabase.com/docs/guides/platform/billing-on-supabase ; https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- Supabase borrado de Storage mediante API (no SQL solo): https://supabase.com/docs/guides/storage/management/delete-objects
- Cloudflare DPA, versión 6.4, 03-04-2026: PDF entregado por el cliente para revisión; conservar copia documental en lugar interno autorizado, no versionar datos contractuales de clientes ni publicar el PDF sin validar sus condiciones.
- Cloudflare lista de subencargados: https://www.cloudflare.com/gdpr/subprocessors/
- Cloudflare caché/purga: https://developers.cloudflare.com/cache/how-to/purge-cache/purge-everything/

**Observaciones:** el contrato Supabase utiliza autorización general de subencargados (cláusula 6), igual que Cloudflare (cláusula 4.3), mientras que el artículo 15 bis chileno establece autorización específica y por escrito para delegación por el encargado. Revisar jurídicamente el esquema de cadena responsable institucional → Innova → proveedor → subencargados antes de aprobar.
