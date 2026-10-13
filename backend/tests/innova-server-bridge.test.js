"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { registerInnovaServerBridge, safeEqual, hasVerifiedAal2, validateOperation } =
  require("../innova-server-bridge");
const ID = "ae1cb3d0-f361-4d45-a3db-19fc02b672ad";
const digest = "a".repeat(64);
const secret = "test-unique-bridge-secret-which-is-long-enough";
const svc = "test-service-role-key-which-is-long-enough";
function jwt(aal, sub = ID, exp = Math.floor(Date.now() / 1000) + 3600) {
  return "a." + Buffer.from(JSON.stringify({ sub, aal, exp })).toString("base64url") + ".signature";
}
const reqBody = {
  action: "docker.restart", target: "intranet-portal", payload_sha256: digest,
  request_nonce: "abcdefghijklmnop12345678", summary: "Reiniciar el portal autorizado"
};
function harness({ authorized = true, aal = "aal2", respond } = {}) {
  const routes = new Map(), calls = [];
  const app = {
    use() {},
    get(p, f) { routes.set("GET " + p, f); },
    post(p, f) { routes.set("POST " + p, f); }
  };
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return (respond || (() => ({ ok: true, json: async () => [] })))(url, options);
  };
  registerInnovaServerBridge(app, {
    verifyCompanyUser: async () => authorized
      ? { ok: true, user: { id: ID }, token: jwt(aal), profile: { role: "superadmin" } }
      : { ok: false, status: 403, error: "No autorizado" },
    fetchFn, supabaseUrl: "https://test.supabase.co",
    bridgeKey: secret, serviceRoleKey: svc
  });
  async function send(method, path, {
    body = {}, auth = "Bearer " + secret, params = {}
  } = {}) {
    const req = { headers: { authorization: auth }, body, params };
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
function okRows(rows) { return { ok: true, json: async () => rows }; }

test("valida acciones predefinidas y rechaza órdenes arbitrarias", () => {
  assert.deepEqual(validateOperation(reqBody), reqBody);
  assert.equal(validateOperation({ ...reqBody, action: "shell.root" }), null);
  assert.equal(validateOperation({ ...reqBody, target: "../etc/shadow" }), null);
  assert.equal(validateOperation({ ...reqBody, summary: "a\nb" }), null);
});
test("clave de máquina se compara sin coincidencia parcial", () => {
  assert.equal(safeEqual(secret, secret), true);
  assert.equal(safeEqual(secret + "x", secret), false);
});
test("CEO requiere JWT ya verificado con AAL2", () => {
  assert.equal(hasVerifiedAal2(jwt("aal2"), ID), true);
  assert.equal(hasVerifiedAal2(jwt("aal1"), ID), false);
  assert.equal(hasVerifiedAal2(jwt("aal2", ID, 1), ID), false);
  assert.equal(hasVerifiedAal2(jwt("aal2", crypto.randomUUID()), ID), false);
});
test("no puede registrar operación sin clave de máquina", async () => {
  const h = harness();
  const res = await h.send("POST", "requests", { auth: "Bearer no", body: reqBody });
  assert.equal(res.statusCode, 401);
  assert.equal(h.calls.length, 0);
});
test("registro no admite comandos arbitrarios y caduca", async () => {
  const h = harness({ respond: () => okRows([{ id: ID, status: "pending", expires_at: new Date(Date.now() + 5e5).toISOString(), payload_sha256: digest }]) });
  let res = await h.send("POST", "requests", { body: reqBody });
  assert.equal(res.statusCode, 201);
  assert.equal(JSON.parse(h.calls[0].options.body).status, "pending");
  assert.equal(h.calls[0].options.headers.Authorization, "Bearer " + svc);
  const expiry = Date.parse(JSON.parse(h.calls[0].options.body).expires_at);
  assert.ok(expiry > Date.now() + 9 * 60 * 1000 && expiry <= Date.now() + 10 * 60 * 1000);
  res = await h.send("POST", "requests", { body: { ...reqBody, action: "exec.root" } });
  assert.equal(res.statusCode, 400);
  assert.equal(h.calls.length, 1);
});
test("CEO deniega listado sin identidad o sin MFA AAL2", async () => {
  for (const opt of [{ authorized: false }, { aal: "aal1" }]) {
    const h = harness(opt);
    const res = await h.send("GET", "requests");
    assert.equal(res.statusCode, 403); assert.equal(h.calls.length, 0);
  }
});
test("solo CEO AAL2 puede aprobar una petición exacta y pendiente", async () => {
  const h = harness({ respond: () => okRows([{ id: ID, status: "approved" }]) });
  const res = await h.send("POST", "requests/:id/decision", {
    auth: "Bearer " + jwt("aal2"), params: { id: ID },
    body: { decision: "approve", payload_sha256: digest }
  });
  assert.equal(res.statusCode, 200);
  const query = new URL(h.calls[0].url).searchParams;
  assert.equal(query.get("status"), "eq.pending");
  assert.equal(query.get("payload_sha256"), "eq." + digest);
  assert.equal(JSON.parse(h.calls[0].options.body).approved_by, ID);
});
test("sin transición CAS de approved a consumed se deniega reutilización", async () => {
  const h = harness({ respond: () => okRows([]) });
  const res = await h.send("POST", "requests/:id/consume", {
    params: { id: ID }, body: { payload_sha256: digest }
  });
  assert.equal(res.statusCode, 409);
  const query = new URL(h.calls[0].url).searchParams;
  assert.equal(query.get("status"), "eq.approved");
  assert.equal(query.get("payload_sha256"), "eq." + digest);
});
test("una aprobación consumida solo otorga el booleano autorizado", async () => {
  const h = harness({ respond: () => okRows([{ id: ID, status: "consumed" }]) });
  const res = await h.send("POST", "requests/:id/consume", {
    params: { id: ID }, body: { payload_sha256: digest }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.authorized, true);
  assert.equal(h.calls.length, 1);
});
