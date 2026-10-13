"use strict";
const crypto = require("node:crypto");

// Cloudflare Access JWT verifier. No confía en el encabezado sin verificar
// firma RS256, issuer, audience, vencimiento y dirección autorizada.
const DOMAIN = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/;
const AUD = /^[a-zA-Z0-9_-]{32,128}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const skew = 60;
function decode(b64) {
  if (!/^[A-Za-z0-9_-]+$/.test(b64) || b64.length > 14000) throw Error("jwt_encoding");
  return Buffer.from(b64, "base64url");
}
function validConfig({ teamDomain, audience, emails }) {
  const domain = String(teamDomain || "").replace(/\/$/, "").toLowerCase();
  const allowed = String(emails || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!DOMAIN.test(domain) || !AUD.test(String(audience || "")) ||
      !allowed.length || !allowed.every(e => EMAIL.test(e))) return null;
  return { domain, audience, allowed: new Set(allowed) };
}
function createCloudflareVerifier({ teamDomain, audience, emails, fetchFn, clock = () => Date.now() }) {
  const config = validConfig({ teamDomain, audience, emails });
  let cache = null, refreshAt = 0;
  async function jwks(force = false) {
    if (!config) throw Error("cloudflare_sin_configuracion");
    const now = clock();
    if (!force && cache && now < refreshAt) return cache;
    const endpoint = config.domain + "/cdn-cgi/access/certs";
    const response = await fetchFn(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error("cloudflare_jwks_inaccesible");
    const body = await response.json();
    if (!Array.isArray(body.keys) || body.keys.length > 12) throw Error("cloudflare_jwks_invalido");
    const keys = new Map();
    for (const key of body.keys) {
      if (!key || typeof key.kid !== "string" || !/^[A-Za-z0-9_.:-]{1,180}$/.test(key.kid) ||
          key.kty !== "RSA" || !key.n || !key.e || key.alg && key.alg !== "RS256") continue;
      keys.set(key.kid, crypto.createPublicKey({ key, format: "jwk" }));
    }
    if (!keys.size) throw Error("cloudflare_jwks_sin_claves");
    cache = keys;
    refreshAt = now + 10 * 60_000;
    return keys;
  }
  async function verify(header) {
    if (!config) throw Error("cloudflare_sin_configuracion");
    if (typeof header !== "string" || header.length > 16384 || !header) throw Error("jwt_no_presente");
    const parts = header.split(".");
    if (parts.length !== 3) throw Error("jwt_malformado");
    const h = JSON.parse(decode(parts[0]).toString("utf8"));
    const p = JSON.parse(decode(parts[1]).toString("utf8"));
    if (h.alg !== "RS256" || typeof h.kid !== "string" || typeof p !== "object" || !p)
      throw Error("jwt_algoritmo_invalido");
    let keys = await jwks();
    let key = keys.get(h.kid);
    if (!key) { keys = await jwks(true); key = keys.get(h.kid); }
    if (!key || !crypto.verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]),
                             key, decode(parts[2]))) throw Error("jwt_firma_invalida");
    const now = Math.floor(clock() / 1000);
    if (p.iss !== config.domain ||
        !(Array.isArray(p.aud) ? p.aud.includes(config.audience) : p.aud === config.audience) ||
        p.type !== "app" ||
        !Number.isFinite(p.iat) || p.iat > now + skew ||
        !Number.isFinite(p.exp) || p.exp <= now ||
        !Number.isFinite(p.nbf) || p.nbf > now + skew ||
        p.exp <= p.iat || p.exp - p.iat > 60 * 60 + skew) throw Error("jwt_claims_invalidos");
    const email = String(p.email || "").trim().toLowerCase();
    if (!EMAIL.test(email) || !config.allowed.has(email)) throw Error("correo_no_autorizado");
    if (typeof p.sub !== "string" || !p.sub) throw Error("identidad_no_humana");
    return { email, subject: p.sub, expiresAt: p.exp };
  }
  return { enabled: Boolean(config), verify };
}
module.exports = { createCloudflareVerifier, validConfig };
