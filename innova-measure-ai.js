(() => {
  "use strict";

  const STORAGE_KEYS = {
    projects: "innovaMeasure.projects.v1",
    measurements: "innovaMeasure.measurements.v1"
  };

  const state = {
    projects: load(STORAGE_KEYS.projects, []),
    measurements: load(STORAGE_KEYS.measurements, []),
    photos: [],
    stream: null,
    pendingResult: null,
    modelAnimation: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    seedDemoData();
    bindNavigation();
    bindProjects();
    bindMeasurement();
    bindHistory();
    bindCamera();
    bindResultActions();
    bindMaterialDensity();
    renderAll();
    createSpaceBackground();
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("No se pudo leer almacenamiento local:", error);
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("No se pudo guardar en almacenamiento local:", error);
      showToast("No fue posible guardar los datos en este navegador.", true);
    }
  }

  function seedDemoData() {
    if (!state.projects.length) {
      state.projects.push({
        id: cryptoId(),
        name: "Proyecto demostrativo",
        location: "Antofagasta, Chile",
        client: "Innova Space Education",
        description: "Proyecto inicial para probar el flujo de medición.",
        createdAt: new Date().toISOString()
      });
      save(STORAGE_KEYS.projects, state.projects);
    }
  }

  function bindNavigation() {
    $$(".module-button").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    $$("[data-go-view]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.goView, true));
    });
  }

  function switchView(viewName, scroll = false) {
    $$(".module-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewName);
    });

    $$(".app-view").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.viewPanel === viewName);
    });

    if (viewName !== "new-measurement") stopCamera();
    if (scroll) $("#workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindProjects() {
    const dialog = $("#projectDialog");
    const form = $("#projectForm");

    $("#openProjectDialog")?.addEventListener("click", () => dialog.showModal());
    $$("[data-open-project]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
    $("#closeProjectDialog")?.addEventListener("click", () => dialog.close());
    $("#cancelProject")?.addEventListener("click", () => dialog.close());

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#projectName").value.trim();
      if (!name) return showToast("Ingresa el nombre del proyecto.", true);

      state.projects.unshift({
        id: cryptoId(),
        name,
        location: $("#projectLocation").value.trim(),
        client: $("#projectClient").value.trim(),
        description: $("#projectDescription").value.trim(),
        createdAt: new Date().toISOString()
      });

      save(STORAGE_KEYS.projects, state.projects);
      form.reset();
      dialog.close();
      renderAll();
      showToast("Proyecto creado correctamente.");
    });

    $("#projectGrid")?.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-project]");
      const measureButton = event.target.closest("[data-measure-project]");

      if (deleteButton) {
        const id = deleteButton.dataset.deleteProject;
        const hasMeasurements = state.measurements.some((item) => item.projectId === id);
        if (hasMeasurements) return showToast("No puedes eliminar un proyecto con mediciones guardadas.", true);
        state.projects = state.projects.filter((project) => project.id !== id);
        save(STORAGE_KEYS.projects, state.projects);
        renderAll();
        showToast("Proyecto eliminado.");
      }

      if (measureButton) {
        switchView("new-measurement", true);
        $("#measurementProject").value = measureButton.dataset.measureProject;
      }
    });
  }

  function renderProjects() {
    const grid = $("#projectGrid");
    const empty = $("#projectEmpty");
    if (!grid || !empty) return;

    grid.innerHTML = state.projects.map((project) => {
      const count = state.measurements.filter((item) => item.projectId === project.id).length;
      return `
        <article class="project-card">
          <div class="project-card-top">
            <span class="project-card-icon"><i class="ri-building-4-line"></i></span>
            <button class="project-delete" type="button" data-delete-project="${escapeHtml(project.id)}" aria-label="Eliminar proyecto"><i class="ri-delete-bin-6-line"></i></button>
          </div>
          <h3>${escapeHtml(project.name)}</h3>
          <p><i class="ri-map-pin-line"></i> ${escapeHtml(project.location || "Ubicación no registrada")}</p>
          <p>${escapeHtml(project.description || project.client || "Sin descripción")}</p>
          <div class="project-meta">
            <span>${count} medición${count === 1 ? "" : "es"}</span>
            <button class="text-button" type="button" data-measure-project="${escapeHtml(project.id)}">Medir aquí</button>
          </div>
        </article>`;
    }).join("");

    empty.classList.toggle("show", state.projects.length === 0);
  }

  function populateProjectSelect() {
    const select = $("#measurementProject");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Selecciona un proyecto</option>${state.projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join("")}`;
    if (state.projects.some((project) => project.id === current)) select.value = current;
    else if (state.projects.length === 1) select.value = state.projects[0].id;
  }

  function bindMaterialDensity() {
    $("#materialSelect")?.addEventListener("change", (event) => {
      const density = event.target.selectedOptions[0]?.dataset?.density;
      if (density) $("#densityInput").value = density;
    });
  }

  function bindMeasurement() {
    $("#measurementForm")?.addEventListener("submit", processMeasurement);
  }

  function processMeasurement(event) {
    event.preventDefault();

    const projectId = $("#measurementProject").value;
    const pileName = $("#pileName").value.trim();
    const length = numberValue("#lengthInput");
    const width = numberValue("#widthInput");
    const height = numberValue("#heightInput");
    const density = numberValue("#densityInput");
    const shape = $("#shapeSelect").value;
    const material = $("#materialSelect").value;
    const coverage = $$(".coverage-check:checked").length;
    const markerVisible = $("#markerVisible").checked;
    const photoCount = state.photos.length;

    if (!projectId || !pileName || !length || !width || !height || !density) return showToast("Completa todos los datos obligatorios.", true);
    if (photoCount < 4) return showToast("Agrega al menos 4 fotografías para evaluar la captura.", true);
    if (coverage < 2) return showToast("Confirma al menos dos ángulos de cobertura.", true);

    const volume = calculateVolume(shape, length, width, height);
    const tonnes = volume * density;
    const confidence = calculateConfidence(photoCount, coverage, markerVisible);
    const errorRate = Math.max(0.04, (100 - confidence) / 180);
    const project = state.projects.find((item) => item.id === projectId);

    state.pendingResult = {
      id: cryptoId(), createdAt: new Date().toISOString(), projectId,
      projectName: project?.name || "Proyecto", pileName, material, density, shape,
      dimensions: { length, width, height }, markerSize: $("#markerSize").value,
      markerVisible, photoCount, coverage, volume, tonnes, confidence,
      minVolume: volume * (1 - errorRate), maxVolume: volume * (1 + errorRate),
      status: "Estimación MVP"
    };

    showResult(state.pendingResult);
  }

  function calculateVolume(shape, length, width, height) {
    const base = length * width * height;
    if (shape === "cone") return (Math.PI * base) / 12;
    if (shape === "trapezoid") return base * 0.55;
    if (shape === "loose") return base * 0.46;
    return (Math.PI * base) / 6;
  }

  function calculateConfidence(photoCount, coverage, markerVisible) {
    return Math.min(96, Math.round(48 + Math.min(photoCount, 20) * 1.6 + coverage * 3.5 + (markerVisible ? 7 : 0)));
  }

  function showResult(result) {
    $("#resultPanel").hidden = false;
    $("#resultSubtitle").textContent = `${result.pileName} · ${result.projectName}`;
    $("#confidenceBadge").textContent = `${result.confidence} % confianza`;
    $("#resultVolume").textContent = formatNumber(result.volume) + " m³";
    $("#resultTonnes").textContent = formatNumber(result.tonnes) + " t";
    $("#resultRange").textContent = `${formatNumber(result.minVolume)} – ${formatNumber(result.maxVolume)} m³`;
    $("#resultPhotos").textContent = String(result.photoCount);
    $("#modelDimensions").textContent = `${formatNumber(result.dimensions.length)} × ${formatNumber(result.dimensions.width)} × ${formatNumber(result.dimensions.height)} m`;
    $("#qualityList").innerHTML = `
      ${qualityRow("Cobertura visual", `${result.coverage}/4 ángulos`, result.coverage >= 4)}
      ${qualityRow("Cantidad de fotografías", `${result.photoCount} imágenes`, result.photoCount >= 12)}
      ${qualityRow("Referencia de escala", result.markerVisible ? "Confirmada" : "No confirmada", result.markerVisible)}
      ${qualityRow("Método de cálculo", "Geometría manual MVP", false)}`;
    $("#resultPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    drawModel(result);
  }

  function qualityRow(label, value, good) {
    return `<div class="quality-item"><span>${escapeHtml(label)}</span><strong class="${good ? "quality-good" : "quality-warn"}">${escapeHtml(value)}</strong></div>`;
  }

  function bindResultActions() {
    $("#saveMeasurement")?.addEventListener("click", () => {
      if (!state.pendingResult) return showToast("Primero procesa una medición.", true);
      const alreadySaved = state.measurements.some((item) => item.id === state.pendingResult.id);
      if (!alreadySaved) {
        state.measurements.unshift({ ...state.pendingResult });
        save(STORAGE_KEYS.measurements, state.measurements);
      }
      renderAll();
      showToast(alreadySaved ? "La medición ya estaba guardada." : "Medición guardada.");
    });

    $("#printResult")?.addEventListener("click", printResult);
    $("#newMeasurement")?.addEventListener("click", () => {
      resetMeasurement();
      $("#measurementForm").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function printResult() {
    const result = state.pendingResult;
    if (!result) return showToast("No hay un resultado para generar la ficha.", true);
    const report = window.open("", "_blank", "noopener,noreferrer");
    if (!report) return showToast("El navegador bloqueó la ventana de impresión.", true);

    report.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ficha ${escapeHtml(result.pileName)}</title><style>
      body{font-family:Arial,sans-serif;color:#172033;margin:40px;line-height:1.5}h1{margin-bottom:4px}h2{margin-top:30px}.muted{color:#667085}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:20px}.card{border:1px solid #d8deea;border-radius:12px;padding:16px}
      .card span{display:block;color:#667085;font-size:12px}.card strong{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:12px}td{padding:9px;border-bottom:1px solid #e6eaf1}
      .notice{margin-top:28px;padding:14px;border-left:4px solid #2d8cff;background:#f4f8ff}@media print{button{display:none}}</style></head><body>
      <h1>Innova Measure AI</h1><p class="muted">Ficha experimental de medición volumétrica</p><h2>${escapeHtml(result.pileName)}</h2>
      <table><tr><td>Proyecto</td><td>${escapeHtml(result.projectName)}</td></tr><tr><td>Material</td><td>${escapeHtml(result.material)}</td></tr><tr><td>Fecha</td><td>${formatDate(result.createdAt)}</td></tr><tr><td>Fotografías</td><td>${result.photoCount}</td></tr><tr><td>Confianza</td><td>${result.confidence} %</td></tr></table>
      <div class="grid"><div class="card"><span>Volumen estimado</span><strong>${formatNumber(result.volume)} m³</strong></div><div class="card"><span>Tonelaje estimado</span><strong>${formatNumber(result.tonnes)} t</strong></div><div class="card"><span>Rango probable</span><strong>${formatNumber(result.minVolume)} – ${formatNumber(result.maxVolume)} m³</strong></div><div class="card"><span>Densidad utilizada</span><strong>${formatNumber(result.density)} t/m³</strong></div></div>
      <div class="notice">Resultado experimental calculado con dimensiones manuales. No constituye una certificación topográfica, contractual ni metrológica.</div>
      <p style="margin-top:34px" class="muted">Innova Space Education SpA</p><script>window.onload=()=>window.print();<\/script></body></html>`);
    report.document.close();
  }

  function resetMeasurement() {
    $("#pileName").value = "";
    state.photos.forEach((photo) => { if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl); });
    state.photos = [];
    state.pendingResult = null;
    $("#resultPanel").hidden = true;
    $$(".coverage-check").forEach((check) => { check.checked = false; });
    $("#markerVisible").checked = false;
    renderPhotos();
    stopModelAnimation();
  }

  function bindCamera() {
    $("#startCamera")?.addEventListener("click", startCamera);
    $("#stopCamera")?.addEventListener("click", stopCamera);
    $("#capturePhoto")?.addEventListener("click", capturePhoto);
    $("#clearPhotos")?.addEventListener("click", clearPhotos);
    $("#photoUpload")?.addEventListener("change", (event) => {
      const files = [...event.target.files].filter((file) => file.type.startsWith("image/"));
      files.forEach((file) => state.photos.push({ name: file.name, objectUrl: URL.createObjectURL(file), source: "archivo" }));
      event.target.value = "";
      renderPhotos();
      showToast(`${files.length} fotografía${files.length === 1 ? "" : "s"} agregada${files.length === 1 ? "" : "s"}.`);
    });
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return showToast("Este navegador no permite usar la cámara. Sube fotografías desde el dispositivo.", true);
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      const video = $("#cameraPreview");
      video.srcObject = state.stream;
      $("#cameraPlaceholder").classList.add("hidden");
      $("#capturePhoto").disabled = false;
      $("#stopCamera").disabled = false;
      $("#startCamera").disabled = true;
    } catch (error) {
      console.warn(error);
      showToast("No se pudo abrir la cámara. Revisa el permiso o usa la carga de fotografías.", true);
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }
    const video = $("#cameraPreview");
    if (video) video.srcObject = null;
    $("#cameraPlaceholder")?.classList.remove("hidden");
    if ($("#capturePhoto")) $("#capturePhoto").disabled = true;
    if ($("#stopCamera")) $("#stopCamera").disabled = true;
    if ($("#startCamera")) $("#startCamera").disabled = false;
  }

  function capturePhoto() {
    const video = $("#cameraPreview");
    const canvas = $("#captureCanvas");
    if (!video?.videoWidth || !canvas) return showToast("La cámara aún no está lista.", true);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    state.photos.push({ name: `captura-${state.photos.length + 1}.jpg`, dataUrl: canvas.toDataURL("image/jpeg", .82), source: "cámara" });
    renderPhotos();
    showToast("Fotografía capturada.");
  }

  function clearPhotos() {
    state.photos.forEach((photo) => { if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl); });
    state.photos = [];
    renderPhotos();
    showToast("Capturas eliminadas.");
  }

  function renderPhotos() {
    const gallery = $("#photoGallery");
    if (!gallery) return;
    gallery.innerHTML = state.photos.map((photo, index) => `<div class="photo-thumb"><img src="${photo.dataUrl || photo.objectUrl}" alt="Captura ${index + 1}"><span>${index + 1} · ${escapeHtml(photo.source)}</span></div>`).join("");
    $("#photoCount").textContent = String(state.photos.length);
  }

  function bindHistory() {
    $("#historyTable")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-measurement]");
      if (!button) return;
      state.measurements = state.measurements.filter((item) => item.id !== button.dataset.deleteMeasurement);
      save(STORAGE_KEYS.measurements, state.measurements);
      renderAll();
      showToast("Medición eliminada.");
    });

    $("#exportData")?.addEventListener("click", () => {
      const payload = { exportedAt: new Date().toISOString(), application: "Innova Measure AI MVP", projects: state.projects, measurements: state.measurements };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `innova-measure-ai-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  function renderMeasurements() {
    const dashboardBody = $("#dashboardMeasurements");
    const historyBody = $("#historyTable");
    const recent = state.measurements.slice(0, 5);

    if (dashboardBody) dashboardBody.innerHTML = recent.map((item) => `<tr><td><strong>${escapeHtml(item.pileName)}</strong></td><td>${escapeHtml(item.projectName)}</td><td>${formatNumber(item.volume)} m³</td><td><span class="status-tag">${escapeHtml(item.status)}</span></td></tr>`).join("");
    if (historyBody) historyBody.innerHTML = state.measurements.map((item) => `<tr><td>${formatDate(item.createdAt)}</td><td>${escapeHtml(item.projectName)}</td><td><strong>${escapeHtml(item.pileName)}</strong></td><td>${escapeHtml(item.material)}</td><td>${formatNumber(item.volume)} m³</td><td>${formatNumber(item.tonnes)} t</td><td>${item.confidence} %</td><td><button class="table-action" type="button" data-delete-measurement="${escapeHtml(item.id)}" aria-label="Eliminar medición"><i class="ri-delete-bin-6-line"></i></button></td></tr>`).join("");

    $("#dashboardEmpty")?.classList.toggle("show", recent.length === 0);
    $("#historyEmpty")?.classList.toggle("show", state.measurements.length === 0);
  }

  function renderStats() {
    const totalVolume = state.measurements.reduce((sum, item) => sum + Number(item.volume || 0), 0);
    const totalTonnes = state.measurements.reduce((sum, item) => sum + Number(item.tonnes || 0), 0);
    $("#statProjects").textContent = String(state.projects.length);
    $("#statMeasurements").textContent = String(state.measurements.length);
    $("#statVolume").textContent = `${formatNumber(totalVolume)} m³`;
    $("#statTonnes").textContent = `${formatNumber(totalTonnes)} t`;
  }

  function renderAll() {
    renderStats();
    renderProjects();
    populateProjectSelect();
    renderMeasurements();
    renderPhotos();
  }

  function drawModel(result) {
    stopModelAnimation();
    const canvas = $("#modelCanvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    let rotation = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const points = createPilePoints(result.shape, 24, 15);

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const gradient = context.createRadialGradient(width * .5, height * .45, 10, width * .5, height * .45, width * .55);
      gradient.addColorStop(0, "rgba(53,226,255,.10)");
      gradient.addColorStop(1, "rgba(3,7,18,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const projected = points.map((point) => projectPoint(point, rotation, width, height));
      projected.sort((a, b) => a.depth - b.depth);
      context.strokeStyle = "rgba(77, 224, 255, .20)";
      context.lineWidth = 1;

      for (let row = 0; row < 15; row += 1) {
        context.beginPath();
        for (let col = 0; col < 24; col += 1) {
          const point = projected[row * 24 + col];
          if (col === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
        }
        context.stroke();
      }

      for (let col = 0; col < 24; col += 1) {
        context.beginPath();
        for (let row = 0; row < 15; row += 1) {
          const point = projected[row * 24 + col];
          if (row === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
        }
        context.stroke();
      }

      projected.forEach((point) => {
        const alpha = .32 + point.height * .58;
        context.fillStyle = `rgba(${90 + Math.round(point.height * 80)}, ${170 + Math.round(point.height * 70)}, 255, ${alpha})`;
        context.beginPath();
        context.arc(point.x, point.y, 1.2 + point.height * 1.7, 0, Math.PI * 2);
        context.fill();
      });

      rotation += .004;
      state.modelAnimation = requestAnimationFrame(render);
    };

    render();
    window.addEventListener("resize", resize, { once: true });
  }

  function createPilePoints(shape, columns, rows) {
    const points = [];
    for (let row = 0; row < rows; row += 1) {
      const v = row / (rows - 1);
      for (let col = 0; col < columns; col += 1) {
        const u = col / (columns - 1);
        const x = (u - .5) * 2.2;
        const z = (v - .5) * 1.45;
        const distance = Math.sqrt((x / 1.1) ** 2 + (z / .72) ** 2);
        let y;
        if (shape === "cone") y = Math.max(0, 1 - distance);
        else if (shape === "trapezoid") y = Math.max(0, 1 - distance * .78) * .86;
        else if (shape === "loose") y = Math.max(0, 1 - distance ** 1.7) * (.72 + Math.sin(u * 15) * .04 + Math.cos(v * 12) * .04);
        else y = Math.sqrt(Math.max(0, 1 - distance ** 2));
        points.push({ x, y, z });
      }
    }
    return points;
  }

  function projectPoint(point, rotation, width, height) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rx = point.x * cos - point.z * sin;
    const rz = point.x * sin + point.z * cos;
    const scale = Math.min(width, height) * .23;
    return { x: width * .5 + rx * scale, y: height * .70 - point.y * scale * 1.55 + rz * scale * .30, depth: rz, height: point.y };
  }

  function stopModelAnimation() {
    if (state.modelAnimation) {
      cancelAnimationFrame(state.modelAnimation);
      state.modelAnimation = null;
    }
  }

  function createSpaceBackground() {
    const canvas = $("#spaceCanvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    let stars = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.min(150, Math.floor(innerWidth / 8)) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, radius: Math.random() * 1.3 + .2, speed: Math.random() * .08 + .02, alpha: Math.random() * .6 + .18 }));
    };

    const animate = () => {
      context.clearRect(0, 0, innerWidth, innerHeight);
      stars.forEach((star) => {
        star.y += star.speed;
        if (star.y > innerHeight) star.y = 0;
        context.fillStyle = `rgba(185, 220, 255, ${star.alpha})`;
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fill();
      });
      requestAnimationFrame(animate);
    };

    resize();
    addEventListener("resize", resize);
    animate();
  }

  function showToast(message, error = false) {
    const toast = $("#toast");
    if (!toast) return;
    $("span", toast).textContent = message;
    const icon = $("i", toast);
    icon.className = error ? "ri-error-warning-fill" : "ri-checkbox-circle-fill";
    icon.style.color = error ? "var(--red)" : "var(--green)";
    toast.style.borderColor = error ? "rgba(255,107,130,.28)" : "rgba(66,232,161,.25)";
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function numberValue(selector) { return Number.parseFloat($(selector)?.value || "0"); }
  function formatNumber(value) { return new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  function formatDate(value) { return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function cryptoId() { return globalThis.crypto?.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
})();
