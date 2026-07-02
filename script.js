// ===============================
// DOM ELEMENTS
// ===============================

const logFile = document.getElementById("logFile");
const selectedFile = document.getElementById("selectedFile");

const analyzeButton = document.getElementById("analyzeButton");
const clearButton = document.getElementById("clearButton");

const searchInput = document.getElementById("searchInput");

const resultsBody = document.getElementById("resultsBody");

const totalExportsEl = document.getElementById("totalExports");
const successCountEl = document.getElementById("successCount");
const warningCountEl = document.getElementById("warningCount");
const failedCountEl = document.getElementById("failedCount");


// ===============================
// GLOBAL STATE
// ===============================

let logText = "";
let fileReady = false;
let analyzedData = null;


// ===============================
// FILE UPLOAD HANDLER
// ===============================

logFile.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) {
        selectedFile.textContent = "No file selected";
        logText = "";
        fileReady = false;
        analyzeButton.disabled = true;
        return;
    }

    selectedFile.textContent = `Loading: ${file.name}...`;
    analyzeButton.disabled = true;

    const reader = new FileReader();

    reader.onload = function (e) {
        logText = e.target.result;
        fileReady = true;

        selectedFile.textContent = `Selected: ${file.name}`;
        analyzeButton.disabled = false;
    };

    reader.readAsText(file);
});


// ===============================
// ANALYZE BUTTON
// ===============================

analyzeButton.addEventListener("click", function () {

    if (!fileReady || !logText) {
        alert("File is not ready yet. Please wait.");
        return;
    }

    const exports = parseLog(logText);
    analyzedData = analyzeExports(exports);

    renderTable(analyzedData);
    updateSummary(analyzedData);
});


// ===============================
// CLEAR BUTTON
// ===============================

clearButton.addEventListener("click", function () {

    logFile.value = "";
    logText = "";
    fileReady = false;
    analyzedData = null;

    selectedFile.textContent = "No file selected";
    analyzeButton.disabled = true;

    searchInput.value = "";

    resultsBody.innerHTML = `
        <tr>
            <td colspan="7" class="empty">
                Upload a ServiceNow log file and click Analyze
            </td>
        </tr>
    `;

    totalExportsEl.textContent = "0";
    successCountEl.textContent = "0";
    warningCountEl.textContent = "0";
    failedCountEl.textContent = "0";
});


// ===============================
// SEARCH / FILTER
// ===============================

searchInput.addEventListener("input", function () {

    if (!analyzedData) return;

    const query = this.value.toLowerCase();

    const filtered = analyzedData.exports.filter(exp =>

        exp.name.toLowerCase().includes(query) ||
        exp.table.toLowerCase().includes(query) ||
        exp.status.toLowerCase().includes(query)

    );

    renderTable({
        exports: filtered,
        summary: analyzedData.summary
    });
});


// ===============================
// PARSER (LOG READER)
// ===============================

function parseLog(logText) {

    const lines = logText.split("\n");

    const exports = [];
    let current = null;

    for (let raw of lines) {

        // remove timestamps if present
        let line = raw.replace(/^\d{4}-\d{2}-\d{2}T.*?\s+/, "");

        // skip noise lines
        if (line.includes("uploading Blob")) continue;
        if (line.includes("uploading done")) continue;

        // detect section start
        if (line.includes("---------------------------")) {

            const match = line.match(/---------------------------\s+(.+?)\s+\(/);

            if (match) {
                current = {
                    name: match[1],
                    table: "",
                    declaredRows: 0,
                    receivedRows: 0,
                    portions: 0,
                    leftRows: null,
                    completed: false,
                    status: "Unknown"
                };

                exports.push(current);
            }
        }

        if (!current) continue;

        // table + declared rows
        if (line.includes("TABLE=")) {
            const m = line.match(/TABLE=([^;]+)/);
            if (m) current.table = m[1];
        }

        if (line.includes("DECLARED_ROWS=")) {
            const m = line.match(/DECLARED_ROWS=(\d+)/);
            if (m) current.declaredRows = +m[1];
        }

        // portion data
        if (line.includes("PORTION=")) {

            const p = line.match(/PORTION=(\d+)/);
            if (p) current.portions = +p[1];

            const r = line.match(/RECEIVED=(\d+)/);
            if (r) current.receivedRows += +r[1];

            const l = line.match(/LEFT=(-?\d+)/);
            if (l) current.leftRows = +l[1];
        }

        // completion flag
        if (line.includes("loading of") && line.includes("is done")) {
            current.completed = true;
        }
    }

    return exports;
}


// ===============================
// ANALYSIS ENGINE
// ===============================

function analyzeExports(exports) {

    let success = 0;
    let warning = 0;
    let failed = 0;

    for (let e of exports) {

        // ===========================
        // SERVICE_COMMITMENT RULE
        // ===========================
        if (e.name.includes("SERVICE_COMMITMENT")) {

            e.status = (e.leftRows === 0) ? "Success" : "Warning";
        }

        // ===========================
        // NOT COMPLETED
        // ===========================
        else if (!e.completed) {
            e.status = "Failed";
        }

        // ===========================
        // LEFT = 0 → SUCCESS
        // ===========================
        else if (e.leftRows === 0) {
            e.status = "Success";
        }

        // ===========================
        // LEFT = -1 → VALIDATION RULE
        // ===========================
        else if (e.leftRows === -1) {

            e.status =
                (e.declaredRows > 0 &&
                 e.receivedRows >= e.declaredRows * 0.95)
                ? "Success"
                : "Warning";
        }

        // ===========================
        // LEFT > 0 → FAILED (IMPORTANT FIX)
        // ===========================
        else if (e.leftRows > 0) {
            e.status = "Failed";
        }

        // fallback
        else {
            e.status = "Warning";
        }

        if (e.status === "Success") success++;
        if (e.status === "Warning") warning++;
        if (e.status === "Failed") failed++;
    }

    return {
        exports,
        summary: {
            total: exports.length,
            success,
            warning,
            failed
        }
    };
}


// ===============================
// RENDER TABLE
// ===============================

function renderTable(data) {

    resultsBody.innerHTML = "";

    if (!data.exports.length) {
        resultsBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty">
                    No matching exports found
                </td>
            </tr>
        `;
        return;
    }

    for (let e of data.exports) {

        const row = document.createElement("tr");

        row.classList.add(
            e.status === "Success" ? "success-row" :
            e.status === "Warning" ? "warning-row" :
            "failed-row"
        );

        row.innerHTML = `
            <td>${e.name}</td>
            <td>${e.table}</td>
            <td>${e.declaredRows}</td>
            <td>${e.receivedRows}</td>
            <td>${e.portions}</td>
            <td>${e.leftRows}</td>
            <td><strong>${e.status}</strong></td>
        `;

        resultsBody.appendChild(row);
    }
}


// ===============================
// SUMMARY UPDATE
// ===============================

function updateSummary(data) {

    totalExportsEl.textContent = data.summary.total;
    successCountEl.textContent = data.summary.success;
    warningCountEl.textContent = data.summary.warning;
    failedCountEl.textContent = data.summary.failed;
}
