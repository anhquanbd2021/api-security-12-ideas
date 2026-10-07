import { testCases } from "/test-cases.js";

const $ = id => document.getElementById(id);
const output = $("output");
const flow = [...document.querySelectorAll("#flow li")];
const allowed = {
  framework: ["express", "nest"],
  identity: ["alice-token", "bob-token", "admin-token", "expired-token", ""],
  scenario: ["owned", "foreign", "invalid", "payment", "failure"]
};
const params = new URLSearchParams(location.search);
for (const [name, values] of Object.entries(allowed)) {
  const value = params.get(name);
  if (value !== null && values.includes(value)) $(name).value = value;
}

for (const { id, name } of testCases) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = `${id} · ${name}`;
  $("case-catalog").append(option);
}

const stopAt = status => status === 401 ? 2 : status === 429 ? 3 : [400, 404, 413].includes(status) ? 4 : status >= 500 ? 5 : 6;
const paint = (status, running = false) => {
  const end = stopAt(status);
  flow.forEach((stage, index) => {
    stage.className = index < end ? "passed" : index === end ? (status >= 400 ? "blocked" : "passed") : "";
    stage.style.setProperty("--delay", `${index * 90}ms`);
  });
  $("flow-state").textContent = running ? "Running" : status >= 400 ? "Blocked safely" : "Completed";
  $("flow-state").className = `badge ${status >= 400 ? "danger" : "success"}`;
};

const inspect = () => {
  const item = testCases.find(candidate => candidate.id === $("case-catalog").value);
  if (!item) return;
  const { id, name, layer, executionMode: mode, expectedStatus, controls, framework, mutates, sourceFile } = item;
  const status = expectedStatus.at(-1);
  $("case-layer").textContent = `${layer} · ${framework}`;
  $("case-mode").textContent = mode;
  $("case-mode").className = `badge mode-${mode}`;
  $("case-status").textContent = expectedStatus.join(" / ");
  $("case-control").textContent = controls.join(", ");
  $("request-summary").textContent = `${id} · ${name}`;
  $("status-pill").textContent = `Expected ${expectedStatus.join(" / ")}`;
  output.textContent = `${mode === "live" ? "Live-capable case" : mode === "replay" ? "Deterministic isolated replay" : "Read-only deployment check"}\n\n${name}\nSource: ${sourceFile}\nMutation: ${mutates ? "isolated state" : "none"}`;
  paint(status);
};
$("case-catalog").addEventListener("change", inspect);
inspect();

$("run").addEventListener("click", async () => {
  const framework = $("framework").value;
  const token = $("identity").value;
  const scenario = $("scenario").value;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let path = "/documents/document-1";
  const init = { headers };
  if (scenario === "foreign") path = "/documents/document-2";
  if (scenario === "invalid") { path = "/documents"; Object.assign(init, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ title: "" }) }); }
  if (scenario === "payment") { path = "/payments"; Object.assign(init, { method: "POST", headers: { ...headers, "content-type": "application/json", "idempotency-key": "public-demo-order" }, body: JSON.stringify({ amount: 2500 }) }); }
  if (scenario === "failure") path = "/failure";
  const method = init.method || "GET";
  $("request-summary").textContent = `${method} /api/${framework}${path}`;
  $("status-pill").textContent = "Request in flight";
  output.textContent = "Running security checks…";
  flow.forEach(stage => stage.className = "");
  $("flow-state").textContent = "Running";
  $("flow-state").className = "badge running";
  try {
    const response = await fetch(`/api/${framework}${path}`, init);
    const body = await response.json();
    paint(response.status);
    $("status-pill").textContent = `${response.status} ${response.statusText}`;
    output.textContent = `${response.status} ${response.statusText}\nRequest ID: ${response.headers.get("x-request-id") || "generated"}\n\n${JSON.stringify(body, null, 2)}`;
  } catch (error) {
    paint(500);
    $("status-pill").textContent = "Network error";
    output.textContent = String(error);
  }
});

