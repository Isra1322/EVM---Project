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
    tasksBody: document.getElementById("tasksBody")
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

    elements.indicatorsGrid.innerHTML = [
        buildIndicatorCard("BAC", indicators.bac, "money"),
        buildIndicatorCard("PV", indicators.pv, "money"),
        buildIndicatorCard("EV", indicators.ev, "money"),
        buildIndicatorCard("AC", indicators.ac, "money"),
        buildIndicatorCard("SPI", indicators.spi, "ratio"),
        buildIndicatorCard("CPI", indicators.cpi, "ratio"),
        buildIndicatorCard("EAC", indicators.eac, "money"),
        buildIndicatorCard("VAC", indicators.vac, "money"),
        buildIndicatorCard("TCPI", indicators.tcpi, "ratio")
    ].join("");

    elements.executiveSummary.innerHTML = buildExecutiveSummary(baseAnalysis);
    elements.aiAnalysis.innerHTML = buildAiAnalysis(aiAnalysis?.analisisGenerado);
    elements.tasksBody.innerHTML = buildReadOnlyTasks(project.tareas ?? []);

    renderCurveSChart(curve);

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
                buildDataset("EV", curve.puntos.map((point) => point.ev), "#16a34a"),
                buildDataset("AC", curve.puntos.map((point) => point.ac), "#8b5cf6")
            ]
        },
        options: {
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
            <span class="detail-item-icon" aria-hidden="true">${getDetailIcon(type)}</span>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `;
}

function buildIndicatorCard(label, value, type) {
    return `
        <div class="indicator-card">
            <span class="indicator-dot" aria-hidden="true"></span>
            <span>${escapeHtml(label)}</span>
            <strong>${formatIndicatorValue(value, type)}</strong>
        </div>
    `;
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

function formatMoney(value) {
    return Number(value ?? 0).toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatIndicatorValue(value, type) {
    if (type === "ratio") {
        return Number(value ?? 0).toLocaleString("es-CO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
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

function getDetailIcon(type) {
    const icons = {
        date: "D",
        ev: "E",
        ac: "A",
        bac: "B"
    };

    return icons[type] ?? ".";
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
