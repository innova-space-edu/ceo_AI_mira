(() => {
  "use strict";

  function installAdminAccess() {
    const nav = document.getElementById("navLinks");
    if (!nav || nav.querySelector(".nav-admin-access")) return;

    const item = document.createElement("li");
    item.className = "nav-admin-item";
    item.innerHTML = `
      <a href="admin.html"
         class="nav-admin-access"
         aria-label="Ingresar como administrador"
         data-mira-hint="Acceso privado a la plataforma de administración de Innova Space Education.">
        <i class="ri-shield-user-line" aria-hidden="true"></i>
        <span>Ingresar como administrador</span>
      </a>
    `;
    nav.appendChild(item);

    if (!document.getElementById("nav-admin-access-style")) {
      const style = document.createElement("style");
      style.id = "nav-admin-access-style";
      style.textContent = `
        .nav-admin-item { margin-left: 6px; }
        .nav-admin-access {
          display: inline-flex !important;
          align-items: center;
          gap: 7px;
          padding: 8px 3px !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: rgba(226, 233, 255, 0.88) !important;
          font-size: 0.8rem !important;
          font-weight: 500 !important;
          white-space: nowrap;
          text-decoration: none;
          transition: color .18s ease, text-shadow .18s ease, transform .18s ease;
        }
        .nav-admin-access::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, #49e9ff, #be55ff);
          transform: scaleX(0);
          transform-origin: center;
          transition: transform .18s ease;
        }
        .nav-admin-access:hover,
        .nav-admin-access:focus-visible {
          color: #ffffff !important;
          text-shadow: 0 0 18px rgba(91, 221, 255, .55);
          transform: translateY(-1px);
        }
        .nav-admin-access:hover::after,
        .nav-admin-access:focus-visible::after { transform: scaleX(1); }
        .nav-admin-access i { color: #57e6ff; font-size: 1rem; }

        @media (max-width: 1180px) and (min-width: 481px) {
          .nav-admin-access span { display: none; }
          .nav-admin-access { padding-inline: 7px !important; }
          .nav-admin-access i { font-size: 1.15rem; }
        }
        @media (max-width: 480px) {
          .nav-admin-item { margin-left: 0; }
          .nav-admin-access { width: 100%; justify-content: flex-start; padding: 13px 0 !important; }
          .nav-admin-access span { display: inline; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAdminAccess, { once: true });
  } else {
    installAdminAccess();
  }
})();
