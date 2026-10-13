# Innova Server Dell — Cloudflare Access + aprobaciones por operación (PRE-DESPLIEGUE)

## Estado
Código del backend, portal y cliente MCP preparado en un único PR. No está desplegado ni instalado en el Dell.
**No borrar el TOTP existente hasta comprobar el acceso de Cloudflare y el MCP de extremo a extremo.**
El modo de permisos del complemento ChatGPT es **Preguntar siempre**.

## Arquitectura acordada
- Portal de aprobaciones: https://acceso.innova-space-edu.cl/api/innova-server/v1/portal.
- Cloudflare Access entrega código de un solo uso por correo a direcciones autorizadas. Protege TODO ese subdominio.
- El backend de Innova CEO (Render) solo acepta una aprobación si el JWT de Cloudflare presenta firma RSA válida (JWKS oficial), issuer/team, AUD de la aplicación, tiempo de vida corto, sesión humana y correo en la allowlist.
- El Dell utiliza una clave máquina distinta (INNOVA_SERVER_BRIDGE_KEY) para crear/consultar/consumir solicitudes; **nunca** envía esta clave al navegador.
- Cada aprobación se vincula a un SHA-256 canónico de acción/destino/parámetros, vence a los 10 minutos y solo puede consumirse una vez. El agente del Dell debe revalidar allowlist local ANTES y DESPUÉS de aprobar.
- El backend nunca recibe TOTP ni ejecuta comandos. Las operaciones en Docker/systemd siguen necesitando agente local con políticas y auditoría.

## Preparación en Cloudflare (interfaz web)
1. Cloudflare Zero Trust > Integrations > Identity providers: reutilizar **One-time PIN** si ya está activo para la intranet. No crear otro si no es necesario.
2. Access controls > Applications > Add application > **Self-hosted**.
3. Nombre: Innova Server Dell · Aprobaciones. Hostname exacto: **acceso.innova-space-edu.cl**, sin rutas comodín externas ni bypass.
4. Política **Allow** con únicamente las direcciones de correo administradoras autorizadas. No usar regla Everyone ni permitir dominio completo.
5. Duración de sesión de Access: **30 minutos** (compatible con máximo admitido por backend de una hora). Habilitar login mediante One-time PIN, no método adicional si deseas correo solamente.
6. En la aplicación, copiar **Application Audience (AUD)**. Desde Zero Trust Settings, obtener el **Team domain** (https://TU-EQUIPO.cloudflareaccess.com). NO compartir tokens JWT ni códigos por chat.
7. Configurar DNS proxied (nube naranja) para el subdominio, apuntando al backend Render **tras añadir ese hostname como Custom Domain del servicio Render**. No exponer puertos del Dell ni túnel SSH al público.

## Preparación en Render (valores secretos no se publican)
- Añadir al backend CEO el dominio personalizado acceso.innova-space-edu.cl y confirmar SSL/health.
- Variables:
  - INNOVA_CF_TEAM_DOMAIN=https://TU-EQUIPO.cloudflareaccess.com
  - INNOVA_CF_ACCESS_AUD=... Application Audience (AUD) ...
  - INNOVA_CF_APPROVERS=correo-1@example.com,correo-2@example.com
  - INNOVA_CF_PORTAL_ORIGIN=https://acceso.innova-space-edu.cl
  - INNOVA_SERVER_BRIDGE_KEY=secreto_aleatorio_>=32_caracteres generado en un gestor seguro
  - COMPANY_SUPABASE_SERVICE_ROLE_KEY=clave existente solo en backend (si aún falta, configurar de forma segura)
- La nueva aplicación debe quedar detrás de Cloudflare Access. El backend rechaza todas las solicitudes del portal que no lleven JWT válido incluso si se intenta entrar por *.onrender.com.
- El cliente del Dell envía solicitudes máquina al URL **ceo-ai-mira.onrender.com** por TLS, NO al hostname con Access de usuarios. La clave máquina debe instalarse en el Dell fuera de Git y sin acceso al navegador.

## Migración SQL
Aplicar tras respaldo y revisión supabase/migrations/20261013_innova_server_approvals.sql **al proyecto Supabase de CEO**, no a EDUAI ni Sello Tecnológico. Esta cuenta no está disponible en las conexiones Supabase actuales; no ejecutar la migración en el proyecto incorrecto. El registro usa approved_email y mantiene approved_by nullable por compatibilidad.
Conservar RLS y acceso service_role desde backend solamente.

## Preparación del Dell
1. Por SSH/Tailscale, validar versión efectiva de V11 y extraer copia de seguridad del agente, configuración, service units y política de allowlist.
2. Integrar integracion-dell/ceo-bridge-client.mjs; registrar el catálogo con integracion-dell/mcp-skills.mjs solamente dentro del MCP autenticado.
3. Sustituir **la compuerta TOTP del MCP** por un mecanismo de autorización que reconozca exclusivamente la sesión aprobada por Cloudflare y permisos mínimos. Importante: Cloudflare protege el portal web, pero no autentica automáticamente el túnel de ChatGPT. El MCP necesita verificación de sesión vinculada a usuario/acción y prohibir funciones sin esa identidad; no comentar ni eliminar checks.
4. Mantener un acceso break-glass SSH privado por Tailscale y cierre de sesiones existentes; rotar secreto TOTP antiguo previamente divulgado antes de desactivar la ruta.
5. Después de pruebas negativas (acceso directo, usuario no autorizado, token inválido, operación alterada, aprobación vencida/repetida, rollback) deshabilitar el portal TOTP y retirarlo del proxy. Mantener los backups y documentar procedimiento de reversión.

## Comprobaciones obligatorias antes de publicar
- No se accede a https://acceso.innova-space-edu.cl/api/innova-server/v1/portal sin pasar por la pantalla Access.
- Correo no autorizado no recibe acceso; código de correo incorrecto no permite acceso.
- JWT falsificado o de otra aplicación devuelve 403.
- Navegador autorizado ve solicitudes, puede rechazar, aprobar exactamente una acción y recibe auditoría (correo, fecha, ID y hash).
- El MCP permanece bloqueado sin sesión autorizada; la aprobación de una acción NO habilita permisos generales de root o shell.
- Todas las operaciones críticas requieren permiso ChatGPT + aprobación Cloudflare + política Dell.
- Un deploy de CEO solo después de CI verde y datos Cloudflare completos.

## Comandos de pruebas
node --check backend/cloudflare-access.js
node --check backend/innova-server-bridge.js
node --check backend/cloudflare-portal.js
node --test backend/tests/cloudflare-access.test.js backend/tests/innova-server-bridge.test.js integracion-dell/mcp-skills.test.mjs

## Restricciones
El conector actual sigue pidiendo TOTP y **no es accesible desde ChatGPT**. No afirmar que la retirada está aplicada al Dell o que Cloudflare ya está configurado.
El fallo del CI general de CEO con rat-eduai.pdf es un asunto independiente que se revisa aparte y no justifica una implementación sin pruebas.
