"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { registerInnovaServerBridge, safeEqual, validateOperation } = require("../innova-server-bridge");

const ID = "ae1cb3d0-f361-4d45-a3db-19fc02b672ad";
const digest = "a".repeat(64);
const secret = "test-unique-bridge-secret-which-is-long-enough";
const svc = "test-service-role-key-which-is-long-enough";
const origin = "https://acceso.innova-space-edu.cl";
const request = { action: "docker.restart", target: "intranet-portal",
  payload_sha256: digest, request_nonce: "abcdefghijklmnop12345678",
  summary: "Reiniciar el portal autorizado" };

function harness({ authorized = true, respond, ready = true } = {}) {
  const routes = new Map(), calls = [];
  const app = {
    use() {},
    get(p, f) { routes.set("GET " + p, f); },
    post(p, f) { routes.set("POST " + p, f); }
  };
  const fetchFn = async (url, opts) => {
    calls.push({ url, options: opts });
    return (respond || (() => ({ ok: true, json: async () => [] })))(url, opts);
  };
  registerInnovaServerBridge(app, {
    verifyCloudflareAccess: async token => {
      if (!authorized || token !== "signed-token") throw Error("unauthorized");
      return { email: "admin@example.com", subject: "human-test-id" };
    },
    fetchFn, supabaseUrl: "https://test.supabase.co",
    bridgeKey: secret, serviceRoleKey: svc,
    portalOrigin: ready ? origin : ""
  });
  async function send(method, path, {
    body = {}, auth = "Bearer " + secret, params = {},
    accessToken = "signed-token", requestOrigin = origin
  } = {}) {
    const req = { headers: { authorization: auth, origin: requestOrigin,
      "cf-access-jwt-assertion": accessToken }, body, params };
    const res = {
      statusCode: 200, body: null, headers: {},
      status(n) { this.statusCode = n; return this; },
      json(data) { this.body = data; return this; },
      setHeader(k, v) { this.headers[k] = v; }
    };
    const fn = routes.get(method + " /api/innova-server/v1/" + path);
    assert.ok(fn);
    await fn(req, res);
    return res;
  }
  return { send, calls };
}
const rows = records => ({ ok: true, json: async () => records });

test("operaciones y destinos protegidos contra root y traversal", () => {
  assert.deepEqual(validateOperation(request), request);
  assert.equal(validateOperation({ ...request, action: "exec.root" }), null);
  assert.equal(validateOperation({ ...request, target: "../etc/shadow" }), null);
  assert.equal(validateOperation({ ...request, target: "/etc/passwd" }), null);
  assert.equal(validateOperation({ ...request, summary: "uno\ndos" }), null);
});
test("clave máquina nunca valida por coincidencia parcial", () => {
  assert.ok(safeEqual(secret, secret));
  assert.ok(!safeEqual(secret, secret + "x"));
});
test("fail closed si falta configuración de Cloudflare", async () => {
  const h = harness({ ready: false });
  const r = await h.send("GET", "requests");
  assert.equal(r.statusCode, 503);
  assert.equal(h.calls.length, 0);
});
test("sin clave Dell ninguna solicitud puede crearse", async () => {
  const h = harness();
  const r = await h.send("POST", "requests", { auth: "Bearer incorrecta", body: request });
  assert.equal(r.statusCode, 401);
  assert.equal(h.calls.length, 0);
});
test("la solicitud Dell queda pendiente y vence en diez minutos", async () => {
  const h = harness({ respond: () => rows([{
    id: ID, status: "pending", payload_sha256: digest
  }]) });
  const r = await h.send("POST", "requests", { body: request });
  assert.equal(r.statusCode, 201);
  const data = JSON.parse(h.calls[0].options.body);
  assert.equal(data.status, "pending");
  assert.equal(data.action, "docker.restart");
  assert.equal(h.calls[0].options.headers.Authorization, "Bearer " + svc);
  assert.ok(Date.parse(data.expires_at) > Date.now() + 9*60*1000);
});
test("Cloudflare no autorizado impide ver o aprobar solicitudes", async () => {
  const h = harness({ authorized: false });
  const list = await h.send("GET", "requests");
  const decision = await h.send("POST", "requests/:id/decision",
    { params: { id: ID }, body: { decision: "approve", payload_sha256: digest } });
  assert.equal(list.statusCode, 403);
  assert.equal(decision.statusCode, 403);
  assert.equal(h.calls.length, 0);
});
test("un origen externo no puede aprobar aunque presente un encabezado", async () => {
  const h = harness();
  const r = await h.send("POST", "requests/:id/decision", {
    params: { id: ID }, body: { decision: "approve", payload_sha256: digest },
    requestOrigin: "https://evil.example"
  });
  assert.equal(r.statusCode, 403);
  assert.equal(h.calls.length, 0);
});
test("aprobación exacta guarda correo verificado y exige estado pending", async () => {
  const h = harness({ respond: () => rows([{ id: ID, status: "approved" }]) });
  const r = await h.send("POST", "requests/:id/decision", {
    params: { id: ID }, body: { decision: "approve", payload_sha256: digest }
  });
  assert.equal(r.statusCode, 200);
  const query = new URL(h.calls[0].url).searchParams;
  assert.equal(query.get("status"), "eq.pending");
  assert.equal(query.get("payload_sha256"), "eq." + digest);
  assert.equal(JSON.parse(h.calls[0].options.body).approved_email, "admin@example.com");
});
test("aprobación consumida no puede repetirse", async () => {
  const h = harness({ respond: () => rows([]) });
  const r = await h.send("POST", "requests/:id/consume",
    { params: { id: ID }, body: { payload_sha256: digest } });
  assert.equal(r.statusCode, 409);
  const query = new URL(h.calls[0].url).searchParams;
  assert.equal(query.get("status"), "eq.approved");
});
test("consumo correcto entrega autorización de un uso", async () => {
  const h = harness({ respond: () => rows([{ id: ID, status: "consumed" }]) });
  const r = await h.send("POST", "requests/:id/consume",
    { params: { id: ID }, body: { payload_sha256: digest } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.authorized, true);
});
