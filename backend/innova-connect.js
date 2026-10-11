"use strict";

// Innova Connect V1: API de lectura para la intranet, sin service_role.
// Todos los accesos se ejecutan con el JWT Supabase del usuario y sus políticas RLS.
const ROLES = ["superadmin", "admin", "finance", "project_manager", "viewer"];
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIMIT_MAX = 100;

function page(query = {}) {
  const limit = String(query.limit ?? "25");
  const offset = String(query.offset ?? "0");
  if (!/^\d{1,3}$/.test(limit) || !/^\d{1,5}$/.test(offset)) return null;
  const l = Number(limit), o = Number(offset);
  if (l < 1 || l > LIMIT_MAX || o > 10000) return null;
  return { limit: l, offset: o };
}

function projectFilter(query = {}) {
  if (query.project_id === undefined) return { ok: true, id: null };
  if (typeof query.project_id !== "string" || !ID.test(query.project_id)) return { ok: false };
  return { ok: true, id: query.project_id };
}

function apiError(res, status, error) {
  res.status(status).json({ error });
}

function registerInnovaConnect(app, {
  verifyCompanyUser,
  fetchFn,
  supabaseUrl,
  publishableKey,
  storageBucket = "company-files"
}) {
  const base = String(supabaseUrl || "").replace(/\/$/, "");
  if (!base.startsWith("https://")) throw new Error("Innova Connect requiere Supabase HTTPS");
  if (!publishableKey) throw new Error("Innova Connect requiere publishable key");
  if (!/^[a-zA-Z0-9_-]+$/.test(storageBucket)) throw new Error("Bucket inválido");

  app.use("/api/innova-connect/v1", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Authorization");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  async function authorized(req, res, fn) {
    const auth = await verifyCompanyUser(req, ROLES);
    if (!auth.ok) return apiError(res, auth.status || 403, auth.error || "No autorizado");
    try {
      await fn(auth.token);
    } catch (error) {
      // No registrar cuerpo de respuestas ni JWT ni rutas privadas.
      console.error("Innova Connect: fallo de API", error?.status || error?.code || "upstream");
      apiError(res, 502, "No fue posible consultar Innova CEO");
    }
  }

  async function supabaseRequest(resource, params, token, options = {}) {
    const url = new URL(base + resource);
    for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
    const response = await fetchFn(url.toString(), {
      ...options,
      headers: {
        apikey: publishableKey,
        Authorization: "Bearer " + token,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {})
      }
    });
    if (!response.ok) {
      const err = new Error("API Supabase no disponible");
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  const listTypes = {
    projects: {
      table: "company_projects",
      select: "id,title,code,status,created_at,updated_at",
      order: "updated_at.desc"
    },
    documents: {
      table: "company_documents",
      select: "id,project_id,title,document_type,status,version,created_at,updated_at",
      order: "updated_at.desc"
    },
    files: {
      table: "company_files",
      select: "id,project_id,title,category,original_name,mime_type,file_size,created_at",
      order: "created_at.desc"
    }
  };

  for (const [route, spec] of Object.entries(listTypes)) {
    app.get("/api/innova-connect/v1/" + route, (req, res) => authorized(req, res, async token => {
      const p = page(req.query);
      const project = projectFilter(req.query);
      if (!p || !project.ok) return apiError(res, 400, "Parámetros de paginación o proyecto inválidos");
      if (route === "projects" && project.id) return apiError(res, 400, "Filtro no admitido");
      const params = {
        select: spec.select,
        order: spec.order,
        limit: String(p.limit),
        offset: String(p.offset)
      };
      if (project.id) params.project_id = "eq." + project.id;
      const items = await supabaseRequest("/rest/v1/" + spec.table, params, token);
      res.json({ items, limit: p.limit, offset: p.offset, has_more: items.length === p.limit });
    }));
  }

  app.get("/api/innova-connect/v1/documents/:id", (req, res) =>
    authorized(req, res, async token => {
      if (!ID.test(req.params.id || "")) return apiError(res, 400, "ID inválido");
      const data = await supabaseRequest("/rest/v1/company_documents", {
        id: "eq." + req.params.id,
        select: "id,project_id,title,document_type,status,version,content_html,created_at,updated_at",
        limit: "1"
      }, token);
      if (!data.length) return apiError(res, 404, "Documento no encontrado");
      // content_html es dato NO confiable: cualquier cliente debe sanearlo antes de renderizar.
      res.json({ document: data[0] });
    }));

  app.get("/api/innova-connect/v1/files/:id/link", (req, res) =>
    authorized(req, res, async token => {
      if (!ID.test(req.params.id || "")) return apiError(res, 400, "ID inválido");
      const files = await supabaseRequest("/rest/v1/company_files", {
        id: "eq." + req.params.id,
        select: "id,storage_path",
        limit: "1"
      }, token);
      if (!files.length) return apiError(res, 404, "Archivo no encontrado");
      const path = files[0].storage_path;
      if (typeof path !== "string" || !path || path.split("/").some(p => !p || p === "." || p === "..")) {
        return apiError(res, 409, "Ruta de archivo inválida");
      }
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const signed = await supabaseRequest(
        "/storage/v1/object/sign/" + encodeURIComponent(storageBucket) + "/" + encodedPath,
        {}, token, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) }
      );
      const raw = signed?.signedURL || signed?.signedUrl || signed?.signed_url;
      if (typeof raw !== "string") throw new Error("storage_sign_missing");
      const relative = raw.startsWith("/storage/v1/object/sign/")
        ? raw
        : raw.startsWith("/object/sign/") ? "/storage/v1" + raw : null;
      if (!relative) throw new Error("storage_sign_unexpected");
      const link = new URL(relative, base);
      if (link.origin !== new URL(base).origin) throw new Error("storage_sign_origin");
      res.json({ url: link.toString(), expires_in: 60 });
    }));
}

module.exports = { registerInnovaConnect, page, projectFilter };
