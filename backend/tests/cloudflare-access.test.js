"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createCloudflareVerifier, validConfig } = require("../cloudflare-access");

const domain = "https://innova.cloudflareaccess.com";
const audience = "a".repeat(64), email = "contacto@example.com";
const now = 1750000000000;
const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: "jwk" }), kid: "key-one", alg: "RS256" };
const head = { alg: "RS256", typ: "JWT", kid: "key-one" };
function token(payload = {}, key = pair.privateKey, header = head) {
  const claims = {
    iss: domain, aud: [audience], sub: "legitimate-human",
    type: "app", email,
    iat: now/1000 - 10, nbf: now/1000 - 10, exp: now/1000 + 1800,
    ...payload
  };
  const data = [header, claims].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
  return data + "." + crypto.sign("RSA-SHA256",Buffer.from(data),key).toString("base64url");
}
function harness(opts = {}) {
  let requests = 0;
  const fetchFn = async url => {
    requests++;
    assert.equal(url,domain+"/cdn-cgi/access/certs");
    return { ok: true, json: async () => ({ keys: [jwk] }) };
  };
  const verify = createCloudflareVerifier({
    teamDomain:domain,audience,emails:email,fetchFn,clock:()=>now,...opts
  });
  return { verify, calls:()=>requests };
}
test("invalida configuración faltante y dominio no autorizado", () => {
  assert.equal(validConfig({teamDomain:"http://evil.example",audience,emails:email}),null);
  assert.equal(validConfig({teamDomain:domain,audience,emails:""}),null);
  assert.equal(validConfig({teamDomain:domain,audience,emails:email}).domain,domain);
});
test("verifica JWT firmado por Cloudflare, issuer, audiencia y correo",async()=>{
  const h = harness();
  const a = await h.verify.verify(token());
  assert.equal(a.email,email);
  assert.equal(h.calls(),1);
  await h.verify.verify(token({ sub:"another-valid-user" }));
  assert.equal(h.calls(),1); // JWKS cache
});
test("no acepta firma falsa aun cuando correo y audiencia sean correctos", async()=>{
  const h=harness();
  await assert.rejects(h.verify.verify(token({},other.privateKey)),/firma_invalida/);
});
test("no acepta jwt alterado, service token ni usuario de correo incorrecto",async()=>{
  const h=harness();
  for(const attrs of [
    {iss:"https://otra.cloudflareaccess.com"},
    {aud:["invalid-audience"]},
    {email:"intruso@example.com"},
    {type:"org"},
    {sub:""},
    {exp:now/1000-1},
    {iat:now/1000+120},
    {nbf:now/1000+120},
    {exp:now/1000+24*3600},
  ]) await assert.rejects(h.verify.verify(token(attrs)));
  await assert.rejects(h.verify.verify(token({},pair.privateKey,{...head,alg:"none"})));
});
test("Cloudflare puede omitir claim opcional nbf",async()=>{
  const h=harness();
  const attrs={iss:domain,aud:[audience],sub:"human-id",email,type:"app",
    iat:now/1000-10,exp:now/1000+1800};
  const data=[head,attrs].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
  const jwt=data+"."+crypto.sign("RSA-SHA256",Buffer.from(data),pair.privateKey).toString("base64url");
  assert.equal((await h.verify.verify(jwt)).email,email);
});
