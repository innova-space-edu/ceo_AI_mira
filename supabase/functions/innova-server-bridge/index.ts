// Innova Secure Bridge V1 - NOT usable until SQL and Dell worker are approved.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WORKER_KEY = Deno.env.get("INNOVA_BRIDGE_WORKER_TOKEN") || "";
const ALLOWED_ORIGINS = new Set(["https://www.innova-space-edu.cl", "https://innova-space-edu.cl"]);
const db = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } });

function response(data: unknown, status = 200, origin = "") {
  const headers: Record<string, string> = {
    "content-type": "application/json", "cache-control": "no-store", "vary": "Origin",
    "x-content-type-options": "nosniff",
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "POST,OPTIONS";
    headers["access-control-allow-headers"] = "authorization,apikey,content-type,x-innova-worker-token";
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let mismatch = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) mismatch |= (x[i] || 0) ^ (y[i] || 0);
  return mismatch === 0;
}
function normalizeOperation(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const keys = Object.keys(o).sort().join(",");
  const n = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_.-]{1,90}$/.test(v);
  if (o.op === "docker_operacion" && keys === "accion,nombre,op" &&
      n(o.nombre) && ["restart", "start", "stop"].includes(String(o.accion)))
    return { op: "docker_operacion", nombre: String(o.nombre), accion: String(o.accion) };
  if (o.op === "systemd_operacion" && keys === "accion,nombre,op" &&
      n(o.nombre) && String(o.nombre).endsWith(".service") &&
      ["restart", "start", "stop"].includes(String(o.accion)))
    return { op: "systemd_operacion", nombre: String(o.nombre), accion: String(o.accion) };
  if (o.op === "desplegar_servicio" && keys === "op,proyecto,servicio" &&
      n(o.proyecto) && n(o.servicio))
    return { op: "desplegar_servicio", proyecto: String(o.proyecto), servicio: String(o.servicio) };
  return null;
}
function jwtClaims(jwt: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return {}; }
}
async function currentAdmin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) return null;
  const { data: userData, error: userError } = await db.auth.getUser(jwt);
  if (userError || !userData.user) return null;
  const { data: profile, error: profileError } = await db.from("company_users")
    .select("role,status").eq("user_id", userData.user.id).maybeSingle();
  if (profileError || profile?.role !== "superadmin" || profile?.status !== "active") return null;
  const claims = jwtClaims(jwt);
  if (claims.sub !== userData.user.id || claims.role !== "authenticated") return null;
  return { id: userData.user.id, claims };
}
function freshTotp(claims: Record<string, unknown>) {
  if (claims.aal !== "aal2" || !Array.isArray(claims.amr)) return false;
  const now = Math.floor(Date.now() / 1000);
  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as { method?: unknown; timestamp?: unknown };
    const age = now - Number(e.timestamp);
    return e.method === "totp" && Number.isFinite(age) && age >= -30 && age <= 120;
  });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response({ error: "origin_denied" }, 403);
  if (req.method === "OPTIONS") return response({}, 204, origin);
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405, origin);
  if (!URL || !SRK || WORKER_KEY.length < 40) return response({ error: "bridge_not_configured" }, 503, origin);
  const raw = await req.text();
  if (raw.length > 4096) return response({ error: "oversized" }, 413, origin);
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw); } catch { return response({ error: "invalid_json" }, 400, origin); }
  const kind = String(data.kind || "");
  const isWorker = ["poll", "complete", "worker_request"].includes(kind);
  if (isWorker) {
    if (origin) return response({ error: "worker_origin_denied" }, 403, origin);
    if (!safeEqual(req.headers.get("x-innova-worker-token") || "", WORKER_KEY))
      return response({ error: "worker_unauthorized" }, 401, origin);
  }
  const admin = isWorker ? null : await currentAdmin(req);
  if (!isWorker && !admin) return response({ error: "superadmin_required" }, 403, origin);
  try {
    if (kind === "list" && admin) {
      const { data: items, error } = await db.from("innova_server_requests")
        .select("id,source,operation,status,created_at,expires_at,approved_at,completed_at,result_summary")
        .order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      return response({ requests: items }, 200, origin);
    }
    if ((kind === "request" && admin) || (kind === "worker_request" && isWorker)) {
      const op = normalizeOperation(data.operation);
      if (!op) return response({ error: "operation_rejected" }, 400, origin);
      const { data: created, error } = await db.from("innova_server_requests")
        .insert({ source: isWorker ? "mcp" : "ceo", operation: op, requester_id: admin?.id || null })
        .select("id,status,expires_at").single();
      if (error) throw error;
      return response({ request: created }, 201, origin);
    }
    if ((kind === "approve" || kind === "reject") && admin) {
      const id = String(data.id || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        return response({ error: "invalid_id" }, 400, origin);
      if (kind === "approve" && !freshTotp(admin.claims))
        return response({ error: "fresh_totp_required" }, 403, origin);
      const now = new Date();
      const update = kind === "approve"
        ? { status: "approved", approved_by: admin.id, approved_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 120000).toISOString() }
        : { status: "rejected", approved_by: admin.id, approved_at: now.toISOString() };
      const { data: changed, error } = await db.from("innova_server_requests").update(update)
        .eq("id", id).eq("status", "pending").gt("expires_at", now.toISOString())
        .select("id,status").maybeSingle();
      if (error) throw error;
      if (!changed) return response({ error: "request_expired_or_changed" }, 409, origin);
      return response({ request: changed }, 200, origin);
    }
    if (kind === "poll" && isWorker) {
      const { data: rows, error } = await db.rpc("innova_server_claim_next");
      if (error) throw error;
      const item = rows?.[0] || null;
      return response({ request: item ? { id: item.id, operation: item.operation,
        approved_by: item.approved_by, approved_at: item.approved_at, expires_at: item.expires_at } : null }, 200, origin);
    }
    if (kind === "complete" && isWorker) {
      const id = String(data.id || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
         || typeof data.ok !== "boolean") return response({ error: "invalid_result" }, 400, origin);
      const summary = typeof data.summary === "string" ? data.summary.slice(0, 1000) : "";
      const { data: changed, error } = await db.from("innova_server_requests")
        .update({ status: data.ok ? "completed" : "failed", result_summary: summary, completed_at: new Date().toISOString() })
        .eq("id", id).eq("status", "claimed").select("id,status").maybeSingle();
      if (error) throw error;
      if (!changed) return response({ error: "already_processed" }, 409, origin);
      return response({ request: changed }, 200, origin);
    }
    return response({ error: "invalid_kind" }, 400, origin);
  } catch (_) { return response({ error: "bridge_operation_failed" }, 500, origin); }
});
