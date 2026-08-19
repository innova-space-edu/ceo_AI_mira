"use strict";

// MIRA Business necesita seguir disponible aunque la cuenta de OpenRouter
// no tenga créditos para modelos pagados. Por defecto se usa el router
// gratuito de OpenRouter; el modo pagado puede reactivarse desde Render
// sin volver a cambiar código.
const mode = String(process.env.MIRA_ADMIN_AI_MODE || "free").trim().toLowerCase();
const paidModel =
  process.env.OPENROUTER_ADMIN_PAID_MODEL ||
  process.env.OPENROUTER_ADMIN_MODEL ||
  "meta-llama/llama-3.1-70b-instruct";
const freeModel = process.env.OPENROUTER_ADMIN_FREE_MODEL || "openrouter/free";

if (mode === "paid") {
  process.env.OPENROUTER_ADMIN_MODEL = paidModel;
  // Si el modelo pagado falla por disponibilidad/rate limit, OpenRouter puede
  // intentar el router gratuito como fallback adicional.
  process.env.OPENROUTER_ADMIN_FALLBACK_MODEL =
    process.env.OPENROUTER_ADMIN_FALLBACK_MODEL || freeModel;
} else {
  // Modo seguro frente a saldo 0: no intenta primero un modelo de pago.
  process.env.OPENROUTER_ADMIN_MODEL = freeModel;
  process.env.OPENROUTER_ADMIN_FALLBACK_MODEL = freeModel;
}

console.log(
  `MIRA Business AI mode: ${mode === "paid" ? "paid" : "free"} · ${process.env.OPENROUTER_ADMIN_MODEL}`
);

require("./server.js");
