const EPS = 0.000001;
const DISPLAY_DIGITS = 3;
const CONFIG_URL = 'config.json';

const DEFAULT_STATE = {
  schemaVersion: 2,
  room: {
    widthMeters: 8.861,
    heightMeters: 4.865,
  },
  grid: {
    rows: 8,
    cols: 14,
    cellMeters: 0.6,
    alignmentX: 'center',
    alignmentY: 'center',
  },
  lamps: [],
  measureFlags: {},
};

const state = structuredClone(DEFAULT_STATE);
let latestCuttingPlan = null;
let saveTimer = null;

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
  exportSvgButton: document.getElementById('export-svg-button'),
  ceilingSvg: document.getElementById('ceiling-svg'),
  cuttingDetailsTable: document.getElementById('cutting-details-table'),
  panelPackingTable: document.getElementById('panel-packing-table'),
  fullPanelCount: document.getElementById('full-panel-count'),
  extraPanelCount: document.getElementById('extra-panel-count'),
  totalPanelCount: document.getElementById('total-panel-count'),
  wasteArea: document.getElementById('waste-area'),
  calculationWarning: document.getElementById('calculation-warning'),
  drawingMeta: document.getElementById('drawing-meta'),
};

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanNumber(value) {
  if (!Number.isFinite(value) || Math.abs(value) < EPS) {
    return 0;
  }
  return value;
}

function roundTo(value, digits = DISPLAY_DIGITS) {
  const factor = 10 ** digits;
  const number = cleanNumber(value);
  const roundingNudge = number === 0 ? 0 : Math.sign(number) * 1e-9;
  return Math.round((number + roundingNudge) * factor) / factor;
}

function formatMeters(value, digits = DISPLAY_DIGITS) {
  return roundTo(value, digits).toFixed(digits);
}

function formatArea(value) {
  return `${formatMeters(value)} m²`;
}

function normalizeAlignmentX(alignment, currentAlignment = 'center') {
  return ['left', 'center', 'right'].includes(alignment) ? alignment : currentAlignment;
}

function normalizeAlignmentY(alignment, currentAlignment = 'center') {
  return ['top', 'center', 'bottom'].includes(alignment) ? alignment : currentAlignment;
}

function mergeState(config) {
  if (!config || typeof config !== 'object') {
    return;
  }

  state.schemaVersion = Number(config.schemaVersion) || DEFAULT_STATE.schemaVersion;
  state.room.widthMeters = positiveNumber(config.room?.widthMeters, DEFAULT_STATE.room.widthMeters);
  state.room.heightMeters = positiveNumber(config.room?.heightMeters, DEFAULT_STATE.room.heightMeters);
  state.grid.rows = positiveInteger(config.grid?.rows, DEFAULT_STATE.grid.rows);
  state.grid.cols = positiveInteger(config.grid?.cols, DEFAULT_STATE.grid.cols);
  state.grid.cellMeters = positiveNumber(config.grid?.cellMeters, DEFAULT_STATE.grid.cellMeters);
  state.grid.alignmentX = normalizeAlignmentX(config.grid?.alignmentX, DEFAULT_STATE.grid.alignmentX);
  state.grid.alignmentY = normalizeAlignmentY(config.grid?.alignmentY, DEFAULT_STATE.grid.alignmentY);
  state.lamps = Array.isArray(config.lamps) ? config.lamps.map(normalizeLamp).filter(Boolean) : [];
  state.measureFlags = config.measureFlags && typeof config.measureFlags === 'object' ? config.measureFlags : {};
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeLamp(lamp) {
  if (!lamp || typeof lamp !== 'object') {
    return null;
  }

  return {
    id: String(lamp.id || 'L'),
    centerX: Number(lamp.centerX) || 0,
    anchorY: lamp.anchorY === 'bottom' ? 'bottom' : 'top',
    edgeDistanceY: Number(lamp.edgeDistanceY) || 0,
    widthMeters: positiveNumber(lamp.widthMeters, state.grid.cellMeters),
    heightMeters: positiveNumber(lamp.heightMeters, state.grid.cellMeters),
  };
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
  }

  if (state.grid.alignmentX === 'right') {
    return state.room.widthMeters - gridWidth;
  }

  return (state.room.widthMeters - gridWidth) / 2;
}

function getGridOffsetYMeters() {
  const gridHeight = getGridHeightMeters();

  if (state.grid.alignmentY === 'top') {
    return 0;
  }

  if (state.grid.alignmentY === 'bottom') {
    return state.room.heightMeters - gridHeight;
  }

  return (state.room.heightMeters - gridHeight) / 2;
}

function getGridRect() {
  return {
    x: getGridOffsetXMeters(),
    y: getGridOffsetYMeters(),
    width: getGridWidthMeters(),
    height: getGridHeightMeters(),
  };
}

function getFullPanelCount() {
  return state.grid.rows * state.grid.cols;
}

function getNonOverlappingCutZones() {
  const roomWidth = state.room.widthMeters;
  const roomHeight = state.room.heightMeters;
  const grid = getGridRect();
  const gridLeft = clamp(grid.x, 0, roomWidth);
  const gridRight = clamp(grid.x + grid.width, 0, roomWidth);
  const gridTop = clamp(grid.y, 0, roomHeight);
  const gridBottom = clamp(grid.y + grid.height, 0, roomHeight);
  const zones = [];

  const topHeight = Math.max(0, grid.y);
  if (topHeight > EPS) {
    zones.push({
      id: 'top',
      label: 'oben',
      x: 0,
      y: 0,
      width: roomWidth,
      height: Math.min(topHeight, roomHeight),
    });
  }

  const bottomStart = grid.y + grid.height;
  if (bottomStart < roomHeight - EPS) {
    zones.push({
      id: 'bottom',
      label: 'unten',
      x: 0,
      y: Math.max(0, bottomStart),
      width: roomWidth,
      height: roomHeight - Math.max(0, bottomStart),
    });
  }

  const middleHeight = Math.max(0, gridBottom - gridTop);

  if (gridLeft > EPS && middleHeight > EPS) {
    zones.push({
      id: 'left',
      label: 'links',
      x: 0,
      y: gridTop,
      width: gridLeft,
      height: middleHeight,
    });
  }

  if (gridRight < roomWidth - EPS && middleHeight > EPS) {
    zones.push({
      id: 'right',
      label: 'rechts',
      x: gridRight,
      y: gridTop,
      width: roomWidth - gridRight,
      height: middleHeight,
    });
  }

  return zones.filter(zone => zone.width > EPS && zone.height > EPS);
}

function splitLengthIntoPanelSegments(length, maxSegment) {
  const result = [];
  let remaining = cleanNumber(length);

  while (remaining > EPS) {
    const segment = remaining > maxSegment + EPS ? maxSegment : remaining;
    result.push(cleanNumber(segment));
    remaining = cleanNumber(remaining - segment);
  }

  return result;
}

function getCanonicalSize(width, height) {
  const a = roundTo(Math.max(width, height));
  const b = roundTo(Math.min(width, height));
  return {
    width: a,
    height: b,
    key: `${a}x${b}`,
  };
}

function createCutPieces(zones) {
  const pieces = [];
  const panelSize = state.grid.cellMeters;

  zones.forEach(zone => {
    const colWidths = splitLengthIntoPanelSegments(zone.width, panelSize);
    const rowHeights = splitLengthIntoPanelSegments(zone.height, panelSize);
    let currentY = zone.y;

    rowHeights.forEach(rowHeight => {
      let currentX = zone.x;

      colWidths.forEach(colWidth => {
        const canonical = getCanonicalSize(colWidth, rowHeight);
        pieces.push({
          id: `tmp-${pieces.length + 1}`,
          groupKey: canonical.key,
          groupId: '',
          zoneId: zone.id,
          zoneLabel: zone.label,
          x: currentX,
          y: currentY,
          width: colWidth,
          height: rowHeight,
          canonicalWidth: canonical.width,
          canonicalHeight: canonical.height,
          area: colWidth * rowHeight,
        });
        currentX += colWidth;
      });

      currentY += rowHeight;
    });
  });

  return pieces;
}

function groupCutPieces(pieces) {
  const groupsByKey = new Map();

  pieces.forEach(piece => {
    if (!groupsByKey.has(piece.groupKey)) {
      groupsByKey.set(piece.groupKey, {
        id: `Z${groupsByKey.size + 1}`,
        key: piece.groupKey,
        width: piece.canonicalWidth,
        height: piece.canonicalHeight,
        quantity: 0,
        area: 0,
        zones: new Set(),
      });
    }

    const group = groupsByKey.get(piece.groupKey);
    group.quantity += 1;
    group.area += piece.area;
    group.zones.add(piece.zoneLabel);
    piece.groupId = group.id;
  });

  return [...groupsByKey.values()].map(group => ({
    ...group,
    zones: [...group.zones],
  }));
}

function rectsIntersect(a, b) {
  return !(
    a.x + a.width <= b.x + EPS ||
    b.x + b.width <= a.x + EPS ||
    a.y + a.height <= b.y + EPS ||
    b.y + b.height <= a.y + EPS
  );
}

function containsRect(outer, inner) {
  return outer.x <= inner.x + EPS &&
    outer.y <= inner.y + EPS &&
    outer.x + outer.width >= inner.x + inner.width - EPS &&
    outer.y + outer.height >= inner.y + inner.height - EPS;
}

function pruneFreeRects(freeRects) {
  return freeRects
    .filter(rect => rect.width > EPS && rect.height > EPS)
    .filter((rect, index, list) => !list.some((other, otherIndex) => otherIndex !== index && containsRect(other, rect)));
}

function splitFreeRects(freeRects, placedRect) {
  const result = [];

  freeRects.forEach(rect => {
    if (!rectsIntersect(rect, placedRect)) {
      result.push(rect);
      return;
    }

    if (placedRect.x > rect.x + EPS) {
      result.push({
        x: rect.x,
        y: rect.y,
        width: placedRect.x - rect.x,
        height: rect.height,
      });
    }

    if (placedRect.x + placedRect.width < rect.x + rect.width - EPS) {
      result.push({
        x: placedRect.x + placedRect.width,
        y: rect.y,
        width: rect.x + rect.width - (placedRect.x + placedRect.width),
        height: rect.height,
      });
    }

    if (placedRect.y > rect.y + EPS) {
      result.push({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: placedRect.y - rect.y,
      });
    }

    if (placedRect.y + placedRect.height < rect.y + rect.height - EPS) {
      result.push({
        x: rect.x,
        y: placedRect.y + placedRect.height,
        width: rect.width,
        height: rect.y + rect.height - (placedRect.y + placedRect.height),
      });
    }
  });

  return pruneFreeRects(result);
}

function findBestPlacement(bin, item, panelSize) {
  let best = null;
  const orientations = [
    { width: item.width, height: item.height, rotated: false },
  ];

  if (Math.abs(item.width - item.height) > EPS) {
    orientations.push({ width: item.height, height: item.width, rotated: true });
  }

  bin.freeRects.forEach((freeRect, freeIndex) => {
    orientations.forEach(orientation => {
      if (orientation.width <= freeRect.width + EPS && orientation.height <= freeRect.height + EPS) {
        const areaWaste = freeRect.width * freeRect.height - orientation.width * orientation.height;
        const shortSideWaste = Math.min(freeRect.width - orientation.width, freeRect.height - orientation.height);
        const score = areaWaste * panelSize + shortSideWaste;

        if (!best || score < best.score) {
          best = {
            freeIndex,
            x: freeRect.x,
            y: freeRect.y,
            width: orientation.width,
            height: orientation.height,
            rotated: orientation.rotated,
            score,
          };
        }
      }
    });
  });

  return best;
}

function placeItemInBin(bin, item, placement) {
  const placedRect = {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
  };

  bin.placements.push({
    ...placedRect,
    groupId: item.groupId,
    groupKey: item.groupKey,
    rotated: placement.rotated,
  });
  bin.freeRects = splitFreeRects(bin.freeRects, placedRect);
}

function packCutPiecesIntoWholePanels(pieces) {
  const panelSize = state.grid.cellMeters;
  const bins = [];
  const items = pieces
    .map(piece => ({
      groupId: piece.groupId,
      groupKey: piece.groupKey,
      width: piece.canonicalWidth,
      height: piece.canonicalHeight,
      area: piece.canonicalWidth * piece.canonicalHeight,
    }))
    .sort((a, b) => {
      const areaDiff = b.area - a.area;
      if (Math.abs(areaDiff) > EPS) {
        return areaDiff;
      }
      return Math.max(b.width, b.height) - Math.max(a.width, a.height);
    });

  items.forEach(item => {
    let placed = false;

    for (const bin of bins) {
      const placement = findBestPlacement(bin, item, panelSize);
      if (placement) {
        placeItemInBin(bin, item, placement);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const bin = {
        id: bins.length + 1,
        freeRects: [{ x: 0, y: 0, width: panelSize, height: panelSize }],
        placements: [],
      };
      const placement = findBestPlacement(bin, item, panelSize);

      if (!placement) {
        throw new Error(`Zuschnitt ${item.groupId} passt nicht in ein Paneel ${formatMeters(panelSize)} × ${formatMeters(panelSize)} m.`);
      }

      placeItemInBin(bin, item, placement);
      bins.push(bin);
    }
  });

  return bins.map(bin => ({
    id: bin.id,
    placements: bin.placements,
    usedArea: bin.placements.reduce((sum, placement) => sum + placement.width * placement.height, 0),
    wasteArea: panelSize * panelSize - bin.placements.reduce((sum, placement) => sum + placement.width * placement.height, 0),
  }));
}

function calculateCuttingPlan() {
  const zones = getNonOverlappingCutZones();
  const pieces = createCutPieces(zones);
  const groups = groupCutPieces(pieces);
  const panels = packCutPiecesIntoWholePanels(pieces);
  const cutArea = pieces.reduce((sum, piece) => sum + piece.area, 0);
  const extraPanelArea = panels.length * state.grid.cellMeters * state.grid.cellMeters;

  return {
    zones,
    pieces,
    groups,
    panels,
    cutArea,
    extraPanelCount: panels.length,
    wasteArea: Math.max(0, extraPanelArea - cutArea),
  };
}

function setButtonActive(button, isActive) {
  button.classList.toggle('is-active', isActive);
  button.setAttribute('aria-pressed', String(isActive));
}

function updateAlignmentControls() {
  setButtonActive(elements.alignLeftButton, state.grid.alignmentX === 'left');
  setButtonActive(elements.alignCenterXButton, state.grid.alignmentX === 'center');
  setButtonActive(elements.alignRightButton, state.grid.alignmentX === 'right');
  setButtonActive(elements.alignTopButton, state.grid.alignmentY === 'top');
  setButtonActive(elements.alignCenterYButton, state.grid.alignmentY === 'center');
  setButtonActive(elements.alignBottomButton, state.grid.alignmentY === 'bottom');
}

function updateTotals(plan) {
  const fullPanelCount = getFullPanelCount();
  elements.fullPanelCount.textContent = `${fullPanelCount}`;
  elements.extraPanelCount.textContent = `${plan.extraPanelCount}`;
  elements.totalPanelCount.textContent = `${fullPanelCount + plan.extraPanelCount}`;
  elements.wasteArea.textContent = formatArea(plan.wasteArea);
  elements.drawingMeta.textContent = `${formatMeters(state.room.widthMeters)} × ${formatMeters(state.room.heightMeters)} m, Raster ${state.grid.cols} × ${state.grid.rows}`;

  const gridTooWide = getGridWidthMeters() > state.room.widthMeters + EPS;
  const gridTooHigh = getGridHeightMeters() > state.room.heightMeters + EPS;

  if (gridTooWide || gridTooHigh) {
    elements.calculationWarning.hidden = false;
    elements.calculationWarning.textContent = 'Warnung: Das Raster ist größer als der Raum. Randstücke werden nur für sichtbare Restflächen innerhalb des Raums berechnet.';
  } else {
    elements.calculationWarning.hidden = true;
    elements.calculationWarning.textContent = '';
  }
}

function clearTableBody(tbody, colspan, message) {
  tbody.innerHTML = '';
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.className = 'empty-row';
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function displayCuttingDetails(plan) {
  elements.cuttingDetailsTable.innerHTML = '';

  if (plan.groups.length === 0) {
    clearTableBody(elements.cuttingDetailsTable, 5, 'Keine Randstücke notwendig.');
    return;
  }

  plan.groups.forEach(group => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${group.id}</strong></td>
      <td>${formatMeters(group.width)} × ${formatMeters(group.height)}</td>
      <td>${group.quantity}</td>
      <td>${group.zones.join(', ')}</td>
      <td>${formatArea(group.area)}</td>
    `;
    elements.cuttingDetailsTable.appendChild(row);
  });
}

function summarizePanelPlacements(placements) {
  const counts = new Map();

  placements.forEach(placement => {
    counts.set(placement.groupId, (counts.get(placement.groupId) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'de', { numeric: true }))
    .map(([groupId, quantity]) => `${quantity} × ${groupId}`)
    .join(', ');
}

function displayPanelPacking(plan) {
  elements.panelPackingTable.innerHTML = '';

  if (plan.panels.length === 0) {
    clearTableBody(elements.panelPackingTable, 3, 'Keine zusätzlichen Paneele erforderlich.');
    return;
  }

  plan.panels.forEach(panel => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>P${panel.id}</strong></td>
      <td>${summarizePanelPlacements(panel.placements)}</td>
      <td>${formatArea(panel.usedArea)}</td>
    `;
    elements.panelPackingTable.appendChild(row);
  });
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function appendSvgText(parent, text, attrs = {}) {
  const node = svgEl('text', attrs);
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function getLampRect(lamp) {
  const x = lamp.centerX - lamp.widthMeters / 2;
  const y = lamp.anchorY === 'bottom'
    ? state.room.heightMeters - lamp.edgeDistanceY - lamp.heightMeters
    : lamp.edgeDistanceY;

  return {
    x,
    y,
    width: lamp.widthMeters,
    height: lamp.heightMeters,
  };
}

function renderCeiling(plan) {
  const svg = elements.ceilingSvg;
  const roomWidth = state.room.widthMeters;
  const roomHeight = state.room.heightMeters;
  const grid = getGridRect();
  const viewPadding = Math.max(state.grid.cellMeters * 0.35, 0.15);
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `${-viewPadding} ${-viewPadding} ${roomWidth + viewPadding * 2} ${roomHeight + viewPadding * 2}`);

  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: 'room-clip' });
  clip.appendChild(svgEl('rect', { x: 0, y: 0, width: roomWidth, height: roomHeight }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  svg.appendChild(svgEl('rect', {
    x: 0,
    y: 0,
    width: roomWidth,
    height: roomHeight,
    class: 'room-outline',
  }));

  const clipped = svgEl('g', { 'clip-path': 'url(#room-clip)' });
  svg.appendChild(clipped);

  for (let row = 0; row < state.grid.rows; row += 1) {
    for (let col = 0; col < state.grid.cols; col += 1) {
      clipped.appendChild(svgEl('rect', {
        x: grid.x + col * state.grid.cellMeters,
        y: grid.y + row * state.grid.cellMeters,
        width: state.grid.cellMeters,
        height: state.grid.cellMeters,
        class: 'full-panel',
      }));
    }
  }

  plan.pieces.forEach(piece => {
    clipped.appendChild(svgEl('rect', {
      x: piece.x,
      y: piece.y,
      width: piece.width,
      height: piece.height,
      class: 'cut-piece',
    }));

    const fontSize = clamp(Math.min(piece.width, piece.height) * 0.48, 0.045, 0.15);
    appendSvgText(clipped, piece.groupId, {
      x: piece.x + piece.width / 2,
      y: piece.y + piece.height / 2,
      class: 'cut-label',
      'font-size': fontSize,
    });
  });

  clipped.appendChild(svgEl('rect', {
    x: grid.x,
    y: grid.y,
    width: grid.width,
    height: grid.height,
    class: 'grid-outline',
  }));

  state.lamps.forEach(lamp => {
    const rect = getLampRect(lamp);
    clipped.appendChild(svgEl('rect', {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      rx: Math.min(rect.width, rect.height) * 0.12,
      class: 'lamp',
    }));
    appendSvgText(clipped, lamp.id, {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      class: 'lamp-label',
      'font-size': clamp(Math.min(rect.width, rect.height) * 0.35, 0.06, 0.18),
    });
  });

  appendSvgText(svg, `${formatMeters(roomWidth)} m`, {
    x: roomWidth / 2,
    y: -viewPadding * 0.35,
    'text-anchor': 'middle',
    'font-size': clamp(viewPadding * 0.32, 0.08, 0.16),
    fill: '#756f66',
  });

  appendSvgText(svg, `${formatMeters(roomHeight)} m`, {
    x: -viewPadding * 0.42,
    y: roomHeight / 2,
    transform: `rotate(-90 ${-viewPadding * 0.42} ${roomHeight / 2})`,
    'text-anchor': 'middle',
    'font-size': clamp(viewPadding * 0.32, 0.08, 0.16),
    fill: '#756f66',
  });
}

function recalculateAndRender() {
  latestCuttingPlan = calculateCuttingPlan();
  updateAlignmentControls();
  updateTotals(latestCuttingPlan);
  displayCuttingDetails(latestCuttingPlan);
  displayPanelPacking(latestCuttingPlan);
  renderCeiling(latestCuttingPlan);
}

function applyStateToInputs() {
  elements.widthInput.value = roundTo(state.room.widthMeters, 3);
  elements.heightInput.value = roundTo(state.room.heightMeters, 3);
  elements.gridRowsInput.value = state.grid.rows;
  elements.gridColsInput.value = state.grid.cols;
  elements.gridCellMetersInput.value = roundTo(state.grid.cellMeters, 3);
}

function buildConfig() {
  return {
    schemaVersion: state.schemaVersion,
    room: structuredCloneSafe(state.room),
    grid: structuredCloneSafe(state.grid),
    lamps: structuredCloneSafe(state.lamps),
    measureFlags: structuredCloneSafe(state.measureFlags || {}),
    cuttingPlan: latestCuttingPlan ? {
      extraPanelCount: latestCuttingPlan.extraPanelCount,
      cutArea: roundTo(latestCuttingPlan.cutArea),
      wasteArea: roundTo(latestCuttingPlan.wasteArea),
      groups: latestCuttingPlan.groups.map(group => ({
        id: group.id,
        widthMeters: roundTo(group.width),
        heightMeters: roundTo(group.height),
        quantity: group.quantity,
        zones: group.zones,
        areaMeters2: roundTo(group.area),
      })),
      panels: latestCuttingPlan.panels.map(panel => ({
        id: `P${panel.id}`,
        usedAreaMeters2: roundTo(panel.usedArea),
        wasteAreaMeters2: roundTo(panel.wasteArea),
        cuts: summarizePanelPlacements(panel.placements),
      })),
    } : null,
  };
}

async function loadConfig() {
  try {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const config = await response.json();
    mergeState(config);
  } catch (error) {
    console.warn('Konfiguration konnte nicht geladen werden. Es werden Standardwerte verwendet.', error);
  }
}

async function saveConfig() {
  try {
    await fetch(CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConfig(), null, 2),
    });
  } catch (error) {
    // Opening index.html directly from the file system cannot POST; the UI still works.
    console.warn('Konfiguration konnte nicht gespeichert werden.', error);
  }
}

function saveConfigDebounced() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveConfig, 300);
}

function setGridAlignment(alignmentX, alignmentY) {
  state.grid.alignmentX = normalizeAlignmentX(alignmentX, state.grid.alignmentX);
  state.grid.alignmentY = normalizeAlignmentY(alignmentY, state.grid.alignmentY);
  recalculateAndRender();
  saveConfigDebounced();
}

function bindNumberInput(input, parser, setter) {
  input.addEventListener('input', () => {
    const value = parser(input.value);
    if (value === null) {
      return;
    }
    setter(value);
    recalculateAndRender();
    saveConfigDebounced();
  });
}

function parsePositiveFloat(value) {
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parsePositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
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
  const headers = ['nr', 'width_m', 'height_m', 'quantity', 'zones', 'area_m2'];
  const rows = latestCuttingPlan.groups.map(group => [
    group.id,
    formatMeters(group.width),
    formatMeters(group.height),
    group.quantity,
    group.zones.join(' | '),
    formatMeters(group.area),
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
  downloadBlob('deckenschema-zuschnitt.csv', `${csv}\n`, 'text/csv;charset=utf-8');
}

function exportSvg() {
  const clone = elements.ceilingSvg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  downloadBlob('deckenschema-zuschnitt.svg', `${clone.outerHTML}\n`, 'image/svg+xml;charset=utf-8');
}

function bindGlobalEvents() {
  bindNumberInput(elements.widthInput, parsePositiveFloat, value => { state.room.widthMeters = value; });
  bindNumberInput(elements.heightInput, parsePositiveFloat, value => { state.room.heightMeters = value; });
  bindNumberInput(elements.gridRowsInput, parsePositiveInt, value => { state.grid.rows = value; });
  bindNumberInput(elements.gridColsInput, parsePositiveInt, value => { state.grid.cols = value; });
  bindNumberInput(elements.gridCellMetersInput, parsePositiveFloat, value => { state.grid.cellMeters = value; });

  elements.alignLeftButton.addEventListener('click', () => setGridAlignment('left', state.grid.alignmentY));
  elements.alignCenterXButton.addEventListener('click', () => setGridAlignment('center', state.grid.alignmentY));
  elements.alignRightButton.addEventListener('click', () => setGridAlignment('right', state.grid.alignmentY));
  elements.alignTopButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'top'));
  elements.alignCenterYButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'center'));
  elements.alignBottomButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'bottom'));

  elements.exportJsonButton.addEventListener('click', exportJson);
  elements.exportCsvButton.addEventListener('click', exportCsv);
  elements.exportSvgButton.addEventListener('click', exportSvg);
}

async function init() {
  await loadConfig();
  applyStateToInputs();
  bindGlobalEvents();
  recalculateAndRender();
}

init();
