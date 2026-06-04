const API_URL = "http://localhost:5041/api/Proyectos";

const elements = {
    projectTitle: document.getElementById("projectTitle"),
    loadingMessage: document.getElementById("loadingMessage"),
    projectDetailContent: document.getElementById("projectDetailContent"),
    generalData: document.getElementById("generalData"),
    indicatorsGrid: document.getElementById("indicatorsGrid"),
    executiveSummary: document.getElementById("executiveSummary"),
    aiAnalysis: document.getElementById("aiAnalysis"),
    aiAnalysisPanel: document.getElementById("aiAnalysisPanel"),
    toggleAiAnalysisBtn: document.getElementById("toggleAiAnalysisBtn"),
    chartBacValue: document.getElementById("chartBacValue"),
    tasksBody: document.getElementById("tasksBody"),
    statusBadge: document.getElementById("statusBadge"),
    alertMessages: document.getElementById("alertMessages")
};

let chart = null;
let isAiAnalysisVisible = false;

document.addEventListener("DOMContentLoaded", () => {
    elements.toggleAiAnalysisBtn.addEventListener("click", toggleAiAnalysis);
    loadProjectDetail();
});

async function loadProjectDetail() {
    const projectId = new URLSearchParams(window.location.search).get("id");

    if (!projectId) {
        showError("No se recibio el identificador del proyecto.");
        return;
    }

    try {
        const [projectResult, indicatorsResult, baseAnalysisResult, aiResult, curveResult] = await Promise.all([
            requestJson(`${API_URL}/${projectId}`),
            requestJson(`${API_URL}/${projectId}/indicadores`),
            requestJson(`${API_URL}/${projectId}/analisis`),
            requestJson(`${API_URL}/${projectId}/analisis-ia`),
            requestJson(`${API_URL}/${projectId}/curva-s`)
        ]);

        renderProjectDetail(
            projectResult.data,
            indicatorsResult.data,
            baseAnalysisResult.data,
            aiResult.data,
            curveResult.data
        );
    } catch (error) {
        showError(error.message);
    }
}

function renderProjectDetail(project, indicators, baseAnalysis, aiAnalysis, curve) {
    elements.projectTitle.textContent = project.nombre ?? "Detalle del proyecto";
    elements.generalData.innerHTML = [
        buildDetailItem("Fecha inicio", formatDate(project.fechaInicio), "date"),
        buildDetailItem("Fecha fin", formatDate(project.fechaFin), "date"),
        buildDetailItem("Fecha corte", formatDate(project.fechaCorte), "date"),
        buildDetailItem("Valor ganado (EV)", formatMoney(project.valorGanadoEV), "ev"),
        buildDetailItem("Costo real (AC)", formatMoney(project.costoRealAC), "ac"),
        buildDetailItem("Presupuesto (BAC)", formatMoney(project.presupuestoBAC), "bac")
    ].join("");

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
        buildIndicatorCard("PV", pv, "money", `(→ ${pvPercent}% planificado)`),
        buildIndicatorCard("EV", ev, "money", `(→ ${evPercent}% completado)`),
        buildIndicatorCard("AC", ac, "money", "(AC actual)"),
        buildIndicatorCard("SPI", spi, "ratio", spiText),
        buildIndicatorCard("CPI", cpi, "ratio", cpiText),
        buildIndicatorCard("EAC", eac, "money", "(Costo estimado al terminar)"),
        buildIndicatorCard("VAC", vac, "money", vacText),
        buildIndicatorCard("TCPI", tcpi, "ratio", "(Rendimiento necesario)")
    ].join("");

    elements.executiveSummary.innerHTML = buildExecutiveSummary(baseAnalysis);
    elements.aiAnalysis.innerHTML = buildAiAnalysis(aiAnalysis?.analisisGenerado);
    elements.tasksBody.innerHTML = buildReadOnlyTasks(project.tareas ?? []);

    renderCurveSChart(curve, project.fechaCorte);

    updateStatusAlertsAndBadge(indicators.cpi, indicators.spi);

    elements.loadingMessage.classList.add("hidden");
    elements.projectDetailContent.classList.remove("hidden");
}

function buildExecutiveSummary(baseAnalysis) {
    if (!baseAnalysis) {
        return '<p class="summary-text">No se recibio resumen ejecutivo.</p>';
    }

    const recommendations = baseAnalysis.recomendaciones?.length
        ? `<ul class="summary-recommendations">${baseAnalysis.recomendaciones.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : '<p class="summary-text">No hay recomendaciones registradas.</p>';

    return `
        <div class="summary-status-grid">
            ${buildSummaryStatus("Cronograma", baseAnalysis.estadoCronograma)}
            ${buildSummaryStatus("Costo", baseAnalysis.estadoCosto)}
            ${buildSummaryStatus("Riesgo", baseAnalysis.nivelRiesgo)}
        </div>
        <p class="summary-text">${escapeHtml(baseAnalysis.resumen ?? "")}</p>
        <h3 class="summary-subtitle">Recomendaciones</h3>
        ${recommendations}
    `;
}

function buildSummaryStatus(label, value) {
    return `
        <div class="summary-status-card ${getStatusClass(value)}">
            <span class="summary-status-icon" aria-hidden="true">${getSummaryIcon(label)}</span>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value ?? "")}</strong>
        </div>
    `;
}

function toggleAiAnalysis() {
    isAiAnalysisVisible = !isAiAnalysisVisible;
    elements.aiAnalysisPanel.classList.toggle("expanded", isAiAnalysisVisible);
    elements.aiAnalysisPanel.setAttribute("aria-hidden", String(!isAiAnalysisVisible));
    elements.toggleAiAnalysisBtn.textContent = isAiAnalysisVisible ? "Ocultar análisis IA" : "Mostrar análisis IA";
}

function renderCurveSChart(curve, fechaCorte) {
    const canvas = document.getElementById("curvaSChart");
    const labels = curve.puntos.map((point) => formatDate(point.fecha));
    const fechaCorteFormatted = formatDate(fechaCorte);
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
                buildDataset("EV", curve.puntos.map((point) => point.ev), "#16a34a"),
                buildDataset("AC", curve.puntos.map((point) => point.ac), "#8b5cf6")
            ]
        },
        options: {
            layout: {
                padding: {
                    left: 20
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
                    annotations: {
                        lineCorte: {
                            type: 'line',
                            xMin: fechaCorteFormatted,
                            xMax: fechaCorteFormatted,
                            borderColor: 'red',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: '📌 Corte',
                                position: 'start',
                                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                                color: 'white',
                                font: {
                                    weight: 'bold'
                                }
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                        maxRotation: 0
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function buildDataset(label, data, color) {
    return {
        label,
        data,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2
    };
}

function buildDetailItem(label, value, type) {
    return `
        <div class="detail-item detail-${type}">
            <span class="detail-item-icon" aria-hidden="true">${getDetailIcon(type, label)}</span>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `;
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
            <span class="indicator-dot" aria-hidden="true"></span>
            <span>${escapeHtml(label)}</span>
            <strong>${formatIndicatorValue(value, type)}</strong>
            ${textHtml}
        </div>
    `;
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

    return tasks.map((task, index) => `
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

function buildAiAnalysis(markdownText) {
    const cleanText = cleanMarkdown(markdownText ?? "No se recibio analisis generado.");
    const sections = splitAnalysisSections(cleanText);

    return sections.map((section) => `
        <section class="ai-report-section">
            <h3>${escapeHtml(section.title)}</h3>
            ${renderAnalysisBlocks(section.blocks, section.title)}
        </section>
    `).join("");
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
    let current = { title: "Diagnostico general", blocks: [] };

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

    return sections.length ? sections : [{ title: "Diagnostico general", blocks: [buildAnalysisBlock(text)] }];
}

function getAnalysisTitle(line) {
    const normalizedLine = normalizeText(line.replace(/:$/, ""));
    const titles = [
        "Nombre del Proyecto",
        "Nombre del proyecto",
        "Diagnostico general",
        "Diagnostico",
        "Interpretacion",
        "Interpretacion SPI/CPI",
        "Interpretacion de SPI y CPI",
        "Riesgos principales",
        "Que corregir",
        "Como corregirlo",
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
        throw new Error(data?.message ?? "Ocurrio un error al comunicarse con la API.");
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
        "diagnostico general": "Diagnostico general",
        "diagnostico": "Diagnostico general",
        "interpretacion": "Interpretacion",
        "interpretacion spi/cpi": "Interpretacion de SPI y CPI",
        "interpretacion de spi y cpi": "Interpretacion de SPI y CPI",
        "riesgos principales": "Riesgos principales",
        "que corregir": "Que corregir",
        "como corregirlo": "Como corregirlo",
        "recomendaciones": "Recomendaciones"
    };

    return titles[normalized] ?? title;
}

function getDetailIcon(type, label) {
    if (label === "Fecha inicio" || label === "Fecha fin") return "📅";
    if (label === "Fecha corte") return "✂️";
    if (type === "ev") return "✅";
    if (type === "ac") return "💲";
    if (type === "bac") return "🎯";
    return "🔹";
}

function getSummaryIcon(label) {
    const icons = {
        Cronograma: "T",
        Costo: "$",
        Riesgo: "!"
    };

    return icons[label] ?? ".";
}

function getStatusClass(value) {
    const normalized = normalizeText(value);

    if (normalized.includes("alto") || normalized.includes("retras") || normalized.includes("sobre")) {
        return "status-risk";
    }

    if (normalized.includes("medio")) {
        return "status-warning";
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
