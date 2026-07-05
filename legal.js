document.addEventListener("DOMContentLoaded", () => {
    const footer = document.querySelector("footer.footer");
    if (!footer || document.querySelector(".footer-legal")) return;

    const legalWrap = document.createElement("div");
    legalWrap.className = "footer-legal";
    legalWrap.innerHTML = `
        <details class="legal-disclosure">
            <summary class="legal-toggle-btn">
                <i class="ri-file-list-3-line"></i>
                Condiciones de trabajo y aceptación de proyectos
            </summary>
            <div class="legal-panel">
                <h3>Condiciones generales</h3>
                <p>Información comercial de Innova Space Edu SpA para organizar servicios, proyectos, entregas y respaldos escritos.</p>
                <p>Los trabajos se coordinan con documentos de respaldo, comunicaciones por correo y evidencias de avance.</p>
            </div>
        </details>
    `;

    footer.appendChild(legalWrap);
});