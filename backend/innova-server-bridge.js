"use strict";
const crypto = require("node:crypto");

// Puente CEO -> Dell. Nunca recibe claves TOTP ni ejecuta comandos.
// Dell solicita con clave máquina; CEO autoriza con JWT Supabase AAL2;
// Dell consume autorización única y ejecuta SOLO según su política local.
const ACTIONS = new Set([
  "workspace.write", "workspace.delete", "sandbox.execute",
  "docker.restart", "systemd.restart", "compose.deploy",
  "backup.run", "database.migrate", "security.rotate",
  "project.deploy", "service.configure", "files.restore"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const NONCE = /^[A-Za-z0-9_-]{16,128}$/;
const NAME = /^[a-zA-Z0-9_.:/@-]{1,160}$/;

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !b) return false;
  const a1 = Buffer.from(a), b1 = Buffer.from(b);
  return a1.length === b1.length && crypto.timingSafeEqual(a1, b1);
}
function bearer(req) {
  const value = req.headers.authorization || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(String(value));
  return match ? match[1] : "";
}
function hasVerifiedAal2(token, userId) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const data = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    // JWT está ya verificado previamente en Supabase Auth /auth/v1/user.
    return data.aal === "aal2" && data.sub === userId &&
      Number.isFinite(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
function validateOperation(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!ACTIONS.has(body.action) || typeof body.target !== "string" ||
      !NAME.test(body.target) || typeof body.payload_sha256 !== "string" ||
      !SHA.test(body.payload_sha256) || typeof body.request_nonce !== "string" ||
      !NONCE.test(body.request_nonce) || typeof body.summary !== "string" ||
      body.summary.trim().length < 8 || body.summary.length > 500) return null;
  if (/[\x00-\x1f\x7f]/.test(body.summary)) return null;
  return { action: body.action, target: body.target, payload_sha256: body.payload_sha256,
    request_nonce: body.request_nonce, summary: body.summary.trim() };
}

function registerInnovaServerBridge(app, deps) {
  const { verifyCompanyUser, fetchFn, supabaseUrl, serviceRoleKey, bridgeKey } = deps;
  const base = String(supabaseUrl || "").replace(/\/$/, "");
  if (!base.startsWith("https://")) throw new Error("Supabase requiere HTTPS");
  const prefix = "/api/innova-server/v1";
  const configured = () => typeof bridgeKey === "string" && bridgeKey.length >= 32 &&
      typeof serviceRoleKey === "string" && serviceRoleKey.length > 20;

  app.use(prefix, (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  function error(res, code, message) { return res.status(code).json({ error: message }); }
  function ready(res) {
    if (!configured()) { error(res, 503, "Puente CEO-Dell sin configurar"); return false; }
    return true;
  }
  function machine(req, res) {
    if (!ready(res)) return false;
    if (!safeEqual(bearer(req), bridgeKey)) {
      error(res, 401, "Credencial del servidor no válida"); return false;
    }
    return true;
  }
  async function ceo(req, res) {
    if (!ready(res)) return null;
    const auth = await verifyCompanyUser(req, ["superadmin"]);
    if (!auth.ok) { error(res, auth.status || 403, auth.error || "No autorizado"); return null; }
    if (!hasVerifiedAal2(auth.token, auth.user.id)) {
      error(res, 403, "Se requiere verificación MFA AAL2 en Innova CEO"); return null;
    }
    return auth;
  }
  async function db(method, params, body) {
    const url = new URL(base + "/rest/v1/innova_server_approvals");
    for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
    const response = await fetchFn(url.toString(), {
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: "Bearer " + serviceRoleKey,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        Prefer: "return=representation"
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error("db_status_" + response.status);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("db_unexpected_response");
    return rows;
  }
  async function handle(res, fn) {
    try { return await fn(); }
    catch (e) {
      // No imprimir claves, JWT, cuerpos completos o datos de solicitudes.
      console.error("Innova Server Bridge:", String(e?.message || "database_error").slice(0, 80));
      return error(res, 502, "No se pudo procesar la autorización");
    }
  }

  // Dell crea la solicitud. El payload real nunca sale del Dell; únicamente su hash.
  app.post(prefix + "/requests", (req, res) => handle(res, async () => {
    if (!machine(req, res)) return;
    const entry = validateOperation(req.body);
    if (!entry) return error(res, 400, "Operación inválida o no permitida");
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const rows = await db("POST", { select: "id,status,expires_at,payload_sha256" },
      { ...entry, status: "pending", expires_at });
    if (!rows[0]) return error(res, 502, "No se pudo registrar la solicitud");
    res.status(201).json({ request: rows[0] });
  }));
  app.get(prefix + "/requests", (req, res) => handle(res, async () => {
    if (!await ceo(req, res)) return;
    const rows = await db("GET", {
      select: "id,action,target,summary,payload_sha256,status,requested_at,expires_at,approved_at,approved_by,consumed_at",
      order: "requested_at.desc", limit: "50"
    });
    res.json({ requests: rows });
  }));
  app.get(prefix + "/requests/:id", (req, res) => handle(res, async () => {
    if (!machine(req, res)) return;
    if (!UUID.test(req.params.id)) return error(res, 400, "ID inválido");
    const rows = await db("GET", {
      id: "eq." + req.params.id,
      select: "id,status,expires_at,payload_sha256",
      limit: "1"
    });
    if (!rows[0]) return error(res, 404, "Solicitud no encontrada");
    res.json({ request: rows[0] });
  }));
  app.post(prefix + "/requests/:id/decision", (req, res) => handle(res, async () => {
    const auth = await ceo(req, res);
    if (!auth) return;
    if (!UUID.test(req.params.id) || !["approve", "reject"].includes(req.body?.decision) ||
        !SHA.test(req.body?.payload_sha256 || ""))
      return error(res, 400, "Decisión inválida");
    const status = req.body.decision === "approve" ? "approved" : "rejected";
    const now = new Date().toISOString();
    const rows = await db("PATCH", {
      id: "eq." + req.params.id, status: "eq.pending",
      expires_at: "gt." + now,
      payload_sha256: "eq." + req.body.payload_sha256,
      select: "id,status,approved_at,approved_by"
    }, { status, approved_by: auth.user.id, approved_at: now });
    if (!rows[0]) return error(res, 409, "Solicitud vencida, modificada o ya resuelta");
    res.json({ request: rows[0] });
  }));
  app.post(prefix + "/requests/:id/consume", (req, res) => handle(res, async () => {
    if (!machine(req, res)) return;
    if (!UUID.test(req.params.id) || !SHA.test(req.body?.payload_sha256 || ""))
      return error(res, 400, "Solicitud inválida");
    const rows = await db("PATCH", {
      id: "eq." + req.params.id, status: "eq.approved",
      expires_at: "gt." + new Date().toISOString(),
      payload_sha256: "eq." + req.body.payload_sha256,
      select: "id,status,approved_at,consumed_at"
    }, { status: "consumed", consumed_at: new Date().toISOString() });
    if (!rows[0]) return error(res, 409, "Autorización no disponible, consumida o vencida");
    res.json({ authorized: true, request: rows[0] });
  }));
}
module.exports = { registerInnovaServerBridge, safeEqual, hasVerifiedAal2, validateOperation };
