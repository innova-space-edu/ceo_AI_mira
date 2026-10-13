(() => {
  "use strict";
  const config = window.INNOVA_ADMIN_CONFIG;
  const client = window.getInnovaAdminSupabaseClient?.();
  const el = id => document.getElementById(id);
  let enrollmentFactor = null;
  function message(text, error = false) {
    el("status").textContent = String(text);
    el("status").classList.toggle("error", error);
  }
  async function requestApi(kind, extra = {}) {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error("Inicia sesión nuevamente en Innova CEO.");
    const result = await fetch(config.supabaseUrl + "/functions/v1/innova-server-bridge", {
      method: "POST", mode: "cors", cache: "no-store",
      headers: { "Content-Type": "application/json", "apikey": config.supabasePublishableKey,
        "Authorization": "Bearer " + data.session.access_token },
      body: JSON.stringify({ kind, ...extra }),
    });
    const answer = await result.json();
    if (!result.ok) throw new Error(answer.error || "Acceso rechazado.");
    return answer;
  }
  async function requireCeoAdmin() {
    if (!config || !client) throw new Error("Configuración de CEO no disponible.");
    const { data: current, error } = await client.auth.getUser();
    if (error || !current?.user) throw new Error("Abre primero Innova CEO e inicia sesión.");
    const { data: profile, error: roleError } = await client.from("company_users")
      .select("role,status").eq("user_id", current.user.id).maybeSingle();
    if (roleError || profile?.role !== "superadmin" || profile?.status !== "active")
      throw new Error("Esta página requiere superadministrador activo.");
  }
  async function currentFactor() {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;
    return (data?.totp || []).find(factor => factor.status === "verified")?.id || null;
  }
  function code() {
    const digits = el("otp").value.trim();
    if (!/^[0-9]{6}$/.test(digits)) throw new Error("Introduce un código de seis dígitos.");
    return digits;
  }
  async function verify(factorId) {
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: code() });
    el("otp").value = "";
    if (error) throw error;
  }
  async function enroll() {
    if (await currentFactor()) {
      message("Ya tienes un factor asociado. Introduce un código nuevo para aprobar.");
      return;
    }
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp", friendlyName: "Innova CEO - Innova Server",
    });
    if (error) throw error;
    if (!data?.id || typeof data.totp?.qr_code !== "string" ||
        !data.totp.qr_code.startsWith("data:image/")) throw new Error("No se recibió el QR.");
    enrollmentFactor = data.id;
    el("qr").src = data.totp.qr_code;
    el("enrollment").classList.remove("hidden");
    el("verify-enrollment").classList.remove("hidden");
    message("Escanea el QR de CEO en Microsoft Authenticator y confirma el código.");
  }
  async function approve(id) {
    const factor = await currentFactor();
    if (!factor) throw new Error("Debes registrar Microsoft Authenticator en CEO.");
    await verify(factor);
    const data = await requestApi("approve", { id });
    message("Solicitud " + data.request.id + " aprobada. La autorización es de un solo uso.");
    await refresh();
  }
  function cell(row, value) {
    const item = document.createElement("td"); item.textContent = String(value ?? "");
    row.appendChild(item); return item;
  }
  async function refresh() {
    const { requests } = await requestApi("list");
    const tbody = el("rows"); tbody.replaceChildren();
    for (const item of requests || []) {
      const tr = document.createElement("tr");
      cell(tr, new Date(item.created_at).toLocaleString("es-CL"));
      cell(tr, JSON.stringify(item.operation));
      cell(tr, item.status);
      const td = document.createElement("td");
      if (item.status === "pending" && new Date(item.expires_at).getTime() > Date.now()) {
        for (const [title,kind] of [["Aprobar","approve"], ["Rechazar","reject"]]) {
          const b = document.createElement("button");
          b.className = kind === "reject" ? "secondary" : "";
          b.textContent = title;
          b.addEventListener("click", async () => {
            b.disabled = true;
            try {
              if (kind === "approve") await approve(item.id);
              else { await requestApi("reject", { id: item.id }); await refresh(); }
            } catch (e) { message(e.message || String(e), true); }
            finally { b.disabled = false; }
          });
          td.appendChild(b); td.appendChild(document.createTextNode(" "));
        }
      }
      tr.appendChild(td); tbody.appendChild(tr);
    }
  }
  async function createRequest() {
    const op = el("operation").value, target = el("target").value.trim();
    const operation = op === "desplegar_servicio"
      ? { op, servicio: target, proyecto: el("project").value.trim() }
      : { op, nombre: target, accion: el("verb").value };
    await requestApi("request", { operation });
    message("Solicitud pendiente de autorización MFA. No se ha ejecutado.");
    await refresh();
  }
  function guard(operation) {
    Promise.resolve().then(operation).catch(e => message(e.message || String(e), true));
  }
  el("enroll").addEventListener("click", () => guard(enroll));
  el("verify-enrollment").addEventListener("click", () => guard(async () => {
    if (!enrollmentFactor) throw new Error("Primero registra un factor.");
    await verify(enrollmentFactor); enrollmentFactor = null;
    el("enrollment").classList.add("hidden");
    el("verify-enrollment").classList.add("hidden");
    message("Microsoft Authenticator vinculado a la cuenta CEO.");
  }));
  el("refresh").addEventListener("click", () => guard(refresh));
  el("request").addEventListener("click", () => guard(createRequest));
  guard(async () => {
    await requireCeoAdmin();
    el("private").classList.remove("hidden");
    await refresh();
    message("Centro de aprobaciones disponible.");
  });
})();
