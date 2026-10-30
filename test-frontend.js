const fs = require("fs");
const { JSDOM } = require("jsdom");

const appSource = fs.readFileSync("js/app.js", "utf8").replace(/import\s+[^;]+;\n?/g, "");

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("PASS: " + name);
    passed++;
  } catch (e) {
    console.log("FAIL: " + name + " -> " + e.message);
    failed++;
  }
}

function createDom(htmlFile, prefillStorage = null) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
  });
  const { window } = dom;
  global.document = window.document;
  global.window = window;
  global.HTMLElement = window.HTMLElement;

  window._supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  };

  if (prefillStorage) {
    window.localStorage.setItem("reparawey-state", prefillStorage);
  }

  const script = window.document.createElement("script");
  script.textContent = appSource;
  window.document.body.appendChild(script);
  window.init();

  return window;
}

// ===== Dashboard Tests =====
test("Dashboard loads with seed data", () => {
  const w = createDom("index.html");
  const clientRows = w.document.querySelectorAll("#clients-table tbody tr");
  if (clientRows.length !== 0) throw new Error("Dashboard should not show clients table");
  const stats = w.document.getElementById("stats-grid");
  if (stats.children.length < 5) throw new Error("Stats not rendered");
});

// ===== Clients Tests =====
test("Clients page renders seed data", () => {
  createDom("clients.html");
  const rows = document.querySelectorAll("#clients-table tbody tr");
  if (rows.length !== 2) throw new Error("Expected 2 clients, got " + rows.length);
});

test("Add client works", () => {
  createDom("clients.html");
  window.openModal("client");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="name"]').value = "Test Client";
  form.querySelector('[name="phone"]').value = "555-0000";
  form.querySelector('[name="email"]').value = "test@test.com";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const rows = document.querySelectorAll("#clients-table tbody tr");
  if (rows.length !== 3) throw new Error("Expected 3 clients, got " + rows.length);
  if (rows[2].cells[0].textContent !== "Test Client") throw new Error("Name mismatch");
});

test("Edit client loads data", () => {
  createDom("clients.html");
  window.editItem("client", "c1");
  const form = document.querySelector(".modal-form");
  if (!form) throw new Error("Form not opened");
  if (form.querySelector('[name="name"]').value !== "Juan Pérez") throw new Error("Wrong name");
});

// ===== Devices Tests =====
test("Devices page renders seed data", () => {
  createDom("devices.html");
  const rows = document.querySelectorAll("#devices-table tbody tr");
  if (rows.length !== 2) throw new Error("Expected 2 devices, got " + rows.length);
});

test("Add device works", () => {
  createDom("devices.html");
  window.openModal("device");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="client_id"]').value = "c1";
  form.querySelector('[name="brand"]').value = "Xiaomi";
  form.querySelector('[name="model"]').value = "13 Pro";
  form.querySelector('[name="imei"]').value = "111111111111111";
  form.querySelector('[name="color"]').value = "Negro";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const rows = document.querySelectorAll("#devices-table tbody tr");
  if (rows.length !== 3) throw new Error("Expected 3 devices, got " + rows.length);
  if (rows[2].cells[1].textContent !== "Xiaomi") throw new Error("Brand mismatch");
});

// ===== Repairs Tests =====
test("Repairs page renders seed data", () => {
  createDom("repairs.html");
  const rows = document.querySelectorAll("#repairs-table tbody tr");
  if (rows.length !== 1) throw new Error("Expected 1 repair, got " + rows.length);
});

test("Add repair with broken parts and cost", () => {
  createDom("repairs.html");
  window.openModal("repair");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="device_id"]').value = "d1";
  form.querySelector('[name="status"]').value = "in_progress";
  form.querySelector('[name="diagnosis"]').value = "Cámara trasera rota";

  window.addBrokenPart();
  const items = document.querySelectorAll("#broken-parts-items .list-item");
  if (items.length !== 1) throw new Error("Expected 1 broken part item");
  items[0].querySelector("input[type=\"text\"]").value = "Cámara";
  const costInputs = items[0].querySelectorAll("input[type=\"number\"]");
  costInputs[0].value = "300";
  costInputs[0].dispatchEvent(new window.Event("input", { bubbles: true }));

  const totalBefore = form.querySelector('[name="total_cost"]').value;
  if (parseFloat(totalBefore) !== 300) throw new Error("Total before submit should be 300, got " + totalBefore);

  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const rows = document.querySelectorAll("#repairs-table tbody tr");
  const found = Array.from(rows).some(r => r.cells[2].textContent.includes("Cámara trasera rota"));
  if (!found) throw new Error("Repair not in table");
  const row = Array.from(rows).find(r => r.cells[2].textContent.includes("Cámara trasera rota"));
  const total = parseFloat(row.cells[4].textContent.replace(/\$/, ""));
  if (total !== 300) throw new Error("Total in table should be 300, got " + total);
});

test("Add repair with used parts cost", () => {
  createDom("repairs.html");
  window.openModal("repair");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="device_id"]').value = "d1";
  form.querySelector('[name="status"]').value = "in_progress";
  form.querySelector('[name="diagnosis"]').value = "Batería de descarga";

  window.addUsedPart();
  const items = document.querySelectorAll("#used-parts-items .list-item");
  if (items.length !== 1) throw new Error("Expected 1 used part item");
  const select = items[0].querySelector("select");
  select.value = "p2"; // Batería Samsung S23 - $80
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  const qtyInput = items[0].querySelector("input[type=\"number\"]");
  qtyInput.value = "2";
  qtyInput.dispatchEvent(new window.Event("input", { bubbles: true }));

  const totalBefore = form.querySelector('[name="total_cost"]').value;
  const total = parseFloat(totalBefore);
  // 2 * $80 = $160
  if (total !== 160) throw new Error("Total should be 160, got " + total);

  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const rows = document.querySelectorAll("#repairs-table tbody tr");
  const row = Array.from(rows).find(r => r.cells[2].textContent.includes("Batería de descarga"));
  if (!row) throw new Error("Repair not found");
  const rowTotal = parseFloat(row.cells[4].textContent.replace(/\$/, ""));
  if (rowTotal !== 160) throw new Error("Row total should be 160, got " + rowTotal);
});

// ===== Parts & Tools Tests =====
test("Parts page renders seed data", () => {
  createDom("parts.html");
  const rows = document.querySelectorAll("#parts-table tbody tr");
  if (rows.length !== 2) throw new Error("Expected 2 parts, got " + rows.length);
});

test("Tools page renders seed data", () => {
  createDom("tools.html");
  const rows = document.querySelectorAll("#tools-table tbody tr");
  if (rows.length !== 2) throw new Error("Expected 2 tools, got " + rows.length);
});

test("Add part works", () => {
  createDom("parts.html");
  window.openModal("part");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="name"]').value = "Cargador";
  form.querySelector('[name="price"]').value = "25.50";
  form.querySelector('[name="stock"]').value = "15";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const rows = document.querySelectorAll("#parts-table tbody tr");
  if (rows.length !== 3) throw new Error("Expected 3 parts, got " + rows.length);
  if (rows[2].cells[1].textContent !== "$25.50") throw new Error("Price mismatch");
});

// ===== State Persistence Tests =====
test("State persists in localStorage", () => {
  const w1 = createDom("clients.html");
  window.openModal("client");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="name"]').value = "Persisted Client";
  form.querySelector('[name="phone"]').value = "999-9999";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

  // Get saved state from localStorage
  const saved = w1.localStorage.getItem("reparawey-state");
  if (!saved) throw new Error("State not saved to localStorage");
  const parsed = JSON.parse(saved);
  const found = parsed.clients.some(c => c.name === "Persisted Client");
  if (!found) throw new Error("Added client not found in localStorage");

  // Simulate page refresh: create new DOM with saved state
  createDom("clients.html", saved);
  const rows = document.querySelectorAll("#clients-table tbody tr");
  const persisted = Array.from(rows).some(r => r.cells[0].textContent === "Persisted Client");
  if (!persisted) throw new Error("Client not loaded from localStorage after page refresh");
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
