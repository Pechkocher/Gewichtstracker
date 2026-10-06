const STORAGE_KEY = "gewichtstracker.entries.v1";
const SEED_KEY = "gewichtstracker.seedVersion.v1";
const THEME_KEY = "gewichtstracker.theme.v1";
const SEED_VERSION = "gewichtsverlauf-2026-09-16";
const HEIGHT_METERS = 1.78;
const INITIAL_VISIBLE_ROWS = 20;
const LOAD_MORE_ROWS = 20;

const entryForm = document.querySelector("#entryForm");
const entryDate = document.querySelector("#entryDate");
const entryWeight = document.querySelector("#entryWeight");
const entriesBody = document.querySelector("#entriesBody");
const currentWeight = document.querySelector("#currentWeight");
const averageWeight = document.querySelector("#averageWeight");
const currentBmi = document.querySelector("#currentBmi");
const averageBmi = document.querySelector("#averageBmi");
const canvas = document.querySelector("#weightChart");
const emptyChart = document.querySelector("#emptyChart");
const chartTooltip = document.querySelector("#chartTooltip");
const themeToggle = document.querySelector("#themeToggle");
const themeIcon = document.querySelector("#themeIcon");
const toggleWeight = document.querySelector("#toggleWeight");
const toggleAverage = document.querySelector("#toggleAverage");
const toggleBmi = document.querySelector("#toggleBmi");
const toggleAverageBmi = document.querySelector("#toggleAverageBmi");
const openImportModalButton = document.querySelector("#openImportModal");
const openExportModalButton = document.querySelector("#openExportModal");
const formatModal = document.querySelector("#formatModal");
const formatModalEyebrow = document.querySelector("#formatModalEyebrow");
const formatModalTitle = document.querySelector("#formatModalTitle");
const closeFormatModalButton = document.querySelector("#closeFormatModal");
const chooseCsv = document.querySelector("#chooseCsv");
const chooseJson = document.querySelector("#chooseJson");
const importCsv = document.querySelector("#importCsv");
const importJson = document.querySelector("#importJson");
const clearAll = document.querySelector("#clearAll");
const showMore = document.querySelector("#showMore");

let entries = loadEntries();
let visibleRows = INITIAL_VISIBLE_ROWS;
let chartPoints = [];
let formatModalMode = "import";
const chartSeries = {
  weight: true,
  averageWeight: false,
  bmi: false,
  averageBmi: false,
};

applyTheme(localStorage.getItem(THEME_KEY) || "dark");
entryDate.value = toIsoDate(new Date());
render();

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = entryDate.value;
  const weight = Number.parseFloat(String(entryWeight.value).replace(",", "."));

  if (!date || Number.isNaN(weight)) {
    return;
  }

  const existingIndex = entries.findIndex((entry) => entry.date === date);
  const nextEntry = { date, weight: round(weight, 1) };

  if (existingIndex >= 0) {
    entries[existingIndex] = nextEntry;
  } else {
    entries.push(nextEntry);
  }

  entries = sortEntries(entries);
  saveEntries(entries);
  entryWeight.value = "";
  visibleRows = INITIAL_VISIBLE_ROWS;
  render();
});

entriesBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-date]");

  if (!button) {
    return;
  }

  entries = entries.filter((entry) => entry.date !== button.dataset.deleteDate);
  saveEntries(entries);
  visibleRows = INITIAL_VISIBLE_ROWS;
  render();
});

clearAll.addEventListener("click", () => {
  if (!entries.length || !window.confirm("Alle gespeicherten Eintraege loeschen?")) {
    return;
  }

  entries = [];
  saveEntries(entries);
  localStorage.setItem(SEED_KEY, SEED_VERSION);
  visibleRows = INITIAL_VISIBLE_ROWS;
  render();
});

openImportModalButton.addEventListener("click", () => openFormatModal("import"));
openExportModalButton.addEventListener("click", () => openFormatModal("export"));
closeFormatModalButton.addEventListener("click", closeFormatModal);
formatModal.addEventListener("click", (event) => {
  if (event.target === formatModal) {
    closeFormatModal();
  }
});
chooseCsv.addEventListener("click", () => handleFormatChoice("csv"));
chooseJson.addEventListener("click", () => handleFormatChoice("json"));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !formatModal.hidden) {
    closeFormatModal();
  }
});

importCsv.addEventListener("change", async (event) => {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  const text = await file.text();
  const importedEntries = parseCsvEntries(text);

  if (!importedEntries.length) {
    window.alert("Keine gueltigen Eintraege gefunden. Erwartet werden Datum und Gewicht.");
    importCsv.value = "";
    return;
  }

  mergeImportedEntries(importedEntries);
  importCsv.value = "";
});

importJson.addEventListener("change", async (event) => {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  const text = await file.text();
  const importedEntries = parseJsonEntries(text);

  if (!importedEntries.length) {
    window.alert("Keine gueltigen JSON-Eintraege gefunden. Erwartet werden Datum und Gewicht.");
    importJson.value = "";
    return;
  }

  mergeImportedEntries(importedEntries);
  importJson.value = "";
});

showMore.addEventListener("click", () => {
  visibleRows += LOAD_MORE_ROWS;
  render();
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
  hideChartTooltip();
  drawChart(enrichEntries(entries));
});

toggleWeight.addEventListener("change", () => {
  chartSeries.weight = toggleWeight.checked;
  hideChartTooltip();
  drawChart(enrichEntries(entries));
});

toggleAverage.addEventListener("change", () => {
  chartSeries.averageWeight = toggleAverage.checked;
  hideChartTooltip();
  drawChart(enrichEntries(entries));
});

toggleBmi.addEventListener("change", () => {
  chartSeries.bmi = toggleBmi.checked;
  hideChartTooltip();
  drawChart(enrichEntries(entries));
});

toggleAverageBmi.addEventListener("change", () => {
  chartSeries.averageBmi = toggleAverageBmi.checked;
  hideChartTooltip();
  drawChart(enrichEntries(entries));
});

canvas.addEventListener("mousemove", showChartTooltip);
canvas.addEventListener("mouseleave", hideChartTooltip);
canvas.addEventListener("focusout", hideChartTooltip);

window.addEventListener("resize", () => {
  hideChartTooltip();
  drawChart(enrichEntries(entries));
});

function render() {
  const enriched = enrichEntries(entries);
  const latest = enriched.at(-1);

  currentWeight.textContent = latest ? `${decimal(latest.weight, 1)} kg` : "-";
  averageWeight.textContent = latest ? `${decimal(latest.averageWeight, 1)} kg` : "-";
  currentBmi.textContent = latest ? decimal(latest.bmi, 1) : "-";
  averageBmi.textContent = latest ? decimal(latest.averageBmi, 1) : "-";

  const visibleEntries = [...enriched]
    .reverse()
    .slice(0, visibleRows);

  entriesBody.innerHTML = visibleEntries
    .map((entry) => `
      <tr>
        <td>${formatDate(entry.date)}</td>
        <td>${decimal(entry.weight, 1)} kg</td>
        <td>${decimal(entry.averageWeight, 1)} kg</td>
        <td>${decimal(entry.bmi, 1)}</td>
        <td>${decimal(entry.averageBmi, 1)}</td>
        <td>
          <button class="row-action" type="button" title="Eintrag loeschen" aria-label="Eintrag vom ${formatDate(entry.date)} loeschen" data-delete-date="${entry.date}">x</button>
        </td>
      </tr>
    `)
    .join("");
  showMore.hidden = visibleRows >= enriched.length;
  showMore.textContent = `Weitere (${enriched.length - visibleRows > 0 ? Math.min(LOAD_MORE_ROWS, enriched.length - visibleRows) : 0})`;

  drawChart(enriched);
}

function openFormatModal(mode) {
  formatModalMode = mode;
  formatModalEyebrow.textContent = mode === "import" ? "Import" : "Export";
  formatModalTitle.textContent = mode === "import" ? "Format importieren" : "Format exportieren";
  chooseCsv.querySelector("span").textContent = mode === "import" ? "CSV-Datei auswaehlen" : "CSV herunterladen";
  chooseJson.querySelector("span").textContent = mode === "import" ? "JSON-Datei auswaehlen" : "JSON herunterladen";
  formatModal.hidden = false;
  chooseCsv.focus();
}

function closeFormatModal() {
  formatModal.hidden = true;
}

function handleFormatChoice(format) {
  const mode = formatModalMode;
  closeFormatModal();

  if (mode === "import") {
    const input = format === "csv" ? importCsv : importJson;
    input.value = "";
    input.click();
    return;
  }

  if (format === "csv") {
    exportCsvData();
  } else {
    exportJsonData();
  }
}

function exportCsvData() {
  const enriched = enrichEntries(entries);
  const lines = [
    ["Datum", "Gewicht kg", "7-Tage-Gewicht kg", "BMI", "7 Tage BMI"],
    ...enriched.map((entry) => [
      entry.date,
      decimal(entry.weight, 1),
      decimal(entry.averageWeight, 1),
      decimal(entry.bmi, 1),
      decimal(entry.averageBmi, 1),
    ]),
  ];

  const csv = lines.map((row) => row.map(csvCell).join(";")).join("\n");
  downloadFile(csv, `gewichtstracker-${toIsoDate(new Date())}.csv`, "text/csv;charset=utf-8");
}

function exportJsonData() {
  const enriched = enrichEntries(entries);
  const payload = {
    exportedAt: new Date().toISOString(),
    heightMeters: HEIGHT_METERS,
    entries: enriched,
  };

  downloadFile(JSON.stringify(payload, null, 2), `gewichtstracker-${toIsoDate(new Date())}.json`, "application/json;charset=utf-8");
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  themeIcon.setAttribute("href", isDark ? "#icon-sun" : "#icon-moon");
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

function enrichEntries(sourceEntries) {
  return sourceEntries.map((entry, index, sortedEntries) => {
    const currentDate = parseLocalDate(entry.date);
    const windowStart = addDays(currentDate, -6);
    const windowEntries = sortedEntries
      .slice(0, index + 1)
      .filter((candidate) => {
        const candidateDate = parseLocalDate(candidate.date);
        return candidateDate >= windowStart && candidateDate <= currentDate;
      });
    const average = windowEntries.reduce((sum, candidate) => sum + candidate.weight, 0) / windowEntries.length;

    return {
      ...entry,
      averageWeight: round(average, 2),
      bmi: bmi(entry.weight),
      averageBmi: bmi(average),
    };
  });
}

function drawChart(data) {
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(260, Math.floor(rect.height));

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  chartPoints = [];

  const visibleSeries = getVisibleSeries();
  emptyChart.hidden = data.length > 0 && visibleSeries.length > 0;

  if (!data.length || !visibleSeries.length) {
    emptyChart.textContent = data.length ? "Keine Kurve ausgewaehlt." : "Noch keine Eintraege vorhanden.";
    return;
  }

  emptyChart.textContent = "Noch keine Eintraege vorhanden.";

  const padding = { top: 24, right: 20, bottom: 48, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = data.flatMap((entry) => visibleSeries.map((series) => entry[series.key]));
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const range = Math.max(1, max - min);
  const xFor = (index) => padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const yFor = (value) => padding.top + (1 - (value - min) / range) * plotHeight;

  context.strokeStyle = "#dce4dd";
  context.lineWidth = 1;
  context.fillStyle = "#657168";
  context.font = "12px Inter, system-ui, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";

  for (let step = 0; step <= 4; step += 1) {
    const value = min + (range / 4) * step;
    const y = yFor(value);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(decimal(value, 1), padding.left - 10, y);
  }

  visibleSeries.forEach((series) => {
    drawLine(context, data, xFor, yFor, series.key, series.color, 3);
  });

  visibleSeries.forEach((series) => {
    data.forEach((entry, index) => {
      const x = xFor(index);
      const y = yFor(entry[series.key]);
      context.fillStyle = series.color;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      chartPoints.push({
        x,
        y,
        date: entry.date,
        value: entry[series.key],
        label: series.label,
        unit: series.unit,
        digits: series.digits,
        color: series.color,
      });
    });
  });

  const labels = pickLabels(data);
  context.fillStyle = "#657168";
  context.textAlign = "center";
  context.textBaseline = "top";
  labels.forEach((index) => {
    context.fillText(shortDate(data[index].date), xFor(index), height - padding.bottom + 18);
  });
}

function getVisibleSeries() {
  return [
    { key: "weight", label: "Gewicht", color: "#3e6dd8", unit: "kg", digits: 1, visible: chartSeries.weight },
    { key: "averageWeight", label: "7-Tage-Gewicht", color: cssColor("--accent", "#6A522F"), unit: "kg", digits: 1, visible: chartSeries.averageWeight },
    { key: "bmi", label: "BMI", color: "#b24a7a", unit: "", digits: 1, visible: chartSeries.bmi },
    { key: "averageBmi", label: "7-Tage-BMI", color: "#9a6a12", unit: "", digits: 1, visible: chartSeries.averageBmi },
  ].filter((series) => series.visible);
}

function cssColor(name, fallback) {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

function showChartTooltip(event) {
  if (!chartPoints.length) {
    hideChartTooltip();
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  const nearest = chartPoints
    .map((point) => ({
      ...point,
      distance: Math.hypot(point.x - mouseX, point.y - mouseY),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearest || nearest.distance > 14) {
    hideChartTooltip();
    canvas.style.cursor = "default";
    return;
  }

  canvas.style.cursor = "pointer";
  chartTooltip.hidden = false;
  chartTooltip.innerHTML = `
    <strong>${nearest.label}</strong>
    <span>${formatDate(nearest.date)}</span>
    <span>${decimal(nearest.value, nearest.digits)}${nearest.unit ? ` ${nearest.unit}` : ""}</span>
  `;

  const tooltipWidth = chartTooltip.offsetWidth;
  const tooltipHeight = chartTooltip.offsetHeight;
  const left = Math.min(Math.max(nearest.x, tooltipWidth / 2 + 8), rect.width - tooltipWidth / 2 - 8);
  const top = Math.max(nearest.y, tooltipHeight + 18);

  chartTooltip.style.left = `${left}px`;
  chartTooltip.style.top = `${top}px`;
  chartTooltip.style.borderTopColor = nearest.color;
  chartTooltip.style.borderTopWidth = "3px";
}

function hideChartTooltip() {
  chartTooltip.hidden = true;
  canvas.style.cursor = "default";
}

function drawLine(context, data, xFor, yFor, key, color, lineWidth) {
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();
  data.forEach((entry, index) => {
    const x = xFor(index);
    const y = yFor(entry[key]);

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

function pickLabels(data) {
  if (data.length <= 4) {
    return data.map((_, index) => index);
  }

  const labels = new Set([0, data.length - 1]);
  const step = Math.ceil(data.length / 4);

  for (let index = step; index < data.length - 1; index += step) {
    labels.add(index);
  }

  return [...labels].sort((a, b) => a - b);
}

function parseCsvEntries(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const delimiter = line.includes(";") ? ";" : ",";
      return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    })
    .map((cells) => {
      const date = normalizeDate(cells[0]);
      const weight = Number.parseFloat(String(cells[1] || "").replace(",", "."));
      return date && !Number.isNaN(weight) ? { date, weight: round(weight, 1) } : null;
    })
    .filter(Boolean);
}

function parseJsonEntries(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  const rows = Array.isArray(parsed) ? parsed : parsed.entries;

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const date = normalizeDate(String(entry.date || entry.Datum || ""));
      const rawWeight = entry.weight ?? entry.gewicht ?? entry.Gewicht ?? entry["Gewicht kg"];
      const weight = Number.parseFloat(String(rawWeight ?? "").replace(",", "."));

      return date && Number.isFinite(weight) ? { date, weight: round(weight, 1) } : null;
    })
    .filter(Boolean);
}

function mergeImportedEntries(importedEntries) {
  const merged = new Map(entries.map((entry) => [entry.date, entry]));
  importedEntries.forEach((entry) => merged.set(entry.date, entry));
  entries = sortEntries([...merged.values()]);
  saveEntries(entries);
  visibleRows = INITIAL_VISIBLE_ROWS;
  render();
}

function normalizeDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function loadEntries() {
  const historicalEntries = Array.isArray(window.HISTORICAL_WEIGHT_ENTRIES) ? window.HISTORICAL_WEIGHT_ENTRIES : [];
  const storedEntries = localStorage.getItem(STORAGE_KEY);

  if (storedEntries === null) {
    const seededEntries = sortEntries(historicalEntries);
    saveEntries(seededEntries);
    localStorage.setItem(SEED_KEY, SEED_VERSION);
    return seededEntries;
  }

  try {
    const parsed = JSON.parse(storedEntries || "[]");
    const stored = parsed.filter((entry) => entry.date && Number.isFinite(entry.weight));

    if (localStorage.getItem(SEED_KEY) !== SEED_VERSION) {
      const merged = new Map(historicalEntries.map((entry) => [entry.date, entry]));
      stored.forEach((entry) => merged.set(entry.date, entry));
      const seededEntries = sortEntries([...merged.values()]);
      saveEntries(seededEntries);
      localStorage.setItem(SEED_KEY, SEED_VERSION);
      return seededEntries;
    }

    return sortEntries(stored);
  } catch {
    const seededEntries = sortEntries(historicalEntries);
    saveEntries(seededEntries);
    localStorage.setItem(SEED_KEY, SEED_VERSION);
    return seededEntries;
  }
}

function saveEntries(nextEntries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
}

function sortEntries(sourceEntries) {
  return [...sourceEntries].sort((a, b) => a.date.localeCompare(b.date));
}

function bmi(weight) {
  return round(weight / (HEIGHT_METERS * HEIGHT_METERS), 2);
}

function decimal(value, digits) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseLocalDate(date));
}

function shortDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(parseLocalDate(date));
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function csvCell(value) {
  const stringValue = String(value);
  return /[;"\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}
