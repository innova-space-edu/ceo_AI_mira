// =========================================================
// Condiciones de trabajo y aceptación de proyectos
// Ruta: /legal.js
// Este archivo inserta un botón transparente al final de la página.
// =========================================================

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
                <h3>Condiciones generales de prestación de servicios</h3>

                <p>
                    Estas condiciones orientan la contratación de servicios de
                    <strong>Innova Space Edu SpA</strong>, incluyendo servicios de renovación,
                    construcción, compras, implementación tecnológica, gestión de proyectos,
                    desarrollo web, inteligencia artificial, asesorías, habilitación de espacios,
                    adquisición de materiales, ejecución de trabajos y otros servicios solicitados
                    por clientes, instituciones, empresas u organismos públicos o privados.
                </p>

                <p>
                    Innova Space Edu SpA declara desarrollar sus actividades conforme a la normativa
                    vigente aplicable en Chile. La emisión, gestión y respaldo de documentos podrá
                    realizarse por la empresa y/o por su representante legal,
                    <strong>Ivan Morales Sandoval</strong>, según corresponda a la naturaleza del
                    servicio, documentación tributaria, orden de compra, contrato o acuerdo comercial.
                </p>

                <div class="legal-grid">
                    <div class="legal-card">
                        <h4>Documentos de respaldo</h4>
                        <p>
                            Todo servicio será respaldado mediante cotizaciones, órdenes de compra,
                            facturas, contratos, correos institucionales, informes, actas, evidencias
                            fotográficas, registros de avance u otros documentos escritos que permitan
                            identificar el alcance del trabajo, valores, plazos, entregables y responsables.
                        </p>
                    </div>

                    <div class="legal-card">
                        <h4>Aceptación del proyecto</h4>
                        <p>
                            La firma de contrato, aprobación de cotización, emisión de orden de compra,
                            aceptación por correo electrónico, inicio del servicio o pago asociado al proyecto
                            implicará aceptación de las condiciones comerciales, técnicas y de pago informadas
                            por Innova Space Edu SpA.
                        </p>
                    </div>

                    <div class="legal-card">
                        <h4>Evidencias de avance</h4>
                        <p>
                            Los avances podrán enviarse por correo electrónico mediante fotografías, informes,
                            registros, documentos tributarios, actas, cotizaciones u órdenes de compra.
                            La fecha de envío podrá ser utilizada como respaldo de comunicación, avance,
                            entrega parcial o cumplimiento de una etapa del proyecto.
                        </p>
                    </div>
                </div>

                <h4>Pagos, atrasos y regularización</h4>
                <ol>
                    <li>
                        Los pagos deberán realizarse según las fechas, hitos, cuotas, condiciones o plazos
                        establecidos en la cotización, contrato, orden de compra, factura o acuerdo escrito
                        entre las partes.
                    </li>
                    <li>
                        Si el pago presenta un atraso superior a <strong>5 días hábiles</strong>,
                        Innova Space Edu SpA podrá enviar una notificación formal de atraso o mora al correo
                        institucional, correo personal del dueño, administrador, representante legal o correo
                        oficial informado por la empresa o institución contratante.
                    </li>
                    <li>
                        Si el atraso continúa, Innova Space Edu SpA podrá solicitar la regularización del pago,
                        aplicar recargos o multas pactadas, proponer acuerdos de pago, suspender o reprogramar
                        avances, ajustar plazos de entrega o establecer condiciones complementarias que permitan
                        resguardar la continuidad del servicio y los intereses comerciales de la empresa.
                    </li>
                    <li>
                        Ante falta de regularización, incumplimiento persistente o falta a las obligaciones
                        aceptadas, Innova Space Edu SpA podrá iniciar las gestiones administrativas, comerciales,
                        contractuales o legales que correspondan según la documentación firmada, las facturas
                        emitidas, las órdenes de compra, los acuerdos vigentes y la normativa aplicable.
                    </li>
                </ol>

                <h4>Facturación, cotizaciones y órdenes de compra</h4>
                <p>
                    Los trabajos podrán ejecutarse mediante factura, cotización, orden de compra, contrato
                    o combinación de estos documentos. La cotización enviada indicará los servicios, productos,
                    materiales, compras, etapas o condiciones específicas del proyecto. La orden de compra o
                    aceptación escrita permitirá iniciar la coordinación, adquisición de insumos, planificación
                    y ejecución de los trabajos, según lo acordado.
                </p>

                <h4>Base normativa citada</h4>
                <ul class="legal-references">
                    <li>
                        <strong>Código Civil de Chile:</strong> se consideran como referencia los artículos
                        1545 y 1546 sobre fuerza obligatoria de los contratos y buena fe contractual, además
                        de los artículos 1551, 1556, 1557 y 1559 sobre mora, indemnización, perjuicios e
                        intereses en obligaciones de dinero.
                        <a href="https://www.bcn.cl/leychile/navegar?idNorma=172986" target="_blank" rel="noopener">
                            Ver en LeyChile/BCN
                        </a>.
                    </li>
                    <li>
                        <strong>Ley N° 19.983:</strong> regula la transferencia y otorga mérito ejecutivo
                        a copia de la factura. Se considera como referencia para facturas, aceptación o reclamo,
                        pago del saldo insoluto, mora, intereses y comisión de recuperación de pagos.
                        <a href="https://www.bcn.cl/leychile/navegar?idNorma=233421" target="_blank" rel="noopener">
                            Ver en LeyChile/BCN
                        </a>.
                    </li>
                </ul>

                <p class="legal-note">
                    Este texto es una base informativa de condiciones comerciales. En contratos específicos
                    podrán agregarse cláusulas particulares, anexos técnicos, garantías, hitos de pago,
                    multas, plazos de entrega, condiciones de suspensión, recepción conforme y obligaciones
                    especiales según el tipo de servicio, cliente, institución u orden de compra.
                </p>
            </div>
        </details>
    `;

    footer.appendChild(legalWrap);
});
