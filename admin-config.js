window.INNOVA_ADMIN_CONFIG = Object.freeze({
  supabaseUrl: "https://alogqktilzgylzomzwem.supabase.co",
  supabasePublishableKey: "sb_publishable_x8GWfejC94VkWopDMUBXSQ_PQcqNIj8",
  backendUrl: "https://ceo-ai-mira.onrender.com",
  storageBucket: "company-files",
  companyName: "Innova Space Education SPA",
  companyEmail: "contacto@innova-space-edu.cl",
  companyRuts: ["10.236.204-7"],
  initialAdminEmail: "contacto@innova-space-edu.cl"
});

(() => {
  const jszip = document.createElement("script");
  jszip.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  jszip.async = false;
  document.head.appendChild(jszip);

  const script = document.createElement("script");
  script.src = "admin-invoice-autofill-v2.js";
  script.async = false;
  document.head.appendChild(script);
})();
