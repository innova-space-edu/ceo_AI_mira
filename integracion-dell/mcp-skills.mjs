import { readFile } from "node:fs/promises";
import { operationDigest } from "./ceo-bridge-client.mjs";

// SDK MCP moderno: registrarSkillsMCP(mcpServer, z) tras middleware de
// autenticación/autorización existente, NUNCA en un servidor público sin auth.
export async function registrarSkillsMCP(server, z) {
  if (!server || typeof server.registerTool !== "function" || !z?.string)
    throw Error("mcp_sdk_incompatible");
  const manifest = JSON.parse(await readFile(new URL("./skills-manifest.json", import.meta.url), "utf8"));
  if (manifest.version !== "12.0-draft" || !Array.isArray(manifest.skills))
    throw Error("catalogo_skills_invalido");
  const all = new Map();
  for (const skill of manifest.skills) {
    if (typeof skill.id !== "string" || all.has(skill.id))
      throw Error("skill_duplicada_o_invalida");
    all.set(skill.id, skill);
  }
  const content = result => ({ content: [{ type: "text", text: JSON.stringify(result) }] });
  server.registerTool("innova_skills_listar", {
    title: "Listar skills de Innova Server",
    description: "Catálogo autorizado de guías de uso del Dell; no ejecuta operaciones.",
    inputSchema: {}
  }, async () => content({
    version: manifest.version,
    skills: manifest.skills.map(({ id, name, description, approval }) =>
      ({ id, name, description, approval }))
  }));
  server.registerTool("innova_skills_detallar", {
    title: "Detalle de skill Innova",
    description: "Devuelve el procedimiento y los permisos de una skill declarada.",
    inputSchema: { id: z.string() }
  }, async ({ id }) => content(all.get(id) || { error: "skill_no_encontrada" }));
  server.registerTool("innova_skills_planificar", {
    title: "Planificar acción Innova",
    description: "Prepara un plan sin ejecutar nada, asigna requisito de CEO y SHA-256.",
    inputSchema: { skill_id: z.string(), action: z.string(),
      target: z.string(), summary: z.string() }
  }, async ({ skill_id, action, target, summary }) => {
    const skill = all.get(skill_id);
    if (!skill || !skill.tools?.length || !/^[a-z][a-z._-]{2,45}$/.test(action) ||
        !/^[a-zA-Z0-9_.:/@-]{1,160}$/.test(target) ||
        target.split("/").some(part => part === ".." || part === "." || part === "") ||
        typeof summary !== "string" || summary.length < 8)
      return content({ error: "plan_no_permitido" });
    return content({
      state: "BORRADOR_NO_AUTORIZADO",
      skill: skill_id, action, target, summary,
      payload_sha256: operationDigest({ action, target, parameters: {} }),
      steps: ["validar_politica_local", "solicitar_autorizacion_en_ceo",
        "verificar_access_jwt_firmado_y_correo_autorizado", "consumir_ticket_unico", "revalidar_y_ejecutar"],
      approved: false
    });
  });
  return manifest.skills.length;
}
