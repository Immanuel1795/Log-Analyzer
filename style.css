document.getElementById('fileInput').addEventListener('change', function (event) {

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {

    const lines = e.target.result.split(/\r?\n/);

    const requiredPhrases = [
      'SNOW-FLOW service',
      'SERVICE NOW QUERY SESSION BEGIN'
    ];

    const fileIsValid = requiredPhrases.every(phrase =>
      lines.some(line => line.includes(phrase))
    );

    const resultBox = document.getElementById('resultBox');
    const output = document.getElementById('output');
    const detailsSection = document.getElementById('detailsSection');
    const table = document.getElementById('detailsTable');
    const exportDateSpan = document.getElementById('exportDate');
    const sessionSummarySpan = document.getElementById('sessionSummary');
    const tableBody = document.querySelector('#detailsTable tbody');

    resultBox.classList.remove('success');
    resultBox.style.display = 'block';
    detailsSection.style.display = 'none';
    table.style.display = 'none';
    exportDateSpan.textContent = '';
    sessionSummarySpan.textContent = '';
    tableBody.innerHTML = '';

    if (!fileIsValid) {
      output.textContent = '❌ Invalid file. Please upload a valid ServiceNow export log.';
      return;
    }

    const nameRegex = /\.\.\.NAME=([A-Z0-9_]+);\s*TABLE=([a-zA-Z0-9_]+);\s*DECLARED_ROWS=(\d+)/;
    const portionRegex = /PORTION=\d+;\s*RECEIVED=\d+.*LEFT=(-?\d+)/;
    const endRegex = /loading of ([A-Z0-9_]+) is done/i;
    const dateRegex = /Date\s*:\s*(.+)/;

    const sectionStates = {};
    const details = [];

    let currentSection = null;
    let exportDate = '';

    for (const raw of lines) {

      const line = raw.trim();

      const dateMatch = line.match(dateRegex);
      if (dateMatch) {
        exportDate = dateMatch[1];
      }

      const nameMatch = line.match(nameRegex);

      if (nameMatch) {

        const name = nameMatch[1];
        const table = nameMatch[2];
        const declaredRows = nameMatch[3];

        sectionStates[name] = {
          started: true,
          ended: false,
          lastLeft: null
        };

        currentSection = name;

        if (!details.some(d => d.name === name)) {
          details.push({ name, table, declaredRows });
        }

        continue;
      }

      const portionMatch = line.match(portionRegex);

      if (portionMatch && currentSection) {

        const left = parseInt(portionMatch[1]);
        sectionStates[currentSection].lastLeft = left;

        continue;
      }

      const endMatch = line.match(endRegex);

      if (endMatch) {

        const name = endMatch[1];

        if (sectionStates[name]) {

          sectionStates[name].ended = true;

          const left = sectionStates[name].lastLeft;

          if (left !== null && left > 0) {
            sectionStates[name].invalidEnding = true;
          }

        }

        currentSection = null;

      }

    }

    const problemSections = Object.entries(sectionStates)
      .filter(([_, state]) => {

        if (!state.started) return false;

        if (state.ended && !state.invalidEnding) return false;

        if (!state.ended && state.lastLeft === 0) return false;

        return true;

      })
      .map(([name]) => name);

    if (problemSections.length === 0) {

      resultBox.classList.add('success');
      output.textContent = '✅ All sections completed correctly!';

    } else {

      output.textContent =
        `❌ Found ${problemSections.length} section(s) with issues:\n\n` +
        problemSections.map(name => ` - ${name}`).join('\n');

    }

    if (exportDate) {
      exportDateSpan.textContent = exportDate;
    }

    sessionSummarySpan.textContent = 'Session completed (no explicit end message in log).';

    if (details.length > 0) {

      detailsSection.style.display = 'block';
      table.style.display = 'table';

      details.forEach((row, index) => {

        const tr = document.createElement('tr');

        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${row.name.toLowerCase()}</td>
          <td>${row.table}</td>
          <td>${row.declaredRows}</td>
        `;

        tableBody.appendChild(tr);

      });

    }

  };

  reader.readAsText(file);

});
