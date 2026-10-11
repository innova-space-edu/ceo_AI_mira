# Innova Connect V1 — Innova CEO ↔ Intranet Dell

Estado: **implementación en PR, aún no desplegada ni instalada en Dell**.

## Propósito
El backend de Innova CEO expone una API de **solo lectura** para consultar proyectos,
documentos editables y metadatos de archivos. Los objetos de Supabase Storage
se ofrecen únicamente mediante enlaces firmados de 60 segundos.

### Endpoints protegidos (GET)

| Ruta | Respuesta |
| --- | --- |
| /api/innova-connect/v1/projects | Lista de proyectos (metadatos) |
| /api/innova-connect/v1/documents | Lista de documentos |
| /api/innova-connect/v1/files | Lista de archivos |
| /api/innova-connect/v1/documents/:id | Documento editable, incluido content_html |
| /api/innova-connect/v1/files/:id/link | Enlace firmado para lectura, expiración 60 s |

Listados admiten query limit=1..100 (25 por defecto), offset=0..10000 y
project_id=<UUID> (solo documents/files). Resultados incluyen items,
limit, offset y has_more (indicativo, no recuento exacto).

## Seguridad, sesiones y permisos
- Requiere cabecera \`Authorization: Bearer <JWT de Supabase Auth Innova CEO>\`.
- Backend comprueba sesión real y usuario activo en company_users.
- Todas las consultas usan **ese mismo JWT**, con publishable key,
  para que Supabase aplique permisos RLS de ese usuario.
- **Nunca** usar service_role para el puente documental ni exponer JWT o secret keys en
  frontend, logs, URL o ChatGPT.
- No hay endpoints de escritura, ni acceso directo a facturas o datos tributarios.
- Todas las respuestas envían \`Cache-Control: private, no-store\`.
- Los enlaces firmados son credenciales temporales: nunca guardarlos en logs,
  historial de navegación persistente ni base de datos.
- \`content_html\` es contenido no confiable: sanear con una biblioteca HTML
  mantenida y mostrar en un visor aislado; no insertar sin tratamiento con
  \`dangerouslySetInnerHTML\`.
- La autorización sigue siendo la definida por las políticas RLS de
  company_projects, company_documents, company_files y storage.objects.
  **Auditar esas políticas en Supabase antes de exponer a usuarios externos.**
- No configura MCP remoto ni conexión ChatGPT directa en V1.

## Integración Dell Next.js (pendiente instalación)
1. Revisar V7, respaldos, ClamAV y el estado del Docker Compose del Dell.
2. Desplegar la nueva versión del backend CEO tras aprobar el PR y pasar CI.
3. Crear en la intranet una asociación de identidad **Better Auth ↔ Supabase
   Auth de Innova CEO**, con consentimiento del usuario, tokens cifrados en
   servidor y renovación/revocación de sesión. No basta asociar correos iguales.
4. Usar el módulo \`integrations/innova-connect/ceo-client.mjs\` **solo del lado
   servidor** (Node.js de Next.js) y ejecutar sus funciones después de
   verificar la sesión Better Auth y los permisos de intranet.
5. En la vista empresarial, listar recursos y generar enlaces de archivo solo
   cuando el usuario autorizado hace clic. La intranet nunca consulta
   service_role de CEO ni expone credenciales en NEXT_PUBLIC_*.
6. Configurar \`INNOVA_CEO_API_URL=https://ceo-ai-mira.onrender.com\` en el
   backend de la intranet, únicamente después de verificar URL de producción.
7. Validar acceso con administrador y usuario sin permisos, bloqueo de enlaces
   vencidos, acceso cruzado, paginación, auditoría y desconexión.

### Ejemplo desde un backend autorizado
\`\`\`js
import { listCeoFiles } from "./ceo-client.mjs";

// ceoJwt proviene de un enlace de sesión ya autenticado, validado y autorizado.
const { items } = await listCeoFiles(ceoJwt, { limit: 20 });
\`\`\`

## Preparación de ChatGPT / MCP V2
Se puede implementar un servidor MCP remoto con autorización delegada
(OAuth), herramientas de consulta limitada y auditoría sobre esta API.
No se debe exponer directamente al Internet la intranet, PostgreSQL,
Cockpit o el servidor Docker por habilitar MCP.
La compatibilidad de instalación depende del plan y las capacidades
actuales de ChatGPT. El MVP no modifica esta superficie.

## Alcance fuera de V1
- V7 del Dell **no verificada**.
- Sin migración/sincronización de datos ni almacenamiento de archivos en Dell.
- Sin despliegue de Render/Vercel/GitHub Pages.
- Sin nuevas tablas ni cambios RLS en Supabase.
- Sin instalación en Dell (requiere acceso operativo al equipo).
- Migrar EDUAI y Sello Tecnológico requiere **copias separadas** de Postgres,
  Auth, Storage, Edge Functions y configuraciones antes de cambio de DNS o
  de endpoints. Mantener producción actual hasta prueba de restauración.
