# Innova Server Dell — Puente de autorizaciones CEO (versión de integración)

## Alcance
La autenticación existente en Innova CEO, basada en Supabase Auth y Microsoft Authenticator TOTP (sesión AAL2), aprueba acciones administrativas del Dell. **Este módulo no instala una segunda cuenta, no recibe el TOTP por ChatGPT y no brinda shell root abierto.**

El modo "Preguntar siempre" de ChatGPT es una protección de interfaz separada. No reemplaza validaciones del servidor.

## Preparación antes del despliegue
1. Ejecutar la migración SQL supabase/migrations/20261013_innova_server_approvals.sql sobre el proyecto Supabase CEO con procedimiento auditado, verificando tabla/RLS/permisos.
2. Generar un secreto aleatorio de al menos 32 bytes y guardarlo exclusivamente en las variables seguras del backend de CEO y en el Dell como INNOVA_SERVER_BRIDGE_KEY (mismo valor; nunca en frontend, repositorio ni chat).
3. Confirmar que Render dispone de COMPANY_SUPABASE_SERVICE_ROLE_KEY. Sin ambas variables, los endpoints devuelven 503 (fallo cerrado).
4. Instalar el archivo integracion-dell/ceo-bridge-client.mjs en el agente del Dell con permisos restrictivos. No ejecutar como root por defecto.
5. Conectar el agente administrativo real a solicitarAprobacionCEO / consultarAprobacionCEO / consumirAprobacionCEO. Validar la operación contra la política allowlist **antes de solicitar** y **otra vez antes de ejecutar**.
6. Mantener el portal TOTP local de V11 como respaldo y no retirarlo hasta completar pruebas extremo a extremo. El Dell actualmente exige su sesión privada; NO desactivarla de forma anticipada.
7. Verificar que la página servidor.html comparte el login de CEO y permite completar MFA AAL2. Solo superadmin activo puede decidir.
8. Realizar simulaciones positivas y negativas, comprobar auditoría y luego habilitar en producción con un único despliegue controlado.

## Protocolo
- El MCP recibe la petición, exige la autorización de ChatGPT y efectúa validaciones allowlist.
- El Dell calcula SHA-256 de JSON canónico del tipo, destino y parámetros originales; guarda el plan exacto.
- El Dell envía solicitud con clave de máquina a POST /api/innova-server/v1/requests. No envía secretos, comandos completos ni acceso al host.
- CEO muestra la solicitud al administrador con MFA AAL2, quien aprueba o rechaza explícitamente por ID + hash.
- El Dell consulta GET /requests/:id y consume POST /requests/:id/consume: solo status "approved" cambia atómicamente a "consumed" si el hash coincide y no venció.
- Tras recibir authorized=true, el Dell comprueba de nuevo política y ejecuta esa misma operación. Registrar id, hash, acción, resultado, fecha y actor; no registrar claves.
- Ante error de red, OTP inválido, usuario no activo, operación modificada, expiración, rechazo o duplicación, denegar ejecución.

## Limitaciones deliberadas
- La página web no ejecuta operaciones; únicamente autoriza operaciones concretas.
- Las skills del manifiesto son instrucciones para el agente y su registro sigue pendiente en el MCP real hasta autenticarse en Dell. No confundir catálogo preparado con herramientas instaladas.
- Supabase service_role y clave de máquina nunca se exponen al navegador. La tabla está cerrada a anon y authenticated.
- Las herramientas del MCP V10.1 disponibles hoy no incluyen control real de Docker/systemd ni acceso al host. Para activarlas, el agente V11 debe validarse por SSH/Tailscale.
- Una aprobación de CEO no puede sustituir la lista de destinos permitidos por policy.json. Una acción de alto riesgo sigue requiriendo confirmación explícita.
- El código TOTP mostrado antes en un chat debe rotarse antes de usar el sistema de forma definitiva.

## Pruebas
node --check backend/server.js
node --check backend/innova-server-bridge.js
node --check server-access.js
node --check integracion-dell/ceo-bridge-client.mjs
node --test backend/tests/innova-server-bridge.test.js

## Seguridad de despliegue
No fusionar ni activar el puente si faltan migración, variables privadas, verificación AAL2 y pruebas de denegación/replay. No realizar deploy por cada archivo: agrupar todo en un solo PR y hacer un único despliegue después de validar.
