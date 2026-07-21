// Carga el controlador que impide voces simultáneas de MIRA.
(() => {
    if (document.querySelector('script[data-mira-voice-controller]')) return;
    const script = document.createElement("script");
    script.src = "mira-voice-controller.js?v=20260721-1";
    script.async = false;
    script.dataset.miraVoiceController = "true";
    document.head.appendChild(script);
})();

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

// Categoría "Aplicaciones web" dentro del portafolio.
document.addEventListener("DOMContentLoaded", () => {
    const portfolio = document.querySelector("#portafolio");
    if (!portfolio || document.querySelector("#aplicaciones-web")) return;

    const style = document.createElement("style");
    style.id = "web-applications-styles";
    style.textContent = `
        .web-applications-block {
            max-width: 1180px;
            margin: 44px auto 0;
            padding-top: 34px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .web-applications-heading {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 22px;
            margin-bottom: 20px;
        }
        .web-applications-heading span {
            display: inline-block;
            color: var(--accent);
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            margin-bottom: 7px;
        }
        .web-applications-heading h3 {
            font-family: "Orbitron", sans-serif;
            font-size: clamp(1.25rem, 2.3vw, 1.85rem);
            letter-spacing: 0.06em;
            margin-bottom: 6px;
        }
        .web-applications-heading p {
            max-width: 720px;
            color: var(--text-muted);
            font-size: 0.9rem;
            line-height: 1.6;
        }
        .web-applications-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
            gap: 18px;
        }
        .web-application-card {
            position: relative;
            overflow: hidden;
            min-height: 290px;
            padding: clamp(20px, 3vw, 30px);
            border-radius: 24px;
            border: 1px solid rgba(53, 226, 255, 0.18);
            background: radial-gradient(circle at 100% 0%, rgba(53, 226, 255, 0.17), transparent 42%), radial-gradient(circle at 0% 100%, rgba(166, 101, 255, 0.15), transparent 45%), rgba(8, 13, 34, 0.94);
            box-shadow: var(--shadow-soft);
        }
        .web-application-card.secondary {
            border-color: rgba(255, 255, 255, 0.08);
            background: rgba(11, 16, 38, 0.9);
        }
        .web-app-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 20px;
        }
        .web-app-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 9px;
            border-radius: 999px;
            color: var(--accent);
            background: rgba(53, 226, 255, 0.08);
            border: 1px solid rgba(53, 226, 255, 0.14);
            font-size: 0.68rem;
            font-weight: 600;
        }
        .web-application-card h4 {
            font-size: clamp(1.2rem, 2vw, 1.55rem);
            margin-bottom: 10px;
        }
        .web-application-card > p {
            max-width: 700px;
            color: var(--text-muted);
            font-size: 0.88rem;
            line-height: 1.65;
        }
        .web-app-features {
            list-style: none;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px 16px;
            margin: 20px 0 24px;
        }
        .web-app-features li {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            color: #cbd3f4;
            font-size: 0.78rem;
        }
        .web-app-features i { color: var(--accent); margin-top: 2px; }
        .web-app-open {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 11px 16px;
            border-radius: 12px;
            color: #ffffff;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.86rem;
            background: linear-gradient(120deg, #22c7e6, #7868ff);
            box-shadow: 0 14px 34px rgba(54, 133, 255, 0.24);
            transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .web-app-open:hover {
            transform: translateY(-2px);
            box-shadow: 0 18px 40px rgba(54, 133, 255, 0.3);
        }
        .web-app-icon {
            width: 52px;
            height: 52px;
            display: grid;
            place-items: center;
            margin-bottom: 18px;
            border-radius: 15px;
            color: var(--accent);
            font-size: 1.5rem;
            background: rgba(53, 226, 255, 0.09);
            border: 1px solid rgba(53, 226, 255, 0.16);
        }
        @media (max-width: 820px) {
            .web-applications-heading { align-items: flex-start; flex-direction: column; }
            .web-applications-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
            .web-app-features { grid-template-columns: 1fr; }
            .web-application-card { min-height: auto; }
        }
    `;
    document.head.appendChild(style);

    const block = document.createElement("div");
    block.id = "aplicaciones-web";
    block.className = "web-applications-block";
    block.innerHTML = `
        <div class="web-applications-heading">
            <div>
                <span>Nueva categoría</span>
                <h3>Aplicaciones web</h3>
                <p>
                    Plataformas funcionales desarrolladas por Innova Space Education para resolver procesos
                    educativos, técnicos, administrativos y de gestión mediante interfaces web modernas.
                </p>
            </div>
        </div>

        <div class="web-applications-grid">
            <article class="web-application-card">
                <div class="web-app-badges">
                    <span class="web-app-badge"><i class="ri-flask-line"></i> MVP beta</span>
                    <span class="web-app-badge"><i class="ri-camera-3-line"></i> Cámara móvil</span>
                    <span class="web-app-badge"><i class="ri-brain-line"></i> Preparada para IA</span>
                </div>

                <h4>Innova Measure AI</h4>
                <p>
                    Aplicación para organizar obras y medir acopios de arena, ripio, tierra, mineral u otros
                    materiales. Incluye captura guiada, estimación de volumen y tonelaje, historial y la
                    arquitectura prevista para fotogrametría 3D e inteligencia artificial.
                </p>

                <ul class="web-app-features">
                    <li><i class="ri-checkbox-circle-line"></i> Gestión de proyectos y ubicaciones</li>
                    <li><i class="ri-checkbox-circle-line"></i> Captura desde la cámara del teléfono</li>
                    <li><i class="ri-checkbox-circle-line"></i> Estimación geométrica de respaldo</li>
                    <li><i class="ri-checkbox-circle-line"></i> Volumen, tonelaje y nivel de confianza</li>
                    <li><i class="ri-checkbox-circle-line"></i> Historial local y exportación de datos</li>
                    <li><i class="ri-checkbox-circle-line"></i> Hoja de ruta para motor 3D automático</li>
                </ul>

                <a class="web-app-open"
                   href="innova-measure-ai.html"
                   target="_blank"
                   rel="noopener"
                   data-mira-hint="Abre Innova Measure AI, la aplicación experimental para medición volumétrica de acopios.">
                    <i class="ri-external-link-line"></i>
                    Abrir aplicación
                </a>
            </article>

            <article class="web-application-card secondary">
                <div class="web-app-icon"><i class="ri-apps-2-add-line"></i></div>
                <h4>Ecosistema en crecimiento</h4>
                <p>
                    Esta sección reunirá las aplicaciones web creadas por la empresa, con acceso directo a
                    demostraciones, herramientas de gestión y soluciones conectadas con inteligencia artificial.
                </p>
                <a class="portfolio-link" href="#contacto">Solicitar una aplicación</a>
            </article>
        </div>
    `;

    const portfolioGrid = portfolio.querySelector(".portfolio-grid");
    if (portfolioGrid) portfolioGrid.insertAdjacentElement("afterend", block);
    else portfolio.appendChild(block);
});
