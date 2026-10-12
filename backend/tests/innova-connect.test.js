"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { registerInnovaConnect, page, projectFilter } = require("../innova-connect");

const FILE_ID = "ae1cb3d0-f361-4d45-a3db-19fc02b672ad";
function harness({ valid = true, respond } = {}) {
  const routes = new Map();
  const app = {
    use() {},
    get(path, fn) { routes.set(path, fn); }
  };
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return (respond || (() => ({ ok: true, json: async () => [] })))(url, options);
  };
  registerInnovaConnect(app, {
    verifyCompanyUser: async () => valid
      ? { ok: true, token: "user-session-jwt" }
      : { ok: false, status: 403, error: "Cuenta administrativa inactiva" },
    fetchFn,
    supabaseUrl: "https://test.supabase.co",
    publishableKey: "test-public-key"
  });
  async function send(path, { query = {}, params = {}, authorization = "Bearer user-session-jwt" } = {}) {
    const req = { query, params, headers: { authorization } };
    const res = {
      statusCode: 200, headers: {}, body: null,
      setHeader(k, v) { this.headers[k] = v; },
      status(s) { this.statusCode = s; return this; },
      json(data) { this.body = data; return this; }
    };
    const fn = routes.get("/api/innova-connect/v1/" + path);
    assert.ok(fn, "ruta registrada: " + path);
    await fn(req, res);
    return res;
  }
  return { send, calls };
}
function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("paginación rechaza excesos e inyección", () => {
  assert.deepEqual(page({ limit: "100", offset: "10000" }), { limit: 100, offset: 10000 });
  assert.equal(page({ limit: "101" }), null);
  assert.equal(page({ offset: "1;delete" }), null);
  assert.equal(page({ limit: "-1" }), null);
  assert.equal(projectFilter({ project_id: "all" }).ok, false);
});

test("sin usuario activo devuelve 403, sin consultar datos", async () => {
  const h = harness({ valid: false });
  const res = await h.send("files");
  assert.equal(res.statusCode, 403);
  assert.equal(h.calls.length, 0);
});

test("lista solo columnas permitidas con JWT de usuario, nunca service_role", async () => {
  const h = harness({ respond: () => jsonResponse([{ id: FILE_ID, title: "Ejemplo" }]) });
  const res = await h.send("files", { query: { limit: "5", offset: "0", project_id: FILE_ID } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.has_more, false);
  assert.equal(h.calls.length, 1);
  const requested = new URL(h.calls[0].url);
  assert.equal(requested.searchParams.get("project_id"), "eq." + FILE_ID);
  assert.match(requested.searchParams.get("select"), /^id,project_id,title/);
  assert.equal(h.calls[0].options.headers.Authorization, "Bearer user-session-jwt");
  assert.equal(h.calls[0].options.headers.apikey, "test-public-key");
});

test("rechaza filtros inválidos antes de consultar", async () => {
  const h = harness();
  const res = await h.send("documents", { query: { project_id: "eq.secret" } });
  assert.equal(res.statusCode, 400);
  assert.equal(h.calls.length, 0);
});

test("documentos no encontrados devuelven 404 sin detalles internos", async () => {
  const h = harness();
  const res = await h.send("documents/:id", { params: { id: FILE_ID } });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "Documento no encontrado" });
});

test("lectura de documentos utiliza content real y entrega texto para V8", async () => {
  const h = harness({ respond: () => jsonResponse([{
    id: FILE_ID, title: "Acta", content: "<script>alert(1)</script>"
  }]) });
  const res = await h.send("documents/:id", { params: { id: FILE_ID } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.document.content_html, "<script>alert(1)</script>");
  assert.equal(Object.hasOwn(res.body.document, "content"), false);
  const select = new URL(h.calls[0].url).searchParams.get("select");
  assert.match(select, /(?:^|,)content(?:,|$)/);
  assert.equal(select.includes("content_html"), false);
});

test("documentos JSON se representan como texto y no objetos React", async () => {
  const h = harness({ respond: () => jsonResponse([{
    id: FILE_ID, title: "Acta JSON", content: { sections: ["Resumen"] }
  }]) });
  const res = await h.send("documents/:id", { params: { id: FILE_ID } });
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.document.content_html, "string");
  assert.match(res.body.document.content_html, /Resumen/);
});

test("enlace temporal de Storage requiere permiso de lectura y vence a los 60 s", async () => {
  const h = harness({ respond: (url) => {
    if (url.includes("/rest/v1/company_files")) return jsonResponse([{ id: FILE_ID, storage_path: "user/proyecto/foto.jpg" }]);
    return jsonResponse({ signedURL: "/object/sign/company-files/user/proyecto/foto.jpg?token=mock-token" });
  }});
  const res = await h.send("files/:id/link", { params: { id: FILE_ID } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.expires_in, 60);
  assert.equal(res.body.url, "https://test.supabase.co/storage/v1/object/sign/company-files/user/proyecto/foto.jpg?token=mock-token");
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(h.calls[1].options.body), { expiresIn: 60 });
  assert.equal(h.calls[1].options.headers.Authorization, "Bearer user-session-jwt");
});

test("archivo sin permiso no genera enlace", async () => {
  const h = harness();
  const res = await h.send("files/:id/link", { params: { id: FILE_ID } });
  assert.equal(res.statusCode, 404);
  assert.equal(h.calls.length, 1);
});

test("respuesta de Storage no puede redirigir a otro dominio", async () => {
  const h = harness({ respond: url => url.includes("/rest/v1/")
    ? jsonResponse([{ id: FILE_ID, storage_path: "safe/file.pdf" }])
    : jsonResponse({ signedURL: "https://malicioso.example/exfil" })
  });
  const res = await h.send("files/:id/link", { params: { id: FILE_ID } });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: "No fue posible consultar Innova CEO" });
});

test("errores Supabase no se filtran al cliente", async () => {
  const h = harness({ respond: () => jsonResponse({ hint: "secret" }, 500) });
  const res = await h.send("projects");
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.stringify(res.body).includes("secret"), false);
});
