import { TableModel } from './tableModel';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export function getHtml(cspSource: string, model: TableModel, title: string): string {
  const nonce = getNonce();

  if (model.columns.length === 0) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: var(--vscode-font-family); padding: 1rem;">
<p>${escapeHtml(title)} does not contain any data to display as a table (empty array).</p>
</body></html>`;
  }

  // Rows/columns are rendered client-side via DOM APIs (never innerHTML), so no HTML-escaping
  // of cell data is needed here. Only guard against a cell value containing the literal
  // string "</script" which would otherwise terminate the script block early.
  const dataJson = JSON.stringify({ columns: model.columns, rows: model.rows })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>Table: ${escapeHtml(title)}</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-editor-foreground);
    background-color: var(--vscode-editor-background);
    padding: 0;
    margin: 0;
  }
  #toolbar {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background-color: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  #search {
    flex: 1;
    max-width: 24rem;
    padding: 0.3rem 0.5rem;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
  }
  #column-search {
    flex: 0 0 auto;
    width: 12rem;
    padding: 0.3rem 0.5rem;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
  }
  #count {
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
    white-space: nowrap;
  }
  .dropdown {
    position: relative;
    flex: 0 0 auto;
  }
  #column-picker-toggle {
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 0.3rem 0.6rem;
    border-radius: 2px;
    cursor: pointer;
    font: inherit;
  }
  #column-picker-toggle:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }
  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 0.5rem;
    max-height: 16rem;
    overflow-y: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 3;
    min-width: 12rem;
  }
  .dropdown-actions {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 0.4rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .dropdown-actions button {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    padding: 0;
    font-size: 0.85em;
  }
  .column-option {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0;
    cursor: pointer;
    white-space: nowrap;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9em;
  }
  th, td {
    text-align: left;
    padding: 0.35rem 0.75rem;
    border-bottom: 1px solid var(--vscode-panel-border);
    white-space: nowrap;
    max-width: 32rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  thead {
    position: sticky;
    top: 2.6rem;
    z-index: 1;
    background-color: var(--vscode-editor-background);
  }
  th {
    cursor: pointer;
    user-select: none;
  }
  th .col-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  th .sort-indicator {
    opacity: 0.7;
    font-size: 0.8em;
  }
  .filter-row th {
    cursor: default;
    padding: 0.25rem 0.5rem;
  }
  .filter-row input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.2rem 0.4rem;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    font-size: 0.95em;
  }
  tr:hover td {
    background-color: var(--vscode-list-hoverBackground);
  }
  mark {
    background-color: var(--vscode-editor-findMatchHighlightBackground, #ffd54f80);
    color: inherit;
    border-radius: 2px;
  }
</style>
</head>
<body>
<div id="toolbar">
  <input id="search" type="text" placeholder="Search all columns..." autofocus>
  <input id="column-search" type="text" placeholder="Filter columns...">
  <div class="dropdown">
    <button id="column-picker-toggle" type="button">Columns ▾</button>
    <div id="column-picker-menu" class="dropdown-menu" hidden></div>
  </div>
  <span id="count"></span>
</div>
<table id="table">
  <thead>
    <tr id="header-row"></tr>
    <tr id="filter-row" class="filter-row"></tr>
  </thead>
  <tbody id="body"></tbody>
</table>
<script nonce="${nonce}">
  const DATA = ${dataJson};
  const columns = DATA.columns;
  const allRows = DATA.rows;

  const searchInput = document.getElementById('search');
  const columnSearchInput = document.getElementById('column-search');
  const pickerToggle = document.getElementById('column-picker-toggle');
  const pickerMenu = document.getElementById('column-picker-menu');
  const countEl = document.getElementById('count');
  const headerRow = document.getElementById('header-row');
  const filterRow = document.getElementById('filter-row');
  const body = document.getElementById('body');

  let globalQuery = '';
  let columnQuery = '';
  const columnFilters = columns.map(() => '');
  const columnSelected = columns.map(() => true);
  let sortColumn = -1;
  let sortDir = 1;

  function isColumnVisible(index) {
    if (!columnSelected[index]) {
      return false;
    }
    return !columnQuery || columns[index].toLowerCase().includes(columnQuery);
  }

  function buildColumnPicker() {
    const actions = document.createElement('div');
    actions.className = 'dropdown-actions';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.textContent = 'All';
    selectAllBtn.addEventListener('click', () => {
      columnSelected.fill(true);
      syncCheckboxes();
      render();
    });

    const selectNoneBtn = document.createElement('button');
    selectNoneBtn.type = 'button';
    selectNoneBtn.textContent = 'None';
    selectNoneBtn.addEventListener('click', () => {
      columnSelected.fill(false);
      syncCheckboxes();
      render();
    });

    actions.appendChild(selectAllBtn);
    actions.appendChild(selectNoneBtn);
    pickerMenu.appendChild(actions);

    columns.forEach((col, index) => {
      const label = document.createElement('label');
      label.className = 'column-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.dataset.col = String(index);
      checkbox.addEventListener('change', () => {
        columnSelected[index] = checkbox.checked;
        render();
      });
      const text = document.createElement('span');
      text.textContent = col;
      label.appendChild(checkbox);
      label.appendChild(text);
      pickerMenu.appendChild(label);
    });
  }

  function syncCheckboxes() {
    pickerMenu.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = columnSelected[Number(cb.dataset.col)];
    });
  }

  pickerToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    pickerMenu.hidden = !pickerMenu.hidden;
  });
  document.addEventListener('click', (event) => {
    if (!pickerMenu.hidden && !pickerMenu.contains(event.target) && event.target !== pickerToggle) {
      pickerMenu.hidden = true;
    }
  });

  function updateColumnVisibility() {
    columns.forEach((_, index) => {
      const display = isColumnVisible(index) ? '' : 'none';
      headerRow.children[index].style.display = display;
      filterRow.children[index].style.display = display;
    });
  }

  function buildHeaders() {
    columns.forEach((col, index) => {
      const th = document.createElement('th');
      const label = document.createElement('span');
      label.className = 'col-label';
      const text = document.createElement('span');
      text.textContent = col;
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator';
      indicator.dataset.col = String(index);
      label.appendChild(text);
      label.appendChild(indicator);
      th.appendChild(label);
      th.addEventListener('click', () => {
        if (sortColumn === index) {
          sortDir = -sortDir;
        } else {
          sortColumn = index;
          sortDir = 1;
        }
        render();
      });
      headerRow.appendChild(th);

      const filterTh = document.createElement('th');
      const filterInput = document.createElement('input');
      filterInput.type = 'text';
      filterInput.placeholder = 'Filter...';
      filterInput.addEventListener('input', () => {
        columnFilters[index] = filterInput.value.trim().toLowerCase();
        render();
      });
      filterTh.appendChild(filterInput);
      filterRow.appendChild(filterTh);
    });
  }

  function updateSortIndicators() {
    headerRow.querySelectorAll('.sort-indicator').forEach((el) => {
      const idx = Number(el.dataset.col);
      el.textContent = idx === sortColumn ? (sortDir === 1 ? '▲' : '▼') : '';
    });
  }

  function highlightCell(td, text, query) {
    td.textContent = '';
    if (!query) {
      td.appendChild(document.createTextNode(text));
      return;
    }
    const lower = text.toLowerCase();
    let start = 0;
    let idx = lower.indexOf(query);
    if (idx === -1) {
      td.appendChild(document.createTextNode(text));
      return;
    }
    while (idx !== -1) {
      if (idx > start) {
        td.appendChild(document.createTextNode(text.slice(start, idx)));
      }
      const mark = document.createElement('mark');
      mark.textContent = text.slice(idx, idx + query.length);
      td.appendChild(mark);
      start = idx + query.length;
      idx = lower.indexOf(query, start);
    }
    if (start < text.length) {
      td.appendChild(document.createTextNode(text.slice(start)));
    }
  }

  function render() {
    let indices = allRows.map((_, i) => i).filter((i) => {
      const row = allRows[i];
      if (globalQuery && !row.some((cell) => cell.toLowerCase().includes(globalQuery))) {
        return false;
      }
      for (let c = 0; c < columns.length; c++) {
        const f = columnFilters[c];
        if (f && !row[c].toLowerCase().includes(f)) {
          return false;
        }
      }
      return true;
    });

    if (sortColumn >= 0) {
      const allNumeric = indices.every((i) => {
        const v = allRows[i][sortColumn].trim();
        return v === '' || !isNaN(Number(v));
      });
      indices = indices.slice().sort((a, b) => {
        const va = allRows[a][sortColumn];
        const vb = allRows[b][sortColumn];
        let cmp;
        if (allNumeric) {
          cmp = (Number(va) || 0) - (Number(vb) || 0);
        } else {
          cmp = va.localeCompare(vb);
        }
        return cmp * sortDir;
      });
    }

    body.textContent = '';
    for (const i of indices) {
      const tr = document.createElement('tr');
      allRows[i].forEach((cell, colIndex) => {
        const td = document.createElement('td');
        highlightCell(td, cell, globalQuery);
        if (!isColumnVisible(colIndex)) {
          td.style.display = 'none';
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    }

    countEl.textContent = indices.length + ' / ' + allRows.length + ' rows';
    updateSortIndicators();
    updateColumnVisibility();
  }

  searchInput.addEventListener('input', () => {
    globalQuery = searchInput.value.trim().toLowerCase();
    render();
  });

  columnSearchInput.addEventListener('input', () => {
    columnQuery = columnSearchInput.value.trim().toLowerCase();
    render();
  });

  buildHeaders();
  buildColumnPicker();
  render();
</script>
</body>
</html>`;
}
