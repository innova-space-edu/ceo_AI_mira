# Skills operativas de Innova Server Dell

Esta guía complementa skills-manifest.json. Ninguna skill concede privilegios por sí misma. La autenticación de ChatGPT se establece en "Preguntar siempre"; el acceso administrativo se aprueba desde una página detrás de Cloudflare Access, que verifica criptográficamente la identidad y exige correo autorizado y el Dell aplica sus permisos locales.

## 1. Diagnóstico de servidor
Verificar conectividad MCP y estado autenticado; consultar versiones, recursos y servicios sin ejecutar comandos arbitrarios. Si no existe el permiso para leer el anfitrión, informar la limitación y no inferir estados desde PostgreSQL.

## 2. Gestión documental
Listar rutas dentro de /workspace; limitar lectura por tamaño; inspeccionar tipo y hash. Antes de modificar, crear respaldo/versionado y obtener la autorización prevista. No permitir escapes de directorio ni enlaces simbólicos hacia fuera.

## 3. Desarrollo de software
Leer contexto del proyecto, definir cambios mínimos, trabajar en una sola rama/PR, probar sintaxis/tests y emitir diferencias. Nunca fusionar cambios fallidos ni desplegar automáticamente por cada archivo.

## 4. Ejecución aislada
Usar el runner aislado solo con comandos y tiempos permitidos; evitar credenciales, red, volumen Docker y acceso root. Registrar código de salida y limitar salida de texto. Toda operación mutante requiere permiso explícito.

## 5. Despliegue de aplicaciones
Verificar commit, Compose permitido y hash conocido, respaldar configuración, aprobar acción precisa en CEO y aplicar una sola vez. Revalidar salud y tener rollback.

## 6. Administración Docker
Consultar únicamente contenedores autorizados. Restart/stop/start requiere preparación, aprobación CEO, consumo único y revalidación de allowlist justo antes del comando.

## 7. Administración systemd
Consultar solo unidades aprobadas. Para restart, generar un ticket por unidad y acción, esperar la aprobación CEO y verificar ActiveState/SubState.

## 8. Tratamiento de bases de datos
Priorizar SELECT/RLS y backups. Migraciones DDL deben revisarse, probarse en entorno seguro y aprobarse individualmente en CEO. Nunca leer tablas sensibles por un permiso genérico.

## 9. Respaldo y recuperación
Inventariar fuentes y destinos; verificar capacidad; backup previo y checksum; política de retención; restauración simulada antes de sobrescribir datos productivos.

## 10. Seguridad y permisos
Revisar exposición de red, MFA y sesiones, secretos, firewall, roles, claves y registros. Las rotaciones o cambios de ACL requieren aprobación CEO y no deben divulgar claves al chat.

## 11. Integración cloud
Gestionar proyectos aprobados (GitHub, Vercel, Supabase, Cloudflare). Usar integraciones nativas si están disponibles. No duplicar almacenamientos/credenciales sin necesidad y preservar backups.

## 12. Observabilidad e incidentes
Correlacionar métricas/logs/salud del servicio, clasificar impactos y proponer remediación reversible. Separar observación de acción; acciones correctivas requieren aprobación.

## Condición general de ejecución
1. ChatGPT solicita permiso.
2. El Dell valida capacidad y destino permitidos.
3. El Dell calcula el hash SHA-256 del plan canónico y lo envía al backend de aprobaciones de CEO.
4. Un superadmin activo, autenticado mediante Cloudflare Access, revisa y aprueba el plan.
5. El Dell verifica que la respuesta corresponde al hash original, consume el permiso una vez y comprueba nuevamente política local.
6. Ejecuta solo la operación original y registra resultado. Ante cualquier divergencia: **denegar**.
