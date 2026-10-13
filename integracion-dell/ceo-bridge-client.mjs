import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Invocar solo DENTRO del proceso/agent MCP confiable del Dell.
// No se autoriza ejecución arbitraria: política local debe validar antes y después.
const DEFAULT_URL = "https://ceo-ai-mira.onrender.com/api/innova-server/v1";
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
    return out;
  }
  return value;
}
export function operationDigest({ action, target, parameters = {} }) {
  if (typeof action !== "string" || typeof target !== "string") throw Error("operacion_invalida");
  return createHash("sha256").update(
    JSON.stringify(canonical({ action, target, parameters })), "utf8"
  ).digest("hex");
}
async function api(path, method, body, {
  baseUrl = process.env.INNOVA_CEO_BRIDGE_URL || DEFAULT_URL,
  secret = process.env.INNOVA_SERVER_BRIDGE_KEY
} = {}) {
  if (!secret || secret.length < 32) throw Error("puente_sin_credenciales");
  const url = new URL(baseUrl.replace(/\/$/, "") + path);
  if (url.protocol !== "https:") throw Error("puente_requiere_https");
  const res = await fetch(url, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Error("ceo_" + res.status + "_" + (json.error || "denegado"));
  return json;
}
export async function solicitarAprobacionCEO(operation, options = {}) {
  // PRECONDICIÓN: la política local ha validado la operación exacta.
  const payload_sha256 = operationDigest(operation);
  const result = await api("/requests", "POST", {
    action: operation.action, target: operation.target,
    payload_sha256, request_nonce: randomBytes(24).toString("base64url"),
    summary: operation.summary
  }, options);
  const request = result.request;
  if (!request || request.payload_sha256 !== payload_sha256)
    throw Error("respuesta_ceo_no_coincidente");
  return { requestId: request.id, payload_sha256, expires_at: request.expires_at };
}
export async function consultarAprobacionCEO(ticket, options = {}) {
  if (!ticket?.requestId) throw Error("ticket_invalido");
  const result = await api("/requests/" + encodeURIComponent(ticket.requestId), "GET", undefined, options);
  if (result.request?.payload_sha256 !== ticket.payload_sha256)
    throw Error("hash_no_coincide");
  return result.request;
}
export async function consumirAprobacionCEO(ticket, operation, options = {}) {
  const expected = operationDigest(operation);
  if (typeof ticket?.payload_sha256 !== "string" ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(ticket.payload_sha256)))
    throw Error("operacion_modificada");
  if (Date.parse(ticket.expires_at) <= Date.now()) throw Error("aprobacion_caducada");
  // Único punto que concede permiso: compare-and-set aprobado -> consumido en Supabase.
  const data = await api("/requests/" + encodeURIComponent(ticket.requestId) + "/consume",
    "POST", { payload_sha256: expected }, options);
  if (data.authorized !== true || data.request?.status !== "consumed")
    throw Error("aprobacion_no_concedida");
  return true;
}
