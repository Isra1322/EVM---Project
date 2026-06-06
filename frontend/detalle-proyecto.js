const API_URL = "http://localhost:5041/api/Proyectos";

const elements = {
    projectTitle: document.getElementById("projectTitle"),
    loadingMessage: document.getElementById("loadingMessage"),
    projectDetailContent: document.getElementById("projectDetailContent"),
    generalData: document.getElementById("generalData"),
    indicatorsGrid: document.getElementById("indicatorsGrid"),
    executiveSummary: document.getElementById("executiveSummary"),
    aiVisualSummary: document.getElementById("aiVisualSummary"),
    aiAnalysis: document.getElementById("aiAnalysis"),
    aiAnalysisPanel: document.getElementById("aiAnalysisPanel"),
    analysisViewSelect: document.getElementById("analysisViewSelect"),
    chartBacValue: document.getElementById("chartBacValue"),
    tasksBody: document.getElementById("tasksBody"),
    cutoffSelect: document.getElementById("cutoffSelect"),
    statusBadge: document.getElementById("statusBadge"),
    alertMessages: document.getElementById("alertMessages")
};

let chart = null;
let isAiAnalysisVisible = false;
let currentProjectId = null;
let loadedAiCorteId = null;
let latestIndicators = null;
let latestBaseAnalysis = null;
let latestAiProjectState = null;

const SUMMARY_VISUAL_STATE_CLASSES = [
    "status-ok",
    "status-warning",
    "status-risk",
    "riesgo-bajo",
    "riesgo-medio",
    "riesgo-alto",
    "estado-verde",
    "estado-amarillo",
    "estado-rojo",
    "verde",
    "amarillo",
    "rojo"
];

document.addEventListener("DOMContentLoaded", () => {
    elements.analysisViewSelect.addEventListener("change", handleAnalysisViewChange);
    elements.cutoffSelect.addEventListener("change", handleCutoffChange);
    loadProjectDetail();
});

async function loadProjectDetail() {
    const projectId = new URLSearchParams(window.location.search).get("id");

    if (!projectId) {
        showError("No se recibio el identificador del proyecto.");
        return;
    }

    currentProjectId = projectId;

    try {
        const [projectResult, indicatorsResult, baseAnalysisResult, curveResult] = await Promise.all([
            requestJson(`${API_URL}/${projectId}`),
            requestJson(`${API_URL}/${projectId}/indicadores`),
            requestJson(`${API_URL}/${projectId}/analisis`),
            requestJson(`${API_URL}/${projectId}/curva-s`)
        ]);

        renderProjectDetail(
            projectResult.data,
            indicatorsResult.data,
            baseAnalysisResult.data,
            curveResult.data
        );
    } catch (error) {
        showError(error.message);
    }
}

function renderProjectDetail(project, indicators, baseAnalysis, curve) {
    elements.projectTitle.textContent = project.nombre ?? "Detalle del proyecto";
    elements.generalData.innerHTML = [
        buildDetailItem("Unidad de tiempo", formatUnidadTiempo(project.unidadTiempo), "time"),
        buildDetailItem("Administrador del Proyecto", project.administradorProyecto ?? "", "manager"),
        buildDetailItem("Asistente del Proyecto", project.asistenteProyecto ?? "", "assistant"),
        buildDetailItem("Fecha inicio", formatDate(project.fechaInicio), "date"),
        buildDetailItem("Fecha fin", formatDate(project.fechaFin), "date"),
        buildDetailItem("Presupuesto (BAC)", formatMoney(project.presupuestoBAC), "bac")
    ].join("");

    renderCutoffOptions(project.cortes ?? [], indicators.corteId);
    renderIndicators(indicators);
    latestIndicators = indicators;
    latestBaseAnalysis = baseAnalysis;
    latestAiProjectState = null;
    elements.executiveSummary.innerHTML = buildExecutiveSummary(baseAnalysis, indicators);
    refreshExecutiveSummaryVisualState(baseAnalysis, indicators);
    elements.aiVisualSummary.innerHTML = buildAiVisualSummary(baseAnalysis, indicators);
    applyAnalysisStateClass();
    elements.aiAnalysis.innerHTML = '<p class="summary-text">Seleccione Análisis IA para generar el análisis del corte actual.</p>';
    elements.tasksBody.innerHTML = buildReadOnlyTasks(project.tareas ?? []);
    elements.analysisViewSelect.value = "summary";
    setAnalysisView("summary");

    renderCurveSChart(curve);

    elements.loadingMessage.classList.add("hidden");
    elements.projectDetailContent.classList.remove("hidden");
}

function renderIndicators(indicators) {
    const bac = indicators.bac;
    const pv = indicators.pv;
    const ev = indicators.ev;
    const ac = indicators.ac;
    const spi = indicators.spi;
    const cpi = indicators.cpi;
    const eac = indicators.eac;
    const vac = indicators.vac;
    const tcpi = indicators.tcpi;

    const pvPercent = bac > 0 ? ((pv / bac) * 100).toFixed(1) : 0;
    const evPercent = bac > 0 ? ((ev / bac) * 100).toFixed(1) : 0;
    const spiPercent = Math.abs(spi - 1) * 100;
    const cpiPercent = Math.abs(cpi - 1) * 100;
    const tcpiPercent = Math.abs(tcpi - 1) * 100;

    let spiText = spi > 1 ? `(Adelantado)` : spi === 1 ? `(Justo a tiempo)` : `(Atrasado)`;
    let cpiText = cpi > 1 ? `(Bajo presupuesto)` : cpi === 1 ? `(Justo en presupuesto)` : `(Sobrecosto)`;
    let vacText = vac > 0 ? `(Ahorro estimado)` : vac === 0 ? `(Proyectado justo)` : `(Pérdida proyectada)`;

    elements.indicatorsGrid.innerHTML = [
        buildIndicatorCard("BAC", bac, "money", "(Presupuesto total)"),
        buildIndicatorCard("PV", pv, "money", `(${pvPercent}% planificado)`),
        buildIndicatorCard("EV", ev, "money", `(${evPercent}% completado)`),
        buildIndicatorCard("AC", ac, "money", "(AC actual)"),
        buildIndicatorCard("SPI", spi, "ratio", spiText),
        buildIndicatorCard("CPI", cpi, "ratio", cpiText),
        buildIndicatorCard("EAC", eac, "money", "(Costo estimado al terminar)"),
        buildIndicatorCard("VAC", vac, "money", vacText),
        buildIndicatorCard("TCPI", tcpi, "ratio", "(Rendimiento necesario)")
    ].join("");

    updateStatusAlertsAndBadge(indicators.cpi, indicators.spi);
}

function renderCutoffOptions(cortes, selectedCorteId) {
    elements.cutoffSelect.innerHTML = cortes
        .map((corte, index) => `
            <option value="${escapeAttribute(corte.id)}" ${corte.id === selectedCorteId ? "selected" : ""}>
                Corte ${index + 1} - ${escapeHtml(formatDate(corte.fechaCorte))}
            </option>
        `)
        .join("");
}

async function handleCutoffChange() {
    const corteId = elements.cutoffSelect.value;

    if (!currentProjectId || !corteId) {
        return;
    }

    try {
        const encodedCorteId = encodeURIComponent(corteId);
        loadedAiCorteId = null;
        latestAiProjectState = null;
        const [indicatorsResult, baseAnalysisResult] = await Promise.all([
            requestJson(`${API_URL}/${currentProjectId}/indicadores?corteId=${encodedCorteId}`),
            requestJson(`${API_URL}/${currentProjectId}/analisis?corteId=${encodedCorteId}`)
        ]);

        renderIndicators(indicatorsResult.data);
        latestIndicators = indicatorsResult.data;
        latestBaseAnalysis = baseAnalysisResult.data;
        elements.executiveSummary.innerHTML = buildExecutiveSummary(baseAnalysisResult.data, indicatorsResult.data);
        refreshExecutiveSummaryVisualState(baseAnalysisResult.data, indicatorsResult.data);
        elements.aiVisualSummary.innerHTML = buildAiVisualSummary(baseAnalysisResult.data, indicatorsResult.data);
        applyAnalysisStateClass();

        if (isAiAnalysisVisible) {
            await loadAiAnalysisForSelectedCutoff();
        }
    } catch (error) {
        showError(error.message);
    }
}

function buildExecutiveSummary(baseAnalysis, indicators = latestIndicators) {
    if (!baseAnalysis) {
        return '<p class="summary-text">No se recibio resumen ejecutivo.</p>';
    }

    const performance = getPerformanceMetric(indicators);
    const projectState = getProjectState(baseAnalysis, performance.statusClass);
    const recommendations = baseAnalysis.recomendaciones?.length
        ? `<ul class="summary-recommendations">${baseAnalysis.recomendaciones.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : '<p class="summary-text">No hay recomendaciones registradas.</p>';

    return `
        <div class="summary-layout">
            ${buildSummaryStatus("Cronograma", baseAnalysis.estadoCronograma, "Estado del avance frente al plan.", "calendar")}
            ${buildSummaryStatus("Costo", baseAnalysis.estadoCosto, "Situación financiera del corte actual.", "cost")}
            ${buildSummaryStatus("Riesgo", baseAnalysis.nivelRiesgo, "Nivel de exposición del proyecto.", "risk")}
            ${buildSummaryStatus("Rendimiento", performance.value, performance.description, "performance", performance.statusClass)}
            <div class="summary-recommendations-panel ${projectState.statusClass}" data-summary-state="${escapeAttribute(projectState.statusClass)}">
                <p class="summary-text">${escapeHtml(baseAnalysis.resumen ?? "")}</p>
                <h3 class="summary-subtitle">Recomendaciones</h3>
                ${recommendations}
            </div>
        </div>
    `;
}

function buildSummaryStatus(label, value, description, icon, statusClass = getStatusClass(value)) {
    return `
        <div class="summary-status-card ${statusClass}" data-summary-status="${escapeAttribute(statusClass)}">
            <span class="summary-status-icon summary-icon-${escapeAttribute(icon)}" aria-hidden="true">${getSummaryIcon(label)}</span>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value ?? "")}</strong>
            <small>${escapeHtml(description ?? "")}</small>
        </div>
    `;
}

function refreshExecutiveSummaryVisualState(baseAnalysis = latestBaseAnalysis, indicators = latestIndicators) {
    if (!elements.executiveSummary || !baseAnalysis) {
        return;
    }

    const performance = getPerformanceMetric(indicators);
    const projectState = getProjectState(baseAnalysis, performance.statusClass);
    const statusClasses = [
        getStatusClass(baseAnalysis.estadoCronograma),
        getStatusClass(baseAnalysis.estadoCosto),
        getStatusClass(baseAnalysis.nivelRiesgo),
        performance.statusClass
    ];

    elements.executiveSummary
        .querySelectorAll(".summary-status-card")
        .forEach((card, index) => {
            clearVisualStateClasses(card);
            card.classList.add(statusClasses[index] ?? card.dataset.summaryStatus ?? "status-warning");
        });

    elements.executiveSummary
        .querySelectorAll(".summary-recommendations-panel")
        .forEach((panel) => {
            clearVisualStateClasses(panel);
            panel.classList.add(projectState.statusClass);
            panel.dataset.summaryState = projectState.statusClass;
        });
}

function clearVisualStateClasses(element) {
    element.classList.remove(...SUMMARY_VISUAL_STATE_CLASSES);
}

function getPerformanceMetric(indicators) {
    const tcpi = Number(indicators?.tcpi);
    const cpi = Number(indicators?.cpi);
    const useTcpi = Number.isFinite(tcpi) && tcpi > 0;
    const metricName = useTcpi ? "TCPI" : "CPI";
    const value = useTcpi ? tcpi : cpi;
    const formattedValue = Number.isFinite(value) ? `${metricName} ${formatStandardNumber(value)}` : "Sin datos";

    return {
        value: formattedValue,
        description: useTcpi ? "Rendimiento necesario para finalizar." : "Eficiencia de costo del corte actual.",
        statusClass: getPerformanceStatusClass(value)
    };
}

function getPerformanceStatusClass(value) {
    if (!Number.isFinite(value)) {
        return "status-warning";
    }

    if (value < 0.95) {
        return "status-risk";
    }

    if (value <= 1.04) {
        return "status-warning";
    }

    return "status-ok";
}

function buildAiVisualSummary(baseAnalysis = latestBaseAnalysis, indicators = latestIndicators) {
    if (!baseAnalysis) {
        return '<p class="summary-text">No se recibio resumen ejecutivo.</p>';
    }

    const performance = getPerformanceMetric(indicators);
    const projectState = getProjectState(baseAnalysis, performance.statusClass);

    return `
        <div class="ai-visual-heading ${projectState.statusClass}">
            <span>Estado del proyecto</span>
            <strong class="${projectState.statusClass}">${escapeHtml(projectState.value)}</strong>
        </div>
        <div class="ai-visual-card-grid">
            ${buildAiVisualCard("Cronograma", baseAnalysis.estadoCronograma, "calendar", getStatusClass(baseAnalysis.estadoCronograma))}
            ${buildAiVisualCard("Costos", baseAnalysis.estadoCosto, "cost", getStatusClass(baseAnalysis.estadoCosto))}
            ${buildAiVisualCard("Riesgo", baseAnalysis.nivelRiesgo, "risk", getStatusClass(baseAnalysis.nivelRiesgo))}
            ${buildAiVisualCard("Rendimiento", performance.value, "performance", performance.statusClass)}
        </div>
    `;
}

function buildAiVisualCard(label, value, icon, statusClass) {
    return `
        <article class="ai-visual-card ${statusClass}">
            <span class="ai-visual-card-icon summary-icon-${escapeAttribute(icon)}" aria-hidden="true">${getSummaryIcon(label === "Costos" ? "Costo" : label)}</span>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value ?? "")}</strong>
        </article>
    `;
}

function getProjectState(baseAnalysis, performanceStatusClass) {
    if (latestAiProjectState) {
        return latestAiProjectState;
    }

    const statusClasses = [
        getStatusClass(baseAnalysis.estadoCronograma),
        getStatusClass(baseAnalysis.estadoCosto),
        getStatusClass(baseAnalysis.nivelRiesgo),
        performanceStatusClass
    ];

    if (statusClasses.includes("status-risk")) {
        return { value: "Crítico", statusClass: "status-risk" };
    }

    if (statusClasses.includes("status-warning")) {
        return { value: "En atención", statusClass: "status-warning" };
    }

    return { value: "Estable", statusClass: "status-ok" };
}

async function handleAnalysisViewChange() {
    const selectedView = elements.analysisViewSelect.value;
    setAnalysisView(selectedView);

    if (selectedView === "ai" && loadedAiCorteId !== elements.cutoffSelect.value) {
        await loadAiAnalysisForSelectedCutoff();
    }
}

function setAnalysisView(view) {
    isAiAnalysisVisible = view === "ai";
    elements.executiveSummary.classList.toggle("hidden", isAiAnalysisVisible);
    elements.aiAnalysisPanel.classList.toggle("expanded", isAiAnalysisVisible);
    elements.aiAnalysisPanel.setAttribute("aria-hidden", String(!isAiAnalysisVisible));
    refreshExecutiveSummaryVisualState();
    applyAnalysisStateClass();
}

function applyAnalysisStateClass() {
    elements.aiAnalysisPanel.classList.remove("status-ok", "status-warning", "status-risk");

    if (!latestBaseAnalysis) {
        return;
    }

    const performance = getPerformanceMetric(latestIndicators);
    const projectState = getProjectState(latestBaseAnalysis, performance.statusClass);
    elements.aiAnalysisPanel.classList.add(projectState.statusClass);
}

async function loadAiAnalysisForSelectedCutoff() {
    const corteId = elements.cutoffSelect.value;

    if (!currentProjectId || !corteId) {
        elements.aiAnalysis.innerHTML = '<p class="summary-text">No hay fecha de corte seleccionada para generar el análisis IA.</p>';
        return;
    }

    elements.aiAnalysis.innerHTML = '<p class="summary-text">Generando análisis IA...</p>';

    try {
        const aiResult = await requestJson(buildAiAnalysisUrl(currentProjectId, corteId));
        const generatedAnalysis = aiResult.data?.analisisGenerado;
        latestAiProjectState = extractAiProjectState(generatedAnalysis);
        if (latestBaseAnalysis) {
            elements.executiveSummary.innerHTML = buildExecutiveSummary(latestBaseAnalysis, latestIndicators);
            refreshExecutiveSummaryVisualState(latestBaseAnalysis, latestIndicators);
        }
        elements.aiVisualSummary.innerHTML = buildAiVisualSummary();
        applyAnalysisStateClass();
        elements.aiAnalysis.innerHTML = buildAiAnalysis(generatedAnalysis);
        loadedAiCorteId = corteId;
    } catch (error) {
        elements.aiAnalysis.innerHTML = `<p class="summary-text">${escapeHtml(error.message)}</p>`;
    }
}

function buildAiAnalysisUrl(projectId, corteId) {
    return `${API_URL}/${projectId}/analisis-ia?corteId=${encodeURIComponent(corteId)}`;
}

function renderCurveSChart(curve) {
    const canvas = document.getElementById("curvaSChart");
    const labels = curve.puntos.map((point) => formatDate(point.fecha));
    elements.chartBacValue.textContent = `BAC: ${formatMoney(curve.bac)}`;

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [
                buildDataset("PV", curve.puntos.map((point) => point.pv), "#1e40af"),
                buildDataset("EV", buildCutoffSeries(labels, curve.cortes ?? [], "ev"), "#16a34a", true),
                buildDataset("AC", buildCutoffSeries(labels, curve.cortes ?? [], "ac"), "#8b5cf6", true)
            ]
        },
        options: {
            layout: {
                padding: {
                    left: 12,
                    right: 10,
                    top: 8,
                    bottom: 4
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                annotation: {
                    annotations: buildCutoffAnnotations(curve.cortes ?? [])
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(148, 163, 184, 0.16)"
                    },
                    border: {
                        color: "rgba(148, 163, 184, 0.22)"
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                        maxRotation: 0,
                        color: "#5B677A",
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "rgba(148, 163, 184, 0.16)"
                    },
                    border: {
                        color: "rgba(148, 163, 184, 0.22)"
                    },
                    ticks: {
                        color: "#5B677A",
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function buildCutoffSeries(labels, cortes, field) {
    const valuesByDate = new Map(
        cortes.map((corte) => [
            formatDate(corte.fechaCorte),
            field === "ev" ? corte.ev : corte.ac
        ])
    );

    return labels.map((label) => valuesByDate.has(label) ? valuesByDate.get(label) : null);
}

function buildCutoffAnnotations(cortes) {
    return cortes.reduce((annotations, corte, index) => {
        annotations[`lineCorte${index}`] = {
            type: "line",
            xMin: formatDate(corte.fechaCorte),
            xMax: formatDate(corte.fechaCorte),
            borderColor: "#fb253f",
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                display: true,
                content: `Corte ${index + 1}`,
                position: "start",
                backgroundColor: "#DC2626",
                color: "#ffffff",
                font: {
                    weight: "bold"
                }
            }
        };

        return annotations;
    }, {});
}
function buildDataset(label, data, color, spanGaps = false) {
    return {
        label,
        data,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 2,
        spanGaps,
        tension: 0.2
    };
}

function buildDetailItem(label, value, type) {
    const secondaryText = getDetailSecondaryText(type, label);

    return `
        <div class="detail-item detail-${type}">
            <span class="detail-item-icon" aria-hidden="true">${getDetailIcon(type, label)}</span>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(secondaryText)}</small>
        </div>
    `;
}

function getDetailSecondaryText(type, label) {
    if (type === "time") return "Escala del cronograma";
    if (type === "manager") return "Responsable principal";
    if (type === "assistant") return "Apoyo del proyecto";
    if (type === "date" && label === "Fecha inicio") return "Inicio planificado";
    if (type === "date" && label === "Fecha fin") return "Finalización prevista";
    if (type === "bac") return "Presupuesto aprobado";
    return "";
}

function getIndicatorColorClass(label, value) {
    if (label !== "SPI" && label !== "CPI" && label !== "VAC") return "";
    
    if (label === "SPI" || label === "CPI") {
        if (value < 0.95) return "rojo";
        if (value >= 0.95 && value <= 1.04) return "amarillo";
        if (value >= 1.05) return "verde";
    } else if (label === "VAC") {
        if (value < 0) return "rojo";
        if (value === 0) return "amarillo";
        if (value > 0) return "verde";
    }
    return "";
}

function buildIndicatorCard(label, value, type, text = "") {
    const colorClass = getIndicatorColorClass(label, value);
    const textHtml = text ? `<div class="indicator-desc ${colorClass}">${text}</div>` : "";
    return `
        <div class="indicator-card ${colorClass}">
            <span class="indicator-icon indicator-${label.toLowerCase()}" aria-hidden="true">${getIndicatorIcon(label)}</span>
            <span>${escapeHtml(label)}</span>
            <strong>${formatIndicatorValue(value, type)}</strong>
            ${textHtml}
        </div>
    `;
}

function getIndicatorIcon(label) {
    const icons = {
        BAC: "$",
        PV: "P",
        EV: "E",
        AC: "A",
        SPI: "S",
        CPI: "C",
        EAC: "E",
        VAC: "V",
        TCPI: "T"
    };

    return icons[label] ?? "i";
}

function updateStatusAlertsAndBadge(cpi, spi) {
    let alertHtml = "";
    let isCostOverrun = false;
    let isDelayed = false;

    if (cpi < 0.95) {
        alertHtml += `<div class="alert-message rojo">⚠️ ALERTA: Sobrecosto - estás gastando más de lo planeado</div>`;
        isCostOverrun = true;
    }
    if (spi < 0.95) {
        alertHtml += `<div class="alert-message rojo">⚠️ ALERTA: Atraso - vas más lento de lo planeado</div>`;
        isDelayed = true;
    }

    if (cpi >= 0.95 && spi >= 0.95) {
        alertHtml = `<div class="alert-message verde">✅ Todo en orden</div>`;
    }

    elements.alertMessages.innerHTML = alertHtml;

    if (elements.statusBadge) {
        elements.statusBadge.classList.remove("hidden", "verde", "amarillo", "rojo");

        if (isCostOverrun && isDelayed) {
            elements.statusBadge.textContent = "Sobrecosto y Atrasado";
            elements.statusBadge.classList.add("rojo");
        } else if (isCostOverrun) {
            elements.statusBadge.textContent = "Sobrecosto";
            elements.statusBadge.classList.add("rojo");
        } else if (isDelayed) {
            elements.statusBadge.textContent = "Atrasado";
            elements.statusBadge.classList.add("rojo");
        } else if (cpi >= 1.05 || spi >= 1.05) {
            elements.statusBadge.textContent = "Adelantado";
            elements.statusBadge.classList.add("verde");
        } else {
            elements.statusBadge.textContent = "En línea";
            elements.statusBadge.classList.add("verde");
        }
    }
}

function buildReadOnlyTasks(tasks) {
    if (tasks.length === 0) {
        return '<tr><td colspan="6" class="empty-state">No hay tareas EDT registradas.</td></tr>';
    }

    return sortTasksByOrder(tasks).map((task, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(task.nombre)}</td>
            <td>${escapeHtml(task.duracionDias)}</td>
            <td>${escapeHtml(task.predecesoras)}</td>
            <td>${formatMoney(task.costo)}</td>
            <td>${escapeHtml(task.responsable)}</td>
        </tr>
    `).join("");
}

function sortTasksByOrder(tasks) {
    return [...tasks].sort((left, right) => {
        const leftOrder = Number(left.orden) || Number.MAX_SAFE_INTEGER;
        const rightOrder = Number(right.orden) || Number.MAX_SAFE_INTEGER;

        return leftOrder - rightOrder;
    });
}

function buildAiAnalysis(markdownText) {
    const cleanText = cleanMarkdown(markdownText ?? "No se recibió análisis generado.");
    const sections = splitAnalysisSections(cleanText);

    return sections.map((section) => `
        <section class="ai-report-section">
            <h3><span aria-hidden="true">${getAiSectionIcon(section.title)}</span>${escapeHtml(section.title)}</h3>
            ${renderAnalysisBlocks(section.blocks, section.title)}
        </section>
    `).join("");
}

function extractAiProjectState(markdownText) {
    const cleanText = cleanMarkdown(markdownText ?? "");
    const stateMatch = cleanText.match(/estado\s+del\s+proyecto\s*:?\s*(verde|amarillo|rojo)/i);

    if (!stateMatch) {
        return null;
    }

    const state = normalizeText(stateMatch[1]);
    const states = {
        verde: { value: "Riesgo Bajo", statusClass: "status-ok" },
        amarillo: { value: "Riesgo Medio", statusClass: "status-warning" },
        rojo: { value: "Crítico", statusClass: "status-risk" }
    };

    return states[state] ?? null;
}

function getAiSectionIcon(title) {
    const normalized = normalizeText(title);

    if (normalized.includes("diagnostico")) return "D";
    if (normalized.includes("interpretacion")) return "I";
    if (normalized.includes("desviacion") || normalized.includes("riesgo")) return "!";
    if (normalized.includes("recomendacion") || normalized.includes("corregir")) return "R";
    return "A";
}

function renderAnalysisBlocks(blocks, sectionTitle) {
    let html = "";
    let listItems = [];

    blocks.forEach((block) => {
        if (block.type === "paragraph" && shouldListSection(sectionTitle)) {
            const items = splitListLikeText(block.text);

            if (items.length > 1) {
                listItems.push(...items);
                return;
            }
        }

        if (block.type === "list") {
            listItems.push(block.text);
            return;
        }

        if (listItems.length) {
            html += `<ul class="ai-report-list">${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
            listItems = [];
        }

        if (block.type === "heading") {
            html += `<h4>${escapeHtml(block.text)}</h4>`;
            return;
        }

        html += `<p>${escapeHtml(block.text)}</p>`;
    });

    if (listItems.length) {
        html += `<ul class="ai-report-list">${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }

    return html;
}

function shouldListSection(title) {
    const normalized = normalizeText(title);
    return normalized.includes("riesgos") || normalized.includes("que corregir") || normalized.includes("como corregirlo") || normalized.includes("recomendaciones");
}

function splitListLikeText(text) {
    return text
        .split(/\s*;\s*|\s+-\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function splitAnalysisSections(text) {
    const lines = text
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    const sections = [];
    let current = { title: "Diagnóstico general", blocks: [] };

    lines.forEach((line) => {
        const sectionTitle = getAnalysisTitle(line);

        if (sectionTitle) {
            if (current.blocks.length) {
                sections.push(current);
            }

            current = { title: sectionTitle.title, blocks: [] };

            if (sectionTitle.rest) {
                current.blocks.push(buildAnalysisBlock(sectionTitle.rest));
            }

            return;
        }

        current.blocks.push(buildAnalysisBlock(line));
    });

    if (current.blocks.length) {
        sections.push(current);
    }

    return sections.length ? sections : [{ title: "Diagnóstico general", blocks: [buildAnalysisBlock(text)] }];
}

function getAnalysisTitle(line) {
    const normalizedLine = normalizeText(line.replace(/:$/, ""));
    const titles = [
        "Nombre del Proyecto",
        "Nombre del proyecto",
        "Diagnóstico general",
        "Diagnóstico",
        "Interpretación",
        "Interpretación SPI/CPI",
        "Interpretación de SPI y CPI",
        "Riesgos principales",
        "Qué corregir",
        "Cómo corregirlo",
        "Recomendaciones"
    ];
    const exactTitle = titles.find((title) => normalizedLine === normalizeText(title));

    if (exactTitle) {
        return { title: normalizeSectionTitle(exactTitle), rest: "" };
    }

    const inlineTitle = titles.find((title) => normalizedLine.startsWith(`${normalizeText(title)}:`));

    if (!inlineTitle) {
        return null;
    }

    return {
        title: normalizeSectionTitle(inlineTitle),
        rest: line.slice(line.indexOf(":") + 1).trim()
    };
}

function buildAnalysisBlock(line) {
    const trimmed = line.trim();
    const cleaned = trimmed.replace(/^\s*-\s+/, "").trim();
    const heading = getAnalysisTitle(cleaned);

    if (trimmed.startsWith("-")) {
        return { type: "list", text: cleaned };
    }

    if (heading && !heading.rest) {
        return { type: "heading", text: heading.title };
    }

    return { type: "paragraph", text: cleaned };
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok || data?.success === false) {
        throw new Error(data?.message ?? "Ocurrió un error al comunicarse con la API.");
    }

    return data;
}

function showError(message) {
    elements.loadingMessage.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    return new Date(value).toLocaleDateString("es-CO");
}

function formatStandardNumber(value) {
    return Number(value ?? 0).toLocaleString("en-US", {
        useGrouping: false,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatMoney(value) {
    return formatStandardNumber(value);
}

function formatIndicatorValue(value, type) {
    if (type === "ratio") {
        return formatStandardNumber(value);
    }

    return formatMoney(value);
}

function formatUnidadTiempo(value) {
    const labels = {
        Dias: "D\u00edas",
        Semanas: "Semanas",
        Meses: "Meses"
    };

    return labels[value] ?? value ?? "";
}

function cleanMarkdown(value) {
    return String(value ?? "")
        .replace(/^\s*#{1,6}\s*/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/^\s*\d+\.\s+/gm, "- ")
        .replace(/^\s*[*]\s+/gm, "- ")
        .replace(/\*/g, "")
        .replace(/`/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function normalizeSectionTitle(title) {
    const normalized = normalizeText(title);
    const titles = {
        "nombre del proyecto": "Nombre del Proyecto",
        "diagnostico general": "Diagnóstico general",
        "diagnostico": "Diagnóstico general",
        "interpretacion": "Interpretación",
        "interpretacion spi/cpi": "Interpretación de SPI y CPI",
        "interpretacion de spi y cpi": "Interpretación de SPI y CPI",
        "riesgos principales": "Riesgos principales",
        "que corregir": "Qué corregir",
        "como corregirlo": "Cómo corregirlo",
        "recomendaciones": "Recomendaciones"
    };

    return titles[normalized] ?? title;
}

function getDetailIcon(type, label) {
    if (label === "Fecha inicio" || label === "Fecha fin") return "📅";
    if (label === "Fecha corte") return "✂️";
    if (type === "time") return "🕒";
    if (type === "manager") return "👤";
    if (type === "assistant") return "👥";
    if (type === "ev") return "✅";
    if (type === "ac") return "💲";
    if (type === "bac") return "🎯";
    return "🔹";
}

function getSummaryIcon(label) {
    const icons = {
        Cronograma: "T",
        Costo: "$",
        Riesgo: "!",
        Rendimiento: "%"
    };

    return icons[label] ?? ".";
}

function getStatusClass(value) {
    const normalized = normalizeText(value);

    if (
        normalized.includes("alto") ||
        normalized.includes("critico") ||
        normalized.includes("retras") ||
        normalized.includes("sobre presupuesto") ||
        normalized.includes("sobrecosto")
    ) {
        return "status-risk";
    }

    if (normalized.includes("medio") || normalized.includes("moderado")) {
        return "status-warning";
    }

    if (
        normalized.includes("bajo") ||
        normalized.includes("adelantado") ||
        normalized.includes("bajo presupuesto") ||
        normalized.includes("ahorro")
    ) {
        return "status-ok";
    }

    return "status-ok";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
}
