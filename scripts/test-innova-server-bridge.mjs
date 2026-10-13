import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync("supabase/functions/innova-server-bridge/index.ts", "utf8");
const sql = readFileSync("sql/innova-server-secure-bridge.sql", "utf8");
const ui = readFileSync("assets/admin-enterprise/innova-server-security.js", "utf8");
const admin = readFileSync("admin.html", "utf8");

assert.match(edge, /db\.auth\.getUser\(jwt\)/);
assert.match(edge, /profile\?\.role !== "superadmin"/);
assert.match(edge, /claims\.aal !== "aal2"/);
assert.match(edge, /e\.method === "totp"/);
assert.match(edge, /age <= 120/);
assert.match(edge, /equal|safeEqual/);
assert.match(edge, /normalizeOperation/);
assert.doesNotMatch(edge, /eval\(|exec\(|child_process|Deno\.Command/);
assert.match(sql, /enable row level security/g);
assert.match(sql, /for update skip locked/);
assert.match(sql, /innova_server_audit_transition/);
assert.match(sql, /grant execute on function public\.innova_server_claim_next\(\) to service_role/);
assert.match(ui, /challengeAndVerify/);
assert.match(ui, /textContent/);
assert.match(admin, /innova-server-seguridad\.html/);
console.log("Secure Bridge V1: static security and integration checks OK.");
