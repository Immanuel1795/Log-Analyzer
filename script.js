// ===============================
// ServiceNow Log Analyzer
// Part 1 of 2
// ===============================

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
// GLOBAL VARIABLES
// ===============================

let logText = "";
let fileReady = false;
let analyzedData = null;

// ===============================
// FILE UPLOAD
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

    selectedFile.textContent = "Loading file...";
    analyzeButton.disabled = true;

    const reader = new FileReader();

    reader.onload = function (e) {

        logText = e.target.result;
        fileReady = true;

        selectedFile.textContent = file.name;
        analyzeButton.disabled = false;
    };

    reader.readAsText(file);
});

// ===============================
// ANALYZE BUTTON
// ===============================

analyzeButton.addEventListener("click", function () {

    if (!fileReady) {

        alert("Please upload a ServiceNow log first.");
        return;
    }

    const exports = parseLog(logText);

    analyzedData = analyzeExports(exports);

    renderTable(analyzedData);

    updateSummary(analyzedData);

});

// ===============================
// CLEAR
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
                Upload a ServiceNow log and click Analyze
            </td>
        </tr>
    `;

    totalExportsEl.textContent = "0";
    successCountEl.textContent = "0";
    warningCountEl.textContent = "0";
    failedCountEl.textContent = "0";

});

// ===============================
// SEARCH
// ===============================

searchInput.addEventListener("input", function () {

    if (!analyzedData) return;

    const search = this.value.toLowerCase();

    const filtered = analyzedData.exports.filter(exp =>

        exp.name.toLowerCase().includes(search) ||
        exp.table.toLowerCase().includes(search) ||
        exp.status.toLowerCase().includes(search)

    );

    renderTable({

        exports: filtered,
        summary: analyzedData.summary

    });

});

// ===============================
// PARSER
// ===============================

function parseLog(logText) {

    const lines = logText.split("\n");

    const exports = [];

    let current = null;

    for (let raw of lines) {

        let line = raw.replace(/^\d{4}-\d{2}-\d{2}T.*?\s+/, "");

        if (line.includes("uploading Blob")) continue;
        if (line.includes("uploading done")) continue;

        // Detect Export Start
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
                    status: "Unknown",
                    reason: ""

                };

                exports.push(current);

            }

        }

        if (!current) continue;

        // TABLE

        if (line.includes("TABLE=")) {

            const tableMatch = line.match(/TABLE=([^;]+)/);

            if (tableMatch)
                current.table = tableMatch[1];

        }

        // DECLARED ROWS

        if (line.includes("DECLARED_ROWS=")) {

            const declaredMatch = line.match(/DECLARED_ROWS=(\d+)/);

            if (declaredMatch)
                current.declaredRows = parseInt(declaredMatch[1]);

        }

        // PORTION

        if (line.includes("PORTION=")) {

            const portionMatch = line.match(/PORTION=(\d+)/);

            if (portionMatch)
                current.portions = parseInt(portionMatch[1]);

            const receivedMatch = line.match(/RECEIVED=(\d+)/);

            if (receivedMatch)
                current.receivedRows += parseInt(receivedMatch[1]);

            const leftMatch = line.match(/LEFT=(-?\d+)/);

            if (leftMatch)
                current.leftRows = parseInt(leftMatch[1]);

        }

        // COMPLETED

        if (

            line.includes("loading of") &&
            line.includes("is done")

        ) {

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

        e.reason = "";

        // ===========================
        // SERVICE COMMITMENT
        // ===========================

        if (e.name.includes("SERVICE_COMMITMENT")) {

            if (e.leftRows === 0) {

                e.status = "Success";
                e.reason = "SERVICE_COMMITMENT completed successfully (LEFT = 0).";

            }

            else {

                e.status = "Warning";
                e.reason = "SERVICE_COMMITMENT is the final export and LEFT is not zero.";

            }

        }

        // ===========================
        // USER SCENARIO
        // Completed but last PORTION line missing
        // ===========================

        else if (

            e.completed &&
            e.leftRows === null &&
            e.declaredRows > 0 &&
            e.receivedRows > 0

        ) {

            e.status = "Success";

            e.reason =
                "Export completed successfully. Final PORTION line is missing (valid ServiceNow behavior).";

        }

        // ===========================
        // NOT COMPLETED
        // ===========================

        else if (!e.completed) {

            e.status = "Failed";

            e.reason =
                "Missing completion message (loading of ... is done).";

        }

        // ===========================
        // LEFT = 0
        // ===========================

        else if (e.leftRows === 0) {

            e.status = "Success";

            e.reason =
                "All rows exported successfully (LEFT = 0).";

        }

        // ===========================
        // LEFT = -1
        // ===========================

        else if (e.leftRows === -1) {

            if (

                e.declaredRows > 0 &&
                e.receivedRows >= e.declaredRows * 0.95

            ) {

                e.status = "Success";

                e.reason =
                    "LEFT = -1 is acceptable because received rows are at least 95% of declared rows.";

            }

            else {

                e.status = "Warning";

                e.reason =
                    "LEFT = -1 but received rows are significantly lower than declared rows.";

            }

        }

        // ===========================
        // LEFT > 0
        // ===========================

        else if (e.leftRows > 0) {

            e.status = "Failed";

            e.reason =
                `Export stopped before completion. ${e.leftRows} rows remain.`;

        }

        else {

            e.status = "Warning";

            e.reason = "Unknown export state.";

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

    for (const e of data.exports) {

        const row = document.createElement("tr");

        // Row colors
        if (e.status === "Success") {
            row.classList.add("success-row");
        }
        else if (e.status === "Warning") {
            row.classList.add("warning-row");
        }
        else {
            row.classList.add("failed-row");
        }

        // Make row clickable
        row.style.cursor = "pointer";

        row.innerHTML = `
            <td>${e.name}</td>
            <td>${e.table}</td>
            <td>${e.declaredRows}</td>
            <td>${e.receivedRows}</td>
            <td>${e.portions}</td>
            <td>${e.leftRows === null ? "-" : e.leftRows}</td>
            <td><strong>${e.status}</strong></td>
        `;

        // Show details when clicked
        row.addEventListener("click", function () {
            showDetails(e);
        });

        resultsBody.appendChild(row);
    }

}


// ===============================
// DETAILS POPUP
// ===============================

function showDetails(exp) {

    let details = `
===============================
      EXPORT DETAILS
===============================

Export Name
------------
${exp.name}

Table
------------
${exp.table}

Declared Rows
------------
${exp.declaredRows}

Received Rows
------------
${exp.receivedRows}

Portions Downloaded
------------
${exp.portions}

Rows Left
------------
${exp.leftRows === null ? "Not Available" : exp.leftRows}

Completed
------------
${exp.completed ? "Yes" : "No"}

Final Status
------------
${exp.status}

Reason
------------
${exp.reason}

===============================
`;

    alert(details);

}


// ===============================
// UPDATE SUMMARY
// ===============================

function updateSummary(data) {

    totalExportsEl.textContent = data.summary.total;
    successCountEl.textContent = data.summary.success;
    warningCountEl.textContent = data.summary.warning;
    failedCountEl.textContent = data.summary.failed;

}


// ===============================
// END OF FILE
// ===============================
