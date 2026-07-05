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
                <p>Información comercial de <strong>Innova Space Edu SpA</strong> para organizar servicios, proyectos, entregas, compras, renovaciones, construcción, implementación tecnológica, desarrollo web, inteligencia artificial y respaldos escritos.</p>
                <div class="legal-grid">
                    <div class="legal-card">
                        <h4>Documentos</h4>
                        <p>Todo trabajo se coordina mediante cotización, orden de compra, factura, contrato, correo institucional, informe, acta o evidencia escrita que permita respaldar alcance, valores, plazos y entregables.</p>
                    </div>
                    <div class="legal-card">
                        <h4>Aceptación</h4>
                        <p>La firma, aprobación de cotización, emisión de orden de compra, aprobación por correo o inicio del servicio implica aceptación de las condiciones comerciales y técnicas informadas.</p>
                    </div>
                    <div class="legal-card">
                        <h4>Evidencias</h4>
                        <p>Los avances podrán respaldarse con fotografías, informes, correos, documentos tributarios y registros enviados por correo electrónico, usando la fecha de envío como respaldo.</p>
                    </div>
                </div>
                <h4>Pagos y atrasos</h4>
                <ol>
                    <li>Los pagos deberán realizarse según fechas, cuotas, hitos o condiciones indicadas en la cotización, factura, orden de compra, contrato o acuerdo escrito.</li>
                    <li>Si existe atraso superior a <strong>5 días hábiles</strong>, la empresa podrá enviar aviso formal al correo institucional, correo del administrador, representante o contacto oficial informado.</li>
                    <li>Si el atraso continúa, se podrá solicitar regularización, reprogramar plazos, suspender avances o aplicar condiciones complementarias previamente aceptadas por las partes.</li>
                    <li>Si no existe regularización, la empresa podrá usar las vías administrativas, comerciales o contractuales que correspondan según la documentación y normativa vigente.</li>
                </ol>
                <h4>Normativa de referencia</h4>
                <ul class="legal-references">
                    <li><strong>Código Civil de Chile:</strong> artículos 1545, 1546, 1551, 1556, 1557 y 1559. <a href="https://www.bcn.cl/leychile/navegar?idNorma=172986" target="_blank" rel="noopener">Ver en LeyChile/BCN</a>.</li>
                    <li><strong>Ley N° 19.983:</strong> normas sobre factura, aceptación o reclamo, pago, intereses y recuperación de pagos. <a href="https://www.bcn.cl/leychile/navegar?idNorma=233421" target="_blank" rel="noopener">Ver en LeyChile/BCN</a>.</li>
                </ul>
                <p class="legal-note">Texto informativo base. Cada contrato, orden de compra o cotización podrá agregar condiciones específicas según el servicio, cliente, plazos, garantías, hitos de pago y entregables.</p>
            </div>
        </details>
    `;

    footer.appendChild(legalWrap);
});