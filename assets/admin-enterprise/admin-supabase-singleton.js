(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabasePublishableKey || !window.supabase?.createClient) return;

  if (window.INNOVA_ADMIN_SUPABASE_CLIENT) return;

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  const singleton = originalCreateClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `sb-${new URL(cfg.supabaseUrl).hostname.split(".")[0]}-auth-token`,
    },
  });

  const originalFrom = singleton.from.bind(singleton);

  function makeQuotationNumber(row = {}, index = 0) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const project = String(row.project_id || "PRJ").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "PRJ";
    const entropy = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`)
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-6)
      .toUpperCase();
    return `ISE-COT-${date}-${project}-${entropy}${index ? `-${index + 1}` : ""}`;
  }

  function completeQuotationRows(values) {
    const rows = Array.isArray(values) ? values : [values];
    const completed = rows.map((value, index) => {
      if (!value || typeof value !== "object") return value;
      const row = { ...value };
      if (!String(row.quote_number || "").trim()) row.quote_number = makeQuotationNumber(row, index);
      if (!String(row.direction || "").trim()) row.direction = "sale";
      return row;
    });
    return Array.isArray(values) ? completed : completed[0];
  }

  singleton.from = function fromInnova(relation) {
    const builder = originalFrom(relation);
    if (String(relation || "") !== "company_quotations") return builder;

    if (typeof builder.insert === "function") {
      const originalInsert = builder.insert.bind(builder);
      builder.insert = (values, options) => originalInsert(completeQuotationRows(values), options);
    }

    if (typeof builder.upsert === "function") {
      const originalUpsert = builder.upsert.bind(builder);
      builder.upsert = (values, options) => originalUpsert(completeQuotationRows(values), options);
    }

    return builder;
  };

  window.INNOVA_ADMIN_SUPABASE_CLIENT = singleton;
  window.getInnovaAdminSupabaseClient = () => singleton;

  // Innova Admin is a single Supabase application. Several legacy/enterprise
  // modules still call createClient independently; returning the same instance
  // avoids multiple GoTrue clients, duplicated token refreshes and auth storms.
  window.supabase.createClient = function createInnovaClient(url, key, options) {
    if (String(url || "") === cfg.supabaseUrl && String(key || "") === cfg.supabasePublishableKey) {
      return singleton;
    }
    return originalCreateClient(url, key, options);
  };
})();
