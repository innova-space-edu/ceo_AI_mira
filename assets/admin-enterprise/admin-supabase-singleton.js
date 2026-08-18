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
