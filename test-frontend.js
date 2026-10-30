const fs = require("fs");
const { JSDOM } = require("jsdom");

const htmlContent = fs.readFileSync("index.html", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8").replace(/import\s+[^;]+;\n?/g, "");

const dom = new JSDOM(htmlContent, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const { window } = dom;
global.document = window.document;
global.window = window;

window._supabase = {
  from: () => ({
    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    insert: () => Promise.resolve({ data: null, error: null }),
  }),
};

const script = window.document.createElement("script");
script.textContent = appSource;
window.document.body.appendChild(script);
window.init();

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

test("Seed data loaded (DOM)", () => {
  const clientRows = document.querySelectorAll("#clients-table tbody tr");
  if (clientRows.length !== 2) throw new Error("Expected 2 client rows, got " + clientRows.length);
  const repairRows = document.querySelectorAll("#repairs-table tbody tr");
  if (repairRows.length !== 1) throw new Error("Expected 1 repair row, got " + repairRows.length);
});

test("Navigation to clients view", () => {
  document.querySelector('[data-view="clients"]').click();
  if (!document.getElementById("view-clients").classList.contains("active")) throw new Error("Clients view not active");
});

test("Modal opens for client", () => {
  window.openModal("client");
  if (!document.getElementById("modal-overlay").classList.contains("active")) throw new Error("Modal not opened");
  const form = document.querySelector(".modal-form");
  if (!form) throw new Error("Form not rendered");
});

test("Add client", () => {
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="name"]').value = "Test Client";
  form.querySelector('[name="phone"]').value = "555-0000";
  form.querySelector('[name="email"]').value = "test@test.com";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const clientRows = document.querySelectorAll("#clients-table tbody tr");
  if (clientRows.length !== 3) throw new Error("Expected 3 client rows, got " + clientRows.length);
  if (clientRows[2].cells[0].textContent !== "Test Client") throw new Error("Client name mismatch");
});

test("Add device", () => {
  window.closeModal();
  window.openModal("device");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="client_id"]').value = "c1";
  form.querySelector('[name="brand"]').value = "Xiaomi";
  form.querySelector('[name="model"]').value = "13 Pro";
  form.querySelector('[name="imei"]').value = "111111111111111";
  form.querySelector('[name="color"]').value = "Negro";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const deviceRows = document.querySelectorAll("#devices-table tbody tr");
  if (deviceRows.length !== 3) throw new Error("Expected 3 device rows, got " + deviceRows.length);
  if (deviceRows[2].cells[1].textContent !== "Xiaomi") throw new Error("Device brand mismatch");
});

test("Add repair with broken parts", () => {
  window.closeModal();
  window.openModal("repair");
  const form = document.querySelector(".modal-form");
  form.querySelector('[name="device_id"]').value = "d1";
  form.querySelector('[name="status"]').value = "in_progress";
  form.querySelector('[name="diagnosis"]').value = "Cámara trasera rota";

  window.addBrokenPart();
  const items = document.querySelectorAll("#broken-parts-items .list-item");
  if (items.length !== 1) throw new Error("Expected 1 broken part item, got " + items.length);
  const lastItem = items[0];
  lastItem.querySelector("input[type=\"text\"]").value = "Pantalla";
  const costInputs = lastItem.querySelectorAll("input[type=\"number\"]");
  costInputs[0].value = "300";
  costInputs[0].dispatchEvent(new window.Event("input", { bubbles: true }));

  const totalInput = form.querySelector('[name="total_cost"]');
  const total = parseFloat(totalInput.value);
  if (total !== 300) throw new Error("Total cost should be 300, got " + total);

  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const repairRows = document.querySelectorAll("#repairs-table tbody tr");
  const found = Array.from(repairRows).some(r => r.cells[2].textContent.includes("Cámara trasera rota"));
  if (!found) throw new Error("Repair not found in table");

  const repairRow = Array.from(repairRows).find(r => r.cells[2].textContent.includes("Cámara trasera rota"));
  const totalVal = parseFloat(repairRow.cells[4].textContent.replace(/\$/, ""));
  if (totalVal !== 300) throw new Error("Total cost in table wrong: " + totalVal);
});

test("Dashboard stats render", () => {
  window.closeModal();
  document.querySelector('[data-view="dashboard"]').click();
  const stats = document.getElementById("stats-grid");
  if (stats.children.length < 5) throw new Error("Not all stat cards rendered, got " + stats.children.length);
});

test("Edit client", () => {
  document.querySelector('[data-view="clients"]').click();
  window.editItem("client", "c1");
  const form = document.querySelector(".modal-form");
  if (!form) throw new Error("Form not opened");
  if (form.querySelector('[name="name"]').value !== "Juan Pérez") throw new Error("Wrong name loaded: " + form.querySelector('[name="name"]').value);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
