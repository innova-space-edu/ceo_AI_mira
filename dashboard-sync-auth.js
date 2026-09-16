(() => {
  'use strict';
  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!db?.auth?.onAuthStateChange) return;
  db.auth.onAuthStateChange((event, session) => {
    if (!session?.user) return;
    if (!['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(String(event || ''))) return;
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('innova-business-sync', { detail: { source: 'auth', event } }));
    }, 650);
  });
})();
