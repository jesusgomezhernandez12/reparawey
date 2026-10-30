import { supabase } from "./supabase.js";

const state = {
  clients: [],
  devices: [],
  repairs: [],
  parts: [],
  tools: [],
  brokenParts: {},
  usedParts: {},
  usedTools: {},
  additionalCosts: {},
};

const $ = (id) => document.getElementById(id);
const views = ["dashboard", "clients", "devices", "repairs", "parts", "tools"];

function init() {
  setupNavigation();
  setupGlobalListeners();
  renderAll();
  seedSampleData();
}

function setupNavigation() {
  document.querySelectorAll("[data-view]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = e.currentTarget.dataset.view;
      switchView(view);
    });
  });

  $("btn-add-client").addEventListener("click", () => openModal("client"));
  $("btn-add-device").addEventListener("click", () => openModal("device"));
  $("btn-add-repair").addEventListener("click", () => openModal("repair"));
  $("btn-add-part").addEventListener("click", () => openModal("part"));
  $("btn-add-tool").addEventListener("click", () => openModal("tool"));
}

function setupGlobalListeners() {
  $("modal-close").addEventListener("click", closeModal);
  $("modal-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("modal-overlay").classList.contains("active")) {
      closeModal();
    }
  });
}

function switchView(viewName) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewName);
  });
  views.forEach((v) => {
    $(`view-${v}`).classList.toggle("active", v === viewName);
  });
}

function openModal(type, data) {
  const title = {
    client: data && data.id ? "Editar Cliente" : "Nuevo Cliente",
    device: data && data.id ? "Editar Dispositivo" : "Nuevo Dispositivo",
    repair: data && data.id ? "Editar Reparación" : "Nueva Reparación",
    part: data && data.id ? "Editar Pieza" : "Nueva Pieza",
    tool: data && data.id ? "Editar Implemento" : "Nuevo Implemento",
  };
  $("modal-title").textContent = title[type] || "";
  $("modal-body").innerHTML = "";
  const form = buildForm(type, data);
  $("modal-body").appendChild(form);
  if (type === "repair") setupRepairForm(form, data);
  $("modal-overlay").classList.add("active");
}

function closeModal() {
  $("modal-overlay").classList.remove("active");
}

/* ===== Form Builders ===== */

function buildForm(type, data) {
  const form = document.createElement("form");
  form.className = "modal-form";
  form.dataset.type = type;
  data = data || {};
  if (data.id) form.dataset.id = data.id;

  switch (type) {
    case "client":
      form.innerHTML = clientFormHTML(data);
      break;
    case "device":
      form.innerHTML = deviceFormHTML(data);
      break;
    case "repair":
      form.innerHTML = repairFormHTML(data);
      break;
    case "part":
      form.innerHTML = partFormHTML(data);
      break;
    case "tool":
      form.innerHTML = toolFormHTML(data);
      break;
  }

  form.innerHTML += `
    <div class="form-actions">
      <button type="button" class="btn btn-outline" onclick="window.closeModal()">Cancelar</button>
      <button type="submit" class="btn btn-primary">${data ? "Actualizar" : "Guardar"}</button>
    </div>
  `;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleFormSubmit(type, form, data);
  });

  return form;
}

function clientFormHTML(data = {}) {
  return `
    <div class="form-grid">
      <div class="form-group form-group-full">
        <label class="form-label">Nombre</label>
        <input type="text" name="name" class="form-input" value="${data.name || ""}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono</label>
        <input type="tel" name="phone" class="form-input" value="${data.phone || ""}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" name="email" class="form-input" value="${data.email || ""}" />
      </div>
    </div>
  `;
}

function deviceFormHTML(data = {}) {
  const clientOptions = state.clients
    .map((c) => `<option value="${c.id}">${c.name} (${c.phone})</option>`)
    .join("");
  return `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <select name="client_id" class="form-select" required>${clientOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Marca</label>
        <input type="text" name="brand" class="form-input" value="${data.brand || ""}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Modelo</label>
        <input type="text" name="model" class="form-input" value="${data.model || ""}" required />
      </div>
      <div class="form-group">
        <label class="form-label">IMEI</label>
        <input type="text" name="imei" class="form-input" value="${data.imei || ""}" />
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input type="text" name="color" class="form-input" value="${data.color || ""}" />
      </div>
      <div class="form-group form-group-full">
        <label class="form-label">Nota</label>
        <textarea name="note" class="form-input form-textarea" placeholder="Observaciones adicionales..." />${data.note || ""}</textarea>
      </div>
    </div>
  `;
}

function repairFormHTML(data = {}) {
  const deviceOptions = state.devices
    .map((d) => {
      const client = state.clients.find((c) => c.id === d.client_id) || {};
      return `<option value="${d.id}">${d.brand} ${d.model} - ${client.name || "?"}</option>`;
    })
    .join("");

  const partOptions = state.parts
    .map((p) => `<option value="${p.id}" data-price="${p.price}">${p.name} - $${p.price}</option>`)
    .join("");

  const toolOptions = state.tools
    .map((t) => `<option value="${t.id}">${t.name}</option>`)
    .join("");

  const statusOptions = ["pending", "in_progress", "completed", "cancelled"]
    .map(
      (s) =>
        `<option value="${s}" ${data.status === s ? "selected" : ""}>${formatStatus(s)}</option>`
    )
    .join("");

  return `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Dispositivo</label>
        <select name="device_id" class="form-select" required>${deviceOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Estatus</label>
        <select name="status" class="form-select">${statusOptions}</select>
      </div>
      <div class="form-group form-group-full">
        <label class="form-label">Diagnóstico</label>
        <textarea name="diagnosis" class="form-input form-textarea" placeholder="Describe el problema..." required>${data.diagnosis || ""}</textarea>
      </div>
      <div class="form-group form-group-full">
        <label class="form-label">Notas</label>
        <textarea name="notes" class="form-input form-textarea" placeholder="Notas adicionales...">${data.notes || ""}</textarea>
      </div>
    </div>

    <div class="dynamic-list" id="broken-parts-list">
      <div class="list-header">
        <h4>Partes Rotas</h4>
        <button type="button" class="add-btn" onclick="window.addBrokenPart()">+ Agregar</button>
      </div>
      <div id="broken-parts-items"></div>
    </div>

    <div class="dynamic-list" id="used-parts-list">
      <div class="list-header">
        <h4>Piezas Usadas</h4>
        <button type="button" class="add-btn" onclick="window.addUsedPart()">+ Agregar</button>
      </div>
      <div id="used-parts-items"></div>
    </div>

    <div class="dynamic-list" id="used-tools-list">
      <div class="list-header">
        <h4>Implementos Usados</h4>
        <button type="button" class="add-btn" onclick="window.addUsedTool()">+ Agregar</button>
      </div>
      <div id="used-tools-items"></div>
    </div>

    <div class="dynamic-list" id="additional-costs-list">
      <div class="list-header">
        <h4>Costos Adicionales</h4>
        <button type="button" class="add-btn" onclick="window.addAdditionalCost()">+ Agregar</button>
      </div>
      <div id="additional-costs-items"></div>
    </div>

    <div class="form-group form-group-full" style="margin-top: 20px;">
      <label class="form-label">Costo Total</label>
      <input type="number" name="total_cost" class="form-input" step="0.01" readonly style="background: var(--color-bg); font-weight: 700;" />
    </div>
  `;
}

function partFormHTML(data = {}) {
  return `
    <div class="form-grid">
      <div class="form-group form-group-full">
        <label class="form-label">Nombre</label>
        <input type="text" name="name" class="form-input" value="${data.name || ""}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Precio Unitario</label>
        <input type="number" name="price" class="form-input" step="0.01" value="${data.price || 0}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Stock</label>
        <input type="number" name="stock" class="form-input" value="${data.stock || 0}" required />
      </div>
    </div>
  `;
}

function toolFormHTML(data = {}) {
  return `
    <div class="form-grid">
      <div class="form-group form-group-full">
        <label class="form-label">Nombre</label>
        <input type="text" name="name" class="form-input" value="${data.name || ""}" required />
      </div>
      <div class="form-group form-group-full">
        <label class="form-label">Descripción</label>
        <textarea name="description" class="form-input form-textarea">${data.description || ""}</textarea>
      </div>
    </div>
  `;
}

/* ===== Repair Form Dynamic Logic ===== */

function setupRepairForm(form, data) {
  const repairId = data && data.id ? data.id : "new";
  state.brokenParts[repairId] = data?.brokenParts || [];
  state.usedParts[repairId] = data?.usedParts || [];
  state.usedTools[repairId] = data?.usedTools || [];
  state.additionalCosts[repairId] = data?.additionalCosts || [];

  if (data && data.id) {
    form.querySelector('[name="total_cost"]').value = data.total_cost || 0;
  }

  renderBrokenParts(repairId);
  renderUsedParts(repairId);
  renderUsedTools(repairId);
  renderAdditionalCosts(repairId);

  form.querySelectorAll('input[name="quantity"], select[name="part_id"]').forEach((el) => {
    el.addEventListener("change", () => calculateTotal(repairId, form));
  });
  form.querySelectorAll('input[name="estimated_cost"], input[name="unit_cost"], input[name="amount"]').forEach((el) => {
    el.addEventListener("input", () => calculateTotal(repairId, form));
  });
}

window.addBrokenPart = function () {
  const repairId = getActiveRepairId();
  state.brokenParts[repairId].push({ name: "", note: "", estimated_cost: 0 });
  renderBrokenParts(repairId);
};

window.addUsedPart = function () {
  const repairId = getActiveRepairId();
  state.usedParts[repairId].push({ part_id: "", quantity: 1, unit_cost: 0 });
  renderUsedParts(repairId);
};

window.addUsedTool = function () {
  const repairId = getActiveRepairId();
  state.usedTools[repairId].push({ tool_id: "", quantity: 1 });
  renderUsedTools(repairId);
};

window.addAdditionalCost = function () {
  const repairId = getActiveRepairId();
  state.additionalCosts[repairId].push({ concept: "", amount: 0 });
  renderAdditionalCosts(repairId);
};

function getActiveRepairId() {
  const form = document.querySelector(".modal-form[data-type='repair']");
  return form?.dataset.id || "new";
}

function renderBrokenParts(repairId) {
  const container = $("broken-parts-items");
  container.innerHTML = state.brokenParts[repairId]
    .map(
      (item, i) => `
    <div class="list-item">
      <input type="text" class="form-input" placeholder="Parte" value="${item.name}"
        oninput="state.brokenParts['${repairId}'][${i}].name=this.value" />
      <input type="text" class="form-input" placeholder="Nota" value="${item.note || ""}"
        oninput="state.brokenParts['${repairId}'][${i}].note=this.value" />
      <input type="number" class="form-input" placeholder="$" value="${item.estimated_cost}" step="0.01"
        oninput="state.brokenParts['${repairId}'][${i}].estimated_cost=parseFloat(this.value)||0; window.calculateTotal('${repairId}', document.querySelector('.modal-form'))" />
      <button type="button" class="remove-btn" onclick="window.removeBrokenPart('${repairId}', ${i})">×</button>
    </div>
  `
    )
    .join("");
  if (!container.innerHTML) container.innerHTML = '<p class="empty-state">No hay partes rotas agregadas.</p>';
}

function renderUsedParts(repairId) {
  const container = $("used-parts-items");
  container.innerHTML = state.usedParts[repairId]
    .map((item, i) => {
      const selectOptions = state.parts
        .map((p) => `<option value="${p.id}" data-price="${p.price}" ${p.id === item.part_id ? "selected" : ""}>${p.name} - $${p.price}</option>`)
        .join("");
      return `
    <div class="list-item">
      <select class="form-select" onchange="state.usedParts['${repairId}'][${i}].part_id=this.value; window.updatePartCost('${repairId}', ${i}); window.calculateTotal('${repairId}', document.querySelector('.modal-form'))">
        <option value="">Seleccionar pieza</option>${selectOptions}
      </select>
      <input type="number" class="form-input" placeholder="Cant." min="1" value="${item.quantity}"
        oninput="state.usedParts['${repairId}'][${i}].quantity=parseInt(this.value)||1; window.calculateTotal('${repairId}', document.querySelector('.modal-form'))" />
      <span class="cost-display">$${item.quantity * (state.parts.find((p) => p.id === item.part_id)?.price || 0)}</span>
      <button type="button" class="remove-btn" onclick="window.removeUsedPart('${repairId}', ${i})">×</button>
    </div>
  `;
    })
    .join("");
  if (!container.innerHTML) container.innerHTML = '<p class="empty-state">No hay piezas usadas agregadas.</p>';
}

function renderUsedTools(repairId) {
  const container = $("used-tools-items");
  container.innerHTML = state.usedTools[repairId]
    .map((item, i) => {
      const selectOptions = state.tools
        .map((t) => `<option value="${t.id}" ${t.id === item.tool_id ? "selected" : ""}>${t.name}</option>`)
        .join("");
      return `
    <div class="list-item">
      <select class="form-select" onchange="state.usedTools['${repairId}'][${i}].tool_id=this.value">
        <option value="">Seleccionar implemento</option>${selectOptions}
      </select>
      <input type="number" class="form-input" placeholder="Cant." min="1" value="${item.quantity}"
        oninput="state.usedTools['${repairId}'][${i}].quantity=parseInt(this.value)||1" />
      <button type="button" class="remove-btn" onclick="window.removeUsedTool('${repairId}', ${i})">×</button>
    </div>
  `;
    })
    .join("");
  if (!container.innerHTML) container.innerHTML = '<p class="empty-state">No hay implementos usados agregados.</p>';
}

function renderAdditionalCosts(repairId) {
  const container = $("additional-costs-items");
  container.innerHTML = state.additionalCosts[repairId]
    .map(
      (item, i) => `
    <div class="list-item">
      <input type="text" class="form-input" placeholder="Concepto" value="${item.concept}"
        oninput="state.additionalCosts['${repairId}'][${i}].concept=this.value" />
      <input type="number" class="form-input" placeholder="$" min="0" step="0.01" value="${item.amount}"
        oninput="state.additionalCosts['${repairId}'][${i}].amount=parseFloat(this.value)||0; window.calculateTotal('${repairId}', document.querySelector('.modal-form'))" />
      <button type="button" class="remove-btn" onclick="window.removeAdditionalCost('${repairId}', ${i})">×</button>
    </div>
  `
    )
    .join("");
  if (!container.innerHTML) container.innerHTML = '<p class="empty-state">No hay costos adicionales agregados.</p>';
}

window.removeBrokenPart = function (repairId, index) {
  state.brokenParts[repairId].splice(index, 1);
  renderBrokenParts(repairId);
  calculateTotal(repairId);
};

window.removeUsedPart = function (repairId, index) {
  state.usedParts[repairId].splice(index, 1);
  renderUsedParts(repairId);
  calculateTotal(repairId);
};

window.removeUsedTool = function (repairId, index) {
  state.usedTools[repairId].splice(index, 1);
  renderUsedTools(repairId);
};

window.removeAdditionalCost = function (repairId, index) {
  state.additionalCosts[repairId].splice(index, 1);
  renderAdditionalCosts(repairId);
  calculateTotal(repairId);
};

window.updatePartCost = function (repairId, index) {
  const items = state.usedParts[repairId];
  if (items[index]) {
    const part = state.parts.find((p) => p.id === items[index].part_id);
    if (part) items[index].unit_cost = part.price;
  }
  renderUsedParts(repairId);
  calculateTotal(repairId);
};

window.calculateTotal = function (repairId, form) {
  if (!form) form = document.querySelector(".modal-form");
  const f = form || {};

  let total = 0;

  (state.brokenParts[repairId] || []).forEach((item) => {
    total += parseFloat(item.estimated_cost) || 0;
  });

  (state.usedParts[repairId] || []).forEach((item) => {
    const part = state.parts.find((p) => p.id === item.part_id);
    if (part) total += (parseFloat(item.quantity) || 0) * parseFloat(part.price);
  });

  (state.additionalCosts[repairId] || []).forEach((item) => {
    total += parseFloat(item.amount) || 0;
  });

  const totalInput = f.querySelector('[name="total_cost"]');
  if (totalInput) totalInput.value = total.toFixed(2);
};

/* ===== Form Submission ===== */

function handleFormSubmit(type, form, data) {
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());

  switch (type) {
    case "client":
      handleClientSubmit(values, data);
      break;
    case "device":
      handleDeviceSubmit(values, data);
      break;
    case "repair":
      handleRepairSubmit(values, form, data);
      break;
    case "part":
      handlePartSubmit(values, data);
      break;
    case "tool":
      handleToolSubmit(values, data);
      break;
  }
  closeModal();
  renderAll();
}

function handleClientSubmit(values, data) {
  if (data && data.id) {
    Object.assign(data, { ...values, id: data.id });
    state.clients = state.clients.map((c) => (c.id === data.id ? data : c));
  } else {
    const client = { ...values, id: Date.now().toString() };
    state.clients.push(client);
  }
}

function handleDeviceSubmit(values, data) {
  if (data && data.id) {
    Object.assign(data, { ...values, id: data.id });
    state.devices = state.devices.map((d) => (d.id === data.id ? data : d));
  } else {
    const device = { ...values, id: Date.now().toString() };
    state.devices.push(device);
  }
}

function handleRepairSubmit(values, form, data) {
  const totalInput = form.querySelector('[name="total_cost"]');
  values.total_cost = parseFloat(totalInput?.value || 0);
  values.created_at = new Date().toISOString();

  const tempId = getActiveRepairId();
  values.brokenParts = state.brokenParts[tempId] || [];
  values.usedParts = state.usedParts[tempId] || [];
  values.usedTools = state.usedTools[tempId] || [];
  values.additionalCosts = state.additionalCosts[tempId] || [];

  if (data && data.id) {
    Object.assign(data, { ...values, id: data.id });
    state.repairs = state.repairs.map((r) => (r.id === data.id ? data : r));
  } else {
    const repair = { ...values, id: Date.now().toString() };
    state.repairs.push(repair);
  }

  delete state.brokenParts[tempId];
  delete state.usedParts[tempId];
  delete state.usedTools[tempId];
  delete state.additionalCosts[tempId];
}

function handlePartSubmit(values, data) {
  if (data && data.id) {
    Object.assign(data, { ...values, id: data.id });
    state.parts = state.parts.map((p) => (p.id === data.id ? data : p));
  } else {
    const part = { ...values, id: Date.now().toString(), price: parseFloat(values.price) };
    state.parts.push(part);
  }
}

function handleToolSubmit(values, data) {
  if (data && data.id) {
    Object.assign(data, { ...values, id: data.id });
    state.tools = state.tools.map((t) => (t.id === data.id ? data : t));
  } else {
    const tool = { ...values, id: Date.now().toString() };
    state.tools.push(tool);
  }
}

/* ===== Render Functions ===== */

function renderAll() {
  renderDashboard();
  renderClients();
  renderDevices();
  renderRepairs();
  renderParts();
  renderTools();
}

function renderDashboard() {
  const totalRepairs = state.repairs.length;
  const inProgress = state.repairs.filter((r) => r.status === "in_progress").length;
  const completed = state.repairs.filter((r) => r.status === "completed").length;
  const pending = state.repairs.filter((r) => r.status === "pending").length;
  const totalRevenue = state.repairs
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);

  $("stats-grid").innerHTML = `
    <div class="stat-card primary" style="position: relative;">
      <div class="stat-label">Total Reparaciones</div>
      <div class="stat-value">${totalRepairs}</div>
      <div class="stat-icon">📱</div>
    </div>
    <div class="stat-card warning" style="position: relative;">
      <div class="stat-label">Pendientes</div>
      <div class="stat-value">${pending}</div>
      <div class="stat-icon">⏳</div>
    </div>
    <div class="stat-card info" style="position: relative;">
      <div class="stat-label">En Progreso</div>
      <div class="stat-value">${inProgress}</div>
      <div class="stat-icon">🔧</div>
    </div>
    <div class="stat-card success" style="position: relative;">
      <div class="stat-label">Completadas</div>
      <div class="stat-value">${completed}</div>
      <div class="stat-icon">✅</div>
    </div>
    <div class="stat-card danger" style="position: relative;">
      <div class="stat-label">Ingresos ($)</div>
      <div class="stat-value">$${totalRevenue.toFixed(2)}</div>
      <div class="stat-icon">💰</div>
    </div>
  `;

  const recentRepairs = state.repairs.slice().reverse().slice(0, 5);
  if (recentRepairs.length === 0) {
    $("recent-repairs").innerHTML = '<p class="empty-state">No hay reparaciones registradas aún.</p>';
    return;
  }
  $("recent-repairs").innerHTML = `
    <div class="section-title">Reparaciones Recientes</div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Dispositivo</th><th>Cliente</th><th>Diagnóstico</th><th>Estatus</th><th>Total</th></tr></thead>
        <tbody>${recentRepairs.map((r) => repairRow(r)).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderClients() {
  if (state.clients.length === 0) {
    $("clients-table").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>No hay clientes registrados. ¡Comienza agregando uno!</p>
      </div>
    `;
    return;
  }
  $("clients-table").innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Acciones</th></tr></thead>
      <tbody>
        ${state.clients.map((c) => `
          <tr>
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td>${c.email || "-"}</td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="window.editItem('client', '${c.id}')">Editar</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderDevices() {
  if (state.devices.length === 0) {
    $("devices-table").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📱</div>
        <p>No hay dispositivos registrados.</p>
      </div>
    `;
    return;
  }
  $("devices-table").innerHTML = `
    <table>
      <thead><tr><th>Cliente</th><th>Marca</th><th>Modelo</th><th>IMEI</th><th>Color</th><th>Acciones</th></tr></thead>
      <tbody>
        ${state.devices.map((d) => {
          const client = state.clients.find((c) => c.id === d.client_id) || {};
          return `
            <tr>
              <td>${client.name || "-"}</td>
              <td>${d.brand}</td>
              <td>${d.model}</td>
              <td>${d.imei || "-"}</td>
              <td>${d.color || "-"}</td>
              <td><button class="btn btn-sm btn-outline" onclick="window.editItem('device', '${d.id}')">Editar</button></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderRepairs() {
  if (state.repairs.length === 0) {
    $("repairs-table").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔧</div>
        <p>No hay reparaciones registradas.</p>
      </div>
    `;
    return;
  }
  $("repairs-table").innerHTML = `
    <table>
      <thead><tr><th>Dispositivo</th><th>Cliente</th><th>Diagnóstico</th><th>Estatus</th><th>Total</th><th>Acciones</th></tr></thead>
      <tbody>${state.repairs.map((r) => repairRow(r, true)).join("")}</tbody>
    </table>
  `;
}

function renderParts() {
  if (state.parts.length === 0) {
    $("parts-table").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧩</div>
        <p>No hay piezas en inventario.</p>
      </div>
    `;
    return;
  }
  $("parts-table").innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr></thead>
      <tbody>${state.parts.map((p) => `
        <tr>
          <td>${p.name}</td>
          <td>$${parseFloat(p.price).toFixed(2)}</td>
          <td>${p.stock}</td>
          <td><button class="btn btn-sm btn-outline" onclick="window.editItem('part', '${p.id}')">Editar</button></td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;
}

function renderTools() {
  if (state.tools.length === 0) {
    $("tools-table").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛠️</div>
        <p>No hay implementos en inventario.</p>
      </div>
    `;
    return;
  }
  $("tools-table").innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Descripción</th><th>Acciones</th></tr></thead>
      <tbody>${state.tools.map((t) => `
        <tr>
          <td>${t.name}</td>
          <td>${t.description || "-"}</td>
          <td><button class="btn btn-sm btn-outline" onclick="window.editItem('tool', '${t.id}')">Editar</button></td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;
}

/* ===== Row Helpers ===== */

function repairRow(r, withActions = false) {
  const device = state.devices.find((d) => d.id === r.device_id) || {};
  const client = device.client_id
    ? state.clients.find((c) => c.id === device.client_id) || {}
    : {};
  const statusClass = {
    pending: "badge-pending",
    in_progress: "badge-in-progress",
    completed: "badge-completed",
    cancelled: "badge-cancelled",
  };
  return `
    <tr>
      <td>${device.brand || ""} ${device.model || ""}</td>
      <td>${client.name || "-"}</td>
      <td>${(r.diagnosis || "").substring(0, 40)}${r.diagnosis?.length > 40 ? "..." : ""}</td>
      <td><span class="badge ${statusClass[r.status] || ""}">${formatStatus(r.status)}</span></td>
      <td>$${parseFloat(r.total_cost || 0).toFixed(2)}</td>
      ${withActions ? `<td><button class="btn btn-sm btn-outline" onclick="window.editItem('repair', '${r.id}')">Editar</button></td>` : ""}
    </tr>
  `;
}

function formatStatus(s) {
  const map = {
    pending: "Pendiente",
    in_progress: "En Progreso",
    completed: "Completada",
    cancelled: "Cancelada",
  };
  return map[s] || s;
}

/* ===== Edit / Delete ===== */

window.editItem = function (type, id) {
  const collection = {
    client: state.clients,
    device: state.devices,
    part: state.parts,
    tool: state.tools,
    repair: state.repairs,
  };
  const item = collection[type]?.find((i) => i.id === id);
  if (item) openModal(type, item);
};

/* ===== Sample Data (dev only) ===== */

function seedSampleData() {
  if (state.clients.length === 0) {
    state.clients.push({ id: "c1", name: "Juan Pérez", phone: "555-1234", email: "juan@email.com" });
    state.clients.push({ id: "c2", name: "María García", phone: "555-5678", email: "maria@email.com" });
  }
  if (state.devices.length === 0) {
    state.devices.push({ id: "d1", client_id: "c1", brand: "iPhone", model: "14 Pro", imei: "123456789012345", color: "Negro" });
    state.devices.push({ id: "d2", client_id: "c2", brand: "Samsung", model: "S23", imei: "987654321098765", color: "Blanco" });
  }
  if (state.parts.length === 0) {
    state.parts.push({ id: "p1", name: "Pantalla iPhone 14 Pro", price: 250.0, stock: 5 });
    state.parts.push({ id: "p2", name: "Batería Samsung S23", price: 80.0, stock: 10 });
  }
  if (state.tools.length === 0) {
    state.tools.push({ id: "t1", name: "Destornillador de precisión", description: "Juego de 10 piezas" });
    state.tools.push({ id: "t2", name: "Alicate de presión", description: "Para retirar componentes" });
  }
  if (state.repairs.length === 0) {
    state.repairs.push({
      id: "r1",
      device_id: "d1",
      status: "completed",
      diagnosis: "Pantalla rota por caída",
      notes: "Reemplazo de pantalla completa",
      total_cost: 250.0,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }
  renderAll();
}

/* ===== Init ===== */

window.closeModal = closeModal;

document.addEventListener("DOMContentLoaded", init);
