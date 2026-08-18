(() => {
  "use strict";

  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!db || new URLSearchParams(location.search).get("safe") === "1") return;

  const PREFIX = "innova-mira-doc-v7:";
  const pending = new Map();
  let hydrating = false;

  const originalSetItem = Storage.prototype.setItem;

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  async function persist(fingerprint, extractedText) {
    const fileId = String(fingerprint || "").split("|")[0];
    if (!isUuid(fileId) || !String(extractedText || "").trim()) return;

    const { data: sessionData } = await db.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;
    if (!userId) return;

    const { error } = await db.from("company_file_text_index").upsert({
      file_id: fileId,
      fingerprint,
      extracted_text: String(extractedText).slice(0, 80000),
      extraction_status: "ready",
      extraction_method: "innova-admin-browser",
      extracted_at: new Date().toISOString(),
      created_by: userId,
      metadata: { source: "mira-v7-session-cache" },
    }, { onConflict: "file_id" });

    if (error && !/row-level security|permission/i.test(error.message || "")) {
      console.warn("MIRA persistent cache:", error.message || error);
    }
  }

  function schedulePersist(fingerprint, value) {
    clearTimeout(pending.get(fingerprint));
    const timer = setTimeout(() => {
      pending.delete(fingerprint);
      persist(fingerprint, value).catch(() => {});
    }, 700);
    pending.set(fingerprint, timer);
  }

  Storage.prototype.setItem = function innovaPersistentSetItem(key, value) {
    const result = originalSetItem.call(this, key, value);
    if (!hydrating && this === window.sessionStorage && String(key).startsWith(PREFIX)) {
      const fingerprint = String(key).slice(PREFIX.length);
      schedulePersist(fingerprint, value);
    }
    return result;
  };

  async function hydrate() {
    const { data: sessionData } = await db.auth.getSession();
    if (!sessionData?.session?.user) return;

    const { data, error } = await db
      .from("company_file_text_index")
      .select("file_id,fingerprint,extracted_text,extraction_status")
      .eq("extraction_status", "ready")
      .limit(250);

    if (error) {
      if (!/does not exist|row-level security|permission/i.test(error.message || "")) {
        console.warn("MIRA persistent cache hydrate:", error.message || error);
      }
      return;
    }

    hydrating = true;
    try {
      for (const row of data || []) {
        if (!row?.fingerprint || !row?.extracted_text) continue;
        try {
          originalSetItem.call(window.sessionStorage, `${PREFIX}${row.fingerprint}`, String(row.extracted_text).slice(0, 80000));
        } catch (_) {}
      }
    } finally {
      hydrating = false;
    }
  }

  window.INNOVA_MIRA_DOC_CACHE_READY = hydrate().catch(() => {});

  db.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      window.INNOVA_MIRA_DOC_CACHE_READY = hydrate().catch(() => {});
    }
  });
})();
