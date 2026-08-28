const form = document.getElementById("property-inspector");
const executableSelect = document.getElementById("executable");
const statusEl = document.getElementById("status");
const rowApplication = document.getElementById("row-application");
const rowSessionMode = document.getElementById("row-session-mode");
const rowRefresh = document.getElementById("row-refresh");
const appHint = document.getElementById("app-hint");

let currentSettings = {
  mode: "application",
  executable: "",
  displayName: "",
  step: 2,
  pressAction: "toggleMute",
  sessionMode: "all",
};

function isMaster() {
  return String($UD.uuid || "").endsWith(".master") || currentSettings.mode === "master";
}

function applyLayout() {
  const master = isMaster();
  rowApplication.classList.toggle("hidden", master);
  rowSessionMode.classList.toggle("hidden", master);
  rowRefresh.classList.toggle("hidden", master);
  appHint.classList.toggle("hidden", master);
  document.getElementById("mode").value = master ? "master" : "application";
}

function selectedLabel() {
  const option = executableSelect.selectedOptions[0];
  return option ? option.textContent.replace(/\s+\(\d+\)$/, "") : "";
}

function collectSettings() {
  const master = isMaster();
  return {
    mode: master ? "master" : "application",
    executable: master ? "" : executableSelect.value,
    displayName: master ? "SYSTEM" : selectedLabel(),
    step: Number(document.getElementById("step").value) || 2,
    pressAction: document.getElementById("pressAction").value || "toggleMute",
    sessionMode: document.getElementById("sessionMode").value === "first" ? "first" : "all",
  };
}

function save() {
  currentSettings = collectSettings();
  $UD.sendParamFromPlugin(currentSettings);
  $UD.sendToPlugin({ type: "save", settings: currentSettings });
}

function renderApplications(applications) {
  const previous = executableSelect.value || currentSettings.executable;
  executableSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = $UD.t ? $UD.t("Select application") : "Select application";
  executableSelect.appendChild(placeholder);

  const seen = new Set();
  for (const app of applications || []) {
    const exe = app.executable || "";
    if (!exe || seen.has(exe.toLowerCase())) continue;
    seen.add(exe.toLowerCase());
    const option = document.createElement("option");
    option.value = exe;
    option.textContent = app.displayName || exe;
    executableSelect.appendChild(option);
  }

  if (previous && !seen.has(previous.toLowerCase())) {
    const option = document.createElement("option");
    option.value = previous;
    option.textContent = currentSettings.displayName || previous;
    executableSelect.appendChild(option);
  }
  executableSelect.value = previous;
}

function applySettings(settings) {
  if (!settings) return;
  currentSettings = { ...currentSettings, ...settings };
  document.getElementById("step").value = String(currentSettings.step || 2);
  document.getElementById("pressAction").value = currentSettings.pressAction || "toggleMute";
  document.getElementById("sessionMode").value = currentSettings.sessionMode === "first" ? "first" : "all";
  if (currentSettings.executable) executableSelect.value = currentSettings.executable;
  applyLayout();
}

$UD.connect("com.ulanzi.ulanzistudio.windowsaudio.application");

$UD.onConnected(() => {
  applyLayout();
  $UD.sendToPlugin({ type: "ready" });
});

$UD.onAdd((message) => {
  applySettings(message.param || {});
  Utils.setFormValue(message.param, "#property-inspector");
  applyLayout();
});

$UD.onDidReceiveSettings((message) => {
  applySettings(message.settings || message.param || {});
});

$UD.onSendToPropertyInspector((message) => {
  const payload = message.payload || message.param || message;
  if (payload.settings) applySettings(payload.settings);
  if (payload.applications) renderApplications(payload.applications);
  if (payload.helperConnected === false) {
    statusEl.textContent = $UD.t
      ? $UD.t("Windows audio helper is unavailable.")
      : "Windows audio helper is unavailable.";
  } else {
    const count = (payload.applications || []).length;
    statusEl.textContent = count
      ? `${count} audio application(s) detected.`
      : "Waiting for applications to play audio...";
  }
});

form.addEventListener("change", (event) => {
  if (event.target && event.target.id === "debug") {
    $UD.sendToPlugin({ type: "setDebug", debug: event.target.value === "1" });
    return;
  }
  save();
});

document.getElementById("refresh").addEventListener("click", (event) => {
  event.preventDefault();
  $UD.sendToPlugin({ type: "refresh" });
});
