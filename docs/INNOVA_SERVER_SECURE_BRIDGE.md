# Innova Server Secure Bridge V1

Fase 1 de integración: panel de CEO, solicitudes, MFA y auditoría transaccional.

Se conserva Innova Admin Agent V11.4, la intranet y el MCP actual. No se retiran ni reemplazan. Las claves TOTP antiguas expuestas deben renovarse.

**No es todavía una implementación activa para ejecutar en Dell.** Requiere revisión de esquema de company_users, migración en Supabase, pruebas de la Edge Function y un worker separado en Dell. Hasta entonces, no configurar el secreto de worker ni permitir operaciones de producción.

La aprobación requiere perfil superadmin activo, JWT validado por Supabase y código TOTP nuevo: aal2 más AMR totp de menos de dos minutos. La solicitud expira, se reclama de forma atómica y no se repite automáticamente.

La ejecución del Dell deberá validar por segunda vez la operación contra policy.json, comprobar ID único, caducidad y aprobación, y auditar su resultado. No entregar docker.sock, shell root ni claves al navegador o al modelo.
