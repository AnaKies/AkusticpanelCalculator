const EPS = 0.000001;
const DISPLAY_DIGITS = 3;
const CONFIG_URL = 'config.json';

const DEFAULT_STATE = {
  schemaVersion: 3,
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
  originCorner: 'top-left',
  obstacles: [],
  measureFlags: {},
};

const state = structuredCloneSafe(DEFAULT_STATE);
let latestPlan = null;
let saveTimer = null;
let selectedObstacleId = null;
let obstacleDragState = null;

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
  originCornerSelect: document.getElementById('origin-corner-select'),
  addObstacleButton: document.getElementById('add-obstacle-button'),
  obstaclesList: document.getElementById('obstacles-list'),
  exportJsonButton: document.getElementById('export-json-button'),
  exportCsvButton: document.getElementById('export-csv-button'),
  exportSvgButton: document.getElementById('export-svg-button'),
  ceilingSvg: document.getElementById('ceiling-svg'),
  svgFrame: document.getElementById('svg-frame'),
  inlineEditorLayer: document.getElementById('inline-editor-layer'),
  cuttingDetailsTable: document.getElementById('cutting-details-table'),
  panelPackingTable: document.getElementById('panel-packing-table'),
  fullPanelCount: document.getElementById('full-panel-count'),
  blockedPanelCount: document.getElementById('blocked-panel-count'),
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

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeAlignmentX(alignment, currentAlignment = 'center') {
  return ['left', 'center', 'right'].includes(alignment) ? alignment : currentAlignment;
}

function normalizeAlignmentY(alignment, currentAlignment = 'center') {
  return ['top', 'center', 'bottom'].includes(alignment) ? alignment : currentAlignment;
}

function normalizeOriginCorner(originCorner, fallback = 'top-left') {
  return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(originCorner)
    ? originCorner
    : fallback;
}

function normalizeObstacle(obstacle, index = 0) {
  if (!obstacle || typeof obstacle !== 'object') {
    return null;
  }

  const width = positiveNumber(obstacle.widthMeters, state.grid.cellMeters);
  const height = positiveNumber(obstacle.heightMeters, state.grid.cellMeters);
  const maxX = Math.max(0, state.room.widthMeters - width);
  const maxY = Math.max(0, state.room.heightMeters - height);

  return {
    id: String(obstacle.id || `S${index + 1}`),
    x: clamp(Number(obstacle.x) || 0, 0, maxX),
    y: clamp(Number(obstacle.y) || 0, 0, maxY),
    widthMeters: Math.min(width, state.room.widthMeters),
    heightMeters: Math.min(height, state.room.heightMeters),
  };
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
  state.originCorner = normalizeOriginCorner(config.originCorner, DEFAULT_STATE.originCorner);

  if (Array.isArray(config.obstacles)) {
    state.obstacles = config.obstacles.map(normalizeObstacle).filter(Boolean);
  } else {
    state.obstacles = [];
  }

  state.measureFlags = config.measureFlags && typeof config.measureFlags === 'object' ? config.measureFlags : {};
}

function buildConfig() {
  return {
    schemaVersion: 3,
    room: {
      widthMeters: roundTo(state.room.widthMeters),
      heightMeters: roundTo(state.room.heightMeters),
    },
    grid: {
      rows: state.grid.rows,
      cols: state.grid.cols,
      cellMeters: roundTo(state.grid.cellMeters),
      alignmentX: state.grid.alignmentX,
      alignmentY: state.grid.alignmentY,
    },
    originCorner: state.originCorner,
    obstacles: state.obstacles.map(obstacle => ({
      id: obstacle.id,
      x: roundTo(obstacle.x),
      y: roundTo(obstacle.y),
      widthMeters: roundTo(obstacle.widthMeters),
      heightMeters: roundTo(obstacle.heightMeters),
    })),
    measureFlags: state.measureFlags,
  };
}

async function loadConfig() {
  try {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    mergeState(await response.json());
  } catch (error) {
    console.warn('Konfiguration konnte nicht geladen werden. Standardwerte werden verwendet.', error);
  }
}

async function saveConfig() {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConfig(), null, 2),
    });
  } catch (error) {
    console.info('Konfiguration wird nur lokal im Browser verwendet.', error);
  }
}

function saveConfigDebounced() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveConfig, 350);
}

function applyStateToInputs() {
  elements.widthInput.value = formatMeters(state.room.widthMeters);
  elements.heightInput.value = formatMeters(state.room.heightMeters);
  elements.gridRowsInput.value = state.grid.rows;
  elements.gridColsInput.value = state.grid.cols;
  elements.gridCellMetersInput.value = formatMeters(state.grid.cellMeters);
  elements.originCornerSelect.value = state.originCorner;
  renderObstacleControls();
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

function getObstacleRect(obstacle) {
  return {
    id: obstacle.id,
    x: obstacle.x,
    y: obstacle.y,
    width: obstacle.widthMeters,
    height: obstacle.heightMeters,
  };
}

function rectRight(rect) {
  return rect.x + rect.width;
}

function rectBottom(rect) {
  return rect.y + rect.height;
}

function rectArea(rect) {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function rectIntersects(a, b) {
  return a.x < rectRight(b) - EPS
    && rectRight(a) > b.x + EPS
    && a.y < rectBottom(b) - EPS
    && rectBottom(a) > b.y + EPS;
}

function pointInsideRect(x, y, rect) {
  return x >= rect.x - EPS
    && x <= rectRight(rect) + EPS
    && y >= rect.y - EPS
    && y <= rectBottom(rect) + EPS;
}

function rectInsideRect(inner, outer) {
  return inner.x >= outer.x - EPS
    && inner.y >= outer.y - EPS
    && rectRight(inner) <= rectRight(outer) + EPS
    && rectBottom(inner) <= rectBottom(outer) + EPS;
}

function rectInsideRoom(rect) {
  return rect.x >= -EPS
    && rect.y >= -EPS
    && rectRight(rect) <= state.room.widthMeters + EPS
    && rectBottom(rect) <= state.room.heightMeters + EPS;
}

function getAllGridCells() {
  const grid = getGridRect();
  const cells = [];

  for (let row = 0; row < state.grid.rows; row += 1) {
    for (let col = 0; col < state.grid.cols; col += 1) {
      cells.push({
        id: `R${row + 1}C${col + 1}`,
        row,
        col,
        x: grid.x + col * state.grid.cellMeters,
        y: grid.y + row * state.grid.cellMeters,
        width: state.grid.cellMeters,
        height: state.grid.cellMeters,
      });
    }
  }

  return cells;
}

function getFullPanelCells(allCells, obstacleRects) {
  return allCells.filter(cell => rectInsideRoom(cell)
    && !obstacleRects.some(obstacle => rectIntersects(cell, obstacle)));
}

function getBlockedPanelCells(allCells, obstacleRects) {
  return allCells.filter(cell => rectInsideRoom(cell)
    && obstacleRects.some(obstacle => rectIntersects(cell, obstacle)));
}

function addCutBoundary(values, value, max) {
  const clamped = clamp(value, 0, max);
  values.push(roundTo(clamped, 6));
}

function uniqueSorted(values) {
  return [...new Set(values.map(value => roundTo(value, 6)))]
    .sort((a, b) => a - b)
    .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > EPS);
}

function rangesOverlap(a1, a2, b1, b2) {
  return Math.max(a1, b1) < Math.min(a2, b2) - EPS;
}

function getZoneLabel(rect, grid, obstacleRects) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const relatedObstacle = obstacleRects.find(obstacle => {
    const horizontalOverlap = rangesOverlap(rect.x, rectRight(rect), obstacle.x, rectRight(obstacle));
    const verticalOverlap = rangesOverlap(rect.y, rectBottom(rect), obstacle.y, rectBottom(obstacle));

    return (Math.abs(rectBottom(rect) - obstacle.y) < EPS && horizontalOverlap)
      || (Math.abs(rect.y - rectBottom(obstacle)) < EPS && horizontalOverlap)
      || (Math.abs(rectRight(rect) - obstacle.x) < EPS && verticalOverlap)
      || (Math.abs(rect.x - rectRight(obstacle)) < EPS && verticalOverlap);
  });

  if (relatedObstacle) {
    if (rectBottom(rect) <= relatedObstacle.y + EPS) return `vor ${relatedObstacle.id}`;
    if (rect.y >= rectBottom(relatedObstacle) - EPS) return `hinter ${relatedObstacle.id}`;
    if (rectRight(rect) <= relatedObstacle.x + EPS) return `links von ${relatedObstacle.id}`;
    if (rect.x >= rectRight(relatedObstacle) - EPS) return `rechts von ${relatedObstacle.id}`;
    return `um ${relatedObstacle.id}`;
  }

  if (centerY < grid.y - EPS) return 'oben';
  if (centerY > rectBottom(grid) + EPS) return 'unten';
  if (centerX < grid.x - EPS) return 'links';
  if (centerX > rectRight(grid) + EPS) return 'rechts';
  return 'innerhalb Raster';
}

function calculateCutPieces(allCells, fullPanelCells, obstacleRects) {
  const room = { x: 0, y: 0, width: state.room.widthMeters, height: state.room.heightMeters };
  const grid = getGridRect();
  const xCuts = [0, state.room.widthMeters];
  const yCuts = [0, state.room.heightMeters];

  addCutBoundary(xCuts, grid.x, state.room.widthMeters);
  addCutBoundary(xCuts, rectRight(grid), state.room.widthMeters);
  addCutBoundary(yCuts, grid.y, state.room.heightMeters);
  addCutBoundary(yCuts, rectBottom(grid), state.room.heightMeters);

  for (let col = 0; col <= state.grid.cols; col += 1) {
    addCutBoundary(xCuts, grid.x + col * state.grid.cellMeters, state.room.widthMeters);
  }

  for (let row = 0; row <= state.grid.rows; row += 1) {
    addCutBoundary(yCuts, grid.y + row * state.grid.cellMeters, state.room.heightMeters);
  }

  obstacleRects.forEach(obstacle => {
    addCutBoundary(xCuts, obstacle.x, state.room.widthMeters);
    addCutBoundary(xCuts, rectRight(obstacle), state.room.widthMeters);
    addCutBoundary(yCuts, obstacle.y, state.room.heightMeters);
    addCutBoundary(yCuts, rectBottom(obstacle), state.room.heightMeters);
  });

  const xs = uniqueSorted(xCuts);
  const ys = uniqueSorted(yCuts);
  const pieces = [];

  for (let yi = 0; yi < ys.length - 1; yi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const rect = {
        x: xs[xi],
        y: ys[yi],
        width: xs[xi + 1] - xs[xi],
        height: ys[yi + 1] - ys[yi],
      };

      if (rect.width <= EPS || rect.height <= EPS || !rectInsideRect(rect, room)) {
        continue;
      }

      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const insideObstacle = obstacleRects.some(obstacle => pointInsideRect(centerX, centerY, obstacle));
      if (insideObstacle) {
        continue;
      }

      const insideFullPanel = fullPanelCells.some(cell => rectInsideRect(rect, cell));
      if (insideFullPanel) {
        continue;
      }

      pieces.push({
        id: `piece-${pieces.length + 1}`,
        x: roundTo(rect.x),
        y: roundTo(rect.y),
        width: roundTo(rect.width),
        height: roundTo(rect.height),
        zone: getZoneLabel(rect, grid, obstacleRects),
      });
    }
  }

  return pieces.filter(piece => piece.width > EPS && piece.height > EPS);
}

function buildGroups(cutPieces) {
  const groupsByKey = new Map();

  cutPieces.forEach(piece => {
    const key = `${formatMeters(piece.width)}x${formatMeters(piece.height)}`;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        id: `Z${groupsByKey.size + 1}`,
        width: piece.width,
        height: piece.height,
        pieces: [],
        zones: new Set(),
      });
    }

    const group = groupsByKey.get(key);
    group.pieces.push(piece);
    group.zones.add(piece.zone);
    piece.groupId = group.id;
  });

  return [...groupsByKey.values()].map(group => ({
    ...group,
    quantity: group.pieces.length,
    area: group.pieces.reduce((sum, piece) => sum + rectArea(piece), 0),
    zonesText: [...group.zones].join(', '),
  }));
}

function pruneFreeRects(freeRects) {
  return freeRects.filter((rect, index) => rect.width > EPS && rect.height > EPS
    && !freeRects.some((other, otherIndex) => otherIndex !== index && rectInsideRect(rect, other)));
}

function tryPlacePiece(panel, piece, panelSize) {
  let bestIndex = -1;
  let bestScore = Infinity;

  panel.freeRects.forEach((freeRect, index) => {
    if (piece.width <= freeRect.width + EPS && piece.height <= freeRect.height + EPS) {
      const score = (freeRect.width * freeRect.height) - (piece.width * piece.height);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
  });

  if (bestIndex === -1) {
    return false;
  }

  const freeRect = panel.freeRects.splice(bestIndex, 1)[0];
  panel.placements.push({
    ...piece,
    cutX: freeRect.x,
    cutY: freeRect.y,
  });

  panel.freeRects.push({
    x: freeRect.x + piece.width,
    y: freeRect.y,
    width: freeRect.width - piece.width,
    height: piece.height,
  });
  panel.freeRects.push({
    x: freeRect.x,
    y: freeRect.y + piece.height,
    width: freeRect.width,
    height: freeRect.height - piece.height,
  });
  panel.freeRects = pruneFreeRects(panel.freeRects);

  panel.usedArea += piece.width * piece.height;
  panel.wasteArea = panelSize * panelSize - panel.usedArea;
  return true;
}

function packPiecesIntoPanels(groups) {
  const panelSize = state.grid.cellMeters;
  const pieces = [];

  groups.forEach(group => {
    group.pieces.forEach(piece => {
      pieces.push({
        groupId: group.id,
        width: group.width,
        height: group.height,
        sourcePieceId: piece.id,
      });
    });
  });

  pieces.sort((a, b) => (b.height - a.height) || (b.width - a.width) || ((b.width * b.height) - (a.width * a.height)));

  const panels = [];
  pieces.forEach(piece => {
    let placed = false;

    for (const panel of panels) {
      if (tryPlacePiece(panel, piece, panelSize)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      const panel = {
        id: `P${panels.length + 1}`,
        width: panelSize,
        height: panelSize,
        placements: [],
        freeRects: [{ x: 0, y: 0, width: panelSize, height: panelSize }],
        usedArea: 0,
        wasteArea: panelSize * panelSize,
      };
      tryPlacePiece(panel, piece, panelSize);
      panels.push(panel);
    }
  });

  return panels;
}

function calculatePlan() {
  const obstacleRects = state.obstacles.map(getObstacleRect);
  const allCells = getAllGridCells();
  const fullPanelCells = getFullPanelCells(allCells, obstacleRects);
  const blockedPanelCells = getBlockedPanelCells(allCells, obstacleRects);
  const cutPieces = calculateCutPieces(allCells, fullPanelCells, obstacleRects);
  const groups = buildGroups(cutPieces);
  const panels = packPiecesIntoPanels(groups);
  const cutArea = cutPieces.reduce((sum, piece) => sum + rectArea(piece), 0);
  const purchasedCutArea = panels.length * state.grid.cellMeters * state.grid.cellMeters;
  const wasteArea = Math.max(0, purchasedCutArea - cutArea);
  const grid = getGridRect();
  const warnings = [];

  if (grid.x < -EPS || grid.y < -EPS || rectRight(grid) > state.room.widthMeters + EPS || rectBottom(grid) > state.room.heightMeters + EPS) {
    warnings.push('Das Raster ist größer als der Raum. Paneele außerhalb des Raums werden nicht als ganze Paneele gezählt.');
  }

  const oversizedGroups = groups.filter(group => group.width > state.grid.cellMeters + EPS || group.height > state.grid.cellMeters + EPS);
  if (oversizedGroups.length > 0) {
    warnings.push('Einige Zuschnittstücke sind größer als ein Paneel. Bitte Raster oder Paneelgröße prüfen.');
  }

  return {
    obstacleRects,
    allCells,
    fullPanelCells,
    blockedPanelCells,
    cutPieces,
    groups,
    panels,
    cutArea,
    wasteArea,
    warnings,
  };
}

function getOriginCoordinates(obstacle) {
  const width = obstacle.widthMeters;
  const height = obstacle.heightMeters;

  switch (state.originCorner) {
    case 'top-right':
      return { x: state.room.widthMeters - obstacle.x - width, y: obstacle.y };
    case 'bottom-left':
      return { x: obstacle.x, y: state.room.heightMeters - obstacle.y - height };
    case 'bottom-right':
      return { x: state.room.widthMeters - obstacle.x - width, y: state.room.heightMeters - obstacle.y - height };
    case 'top-left':
    default:
      return { x: obstacle.x, y: obstacle.y };
  }
}

function setObstacleFromOrigin(obstacle, originX, originY, width, height) {
  const safeWidth = clamp(positiveNumber(width, obstacle.widthMeters), 0.001, state.room.widthMeters);
  const safeHeight = clamp(positiveNumber(height, obstacle.heightMeters), 0.001, state.room.heightMeters);
  const safeOriginX = Math.max(0, Number(originX) || 0);
  const safeOriginY = Math.max(0, Number(originY) || 0);
  let x = safeOriginX;
  let y = safeOriginY;

  if (state.originCorner.includes('right')) {
    x = state.room.widthMeters - safeOriginX - safeWidth;
  }

  if (state.originCorner.includes('bottom')) {
    y = state.room.heightMeters - safeOriginY - safeHeight;
  }

  obstacle.widthMeters = safeWidth;
  obstacle.heightMeters = safeHeight;
  obstacle.x = clamp(x, 0, Math.max(0, state.room.widthMeters - safeWidth));
  obstacle.y = clamp(y, 0, Math.max(0, state.room.heightMeters - safeHeight));
}

function nextObstacleId() {
  let index = 1;
  const used = new Set(state.obstacles.map(obstacle => obstacle.id));
  while (used.has(`S${index}`)) {
    index += 1;
  }
  return `S${index}`;
}

function addObstacle() {
  const size = Math.min(state.grid.cellMeters, state.room.widthMeters, state.room.heightMeters);
  const defaultOffset = Math.min(state.grid.cellMeters * 0.5, state.room.widthMeters * 0.12, state.room.heightMeters * 0.12);
  const obstacle = {
    id: nextObstacleId(),
    x: clamp(defaultOffset, 0, Math.max(0, state.room.widthMeters - size)),
    y: clamp(defaultOffset, 0, Math.max(0, state.room.heightMeters - size)),
    widthMeters: size,
    heightMeters: size,
  };

  state.obstacles.push(obstacle);
  selectedObstacleId = obstacle.id;
  renderObstacleControls();
  updateAll();
  saveConfigDebounced();
}

function ensureSelectedObstacle() {
  if (state.obstacles.length === 0) {
    selectedObstacleId = null;
    return;
  }

  if (!state.obstacles.some(obstacle => obstacle.id === selectedObstacleId)) {
    selectedObstacleId = state.obstacles[state.obstacles.length - 1].id;
  }
}

function removeObstacle(id) {
  state.obstacles = state.obstacles.filter(obstacle => obstacle.id !== id);
  if (selectedObstacleId === id) {
    selectedObstacleId = state.obstacles[state.obstacles.length - 1]?.id || null;
  }
  renderObstacleControls();
  updateAll();
  saveConfigDebounced();
}

function selectObstacle(id) {
  selectedObstacleId = id;
  renderObstacleControls();
  renderSvg(latestPlan || calculatePlan());
}

function renderObstacleControls() {
  elements.obstaclesList.innerHTML = '';
  ensureSelectedObstacle();

  if (state.obstacles.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Noch keine Sperrfläche angelegt.';
    elements.obstaclesList.appendChild(empty);
    return;
  }

  state.obstacles.forEach(obstacle => {
    const origin = getOriginCoordinates(obstacle);
    const isExpanded = selectedObstacleId === obstacle.id;
    const card = document.createElement('article');
    card.className = `obstacle-card${isExpanded ? ' selected' : ' collapsed'}`;
    card.dataset.obstacleId = obstacle.id;
    card.innerHTML = `
      <div class="obstacle-card-header">
        <button class="obstacle-toggle-button" type="button" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="${escapeHtml(obstacle.id)} ${isExpanded ? 'einklappen' : 'aufklappen'}">
          <span class="obstacle-title">${escapeHtml(obstacle.id)}</span>
          <span class="obstacle-summary">X ${formatMeters(origin.x)} · Y ${formatMeters(origin.y)} · ${formatMeters(obstacle.widthMeters)} × ${formatMeters(obstacle.heightMeters)} m</span>
        </button>
        <button class="remove-obstacle-button" type="button" aria-label="${escapeHtml(obstacle.id)} entfernen">×</button>
      </div>
      <div class="obstacle-card-body" ${isExpanded ? '' : 'hidden'}>
        <div class="obstacle-fields">
          <label>X, m<input data-field="x" type="number" min="0" step="0.001" inputmode="decimal" value="${formatMeters(origin.x)}"></label>
          <label>Y, m<input data-field="y" type="number" min="0" step="0.001" inputmode="decimal" value="${formatMeters(origin.y)}"></label>
          <label>Breite, m<input data-field="width" type="number" min="0.001" step="0.001" inputmode="decimal" value="${formatMeters(obstacle.widthMeters)}"></label>
          <label>Höhe, m<input data-field="height" type="number" min="0.001" step="0.001" inputmode="decimal" value="${formatMeters(obstacle.heightMeters)}"></label>
        </div>
      </div>
    `;

    card.addEventListener('click', event => {
      if (event.target.matches('input, button')) {
        return;
      }
      selectObstacle(obstacle.id);
    });

    const toggleButton = card.querySelector('.obstacle-toggle-button');
    toggleButton.addEventListener('click', () => selectObstacle(obstacle.id));

    const removeButton = card.querySelector('.remove-obstacle-button');
    removeButton.addEventListener('click', event => {
      event.stopPropagation();
      removeObstacle(obstacle.id);
    });

    const inputs = [...card.querySelectorAll('input')];
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        const values = Object.fromEntries(inputs.map(item => [item.dataset.field, Number(item.value)]));
        setObstacleFromOrigin(obstacle, values.x, values.y, values.width, values.height);
        selectedObstacleId = obstacle.id;
        renderObstacleControls();
        updateAll();
        saveConfigDebounced();
      });
    });

    elements.obstaclesList.appendChild(card);
  });
}

function updateAlignmentControls() {
  elements.alignLeftButton.classList.toggle('active', state.grid.alignmentX === 'left');
  elements.alignCenterXButton.classList.toggle('active', state.grid.alignmentX === 'center');
  elements.alignRightButton.classList.toggle('active', state.grid.alignmentX === 'right');
  elements.alignTopButton.classList.toggle('active', state.grid.alignmentY === 'top');
  elements.alignCenterYButton.classList.toggle('active', state.grid.alignmentY === 'center');
  elements.alignBottomButton.classList.toggle('active', state.grid.alignmentY === 'bottom');
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createSvgElement(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function appendSvgText(parent, text, attributes) {
  const node = createSvgElement('text', attributes);
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function getOriginPhysicalPoint() {
  const roomWidth = state.room.widthMeters;
  const roomHeight = state.room.heightMeters;

  return {
    'top-left': { x: 0, y: 0, xDir: 1, yDir: 1 },
    'top-right': { x: roomWidth, y: 0, xDir: -1, yDir: 1 },
    'bottom-left': { x: 0, y: roomHeight, xDir: 1, yDir: -1 },
    'bottom-right': { x: roomWidth, y: roomHeight, xDir: -1, yDir: -1 },
  }[state.originCorner] || { x: 0, y: 0, xDir: 1, yDir: 1 };
}

function getObstacleOriginAnchor(obstacle) {
  return {
    'top-left': { x: obstacle.x, y: obstacle.y },
    'top-right': { x: rectRight(obstacle), y: obstacle.y },
    'bottom-left': { x: obstacle.x, y: rectBottom(obstacle) },
    'bottom-right': { x: rectRight(obstacle), y: rectBottom(obstacle) },
  }[state.originCorner] || { x: obstacle.x, y: obstacle.y };
}

function appendDimensionLine(parent, x1, y1, x2, y2, className = 'dimension-line') {
  parent.appendChild(createSvgElement('line', {
    class: className,
    x1,
    y1,
    x2,
    y2,
  }));
}

function appendDimensionTicks(parent, x, y, orientation, tickSize) {
  if (orientation === 'horizontal') {
    appendDimensionLine(parent, x, y - tickSize / 2, x, y + tickSize / 2, 'dimension-tick');
  } else {
    appendDimensionLine(parent, x - tickSize / 2, y, x + tickSize / 2, y, 'dimension-tick');
  }
}

function appendPanelBoundaryOverlay(svg) {
  const grid = getGridRect();
  const y1 = clamp(grid.y, 0, state.room.heightMeters);
  const y2 = clamp(rectBottom(grid), 0, state.room.heightMeters);
  const x1 = clamp(grid.x, 0, state.room.widthMeters);
  const x2 = clamp(rectRight(grid), 0, state.room.widthMeters);

  if (y2 > y1 + EPS) {
    for (let col = 0; col <= state.grid.cols; col += 1) {
      const x = grid.x + col * state.grid.cellMeters;
      if (x >= -EPS && x <= state.room.widthMeters + EPS) {
        svg.appendChild(createSvgElement('line', {
          class: 'panel-boundary-line',
          x1: clamp(x, 0, state.room.widthMeters),
          y1,
          x2: clamp(x, 0, state.room.widthMeters),
          y2,
        }));
      }
    }
  }

  if (x2 > x1 + EPS) {
    for (let row = 0; row <= state.grid.rows; row += 1) {
      const y = grid.y + row * state.grid.cellMeters;
      if (y >= -EPS && y <= state.room.heightMeters + EPS) {
        svg.appendChild(createSvgElement('line', {
          class: 'panel-boundary-line',
          x1,
          y1: clamp(y, 0, state.room.heightMeters),
          x2,
          y2: clamp(y, 0, state.room.heightMeters),
        }));
      }
    }
  }
}


function getObstacleEditorGeometry(obstacle) {
  const originPoint = getOriginPhysicalPoint();
  const anchor = getObstacleOriginAnchor(obstacle);
  const originDistances = getOriginCoordinates(obstacle);
  const baseOffset = Math.max(0.16, Math.min(0.34, state.grid.cellMeters * 0.38));
  const tickSize = Math.max(0.06, Math.min(0.16, state.grid.cellMeters * 0.18));
  const xMeasureY = anchor.y - originPoint.yDir * baseOffset;
  const yMeasureX = anchor.x - originPoint.xDir * baseOffset;
  const widthMeasureY = state.originCorner.includes('top')
    ? rectBottom(obstacle) + baseOffset
    : obstacle.y - baseOffset;
  const heightMeasureX = state.originCorner.includes('left')
    ? rectRight(obstacle) + baseOffset
    : obstacle.x - baseOffset;
  const buttonSize = Math.max(0.22, Math.min(0.34, state.grid.cellMeters * 0.42));

  return {
    originPoint,
    anchor,
    originDistances,
    tickSize,
    xMeasureY,
    yMeasureX,
    widthMeasureY,
    heightMeasureX,
    inputs: [
      {
        label: 'X',
        field: 'x',
        value: originDistances.x,
        x: (originPoint.x + anchor.x) / 2,
        y: xMeasureY,
      },
      {
        label: 'Y',
        field: 'y',
        value: originDistances.y,
        x: yMeasureX,
        y: (originPoint.y + anchor.y) / 2,
      },
      {
        label: 'B',
        field: 'width',
        value: obstacle.width,
        x: obstacle.x + obstacle.width / 2,
        y: widthMeasureY,
      },
      {
        label: 'H',
        field: 'height',
        value: obstacle.height,
        x: heightMeasureX,
        y: obstacle.y + obstacle.height / 2,
      },
    ],
    deleteButton: {
      x: rectRight(obstacle) - buttonSize * 0.18,
      y: obstacle.y - buttonSize * 0.18,
    },
  };
}

function renderSelectedObstacleEditor(svg, obstacle) {
  const group = createSvgElement('g', { class: 'svg-obstacle-editor' });
  svg.appendChild(group);

  const geometry = getObstacleEditorGeometry(obstacle);
  const { originPoint, anchor, tickSize, xMeasureY, yMeasureX, widthMeasureY, heightMeasureX } = geometry;

  group.appendChild(createSvgElement('rect', {
    class: 'obstacle-selection',
    x: obstacle.x,
    y: obstacle.y,
    width: obstacle.width,
    height: obstacle.height,
    rx: 0.015,
  }));

  // Abstand X vom gewählten Nullpunkt bis zur nächstliegenden Ecke der Sperrfläche.
  appendDimensionLine(group, originPoint.x, xMeasureY, anchor.x, xMeasureY);
  appendDimensionLine(group, originPoint.x, originPoint.y, originPoint.x, xMeasureY, 'dimension-extension-line');
  appendDimensionLine(group, anchor.x, anchor.y, anchor.x, xMeasureY, 'dimension-extension-line');
  appendDimensionTicks(group, originPoint.x, xMeasureY, 'horizontal', tickSize);
  appendDimensionTicks(group, anchor.x, xMeasureY, 'horizontal', tickSize);

  // Abstand Y vom gewählten Nullpunkt bis zur nächstliegenden Ecke der Sperrfläche.
  appendDimensionLine(group, yMeasureX, originPoint.y, yMeasureX, anchor.y);
  appendDimensionLine(group, originPoint.x, originPoint.y, yMeasureX, originPoint.y, 'dimension-extension-line');
  appendDimensionLine(group, anchor.x, anchor.y, yMeasureX, anchor.y, 'dimension-extension-line');
  appendDimensionTicks(group, yMeasureX, originPoint.y, 'vertical', tickSize);
  appendDimensionTicks(group, yMeasureX, anchor.y, 'vertical', tickSize);

  // Breite der Sperrfläche.
  appendDimensionLine(group, obstacle.x, widthMeasureY, rectRight(obstacle), widthMeasureY);
  appendDimensionLine(group, obstacle.x, obstacle.y, obstacle.x, widthMeasureY, 'dimension-extension-line');
  appendDimensionLine(group, rectRight(obstacle), obstacle.y, rectRight(obstacle), widthMeasureY, 'dimension-extension-line');
  appendDimensionTicks(group, obstacle.x, widthMeasureY, 'horizontal', tickSize);
  appendDimensionTicks(group, rectRight(obstacle), widthMeasureY, 'horizontal', tickSize);

  // Höhe der Sperrfläche.
  appendDimensionLine(group, heightMeasureX, obstacle.y, heightMeasureX, rectBottom(obstacle));
  appendDimensionLine(group, obstacle.x, obstacle.y, heightMeasureX, obstacle.y, 'dimension-extension-line');
  appendDimensionLine(group, obstacle.x, rectBottom(obstacle), heightMeasureX, rectBottom(obstacle), 'dimension-extension-line');
  appendDimensionTicks(group, heightMeasureX, obstacle.y, 'vertical', tickSize);
  appendDimensionTicks(group, heightMeasureX, rectBottom(obstacle), 'vertical', tickSize);
}

function clearInlineEditorLayer() {
  if (elements.inlineEditorLayer) {
    clearNode(elements.inlineEditorLayer);
  }
}

function svgToLayerPoint(x, y) {
  const svg = elements.ceilingSvg;
  const viewBox = svg.viewBox.baseVal;
  const width = svg.clientWidth || svg.getBoundingClientRect().width;
  const height = svg.clientHeight || svg.getBoundingClientRect().height;

  return {
    left: ((x - viewBox.x) / viewBox.width) * width,
    top: ((y - viewBox.y) / viewBox.height) * height,
  };
}

function renderInlineObstacleEditor(obstacle) {
  clearInlineEditorLayer();

  if (!elements.inlineEditorLayer || !obstacle) {
    return;
  }

  const svg = elements.ceilingSvg;
  elements.inlineEditorLayer.style.width = `${svg.clientWidth || svg.getBoundingClientRect().width}px`;
  elements.inlineEditorLayer.style.height = `${svg.clientHeight || svg.getBoundingClientRect().height}px`;

  const geometry = getObstacleEditorGeometry(obstacle);
  const deletePoint = svgToLayerPoint(geometry.deleteButton.x, geometry.deleteButton.y);
  const deleteButton = document.createElement('button');
  deleteButton.className = 'inline-delete-button';
  deleteButton.type = 'button';
  deleteButton.textContent = '×';
  deleteButton.title = `${obstacle.id} entfernen`;
  deleteButton.setAttribute('aria-label', `${obstacle.id} entfernen`);
  deleteButton.addEventListener('click', event => {
    event.stopPropagation();
    removeObstacle(obstacle.id);
  });
  deleteButton.addEventListener('pointerdown', event => event.stopPropagation());
  deleteButton.style.left = `${deletePoint.left}px`;
  deleteButton.style.top = `${deletePoint.top}px`;
  elements.inlineEditorLayer.appendChild(deleteButton);
}

function getSvgPointerPoint(event) {
  const svg = elements.ceilingSvg;
  const matrix = svg.getScreenCTM();

  if (matrix) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  return {
    x: viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height,
  };
}

function moveObstacleTo(obstacle, x, y) {
  obstacle.x = clamp(x, 0, Math.max(0, state.room.widthMeters - obstacle.widthMeters));
  obstacle.y = clamp(y, 0, Math.max(0, state.room.heightMeters - obstacle.heightMeters));
}

function startObstacleDrag(event, obstacleId) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  const obstacle = state.obstacles.find(item => item.id === obstacleId);
  if (!obstacle) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const point = getSvgPointerPoint(event);
  selectedObstacleId = obstacle.id;
  obstacleDragState = {
    pointerId: event.pointerId,
    obstacleId: obstacle.id,
    startX: point.x,
    startY: point.y,
    obstacleStartX: obstacle.x,
    obstacleStartY: obstacle.y,
    moved: false,
  };

  renderObstacleControls();
}

function updateObstacleDrag(event) {
  if (!obstacleDragState || event.pointerId !== obstacleDragState.pointerId) {
    return;
  }

  const obstacle = state.obstacles.find(item => item.id === obstacleDragState.obstacleId);
  if (!obstacle) {
    obstacleDragState = null;
    return;
  }

  event.preventDefault();
  const point = getSvgPointerPoint(event);
  const deltaX = point.x - obstacleDragState.startX;
  const deltaY = point.y - obstacleDragState.startY;
  obstacleDragState.moved = obstacleDragState.moved || Math.abs(deltaX) > EPS || Math.abs(deltaY) > EPS;
  moveObstacleTo(obstacle, obstacleDragState.obstacleStartX + deltaX, obstacleDragState.obstacleStartY + deltaY);
  renderObstacleControls();
  updateAll();
}

function finishObstacleDrag(event) {
  if (!obstacleDragState || event.pointerId !== obstacleDragState.pointerId) {
    return;
  }

  event.preventDefault();
  const didMove = obstacleDragState.moved;
  obstacleDragState = null;

  if (didMove) {
    renderObstacleControls();
    updateAll();
    saveConfigDebounced();
  }
}

function renderSvg(plan) {
  const svg = elements.ceilingSvg;
  clearNode(svg);
  clearInlineEditorLayer();

  const roomWidth = state.room.widthMeters;
  const roomHeight = state.room.heightMeters;
  const padding = Math.max(Math.max(roomWidth, roomHeight) * 0.06, state.grid.cellMeters * 0.75, 0.55);
  const viewBox = `${-padding} ${-padding} ${roomWidth + padding * 2} ${roomHeight + padding * 2}`;
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  svg.appendChild(createSvgElement('rect', {
    class: 'room-rect',
    x: 0,
    y: 0,
    width: roomWidth,
    height: roomHeight,
    rx: 0.02,
  }));

  plan.fullPanelCells.forEach(cell => {
    svg.appendChild(createSvgElement('rect', {
      class: 'full-panel',
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
    }));
  });

  const labelSize = Math.max(0.09, Math.min(0.18, state.grid.cellMeters * 0.22));
  plan.cutPieces.forEach(piece => {
    svg.appendChild(createSvgElement('rect', {
      class: 'cut-piece',
      x: piece.x,
      y: piece.y,
      width: piece.width,
      height: piece.height,
    }));

    if (piece.width >= 0.05 && piece.height >= 0.025) {
      appendSvgText(svg, piece.groupId, {
        class: 'piece-label',
        x: piece.x + piece.width / 2,
        y: piece.y + piece.height / 2,
        'font-size': Math.min(labelSize, Math.max(0.035, piece.height * 0.72)),
      });
    }
  });

  appendPanelBoundaryOverlay(svg);

  plan.obstacleRects.forEach(obstacle => {
    const isSelected = selectedObstacleId === obstacle.id;
    const obstacleNode = createSvgElement('rect', {
      class: `obstacle${isSelected ? ' selected-obstacle' : ''}`,
      x: obstacle.x,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height,
      rx: 0.015,
    });
    obstacleNode.addEventListener('pointerdown', event => startObstacleDrag(event, obstacle.id));
    obstacleNode.addEventListener('click', event => {
      event.stopPropagation();
      selectObstacle(obstacle.id);
    });
    svg.appendChild(obstacleNode);
    appendSvgText(svg, obstacle.id, {
      class: 'obstacle-label',
      x: obstacle.x + obstacle.width / 2,
      y: obstacle.y + obstacle.height / 2,
      'font-size': Math.max(0.08, Math.min(0.2, Math.min(obstacle.width, obstacle.height) * 0.32)),
    });
  });

  renderOriginMarker(svg);

  const selectedObstacle = plan.obstacleRects.find(obstacle => obstacle.id === selectedObstacleId);
  if (selectedObstacle) {
    renderSelectedObstacleEditor(svg, selectedObstacle);
    renderInlineObstacleEditor(selectedObstacle);
  }
}

function renderOriginMarker(svg) {
  const size = Math.max(0.18, Math.min(0.35, state.grid.cellMeters * 0.6));
  const roomWidth = state.room.widthMeters;
  const roomHeight = state.room.heightMeters;
  const origin = {
    'top-left': { x: 0, y: 0, dx: 1, dy: 1, label: '0' },
    'top-right': { x: roomWidth, y: 0, dx: -1, dy: 1, label: '0' },
    'bottom-left': { x: 0, y: roomHeight, dx: 1, dy: -1, label: '0' },
    'bottom-right': { x: roomWidth, y: roomHeight, dx: -1, dy: -1, label: '0' },
  }[state.originCorner];

  svg.appendChild(createSvgElement('circle', {
    class: 'origin-dot',
    cx: origin.x,
    cy: origin.y,
    r: size * 0.13,
  }));
  svg.appendChild(createSvgElement('line', {
    class: 'origin-axis',
    x1: origin.x,
    y1: origin.y,
    x2: origin.x + origin.dx * size,
    y2: origin.y,
  }));
  svg.appendChild(createSvgElement('line', {
    class: 'origin-axis',
    x1: origin.x,
    y1: origin.y,
    x2: origin.x,
    y2: origin.y + origin.dy * size,
  }));
  appendSvgText(svg, origin.label, {
    class: 'origin-label',
    x: origin.x + origin.dx * size * 0.28,
    y: origin.y + origin.dy * size * 0.28,
    'font-size': size * 0.34,
  });
}

function renderCuttingTable(plan) {
  elements.cuttingDetailsTable.innerHTML = '';

  if (plan.groups.length === 0) {
    elements.cuttingDetailsTable.innerHTML = '<tr><td class="empty-row" colspan="5">Keine Zuschnittstücke nötig.</td></tr>';
    return;
  }

  plan.groups.forEach(group => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(group.id)}</strong></td>
      <td>${formatMeters(group.width)} × ${formatMeters(group.height)}</td>
      <td>${group.quantity}</td>
      <td>${escapeHtml(group.zonesText)}</td>
      <td>${formatArea(group.area)}</td>
    `;
    elements.cuttingDetailsTable.appendChild(row);
  });
}

function summarizePanelPlacements(panel) {
  const counts = new Map();
  panel.placements.forEach(placement => {
    counts.set(placement.groupId, (counts.get(placement.groupId) || 0) + 1);
  });
  return [...counts.entries()].map(([groupId, count]) => `${count} × ${groupId}`).join(', ');
}

function renderPackingTable(plan) {
  elements.panelPackingTable.innerHTML = '';

  if (plan.panels.length === 0) {
    elements.panelPackingTable.innerHTML = '<tr><td class="empty-row" colspan="3">Keine zusätzlichen Paneele nötig.</td></tr>';
    return;
  }

  plan.panels.forEach(panel => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(panel.id)}</strong></td>
      <td>${escapeHtml(summarizePanelPlacements(panel))}</td>
      <td>${formatArea(panel.usedArea)}</td>
    `;
    elements.panelPackingTable.appendChild(row);
  });
}

function renderTotals(plan) {
  const fullCount = plan.fullPanelCells.length;
  const extraCount = plan.panels.length;
  const blockedCount = plan.blockedPanelCells.length;

  elements.fullPanelCount.textContent = String(fullCount);
  elements.blockedPanelCount.textContent = String(blockedCount);
  elements.extraPanelCount.textContent = String(extraCount);
  elements.totalPanelCount.textContent = String(fullCount + extraCount);
  elements.wasteArea.textContent = formatArea(plan.wasteArea);

  if (plan.warnings.length > 0) {
    elements.calculationWarning.hidden = false;
    elements.calculationWarning.textContent = plan.warnings.join(' ');
  } else {
    elements.calculationWarning.hidden = true;
    elements.calculationWarning.textContent = '';
  }

  elements.drawingMeta.textContent = `${formatMeters(state.room.widthMeters)} × ${formatMeters(state.room.heightMeters)} m · Raster ${state.grid.cols} × ${state.grid.rows} · ${state.obstacles.length} Sperrfläche(n)`;
}

function updateAll() {
  latestPlan = calculatePlan();
  updateAlignmentControls();
  renderSvg(latestPlan);
  renderCuttingTable(latestPlan);
  renderPackingTable(latestPlan);
  renderTotals(latestPlan);
}

function setGridAlignment(alignmentX, alignmentY) {
  state.grid.alignmentX = normalizeAlignmentX(alignmentX, state.grid.alignmentX);
  state.grid.alignmentY = normalizeAlignmentY(alignmentY, state.grid.alignmentY);
  updateAll();
  saveConfigDebounced();
}

function bindNumberInput(input, onChange) {
  input.addEventListener('change', () => {
    onChange(Number(input.value));
    applyStateToInputs();
    updateAll();
    saveConfigDebounced();
  });
}

function clampObstaclesToRoom() {
  state.obstacles = state.obstacles.map((obstacle, index) => normalizeObstacle(obstacle, index)).filter(Boolean);
}

function bindGlobalEvents() {
  bindNumberInput(elements.widthInput, value => {
    state.room.widthMeters = positiveNumber(value, state.room.widthMeters);
    clampObstaclesToRoom();
  });

  bindNumberInput(elements.heightInput, value => {
    state.room.heightMeters = positiveNumber(value, state.room.heightMeters);
    clampObstaclesToRoom();
  });

  bindNumberInput(elements.gridColsInput, value => {
    state.grid.cols = Math.max(1, Math.round(positiveNumber(value, state.grid.cols)));
  });

  bindNumberInput(elements.gridRowsInput, value => {
    state.grid.rows = Math.max(1, Math.round(positiveNumber(value, state.grid.rows)));
  });

  bindNumberInput(elements.gridCellMetersInput, value => {
    state.grid.cellMeters = positiveNumber(value, state.grid.cellMeters);
    clampObstaclesToRoom();
  });

  elements.alignLeftButton.addEventListener('click', () => setGridAlignment('left', state.grid.alignmentY));
  elements.alignCenterXButton.addEventListener('click', () => setGridAlignment('center', state.grid.alignmentY));
  elements.alignRightButton.addEventListener('click', () => setGridAlignment('right', state.grid.alignmentY));
  elements.alignTopButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'top'));
  elements.alignCenterYButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'center'));
  elements.alignBottomButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'bottom'));

  elements.originCornerSelect.addEventListener('change', () => {
    state.originCorner = normalizeOriginCorner(elements.originCornerSelect.value, state.originCorner);
    renderObstacleControls();
    updateAll();
    saveConfigDebounced();
  });

  elements.addObstacleButton.addEventListener('click', addObstacle);
  elements.exportJsonButton.addEventListener('click', exportJson);
  elements.exportCsvButton.addEventListener('click', exportCsv);
  elements.exportSvgButton.addEventListener('click', exportSvg);
  window.addEventListener('pointermove', updateObstacleDrag);
  window.addEventListener('pointerup', finishObstacleDrag);
  window.addEventListener('pointercancel', finishObstacleDrag);
  window.addEventListener('resize', () => renderSvg(latestPlan || calculatePlan()));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  const payload = {
    ...buildConfig(),
    calculation: serializePlan(latestPlan || calculatePlan()),
  };
  downloadBlob('deckenschema-zuschnitt.json', `${JSON.stringify(payload, null, 2)}\n`, 'application/json;charset=utf-8');
}

function serializePlan(plan) {
  return {
    fullPanelCount: plan.fullPanelCells.length,
    blockedPanelCount: plan.blockedPanelCells.length,
    extraPanelCount: plan.panels.length,
    totalPanelCount: plan.fullPanelCells.length + plan.panels.length,
    cutArea: roundTo(plan.cutArea),
    wasteArea: roundTo(plan.wasteArea),
    cutGroups: plan.groups.map(group => ({
      id: group.id,
      widthMeters: roundTo(group.width),
      heightMeters: roundTo(group.height),
      quantity: group.quantity,
      zones: group.zonesText,
      area: roundTo(group.area),
    })),
    purchasedPanels: plan.panels.map(panel => ({
      id: panel.id,
      cuts: summarizePanelPlacements(panel),
      usedArea: roundTo(panel.usedArea),
      wasteArea: roundTo(panel.wasteArea),
    })),
  };
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
  const plan = latestPlan || calculatePlan();
  const headers = ['nr', 'width_m', 'height_m', 'quantity', 'zones', 'area_m2'];
  const rows = plan.groups.map(group => [
    group.id,
    formatMeters(group.width),
    formatMeters(group.height),
    group.quantity,
    group.zonesText,
    formatMeters(group.area),
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(csvEscape).join(','))
    .join('\n');

  downloadBlob('deckenschema-zuschnitt.csv', `${csv}\n`, 'text/csv;charset=utf-8');
}

function exportSvg() {
  const clone = elements.ceilingSvg.cloneNode(true);
  clone.querySelectorAll('.svg-obstacle-editor').forEach(node => node.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = `
    .room-rect{fill:#fffdf8;stroke:#4e4a44;stroke-width:.018}
    .grid-line{stroke:#c5bbac;stroke-width:.007;vector-effect:non-scaling-stroke}
    .panel-boundary-line{stroke:#5f5140;stroke-width:.013;stroke-opacity:.72;vector-effect:non-scaling-stroke}
    .full-panel{fill:#ead9bd;stroke:#8b7556;stroke-width:.012;vector-effect:non-scaling-stroke}
    .cut-piece{fill:#ef8172;fill-opacity:.78;stroke:#8d271e;stroke-width:.018;vector-effect:non-scaling-stroke}
    .obstacle{fill:#5e5a53;fill-opacity:.92;stroke:#28231d;stroke-width:.018;vector-effect:non-scaling-stroke}
    text{font-family:Arial,sans-serif;pointer-events:none}.piece-label,.obstacle-label,.origin-label{font-weight:900;text-anchor:middle;dominant-baseline:middle}.piece-label{fill:#56140f}.obstacle-label,.origin-label{fill:#fff}.origin-dot{fill:#2b6f6c}.origin-axis{stroke:#2b6f6c;stroke-width:.025;vector-effect:non-scaling-stroke}
  `;
  const style = createSvgElement('style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
  downloadBlob('deckenschema-zuschnitt.svg', `${clone.outerHTML}\n`, 'image/svg+xml;charset=utf-8');
}

async function init() {
  await loadConfig();
  applyStateToInputs();
  bindGlobalEvents();
  updateAll();
}

init();
