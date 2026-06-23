// app.js
const state = {
  room: {
    widthMeters: 10,
    heightMeters: 8
  },
  grid: {
    rows: 5,
    cols: 4,
    cellMeters: 2,
    alignmentX: 'center',
    alignmentY: 'center'
  },
  lamps: []
};

const elements = {
  widthInput: document.getElementById('width-input'),
  heightInput: document.getElementById('height-input'),
  gridRowsInput: document.getElementById('grid-rows-input'),
  gridColsInput: document.getElementById('grid-cols-input'),
  gridCellMetersInput: document.getElementById('grid-cell-meters-input'),
  alignLeftButton: document.getElementById('align-left-button'),
  alignCenterXButton: document.getElementById('align-center-x-button'),
  alignRightButton: document.getElementById('align-right-button'),
  alignTopButton: document.getElementById('align-top-button'),
  alignCenterYButton: document.getElementById('align-center-y-button'),
  alignBottomButton: document.getElementById('align-bottom-button'),
  exportJsonButton: document.getElementById('export-json-button'),
  exportCsvButton: document.getElementById('export-csv-button'),
  exportSvgButton: document.getElementById('export-svg-button')
};

function formatMeters(value) {
  return value.toFixed(2);
}

function normalizeAlignmentX(alignment, currentAlignment) {
  if (alignment === 'left' || alignment === 'center' || alignment === 'right') {
    return alignment;
  }
  return currentAlignment;
}

function normalizeAlignmentY(alignment, currentAlignment) {
  if (alignment === 'top' || alignment === 'center' || alignment === 'bottom') {
    return alignment;
  }
  return currentAlignment;
}

function getGridWidthMeters() {
  return state.grid.cols * state.grid.cellMeters;
}

function getGridHeightMeters() {
  return state.grid.rows * state.grid.cellMeters;
}

function getGridOffsetXMeters() {
  const gridWidth = getGridWidthMeters();
  if (state.grid.alignmentX === 'left') {
    return 0;
  } else if (state.grid.alignmentX === 'center') {
    return (state.room.widthMeters - gridWidth) / 2;
  } else if (state.grid.alignmentX === 'right') {
    return state.room.widthMeters - gridWidth;
  }
  return 0;
}

function getGridOffsetYMeters() {
  const gridHeight = getGridHeightMeters();
  if (state.grid.alignmentY === 'top') {
    return 0;
  } else if (state.grid.alignmentY === 'center') {
    return (state.room.heightMeters - gridHeight) / 2;
  } else if (state.grid.alignmentY === 'bottom') {
    return state.room.heightMeters - gridHeight;
  }
  return 0;
}

function getLeftMargin() {
  const gridOffsetX = getGridOffsetXMeters();
  return Math.max(0, gridOffsetX);
}

function getRightMargin() {
  const gridWidth = getGridWidthMeters();
  const gridOffsetX = getGridOffsetXMeters();
  return Math.max(0, state.room.widthMeters - (gridOffsetX + gridWidth));
}

function getTopMargin() {
  const gridOffsetY = getGridOffsetYMeters();
  return Math.max(0, gridOffsetY);
}

function getBottomMargin() {
  const gridHeight = getGridHeightMeters();
  const gridOffsetY = getGridOffsetYMeters();
  return Math.max(0, state.room.heightMeters - (gridOffsetY + gridHeight));
}

function calculateCuttingDetails() {
  const leftMargin = getLeftMargin();
  const rightMargin = getRightMargin();
  const topMargin = getTopMargin();
  const bottomMargin = getBottomMargin();

  const cuttingDetails = [];

  if (leftMargin > 0) {
    cuttingDetails.push({
      id: 'C1',
      zone: 'left',
      widthMeters: leftMargin,
      heightMeters: state.room.heightMeters,
      quantity: Math.ceil(leftMargin / state.grid.cellMeters)
    });
  }

  if (rightMargin > 0) {
    cuttingDetails.push({
      id: 'C2',
      zone: 'right',
      widthMeters: rightMargin,
      heightMeters: state.room.heightMeters,
      quantity: Math.ceil(rightMargin / state.grid.cellMeters)
    });
  }

  if (topMargin > 0) {
    cuttingDetails.push({
      id: 'C3',
      zone: 'top',
      widthMeters: state.room.widthMeters,
      heightMeters: topMargin,
      quantity: Math.ceil(topMargin / state.grid.cellMeters)
    });
  }

  if (bottomMargin > 0) {
    cuttingDetails.push({
      id: 'C4',
      zone: 'bottom',
      widthMeters: state.room.widthMeters,
      heightMeters: bottomMargin,
      quantity: Math.ceil(bottomMargin / state.grid.cellMeters)
    });
  }

  return cuttingDetails;
}

function updateDimensions() {
  const gridWidth = getGridWidthMeters();
  const gridHeight = getGridHeightMeters();
  const gridOffsetX = getGridOffsetXMeters();
  const gridOffsetY = getGridOffsetYMeters();

  elements.bottomLabel.textContent = `${state.grid.cols} Module x ${formatMeters(state.grid.cellMeters)} m = ${formatMeters(gridWidth)} m, ${horizontalDescription}`;
  elements.widthMeta.textContent = `${widthText} m gesamt`;
  elements.heightMeta.textContent = `${heightText} m gesamt`;
  elements.widthGridMeta.textContent = `${state.grid.cols} Module = ${formatMeters(gridWidth)} m, ${horizontalDescription}`;
  elements.heightGridMeta.textContent = `${state.grid.rows} Module = ${formatMeters(gridHeight)} m, ${verticalDescription}`;
  elements.ceilingArea.setAttribute('aria-label', `Decke mit ${widthText} m Länge und ${heightText} m Höhe`);

  updateAlignmentControls();
  updateLampPositions();
  updateXChain();

  const cuttingDetails = calculateCuttingDetails();
  displayCuttingDetails(cuttingDetails);
}

function getExportRows() {
  return state.lamps.map(lamp => {
    const topY = lamp.anchorY === 'top'
      ? lamp.edgeDistanceY
      : state.room.heightMeters - lamp.edgeDistanceY - lamp.heightMeters;
    const bottomY = topY + lamp.heightMeters;

    return {
      id: lamp.id,
      anchorY: lamp.anchorY,
      centerX: roundMeters(lamp.centerX),
      edgeDistanceY: roundMeters(lamp.edgeDistanceY),
      widthMeters: roundMeters(lamp.widthMeters),
      heightMeters: roundMeters(lamp.heightMeters),
      leftX: roundMeters(getLampLeftX(lamp)),
      rightX: roundMeters(getLampRightX(lamp)),
      topY: roundMeters(topY),
      bottomY: roundMeters(bottomY),
      centerY: roundMeters(getLampCenterY(lamp)),
    };
  });
}

function downloadBlob(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  downloadBlob('deckenschema-config.json', `${JSON.stringify(buildConfig(), null, 2)}\n`, 'application/json;charset=utf-8');
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
  const headers = [
    'id',
    'anchorY',
    'centerX_m',
    'edgeDistanceY_m',
    'width_m',
    'height_m',
    'leftX_m',
    'rightX_m',
    'topY_m',
    'bottomY_m',
    'centerY_m',
  ];
  const rows = getExportRows().map(row => [
    row.id,
    row.anchorY,
    row.centerX,
    row.edgeDistanceY,
    row.widthMeters,
    row.heightMeters,
    row.leftX,
    row.rightX,
    row.topY,
    row.bottomY,
    row.centerY,
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(csvEscape).join(','))
    .join('\n');

  downloadBlob('deckenschema-lampen.csv', `${csv}\n`, 'text/csv;charset=utf-8');
}

function svgText(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function exportSvg() {
  const scale = 100;
  const margin = 40;
  const width = Math.ceil(state.room.widthMeters * scale + margin * 2);
  const height = Math.ceil(state.room.heightMeters * scale + margin * 2);
  const gridWidth = getGridWidthMeters();
  const gridHeight = getGridHeightMeters();
  const gridOffsetX = getGridOffsetXMeters();
  const gridOffsetY = getGridOffsetYMeters();
  const parts = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  parts.push(`<rect x="${margin}" y="${margin}" width="${state.room.widthMeters * scale}" height="${state.room.heightMeters * scale}" fill="#fdfcf9" stroke="#4e4a44" stroke-width="2"/>`);

  for (let col = 0; col <= state.grid.cols; col += 1) {
    const x = margin + (gridOffsetX + col * state.grid.cellMeters) * scale;
    parts.push(`<line x1="${x}" y1="${margin + gridOffsetY * scale}" x2="${x}" y2="${margin + (gridOffsetY + gridHeight) * scale}" stroke="#8f8a80" stroke-width="1"/>`);
  }

  for (let row = 0; row <= state.grid.rows; row += 1) {
    const y = margin + (gridOffsetY + row * state.grid.cellMeters) * scale;
    parts.push(`<line x1="${margin + gridOffsetX * scale}" y1="${y}" x2="${margin + (gridOffsetX + gridWidth) * scale}" y2="${y}" stroke="#8f8a80" stroke-width="1"/>`);
  }

  getExportRows().forEach(row => {
    const x = margin + row.leftX * scale;
    const y = margin + row.topY * scale;
    const lamp = state.lamps.find(item => item.id === row.id);
    const lampWidth = (lamp?.widthMeters ?? row.widthMeters) * scale;
    const lampHeight = (lamp?.heightMeters ?? row.heightMeters) * scale;
    parts.push(`<rect x="${x}" y="${y}" width="${lampWidth}" height="${lampHeight}" fill="#f7f7f7" stroke="#5e5a53" stroke-width="2"/>`);
    parts.push(`<text x="${x + lampWidth / 2}" y="${y + lampHeight / 2 + 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700">${svgText(row.id)}</text>`);
  });

  parts.push(`<text x="${margin}" y="24" font-family="Arial, sans-serif" font-size="16" font-weight="700">Deckenschema ${formatMeters(state.room.widthMeters)} m × ${formatMeters(state.room.heightMeters)} m</text>`);
  parts.push('</svg>');

  downloadBlob('deckenschema.svg', `${parts.join('\n')}\n`, 'image/svg+xml;charset=utf-8');
}

function setGridAlignment(alignmentX, alignmentY) {
  state.grid.alignmentX = normalizeAlignmentX(alignmentX, state.grid.alignmentX);
  state.grid.alignmentY = normalizeAlignmentY(alignmentY, state.grid.alignmentY);
  updateDimensions();
  saveConfig();
}

function bindGlobalEvents() {
  bindAutoWidth(elements.widthInput);
  bindAutoWidth(elements.heightInput);
  bindAutoWidth(elements.lampWidthInput);
  bindAutoWidth(elements.lampHeightInput);

  bindConfirmedInput(elements.widthInput, value => {
    state.room.widthMeters = value;
    updateDimensions();
    saveConfigDebounced();
  });

  bindConfirmedInput(elements.heightInput, value => {
    state.room.heightMeters = value;
    updateDimensions();
    saveConfigDebounced();
  });

  elements.lampWidthInput.addEventListener('input', markLampSizeDraft);
  elements.lampHeightInput.addEventListener('input', markLampSizeDraft);

  elements.lampWidthInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      acceptLampSizeDraft();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelLampSizeDraft();
    }
  });

  elements.lampHeightInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      acceptLampSizeDraft();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelLampSizeDraft();
    }
  });

  elements.lampSizeAccept.addEventListener('click', acceptLampSizeDraft);
  elements.lampSizeCancel.addEventListener('click', cancelLampSizeDraft);

  elements.alignLeftButton.addEventListener('click', () => setGridAlignment('left', state.grid.alignmentY));
  elements.alignCenterXButton.addEventListener('click', () => setGridAlignment('center', state.grid.alignmentY));
  elements.alignRightButton.addEventListener('click', () => setGridAlignment('right', state.grid.alignmentY));
  elements.alignTopButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'top'));
  elements.alignCenterYButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'center'));
  elements.alignBottomButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'bottom'));

  elements.exportJsonButton.addEventListener('click', exportJson);
  elements.exportCsvButton.addEventListener('click', exportCsv);
  elements.exportSvgButton.addEventListener('click', exportSvg);
  elements.printButton.addEventListener('click', () => window.print());

  window.addEventListener('resize', updateDimensions);
}

async function init() {
  bindGlobalEvents();
  await loadConfig();
  applyStateToInputs();
  buildGrid();
  buildLampElements();
  buildXChainElements();
  updateDimensions();
}

init();
