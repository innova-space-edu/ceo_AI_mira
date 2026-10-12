// Cliente de SOLO SERVIDOR para Next.js (Dell) -> Innova CEO.
// No importar desde Client Components ni poner JWT en NEXT_PUBLIC_*.
const BASE = process.env.INNOVA_CEO_API_URL || "https://ceo-ai-mira.onrender.com";

export async function ceoRead(path, ceoJwt) {
  if (typeof ceoJwt !== "string" || ceoJwt.length < 20) {
    throw new Error("Se requiere una sesión enlazada de Innova CEO");
  }
  const url = new URL(path, BASE);
  if (url.protocol !== "https:" || url.origin !== new URL(BASE).origin
    || !url.pathname.startsWith("/api/innova-connect/v1/")) {
    throw new Error("Destino Innova CEO no permitido");
  }
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: "Bearer " + ceoJwt, Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    const error = new Error("Innova CEO no pudo completar la consulta");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function listing(route, jwt, { limit = 25, offset = 0, projectId = null } = {}) {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (projectId) qs.set("project_id", projectId);
  return ceoRead("/api/innova-connect/v1/" + route + "?" + qs, jwt);
}

export const listCeoProjects = (jwt, options) => listing("projects", jwt, options);
export const listCeoDocuments = (jwt, options) => listing("documents", jwt, options);
export const listCeoFiles = (jwt, options) => listing("files", jwt, options);
export const getCeoDocument = (jwt, id) =>
  ceoRead("/api/innova-connect/v1/documents/" + encodeURIComponent(id), jwt);
export const getCeoFileLink = (jwt, id) =>
  ceoRead("/api/innova-connect/v1/files/" + encodeURIComponent(id) + "/link", jwt);
