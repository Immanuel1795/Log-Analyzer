// ===============================
// ServiceNow Log Analyzer (FINAL)
// ===============================

// DOM Elements
const logInput = document.getElementById("logInput");
const analyzeButton = document.getElementById("analyzeButton");
const clearButton = document.getElementById("clearButton");

const resultsBody = document.getElementById("resultsBody");

const totalExportsEl = document.getElementById("totalExports");
const successCountEl = document.getElementById("successCount");
const warningCountEl = document.getElementById("warningCount");
const failedCountEl = document.getElementById("failedCount");


// ===============================
// EVENT LISTENERS
// ===============================

analyzeButton.addEventListener("click", function () {

    const logText = logInput.value;

    const exports = parseLog(logText);

    const analyzed = analyzeExports(exports);

    renderTable(analyzed);

    updateSummary(analyzed);

});


clearButton.addEventListener("click", function () {

    logInput.value = "";

    resultsBody.innerHTML = "";

    totalExportsEl.textContent = "0";
    successCountEl.textContent = "0";
    warningCountEl.textContent = "0";
    failedCountEl.textContent = "0";

});


// ===============================
// PARSER
// ===============================

function parseLog(logText) {

    const lines = logText.split("\n");

    const exports = [];

    let currentExport = null;

    for (let line of lines) {

        // Detect export section
        if (line.includes("---------------------------")) {

            const match = line.match(/---------------------------\s+(.+?)\s+\(/);

            if (match) {

                currentExport = {
                    name: match[1],
                    table: "",
                    declaredRows: 0,
                    receivedRows: 0,
                    portions: 0,
                    leftRows: null,
                    completed: false,
                    status: "Unknown"
                };

                exports.push(currentExport);
            }
        }

        if (!currentExport) continue;

        // TABLE + DECLARED
        if (line.includes("TABLE=")) {

            const tableMatch = line.match(/TABLE=([^;]+)/);
            if (tableMatch) currentExport.table = tableMatch[1];

            const declaredMatch = line.match(/DECLARED_ROWS=(\d+)/);
            if (declaredMatch) currentExport.declaredRows = parseInt(declaredMatch[1]);
        }

        // PORTION data
        if (line.includes("PORTION=")) {

            const portionMatch = line.match(/PORTION=(\d+)/);
            if (portionMatch) currentExport.portions = parseInt(portionMatch[1]);

            const receivedMatch = line.match(/RECEIVED=(\d+)/);
            if (receivedMatch) {
                currentExport.receivedRows += parseInt(receivedMatch[1]);
            }

            const leftMatch = line.match(/LEFT=(-?\d+)/);
            if (leftMatch) currentExport.leftRows = parseInt(leftMatch[1]);
        }

        // Completion detection
        if (line.includes("loading of") && line.includes("is done")) {
            currentExport.completed = true;
        }
    }

    return exports;
}


// ===============================
// ANALYSIS ENGINE (FINAL FIXED)
// ===============================

function analyzeExports(exports) {

    let success = 0;
    let warning = 0;
    let failed = 0;

    for (const exp of exports) {

        // ===============================
        // SPECIAL CASE: SERVICE_COMMITMENT
        // ===============================
        if (exp.name && exp.name.includes("SERVICE_COMMITMENT")) {

            if (exp.leftRows === 0) {
                exp.status = "Success";
                success++;
            } else {
                exp.status = "Warning";
                warning++;
            }

            continue;
        }

        // ===============================
        // NORMAL EXPORTS
        // ===============================

        if (!exp.completed) {
            exp.status = "Failed";
            failed++;
            continue;
        }

        if (exp.leftRows === 0) {
            exp.status = "Success";
            success++;
            continue;
        }

        if (exp.leftRows === -1) {

            if (
                exp.declaredRows > 0 &&
                exp.receivedRows >= exp.declaredRows * 0.95
            ) {
                exp.status = "Success";
                success++;
            } else {
                exp.status = "Warning";
                warning++;
            }

            continue;
        }

        if (exp.leftRows > 0) {
            exp.status = "Warning";
            warning++;
            continue;
        }

        // fallback
        exp.status = "Warning";
        warning++;
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
// TABLE RENDERING
// ===============================

function renderTable(data) {

    resultsBody.innerHTML = "";

    if (!data.exports.length) {
        resultsBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty">No exports found</td>
            </tr>
        `;
        return;
    }

    for (let exp of data.exports) {

        const row = document.createElement("tr");

        if (exp.status === "Success") row.classList.add("success-row");
        if (exp.status === "Warning") row.classList.add("warning-row");
        if (exp.status === "Failed") row.classList.add("failed-row");

        row.innerHTML = `
            <td>${exp.name}</td>
            <td>${exp.table}</td>
            <td>${exp.declaredRows}</td>
            <td>${exp.receivedRows}</td>
            <td>${exp.portions}</td>
            <td>${exp.leftRows}</td>
            <td><span class="badge ${exp.status.toLowerCase()}">${exp.status}</span></td>
        `;

        resultsBody.appendChild(row);
    }
}


// ===============================
// SUMMARY
// ===============================

function updateSummary(data) {

    totalExportsEl.textContent = data.summary.total;
    successCountEl.textContent = data.summary.success;
    warningCountEl.textContent = data.summary.warning;
    failedCountEl.textContent = data.summary.failed;
}
