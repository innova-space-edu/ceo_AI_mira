(() => {
  "use strict";
  const root = document.getElementById("pay-root");
  const apiBase = String(document.body.dataset.apiBase || "").replace(/\/$/, "");
  const params = new URLSearchParams(location.search);
  const token = params.get("p") || "";
  const result = params.get("result") || "";
  const embed = params.get("embed") === "1";
  if (embed) document.body.classList.add("embed");

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const money = (v) => new Intl.NumberFormat("es-CL", {
    style:"currency",currency:"CLP",maximumFractionDigits:0
  }).format(Number(v)||0);
  const dateCL = (v) => {
    if (!v) return "Sin vencimiento";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "Sin vencimiento" : d.toLocaleDateString("es-CL");
  };
  const statusLabel = (s) => ({
    active:"Disponible",opened:"Abierto",processing:"Confirmando",paid:"Pagado",
    failed:"Fallido",expired:"Vencido",cancelled:"Cancelado",refunded:"Reembolsado"
  })[s] || s || "Disponible";

  function notifyParent(type, detail = {}) {
    if (!embed || window.parent === window) return;
    window.parent.postMessage({ source:"innova-pay", type, ...detail }, "*");
  }

  async function getPayment() {
    const response = await fetch(apiBase + "/api/payments/link/" + encodeURIComponent(token), {
      headers:{Accept:"application/json"}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || "No fue posible cargar este cobro");
    return body.payment;
  }

  function returnBanner() {
    if (result === "success") return '<div class="pay-return">Mercado Pago recibió la operación. Estamos confirmando el pago automáticamente.</div>';
    if (result === "pending") return '<div class="pay-return pending">El pago quedó pendiente. Esta página actualizará el estado cuando Mercado Pago lo confirme.</div>';
    if (result === "failure") return '<div class="pay-return failure">El pago no se completó. Puedes volver a intentarlo desde este mismo link.</div>';
    return "";
  }

  function render(payment) {
    const terminal = ["paid","expired","cancelled","refunded"].includes(payment.status);
    const disabled = terminal || !payment.provider_ready;
    let label = "Continuar a Mercado Pago";
    if (payment.status === "paid") label = "Pago confirmado";
    else if (payment.status === "expired") label = "Link vencido";
    else if (payment.status === "cancelled") label = "Cobro cancelado";
    else if (!payment.provider_ready) label = "Pago temporalmente no disponible";

    root.innerHTML = returnBanner() + `
      <div class="pay-kicker">Pago seguro</div>
      <h1 class="pay-title">${esc(payment.description || "Cobro Innova Space Edu SpA")}</h1>
      <p class="pay-client">${payment.customer_name ? "Para " + esc(payment.customer_name) : "Innova Space Edu SpA"}</p>
      <div class="pay-amount"><span>Total a pagar</span><strong>${money(payment.amount)}</strong></div>
      <div class="pay-meta">
        <div class="pay-meta-row"><span>Estado</span><strong><span class="pay-status ${esc(payment.status)}">${esc(statusLabel(payment.status))}</span></strong></div>
        <div class="pay-meta-row"><span>Vencimiento</span><strong>${esc(dateCL(payment.expires_at))}</strong></div>
        <div class="pay-meta-row"><span>Receptor</span><strong>Innova Space Edu SpA · 78.220.699-0</strong></div>
      </div>
      <button id="pay-now" class="pay-button" ${disabled ? "disabled" : ""}>${esc(label)}</button>
      <div class="pay-provider">Pago procesado por Mercado Pago · CLP</div>`.replaceAll("${", "${");

    root.querySelector("#pay-now")?.addEventListener("click", startCheckout);
    notifyParent("status", { status: payment.status, amount: payment.amount });
  }

  async function startCheckout(event) {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Conectando con Mercado Pago…";
    try {
      const response = await fetch(apiBase + "/api/payments/link/" + encodeURIComponent(token) + "/checkout", {
        method:"POST",
        headers:{"Content-Type":"application/json",Accept:"application/json"},
        body:"{}"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "No fue posible iniciar el pago");
      notifyParent("checkout", { order_id: body.order_id });
      location.href = body.checkout_url;
    } catch (error) {
      button.disabled = false;
      button.textContent = "Continuar a Mercado Pago";
      const box = document.createElement("div");
      box.className = "pay-error";
      box.style.marginTop = "12px";
      box.textContent = error.message || "No fue posible iniciar el pago";
      button.after(box);
    }
  }

  async function boot() {
    if (!token) {
      root.innerHTML = '<div class="pay-error">El link de pago no contiene un identificador válido.</div>';
      return;
    }
    try {
      const payment = await getPayment();
      render(payment);
      if (result && payment.status !== "paid") {
        let tries = 0;
        const timer = setInterval(async () => {
          tries += 1;
          try {
            const next = await getPayment();
            render(next);
            if (next.status === "paid" || tries >= 8) clearInterval(timer);
          } catch (_) {
            if (tries >= 8) clearInterval(timer);
          }
        }, 4000);
      }
    } catch (error) {
      root.innerHTML = '<div class="pay-error">' + esc(error.message || "No fue posible cargar el cobro") + '</div>';
      notifyParent("error", { message:error.message || "No fue posible cargar el cobro" });
    }
  }

  boot();
})();