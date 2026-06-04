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
    projectForm: document.getElementById("projectForm"),
    projectId: document.getElementById("projectId"),
    tasksTableBody: document.getElementById("tasksTableBody"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    toast: document.getElementById("toast")
};

document.addEventListener("DOMContentLoaded", () => {
    elements.createProjectBtn.addEventListener("click", openCreateProjectModal);
    elements.refreshBtn.addEventListener("click", loadProjects);
    elements.addTaskBtn.addEventListener("click", () => addTaskRow());
    elements.projectForm.addEventListener("submit", saveProject);

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
    elements.projectForm.reset();
    elements.projectId.value = "";
    elements.tasksTableBody.innerHTML = "";
    addTaskRow();
    openModal("projectModal");
}

function openEditProjectModal(project) {
    elements.projectModalTitle.textContent = "Editar proyecto";
    elements.projectForm.reset();
    elements.tasksTableBody.innerHTML = "";

    elements.projectId.value = project.id;
    document.getElementById("nombre").value = project.nombre ?? "";
    document.getElementById("fechaInicio").value = toInputDate(project.fechaInicio);
    document.getElementById("fechaFin").value = toInputDate(project.fechaFin);
    document.getElementById("fechaCorte").value = toInputDate(project.fechaCorte);
    document.getElementById("valorGanadoEV").value = project.valorGanadoEV ?? 0;
    document.getElementById("costoRealAC").value = project.costoRealAC ?? 0;
    document.getElementById("presupuestoBAC").value = project.presupuestoBAC ?? 0;

    const tasks = project.tareas?.length ? project.tareas : [{}];
    tasks.forEach((task) => addTaskRow(task));

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
            <button type="button" class="danger-button">Quitar</button>
        </td>
    `;

    row.querySelector(".danger-button").addEventListener("click", () => {
        row.remove();
        renumberTasks();
    });

    elements.tasksTableBody.appendChild(row);
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
    return {
        nombre: document.getElementById("nombre").value.trim(),
        fechaInicio: document.getElementById("fechaInicio").value,
        fechaFin: document.getElementById("fechaFin").value,
        fechaCorte: document.getElementById("fechaCorte").value,
        valorGanadoEV: Number(document.getElementById("valorGanadoEV").value),
        costoRealAC: Number(document.getElementById("costoRealAC").value),
        presupuestoBAC: Number(document.getElementById("presupuestoBAC").value),
        tareas: Array.from(elements.tasksTableBody.querySelectorAll(".task-row")).map((row) => {
            const id = row.querySelector('[data-field="id"]').value;
            const tarea = {
                nombre: row.querySelector('[data-field="nombre"]').value.trim(),
                duracionDias: Number(row.querySelector('[data-field="duracionDias"]').value),
                predecesoras: row.querySelector('[data-field="predecesoras"]').value.trim(),
                costo: Number(row.querySelector('[data-field="costo"]').value),
                responsable: row.querySelector('[data-field="responsable"]').value.trim()
            };

            if (id) {
                tarea.id = id;
            }

            return tarea;
        })
    };
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

function formatDate(value) {
    if (!value) {
        return "";
    }

    return new Date(value).toLocaleDateString("es-CO");
}

function toInputDate(value) {
    if (!value) {
        return "";
    }

    return value.substring(0, 10);
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
