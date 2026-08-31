const byId = (id) => document.getElementById(id);

const ranges = [...document.querySelectorAll("[data-range-output]")];
const workers = byId("workers");
const concurrency = byId("concurrency");
const memory = byId("memory");
const capacityTotal = byId("capacity-total");
const capacityBar = byId("capacity-bar");
const capacityMessage = byId("capacity-message");

function updateRange(input) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const value = Number(input.value);
  const progress = ((value - minimum) / (maximum - minimum)) * 100;
  const output = byId(input.dataset.rangeOutput);
  input.style.setProperty("--range-progress", `${progress}%`);
  output.value = `${value}${input.dataset.suffix ?? ""}`;
}

function updateCapacity() {
  const workerCount = Number(workers.value);
  const perWorker = Number(concurrency.value);
  const memoryLimit = Number(memory.value);
  const capacity = workerCount * perWorker;
  const percentage = Math.min(100, Math.max(8, (capacity / 512) * 100));

  capacityTotal.textContent = String(capacity);
  byId("workers-total").textContent = String(workerCount);
  byId("per-worker-total").textContent = String(perWorker);
  byId("memory-total").textContent = `${memoryLimit} MB`;
  capacityBar.style.width = `${percentage}%`;
  capacityBar.parentElement.setAttribute(
    "aria-valuenow",
    String(Math.round(percentage)),
  );

  if (capacity >= 256) {
    capacityMessage.textContent =
      "High-throughput profile: verify downstream capacity before deployment.";
  } else if (capacity <= 16) {
    capacityMessage.textContent =
      "Compact profile: ideal for low-volume or development workloads.";
  } else {
    capacityMessage.textContent =
      "This profile is balanced for a development workload.";
  }
}

for (const input of ranges) {
  updateRange(input);
  input.addEventListener("input", () => {
    updateRange(input);
    updateCapacity();
  });
}
updateCapacity();

const mebibyte = 1024 * 1024;
const downloadSize = byId("download-size");
const downloadSizeOutput = byId("download-size-output");
const generatedDownload = byId("download-generated");
const staticDownload = byId("download-static");
const downloadStatus = byId("download-status");

function selectedDownloadBytes() {
  const position = Number(downloadSize.value);
  return position === 0 ? 1024 : position * mebibyte;
}

function formatBinarySize(bytes) {
  if (bytes >= 1024 * mebibyte) return `${bytes / (1024 * mebibyte)} GiB`;
  if (bytes >= mebibyte) return `${bytes / mebibyte} MiB`;
  return `${bytes / 1024} KiB`;
}

function updateDownload() {
  const bytes = selectedDownloadBytes();
  const basePath = document.body.dataset.basePath;
  const percentage = (Number(downloadSize.value) / 1024) * 100;
  downloadSize.style.setProperty("--range-progress", `${percentage}%`);
  downloadSizeOutput.value = formatBinarySize(bytes);
  generatedDownload.href = `${basePath}/downloads/generated?size=${bytes}`;
  generatedDownload.download = `the8020-generated-${bytes}-bytes.bin`;
  byId("generated-length").textContent = `${bytes.toLocaleString()} bytes`;
}

downloadSize.addEventListener("input", updateDownload);
generatedDownload.addEventListener("click", () => {
  downloadStatus.textContent = `Generated ${
    formatBinarySize(selectedDownloadBytes())
  } download started. Follow progress in your browser's Downloads panel.`;
});
staticDownload.addEventListener("click", () => {
  downloadStatus.textContent =
    "Physical 25 MiB download started. Follow progress in your browser's Downloads panel.";
});
updateDownload();

const root = document.documentElement;
const themeToggle = byId("theme-toggle");

function applyTheme(theme) {
  const dark = theme === "dark";
  root.dataset.theme = dark ? "dark" : "light";
  themeToggle.textContent = dark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(dark));
}

themeToggle.addEventListener("click", () => {
  applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
});

for (const button of document.querySelectorAll(".accordion-button")) {
  button.addEventListener("click", () => {
    const panel = byId(button.getAttribute("aria-controls"));
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    panel.hidden = expanded;
  });
}

const toast = byId("demo-toast");
let toastTimer;

function showToast(
  title = "Profile saved",
  message = "Your demo settings were applied.",
) {
  toast.querySelector("strong").textContent = title;
  toast.querySelector("small").textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

toast.querySelector("button").addEventListener("click", () => {
  toast.hidden = true;
  clearTimeout(toastTimer);
});

byId("show-toast").addEventListener("click", () => showToast());
byId("save-profile").addEventListener("click", () => {
  const environment = byId("environment").value;
  showToast("Profile saved", `${environment} settings were applied.`);
});

byId("toggle-alert").addEventListener("click", () => {
  byId("dynamic-alert").classList.toggle("is-hidden");
});

const defaults = { workers: "4", concurrency: "8", memory: "512" };
byId("reset-demo").addEventListener("click", () => {
  for (const [id, value] of Object.entries(defaults)) {
    const input = byId(id);
    input.value = value;
    updateRange(input);
  }
  byId("environment").selectedIndex = 0;
  byId("autoscale").checked = true;
  byId("tracing").checked = false;
  byId("dynamic-alert").classList.add("is-hidden");
  updateCapacity();
  showToast("Controls reset", "The original demo values were restored.");
});

byId("run-demo").addEventListener("click", () => {
  const sequence = [6, 10, 14, 8];
  let index = 0;
  const timer = setInterval(() => {
    concurrency.value = String(sequence[index]);
    updateRange(concurrency);
    updateCapacity();
    index += 1;
    if (index === sequence.length) {
      clearInterval(timer);
      showToast(
        "Demo complete",
        "The service controls are ready for your input.",
      );
    }
  }, 260);
});
