import test from "node:test";
import assert from "node:assert/strict";
import { registrarSkillsMCP } from "./mcp-skills.mjs";
import { operationDigest } from "./ceo-bridge-client.mjs";

test("12 skills disponibles sin usar privilegios", async () => {
  const tools = new Map(), server = {
    registerTool(name, config, handler) { tools.set(name, { config, handler }); }
  };
  const count = await registrarSkillsMCP(server, { string: () => ({}) });
  assert.equal(count, 12);
  assert.deepEqual([...tools.keys()], [
    "innova_skills_listar", "innova_skills_detallar", "innova_skills_planificar"
  ]);
  const listing = JSON.parse((await tools.get("innova_skills_listar").handler()).content[0].text);
  assert.equal(listing.skills.length, 12);
  const detail = JSON.parse((await tools.get("innova_skills_detallar").handler({ id: "desarrollo-software" })).content[0].text);
  assert.equal(detail.id, "desarrollo-software");
  const rejected = JSON.parse((await tools.get("innova_skills_planificar").handler({
    skill_id: "diagnostico-servidor", action: "docker.restart", target: "../etc", summary: "Operación no autorizada"
  })).content[0].text);
  assert.equal(rejected.error, "plan_no_permitido");
  const plan = JSON.parse((await tools.get("innova_skills_planificar").handler({
    skill_id: "administracion-docker", action: "docker.restart", target: "intranet-portal", summary: "Reiniciar portal Dell autorizado"
  })).content[0].text);
  assert.equal(plan.approved, false);
  assert.equal(plan.state, "BORRADOR_NO_AUTORIZADO");
  assert.match(plan.payload_sha256, /^[a-f0-9]{64}$/);
});
test("SHA de operaciones canónicas estable y sensible a parámetros", () => {
  const a = operationDigest({ action: "docker.restart", target: "portal",
    parameters: { options: { b: 2, a: 1 } } });
  const b = operationDigest({ action: "docker.restart", target: "portal",
    parameters: { options: { a: 1, b: 2 } } });
  const c = operationDigest({ action: "docker.restart", target: "portal",
    parameters: { options: { a: 1, b: 3 } } });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
