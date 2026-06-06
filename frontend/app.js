const API_URL = "http://localhost:5041/api/Proyectos";

const state = {
    projects: []
};

const elements = {
    projectsTableBody: document.getElementById("projectsTableBody"),
    projectCount: document.getElementById("projectCount"),
    createProjectBtn: document.getElementById("createProjectBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    projectModal: document.getElementById("projectModal"),
    projectModalTitle: document.getElementById("projectModalTitle"),
    projectModalSubtitle: document.getElementById("projectModalSubtitle"),
    projectForm: document.getElementById("projectForm"),
    projectId: document.getElementById("projectId"),
    tasksTableBody: document.getElementById("tasksTableBody"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    cutoffsTableBody: document.getElementById("cutoffsTableBody"),
    cutoffCount: document.getElementById("cutoffCount"),
    applyCutoffCountBtn: document.getElementById("applyCutoffCountBtn"),
    addCutoffBtn: document.getElementById("addCutoffBtn"),
    calculatedBAC: document.getElementById("calculatedBAC"),
    calculatedDuration: document.getElementById("calculatedDuration"),
    calculatedEndDate: document.getElementById("calculatedEndDate"),
    toast: document.getElementById("toast")
};

document.addEventListener("DOMContentLoaded", () => {
    elements.createProjectBtn.addEventListener("click", openCreateProjectModal);
    elements.refreshBtn.addEventListener("click", loadProjects);
    elements.addTaskBtn.addEventListener("click", () => addTaskRow());
    elements.addCutoffBtn.addEventListener("click", () => addCutoffRow());
    elements.applyCutoffCountBtn.addEventListener("click", applyCutoffCount);
    elements.projectForm.addEventListener("submit", saveProject);
    document.getElementById("fechaInicio").addEventListener("input", updateProjectSummary);
    document.getElementById("unidadTiempo").addEventListener("change", updateProjectSummary);

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
        button.addEventListener("click", () => closeModal(button.dataset.closeModal));
    });

    loadProjects();
});

async function loadProjects() {
    setTableMessage("Cargando proyectos...");

    try {
        const result = await requestJson(API_URL);
        state.projects = result.data ?? result;
        renderProjects();
    } catch (error) {
        setTableMessage("No se pudo cargar la lista de proyectos.");
        showToast(error.message);
    }
}

function renderProjects() {
    elements.projectsTableBody.innerHTML = "";
    elements.projectCount.textContent = `${state.projects.length} proyecto${state.projects.length === 1 ? "" : "s"}`;

    if (state.projects.length === 0) {
        setTableMessage("No hay proyectos registrados.");
        return;
    }

    state.projects.forEach((project) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="project-name">${escapeHtml(project.nombre)}</span></td>
            <td>${formatDateCell(project.fechaInicio)}</td>
            <td>${formatDateCell(project.fechaFin)}</td>
            <td>${formatDateCell(project.fechaCorte)}</td>
            <td>${formatMetricCell(project.presupuestoBAC, "bac")}</td>
            <td>${formatMetricCell(project.valorGanadoEV, "ev")}</td>
            <td>${formatMetricCell(project.costoRealAC, "ac")}</td>
            <td>
                <div class="actions">
                    <button class="action-button view-action" data-action="view" title="Ver proyecto" aria-label="Ver proyecto">
                        ${svgIcon("eye")}
                    </button>
                    <button class="action-button edit-action" data-action="edit" title="Editar proyecto" aria-label="Editar proyecto">
                        ${svgIcon("pencil")}
                    </button>
                    <button class="action-button delete-action" data-action="delete" title="Eliminar proyecto" aria-label="Eliminar proyecto">
                        ${svgIcon("trash")}
                    </button>
                </div>
            </td>
        `;

        row.querySelector('[data-action="view"]').addEventListener("click", () => {
            window.location.href = `detalle-proyecto.html?id=${project.id}`;
        });
        row.querySelector('[data-action="edit"]').addEventListener("click", () => openEditProjectModal(project));
        row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteProject(project));

        elements.projectsTableBody.appendChild(row);
    });
}

function openCreateProjectModal() {
    elements.projectModalTitle.textContent = "Crear proyecto";
    elements.projectModalSubtitle.textContent = "Completa la informacion para registrar un nuevo proyecto.";
    elements.projectForm.reset();
    elements.projectId.value = "";
    elements.tasksTableBody.innerHTML = "";
    elements.cutoffsTableBody.innerHTML = "";
    elements.cutoffCount.value = 1;
    addTaskRow();
    addCutoffRow();
    updateProjectSummary();
    openModal("projectModal");
}

function openEditProjectModal(project) {
    elements.projectModalTitle.textContent = "Editar proyecto";
    elements.projectModalSubtitle.textContent = "Actualiza la informacion del proyecto existente.";
    elements.projectForm.reset();
    elements.tasksTableBody.innerHTML = "";
    elements.cutoffsTableBody.innerHTML = "";

    elements.projectId.value = project.id;
    document.getElementById("nombre").value = project.nombre ?? "";
    document.getElementById("unidadTiempo").value = project.unidadTiempo ?? "Dias";
    document.getElementById("administradorProyecto").value = project.administradorProyecto ?? "";
    document.getElementById("asistenteProyecto").value = project.asistenteProyecto ?? "";
    document.getElementById("fechaInicio").value = toInputDate(project.fechaInicio);

    const tasks = project.tareas?.length ? sortTasksByOrder(project.tareas) : [{}];
    tasks.forEach((task) => addTaskRow(task));

    const cutoffs = project.cortes?.length
        ? project.cortes
        : [{
            fechaCorte: project.fechaCorte,
            valorGanadoEV: project.valorGanadoEV,
            costoRealAC: project.costoRealAC
        }];
    cutoffs.forEach((cutoff) => addCutoffRow(cutoff));
    elements.cutoffCount.value = elements.cutoffsTableBody.children.length;
    updateProjectSummary();

    openModal("projectModal");
}

function addTaskRow(task = {}) {
    const index = elements.tasksTableBody.children.length + 1;
    const row = document.createElement("tr");
    row.className = "task-row";

    row.innerHTML = `
        <td data-row-number>${index}</td>
        <td>
            <input type="hidden" data-field="id" value="${escapeAttribute(task.id ?? "")}">
            <input type="text" data-field="nombre" value="${escapeAttribute(task.nombre ?? "")}" required>
        </td>
        <td>
            <input type="number" data-field="duracionDias" min="1" step="1" value="${task.duracionDias ?? 1}" required>
        </td>
        <td>
            <input type="text" data-field="predecesoras" value="${escapeAttribute(task.predecesoras ?? "")}">
        </td>
        <td>
            <input type="number" data-field="costo" min="0" step="0.01" value="${task.costo ?? 0}" required>
        </td>
        <td>
            <input type="text" data-field="responsable" value="${escapeAttribute(task.responsable ?? "")}" required>
        </td>
        <td>
            <div class="row-actions">
            <button type="button" class="action-btn btn-move" data-action="move-up" aria-label="Subir tarea" title="Subir tarea">↑</button>
            <button type="button" class="action-btn btn-move" data-action="move-down" aria-label="Bajar tarea" title="Bajar tarea">↓</button>
            <button type="button" class="action-btn btn-delete danger-button delete-icon" title="Quitar" aria-label="Quitar">
                <img src="../Resources/iconbasura.png" alt="Eliminar">
            </button>
            </div>
        </td>
    `;

    row.querySelector('[data-action="move-up"]').addEventListener("click", () => {
        moveTaskRow(row, -1);
    });

    row.querySelector('[data-action="move-down"]').addEventListener("click", () => {
        moveTaskRow(row, 1);
    });

    row.querySelector(".danger-button").addEventListener("click", () => {
        row.remove();
        renumberTasks();
        updateProjectSummary();
    });

    row.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", updateProjectSummary);
    });

    elements.tasksTableBody.appendChild(row);
    updateProjectSummary();
}

function addCutoffRow(cutoff = {}) {
    const index = elements.cutoffsTableBody.children.length + 1;
    const row = document.createElement("tr");
    row.className = "cutoff-row";

    row.innerHTML = `
        <td data-row-number>${index}</td>
        <td>
            <input type="hidden" data-field="id" value="${escapeAttribute(cutoff.id ?? "")}">
            <input type="date" data-field="fechaCorte" value="${toInputDate(cutoff.fechaCorte)}" required>
        </td>
        <td>
            <input type="number" data-field="valorGanadoEV" min="0" step="0.01" value="${cutoff.valorGanadoEV ?? 0}" required>
        </td>
        <td>
            <input type="number" data-field="costoRealAC" min="0" step="0.01" value="${cutoff.costoRealAC ?? 0}" required>
        </td>
        <td>
            <button type="button" class="action-btn btn-delete danger-button delete-icon" title="Quitar" aria-label="Quitar">
                <img src="../Resources/iconbasura.png" alt="Eliminar">
            </button>
        </td>
    `;

    row.querySelector(".danger-button").addEventListener("click", () => {
        if (elements.cutoffsTableBody.children.length === 1) {
            showToast("Debe registrar al menos una fecha de corte.");
            return;
        }

        row.remove();
        renumberCutoffs();
        elements.cutoffCount.value = elements.cutoffsTableBody.children.length;
    });

    elements.cutoffsTableBody.appendChild(row);
    elements.cutoffCount.value = elements.cutoffsTableBody.children.length;
}

function applyCutoffCount() {
    const targetCount = Math.max(1, Number(elements.cutoffCount.value) || 1);

    while (elements.cutoffsTableBody.children.length < targetCount) {
        addCutoffRow();
    }

    while (elements.cutoffsTableBody.children.length > targetCount) {
        elements.cutoffsTableBody.lastElementChild.remove();
    }

    renumberCutoffs();
    elements.cutoffCount.value = targetCount;
}

async function saveProject(event) {
    event.preventDefault();

    const projectId = elements.projectId.value;
    const payload = buildProjectPayload();
    const url = projectId ? `${API_URL}/${projectId}` : API_URL;
    const method = projectId ? "PUT" : "POST";

    try {
        await requestJson(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        closeModal("projectModal");
        showToast("Proyecto guardado correctamente.");
        await loadProjects();
    } catch (error) {
        showToast(error.message);
    }
}

function buildProjectPayload() {
    const tareas = getTaskPayload();
    const cortes = getCutoffPayload();
    const summary = calculateProjectSummary(tareas);
    const compatibilityCutoff = getLastCutoff(cortes);

    return {
        nombre: document.getElementById("nombre").value.trim(),
        unidadTiempo: document.getElementById("unidadTiempo").value,
        administradorProyecto: document.getElementById("administradorProyecto").value.trim(),
        asistenteProyecto: document.getElementById("asistenteProyecto").value.trim(),
        fechaInicio: document.getElementById("fechaInicio").value,
        fechaFin: summary.fechaFin,
        fechaCorte: compatibilityCutoff?.fechaCorte ?? "",
        valorGanadoEV: compatibilityCutoff?.valorGanadoEV ?? 0,
        costoRealAC: compatibilityCutoff?.costoRealAC ?? 0,
        presupuestoBAC: summary.presupuestoBAC,
        tareas,
        cortes
    };
}

function getTaskPayload() {
    return Array.from(elements.tasksTableBody.querySelectorAll(".task-row")).map((row, index) => {
        const id = row.querySelector('[data-field="id"]').value;
        const tarea = {
            nombre: row.querySelector('[data-field="nombre"]').value.trim(),
            orden: index + 1,
            duracionDias: Number(row.querySelector('[data-field="duracionDias"]').value),
            predecesoras: row.querySelector('[data-field="predecesoras"]').value.trim(),
            costo: Number(row.querySelector('[data-field="costo"]').value),
            responsable: row.querySelector('[data-field="responsable"]').value.trim()
        };

        if (id) {
            tarea.id = id;
        }

        return tarea;
    });
}

function sortTasksByOrder(tasks) {
    return [...tasks].sort((left, right) => {
        const leftOrder = Number(left.orden) || Number.MAX_SAFE_INTEGER;
        const rightOrder = Number(right.orden) || Number.MAX_SAFE_INTEGER;

        return leftOrder - rightOrder;
    });
}

function getCutoffPayload() {
    return Array.from(elements.cutoffsTableBody.querySelectorAll(".cutoff-row")).map((row) => {
        const id = row.querySelector('[data-field="id"]').value;
        const cutoff = {
            fechaCorte: row.querySelector('[data-field="fechaCorte"]').value,
            valorGanadoEV: Number(row.querySelector('[data-field="valorGanadoEV"]').value),
            costoRealAC: Number(row.querySelector('[data-field="costoRealAC"]').value)
        };

        if (id) {
            cutoff.id = id;
        }

        return cutoff;
    });
}

function getLastCutoff(cortes) {
    return [...cortes]
        .filter((corte) => corte.fechaCorte)
        .sort((left, right) => left.fechaCorte.localeCompare(right.fechaCorte))
        .at(-1);
}

function calculateProjectSummary(tareas = getTaskPayload()) {
    const fechaInicio = document.getElementById("fechaInicio").value;
    const unidadTiempo = document.getElementById("unidadTiempo").value;
    const duracionTotal = tareas.reduce((total, tarea) => total + sanitizeNumber(tarea.duracionDias), 0);
    const presupuestoBAC = tareas.reduce((total, tarea) => total + sanitizeNumber(tarea.costo), 0);
    const fechaFin = calculateEndDate(fechaInicio, duracionTotal, unidadTiempo);

    return {
        presupuestoBAC,
        duracionTotal,
        fechaFin,
        unidadTiempo
    };
}

function updateProjectSummary() {
    const summary = calculateProjectSummary();

    elements.calculatedBAC.textContent = formatMoney(summary.presupuestoBAC);
    elements.calculatedDuration.textContent = formatDuration(summary.duracionTotal, summary.unidadTiempo);
    elements.calculatedEndDate.textContent = summary.fechaFin ? formatDate(summary.fechaFin) : "-";
}

function sanitizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function calculateEndDate(fechaInicio, duracionTotal, unidadTiempo) {
    if (!fechaInicio || duracionTotal <= 0) {
        return "";
    }

    const [year, month, day] = fechaInicio.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (unidadTiempo === "Semanas") {
        date.setDate(date.getDate() + (duracionTotal * 7));
    } else if (unidadTiempo === "Meses") {
        date.setMonth(date.getMonth() + duracionTotal);
    } else {
        date.setDate(date.getDate() + duracionTotal);
    }

    return toInputDateFromLocalDate(date);
}

function formatDuration(duracionTotal, unidadTiempo) {
    const labels = {
        Dias: duracionTotal === 1 ? "d\u00eda" : "d\u00edas",
        Semanas: duracionTotal === 1 ? "semana" : "semanas",
        Meses: duracionTotal === 1 ? "mes" : "meses"
    };

    return `${duracionTotal} ${labels[unidadTiempo] ?? labels.Dias}`;
}

async function deleteProject(project) {
    const confirmed = window.confirm(`¿Eliminar el proyecto "${project.nombre}"?`);

    if (!confirmed) {
        return;
    }

    try {
        await requestJson(`${API_URL}/${project.id}`, { method: "DELETE" });
        showToast("Proyecto eliminado correctamente.");
        await loadProjects();
    } catch (error) {
        showToast(error.message);
    }
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

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
}

function setTableMessage(message) {
    elements.projectsTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">${message}</td></tr>`;
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");
    window.setTimeout(() => elements.toast.classList.add("hidden"), 3500);
}

function renumberTasks() {
    elements.tasksTableBody.querySelectorAll(".task-row").forEach((row, index) => {
        row.querySelector("[data-row-number]").textContent = index + 1;
    });
}

function moveTaskRow(row, direction) {
    if (direction < 0 && row.previousElementSibling) {
        elements.tasksTableBody.insertBefore(row, row.previousElementSibling);
    }

    if (direction > 0 && row.nextElementSibling) {
        elements.tasksTableBody.insertBefore(row.nextElementSibling, row);
    }

    renumberTasks();
    updateProjectSummary();
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    const date = value.length === 10
        ? parseInputDate(value)
        : new Date(value);

    return date.toLocaleDateString("es-CO");
}

function renumberCutoffs() {
    elements.cutoffsTableBody.querySelectorAll(".cutoff-row").forEach((row, index) => {
        row.querySelector("[data-row-number]").textContent = index + 1;
    });
}

function toInputDate(value) {
    if (!value) {
        return "";
    }

    return value.substring(0, 10);
}

function toInputDateFromLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseInputDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
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

function formatDateCell(value) {
    return `
        <span class="date-value">
            ${svgIcon("calendar")}
            ${escapeHtml(formatDate(value))}
        </span>
    `;
}

function formatMetricCell(value, type) {
    return `
        <span class="metric-value metric-${type}">
            <span class="metric-dot" aria-hidden="true"></span>
            ${formatMoney(value)}
        </span>
    `;
}

function svgIcon(name) {
    const icons = {
        calendar: '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9.5h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z"></path></svg>',
        eye: '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path></svg>',
        pencil: '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"></path><path d="m14 6.5 3.5 3.5"></path></svg>',
        trash: '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M9 11v6M15 11v6M6.5 7l.8 12A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9l.8-12"></path></svg>'
    };

    return icons[name] ?? "";
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
