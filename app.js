const EPS = 0.000001;
const DISPLAY_DIGITS = 3;
const CONFIG_URL = 'config.json';

const DEFAULT_STATE = {
  schemaVersion: 4,
  room: {
    widthMeters: 8.861,
    heightMeters: 4.865,
  },
  grid: {
    panelWidthMeters: 0.6,
    panelHeightMeters: 0.6,
    alignmentX: 'center',
    alignmentY: 'center',
  },
  originCorner: 'top-left',
  obstacles: [],
  combinedPanels: [],
  measureFlags: {},
};

const state = structuredCloneSafe(DEFAULT_STATE);
let latestPlan = null;
let saveTimer = null;
let selectedObstacleId = null;
let obstacleDragState = null;
const OBSTACLE_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
function createEmptyLocalReferenceState() {
  return {
    isActive: false,
    referenceObstacleId: null,
    referenceCorner: null,
    targetObstacleId: null,
    targetCorner: null,
    initialObstacles: null,
    hasDraft: false,
  };
}

function createEmptyObstacleAlignmentState() {
  return {
    isActive: false,
    selectedObstacleIds: [],
    referenceObstacleId: null,
    isSelectingReference: false,
    axis: null,
    alignment: null,
    initialObstacles: null,
    hasDraft: false,
  };
}

function createEmptyPanelCombinationState() {
  return {
    isActive: false,
    selectedCellIds: [],
    selectedCombinedPanelIds: [],
    rejectedCellId: null,
    feedbackMessage: '',
  };
}

function createEmptyDeleteModeState() {
  return {
    isActive: false,
    initialObstacles: null,
    initialCombinedPanels: null,
    deletedObstacleIds: [],
    deletedCombinedPanelIds: [],
    hasDraft: false,
  };
}

function createEmptyObstacleEditModeState() {
  return {
    isActive: false,
    initialObstacles: null,
    createdObstacleIds: [],
    currentObstacleId: null,
    sizeEntered: false,
    positionEntered: false,
    hasDraft: false,
  };
}

let localReferenceState = createEmptyLocalReferenceState();
let obstacleAlignmentState = createEmptyObstacleAlignmentState();
let panelCombinationState = createEmptyPanelCombinationState();
let deleteModeState = createEmptyDeleteModeState();
let obstacleEditModeState = createEmptyObstacleEditModeState();
let panelCombinationFeedbackTimer = null;
let shapeDetailModal = null;
let previousFocusedElement = null;

const elements = {
  widthInput: document.getElementById('width-input'),
  heightInput: document.getElementById('height-input'),
  panelWidthInput: document.getElementById('panel-width-input'),
  panelHeightInput: document.getElementById('panel-height-input'),
  alignLeftButton: document.getElementById('align-left-button'),
  alignCenterXButton: document.getElementById('align-center-x-button'),
  alignRightButton: document.getElementById('align-right-button'),
  alignTopButton: document.getElementById('align-top-button'),
  alignCenterYButton: document.getElementById('align-center-y-button'),
  alignBottomButton: document.getElementById('align-bottom-button'),
  originCornerSelect: document.getElementById('origin-corner-select'),
  addObstacleButton: document.getElementById('add-obstacle-button'),
  obstacleEditControl: document.getElementById('obstacle-edit-control'),
  obstacleEditButton: document.getElementById('obstacle-edit-button'),
  obstacleEditPanel: document.getElementById('obstacle-edit-panel'),
  obstacleEditStep1: document.getElementById('obstacle-edit-step-1'),
  obstacleEditStep2: document.getElementById('obstacle-edit-step-2'),
  obstacleEditStep3: document.getElementById('obstacle-edit-step-3'),
  obstacleEditStatus1: document.getElementById('obstacle-edit-status-1'),
  obstacleEditSizeBlock: document.getElementById('obstacle-edit-size-block'),
  obstacleEditPositionBlock: document.getElementById('obstacle-edit-position-block'),
  obstacleEditWidthInput: document.getElementById('obstacle-edit-width-input'),
  obstacleEditHeightInput: document.getElementById('obstacle-edit-height-input'),
  obstacleEditXInput: document.getElementById('obstacle-edit-x-input'),
  obstacleEditYInput: document.getElementById('obstacle-edit-y-input'),
  obstacleEditApplyButton: document.getElementById('obstacle-edit-apply-button'),
  obstacleEditCancelButton: document.getElementById('obstacle-edit-cancel-button'),
  localReferenceControl: document.getElementById('local-reference-control'),
  localReferenceButton: document.getElementById('local-reference-button'),
  localReferencePanel: document.getElementById('local-reference-panel'),
  localReferenceStep1: document.getElementById('local-reference-step-1'),
  localReferenceStep2: document.getElementById('local-reference-step-2'),
  localReferenceStep3: document.getElementById('local-reference-step-3'),
  localReferenceStatus1: document.getElementById('local-reference-status-1'),
  localReferenceStatus2: document.getElementById('local-reference-status-2'),
  localReferenceStatus3: document.getElementById('local-reference-status-3'),
  localReferenceApplyButton: document.getElementById('local-reference-apply-button'),
  localReferenceCancelButton: document.getElementById('local-reference-cancel-button'),
  obstacleAlignmentControl: document.getElementById('obstacle-alignment-control'),
  obstacleAlignmentButton: document.getElementById('obstacle-alignment-button'),
  obstacleAlignmentPanel: document.getElementById('obstacle-alignment-panel'),
  obstacleAlignmentStep1: document.getElementById('obstacle-alignment-step-1'),
  obstacleAlignmentStatus1: document.getElementById('obstacle-alignment-status-1'),
  obstacleAlignmentReferenceInfo: document.getElementById('obstacle-alignment-reference-info'),
  obstacleAlignmentReferenceButton: document.getElementById('obstacle-alignment-reference-button'),
  obstacleAlignmentReferenceLabel: document.getElementById('obstacle-alignment-reference-label'),
  obstacleAlignmentAxisBlock: document.getElementById('obstacle-alignment-axis-block'),
  obstacleAlignmentStep2: document.getElementById('obstacle-alignment-step-2'),
  obstacleAlignmentStatus2: document.getElementById('obstacle-alignment-status-2'),
  obstacleAlignmentAxisChoices: document.getElementById('obstacle-alignment-axis-choices'),
  obstacleAlignmentHorizontalButton: document.getElementById('obstacle-alignment-horizontal-button'),
  obstacleAlignmentVerticalButton: document.getElementById('obstacle-alignment-vertical-button'),
  obstacleAlignmentEdgeBlock: document.getElementById('obstacle-alignment-edge-block'),
  obstacleAlignmentStep3: document.getElementById('obstacle-alignment-step-3'),
  obstacleAlignmentStatus3: document.getElementById('obstacle-alignment-status-3'),
  obstacleAlignmentEdgeChoices: document.getElementById('obstacle-alignment-edge-choices'),
  obstacleAlignmentStartButton: document.getElementById('obstacle-alignment-start-button'),
  obstacleAlignmentCenterButton: document.getElementById('obstacle-alignment-center-button'),
  obstacleAlignmentEndButton: document.getElementById('obstacle-alignment-end-button'),
  obstacleAlignmentApplyButton: document.getElementById('obstacle-alignment-apply-button'),
  obstacleAlignmentCancelButton: document.getElementById('obstacle-alignment-cancel-button'),
  panelCombinationControl: document.getElementById('panel-combination-control'),
  panelCombinationButton: document.getElementById('panel-combination-button'),
  panelCombinationPanel: document.getElementById('panel-combination-panel'),
  panelCombinationStep1: document.getElementById('panel-combination-step-1'),
  panelCombinationStep2: document.getElementById('panel-combination-step-2'),
  panelCombinationActionBlock: document.getElementById('panel-combination-action-block'),
  panelCombinationFeedback: document.getElementById('panel-combination-feedback'),
  panelCombinationApplyButton: document.getElementById('panel-combination-apply-button'),
  panelCombinationCancelButton: document.getElementById('panel-combination-cancel-button'),
  deleteModeControl: document.getElementById('delete-mode-control'),
  deleteModeButton: document.getElementById('delete-mode-button'),
  deleteModePanel: document.getElementById('delete-mode-panel'),
  deleteModeStep1: document.getElementById('delete-mode-step-1'),
  deleteModeStatus1: document.getElementById('delete-mode-status-1'),
  deleteModeApplyButton: document.getElementById('delete-mode-apply-button'),
  deleteModeCancelButton: document.getElementById('delete-mode-cancel-button'),
  obstaclesList: document.getElementById('obstacles-list'),
  printButton: document.getElementById('print-button'),
  ceilingSvg: document.getElementById('ceiling-svg'),
  svgFrame: document.getElementById('svg-frame'),
  inlineEditorLayer: document.getElementById('inline-editor-layer'),
  cuttingDetailsTable: document.getElementById('cutting-details-table'),
  combinedPanelsTable: document.getElementById('combined-panels-table'),
  combinedCutPanelsTable: document.getElementById('combined-cut-panels-table'),
  panelPackingTable: document.getElementById('panel-packing-table'),
  fullPanelCount: document.getElementById('full-panel-count'),
  combinedPanelCount: document.getElementById('combined-panel-count'),
  extraPanelCount: document.getElementById('extra-panel-count'),
  totalPanelCount: document.getElementById('total-panel-count'),
  calculationWarning: document.getElementById('calculation-warning'),
  drawingMeta: document.getElementById('drawing-meta'),
  drawingStatusReport: document.getElementById('drawing-status-report'),
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

  const width = positiveNumber(obstacle.widthMeters, getPanelWidthMeters());
  const height = positiveNumber(obstacle.heightMeters, getPanelHeightMeters());
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

function normalizeCombinedPanel(panel, index = 0) {
  if (!panel || typeof panel !== 'object' || !Array.isArray(panel.cellIds)) {
    return null;
  }

  const cellIds = [...new Set(panel.cellIds.map(id => String(id)).filter(Boolean))];
  if (cellIds.length < 2) {
    return null;
  }

  return {
    id: String(panel.id || `K${index + 1}`),
    cellIds,
  };
}

function mergeState(config) {
  if (!config || typeof config !== 'object') {
    return;
  }

  state.schemaVersion = Number(config.schemaVersion) || DEFAULT_STATE.schemaVersion;
  state.room.widthMeters = positiveNumber(config.room?.widthMeters, DEFAULT_STATE.room.widthMeters);
  state.room.heightMeters = positiveNumber(config.room?.heightMeters, DEFAULT_STATE.room.heightMeters);
  const legacyPanelSize = positiveNumber(config.grid?.cellMeters, DEFAULT_STATE.grid.panelWidthMeters);
  state.grid.panelWidthMeters = positiveNumber(config.grid?.panelWidthMeters, legacyPanelSize);
  state.grid.panelHeightMeters = positiveNumber(config.grid?.panelHeightMeters, legacyPanelSize);
  state.grid.alignmentX = normalizeAlignmentX(config.grid?.alignmentX, DEFAULT_STATE.grid.alignmentX);
  state.grid.alignmentY = normalizeAlignmentY(config.grid?.alignmentY, DEFAULT_STATE.grid.alignmentY);
  state.originCorner = normalizeOriginCorner(config.originCorner, DEFAULT_STATE.originCorner);

  if (Array.isArray(config.obstacles)) {
    state.obstacles = config.obstacles.map(normalizeObstacle).filter(Boolean);
  } else {
    state.obstacles = [];
  }

  if (Array.isArray(config.combinedPanels)) {
    state.combinedPanels = config.combinedPanels.map(normalizeCombinedPanel).filter(Boolean);
  } else {
    state.combinedPanels = [];
  }

  state.measureFlags = config.measureFlags && typeof config.measureFlags === 'object' ? config.measureFlags : {};
}

function buildConfig() {
  return {
    schemaVersion: 4,
    room: {
      widthMeters: roundTo(state.room.widthMeters),
      heightMeters: roundTo(state.room.heightMeters),
    },
    grid: {
      panelWidthMeters: roundTo(getPanelWidthMeters()),
      panelHeightMeters: roundTo(getPanelHeightMeters()),
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
    combinedPanels: state.combinedPanels.map(panel => ({
      id: panel.id,
      cellIds: [...new Set(panel.cellIds.map(id => String(id)))],
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
  elements.panelWidthInput.value = formatMeters(getPanelWidthMeters());
  elements.panelHeightInput.value = formatMeters(getPanelHeightMeters());
  elements.originCornerSelect.value = state.originCorner;
  renderObstacleControls();
}

function getPanelWidthMeters() {
  return positiveNumber(state.grid.panelWidthMeters, DEFAULT_STATE.grid.panelWidthMeters);
}

function getPanelHeightMeters() {
  return positiveNumber(state.grid.panelHeightMeters, DEFAULT_STATE.grid.panelHeightMeters);
}

function getPanelBaseMeters() {
  return Math.min(getPanelWidthMeters(), getPanelHeightMeters());
}

function getPanelAreaMeters() {
  return getPanelWidthMeters() * getPanelHeightMeters();
}

function getGridCols() {
  return Math.max(0, Math.floor((state.room.widthMeters + EPS) / getPanelWidthMeters()));
}

function getGridRows() {
  return Math.max(0, Math.floor((state.room.heightMeters + EPS) / getPanelHeightMeters()));
}

function getGridWidthMeters() {
  return getGridCols() * getPanelWidthMeters();
}

function getGridHeightMeters() {
  return getGridRows() * getPanelHeightMeters();
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
    cols: getGridCols(),
    rows: getGridRows(),
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

function getRoomRect() {
  return {
    x: 0,
    y: 0,
    width: state.room.widthMeters,
    height: state.room.heightMeters,
  };
}

function getRectIntersection(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(rectRight(a), rectRight(b));
  const y2 = Math.min(rectBottom(a), rectBottom(b));

  if (x2 <= x1 + EPS || y2 <= y1 + EPS) {
    return null;
  }

  return {
    x: roundTo(x1, 6),
    y: roundTo(y1, 6),
    width: roundTo(x2 - x1, 6),
    height: roundTo(y2 - y1, 6),
  };
}

function getAllGridCells() {
  const grid = getGridRect();
  const panelWidth = getPanelWidthMeters();
  const panelHeight = getPanelHeightMeters();
  const cells = [];

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      cells.push({
        id: `R${row + 1}C${col + 1}`,
        row,
        col,
        x: grid.x + col * panelWidth,
        y: grid.y + row * panelHeight,
        width: panelWidth,
        height: panelHeight,
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

function getGridCellMap(cells) {
  return new Map(cells.map(cell => [cell.id, cell]));
}

function areGridCellsAdjacent(a, b) {
  if (!a || !b) {
    return false;
  }

  return (a.row === b.row && Math.abs(a.col - b.col) === 1)
    || (a.col === b.col && Math.abs(a.row - b.row) === 1);
}

function isCellAdjacentToCellIds(cell, cellIds, cellMap) {
  return cellIds.some(id => areGridCellsAdjacent(cell, cellMap.get(id)));
}

function areCellIdsConnected(cellIds, cellMap) {
  const uniqueIds = [...new Set(cellIds)].filter(id => cellMap.has(id));
  if (uniqueIds.length <= 1) {
    return uniqueIds.length === cellIds.length;
  }

  const remaining = new Set(uniqueIds);
  const queue = [uniqueIds[0]];
  remaining.delete(uniqueIds[0]);

  while (queue.length > 0) {
    const current = cellMap.get(queue.shift());
    [...remaining].forEach(id => {
      if (areGridCellsAdjacent(current, cellMap.get(id))) {
        remaining.delete(id);
        queue.push(id);
      }
    });
  }

  return remaining.size === 0;
}

function getValidCombinedPanelEntries(gridCells) {
  const gridCellMap = getGridCellMap(gridCells);
  const usedCellIds = new Set();
  const validEntries = [];

  state.combinedPanels.forEach((panel, index) => {
    const normalized = normalizeCombinedPanel(panel, index);
    if (!normalized) {
      return;
    }

    const cellIds = normalized.cellIds;
    if (cellIds.some(id => !gridCellMap.has(id) || usedCellIds.has(id))
      || cellIds.length < 2
      || !areCellIdsConnected(cellIds, gridCellMap)) {
      return;
    }

    cellIds.forEach(id => usedCellIds.add(id));
    validEntries.push({ ...normalized, cellIds });
  });

  return validEntries;
}

function getCombinedPanelCellIds(validCombinedPanels) {
  return new Set(validCombinedPanels.flatMap(panel => panel.cellIds));
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

const RENDER_AXIS_TOLERANCE = 0.0015;

function isVerticalEdge(edge) {
  return Math.abs(edge.x1 - edge.x2) < EPS;
}

function isHorizontalEdge(edge) {
  return Math.abs(edge.y1 - edge.y2) < EPS;
}

function matchesRenderedAxis(a, b, tolerance = RENDER_AXIS_TOLERANCE) {
  return Math.abs(a - b) <= tolerance;
}

function edgeTouchesObstacleAxis(edge, obstacle) {
  if (isVerticalEdge(edge)) {
    const x = edge.x1;
    const minY = Math.min(edge.y1, edge.y2);
    const maxY = Math.max(edge.y1, edge.y2);
    const matchesObstacleSide = matchesRenderedAxis(x, obstacle.x) || matchesRenderedAxis(x, rectRight(obstacle));

    if (!matchesObstacleSide) {
      return false;
    }

    return rangesOverlap(minY, maxY, obstacle.y, rectBottom(obstacle))
      || matchesRenderedAxis(minY, obstacle.y)
      || matchesRenderedAxis(minY, rectBottom(obstacle))
      || matchesRenderedAxis(maxY, obstacle.y)
      || matchesRenderedAxis(maxY, rectBottom(obstacle));
  }

  if (isHorizontalEdge(edge)) {
    const y = edge.y1;
    const minX = Math.min(edge.x1, edge.x2);
    const maxX = Math.max(edge.x1, edge.x2);
    const matchesObstacleSide = matchesRenderedAxis(y, obstacle.y) || matchesRenderedAxis(y, rectBottom(obstacle));

    if (!matchesObstacleSide) {
      return false;
    }

    return rangesOverlap(minX, maxX, obstacle.x, rectRight(obstacle))
      || matchesRenderedAxis(minX, obstacle.x)
      || matchesRenderedAxis(minX, rectRight(obstacle))
      || matchesRenderedAxis(maxX, obstacle.x)
      || matchesRenderedAxis(maxX, rectRight(obstacle));
  }

  return false;
}

function shouldHideObstacleContinuationEdge(edge, obstacleRects = []) {
  return obstacleRects.some(obstacle => edgeTouchesObstacleAxis(edge, obstacle));
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(interval => interval && interval.end > interval.start + EPS)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (sorted.length === 0) {
    return [];
  }

  const merged = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];

    if (current.start <= last.end + EPS) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function subtractIntervals(start, end, blockedIntervals) {
  const merged = mergeIntervals(blockedIntervals);
  const segments = [];
  let cursor = start;

  merged.forEach(interval => {
    if (interval.end <= cursor + EPS) {
      return;
    }

    if (interval.start > cursor + EPS) {
      segments.push({ start: cursor, end: Math.min(interval.start, end) });
    }

    cursor = Math.max(cursor, interval.end);
  });

  if (cursor < end - EPS) {
    segments.push({ start: cursor, end });
  }

  return segments.filter(segment => segment.end > segment.start + EPS);
}

function getObstacleAxisHiddenIntervals(axis, coordinate, blockedPanelCells, obstacleRects) {
  if (!Array.isArray(blockedPanelCells) || blockedPanelCells.length === 0 || !Array.isArray(obstacleRects) || obstacleRects.length === 0) {
    return [];
  }

  return blockedPanelCells.flatMap(cell => {
    const relatedToObstacleAxis = obstacleRects.some(obstacle => {
      if (axis === 'x') {
        return (matchesRenderedAxis(coordinate, obstacle.x) || matchesRenderedAxis(coordinate, rectRight(obstacle)))
          && coordinate > cell.x - EPS
          && coordinate < rectRight(cell) + EPS
          && rectIntersects(cell, obstacle);
      }

      return (matchesRenderedAxis(coordinate, obstacle.y) || matchesRenderedAxis(coordinate, rectBottom(obstacle)))
        && coordinate > cell.y - EPS
        && coordinate < rectBottom(cell) + EPS
        && rectIntersects(cell, obstacle);
    });

    if (!relatedToObstacleAxis) {
      return [];
    }

    return axis === 'x'
      ? [{ start: cell.y, end: rectBottom(cell) }]
      : [{ start: cell.x, end: rectRight(cell) }];
  });
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

function getAtomsBounds(atoms) {
  const x1 = Math.min(...atoms.map(atom => atom.x));
  const y1 = Math.min(...atoms.map(atom => atom.y));
  const x2 = Math.max(...atoms.map(atom => rectRight(atom)));
  const y2 = Math.max(...atoms.map(atom => rectBottom(atom)));

  return {
    x: roundTo(x1),
    y: roundTo(y1),
    width: roundTo(x2 - x1),
    height: roundTo(y2 - y1),
  };
}

function getPieceArea(atoms) {
  return atoms.reduce((sum, atom) => sum + rectArea(atom), 0);
}

function getNormalizedAtoms(atoms, bounds) {
  return atoms
    .map(atom => ({
      x: roundTo(atom.x - bounds.x, 6),
      y: roundTo(atom.y - bounds.y, 6),
      width: roundTo(atom.width, 6),
      height: roundTo(atom.height, 6),
    }))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.height - b.height) || (a.width - b.width));
}

function getShapeSignature(normalizedAtoms, bounds) {
  return `${roundTo(bounds.width, 6)}x${roundTo(bounds.height, 6)}|${normalizedAtoms
    .map(atom => `${atom.x}:${atom.y}:${atom.width}:${atom.height}`)
    .join('|')}`;
}

function createCutPiece(id, atoms, zone, mergeKey = '') {
  const validAtoms = atoms
    .filter(atom => atom.width > EPS && atom.height > EPS)
    .map(atom => ({
      x: roundTo(atom.x),
      y: roundTo(atom.y),
      width: roundTo(atom.width),
      height: roundTo(atom.height),
    }));

  if (validAtoms.length === 0) {
    return null;
  }

  const bounds = getAtomsBounds(validAtoms);
  const normalizedAtoms = getNormalizedAtoms(validAtoms, bounds);

  return {
    id,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    area: roundTo(getPieceArea(validAtoms)),
    zone,
    mergeKey,
    atoms: validAtoms,
    normalizedAtoms,
    shapeSignature: getShapeSignature(normalizedAtoms, bounds),
    isComplex: normalizedAtoms.length > 1,
  };
}

function createRectCutPiece(id, rect, zone, mergeKey = '') {
  return createCutPiece(id, [rect], zone, mergeKey);
}

function getLargestAtom(piece) {
  return piece.atoms.reduce((largest, atom) => {
    if (!largest || rectArea(atom) > rectArea(largest)) {
      return atom;
    }
    return largest;
  }, null);
}

function getPieceLabelPoint(piece) {
  const atom = getLargestAtom(piece);
  if (!atom) {
    return { x: piece.x + piece.width / 2, y: piece.y + piece.height / 2 };
  }

  return {
    x: atom.x + atom.width / 2,
    y: atom.y + atom.height / 2,
  };
}

function getAtomizedBoundaryRects(atoms) {
  const validAtoms = atoms.filter(atom => atom && atom.width > EPS && atom.height > EPS);

  if (validAtoms.length <= 1) {
    return validAtoms;
  }

  const xCuts = uniqueSorted(validAtoms.flatMap(atom => [atom.x, rectRight(atom)]));
  const yCuts = uniqueSorted(validAtoms.flatMap(atom => [atom.y, rectBottom(atom)]));
  const rects = [];

  for (let yi = 0; yi < yCuts.length - 1; yi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const rect = {
        x: xCuts[xi],
        y: yCuts[yi],
        width: roundTo(xCuts[xi + 1] - xCuts[xi], 6),
        height: roundTo(yCuts[yi + 1] - yCuts[yi], 6),
      };

      if (rect.width <= EPS || rect.height <= EPS) {
        continue;
      }

      const center = rectCenter(rect);
      if (validAtoms.some(atom => pointInsideRect(center.x, center.y, atom))) {
        rects.push(rect);
      }
    }
  }

  return rects;
}

function getBoundaryEdges(atoms) {
  const renderAtoms = getAtomizedBoundaryRects(atoms);
  const edgeMap = new Map();
  const pointKey = (x, y) => `${roundTo(x, 6)},${roundTo(y, 6)}`;

  const addEdge = (x1, y1, x2, y2) => {
    const startKey = pointKey(x1, y1);
    const endKey = pointKey(x2, y2);
    const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;

    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        count: 0,
        edge: {
          x1: roundTo(x1, 6),
          y1: roundTo(y1, 6),
          x2: roundTo(x2, 6),
          y2: roundTo(y2, 6),
        },
      });
    }

    edgeMap.get(key).count += 1;
  };

  renderAtoms.forEach(atom => {
    const x1 = atom.x;
    const y1 = atom.y;
    const x2 = rectRight(atom);
    const y2 = rectBottom(atom);

    addEdge(x1, y1, x2, y1);
    addEdge(x2, y1, x2, y2);
    addEdge(x2, y2, x1, y2);
    addEdge(x1, y2, x1, y1);
  });

  return [...edgeMap.values()]
    .filter(entry => entry.count === 1)
    .map(entry => entry.edge);
}

function getBoundaryPathData(atoms, transform = (x, y) => ({ x, y }), options = {}) {
  const { obstacleRects = [], hideObstacleContinuations = false } = options;

  return getBoundaryEdges(atoms)
    .filter(edge => !hideObstacleContinuations || !shouldHideObstacleContinuationEdge(edge, obstacleRects))
    .map(edge => {
      const start = transform(edge.x1, edge.y1);
      const end = transform(edge.x2, edge.y2);
      return `M ${roundTo(start.x, 6)} ${roundTo(start.y, 6)} L ${roundTo(end.x, 6)} ${roundTo(end.y, 6)}`;
    })
    .join(' ');
}


function getBoundaryFillPathData(atoms, transform = (x, y) => ({ x, y })) {
  return atoms
    .filter(atom => atom.width > EPS && atom.height > EPS)
    .map(atom => {
      const p1 = transform(atom.x, atom.y);
      const p2 = transform(rectRight(atom), atom.y);
      const p3 = transform(rectRight(atom), rectBottom(atom));
      const p4 = transform(atom.x, rectBottom(atom));
      return `M ${roundTo(p1.x, 6)} ${roundTo(p1.y, 6)} L ${roundTo(p2.x, 6)} ${roundTo(p2.y, 6)} L ${roundTo(p3.x, 6)} ${roundTo(p3.y, 6)} L ${roundTo(p4.x, 6)} ${roundTo(p4.y, 6)} Z`;
    })
    .join(' ');
}

function getClosedBoundaryPathData(atoms, transform = (x, y) => ({ x, y })) {
  const edges = getBoundaryEdges(atoms);
  const pointKey = (x, y) => `${roundTo(x, 6)},${roundTo(y, 6)}`;
  const edgePointKeys = edge => [pointKey(edge.x1, edge.y1), pointKey(edge.x2, edge.y2)];
  const edgePoints = edge => [
    { x: edge.x1, y: edge.y1 },
    { x: edge.x2, y: edge.y2 },
  ];
  const edgesByPoint = new Map();

  edges.forEach((edge, index) => {
    edgePointKeys(edge).forEach(key => {
      if (!edgesByPoint.has(key)) {
        edgesByPoint.set(key, []);
      }
      edgesByPoint.get(key).push(index);
    });
  });

  const used = new Set();
  const pathParts = [];

  for (let startIndex = 0; startIndex < edges.length; startIndex += 1) {
    if (used.has(startIndex)) {
      continue;
    }

    const startEdge = edges[startIndex];
    const [startPoint, secondPoint] = edgePoints(startEdge);
    const startKey = pointKey(startPoint.x, startPoint.y);
    let currentPoint = secondPoint;
    used.add(startIndex);

    const points = [startPoint, secondPoint];
    let guard = 0;

    while (pointKey(currentPoint.x, currentPoint.y) !== startKey && guard < edges.length + 4) {
      guard += 1;
      const currentKey = pointKey(currentPoint.x, currentPoint.y);
      const nextIndex = (edgesByPoint.get(currentKey) || []).find(index => !used.has(index));

      if (nextIndex === undefined) {
        break;
      }

      const nextEdge = edges[nextIndex];
      const [a, b] = edgePoints(nextEdge);
      const nextPoint = pointKey(a.x, a.y) === currentKey ? b : a;
      used.add(nextIndex);
      points.push(nextPoint);
      currentPoint = nextPoint;
    }

    if (points.length >= 3 && pointKey(currentPoint.x, currentPoint.y) === startKey) {
      const commands = points.slice(0, -1).map((point, index) => {
        const transformed = transform(point.x, point.y);
        const prefix = index === 0 ? 'M' : 'L';
        return `${prefix} ${roundTo(transformed.x, 6)} ${roundTo(transformed.y, 6)}`;
      });
      pathParts.push(`${commands.join(' ')} Z`);
    }
  }

  return pathParts.join(' ');
}

function getShapePreviewSvgMarkup(group) {
  const iconClass = group?.kind === 'combined'
    ? 'shape-icon combined-shape-icon'
    : group?.kind === 'combined-cut'
      ? 'shape-icon combined-cut-shape-icon'
      : 'shape-icon';
  const width = 56;
  const height = 38;
  const padding = 2;
  const scale = Math.min(
    (width - padding * 2) / Math.max(group.width, EPS),
    (height - padding * 2) / Math.max(group.height, EPS),
  );
  const offsetX = (width - group.width * scale) / 2;
  const offsetY = (height - group.height * scale) / 2;
  const transform = (x, y) => ({
    x: offsetX + x * scale,
    y: offsetY + y * scale,
  });

  const rects = group.normalizedAtoms.map(atom => {
    const point = transform(atom.x, atom.y);
    const w = roundTo(atom.width * scale, 3);
    const h = roundTo(atom.height * scale, 3);
    return `<rect x="${roundTo(point.x, 3)}" y="${roundTo(point.y, 3)}" width="${w}" height="${h}" rx="1.4"></rect>`;
  }).join('');
  const outline = getBoundaryPathData(group.normalizedAtoms, transform);

  return `
    <svg class="${iconClass}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect class="shape-icon-frame" x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="5"></rect>
      <g class="shape-icon-fill">${rects}</g>
      <path class="shape-icon-outline" d="${outline}"></path>
    </svg>
  `;
}


function getShapeMeasurementAtoms(group) {
  return group.normalizedAtoms.map((atom, index) => ({
    id: `R${index + 1}`,
    x: roundTo(atom.x, 6),
    y: roundTo(atom.y, 6),
    width: roundTo(atom.width, 6),
    height: roundTo(atom.height, 6),
  }));
}

function getShapeDimensionCuts(group, axis) {
  const values = [];
  group.normalizedAtoms.forEach(atom => {
    if (axis === 'x') {
      values.push(atom.x, rectRight(atom));
    } else {
      values.push(atom.y, rectBottom(atom));
    }
  });
  return uniqueSorted(values);
}

function getShapeDimensionSegments(group, axis) {
  const cuts = getShapeDimensionCuts(group, axis);
  const segments = [];

  for (let index = 0; index < cuts.length - 1; index += 1) {
    const start = cuts[index];
    const end = cuts[index + 1];

    if (end > start + EPS) {
      segments.push({
        id: `${axis}${segments.length + 1}`,
        axis,
        start,
        end,
        size: roundTo(end - start, 6),
      });
    }
  }

  return segments;
}

function rectCenterInsideAnyRect(rect, candidates) {
  const center = rectCenter(rect);
  return candidates.some(candidate => pointInsideRect(center.x, center.y, candidate));
}

function canMergeMeasurementRectsHorizontally(left, right) {
  return Math.abs(left.y - right.y) < EPS
    && Math.abs(left.height - right.height) < EPS
    && Math.abs(rectRight(left) - right.x) < EPS;
}

function canMergeMeasurementRectsVertically(top, bottom) {
  return Math.abs(top.x - bottom.x) < EPS
    && Math.abs(top.width - bottom.width) < EPS
    && Math.abs(rectBottom(top) - bottom.y) < EPS;
}

function mergeMeasurementRects(rects) {
  let merged = rects.map(rect => ({ ...rect }));
  let changed = true;

  while (changed) {
    changed = false;
    const used = new Set();
    const next = [];

    for (let i = 0; i < merged.length; i += 1) {
      if (used.has(i)) {
        continue;
      }

      let current = { ...merged[i] };

      for (let j = i + 1; j < merged.length; j += 1) {
        if (used.has(j)) {
          continue;
        }

        const candidate = merged[j];
        if (canMergeMeasurementRectsHorizontally(current, candidate)) {
          current.width = roundTo(current.width + candidate.width, 6);
          used.add(j);
          changed = true;
          break;
        }

        if (canMergeMeasurementRectsHorizontally(candidate, current)) {
          current = {
            x: candidate.x,
            y: current.y,
            width: roundTo(current.width + candidate.width, 6),
            height: current.height,
          };
          used.add(j);
          changed = true;
          break;
        }

        if (canMergeMeasurementRectsVertically(current, candidate)) {
          current.height = roundTo(current.height + candidate.height, 6);
          used.add(j);
          changed = true;
          break;
        }

        if (canMergeMeasurementRectsVertically(candidate, current)) {
          current = {
            x: current.x,
            y: candidate.y,
            width: current.width,
            height: roundTo(current.height + candidate.height, 6),
          };
          used.add(j);
          changed = true;
          break;
        }
      }

      next.push(current);
    }

    merged = next
      .filter(rect => rect.width > EPS && rect.height > EPS)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.height - b.height) || (a.width - b.width));
  }

  return merged;
}

function getShapeVoidRects(group) {
  const atoms = getShapeMeasurementAtoms(group);
  const xCuts = getShapeDimensionCuts(group, 'x');
  const yCuts = getShapeDimensionCuts(group, 'y');
  const rawVoids = [];

  for (let yi = 0; yi < yCuts.length - 1; yi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const rect = {
        x: xCuts[xi],
        y: yCuts[yi],
        width: roundTo(xCuts[xi + 1] - xCuts[xi], 6),
        height: roundTo(yCuts[yi + 1] - yCuts[yi], 6),
      };

      if (rect.width <= EPS || rect.height <= EPS) {
        continue;
      }

      if (!rectCenterInsideAnyRect(rect, atoms)) {
        rawVoids.push(rect);
      }
    }
  }

  return mergeMeasurementRects(rawVoids).map((rect, index) => ({
    id: `A${index + 1}`,
    ...rect,
  }));
}

function getSvgDimensionLineMarkup(x1, y1, x2, y2, label, options = {}) {
  const {
    className = 'shape-detail-dimension-line',
    labelClassName = 'shape-detail-dimension-label',
    orientation = 'horizontal',
    labelDx = 0,
    labelDy = 0,
    rotateLabel = orientation === 'vertical',
  } = options;
  const tickSize = 7;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const safeLabel = escapeHtml(label);

  if (orientation === 'vertical') {
    const labelX = centerX + labelDx;
    const labelY = centerY + labelDy;
    return `
      <line class="${className}" x1="${roundTo(x1, 3)}" y1="${roundTo(y1, 3)}" x2="${roundTo(x2, 3)}" y2="${roundTo(y2, 3)}"></line>
      <line class="shape-detail-dimension-tick" x1="${roundTo(x1 - tickSize, 3)}" y1="${roundTo(y1, 3)}" x2="${roundTo(x1 + tickSize, 3)}" y2="${roundTo(y1, 3)}"></line>
      <line class="shape-detail-dimension-tick" x1="${roundTo(x2 - tickSize, 3)}" y1="${roundTo(y2, 3)}" x2="${roundTo(x2 + tickSize, 3)}" y2="${roundTo(y2, 3)}"></line>
      <text class="${labelClassName}" x="${roundTo(labelX, 3)}" y="${roundTo(labelY, 3)}" ${rotateLabel ? `transform="rotate(-90 ${roundTo(labelX, 3)} ${roundTo(labelY, 3)})"` : ''}>${safeLabel}</text>
    `;
  }

  return `
    <line class="${className}" x1="${roundTo(x1, 3)}" y1="${roundTo(y1, 3)}" x2="${roundTo(x2, 3)}" y2="${roundTo(y2, 3)}"></line>
    <line class="shape-detail-dimension-tick" x1="${roundTo(x1, 3)}" y1="${roundTo(y1 - tickSize, 3)}" x2="${roundTo(x1, 3)}" y2="${roundTo(y1 + tickSize, 3)}"></line>
    <line class="shape-detail-dimension-tick" x1="${roundTo(x2, 3)}" y1="${roundTo(y2 - tickSize, 3)}" x2="${roundTo(x2, 3)}" y2="${roundTo(y2 + tickSize, 3)}"></line>
    <text class="${labelClassName}" x="${roundTo(centerX + labelDx, 3)}" y="${roundTo(centerY - 8 + labelDy, 3)}">${safeLabel}</text>
  `;
}

function getShapeDetailSvgMarkup(group) {
  const width = 860;
  const height = 600;
  const margin = { left: 108, top: 82, right: 118, bottom: 112 };
  const drawableWidth = width - margin.left - margin.right;
  const drawableHeight = height - margin.top - margin.bottom;
  const scale = Math.min(
    drawableWidth / Math.max(group.width, EPS),
    drawableHeight / Math.max(group.height, EPS),
  );
  const shapeWidth = group.width * scale;
  const shapeHeight = group.height * scale;
  const offsetX = margin.left + (drawableWidth - shapeWidth) / 2;
  const offsetY = margin.top + (drawableHeight - shapeHeight) / 2;
  const transform = (x, y) => ({
    x: offsetX + x * scale,
    y: offsetY + y * scale,
  });
  const atoms = getShapeMeasurementAtoms(group);
  const voids = getShapeVoidRects(group);
  const outline = getBoundaryPathData(group.normalizedAtoms, transform);
  const outerBottomY = offsetY + shapeHeight + 58;
  const outerRightX = offsetX + shapeWidth + 58;
  const segmentTopY = Math.max(28, offsetY - 38);
  const segmentLeftX = Math.max(38, offsetX - 42);

  const atomRects = atoms.map(atom => {
    const point = transform(atom.x, atom.y);
    const rectWidth = atom.width * scale;
    const rectHeight = atom.height * scale;

    return `
      <rect class="shape-detail-atom" x="${roundTo(point.x, 3)}" y="${roundTo(point.y, 3)}" width="${roundTo(rectWidth, 3)}" height="${roundTo(rectHeight, 3)}"></rect>
    `;
  }).join('');

  const voidRects = voids.map(voidRect => {
    const point = transform(voidRect.x, voidRect.y);
    const rectWidth = voidRect.width * scale;
    const rectHeight = voidRect.height * scale;
    return `
      <rect class="shape-detail-void" x="${roundTo(point.x, 3)}" y="${roundTo(point.y, 3)}" width="${roundTo(rectWidth, 3)}" height="${roundTo(rectHeight, 3)}"></rect>
      <text class="shape-detail-void-label" x="${roundTo(point.x + rectWidth / 2, 3)}" y="${roundTo(point.y + rectHeight / 2, 3)}">${escapeHtml(voidRect.id)}</text>
    `;
  }).join('');

  const xSegmentLines = getShapeDimensionSegments(group, 'x').map(segment => {
    const start = transform(segment.start, 0);
    const end = transform(segment.end, 0);
    if (end.x - start.x < 26) {
      return '';
    }
    return getSvgDimensionLineMarkup(start.x, segmentTopY, end.x, segmentTopY, segment.id, {
      className: 'shape-detail-segment-line',
      labelClassName: 'shape-detail-segment-label',
      labelDy: -4,
    });
  }).join('');

  const ySegmentLines = getShapeDimensionSegments(group, 'y').map(segment => {
    const start = transform(0, segment.start);
    const end = transform(0, segment.end);
    if (end.y - start.y < 26) {
      return '';
    }
    return getSvgDimensionLineMarkup(segmentLeftX, start.y, segmentLeftX, end.y, segment.id, {
      className: 'shape-detail-segment-line',
      labelClassName: 'shape-detail-segment-label',
      orientation: 'vertical',
      labelDx: -14,
    });
  }).join('');

  const topLeft = transform(0, 0);
  const bottomRight = transform(group.width, group.height);

  return `
    <svg class="shape-detail-svg${group?.kind === 'combined' ? ' combined-shape-detail' : group?.kind === 'combined-cut' ? ' combined-cut-shape-detail' : ''}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Maßzeichnung ${escapeHtml(group.id)}">
      <rect class="shape-detail-canvas" x="0" y="0" width="${width}" height="${height}" rx="18"></rect>
      <line class="shape-detail-extension" x1="${roundTo(topLeft.x, 3)}" y1="${roundTo(offsetY, 3)}" x2="${roundTo(topLeft.x, 3)}" y2="${roundTo(outerBottomY, 3)}"></line>
      <line class="shape-detail-extension" x1="${roundTo(bottomRight.x, 3)}" y1="${roundTo(offsetY, 3)}" x2="${roundTo(bottomRight.x, 3)}" y2="${roundTo(outerBottomY, 3)}"></line>
      <line class="shape-detail-extension" x1="${roundTo(offsetX, 3)}" y1="${roundTo(topLeft.y, 3)}" x2="${roundTo(outerRightX, 3)}" y2="${roundTo(topLeft.y, 3)}"></line>
      <line class="shape-detail-extension" x1="${roundTo(offsetX, 3)}" y1="${roundTo(bottomRight.y, 3)}" x2="${roundTo(outerRightX, 3)}" y2="${roundTo(bottomRight.y, 3)}"></line>
      ${xSegmentLines}
      ${ySegmentLines}
      ${atomRects}
      ${voidRects}
      <path class="shape-detail-outline" d="${outline}"></path>
      ${getSvgDimensionLineMarkup(offsetX, outerBottomY, offsetX + shapeWidth, outerBottomY, `Gesamt ${formatMeters(group.width)} m`, { labelDy: -4 })}
      ${getSvgDimensionLineMarkup(outerRightX, offsetY, outerRightX, offsetY + shapeHeight, `Gesamt ${formatMeters(group.height)} m`, { orientation: 'vertical', labelDx: 18 })}
    </svg>
  `;
}

function getShapeMeasurementTableMarkup(title, rows, emptyText) {
  if (rows.length === 0) {
    return `
      <section class="shape-detail-measure-card">
        <h4>${escapeHtml(title)}</h4>
        <p class="shape-detail-empty">${escapeHtml(emptyText)}</p>
      </section>
    `;
  }

  const body = rows.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.id)}</strong></td>
      <td>${formatMeters(row.width)}</td>
      <td>${formatMeters(row.height)}</td>
    </tr>
  `).join('');

  return `
    <section class="shape-detail-measure-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="shape-detail-table-wrap">
        <table class="shape-detail-table">
          <thead>
            <tr>
              <th>Teil</th>
              <th>Breite</th>
              <th>Höhe</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

function getShapeSegmentTableMarkup(group) {
  const segments = [
    ...getShapeDimensionSegments(group, 'x'),
    ...getShapeDimensionSegments(group, 'y'),
  ];

  const rows = segments.map(segment => `
    <tr>
      <td><strong>${escapeHtml(segment.id)}</strong></td>
      <td>${formatMeters(segment.size)} m</td>
    </tr>
  `).join('');

  return `
    <section class="shape-detail-measure-card shape-detail-segment-card">
      <h4>Zwischenmaße nach Schnittkanten</h4>
      <div class="shape-detail-table-wrap">
        <table class="shape-detail-table shape-detail-segment-table">
          <thead>
            <tr>
              <th>Zwischenmaß</th>
              <th>Größe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function getShapeRelatedObstacleText(group) {
  if (!group?.isComplex) {
    return '';
  }

  const obstacleIds = new Set();
  group.pieces.forEach(piece => {
    String(piece.zone || '').match(/S\d+/g)?.forEach(id => obstacleIds.add(id));
    String(piece.mergeKey || '').match(/S\d+/g)?.forEach(id => obstacleIds.add(id));
  });

  return [...obstacleIds].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).join(', ');
}


function getShapeDetailContentMarkup(group) {
  const voids = getShapeVoidRects(group);
  const isCombined = group?.kind === 'combined';
  const isCombinedCut = group?.kind === 'combined-cut';
  const detailName = isCombined ? 'kombiniertes Paneel' : isCombinedCut ? 'zugeschnittene kombinierte Paneel' : 'Zuschnittstück';
  const eyebrow = isCombined ? 'Maßzeichnung kombiniertes Paneel' : isCombinedCut ? 'Maßzeichnung Zuschnitt kombiniertes Paneel' : 'Maßzeichnung Zuschnitt';
  const relatedObstacleText = getShapeRelatedObstacleText(group);
  const relatedObstacleRow = relatedObstacleText
    ? `<div><dt>Sperrfläche</dt><dd>${escapeHtml(relatedObstacleText)}</dd></div>`
    : '';
  const rasterRows = isCombined || isCombinedCut
    ? `
      <div><dt>Raster-Paneele pro Stück</dt><dd>${group.standardCellCountPerPiece}</dd></div>
      <div><dt>Raster-Paneele gesamt</dt><dd>${group.totalStandardCellCount}</dd></div>
      ${isCombinedCut ? `<div><dt>Ausschnitt gesamt</dt><dd>${formatArea(group.cutAwayArea || 0)}</dd></div>` : ''}
    `
    : '';
  const voidsSection = voids.length > 0
    ? getShapeMeasurementTableMarkup('Aussparungen', voids, '')
    : '';

  return `
    <div class="shape-detail-backdrop" role="presentation">
      <section class="shape-detail-modal" role="dialog" aria-modal="true" aria-labelledby="shape-detail-title">
        <header class="shape-detail-header">
          <div>
            <p class="shape-detail-eyebrow">${eyebrow}</p>
            <h3 id="shape-detail-title">${escapeHtml(group.displayId || group.id)} · ${formatMeters(group.width)} × ${formatMeters(group.height)} m</h3>
            <p class="shape-detail-subtitle">Die Maßzeichnung zeigt nur Form und Maße für dieses ${detailName}.</p>
          </div>
          <button class="shape-detail-close" type="button" aria-label="Maßzeichnung schließen">×</button>
        </header>
        <div class="shape-detail-body">
          <div class="shape-detail-drawing-wrap">
            ${getShapeDetailSvgMarkup(group)}
          </div>
          <aside class="shape-detail-measures">
            <section class="shape-detail-measure-card shape-detail-summary-card">
              <h4>Gesamtmaße</h4>
              <dl>
                <div><dt>Gesamtbreite</dt><dd>${formatMeters(group.width)} m</dd></div>
                <div><dt>Gesamthöhe</dt><dd>${formatMeters(group.height)} m</dd></div>
                <div><dt>Stückzahl</dt><dd>${group.quantity}</dd></div>
                ${rasterRows}
                ${relatedObstacleRow}
              </dl>
            </section>
            ${voidsSection}
            ${getShapeSegmentTableMarkup(group)}
          </aside>
        </div>
      </section>
    </div>
  `;
}

function closeShapeDetailModal() {
  if (!shapeDetailModal) {
    return;
  }

  shapeDetailModal.remove();
  shapeDetailModal = null;
  document.body.classList.remove('modal-open');
  window.removeEventListener('keydown', handleShapeDetailKeydown);

  if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
    previousFocusedElement.focus();
  }
  previousFocusedElement = null;
}

function handleShapeDetailKeydown(event) {
  if (event.key === 'Escape') {
    closeShapeDetailModal();
  }
}

function openShapeDetailModal(groupId) {
  const plan = latestPlan || calculatePlan();
  const group = [...plan.groups, ...plan.combinedGroups, ...plan.combinedCutGroups].find(item => item.id === groupId);

  if (!group) {
    return;
  }

  closeShapeDetailModal();
  previousFocusedElement = document.activeElement;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = getShapeDetailContentMarkup(group);
  shapeDetailModal = wrapper.firstElementChild;
  document.body.appendChild(shapeDetailModal);
  document.body.classList.add('modal-open');

  const closeButton = shapeDetailModal.querySelector('.shape-detail-close');
  closeButton.addEventListener('click', closeShapeDetailModal);
  shapeDetailModal.addEventListener('click', event => {
    if (event.target === shapeDetailModal) {
      closeShapeDetailModal();
    }
  });
  window.addEventListener('keydown', handleShapeDetailKeydown);
  closeButton.focus();
}

function getCutMergeKey(piece) {
  return piece.mergeKey || piece.zone || '';
}

function haveSameCutContext(a, b) {
  return getCutMergeKey(a) === getCutMergeKey(b);
}

function canMergeCutPiecesHorizontally(left, right, panelWidth, panelHeight) {
  return haveSameCutContext(left, right)
    && Math.abs(left.y - right.y) < EPS
    && Math.abs(left.height - right.height) < EPS
    && Math.abs(rectRight(left) - right.x) < EPS
    && left.width + right.width <= panelWidth + EPS
    && left.height <= panelHeight + EPS;
}

function canMergeCutPiecesVertically(top, bottom, panelWidth, panelHeight) {
  return haveSameCutContext(top, bottom)
    && Math.abs(top.x - bottom.x) < EPS
    && Math.abs(top.width - bottom.width) < EPS
    && Math.abs(rectBottom(top) - bottom.y) < EPS
    && top.width <= panelWidth + EPS
    && top.height + bottom.height <= panelHeight + EPS;
}

function mergeCutPiecesPass(pieces, orientation) {
  const panelWidth = getPanelWidthMeters();
  const panelHeight = getPanelHeightMeters();
  const sorted = [...pieces].sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.height - b.height) || (a.width - b.width));
  const used = new Set();
  const mergedPieces = [];
  let changed = false;

  for (let i = 0; i < sorted.length; i += 1) {
    if (used.has(i)) {
      continue;
    }

    let current = { ...sorted[i] };
    let mergedCurrent = true;

    while (mergedCurrent) {
      mergedCurrent = false;

      for (let j = 0; j < sorted.length; j += 1) {
        if (i === j || used.has(j)) {
          continue;
        }

        const candidate = sorted[j];
        const canMerge = orientation === 'horizontal'
          ? canMergeCutPiecesHorizontally(current, candidate, panelWidth, panelHeight)
          : canMergeCutPiecesVertically(current, candidate, panelWidth, panelHeight);

        if (!canMerge) {
          continue;
        }

        current = {
          ...current,
          x: Math.min(current.x, candidate.x),
          y: Math.min(current.y, candidate.y),
          width: orientation === 'horizontal' ? current.width + candidate.width : current.width,
          height: orientation === 'vertical' ? current.height + candidate.height : current.height,
          area: rectArea(current) + rectArea(candidate),
        };
        used.add(j);
        changed = true;
        mergedCurrent = true;
        break;
      }
    }

    mergedPieces.push(current);
  }

  return { pieces: mergedPieces, changed };
}

function optimizeCutPieces(pieces) {
  let optimized = pieces.filter(piece => piece.width > EPS && piece.height > EPS);

  for (let iteration = 0; iteration < 50; iteration += 1) {
    const horizontal = mergeCutPiecesPass(optimized, 'horizontal');
    const vertical = mergeCutPiecesPass(horizontal.pieces, 'vertical');
    optimized = vertical.pieces;

    if (!horizontal.changed && !vertical.changed) {
      break;
    }
  }

  return optimized
    .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.height - b.height) || (a.width - b.width))
    .map((piece, index) => ({
      id: `piece-${index + 1}`,
      x: roundTo(piece.x),
      y: roundTo(piece.y),
      width: roundTo(piece.width),
      height: roundTo(piece.height),
      zone: piece.zone,
      mergeKey: piece.mergeKey,
    }));
}

function rectCenter(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function rectContainsCenterOf(container, rect) {
  const center = rectCenter(rect);
  return pointInsideRect(center.x, center.y, container);
}

function getGridLineCuts() {
  const grid = getGridRect();
  const xCuts = [0, state.room.widthMeters];
  const yCuts = [0, state.room.heightMeters];

  addCutBoundary(xCuts, grid.x, state.room.widthMeters);
  addCutBoundary(xCuts, rectRight(grid), state.room.widthMeters);
  addCutBoundary(yCuts, grid.y, state.room.heightMeters);
  addCutBoundary(yCuts, rectBottom(grid), state.room.heightMeters);

  for (let col = 0; col <= grid.cols; col += 1) {
    addCutBoundary(xCuts, grid.x + col * getPanelWidthMeters(), state.room.widthMeters);
  }

  for (let row = 0; row <= grid.rows; row += 1) {
    addCutBoundary(yCuts, grid.y + row * getPanelHeightMeters(), state.room.heightMeters);
  }

  return { xCuts: uniqueSorted(xCuts), yCuts: uniqueSorted(yCuts) };
}

function getOuterZoneLabel(rect, grid) {
  const center = rectCenter(rect);

  if (center.y < grid.y - EPS) return 'oben';
  if (center.y > rectBottom(grid) + EPS) return 'unten';
  if (center.x < grid.x - EPS) return 'links';
  if (center.x > rectRight(grid) + EPS) return 'rechts';
  return 'außerhalb Raster';
}

function calculateOuterGridCutPieces(obstacleRects) {
  const room = getRoomRect();
  const grid = getGridRect();
  const { xCuts, yCuts } = getGridLineCuts();
  const rectPieces = [];

  for (let yi = 0; yi < yCuts.length - 1; yi += 1) {
    for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
      const rect = {
        x: xCuts[xi],
        y: yCuts[yi],
        width: xCuts[xi + 1] - xCuts[xi],
        height: yCuts[yi + 1] - yCuts[yi],
      };

      if (rect.width <= EPS || rect.height <= EPS || !rectInsideRect(rect, room)) {
        continue;
      }

      const center = rectCenter(rect);
      if (pointInsideRect(center.x, center.y, grid)) {
        continue;
      }

      if (obstacleRects.some(obstacle => pointInsideRect(center.x, center.y, obstacle))) {
        continue;
      }

      const zone = getOuterZoneLabel(rect, grid);
      rectPieces.push({
        id: `piece-${rectPieces.length + 1}`,
        x: roundTo(rect.x),
        y: roundTo(rect.y),
        width: roundTo(rect.width),
        height: roundTo(rect.height),
        zone,
        mergeKey: `outer:${zone}`,
      });
    }
  }

  const optimized = optimizeCutPieces(rectPieces);
  return optimized.map(piece => createRectCutPiece(piece.id, piece, piece.zone, piece.mergeKey)).filter(Boolean);
}

function getRoomBoundaryZoneLabel(cell) {
  const zones = [];

  if (cell.y < -EPS) zones.push('oben');
  if (rectBottom(cell) > state.room.heightMeters + EPS) zones.push('unten');
  if (cell.x < -EPS) zones.push('links');
  if (rectRight(cell) > state.room.widthMeters + EPS) zones.push('rechts');

  return zones.length > 0 ? zones.join(' / ') : 'Randzuschnitt';
}

function calculateClippedGridCellCutPiece(cell, obstacleRects, index) {
  const room = getRoomRect();
  const clippedCell = getRectIntersection(cell, room);

  if (!clippedCell || rectInsideRoom(cell)) {
    return null;
  }

  const relatedObstacles = obstacleRects.filter(obstacle => rectIntersects(clippedCell, obstacle));
  const xCuts = [clippedCell.x, rectRight(clippedCell)];
  const yCuts = [clippedCell.y, rectBottom(clippedCell)];

  relatedObstacles.forEach(obstacle => {
    addCutBoundary(xCuts, clamp(obstacle.x, clippedCell.x, rectRight(clippedCell)), state.room.widthMeters);
    addCutBoundary(xCuts, clamp(rectRight(obstacle), clippedCell.x, rectRight(clippedCell)), state.room.widthMeters);
    addCutBoundary(yCuts, clamp(obstacle.y, clippedCell.y, rectBottom(clippedCell)), state.room.heightMeters);
    addCutBoundary(yCuts, clamp(rectBottom(obstacle), clippedCell.y, rectBottom(clippedCell)), state.room.heightMeters);
  });

  const xs = uniqueSorted(xCuts);
  const ys = uniqueSorted(yCuts);
  const atoms = [];

  for (let yi = 0; yi < ys.length - 1; yi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const atom = {
        x: xs[xi],
        y: ys[yi],
        width: xs[xi + 1] - xs[xi],
        height: ys[yi + 1] - ys[yi],
      };

      if (atom.width <= EPS || atom.height <= EPS) {
        continue;
      }

      const center = rectCenter(atom);
      if (!pointInsideRect(center.x, center.y, clippedCell)) {
        continue;
      }

      if (relatedObstacles.some(obstacle => pointInsideRect(center.x, center.y, obstacle))) {
        continue;
      }

      atoms.push(atom);
    }
  }

  const zone = getRoomBoundaryZoneLabel(cell);
  return createCutPiece(`boundary-${index + 1}`, atoms, zone, `boundary-cell:${cell.id}`);
}

function calculateRoomBoundaryCutPieces(allCells, obstacleRects) {
  return allCells
    .map((cell, index) => calculateClippedGridCellCutPiece(cell, obstacleRects, index))
    .filter(Boolean);
}

function getBlockedCellZone(cell, relatedObstacles) {
  if (relatedObstacles.length === 0) {
    return 'um Sperrfläche';
  }

  if (relatedObstacles.length > 1) {
    return `um ${relatedObstacles.map(obstacle => obstacle.id).join('/')}`;
  }

  const obstacle = relatedObstacles[0];
  if (rectBottom(cell) <= obstacle.y + EPS) return `vor ${obstacle.id}`;
  if (cell.y >= rectBottom(obstacle) - EPS) return `hinter ${obstacle.id}`;
  if (rectRight(cell) <= obstacle.x + EPS) return `links von ${obstacle.id}`;
  if (cell.x >= rectRight(obstacle) - EPS) return `rechts von ${obstacle.id}`;
  return `um ${obstacle.id}`;
}

function calculateBlockedCellCutPiece(cell, obstacleRects, index) {
  const relatedObstacles = obstacleRects.filter(obstacle => rectIntersects(cell, obstacle));
  const xCuts = [cell.x, rectRight(cell)];
  const yCuts = [cell.y, rectBottom(cell)];

  relatedObstacles.forEach(obstacle => {
    addCutBoundary(xCuts, clamp(obstacle.x, cell.x, rectRight(cell)), state.room.widthMeters);
    addCutBoundary(xCuts, clamp(rectRight(obstacle), cell.x, rectRight(cell)), state.room.widthMeters);
    addCutBoundary(yCuts, clamp(obstacle.y, cell.y, rectBottom(cell)), state.room.heightMeters);
    addCutBoundary(yCuts, clamp(rectBottom(obstacle), cell.y, rectBottom(cell)), state.room.heightMeters);
  });

  const xs = uniqueSorted(xCuts);
  const ys = uniqueSorted(yCuts);
  const atoms = [];

  for (let yi = 0; yi < ys.length - 1; yi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const atom = {
        x: xs[xi],
        y: ys[yi],
        width: xs[xi + 1] - xs[xi],
        height: ys[yi + 1] - ys[yi],
      };

      if (atom.width <= EPS || atom.height <= EPS) {
        continue;
      }

      const center = rectCenter(atom);
      if (!pointInsideRect(center.x, center.y, cell)) {
        continue;
      }

      if (relatedObstacles.some(obstacle => pointInsideRect(center.x, center.y, obstacle))) {
        continue;
      }

      atoms.push(atom);
    }
  }

  return createCutPiece(`blocked-${index + 1}`, atoms, getBlockedCellZone(cell, relatedObstacles), `blocked-cell:${cell.id}`);
}


function getCellAtomsOutsideObstacles(cell, obstacleRects) {
  const relatedObstacles = obstacleRects.filter(obstacle => rectIntersects(cell, obstacle));
  if (relatedObstacles.length === 0) {
    return [{
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
    }];
  }

  const xCuts = [cell.x, rectRight(cell)];
  const yCuts = [cell.y, rectBottom(cell)];

  relatedObstacles.forEach(obstacle => {
    addCutBoundary(xCuts, clamp(obstacle.x, cell.x, rectRight(cell)), state.room.widthMeters);
    addCutBoundary(xCuts, clamp(rectRight(obstacle), cell.x, rectRight(cell)), state.room.widthMeters);
    addCutBoundary(yCuts, clamp(obstacle.y, cell.y, rectBottom(cell)), state.room.heightMeters);
    addCutBoundary(yCuts, clamp(rectBottom(obstacle), cell.y, rectBottom(cell)), state.room.heightMeters);
  });

  const xs = uniqueSorted(xCuts);
  const ys = uniqueSorted(yCuts);
  const atoms = [];

  for (let yi = 0; yi < ys.length - 1; yi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const atom = {
        x: xs[xi],
        y: ys[yi],
        width: xs[xi + 1] - xs[xi],
        height: ys[yi + 1] - ys[yi],
      };

      if (atom.width <= EPS || atom.height <= EPS) {
        continue;
      }

      const center = rectCenter(atom);
      if (!pointInsideRect(center.x, center.y, cell)) {
        continue;
      }

      if (relatedObstacles.some(obstacle => pointInsideRect(center.x, center.y, obstacle))) {
        continue;
      }

      atoms.push(atom);
    }
  }

  return atoms;
}

function calculateObstacleCutPieces(blockedPanelCells, obstacleRects) {
  return blockedPanelCells
    .map((cell, index) => calculateBlockedCellCutPiece(cell, obstacleRects, index))
    .filter(Boolean);
}

function calculateCutPieces(allCells, fullPanelCells, blockedPanelCells, obstacleRects) {
  const outerPieces = calculateOuterGridCutPieces(obstacleRects);
  const roomBoundaryPieces = calculateRoomBoundaryCutPieces(allCells, obstacleRects);
  const obstaclePieces = calculateObstacleCutPieces(blockedPanelCells, obstacleRects);

  return [...outerPieces, ...roomBoundaryPieces, ...obstaclePieces]
    .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.height - b.height) || (a.width - b.width));
}

function buildGroups(cutPieces) {
  const groupsByKey = new Map();

  cutPieces.forEach(piece => {
    const key = piece.shapeSignature;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        id: `Z${groupsByKey.size + 1}`,
        width: piece.width,
        height: piece.height,
        pieces: [],
        zones: new Set(),
        normalizedAtoms: piece.normalizedAtoms,
        isComplex: piece.isComplex,
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
    area: roundTo(group.pieces.reduce((sum, piece) => sum + piece.area, 0)),
    zonesText: [...group.zones].join(', '),
  }));
}

function pruneFreeRects(freeRects) {
  return freeRects.filter((rect, index) => rect.width > EPS && rect.height > EPS
    && !freeRects.some((other, otherIndex) => otherIndex !== index && rectInsideRect(rect, other)));
}

function tryPlacePiece(panel, piece) {
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
  panel.wasteArea = panel.width * panel.height - panel.usedArea;
  return true;
}

function packPiecesIntoPanels(groups) {
  const panelWidth = getPanelWidthMeters();
  const panelHeight = getPanelHeightMeters();
  const panelArea = getPanelAreaMeters();
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
      if (tryPlacePiece(panel, piece)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      const panel = {
        id: `P${panels.length + 1}`,
        width: panelWidth,
        height: panelHeight,
        placements: [],
        freeRects: [{ x: 0, y: 0, width: panelWidth, height: panelHeight }],
        usedArea: 0,
        wasteArea: panelArea,
      };
      tryPlacePiece(panel, piece);
      panels.push(panel);
    }
  });

  return panels;
}

function calculateCombinedPanelPieces(validCombinedPanels, gridCellMap, obstacleRects) {
  const originalPieces = [];
  const displayPieces = [];
  const cutPieces = [];

  validCombinedPanels.forEach((panel, index) => {
    const originalAtoms = panel.cellIds
      .map(id => gridCellMap.get(id))
      .filter(Boolean)
      .map(cell => ({
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height,
      }));
    const sourceId = panel.id || `K${index + 1}`;
    const originalPiece = createCutPiece(sourceId, originalAtoms, 'kombiniert', `combined:${sourceId}`);

    if (!originalPiece) {
      return;
    }

    originalPiece.sourceCombinedPanelId = sourceId;
    originalPiece.standardCellCount = panel.cellIds.length;
    originalPiece.isCombinedOriginal = true;
    originalPieces.push(originalPiece);

    const displayAtoms = panel.cellIds
      .map(id => gridCellMap.get(id))
      .filter(Boolean)
      .flatMap(cell => getCellAtomsOutsideObstacles(cell, obstacleRects));
    const displayPiece = createCutPiece(sourceId, displayAtoms, 'kombiniert mit Sperrflächen-Zuschnitt', `combined-cut:${sourceId}`);

    if (!displayPiece) {
      return;
    }

    displayPiece.sourceCombinedPanelId = sourceId;
    displayPiece.standardCellCount = panel.cellIds.length;
    displayPiece.originalShapeSignature = originalPiece.shapeSignature;
    displayPiece.originalArea = originalPiece.area;
    displayPiece.cutAwayArea = roundTo(Math.max(0, originalPiece.area - displayPiece.area));
    const hasObstacleIntersection = originalAtoms.some(atom => obstacleRects.some(obstacle => rectIntersects(atom, obstacle)));
    displayPiece.hasCombinedCut = hasObstacleIntersection
      && (displayPiece.shapeSignature !== originalPiece.shapeSignature
        || Math.abs(displayPiece.area - originalPiece.area) > EPS);
    displayPieces.push(displayPiece);

    if (displayPiece.hasCombinedCut) {
      cutPieces.push({ ...displayPiece, atoms: displayPiece.atoms.map(atom => ({ ...atom })), normalizedAtoms: displayPiece.normalizedAtoms.map(atom => ({ ...atom })) });
    }
  });

  return { originalPieces, displayPieces, cutPieces };
}

function buildCombinedGroups(combinedPieces, options = {}) {
  const {
    idPrefix = 'K',
    kind = 'combined',
    zonesText = 'Kombiniert aus ganzen Raster-Paneelen',
    assignPieceGroup = true,
  } = options;
  const groupsByKey = new Map();

  combinedPieces.forEach(piece => {
    const key = piece.shapeSignature;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        id: `${idPrefix}${groupsByKey.size + 1}`,
        kind,
        width: piece.width,
        height: piece.height,
        pieces: [],
        zones: new Set(['kombiniert']),
        normalizedAtoms: piece.normalizedAtoms,
        isComplex: piece.area < (piece.width * piece.height) - EPS,
        standardCellCountPerPiece: piece.standardCellCount,
      });
    }

    const group = groupsByKey.get(key);
    group.pieces.push(piece);
    if (assignPieceGroup) {
      piece.groupId = group.id;
    }
  });

  return [...groupsByKey.values()].map(group => {
    const sourceIds = [...new Set(group.pieces.map(piece => piece.sourceCombinedPanelId).filter(Boolean))];
    return {
      ...group,
      quantity: group.pieces.length,
      displayId: kind === 'combined-cut' && sourceIds.length > 0
        ? sourceIds.map(sourceId => `${sourceId}-Z`).join(', ')
        : sourceIds.length > 0
          ? sourceIds.join(', ')
          : group.id,
      sourceIds,
      area: roundTo(group.pieces.reduce((sum, piece) => sum + piece.area, 0)),
      zonesText,
      totalStandardCellCount: group.pieces.length * group.standardCellCountPerPiece,
      cutAwayArea: roundTo(group.pieces.reduce((sum, piece) => sum + (piece.cutAwayArea || 0), 0)),
    };
  });
}

function calculatePlan() {
  const obstacleRects = state.obstacles.map(getObstacleRect);
  const allCells = getAllGridCells();
  const allCellMap = getGridCellMap(allCells);
  const baseFullPanelCells = getFullPanelCells(allCells, obstacleRects);
  const validCombinedPanels = getValidCombinedPanelEntries(allCells);
  const combinedCellIds = getCombinedPanelCellIds(validCombinedPanels);
  const fullPanelCells = baseFullPanelCells.filter(cell => !combinedCellIds.has(cell.id));
  const blockedPanelCells = getBlockedPanelCells(allCells, obstacleRects).filter(cell => !combinedCellIds.has(cell.id));
  const combinedCalculation = calculateCombinedPanelPieces(validCombinedPanels, allCellMap, obstacleRects);
  const combinedOriginalPieces = combinedCalculation.originalPieces;
  const combinedPieces = combinedCalculation.displayPieces;
  const combinedCutPieces = combinedCalculation.cutPieces;
  const combinedGroups = buildCombinedGroups(combinedOriginalPieces);
  const combinedGroupBySource = new Map();
  combinedOriginalPieces.forEach(piece => {
    if (piece.sourceCombinedPanelId && piece.groupId) {
      combinedGroupBySource.set(piece.sourceCombinedPanelId, piece.groupId);
    }
  });
  combinedPieces.forEach(piece => {
    piece.groupId = combinedGroupBySource.get(piece.sourceCombinedPanelId) || piece.sourceCombinedPanelId;
  });
  const combinedCutGroups = buildCombinedGroups(combinedCutPieces, {
    idPrefix: 'KZ',
    kind: 'combined-cut',
    zonesText: 'Zuschnitt aus kombinierten Paneelen durch Sperrflächen',
    assignPieceGroup: true,
  });
  const cutPieces = calculateCutPieces(allCells, fullPanelCells, blockedPanelCells, obstacleRects);
  const groups = buildGroups(cutPieces);
  const panels = packPiecesIntoPanels(groups);
  const cutArea = cutPieces.reduce((sum, piece) => sum + piece.area, 0);
  const combinedArea = combinedPieces.reduce((sum, piece) => sum + piece.area, 0);
  const combinedCutArea = combinedCutPieces.reduce((sum, piece) => sum + piece.area, 0);
  const combinedCutAwayArea = combinedCutPieces.reduce((sum, piece) => sum + (piece.cutAwayArea || 0), 0);
  const purchasedCutArea = panels.length * getPanelAreaMeters();
  const wasteArea = Math.max(0, purchasedCutArea - cutArea);
  const combinedPanelCount = combinedPieces.length;
  const combinedStandardCellCount = combinedPieces.reduce((sum, piece) => sum + piece.standardCellCount, 0);
  const invalidCombinedPanelCount = Math.max(0, state.combinedPanels.length - validCombinedPanels.length);
  const warnings = [];
  const oversizedGroups = groups.filter(group => group.width > getPanelWidthMeters() + EPS || group.height > getPanelHeightMeters() + EPS);
  if (oversizedGroups.length > 0) {
    warnings.push('Einige Zuschnittstücke sind größer als ein Paneel. Bitte Paneelgröße prüfen.');
  }
  if (invalidCombinedPanelCount > 0) {
    warnings.push('Einige kombinierte Paneele passen nicht mehr zum aktuellen Raster und werden ignoriert.');
  }

  return {
    obstacleRects,
    allCells,
    baseFullPanelCells,
    fullPanelCells,
    blockedPanelCells,
    validCombinedPanels,
    combinedCellIds,
    combinedOriginalPieces,
    combinedPieces,
    combinedGroups,
    combinedCutPieces,
    combinedCutGroups,
    combinedPanelCount,
    combinedStandardCellCount,
    combinedCutArea,
    combinedCutAwayArea,
    cutPieces,
    groups,
    panels,
    cutArea,
    combinedArea,
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

function getObstacleOriginLimits(width, height) {
  return {
    x: Math.max(0, state.room.widthMeters - width),
    y: Math.max(0, state.room.heightMeters - height),
  };
}

function getNumberOrFallback(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function setObstacleFromOrigin(obstacle, originX, originY, width, height) {
  const safeWidth = clamp(positiveNumber(width, obstacle.widthMeters), 0.001, state.room.widthMeters);
  const safeHeight = clamp(positiveNumber(height, obstacle.heightMeters), 0.001, state.room.heightMeters);
  const limits = getObstacleOriginLimits(safeWidth, safeHeight);
  const safeOriginX = clamp(getNumberOrFallback(originX, 0), 0, limits.x);
  const safeOriginY = clamp(getNumberOrFallback(originY, 0), 0, limits.y);
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
  obstacle.x = clamp(x, 0, limits.x);
  obstacle.y = clamp(y, 0, limits.y);
}

function rebaseObstaclesToOriginCorner(nextOriginCorner) {
  const snapshots = state.obstacles.map(obstacle => ({
    obstacle,
    origin: getOriginCoordinates(obstacle),
    width: obstacle.widthMeters,
    height: obstacle.heightMeters,
  }));

  state.originCorner = normalizeOriginCorner(nextOriginCorner, state.originCorner);

  snapshots.forEach(snapshot => {
    setObstacleFromOrigin(
      snapshot.obstacle,
      snapshot.origin.x,
      snapshot.origin.y,
      snapshot.width,
      snapshot.height,
    );
  });
}

function nextObstacleId() {
  let index = 1;
  const used = new Set(state.obstacles.map(obstacle => obstacle.id));
  while (used.has(`S${index}`)) {
    index += 1;
  }
  return `S${index}`;
}

function getDefaultObstaclePlacement() {
  const width = Math.min(getPanelWidthMeters(), state.room.widthMeters);
  const height = Math.min(getPanelHeightMeters(), state.room.heightMeters);
  const grid = getGridRect();
  const index = state.obstacles.length;
  const colCount = Math.max(1, grid.cols || 1);
  const col = index % colCount;
  const row = Math.floor(index / colCount) % Math.max(1, grid.rows || 1);
  const fallbackX = Math.min(getPanelBaseMeters() * 0.5, state.room.widthMeters * 0.12);
  const fallbackY = Math.min(getPanelBaseMeters() * 0.5, state.room.heightMeters * 0.12);

  return {
    x: clamp(grid.x + col * getPanelWidthMeters(), 0, Math.max(0, state.room.widthMeters - width)) || clamp(fallbackX, 0, Math.max(0, state.room.widthMeters - width)),
    y: clamp(grid.y + row * getPanelHeightMeters(), 0, Math.max(0, state.room.heightMeters - height)) || clamp(fallbackY, 0, Math.max(0, state.room.heightMeters - height)),
    width,
    height,
  };
}

function createDefaultObstacle() {
  const placement = getDefaultObstaclePlacement();
  return {
    id: nextObstacleId(),
    x: placement.x,
    y: placement.y,
    widthMeters: placement.width,
    heightMeters: placement.height,
  };
}

function addObstacle() {
  const obstacle = createDefaultObstacle();
  state.obstacles.push(obstacle);
  selectedObstacleId = obstacle.id;

  if (isObstacleEditModeActive()) {
    obstacleEditModeState.createdObstacleIds = [...new Set([...obstacleEditModeState.createdObstacleIds, obstacle.id])];
    obstacleEditModeState.currentObstacleId = obstacle.id;
    obstacleEditModeState.sizeEntered = false;
    obstacleEditModeState.positionEntered = false;
    markObstacleEditDraft();
  }

  renderObstacleControls();
  updateAll();
  if (!isObstacleEditModeActive()) {
    saveConfigDebounced();
  }
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
  if (isDeleteModeActive()) {
    deleteObstacleInDeleteMode(id);
    return;
  }

  state.obstacles = state.obstacles.filter(obstacle => obstacle.id !== id);
  if (selectedObstacleId === id) {
    selectedObstacleId = state.obstacles[state.obstacles.length - 1]?.id || null;
  }
  if (localReferenceState.referenceObstacleId === id || localReferenceState.targetObstacleId === id) {
    localReferenceState = createEmptyLocalReferenceState();
  }
  if (isObstacleAlignmentActive()) {
    obstacleAlignmentState.selectedObstacleIds = obstacleAlignmentState.selectedObstacleIds.filter(obstacleId => obstacleId !== id);
    syncObstacleAlignmentReferenceAfterSelectionChange();
    if (obstacleAlignmentState.selectedObstacleIds.length < 2) {
      resetObstacleAlignmentChoice({ keepAxis: false });
    } else {
      resetObstacleAlignmentChoice({ keepAxis: true });
    }
  }
  markObstacleEditDraft();
  renderObstacleControls();
  updateAll();
  if (!isObstacleEditModeActive()) {
    saveConfigDebounced();
  }
}

function selectObstacle(id) {
  selectedObstacleId = id;
  renderObstacleControls();
  renderSvg(latestPlan || calculatePlan());
}

function renderObstacleControls() {
  if (!elements.obstaclesList) {
    return;
  }

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
    const originLimits = getObstacleOriginLimits(obstacle.widthMeters, obstacle.heightMeters);
    const isExpanded = selectedObstacleId === obstacle.id;
    const card = document.createElement('article');
    card.className = `obstacle-card${isExpanded ? ' selected' : ' collapsed'}`;
    card.dataset.obstacleId = obstacle.id;

    const headerContent = isExpanded
      ? `
        <div class="obstacle-expanded-title">
          <span class="obstacle-title">${escapeHtml(obstacle.id)}</span>
        </div>
      `
      : `
        <button class="obstacle-toggle-button" type="button" aria-expanded="false" aria-label="${escapeHtml(obstacle.id)} aufklappen">
          <span class="obstacle-title">${escapeHtml(obstacle.id)}</span>
          <span class="obstacle-summary">X ${formatMeters(origin.x)} · Y ${formatMeters(origin.y)} · ${formatMeters(obstacle.widthMeters)} × ${formatMeters(obstacle.heightMeters)} m</span>
        </button>
      `;

    card.innerHTML = `
      <div class="obstacle-card-header">
        ${headerContent}
        <button class="remove-obstacle-button" type="button" aria-label="${escapeHtml(obstacle.id)} entfernen">×</button>
      </div>
      <div class="obstacle-card-body" ${isExpanded ? '' : 'hidden'}>
        <div class="obstacle-fields">
          <label>X, m<input data-field="x" type="number" min="0" max="${formatMeters(originLimits.x)}" step="0.001" inputmode="decimal" value="${formatMeters(origin.x)}"></label>
          <label>Y, m<input data-field="y" type="number" min="0" max="${formatMeters(originLimits.y)}" step="0.001" inputmode="decimal" value="${formatMeters(origin.y)}"></label>
          <label>Breite, m<input data-field="width" type="number" min="0.001" max="${formatMeters(state.room.widthMeters)}" step="0.001" inputmode="decimal" value="${formatMeters(obstacle.widthMeters)}"></label>
          <label>Höhe, m<input data-field="height" type="number" min="0.001" max="${formatMeters(state.room.heightMeters)}" step="0.001" inputmode="decimal" value="${formatMeters(obstacle.heightMeters)}"></label>
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
    if (toggleButton) {
      toggleButton.addEventListener('click', () => selectObstacle(obstacle.id));
    }

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
        markObstacleEditDraft();
        renderObstacleControls();
        updateAll();
        if (!isObstacleEditModeActive()) {
          saveConfigDebounced();
        }
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


function isLocalReferenceActive() {
  return Boolean(localReferenceState.isActive);
}

function hasLocalReferenceMode() {
  return Boolean(localReferenceState.isActive && localReferenceState.referenceObstacleId && localReferenceState.referenceCorner);
}

function getObstaclePositionSnapshot() {
  return state.obstacles.map(obstacle => ({
    id: obstacle.id,
    x: obstacle.x,
    y: obstacle.y,
    widthMeters: obstacle.widthMeters,
    heightMeters: obstacle.heightMeters,
  }));
}

function restoreObstaclePositionSnapshot(snapshot) {
  if (!Array.isArray(snapshot)) {
    return;
  }

  const byId = new Map(snapshot.map(item => [item.id, item]));
  state.obstacles.forEach(obstacle => {
    const saved = byId.get(obstacle.id);
    if (!saved) {
      return;
    }

    obstacle.widthMeters = Math.min(positiveNumber(saved.widthMeters, obstacle.widthMeters), state.room.widthMeters);
    obstacle.heightMeters = Math.min(positiveNumber(saved.heightMeters, obstacle.heightMeters), state.room.heightMeters);
    moveObstacleTo(obstacle, Number(saved.x) || 0, Number(saved.y) || 0);
  });
}

function getCornerLabel(corner) {
  return {
    'top-left': 'oben links',
    'top-right': 'oben rechts',
    'bottom-left': 'unten links',
    'bottom-right': 'unten rechts',
  }[corner] || corner;
}

function setLocalReferenceStep(element, text, className, hidden = false) {
  if (!element) {
    return;
  }

  element.hidden = hidden;
  element.textContent = text;
  element.className = `local-reference-step ${className || ''}`.trim();
}

function setWorkflowStatus(element, text, options = {}) {
  if (!element) {
    return;
  }

  const { variant = 'info', hidden = false } = options;
  element.hidden = hidden;
  element.textContent = text || ' ';
  element.className = `workflow-status ${variant || 'info'}${text ? '' : ' empty'}`.trim();
}

function getVisibleWorkflowNodes(timeline) {
  return [...timeline.children].filter(node => {
    if (!(node.classList.contains('workflow-node') || node.classList.contains('obstacle-alignment-step-block'))) {
      return false;
    }
    if (node.hidden || node.getAttribute('hidden') !== null) {
      return false;
    }
    const step = node.querySelector('.local-reference-step');
    if (!step || step.hidden || step.getAttribute('hidden') !== null) {
      return false;
    }
    return window.getComputedStyle(node).display !== 'none'
      && window.getComputedStyle(step).display !== 'none';
  });
}

function refreshWorkflowTimelineConnectors() {
  document.querySelectorAll('.workflow-timeline').forEach(timeline => {
    timeline.querySelectorAll('.workflow-connector-line').forEach(line => line.remove());

    const nodes = [...timeline.children].filter(node => (
      node.classList.contains('workflow-node') || node.classList.contains('obstacle-alignment-step-block')
    ));
    nodes.forEach(node => node.classList.remove('has-next-visible', 'is-last-visible'));

    const visibleNodes = getVisibleWorkflowNodes(timeline);
    visibleNodes.forEach((node, index) => {
      node.classList.toggle('has-next-visible', index < visibleNodes.length - 1);
      node.classList.toggle('is-last-visible', index === visibleNodes.length - 1);
    });

    if (visibleNodes.length < 2 || timeline.hidden || window.getComputedStyle(timeline).display === 'none') {
      return;
    }

    const timelineRect = timeline.getBoundingClientRect();
    const timelineTop = timelineRect.top;
    const timelineLeft = timelineRect.left;

    for (let index = 0; index < visibleNodes.length - 1; index += 1) {
      const currentStep = visibleNodes[index].querySelector('.local-reference-step');
      const nextStep = visibleNodes[index + 1].querySelector('.local-reference-step');
      if (!currentStep || !nextStep) {
        continue;
      }

      const currentRect = currentStep.getBoundingClientRect();
      const nextRect = nextStep.getBoundingClientRect();
      const x1 = currentRect.right - timelineLeft + timeline.scrollLeft;
      const x2 = nextRect.left - timelineLeft + timeline.scrollLeft;
      const y = currentRect.top + currentRect.height / 2 - timelineTop + timeline.scrollTop;
      const width = x2 - x1;

      if (width <= 2) {
        continue;
      }

      const line = document.createElement('span');
      line.className = 'workflow-connector-line';
      line.style.left = `${roundTo(x1, 3)}px`;
      line.style.top = `${roundTo(y, 3)}px`;
      line.style.width = `${roundTo(width, 3)}px`;
      timeline.appendChild(line);
    }
  });
}

function isObstacleAlignmentActive() {
  return Boolean(obstacleAlignmentState.isActive);
}

function getObstacleAlignmentAxisLabel(axis) {
  return {
    horizontal: 'horizontal',
    vertical: 'vertical',
  }[axis] || '';
}

function getObstacleAlignmentOption(axis, alignment) {
  if (axis === 'vertical') {
    return {
      left: {
        label: 'links ausgerichtet',
        tooltip: 'Nach linker Grenze ausrichten',
        aria: 'Nach linker Grenze ausrichten',
        sr: 'Links',
        path: 'M5 4v16M9 7h10M9 12h8M9 17h10',
      },
      center: {
        label: 'mittig ausgerichtet',
        tooltip: 'Nach vertikaler Mitte ausrichten',
        aria: 'Nach vertikaler Mitte ausrichten',
        sr: 'Mitte',
        path: 'M12 4v16M7 7h10M8 12h8M7 17h10',
      },
      right: {
        label: 'rechts ausgerichtet',
        tooltip: 'Nach rechter Grenze ausrichten',
        aria: 'Nach rechter Grenze ausrichten',
        sr: 'Rechts',
        path: 'M19 4v16M5 7h10M7 12h8M5 17h10',
      },
    }[alignment] || null;
  }

  return {
    top: {
      label: 'oben ausgerichtet',
      tooltip: 'Nach oberer Grenze ausrichten',
      aria: 'Nach oberer Grenze ausrichten',
      sr: 'Oben',
      path: 'M4 5h16M7 9h10M8 13h8M6 17h12',
    },
    center: {
      label: 'mittig ausgerichtet',
      tooltip: 'Nach horizontaler Mitte ausrichten',
      aria: 'Nach horizontaler Mitte ausrichten',
      sr: 'Mitte',
      path: 'M5 12h14M7 7h10M8 17h8',
    },
    bottom: {
      label: 'unten ausgerichtet',
      tooltip: 'Nach unterer Grenze ausrichten',
      aria: 'Nach unterer Grenze ausrichten',
      sr: 'Unten',
      path: 'M6 7h12M8 11h8M7 15h10M4 19h16',
    },
  }[alignment] || null;
}

function getObstacleAlignmentLabel(axis, alignment) {
  return getObstacleAlignmentOption(axis, alignment)?.label || '';
}

function getObstacleAlignmentValuesForAxis(axis) {
  return axis === 'vertical'
    ? ['left', 'center', 'right']
    : ['top', 'center', 'bottom'];
}

function getDefaultObstacleAlignmentAxis() {
  return 'horizontal';
}

function setObstacleAlignmentStep(element, text, className, hidden = false) {
  if (!element) {
    return;
  }

  element.hidden = hidden;
  element.textContent = text;
  element.className = `local-reference-step obstacle-alignment-step ${className || ''}`.trim();
}

function getExistingObstacleIds() {
  return new Set(state.obstacles.map(obstacle => obstacle.id));
}

function getObstacleAlignmentSelectionIds() {
  const existingIds = getExistingObstacleIds();
  const selectedIds = obstacleAlignmentState.selectedObstacleIds.filter(id => existingIds.has(id));

  if (selectedIds.length !== obstacleAlignmentState.selectedObstacleIds.length) {
    obstacleAlignmentState.selectedObstacleIds = selectedIds;
  }

  return selectedIds;
}

function getObstacleAlignmentSelectionSet() {
  return new Set(getObstacleAlignmentSelectionIds());
}

function getObstacleAlignmentReferenceId() {
  const selectedIds = getObstacleAlignmentSelectionIds();

  if (selectedIds.length === 0) {
    obstacleAlignmentState.referenceObstacleId = null;
    obstacleAlignmentState.isSelectingReference = false;
    return null;
  }

  if (!selectedIds.includes(obstacleAlignmentState.referenceObstacleId)) {
    obstacleAlignmentState.referenceObstacleId = selectedIds[0];
  }

  return obstacleAlignmentState.referenceObstacleId;
}

function getObstacleAlignmentReferenceObstacle() {
  const referenceId = getObstacleAlignmentReferenceId();
  if (!referenceId) {
    return null;
  }

  return state.obstacles.find(obstacle => obstacle.id === referenceId) || null;
}

function setObstacleAlignmentReferenceId(obstacleId) {
  if (!isObstacleAlignmentActive() || !state.obstacles.some(obstacle => obstacle.id === obstacleId)) {
    return;
  }

  const selectedIds = getObstacleAlignmentSelectionIds();
  obstacleAlignmentState.selectedObstacleIds = selectedIds.includes(obstacleId)
    ? selectedIds
    : [...selectedIds, obstacleId];
  obstacleAlignmentState.referenceObstacleId = obstacleId;
  obstacleAlignmentState.isSelectingReference = false;

  if (obstacleAlignmentState.axis && obstacleAlignmentState.alignment && hasObstacleAlignmentSelection()) {
    applyObstacleAlignment(obstacleAlignmentState.alignment);
    return;
  }

  updateObstacleAlignmentButton();
  renderSvg(latestPlan || calculatePlan());
}

function startObstacleAlignmentReferenceSelection() {
  if (!isObstacleAlignmentActive() || getObstacleAlignmentSelectionIds().length === 0) {
    return;
  }

  obstacleAlignmentState.isSelectingReference = true;
  elements.obstacleAlignmentReferenceButton?.blur();
  updateObstacleAlignmentButton();
  renderSvg(latestPlan || calculatePlan());
}

function getSelectedObstacleAlignmentObstacles() {
  const selectedIds = getObstacleAlignmentSelectionIds();
  const byId = new Map(state.obstacles.map(obstacle => [obstacle.id, obstacle]));
  return selectedIds.map(id => byId.get(id)).filter(Boolean);
}

function hasObstacleAlignmentSelection() {
  return isObstacleAlignmentActive() && getObstacleAlignmentSelectionIds().length >= 2;
}

function setObstacleAlignmentBlockVisibility(block, hidden) {
  if (block) {
    block.hidden = hidden;
  }
}

function setObstacleAlignmentChoiceButton(button, active, disabled = false) {
  if (!button) {
    return;
  }

  button.disabled = disabled;
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
}

function setObstacleAlignmentEdgeButton(button, option, active, disabled = false) {
  if (!button || !option) {
    return;
  }

  button.disabled = disabled;
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.setAttribute('aria-label', option.aria);

  const path = button.querySelector('path');
  if (path) {
    path.setAttribute('d', option.path);
  }

  const srOnly = button.querySelector('.sr-only');
  if (srOnly) {
    srOnly.textContent = option.sr;
  }

  const tooltip = button.querySelector('.workflow-tooltip');
  if (tooltip) {
    tooltip.textContent = option.tooltip;
  }
}

function updateObstacleAlignmentButton() {
  const active = isObstacleAlignmentActive();
  const obstacleEditActive = isObstacleEditModeActive();
  const localReferenceActive = isLocalReferenceActive();
  const panelCombinationActive = isPanelCombinationActive();
  const deleteModeActive = isDeleteModeActive();

  if (elements.obstacleAlignmentControl) {
    elements.obstacleAlignmentControl.classList.toggle('active', active || obstacleEditActive || localReferenceActive || panelCombinationActive || deleteModeActive);
  }

  if (elements.obstacleAlignmentButton) {
    elements.obstacleAlignmentButton.classList.remove('active');
    elements.obstacleAlignmentButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.obstacleAlignmentButton.textContent = 'Ausrichten';
    elements.obstacleAlignmentButton.disabled = active || obstacleEditActive || localReferenceActive || panelCombinationActive || deleteModeActive;
  }

  if (elements.obstacleAlignmentPanel) {
    elements.obstacleAlignmentPanel.hidden = !active;
  }

  if (!active) {
    refreshWorkflowTimelineConnectors();
    return;
  }

  const selectedIds = getObstacleAlignmentSelectionIds();
  const referenceId = getObstacleAlignmentReferenceId();
  const selectedCount = selectedIds.length;
  const enoughSelection = selectedCount >= 2;
  const axisLabel = getObstacleAlignmentAxisLabel(obstacleAlignmentState.axis);
  const alignmentLabel = getObstacleAlignmentLabel(obstacleAlignmentState.axis, obstacleAlignmentState.alignment);

  setObstacleAlignmentStep(
    elements.obstacleAlignmentStep1,
    'Sperrflächen wählen',
    enoughSelection ? 'done reference' : 'active reference',
  );
  setWorkflowStatus(
    elements.obstacleAlignmentStatus1,
    obstacleAlignmentState.isSelectingReference
      ? 'Neues Referenz-Element auf dem Plan anklicken.'
      : enoughSelection
        ? `✓ ${selectedCount} Sperrflächen gewählt · Referenz ${referenceId}`
        : selectedCount === 1
          ? '1 Sperrfläche gewählt · bitte mindestens eine weitere wählen.'
          : 'Noch keine Sperrflächen gewählt.',
    { variant: enoughSelection && !obstacleAlignmentState.isSelectingReference ? 'success' : 'info' },
  );

  if (elements.obstacleAlignmentStatus1) {
    const canChangeReference = Boolean(referenceId && enoughSelection);
    elements.obstacleAlignmentStatus1.classList.toggle('actionable', canChangeReference);
    elements.obstacleAlignmentStatus1.title = canChangeReference
      ? 'Klicken, um ein anderes Referenz-Element zu wählen.'
      : '';
    if (canChangeReference) {
      elements.obstacleAlignmentStatus1.setAttribute('role', 'button');
      elements.obstacleAlignmentStatus1.setAttribute('tabindex', '0');
      elements.obstacleAlignmentStatus1.setAttribute('aria-label', 'Referenz-Element ändern');
    } else {
      elements.obstacleAlignmentStatus1.removeAttribute('role');
      elements.obstacleAlignmentStatus1.removeAttribute('tabindex');
      elements.obstacleAlignmentStatus1.removeAttribute('aria-label');
    }
  }

  if (elements.obstacleAlignmentReferenceInfo) {
    elements.obstacleAlignmentReferenceInfo.hidden = true;
  }

  if (elements.obstacleAlignmentReferenceButton && elements.obstacleAlignmentReferenceLabel) {
    const selectingReference = Boolean(referenceId && obstacleAlignmentState.isSelectingReference);
    elements.obstacleAlignmentReferenceButton.disabled = !referenceId || !enoughSelection;
    elements.obstacleAlignmentReferenceButton.classList.toggle('active', selectingReference);
    elements.obstacleAlignmentReferenceButton.setAttribute('aria-pressed', selectingReference ? 'true' : 'false');
    elements.obstacleAlignmentReferenceLabel.textContent = selectingReference
      ? 'Neues Referenz-Element wählen'
      : `Referenz-Element ${referenceId || '–'}`;
  }

  setObstacleAlignmentBlockVisibility(elements.obstacleAlignmentAxisBlock, !enoughSelection);
  setObstacleAlignmentStep(
    elements.obstacleAlignmentStep2,
    'Ausrichtungsart wählen',
    obstacleAlignmentState.axis ? 'done target' : 'active target',
    !enoughSelection,
  );
  setWorkflowStatus(
    elements.obstacleAlignmentStatus2,
    axisLabel ? `✓ ${axisLabel} gewählt` : 'Bitte horizontal oder vertikal wählen.',
    { variant: axisLabel ? 'success' : 'info', hidden: true },
  );

  setObstacleAlignmentChoiceButton(
    elements.obstacleAlignmentHorizontalButton,
    obstacleAlignmentState.axis === 'horizontal',
    !enoughSelection,
  );
  setObstacleAlignmentChoiceButton(
    elements.obstacleAlignmentVerticalButton,
    obstacleAlignmentState.axis === 'vertical',
    !enoughSelection,
  );

  const hasAxis = enoughSelection && Boolean(obstacleAlignmentState.axis);
  setObstacleAlignmentBlockVisibility(elements.obstacleAlignmentEdgeBlock, !hasAxis);
  setObstacleAlignmentStep(
    elements.obstacleAlignmentStep3,
    'Ausrichtung wählen',
    obstacleAlignmentState.alignment ? 'done target' : 'active target',
    !hasAxis,
  );
  setWorkflowStatus(
    elements.obstacleAlignmentStatus3,
    alignmentLabel ? `✓ ${alignmentLabel}` : 'Bitte Kante oder Mitte wählen.',
    { variant: alignmentLabel ? 'success' : 'info', hidden: true },
  );

  const alignmentValues = getObstacleAlignmentValuesForAxis(obstacleAlignmentState.axis || getDefaultObstacleAlignmentAxis());
  const [startAlignment, centerAlignment, endAlignment] = alignmentValues;
  [
    [elements.obstacleAlignmentStartButton, startAlignment],
    [elements.obstacleAlignmentCenterButton, centerAlignment],
    [elements.obstacleAlignmentEndButton, endAlignment],
  ].forEach(([button, alignment]) => {
    setObstacleAlignmentEdgeButton(
      button,
      getObstacleAlignmentOption(obstacleAlignmentState.axis || getDefaultObstacleAlignmentAxis(), alignment),
      obstacleAlignmentState.alignment === alignment,
      !hasAxis,
    );
  });

  refreshWorkflowTimelineConnectors();
}

function activateObstacleAlignmentMode() {
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isPanelCombinationActive() || isDeleteModeActive()) {
    return;
  }

  obstacleAlignmentState = {
    ...createEmptyObstacleAlignmentState(),
    isActive: true,
    initialObstacles: getObstaclePositionSnapshot(),
  };
  selectedObstacleId = null;
  obstacleDragState = null;
  updateObstacleEditModeButton();
  updateObstacleAlignmentButton();
  updateLocalReferenceButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  renderObstacleControls();
  renderSvg(latestPlan || calculatePlan());
}

function clearObstacleAlignmentMode() {
  obstacleAlignmentState = createEmptyObstacleAlignmentState();
  updateObstacleEditModeButton();
  updateObstacleAlignmentButton();
  updateLocalReferenceButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  clearInlineEditorLayer();
}

function commitObstacleAlignmentChanges() {
  const shouldSave = Boolean(obstacleAlignmentState.hasDraft);
  clearObstacleAlignmentMode();
  renderObstacleControls();
  updateAll();

  if (shouldSave) {
    saveConfigDebounced();
  }
}

function cancelObstacleAlignmentChanges() {
  restoreObstaclePositionSnapshot(obstacleAlignmentState.initialObstacles);
  clearObstacleAlignmentMode();
  renderObstacleControls();
  updateAll();
}

function toggleObstacleAlignmentMode() {
  if (isObstacleAlignmentActive()) {
    return;
  }

  activateObstacleAlignmentMode();
}

function resetObstacleAlignmentChoice(options = {}) {
  const { keepAxis = true } = options;
  if (!keepAxis) {
    obstacleAlignmentState.axis = null;
  }
  obstacleAlignmentState.alignment = null;
}

function syncObstacleAlignmentReferenceAfterSelectionChange() {
  const selectedIds = getObstacleAlignmentSelectionIds();

  if (selectedIds.length === 0) {
    obstacleAlignmentState.referenceObstacleId = null;
    obstacleAlignmentState.isSelectingReference = false;
    return;
  }

  if (!selectedIds.includes(obstacleAlignmentState.referenceObstacleId)) {
    obstacleAlignmentState.referenceObstacleId = selectedIds[0];
  }
}

function removeObstacleFromAlignmentSelection(obstacleId) {
  if (!isObstacleAlignmentActive()) {
    return;
  }

  obstacleAlignmentState.selectedObstacleIds = obstacleAlignmentState.selectedObstacleIds.filter(id => id !== obstacleId);
  syncObstacleAlignmentReferenceAfterSelectionChange();

  if (obstacleAlignmentState.selectedObstacleIds.length < 2) {
    resetObstacleAlignmentChoice({ keepAxis: false });
  } else {
    resetObstacleAlignmentChoice({ keepAxis: true });
  }

  updateObstacleAlignmentButton();
  renderSvg(latestPlan || calculatePlan());
}

function toggleObstacleAlignmentSelection(obstacleId) {
  if (!isObstacleAlignmentActive()) {
    return;
  }

  if (obstacleAlignmentState.isSelectingReference) {
    setObstacleAlignmentReferenceId(obstacleId);
    return;
  }

  const selectedIds = getObstacleAlignmentSelectionIds();
  const alreadySelected = selectedIds.includes(obstacleId);
  obstacleAlignmentState.selectedObstacleIds = alreadySelected
    ? selectedIds.filter(id => id !== obstacleId)
    : [...selectedIds, obstacleId];
  syncObstacleAlignmentReferenceAfterSelectionChange();

  if (obstacleAlignmentState.selectedObstacleIds.length < 2) {
    resetObstacleAlignmentChoice({ keepAxis: false });
  } else {
    resetObstacleAlignmentChoice({ keepAxis: true });
  }

  selectedObstacleId = null;
  updateObstacleAlignmentButton();
  renderSvg(latestPlan || calculatePlan());
}

function selectObstacleAlignmentAxis(axis) {
  if (!['horizontal', 'vertical'].includes(axis) || !hasObstacleAlignmentSelection()) {
    return;
  }

  obstacleAlignmentState.axis = axis;
  obstacleAlignmentState.alignment = null;
  updateObstacleAlignmentButton();
  renderSvg(latestPlan || calculatePlan());
}

function getObstacleAlignmentAxisValue(axis, alignment, referenceObstacle) {
  if (!referenceObstacle) {
    return null;
  }

  if (axis === 'vertical') {
    if (alignment === 'left') {
      return referenceObstacle.x;
    }

    if (alignment === 'right') {
      return referenceObstacle.x + getMetricWidth(referenceObstacle);
    }

    return referenceObstacle.x + getMetricWidth(referenceObstacle) / 2;
  }

  if (alignment === 'top') {
    return referenceObstacle.y;
  }

  if (alignment === 'bottom') {
    return referenceObstacle.y + getMetricHeight(referenceObstacle);
  }

  return referenceObstacle.y + getMetricHeight(referenceObstacle) / 2;
}

function getObstacleAlignmentReferenceCenter(referenceObstacle) {
  if (!referenceObstacle) {
    return null;
  }

  return {
    x: referenceObstacle.x + getMetricWidth(referenceObstacle) / 2,
    y: referenceObstacle.y + getMetricHeight(referenceObstacle) / 2,
  };
}

function applyObstacleAlignment(alignment) {
  const axis = obstacleAlignmentState.axis;
  if (!axis || !getObstacleAlignmentValuesForAxis(axis).includes(alignment)) {
    return;
  }

  const selectedObstacles = getSelectedObstacleAlignmentObstacles();
  if (selectedObstacles.length < 2) {
    return;
  }

  const referenceObstacle = getObstacleAlignmentReferenceObstacle();
  const axisValue = getObstacleAlignmentAxisValue(axis, alignment, referenceObstacle);
  if (axisValue === null) {
    return;
  }

  selectedObstacles.forEach(obstacle => {
    if (axis === 'vertical') {
      if (alignment === 'left') {
        moveObstacleTo(obstacle, axisValue, obstacle.y);
        return;
      }

      if (alignment === 'right') {
        moveObstacleTo(obstacle, axisValue - obstacle.widthMeters, obstacle.y);
        return;
      }

      moveObstacleTo(obstacle, axisValue - obstacle.widthMeters / 2, obstacle.y);
      return;
    }

    if (alignment === 'top') {
      moveObstacleTo(obstacle, obstacle.x, axisValue);
      return;
    }

    if (alignment === 'bottom') {
      moveObstacleTo(obstacle, obstacle.x, axisValue - obstacle.heightMeters);
      return;
    }

    moveObstacleTo(obstacle, obstacle.x, axisValue - obstacle.heightMeters / 2);
  });

  obstacleAlignmentState.alignment = alignment;
  obstacleAlignmentState.hasDraft = true;
  renderObstacleControls();
  updateAll();
}

function isPanelCombinationActive() {
  return Boolean(panelCombinationState.isActive);
}

function getPanelCombinationSelectedCellIds() {
  const plan = latestPlan || calculatePlan();
  const gridIds = new Set(plan.allCells.map(cell => cell.id));
  const selectedCellIds = panelCombinationState.selectedCellIds.filter(id => gridIds.has(id));
  const validCombinedIds = new Set(plan.validCombinedPanels.map(panel => panel.id));
  const selectedCombinedIds = (panelCombinationState.selectedCombinedPanelIds || []).filter(id => validCombinedIds.has(id));

  if (selectedCellIds.length !== panelCombinationState.selectedCellIds.length) {
    panelCombinationState.selectedCellIds = selectedCellIds;
  }
  if (selectedCombinedIds.length !== (panelCombinationState.selectedCombinedPanelIds || []).length) {
    panelCombinationState.selectedCombinedPanelIds = selectedCombinedIds;
  }

  return selectedCellIds;
}

function clearPanelCombinationFeedback() {
  window.clearTimeout(panelCombinationFeedbackTimer);
  panelCombinationFeedbackTimer = null;
  panelCombinationState.rejectedCellId = null;
  panelCombinationState.feedbackMessage = '';
}

function showPanelCombinationFeedback(cellId, message) {
  window.clearTimeout(panelCombinationFeedbackTimer);
  panelCombinationState.rejectedCellId = cellId;
  panelCombinationState.feedbackMessage = message;
  updatePanelCombinationButton();
  renderSvg(latestPlan || calculatePlan());

  panelCombinationFeedbackTimer = window.setTimeout(() => {
    if (!isPanelCombinationActive()) {
      return;
    }

    panelCombinationState.rejectedCellId = null;
    panelCombinationState.feedbackMessage = '';
    updatePanelCombinationButton();
    renderSvg(latestPlan || calculatePlan());
  }, 1700);
}

function nextCombinedPanelId() {
  let index = 1;
  const used = new Set(state.combinedPanels.map(panel => panel.id));
  while (used.has(`K${index}`)) {
    index += 1;
  }
  return `K${index}`;
}

function updatePanelCombinationButton() {
  const active = isPanelCombinationActive();
  const obstacleEditActive = isObstacleEditModeActive();
  const localReferenceActive = isLocalReferenceActive();
  const obstacleAlignmentActive = isObstacleAlignmentActive();
  const deleteModeActive = isDeleteModeActive();

  if (elements.panelCombinationControl) {
    elements.panelCombinationControl.classList.toggle('active', active || obstacleEditActive || localReferenceActive || obstacleAlignmentActive || deleteModeActive);
  }

  if (elements.panelCombinationButton) {
    elements.panelCombinationButton.classList.remove('active');
    elements.panelCombinationButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.panelCombinationButton.textContent = 'Kombinieren';
    elements.panelCombinationButton.disabled = active || obstacleEditActive || localReferenceActive || obstacleAlignmentActive || deleteModeActive;
  }

  if (elements.panelCombinationPanel) {
    elements.panelCombinationPanel.hidden = !active;
  }

  if (!active) {
    refreshWorkflowTimelineConnectors();
    return;
  }

  const selectedCellIds = getPanelCombinationSelectedCellIds();
  const selectedCount = selectedCellIds.length;
  const selectedCombinedCount = (panelCombinationState.selectedCombinedPanelIds || []).length;
  const combinedSuffix = selectedCombinedCount > 0 ? ` · ${selectedCombinedCount} kombiniert übernommen` : '';
  const canApply = selectedCount >= 2;
  const hasFeedback = Boolean(panelCombinationState.feedbackMessage);

  setLocalReferenceStep(
    elements.panelCombinationStep1,
    'Benachbarte ganze Raster-Paneele wählen',
    canApply ? 'done reference' : 'active reference',
  );

  if (elements.panelCombinationActionBlock) {
    elements.panelCombinationActionBlock.hidden = true;
  }

  if (elements.panelCombinationStep2) {
    elements.panelCombinationStep2.hidden = true;
  }

  setWorkflowStatus(
    elements.panelCombinationFeedback,
    hasFeedback
      ? panelCombinationState.feedbackMessage
      : selectedCount > 0
        ? `✓ ${selectedCount} Raster-Paneel${selectedCount === 1 ? '' : 'e'} gewählt${combinedSuffix}`
        : 'Noch keine Raster-Paneele gewählt.',
    { variant: hasFeedback ? 'error' : selectedCount > 0 ? 'success' : 'info' },
  );

  if (elements.panelCombinationApplyButton) {
    elements.panelCombinationApplyButton.disabled = !canApply;
  }

  refreshWorkflowTimelineConnectors();
}

function activatePanelCombinationMode() {
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive()) {
    return;
  }

  panelCombinationState = {
    ...createEmptyPanelCombinationState(),
    isActive: true,
  };
  selectedObstacleId = null;
  obstacleDragState = null;
  updatePanelCombinationButton();
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updateDeleteModeButton();
  renderObstacleControls();
  renderSvg(latestPlan || calculatePlan());
}

function clearPanelCombinationMode() {
  clearPanelCombinationFeedback();
  panelCombinationState = createEmptyPanelCombinationState();
  updateObstacleEditModeButton();
  updatePanelCombinationButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updateDeleteModeButton();
}

function cancelPanelCombinationChanges() {
  clearPanelCombinationMode();
  renderSvg(latestPlan || calculatePlan());
}

function commitPanelCombinationChanges() {
  const selectedCellIds = getPanelCombinationSelectedCellIds();
  const selectedCombinedIds = [...new Set(panelCombinationState.selectedCombinedPanelIds || [])];
  const plan = latestPlan || calculatePlan();
  const cellMap = getGridCellMap(plan.allCells);

  if (selectedCellIds.length < 2 || !areCellIdsConnected(selectedCellIds, cellMap)) {
    showPanelCombinationFeedback(selectedCellIds[0] || null, 'Bitte mindestens zwei benachbarte Raster-Paneele wählen.');
    return;
  }

  const newCombinedPanelId = nextCombinedPanelId();
  state.combinedPanels = state.combinedPanels.filter(panel => !selectedCombinedIds.includes(panel.id));
  state.combinedPanels.push({
    id: newCombinedPanelId,
    cellIds: [...selectedCellIds],
  });
  clearPanelCombinationMode();
  updateAll();
  saveConfigDebounced();
}

function togglePanelCombinationMode() {
  if (isPanelCombinationActive()) {
    return;
  }

  activatePanelCombinationMode();
}

function getAvailablePanelCombinationCellMap(plan) {
  return getGridCellMap(plan.fullPanelCells);
}

function getPanelCombinationConnectivityCellMap(plan) {
  return getGridCellMap(plan.allCells);
}

function getValidCombinedPanelEntryById(plan, combinedPanelId) {
  return plan.validCombinedPanels.find(panel => panel.id === combinedPanelId) || null;
}

function handlePanelCombinationCellClick(cell) {
  if (!isPanelCombinationActive()) {
    return;
  }

  const plan = latestPlan || calculatePlan();
  const availableCellMap = getAvailablePanelCombinationCellMap(plan);
  const connectivityCellMap = getPanelCombinationConnectivityCellMap(plan);
  if (!availableCellMap.has(cell.id)) {
    showPanelCombinationFeedback(cell.id, 'Nur freie ganze Raster-Paneele oder benachbarte kombinierte Paneele können kombiniert werden.');
    return;
  }

  const selectedCellIds = getPanelCombinationSelectedCellIds();
  const alreadySelected = selectedCellIds.includes(cell.id);

  if (alreadySelected) {
    const nextSelected = selectedCellIds.filter(id => id !== cell.id);
    if (nextSelected.length > 1 && !areCellIdsConnected(nextSelected, connectivityCellMap)) {
      showPanelCombinationFeedback(cell.id, 'Diese Auswahl würde getrennt werden. Bitte zusammenhängend bleiben.');
      return;
    }

    panelCombinationState.selectedCellIds = nextSelected;
    clearPanelCombinationFeedback();
    updatePanelCombinationButton();
    renderSvg(plan);
    return;
  }

  if (selectedCellIds.length > 0 && !isCellAdjacentToCellIds(cell, selectedCellIds, connectivityCellMap)) {
    showPanelCombinationFeedback(cell.id, 'Bitte benachbarte Paneele wählen.');
    return;
  }

  panelCombinationState.selectedCellIds = [...selectedCellIds, cell.id];
  clearPanelCombinationFeedback();
  updatePanelCombinationButton();
  renderSvg(plan);
}

function handlePanelCombinationCombinedPanelClick(combinedPanelId) {
  if (!isPanelCombinationActive()) {
    return;
  }

  const plan = latestPlan || calculatePlan();
  const combinedPanel = getValidCombinedPanelEntryById(plan, combinedPanelId);
  if (!combinedPanel) {
    showPanelCombinationFeedback(null, 'Dieses kombinierte Paneel kann aktuell nicht übernommen werden.');
    return;
  }

  const connectivityCellMap = getPanelCombinationConnectivityCellMap(plan);
  const selectedCellIds = getPanelCombinationSelectedCellIds();
  const selectedCombinedIds = new Set(panelCombinationState.selectedCombinedPanelIds || []);
  const isAlreadySelected = selectedCombinedIds.has(combinedPanel.id);
  const combinedCellIds = combinedPanel.cellIds;

  if (isAlreadySelected) {
    const removeIds = new Set(combinedCellIds);
    const nextSelected = selectedCellIds.filter(id => !removeIds.has(id));
    if (nextSelected.length > 1 && !areCellIdsConnected(nextSelected, connectivityCellMap)) {
      showPanelCombinationFeedback(combinedCellIds[0] || null, 'Diese Auswahl würde getrennt werden. Bitte zusammenhängend bleiben.');
      return;
    }

    selectedCombinedIds.delete(combinedPanel.id);
    panelCombinationState.selectedCombinedPanelIds = [...selectedCombinedIds];
    panelCombinationState.selectedCellIds = nextSelected;
    clearPanelCombinationFeedback();
    updatePanelCombinationButton();
    renderSvg(plan);
    return;
  }

  if (selectedCellIds.length > 0 && !combinedCellIds.some(id => isCellAdjacentToCellIds(connectivityCellMap.get(id), selectedCellIds, connectivityCellMap))) {
    showPanelCombinationFeedback(combinedCellIds[0] || null, 'Bitte benachbarte Paneele wählen.');
    return;
  }

  selectedCombinedIds.add(combinedPanel.id);
  panelCombinationState.selectedCombinedPanelIds = [...selectedCombinedIds];
  panelCombinationState.selectedCellIds = [...new Set([...selectedCellIds, ...combinedCellIds])];
  clearPanelCombinationFeedback();
  updatePanelCombinationButton();
  renderSvg(plan);
}

function isObstacleEditModeActive() {
  return Boolean(obstacleEditModeState.isActive);
}

function markObstacleEditDraft() {
  if (!isObstacleEditModeActive()) {
    return;
  }

  obstacleEditModeState.hasDraft = true;
  updateObstacleEditModeButton();
}

function setObstacleEditStep(element, text, className, hidden = false) {
  if (!element) {
    return;
  }

  element.hidden = hidden;
  element.textContent = text;
  element.className = `local-reference-step obstacle-edit-step ${className || ''}`.trim();
}

function getObstacleEditCurrentObstacle() {
  if (!isObstacleEditModeActive() || !obstacleEditModeState.currentObstacleId) {
    return null;
  }

  return state.obstacles.find(obstacle => obstacle.id === obstacleEditModeState.currentObstacleId) || null;
}

function updateObstacleEditInputs(obstacle) {
  if (!obstacle) {
    return;
  }

  const origin = getOriginCoordinates(obstacle);
  const limits = getObstacleOriginLimits(obstacle.widthMeters, obstacle.heightMeters);

  if (elements.obstacleEditWidthInput && document.activeElement !== elements.obstacleEditWidthInput) {
    elements.obstacleEditWidthInput.value = formatMeters(obstacle.widthMeters);
    elements.obstacleEditWidthInput.max = formatMeters(state.room.widthMeters);
  }
  if (elements.obstacleEditHeightInput && document.activeElement !== elements.obstacleEditHeightInput) {
    elements.obstacleEditHeightInput.value = formatMeters(obstacle.heightMeters);
    elements.obstacleEditHeightInput.max = formatMeters(state.room.heightMeters);
  }
  if (elements.obstacleEditXInput && document.activeElement !== elements.obstacleEditXInput) {
    elements.obstacleEditXInput.value = formatMeters(origin.x);
    elements.obstacleEditXInput.max = formatMeters(limits.x);
  }
  if (elements.obstacleEditYInput && document.activeElement !== elements.obstacleEditYInput) {
    elements.obstacleEditYInput.value = formatMeters(origin.y);
    elements.obstacleEditYInput.max = formatMeters(limits.y);
  }
}

function updateObstacleEditModeButton() {
  const active = isObstacleEditModeActive();
  const localReferenceActive = isLocalReferenceActive();
  const obstacleAlignmentActive = isObstacleAlignmentActive();
  const panelCombinationActive = isPanelCombinationActive();
  const deleteModeActive = isDeleteModeActive();

  if (elements.obstacleEditControl) {
    elements.obstacleEditControl.classList.toggle('active', active || localReferenceActive || obstacleAlignmentActive || panelCombinationActive || deleteModeActive);
  }

  if (elements.obstacleEditButton) {
    elements.obstacleEditButton.classList.remove('active');
    elements.obstacleEditButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.obstacleEditButton.textContent = 'Sperrfläche';
    elements.obstacleEditButton.disabled = active || localReferenceActive || obstacleAlignmentActive || panelCombinationActive || deleteModeActive;
  }

  if (elements.obstacleEditPanel) {
    elements.obstacleEditPanel.hidden = !active;
  }

  if (!active) {
    refreshWorkflowTimelineConnectors();
    return;
  }

  const currentObstacle = getObstacleEditCurrentObstacle();
  const createdCount = obstacleEditModeState.createdObstacleIds.length;
  const hasCurrentObstacle = Boolean(currentObstacle);

  setObstacleEditStep(
    elements.obstacleEditStep1,
    'Sperrfläche hinzufügen',
    hasCurrentObstacle ? 'done target' : 'active target',
  );

  if (elements.obstacleEditSizeBlock) {
    elements.obstacleEditSizeBlock.hidden = !hasCurrentObstacle;
  }
  if (elements.obstacleEditPositionBlock) {
    elements.obstacleEditPositionBlock.hidden = !hasCurrentObstacle || !obstacleEditModeState.sizeEntered;
  }

  setObstacleEditStep(
    elements.obstacleEditStep2,
    'Breite und Höhe festlegen',
    obstacleEditModeState.sizeEntered ? 'done target' : 'active target',
    !hasCurrentObstacle,
  );
  setObstacleEditStep(
    elements.obstacleEditStep3,
    'X/Y-Koordinaten festlegen',
    obstacleEditModeState.positionEntered ? 'done target' : 'active target',
    !hasCurrentObstacle || !obstacleEditModeState.sizeEntered,
  );

  const statusText = createdCount > 0
    ? `✓ ${createdCount} Sperrfläche(n) im Entwurf${currentObstacle ? ` · aktiv ${currentObstacle.id}` : ''}`
    : 'Plus klicken, um eine neue Sperrfläche in Rastergröße anzulegen.';

  if (elements.obstacleEditStatus1) {
    elements.obstacleEditStatus1.textContent = statusText;
  }

  if (currentObstacle) {
    updateObstacleEditInputs(currentObstacle);
  }

  if (elements.obstacleEditApplyButton) {
    elements.obstacleEditApplyButton.disabled = createdCount === 0 && !obstacleEditModeState.hasDraft;
  }

  refreshWorkflowTimelineConnectors();
}

function activateObstacleEditMode() {
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive()) {
    return;
  }

  obstacleEditModeState = {
    ...createEmptyObstacleEditModeState(),
    isActive: true,
    initialObstacles: getObstaclePositionSnapshot(),
  };
  selectedObstacleId = null;
  obstacleDragState = null;
  renderObstacleControls();
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  renderSvg(latestPlan || calculatePlan());
}

function clearObstacleEditMode() {
  obstacleEditModeState = createEmptyObstacleEditModeState();
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  clearInlineEditorLayer();
}

function cancelObstacleEditModeChanges() {
  const hasCreatedDrafts = obstacleEditModeState.createdObstacleIds.length > 0 || obstacleEditModeState.hasDraft;

  if (hasCreatedDrafts) {
    const confirmed = window.confirm('Alle in diesem Modus neu angelegten Sperrflächen verwerfen?');
    if (!confirmed) {
      return;
    }
  }

  if (Array.isArray(obstacleEditModeState.initialObstacles)) {
    state.obstacles = structuredCloneSafe(obstacleEditModeState.initialObstacles);
  }
  selectedObstacleId = null;
  obstacleDragState = null;
  clearObstacleEditMode();
  updateAll();
}

function commitObstacleEditModeChanges() {
  const shouldSave = Boolean(obstacleEditModeState.hasDraft || obstacleEditModeState.createdObstacleIds.length > 0);
  clearObstacleEditMode();
  updateAll();

  if (shouldSave) {
    saveConfigDebounced();
  }
}

function applyObstacleEditSizeFromInputs() {
  const obstacle = getObstacleEditCurrentObstacle();
  if (!obstacle) {
    return;
  }

  const origin = getOriginCoordinates(obstacle);
  const width = positiveNumber(elements.obstacleEditWidthInput?.value, obstacle.widthMeters);
  const height = positiveNumber(elements.obstacleEditHeightInput?.value, obstacle.heightMeters);
  setObstacleFromOrigin(obstacle, origin.x, origin.y, width, height);
  selectedObstacleId = obstacle.id;
  obstacleEditModeState.sizeEntered = true;
  obstacleEditModeState.hasDraft = true;
  renderObstacleControls();
  updateAll();
}

function applyObstacleEditPositionFromInputs() {
  const obstacle = getObstacleEditCurrentObstacle();
  if (!obstacle) {
    return;
  }

  const origin = getOriginCoordinates(obstacle);
  const originX = getNumberOrFallback(elements.obstacleEditXInput?.value, origin.x);
  const originY = getNumberOrFallback(elements.obstacleEditYInput?.value, origin.y);
  setObstacleFromOrigin(obstacle, originX, originY, obstacle.widthMeters, obstacle.heightMeters);
  selectedObstacleId = obstacle.id;
  obstacleEditModeState.positionEntered = true;
  obstacleEditModeState.hasDraft = true;
  renderObstacleControls();
  updateAll();
}

function toggleObstacleEditMode() {
  if (isObstacleEditModeActive()) {
    return;
  }

  activateObstacleEditMode();
}

function isDeleteModeActive() {
  return Boolean(deleteModeState.isActive);
}

function getCombinedPanelSnapshot() {
  return state.combinedPanels.map(panel => ({
    id: panel.id,
    cellIds: Array.isArray(panel.cellIds) ? [...panel.cellIds] : [],
  }));
}

function updateDeleteModeButton() {
  const active = isDeleteModeActive();
  const obstacleEditActive = isObstacleEditModeActive();
  const localReferenceActive = isLocalReferenceActive();
  const obstacleAlignmentActive = isObstacleAlignmentActive();
  const panelCombinationActive = isPanelCombinationActive();

  if (elements.deleteModeControl) {
    elements.deleteModeControl.classList.toggle('active', active || obstacleEditActive || localReferenceActive || obstacleAlignmentActive || panelCombinationActive);
  }

  if (elements.deleteModeButton) {
    elements.deleteModeButton.classList.remove('active');
    elements.deleteModeButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.deleteModeButton.textContent = 'Löschen';
    elements.deleteModeButton.disabled = active || obstacleEditActive || localReferenceActive || obstacleAlignmentActive || panelCombinationActive;
  }

  if (elements.deleteModePanel) {
    elements.deleteModePanel.hidden = !active;
  }

  if (!active) {
    refreshWorkflowTimelineConnectors();
    return;
  }

  const deletedObstacles = deleteModeState.deletedObstacleIds.length;
  const deletedCombined = deleteModeState.deletedCombinedPanelIds.length;
  const deletedTotal = deletedObstacles + deletedCombined;

  setLocalReferenceStep(
    elements.deleteModeStep1,
    'Elemente zum Löschen wählen',
    deletedTotal > 0 ? 'done target' : 'active target',
  );

  setWorkflowStatus(
    elements.deleteModeStatus1,
    deletedTotal > 0
      ? `✓ ${deletedTotal} Element${deletedTotal === 1 ? '' : 'e'} gelöscht · ${deletedObstacles} Sperrfläche(n) · ${deletedCombined} kombiniert`
      : 'Klick auf × bei Sperrflächen oder kombinierten Paneelen löscht das Element.',
    { variant: deletedTotal > 0 ? 'success' : 'info' },
  );

  if (elements.deleteModeApplyButton) {
    elements.deleteModeApplyButton.disabled = false;
  }

  refreshWorkflowTimelineConnectors();
}

function activateDeleteMode() {
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive()) {
    return;
  }

  deleteModeState = {
    ...createEmptyDeleteModeState(),
    isActive: true,
    initialObstacles: getObstaclePositionSnapshot(),
    initialCombinedPanels: getCombinedPanelSnapshot(),
  };
  selectedObstacleId = null;
  obstacleDragState = null;
  updateObstacleEditModeButton();
  updateDeleteModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  renderObstacleControls();
  renderSvg(latestPlan || calculatePlan());
}

function clearDeleteMode() {
  deleteModeState = createEmptyDeleteModeState();
  updateObstacleEditModeButton();
  updateDeleteModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
}

function cancelDeleteModeChanges() {
  if (Array.isArray(deleteModeState.initialObstacles)) {
    state.obstacles = structuredCloneSafe(deleteModeState.initialObstacles);
  }
  if (Array.isArray(deleteModeState.initialCombinedPanels)) {
    state.combinedPanels = structuredCloneSafe(deleteModeState.initialCombinedPanels);
  }
  clearDeleteMode();
  updateAll();
}

function commitDeleteModeChanges() {
  clearDeleteMode();
  updateAll();
  saveConfigDebounced();
}

function toggleDeleteMode() {
  if (isDeleteModeActive()) {
    return;
  }

  activateDeleteMode();
}

function deleteObstacleInDeleteMode(obstacleId) {
  if (!isDeleteModeActive()) {
    return;
  }

  if (!state.obstacles.some(obstacle => obstacle.id === obstacleId)) {
    return;
  }

  state.obstacles = state.obstacles.filter(obstacle => obstacle.id !== obstacleId);
  deleteModeState.deletedObstacleIds = [...new Set([...deleteModeState.deletedObstacleIds, obstacleId])];
  deleteModeState.hasDraft = true;
  selectedObstacleId = null;
  renderObstacleControls();
  updateAll();
}

function deleteCombinedPanelInDeleteMode(combinedPanelId) {
  if (!isDeleteModeActive()) {
    return;
  }

  if (!state.combinedPanels.some(panel => panel.id === combinedPanelId)) {
    return;
  }

  state.combinedPanels = state.combinedPanels.filter(panel => panel.id !== combinedPanelId);
  deleteModeState.deletedCombinedPanelIds = [...new Set([...deleteModeState.deletedCombinedPanelIds, combinedPanelId])];
  deleteModeState.hasDraft = true;
  updateAll();
}

function updateLocalReferenceButton() {
  const active = isLocalReferenceActive();
  const obstacleEditActive = isObstacleEditModeActive();
  const obstacleAlignmentActive = isObstacleAlignmentActive();
  const panelCombinationActive = isPanelCombinationActive();
  const deleteModeActive = isDeleteModeActive();

  if (elements.localReferenceControl) {
    elements.localReferenceControl.classList.toggle('active', active || obstacleEditActive || obstacleAlignmentActive || panelCombinationActive || deleteModeActive);
  }

  if (elements.localReferenceButton) {
    elements.localReferenceButton.classList.remove('active');
    elements.localReferenceButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.localReferenceButton.textContent = 'Relativ verschieben';
    elements.localReferenceButton.disabled = active || obstacleEditActive || obstacleAlignmentActive || panelCombinationActive || deleteModeActive;
  }

  if (elements.localReferencePanel) {
    elements.localReferencePanel.hidden = !active;
  }

  if (!active) {
    refreshWorkflowTimelineConnectors();
    return;
  }

  const hasReference = Boolean(localReferenceState.referenceObstacleId);
  const hasTarget = Boolean(localReferenceState.targetObstacleId && localReferenceState.targetCorner);
  const referenceCornerLabel = getCornerLabel(localReferenceState.referenceCorner);
  const targetCornerLabel = getCornerLabel(localReferenceState.targetCorner);
  const localObjects = hasTarget ? getLocalReferenceObjects() : null;
  const currentDx = localObjects?.referencePoint && localObjects?.targetPoint
    ? formatMeters(localObjects.targetPoint.x - localObjects.referencePoint.x)
    : formatMeters(0);
  const currentDy = localObjects?.referencePoint && localObjects?.targetPoint
    ? formatMeters(localObjects.targetPoint.y - localObjects.referencePoint.y)
    : formatMeters(0);

  setLocalReferenceStep(
    elements.localReferenceStep1,
    'Referenz-Sperrfläche wählen',
    hasReference ? 'done reference' : 'active reference',
  );
  setWorkflowStatus(
    elements.localReferenceStatus1,
    hasReference
      ? `✓ ${localReferenceState.referenceObstacleId} gewählt · Nullpunkt ${referenceCornerLabel}`
      : 'Noch keine Referenz-Sperrfläche gewählt.',
    { variant: hasReference ? 'success' : 'info' },
  );

  setLocalReferenceStep(
    elements.localReferenceStep2,
    'Gelben Zielpunkt wählen',
    hasTarget ? 'done target' : 'active target',
    !hasReference,
  );
  setWorkflowStatus(
    elements.localReferenceStatus2,
    hasTarget
      ? `✓ ${localReferenceState.targetObstacleId} ${targetCornerLabel} gewählt`
      : 'Noch kein Zielpunkt gewählt.',
    { variant: hasTarget ? 'success' : 'info', hidden: !hasReference },
  );

  setLocalReferenceStep(
    elements.localReferenceStep3,
    'Werte eingeben',
    localReferenceState.hasDraft ? 'done' : 'active',
    !hasTarget,
  );
  setWorkflowStatus(
    elements.localReferenceStatus3,
    localReferenceState.hasDraft
      ? `✓ Neue Position vorbereitet · ΔX ${currentDx} · ΔY ${currentDy}`
      : `Aktuell ΔX ${currentDx} · ΔY ${currentDy}`,
    { variant: localReferenceState.hasDraft ? 'success' : 'info', hidden: !hasTarget },
  );

  refreshWorkflowTimelineConnectors();
}

function activateLocalReferenceMode() {
  if (isObstacleEditModeActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive()) {
    return;
  }

  localReferenceState = {
    ...createEmptyLocalReferenceState(),
    isActive: true,
    initialObstacles: getObstaclePositionSnapshot(),
  };
  obstacleDragState = null;
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  renderSvg(latestPlan || calculatePlan());
}

function clearLocalReferenceMode() {
  localReferenceState = createEmptyLocalReferenceState();
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  clearInlineEditorLayer();
}

function commitLocalReferenceChanges() {
  const shouldSave = Boolean(localReferenceState.hasDraft);
  clearLocalReferenceMode();
  renderObstacleControls();
  updateAll();

  if (shouldSave) {
    saveConfigDebounced();
  }
}

function cancelLocalReferenceChanges() {
  restoreObstaclePositionSnapshot(localReferenceState.initialObstacles);
  clearLocalReferenceMode();
  renderObstacleControls();
  updateAll();
}

function toggleLocalReferenceMode() {
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive()) {
    return;
  }

  activateLocalReferenceMode();
}

function getMetricWidth(rect) {
  const width = Number(rect?.widthMeters ?? rect?.width);
  return Number.isFinite(width) ? width : 0;
}

function getMetricHeight(rect) {
  const height = Number(rect?.heightMeters ?? rect?.height);
  return Number.isFinite(height) ? height : 0;
}

function getObstacleCornerPoint(obstacle, corner) {
  const width = getMetricWidth(obstacle);
  const height = getMetricHeight(obstacle);
  const x = corner.includes('right') ? obstacle.x + width : obstacle.x;
  const y = corner.includes('bottom') ? obstacle.y + height : obstacle.y;
  return { x, y };
}

function getClosestObstacleCorner(obstacle, point) {
  return OBSTACLE_CORNERS.reduce((closest, corner) => {
    const cornerPoint = getObstacleCornerPoint(obstacle, corner);
    const distance = ((cornerPoint.x - point.x) ** 2) + ((cornerPoint.y - point.y) ** 2);
    return !closest || distance < closest.distance ? { corner, distance } : closest;
  }, null)?.corner || 'top-left';
}

function setObstacleCornerPoint(obstacle, corner, pointX, pointY) {
  const width = obstacle.widthMeters;
  const height = obstacle.heightMeters;
  const x = corner.includes('right') ? pointX - width : pointX;
  const y = corner.includes('bottom') ? pointY - height : pointY;
  moveObstacleTo(obstacle, x, y);
}

function getLocalReferenceObjects() {
  if (!hasLocalReferenceMode()) {
    return null;
  }

  const referenceObstacle = state.obstacles.find(obstacle => obstacle.id === localReferenceState.referenceObstacleId);
  if (!referenceObstacle) {
    localReferenceState = createEmptyLocalReferenceState();
    return null;
  }

  const targetObstacle = state.obstacles.find(obstacle => obstacle.id === localReferenceState.targetObstacleId) || null;

  return {
    referenceObstacle,
    targetObstacle,
    referencePoint: getObstacleCornerPoint(referenceObstacle, localReferenceState.referenceCorner),
    targetPoint: targetObstacle && localReferenceState.targetCorner
      ? getObstacleCornerPoint(targetObstacle, localReferenceState.targetCorner)
      : null,
  };
}

function selectLocalReferenceObstacle(obstacle, point = null) {
  if (!isLocalReferenceActive() || !obstacle) {
    return;
  }

  localReferenceState.referenceObstacleId = obstacle.id;
  localReferenceState.referenceCorner = point ? getClosestObstacleCorner(obstacle, point) : 'top-left';
  localReferenceState.targetObstacleId = null;
  localReferenceState.targetCorner = null;
  selectedObstacleId = obstacle.id;
  updateLocalReferenceButton();
  renderObstacleControls();
  renderSvg(latestPlan || calculatePlan());
}

function selectLocalReferenceCorner(corner) {
  if (!hasLocalReferenceMode() || !OBSTACLE_CORNERS.includes(corner)) {
    return;
  }

  localReferenceState.referenceCorner = corner;
  updateLocalReferenceButton();
  renderSvg(latestPlan || calculatePlan());
}

function selectLocalTargetCorner(obstacleId, corner) {
  if (!hasLocalReferenceMode() || obstacleId === localReferenceState.referenceObstacleId) {
    return;
  }

  localReferenceState.targetObstacleId = obstacleId;
  localReferenceState.targetCorner = corner;
  selectedObstacleId = obstacleId;
  updateLocalReferenceButton();
  renderObstacleControls();
  renderSvg(latestPlan || calculatePlan());
}

function applyLocalReferenceDistance(field, rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    renderSvg(latestPlan || calculatePlan());
    return;
  }

  const localObjects = getLocalReferenceObjects();
  if (!localObjects?.targetObstacle || !localReferenceState.targetCorner) {
    return;
  }

  const currentTargetPoint = getObstacleCornerPoint(localObjects.targetObstacle, localReferenceState.targetCorner);
  const currentDx = currentTargetPoint.x - localObjects.referencePoint.x;
  const currentDy = currentTargetPoint.y - localObjects.referencePoint.y;
  const nextDx = field === 'x' ? value : currentDx;
  const nextDy = field === 'y' ? value : currentDy;

  setObstacleCornerPoint(
    localObjects.targetObstacle,
    localReferenceState.targetCorner,
    localObjects.referencePoint.x + nextDx,
    localObjects.referencePoint.y + nextDy,
  );

  localReferenceState.hasDraft = true;
  selectedObstacleId = localObjects.targetObstacle.id;
  renderObstacleControls();
  updateAll();
}

function appendLocalReferenceTick(parent, x, y, orientation, tickSize) {
  if (orientation === 'horizontal') {
    parent.appendChild(createSvgElement('line', {
      class: 'local-dimension-tick',
      x1: x,
      y1: y - tickSize / 2,
      x2: x,
      y2: y + tickSize / 2,
    }));
  } else {
    parent.appendChild(createSvgElement('line', {
      class: 'local-dimension-tick',
      x1: x - tickSize / 2,
      y1: y,
      x2: x + tickSize / 2,
      y2: y,
    }));
  }
}

function appendLocalReferenceLine(parent, x1, y1, x2, y2) {
  parent.appendChild(createSvgElement('line', {
    class: 'local-dimension-line',
    x1,
    y1,
    x2,
    y2,
  }));
}

function appendLocalCoordinateInput(field, label, value, point) {
  if (!elements.inlineEditorLayer) {
    return;
  }

  const layerPoint = svgToLayerPoint(point.x, point.y);
  const wrapper = document.createElement('label');
  wrapper.className = `local-coordinate-input local-coordinate-input-${field}`;
  wrapper.style.left = `${layerPoint.left}px`;
  wrapper.style.top = `${layerPoint.top}px`;
  wrapper.innerHTML = `
    <span>${escapeHtml(label)}</span>
    <input type="number" step="0.001" inputmode="decimal" value="${formatMeters(value)}" aria-label="${escapeHtml(label)} Abstand in Metern">
  `;

  const input = wrapper.querySelector('input');
  const stopInteraction = event => event.stopPropagation();
  const selectCurrentValue = () => window.requestAnimationFrame(() => input.select());
  wrapper.addEventListener('pointerdown', stopInteraction);
  wrapper.addEventListener('click', stopInteraction);
  input.addEventListener('pointerdown', event => {
    event.stopPropagation();
    if (document.activeElement !== input) {
      event.preventDefault();
      input.focus();
      selectCurrentValue();
    }
  });
  input.addEventListener('focus', selectCurrentValue);
  input.addEventListener('click', selectCurrentValue);
  input.addEventListener('pointerup', event => {
    event.preventDefault();
    selectCurrentValue();
  });
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      input.blur();
    }
  });
  input.addEventListener('change', () => applyLocalReferenceDistance(field, input.value));

  elements.inlineEditorLayer.appendChild(wrapper);
}

function renderLocalReferenceInlineEditor(referencePoint, targetPoint) {
  if (!elements.inlineEditorLayer || !targetPoint) {
    return;
  }

  elements.inlineEditorLayer.classList.add('local-reference-active');
  const dx = targetPoint.x - referencePoint.x;
  const dy = targetPoint.y - referencePoint.y;
  const inputOffset = Math.max(0.12, Math.min(0.24, getPanelBaseMeters() * 0.35));

  appendLocalCoordinateInput('x', 'ΔX', dx, {
    x: (referencePoint.x + targetPoint.x) / 2,
    y: referencePoint.y - inputOffset,
  });
  appendLocalCoordinateInput('y', 'ΔY', dy, {
    x: targetPoint.x + inputOffset,
    y: (referencePoint.y + targetPoint.y) / 2,
  });
}

function renderLocalReferenceOverlay(svg, obstacleRects) {
  if (!isLocalReferenceActive()) {
    return;
  }

  const localObjects = getLocalReferenceObjects();
  if (!localObjects) {
    return;
  }

  const referenceRect = obstacleRects.find(obstacle => obstacle.id === localReferenceState.referenceObstacleId);
  if (!referenceRect) {
    return;
  }

  const group = createSvgElement('g', { class: 'svg-local-reference-editor' });
  svg.appendChild(group);

  const referencePoint = getObstacleCornerPoint(referenceRect, localReferenceState.referenceCorner);
  const cornerRadius = Math.max(0.045, Math.min(0.09, getPanelBaseMeters() * 0.11));
  const tickSize = Math.max(0.07, Math.min(0.16, getPanelBaseMeters() * 0.2));

  group.appendChild(createSvgElement('rect', {
    class: 'local-reference-highlight',
    x: referenceRect.x,
    y: referenceRect.y,
    width: referenceRect.width,
    height: referenceRect.height,
    rx: 0.015,
  }));

  group.appendChild(createSvgElement('rect', {
    class: 'local-reference-frame',
    x: referenceRect.x,
    y: referenceRect.y,
    width: referenceRect.width,
    height: referenceRect.height,
    rx: 0.015,
  }));
  OBSTACLE_CORNERS.forEach(corner => {
    const point = getObstacleCornerPoint(referenceRect, corner);
    const isSelected = corner === localReferenceState.referenceCorner;
    const dot = createSvgElement('circle', {
      class: `local-reference-corner${isSelected ? ' selected' : ''}`,
      cx: point.x,
      cy: point.y,
      r: isSelected ? cornerRadius * 1.18 : cornerRadius * 0.92,
      tabindex: '0',
      role: 'button',
      'aria-label': `${referenceRect.id} ${corner} als lokalen Nullpunkt wählen`,
    });
    dot.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    dot.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      selectLocalReferenceCorner(corner);
    });
    dot.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        selectLocalReferenceCorner(corner);
      }
    });
    group.appendChild(dot);
  });

  obstacleRects
    .filter(obstacle => obstacle.id !== localReferenceState.referenceObstacleId)
    .forEach(obstacle => {
      OBSTACLE_CORNERS.forEach(corner => {
        const point = getObstacleCornerPoint(obstacle, corner);
        const isSelected = obstacle.id === localReferenceState.targetObstacleId && corner === localReferenceState.targetCorner;
        const dot = createSvgElement('circle', {
          class: `local-target-corner${isSelected ? ' selected' : ''}`,
          cx: point.x,
          cy: point.y,
          r: cornerRadius,
          tabindex: '0',
          role: 'button',
          'aria-label': `${obstacle.id} ${corner} als lokalen Messpunkt wählen`,
        });
        dot.addEventListener('pointerdown', event => {
          event.preventDefault();
          event.stopPropagation();
        });
        dot.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          selectLocalTargetCorner(obstacle.id, corner);
        });
        dot.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            selectLocalTargetCorner(obstacle.id, corner);
          }
        });
        group.appendChild(dot);
      });
    });

  if (localObjects.targetPoint) {
    const targetRect = obstacleRects.find(obstacle => obstacle.id === localReferenceState.targetObstacleId);
    const targetPoint = targetRect
      ? getObstacleCornerPoint(targetRect, localReferenceState.targetCorner)
      : localObjects.targetPoint;

    if (targetRect) {
      group.appendChild(createSvgElement('rect', {
        class: 'local-target-highlight',
        x: targetRect.x,
        y: targetRect.y,
        width: targetRect.width,
        height: targetRect.height,
        rx: 0.015,
      }));
      group.appendChild(createSvgElement('rect', {
        class: 'local-target-frame',
        x: targetRect.x,
        y: targetRect.y,
        width: targetRect.width,
        height: targetRect.height,
        rx: 0.015,
      }));
    }

    appendLocalReferenceLine(group, referencePoint.x, referencePoint.y, targetPoint.x, referencePoint.y);
    appendLocalReferenceLine(group, targetPoint.x, referencePoint.y, targetPoint.x, targetPoint.y);
    appendLocalReferenceTick(group, referencePoint.x, referencePoint.y, 'horizontal', tickSize);
    appendLocalReferenceTick(group, targetPoint.x, referencePoint.y, 'horizontal', tickSize);
    appendLocalReferenceTick(group, targetPoint.x, referencePoint.y, 'vertical', tickSize);
    appendLocalReferenceTick(group, targetPoint.x, targetPoint.y, 'vertical', tickSize);
    group.appendChild(createSvgElement('circle', {
      class: 'local-target-anchor',
      cx: targetPoint.x,
      cy: targetPoint.y,
      r: cornerRadius * 1.15,
    }));
    renderLocalReferenceInlineEditor(referencePoint, targetPoint);
  }
}


function appendObstacleAlignmentRemoveButton(parent, obstacle) {
  const buttonRadius = Math.max(0.055, Math.min(0.11, getPanelBaseMeters() * 0.14));
  const centerX = rectRight(obstacle);
  const centerY = obstacle.y - buttonRadius * 1.15;
  const crossSize = buttonRadius * 0.52;
  const button = createSvgElement('g', {
    class: 'obstacle-alignment-remove-button',
    tabindex: '0',
    role: 'button',
    'aria-label': `${obstacle.id} aus Auswahl entfernen`,
  });

  button.appendChild(createSvgElement('circle', {
    class: 'obstacle-alignment-remove-bg',
    cx: centerX,
    cy: centerY,
    r: buttonRadius,
  }));
  button.appendChild(createSvgElement('line', {
    class: 'obstacle-alignment-remove-cross',
    x1: centerX - crossSize,
    y1: centerY - crossSize,
    x2: centerX + crossSize,
    y2: centerY + crossSize,
  }));
  button.appendChild(createSvgElement('line', {
    class: 'obstacle-alignment-remove-cross',
    x1: centerX + crossSize,
    y1: centerY - crossSize,
    x2: centerX - crossSize,
    y2: centerY + crossSize,
  }));

  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    removeObstacleFromAlignmentSelection(obstacle.id);
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      removeObstacleFromAlignmentSelection(obstacle.id);
    }
  });

  parent.appendChild(button);
}

function renderObstacleAlignmentOverlay(svg, obstacleRects) {
  if (!isObstacleAlignmentActive()) {
    return;
  }

  const selectedIds = getObstacleAlignmentSelectionSet();
  if (selectedIds.size === 0) {
    return;
  }

  const selectedRects = obstacleRects.filter(obstacle => selectedIds.has(obstacle.id));
  if (selectedRects.length === 0) {
    return;
  }

  const referenceId = getObstacleAlignmentReferenceId();
  const referenceRect = selectedRects.find(obstacle => obstacle.id === referenceId) || selectedRects[0];
  const group = createSvgElement('g', { class: 'svg-obstacle-alignment-editor' });
  svg.appendChild(group);

  if (selectedRects.length >= 2 && obstacleAlignmentState.axis && referenceRect) {
    const referenceCenter = getObstacleAlignmentReferenceCenter(referenceRect);
    if (referenceCenter) {
      if (obstacleAlignmentState.axis === 'vertical') {
        group.appendChild(createSvgElement('line', {
          class: 'obstacle-alignment-axis-line',
          x1: referenceCenter.x,
          y1: 0,
          x2: referenceCenter.x,
          y2: state.room.heightMeters,
        }));
      } else {
        group.appendChild(createSvgElement('line', {
          class: 'obstacle-alignment-axis-line',
          x1: 0,
          y1: referenceCenter.y,
          x2: state.room.widthMeters,
          y2: referenceCenter.y,
        }));
      }
    }
  }

  selectedRects.forEach(obstacle => {
    const isReference = obstacle.id === referenceId;
    group.appendChild(createSvgElement('rect', {
      class: `obstacle-alignment-highlight${isReference ? ' obstacle-alignment-reference-highlight' : ''}`,
      x: obstacle.x,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height,
      rx: 0.015,
    }));
    group.appendChild(createSvgElement('rect', {
      class: `obstacle-alignment-frame${isReference ? ' obstacle-alignment-reference-frame' : ''}`,
      x: obstacle.x,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height,
      rx: 0.015,
    }));
    appendObstacleAlignmentRemoveButton(group, obstacle);
  });
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

function appendPanelBoundaryOverlay(svg, blockedPanelCells = [], obstacleRects = []) {
  const grid = getGridRect();
  const y1 = clamp(grid.y, 0, state.room.heightMeters);
  const y2 = clamp(rectBottom(grid), 0, state.room.heightMeters);
  const x1 = clamp(grid.x, 0, state.room.widthMeters);
  const x2 = clamp(rectRight(grid), 0, state.room.widthMeters);

  if (y2 > y1 + EPS) {
    for (let col = 0; col <= grid.cols; col += 1) {
      const rawX = grid.x + col * getPanelWidthMeters();
      if (rawX < -EPS || rawX > state.room.widthMeters + EPS) {
        continue;
      }

      const x = clamp(rawX, 0, state.room.widthMeters);
      const hiddenIntervals = getObstacleAxisHiddenIntervals('x', x, blockedPanelCells, obstacleRects);
      const visibleSegments = subtractIntervals(y1, y2, hiddenIntervals);

      visibleSegments.forEach(segment => {
        svg.appendChild(createSvgElement('line', {
          class: 'panel-boundary-line',
          x1: x,
          y1: segment.start,
          x2: x,
          y2: segment.end,
        }));
      });
    }
  }

  if (x2 > x1 + EPS) {
    for (let row = 0; row <= grid.rows; row += 1) {
      const rawY = grid.y + row * getPanelHeightMeters();
      if (rawY < -EPS || rawY > state.room.heightMeters + EPS) {
        continue;
      }

      const y = clamp(rawY, 0, state.room.heightMeters);
      const hiddenIntervals = getObstacleAxisHiddenIntervals('y', y, blockedPanelCells, obstacleRects);
      const visibleSegments = subtractIntervals(x1, x2, hiddenIntervals);

      visibleSegments.forEach(segment => {
        svg.appendChild(createSvgElement('line', {
          class: 'panel-boundary-line',
          x1: segment.start,
          y1: y,
          x2: segment.end,
          y2: y,
        }));
      });
    }
  }
}


function getObstacleEditorGeometry(obstacle) {
  const originPoint = getOriginPhysicalPoint();
  const anchor = getObstacleOriginAnchor(obstacle);
  const originDistances = getOriginCoordinates(obstacle);
  const baseOffset = Math.max(0.16, Math.min(0.34, getPanelBaseMeters() * 0.38));
  const tickSize = Math.max(0.06, Math.min(0.16, getPanelBaseMeters() * 0.18));
  const xMeasureY = anchor.y - originPoint.yDir * baseOffset;
  const yMeasureX = anchor.x - originPoint.xDir * baseOffset;
  const widthMeasureY = state.originCorner.includes('top')
    ? rectBottom(obstacle) + baseOffset
    : obstacle.y - baseOffset;
  const heightMeasureX = state.originCorner.includes('left')
    ? rectRight(obstacle) + baseOffset
    : obstacle.x - baseOffset;
  const buttonSize = Math.max(0.22, Math.min(0.34, getPanelBaseMeters() * 0.42));

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
  group.appendChild(createSvgElement('rect', {
    class: 'obstacle-selection',
    x: obstacle.x,
    y: obstacle.y,
    width: obstacle.width,
    height: obstacle.height,
    rx: 0.015,
  }));
}

function clearInlineEditorLayer() {
  if (elements.inlineEditorLayer) {
    clearNode(elements.inlineEditorLayer);
    elements.inlineEditorLayer.classList.remove('local-reference-active');
  }
}

function svgToLayerPoint(x, y) {
  const svg = elements.ceilingSvg;
  const frame = elements.svgFrame;
  const viewBox = svg.viewBox.baseVal;
  const svgRect = svg.getBoundingClientRect();
  const frameRect = frame?.getBoundingClientRect?.() || { left: 0, top: 0 };
  const width = svg.clientWidth || svgRect.width;
  const height = svg.clientHeight || svgRect.height;

  return {
    left: (svgRect.left - frameRect.left) + ((x - viewBox.x) / viewBox.width) * width,
    top: (svgRect.top - frameRect.top) + ((y - viewBox.y) / viewBox.height) * height,
  };
}

function renderInlineObstacleEditor(obstacle) {
  // Keine Eingabefelder und kein Löschkreuz mehr im Plan: Die Sperrfläche bleibt dadurch sicher ziehbar.
  clearInlineEditorLayer();
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
  const movedObstacleId = obstacleDragState.obstacleId;
  obstacleDragState = null;

  if (didMove) {
    if (isObstacleEditModeActive()) {
      obstacleEditModeState.currentObstacleId = movedObstacleId;
      obstacleEditModeState.sizeEntered = true;
      obstacleEditModeState.positionEntered = true;
    }
    markObstacleEditDraft();
    renderObstacleControls();
    updateAll();
    if (!isObstacleEditModeActive()) {
      saveConfigDebounced();
    }
  }
}

function appendElementDeleteBadge(parent, rect, onClick) {
  const size = Math.max(0.16, Math.min(0.28, getPanelBaseMeters() * 0.34));
  const x = rectRight(rect) - size * 0.05;
  const y = rect.y + size * 0.05;
  const group = createSvgElement('g', {
    class: 'element-delete-badge',
    'aria-label': 'Element löschen',
    focusable: 'false',
  });
  appendSvgText(group, '×', {
    class: 'element-delete-badge-x',
    x,
    y,
    'font-size': size * 1.05,
  });
  group.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
  });
  group.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  parent.appendChild(group);
  return group;
}

function ensureSvgDefs(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = createSvgElement('defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  return defs;
}

function renderCombinedPanelPieces(svg, plan) {
  const labelSize = Math.max(0.1, Math.min(0.2, getPanelBaseMeters() * 0.24));
  const combinationActive = isPanelCombinationActive();
  const deleteActive = isDeleteModeActive();

  plan.combinedPieces.forEach((piece, index) => {
    const sourceCombinedPanelId = piece.sourceCombinedPanelId;
    const canCombineBySurface = Boolean(sourceCombinedPanelId && combinationActive);
    const fillPath = getClosedBoundaryPathData(piece.atoms) || getBoundaryFillPathData(piece.atoms);
    const outlinePath = getBoundaryPathData(piece.atoms, (x, y) => ({ x, y }), {
      obstacleRects: plan.obstacleRects,
      hideObstacleContinuations: false,
    });

    const fill = createSvgElement('path', {
      class: `combined-panel-fill${combinationActive ? ' panel-combination-candidate' : ''}`,
      d: fillPath,
      'fill-rule': 'evenodd',
    });
    if (canCombineBySurface) {
      fill.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handlePanelCombinationCombinedPanelClick(sourceCombinedPanelId);
      });
    }
    svg.appendChild(fill);

    const outline = createSvgElement('path', {
      class: `combined-panel-outline${combinationActive ? ' panel-combination-candidate' : ''}`,
      d: outlinePath,
    });
    if (canCombineBySurface) {
      outline.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handlePanelCombinationCombinedPanelClick(sourceCombinedPanelId);
      });
    }
    svg.appendChild(outline);

    const labelAnchor = getPieceLabelPoint(piece);
    const largestAtom = getLargestAtom(piece);
    if (largestAtom && largestAtom.width >= 0.05 && largestAtom.height >= 0.025) {
      appendSvgText(svg, piece.sourceCombinedPanelId || piece.groupId, {
        class: 'combined-panel-label',
        x: labelAnchor.x,
        y: labelAnchor.y,
        'font-size': Math.min(labelSize, Math.max(0.04, largestAtom.height * 0.72)),
      });
    }

    if (deleteActive && sourceCombinedPanelId) {
      appendElementDeleteBadge(svg, piece, () => deleteCombinedPanelInDeleteMode(sourceCombinedPanelId));
    }
  });
}

function renderPanelCombinationOverlay(svg, plan) {
  if (!isPanelCombinationActive()) {
    return;
  }

  const group = createSvgElement('g', { class: 'svg-panel-combination-editor' });
  const allCellMap = getGridCellMap(plan.allCells);
  const selectedIds = new Set(getPanelCombinationSelectedCellIds());

  selectedIds.forEach(id => {
    const cell = allCellMap.get(id);
    if (!cell) {
      return;
    }

    group.appendChild(createSvgElement('rect', {
      class: 'panel-combination-selected-highlight',
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
    }));
    group.appendChild(createSvgElement('rect', {
      class: 'panel-combination-selected-frame',
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
    }));
  });

  if (panelCombinationState.rejectedCellId) {
    const rejectedCell = allCellMap.get(panelCombinationState.rejectedCellId);
    if (rejectedCell) {
      group.appendChild(createSvgElement('rect', {
        class: 'panel-combination-rejected-frame',
        x: rejectedCell.x,
        y: rejectedCell.y,
        width: rejectedCell.width,
        height: rejectedCell.height,
      }));
    }
  }

  svg.appendChild(group);
}

function renderSvg(plan) {
  const svg = elements.ceilingSvg;
  svg.classList.toggle('delete-mode-active', isDeleteModeActive());
  svg.classList.toggle('obstacle-edit-mode-active', isObstacleEditModeActive());
  clearNode(svg);
  clearInlineEditorLayer();

  const roomWidth = state.room.widthMeters;
  const roomHeight = state.room.heightMeters;
  const padding = Math.max(Math.max(roomWidth, roomHeight) * 0.06, getPanelBaseMeters() * 0.75, 0.55);
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
    const fullPanelNode = createSvgElement('rect', {
      class: `full-panel${isPanelCombinationActive() ? ' panel-combination-candidate' : ''}`,
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
    });

    if (isPanelCombinationActive()) {
      fullPanelNode.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handlePanelCombinationCellClick(cell);
      });
    }

    svg.appendChild(fullPanelNode);
  });

  appendPanelBoundaryOverlay(svg, plan.blockedPanelCells, plan.obstacleRects);

  const labelSize = Math.max(0.09, Math.min(0.18, getPanelBaseMeters() * 0.22));
  plan.cutPieces.forEach(piece => {
    piece.atoms.forEach(atom => {
      svg.appendChild(createSvgElement('rect', {
        class: 'cut-piece-fill',
        x: atom.x,
        y: atom.y,
        width: atom.width,
        height: atom.height,
      }));
    });

    svg.appendChild(createSvgElement('path', {
      class: 'cut-piece-outline',
      d: getBoundaryPathData(piece.atoms, (x, y) => ({ x, y }), { obstacleRects: plan.obstacleRects, hideObstacleContinuations: true }),
    }));

    const labelAnchor = getPieceLabelPoint(piece);
    const largestAtom = getLargestAtom(piece);
    if (largestAtom && largestAtom.width >= 0.05 && largestAtom.height >= 0.025) {
      appendSvgText(svg, piece.groupId, {
        class: 'piece-label',
        x: labelAnchor.x,
        y: labelAnchor.y,
        'font-size': Math.min(labelSize, Math.max(0.035, largestAtom.height * 0.72)),
      });
    }
  });

  renderCombinedPanelPieces(svg, plan);


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
    obstacleNode.addEventListener('pointerdown', event => {
      if (isDeleteModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      startObstacleDrag(event, obstacle.id);
    });
    obstacleNode.addEventListener('click', event => {
      event.stopPropagation();
      if (isPanelCombinationActive()) {
        return;
      }

      if (isDeleteModeActive()) {
        return;
      }

      if (isObstacleEditModeActive()) {
        selectObstacle(obstacle.id);
        return;
      }

      if (isObstacleAlignmentActive()) {
        toggleObstacleAlignmentSelection(obstacle.id);
        return;
      }

      if (isLocalReferenceActive()) {
        selectLocalReferenceObstacle(obstacle);
        return;
      }

      selectObstacle(obstacle.id);
    });
    svg.appendChild(obstacleNode);
    appendSvgText(svg, obstacle.id, {
      class: 'obstacle-label',
      x: obstacle.x + obstacle.width / 2,
      y: obstacle.y + obstacle.height / 2,
      'font-size': Math.max(0.08, Math.min(0.2, Math.min(obstacle.width, obstacle.height) * 0.32)),
    });

    if (isDeleteModeActive()) {
      appendElementDeleteBadge(svg, obstacle, () => deleteObstacleInDeleteMode(obstacle.id));
    }
  });

  renderOriginMarker(svg);

  const selectedObstacle = plan.obstacleRects.find(obstacle => obstacle.id === selectedObstacleId);
  if (selectedObstacle && !isLocalReferenceActive() && !isObstacleAlignmentActive() && !isPanelCombinationActive() && !isDeleteModeActive()) {
    renderSelectedObstacleEditor(svg, selectedObstacle);
    renderInlineObstacleEditor(selectedObstacle);
  }

  renderLocalReferenceOverlay(svg, plan.obstacleRects);
  renderObstacleAlignmentOverlay(svg, plan.obstacleRects);
  renderPanelCombinationOverlay(svg, plan);
}

function renderOriginMarker(svg) {
  const size = Math.max(0.18, Math.min(0.35, getPanelBaseMeters() * 0.6));
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
    elements.cuttingDetailsTable.innerHTML = '<tr><td class="empty-row" colspan="6">Keine Zuschnittstücke nötig.</td></tr>';
    return;
  }

  plan.groups.forEach(group => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(group.displayId || group.id)}</strong></td>
      <td class="shape-preview-cell">
        <button class="shape-preview-button" type="button" data-group-id="${escapeHtml(group.id)}" aria-label="Maßzeichnung für ${escapeHtml(group.id)} öffnen">
          ${getShapePreviewSvgMarkup(group)}
        </button>
      </td>
      <td>${formatMeters(group.width)} × ${formatMeters(group.height)}${group.isComplex ? '<div class="shape-note">Formstück</div>' : ''}</td>
      <td>${group.quantity}</td>
      <td>${escapeHtml(group.zonesText)}</td>
      <td>${formatArea(group.area)}</td>
    `;
    row.querySelector('.shape-preview-button').addEventListener('click', () => openShapeDetailModal(group.id));
    elements.cuttingDetailsTable.appendChild(row);
  });
}

function renderCombinedPanelsTable(plan) {
  if (!elements.combinedPanelsTable) {
    return;
  }

  elements.combinedPanelsTable.innerHTML = '';

  if (plan.combinedGroups.length === 0) {
    elements.combinedPanelsTable.innerHTML = '<tr><td class="empty-row" colspan="7">Noch keine kombinierten Paneele.</td></tr>';
    return;
  }

  plan.combinedGroups.forEach(group => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(group.displayId || group.id)}</strong></td>
      <td class="shape-preview-cell">
        <button class="shape-preview-button" type="button" data-group-id="${escapeHtml(group.id)}" aria-label="Maßzeichnung für ${escapeHtml(group.id)} öffnen">
          ${getShapePreviewSvgMarkup(group)}
        </button>
      </td>
      <td>${formatMeters(group.width)} × ${formatMeters(group.height)}${group.isComplex ? '<div class="shape-note">Formstück</div>' : ''}</td>
      <td>${group.quantity}</td>
      <td>${group.standardCellCountPerPiece}</td>
      <td>${group.totalStandardCellCount}</td>
      <td>${formatArea(group.area)}</td>
    `;
    row.querySelector('.shape-preview-button').addEventListener('click', () => openShapeDetailModal(group.id));
    elements.combinedPanelsTable.appendChild(row);
  });
}

function renderCombinedCutPanelsTable(plan) {
  if (!elements.combinedCutPanelsTable) {
    return;
  }

  elements.combinedCutPanelsTable.innerHTML = '';

  if (plan.combinedCutGroups.length === 0) {
    elements.combinedCutPanelsTable.innerHTML = '<tr><td class="empty-row" colspan="7">Keine Zuschnitte an kombinierten Paneelen nötig.</td></tr>';
    return;
  }

  plan.combinedCutGroups.forEach(group => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(group.displayId || group.id)}</strong></td>
      <td class="shape-preview-cell">
        <button class="shape-preview-button" type="button" data-group-id="${escapeHtml(group.id)}" aria-label="Maßzeichnung für ${escapeHtml(group.id)} öffnen">
          ${getShapePreviewSvgMarkup(group)}
        </button>
      </td>
      <td>${formatMeters(group.width)} × ${formatMeters(group.height)}${group.isComplex ? '<div class="shape-note">Formstück</div>' : ''}</td>
      <td>${group.quantity}</td>
      <td>${group.standardCellCountPerPiece}</td>
      <td>${formatArea(group.cutAwayArea || 0)}</td>
      <td>${formatArea(group.area)}</td>
    `;
    row.querySelector('.shape-preview-button').addEventListener('click', () => openShapeDetailModal(group.id));
    elements.combinedCutPanelsTable.appendChild(row);
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


function getAlignmentXLabel(alignment) {
  return {
    left: 'links',
    center: 'Mitte X',
    right: 'rechts',
  }[alignment] || alignment;
}

function getAlignmentYLabel(alignment) {
  return {
    top: 'oben',
    center: 'Mitte Y',
    bottom: 'unten',
  }[alignment] || alignment;
}

function getObstacleReportText(obstacle) {
  return `<p>${escapeHtml(obstacle.id)}: ${formatMeters(obstacle.widthMeters)} × ${formatMeters(obstacle.heightMeters)} m</p>`;
}

function reportParagraphs(lines) {
  return lines
    .filter(line => line !== null && line !== undefined && String(line).trim() !== '')
    .map(line => `<p>${line}</p>`)
    .join('');
}

function renderDrawingReport(plan) {
  if (!elements.drawingStatusReport) {
    return;
  }

  const grid = getGridRect();
  const obstacleText = state.obstacles.length > 0
    ? state.obstacles.map(getObstacleReportText).join('')
    : '<p>keine Sperrflächen</p>';
  const combinedText = plan.combinedPanelCount > 0
    ? reportParagraphs([
      `${plan.combinedPanelCount} kombinierte Paneel-Elemente`,
      `aus ${plan.combinedStandardCellCount} Standard-Raster-Paneelen`,
      plan.combinedCutGroups.length > 0
        ? `${plan.combinedCutGroups.length} Zuschnitt-Form${plan.combinedCutGroups.length === 1 ? '' : 'en'} an kombinierten Paneelen`
        : '',
    ])
    : '<p>keine kombinierten Paneele</p>';

  elements.drawingStatusReport.innerHTML = `
    <dl class="drawing-report-grid">
      <div><dt>Raum</dt><dd>${reportParagraphs([
        `${formatMeters(state.room.widthMeters)} × ${formatMeters(state.room.heightMeters)} m`,
        `Koordinaten-Nullpunkt: ${escapeHtml(getCornerLabel(state.originCorner))}`,
      ])}</dd></div>
      <div><dt>Raster</dt><dd>${reportParagraphs([
        `Rastermaß: ${formatMeters(getPanelWidthMeters())} × ${formatMeters(getPanelHeightMeters())} m`,
        `Raster: ${grid.cols} × ${grid.rows}`,
        `Ausrichtung horizontal: ${escapeHtml(getAlignmentXLabel(state.grid.alignmentX))}`,
        `Ausrichtung vertikal: ${escapeHtml(getAlignmentYLabel(state.grid.alignmentY))}`,
        `Versatz X: ${formatMeters(grid.x)} m`,
        `Versatz Y: ${formatMeters(grid.y)} m`,
      ])}</dd></div>
      <div><dt>Sperrflächen</dt><dd>${reportParagraphs([`${state.obstacles.length} Stück`])}${obstacleText}</dd></div>
      <div><dt>Kombiniert</dt><dd>${combinedText}</dd></div>
      <div><dt>Ergebnis</dt><dd>${reportParagraphs([
        `${plan.fullPanelCells.length} Standard`,
        `${plan.combinedPanelCount} kombiniert`,
        `${plan.panels.length} Zusatz-Paneele für Zuschnitt`,
        `${plan.fullPanelCells.length + plan.combinedPanelCount + plan.panels.length} gesamt`,
      ])}</dd></div>
    </dl>
  `;
}

function renderTotals(plan) {
  const fullCount = plan.fullPanelCells.length;
  const combinedCount = plan.combinedPanelCount;
  const extraCount = plan.panels.length;

  elements.fullPanelCount.textContent = String(fullCount);
  if (elements.combinedPanelCount) {
    elements.combinedPanelCount.textContent = String(combinedCount);
  }
  elements.extraPanelCount.textContent = String(extraCount);
  elements.totalPanelCount.textContent = String(fullCount + combinedCount + extraCount);

  if (plan.warnings.length > 0) {
    elements.calculationWarning.hidden = false;
    elements.calculationWarning.textContent = plan.warnings.join(' ');
  } else {
    elements.calculationWarning.hidden = true;
    elements.calculationWarning.textContent = '';
  }

  if (elements.drawingMeta) {
    elements.drawingMeta.textContent = '';
  }
}

function updateAll() {
  latestPlan = calculatePlan();
  updateAlignmentControls();
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  renderSvg(latestPlan);
  renderCuttingTable(latestPlan);
  renderCombinedPanelsTable(latestPlan);
  renderCombinedCutPanelsTable(latestPlan);
  renderPackingTable(latestPlan);
  renderDrawingReport(latestPlan);
  renderTotals(latestPlan);
}

function setGridAlignment(alignmentX, alignmentY) {
  state.grid.alignmentX = normalizeAlignmentX(alignmentX, state.grid.alignmentX);
  state.grid.alignmentY = normalizeAlignmentY(alignmentY, state.grid.alignmentY);
  updateAll();
  saveConfigDebounced();
}

function appendPrintPanelBoundaryOverlay(svg, plan) {
  const grid = getGridRect();
  const y1 = clamp(grid.y, 0, state.room.heightMeters);
  const y2 = clamp(rectBottom(grid), 0, state.room.heightMeters);
  const x1 = clamp(grid.x, 0, state.room.widthMeters);
  const x2 = clamp(rectRight(grid), 0, state.room.widthMeters);
  const lineAttributes = {
    stroke: '#000000',
    'stroke-width': '1.35px',
    'stroke-opacity': '1',
    'vector-effect': 'non-scaling-stroke',
    'shape-rendering': 'crispEdges',
  };

  if (y2 > y1 + EPS) {
    for (let col = 0; col <= grid.cols; col += 1) {
      const rawX = grid.x + col * getPanelWidthMeters();
      if (rawX < -EPS || rawX > state.room.widthMeters + EPS) {
        continue;
      }

      const x = clamp(rawX, 0, state.room.widthMeters);
      const hiddenIntervals = getObstacleAxisHiddenIntervals('x', x, plan.blockedPanelCells, plan.obstacleRects);
      subtractIntervals(y1, y2, hiddenIntervals).forEach(segment => {
        svg.appendChild(createSvgElement('line', {
          ...lineAttributes,
          class: 'print-panel-boundary-line',
          x1: x,
          y1: segment.start,
          x2: x,
          y2: segment.end,
        }));
      });
    }
  }

  if (x2 > x1 + EPS) {
    for (let row = 0; row <= grid.rows; row += 1) {
      const rawY = grid.y + row * getPanelHeightMeters();
      if (rawY < -EPS || rawY > state.room.heightMeters + EPS) {
        continue;
      }

      const y = clamp(rawY, 0, state.room.heightMeters);
      const hiddenIntervals = getObstacleAxisHiddenIntervals('y', y, plan.blockedPanelCells, plan.obstacleRects);
      subtractIntervals(x1, x2, hiddenIntervals).forEach(segment => {
        svg.appendChild(createSvgElement('line', {
          ...lineAttributes,
          class: 'print-panel-boundary-line',
          x1: segment.start,
          y1: y,
          x2: segment.end,
          y2: y,
        }));
      });
    }
  }
}

function getPrintablePlanSvgMarkup() {
  const clone = elements.ceilingSvg.cloneNode(true);
  clone.querySelectorAll('.svg-obstacle-editor, .svg-local-reference-editor, .svg-obstacle-alignment-editor, .svg-panel-combination-editor').forEach(node => node.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.classList.add('print-plan-svg');

  const style = createSvgElement('style');
  style.textContent = `
    .print-plan-svg .room-rect{fill:#ffffff!important;stroke:#000000!important;stroke-width:1.4px!important;vector-effect:non-scaling-stroke!important}
    .print-plan-svg .full-panel{fill:#ffffff!important;stroke:#000000!important;stroke-width:1.15px!important;stroke-opacity:1!important;vector-effect:non-scaling-stroke!important;shape-rendering:crispEdges!important}
    .print-plan-svg .cut-piece-fill{fill:#ffffff!important;fill-opacity:1!important;stroke:none!important}
    .print-plan-svg .cut-piece-outline{fill:none!important;stroke:#000000!important;stroke-width:1.35px!important;stroke-opacity:1!important;vector-effect:non-scaling-stroke!important;stroke-linecap:butt!important;stroke-linejoin:miter!important}
    .print-plan-svg .combined-panel-fill{fill:#ffffff!important;fill-opacity:1!important;stroke:none!important}
    .print-plan-svg .combined-panel-outline{fill:none!important;stroke:#000000!important;stroke-width:1.65px!important;stroke-opacity:1!important;vector-effect:non-scaling-stroke!important;stroke-linecap:butt!important;stroke-linejoin:miter!important}
    .print-plan-svg .combined-panel-label{fill:#000000!important;stroke:#ffffff!important;stroke-width:0.035!important;paint-order:stroke fill!important;font-weight:900!important;text-anchor:middle!important;dominant-baseline:middle!important}
    .print-plan-svg .panel-boundary-line{stroke:#000000!important;stroke-width:1.2px!important;stroke-opacity:1!important;vector-effect:non-scaling-stroke!important;shape-rendering:crispEdges!important}
    .print-plan-svg .grid-line{stroke:#777777!important;stroke-width:0.9px!important;stroke-opacity:1!important;vector-effect:non-scaling-stroke!important}
    .print-plan-svg .obstacle{fill:#111111!important;fill-opacity:1!important;stroke:#000000!important;stroke-width:1.5px!important;vector-effect:non-scaling-stroke!important}
    .print-plan-svg .piece-label{fill:#000000!important;stroke:#ffffff!important;stroke-width:0.035!important;paint-order:stroke fill!important;font-weight:900!important;text-anchor:middle!important;dominant-baseline:middle!important}
    .print-plan-svg .obstacle-label{fill:#ffffff!important;stroke:none!important;font-weight:900!important;text-anchor:middle!important;dominant-baseline:middle!important}
    .print-plan-svg .origin-label{fill:#000000!important;stroke:#ffffff!important;stroke-width:0.025!important;paint-order:stroke fill!important;font-weight:900!important;text-anchor:middle!important;dominant-baseline:middle!important}
    .print-plan-svg .origin-dot{fill:#000000!important}
    .print-plan-svg .origin-axis{stroke:#000000!important;stroke-width:1.25px!important;vector-effect:non-scaling-stroke!important}
    .print-plan-svg .dimension-line,.print-plan-svg .dimension-tick{stroke:#000000!important;stroke-width:1.2px!important;vector-effect:non-scaling-stroke!important}
    .print-plan-svg .dimension-extension-line{stroke:#000000!important;stroke-width:0.85px!important;stroke-dasharray:0.04 0.035!important;stroke-opacity:0.75!important;vector-effect:non-scaling-stroke!important}
  `;
  clone.insertBefore(style, clone.firstChild);

  return clone.outerHTML;
}

function getPrintTotalsMarkup(plan) {
  const fullCount = plan.fullPanelCells.length;
  const combinedCount = plan.combinedPanelCount;
  const extraCount = plan.panels.length;
  return `
    <section class="print-section print-result-section">
      <h2>Ergebnis</h2>
      <dl class="print-totals">
        <div><dt>Ganze Standard-Paneele</dt><dd>${fullCount}</dd></div>
        <div><dt>Kombinierte Paneele</dt><dd>${combinedCount}</dd></div>
        <div><dt>Zusatz-Paneele für Zuschnitt</dt><dd>${extraCount}</dd></div>
        <div class="print-total-row"><dt>Paneel-Elemente gesamt</dt><dd>${fullCount + combinedCount + extraCount}</dd></div>
      </dl>
    </section>
  `;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getPrintCuttingTableMarkup(plan) {
  const rows = plan.groups.length === 0
    ? '<tr><td class="empty-row" colspan="6">Keine Zuschnittstücke nötig.</td></tr>'
    : plan.groups.map(group => `
      <tr>
        <td><strong>${escapeHtml(group.id)}</strong></td>
        <td class="shape-preview-cell">${getShapePreviewSvgMarkup(group)}</td>
        <td>${formatMeters(group.width)} × ${formatMeters(group.height)}${group.isComplex ? '<div class="shape-note">Formstück</div>' : ''}</td>
        <td>${group.quantity}</td>
        <td>${escapeHtml(group.zonesText)}</td>
        <td>${formatArea(group.area)}</td>
      </tr>
    `).join('');

  return `
    <section class="print-section print-cutting-table-section">
      <h2>Zuschnitt / gleiche Stücke</h2>
      <table class="print-table print-cutting-table">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Form</th>
            <th>Größe (m)</th>
            <th>Stück</th>
            <th>Zonen</th>
            <th>Fläche (m²)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function getPrintCombinedPanelsTableMarkup(plan) {
  const rows = plan.combinedGroups.length === 0
    ? '<tr><td class="empty-row" colspan="7">Noch keine kombinierten Paneele.</td></tr>'
    : plan.combinedGroups.map(group => `
      <tr>
        <td><strong>${escapeHtml(group.id)}</strong></td>
        <td class="shape-preview-cell">${getShapePreviewSvgMarkup(group)}</td>
        <td>${formatMeters(group.width)} × ${formatMeters(group.height)}${group.isComplex ? '<div class="shape-note">Formstück</div>' : ''}</td>
        <td>${group.quantity}</td>
        <td>${group.standardCellCountPerPiece}</td>
        <td>${group.totalStandardCellCount}</td>
        <td>${formatArea(group.area)}</td>
      </tr>
    `).join('');

  return `
    <section class="print-section print-combined-table-section">
      <h2>Kombinierte Paneele / gleiche Formen</h2>
      <table class="print-table print-combined-table">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Form</th>
            <th>Größe (m)</th>
            <th>Stück</th>
            <th>Raster/Stück</th>
            <th>Raster gesamt</th>
            <th>Fläche (m²)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function getPrintCombinedCutPanelsTableMarkup(plan) {
  const rows = plan.combinedCutGroups.length === 0
    ? '<tr><td class="empty-row" colspan="7">Keine Zuschnitte an kombinierten Paneelen nötig.</td></tr>'
    : plan.combinedCutGroups.map(group => `
      <tr>
        <td><strong>${escapeHtml(group.id)}</strong></td>
        <td class="shape-preview-cell">${getShapePreviewSvgMarkup(group)}</td>
        <td>${formatMeters(group.width)} × ${formatMeters(group.height)}${group.isComplex ? '<div class="shape-note">Formstück</div>' : ''}</td>
        <td>${group.quantity}</td>
        <td>${group.standardCellCountPerPiece}</td>
        <td>${formatArea(group.cutAwayArea || 0)}</td>
        <td>${formatArea(group.area)}</td>
      </tr>
    `).join('');

  return `
    <section class="print-section print-combined-cut-table-section">
      <h2>Zuschnitt kombinierte Paneele</h2>
      <table class="print-table print-combined-cut-table">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Form nach Ausschnitt</th>
            <th>Größe (m)</th>
            <th>Stück</th>
            <th>Raster/Stück</th>
            <th>Ausschnitt (m²)</th>
            <th>Restfläche (m²)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function getPrintShapeDrawingsMarkup(plan) {
  if (plan.groups.length === 0) {
    return '';
  }

  return chunkArray(plan.groups, 2).map(groupPair => {
    const items = groupPair.map(group => {
      const voids = getShapeVoidRects(group);
      const relatedObstacleText = getShapeRelatedObstacleText(group);
      const relatedObstacleRow = relatedObstacleText
        ? `<div><dt>Sperrfläche</dt><dd>${escapeHtml(relatedObstacleText)}</dd></div>`
        : '';
      const voidsSection = voids.length > 0
        ? getShapeMeasurementTableMarkup('Aussparungen', voids, '')
        : '';

      return `
        <article class="print-shape-item">
          <h2>Maßzeichnung Zuschnitt ${escapeHtml(group.id)}</h2>
          <div class="print-shape-grid">
            <div class="print-shape-drawing">${getShapeDetailSvgMarkup(group)}</div>
            <div class="print-shape-measures">
              <section class="shape-detail-measure-card shape-detail-summary-card">
                <h4>Gesamtmaße</h4>
                <dl>
                  <div><dt>Gesamtbreite</dt><dd>${formatMeters(group.width)} m</dd></div>
                  <div><dt>Gesamthöhe</dt><dd>${formatMeters(group.height)} m</dd></div>
                  <div><dt>Stückzahl</dt><dd>${group.quantity}</dd></div>
                  ${relatedObstacleRow}
                </dl>
              </section>
              ${voidsSection}
              ${getShapeSegmentTableMarkup(group)}
            </div>
          </div>
        </article>
      `;
    }).join('');

    return `
      <section class="print-section print-shape-sheet">
        ${items}
      </section>
    `;
  }).join('');
}

function getPrintCombinedShapeDrawingsMarkup(plan) {
  if (plan.combinedGroups.length === 0) {
    return '';
  }

  return chunkArray(plan.combinedGroups, 2).map(groupPair => {
    const items = groupPair.map(group => {
      const voids = getShapeVoidRects(group);
      const voidsSection = voids.length > 0
        ? getShapeMeasurementTableMarkup('Aussparungen', voids, '')
        : '';

      return `
        <article class="print-shape-item">
          <h2>Maßzeichnung kombiniertes Paneel ${escapeHtml(group.displayId || group.id)}</h2>
          <div class="print-shape-grid">
            <div class="print-shape-drawing">${getShapeDetailSvgMarkup(group)}</div>
            <div class="print-shape-measures">
              <section class="shape-detail-measure-card shape-detail-summary-card">
                <h4>Gesamtmaße</h4>
                <dl>
                  <div><dt>Gesamtbreite</dt><dd>${formatMeters(group.width)} m</dd></div>
                  <div><dt>Gesamthöhe</dt><dd>${formatMeters(group.height)} m</dd></div>
                  <div><dt>Stückzahl</dt><dd>${group.quantity}</dd></div>
                  <div><dt>Raster-Paneele pro Stück</dt><dd>${group.standardCellCountPerPiece}</dd></div>
                  <div><dt>Raster-Paneele gesamt</dt><dd>${group.totalStandardCellCount}</dd></div>
                </dl>
              </section>
              ${voidsSection}
              ${getShapeSegmentTableMarkup(group)}
            </div>
          </div>
        </article>
      `;
    }).join('');

    return `
      <section class="print-section print-shape-sheet print-combined-shape-sheet">
        ${items}
      </section>
    `;
  }).join('');
}

function getPrintCombinedCutShapeDrawingsMarkup(plan) {
  if (plan.combinedCutGroups.length === 0) {
    return '';
  }

  return chunkArray(plan.combinedCutGroups, 2).map(groupPair => {
    const items = groupPair.map(group => {
      const voids = getShapeVoidRects(group);
      const voidsSection = voids.length > 0
        ? getShapeMeasurementTableMarkup('Aussparungen', voids, '')
        : '';

      return `
        <article class="print-shape-item">
          <h2>Maßzeichnung Zuschnitt kombiniertes Paneel ${escapeHtml(group.displayId || group.id)}</h2>
          <div class="print-shape-grid">
            <div class="print-shape-drawing">${getShapeDetailSvgMarkup(group)}</div>
            <div class="print-shape-measures">
              <section class="shape-detail-measure-card shape-detail-summary-card">
                <h4>Gesamtmaße nach Ausschnitt</h4>
                <dl>
                  <div><dt>Gesamtbreite</dt><dd>${formatMeters(group.width)} m</dd></div>
                  <div><dt>Gesamthöhe</dt><dd>${formatMeters(group.height)} m</dd></div>
                  <div><dt>Stückzahl</dt><dd>${group.quantity}</dd></div>
                  <div><dt>Raster-Paneele pro Stück</dt><dd>${group.standardCellCountPerPiece}</dd></div>
                  <div><dt>Ausschnitt gesamt</dt><dd>${formatArea(group.cutAwayArea || 0)}</dd></div>
                </dl>
              </section>
              ${voidsSection}
              ${getShapeSegmentTableMarkup(group)}
            </div>
          </div>
        </article>
      `;
    }).join('');

    return `
      <section class="print-section print-shape-sheet print-combined-cut-shape-sheet">
        ${items}
      </section>
    `;
  }).join('');
}

function getPrintPackingTableMarkup(plan) {
  const rows = plan.panels.length === 0
    ? '<tr><td class="empty-row" colspan="3">Keine zusätzlichen Paneele nötig.</td></tr>'
    : plan.panels.map(panel => `
      <tr>
        <td><strong>${escapeHtml(panel.id)}</strong></td>
        <td>${escapeHtml(summarizePanelPlacements(panel))}</td>
        <td>${formatArea(panel.usedArea)}</td>
      </tr>
    `).join('');

  return `
    <section class="print-section print-packing-section">
      <h2>Aufteilung auf gekaufte Paneele</h2>
      <table class="print-table print-packing-table">
        <thead>
          <tr>
            <th>Zusatz-Paneel</th>
            <th>Daraus schneiden</th>
            <th>Belegte Fläche (m²)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function buildPrintReportMarkup(plan) {
  return `
    <article class="print-report">
      <section class="print-section print-plan-section">
        <div class="print-report-header">
          <p class="eyebrow">AkustikpaneleApp</p>
          <h1>Flächenplan</h1>
          <p>${formatMeters(state.room.widthMeters)} × ${formatMeters(state.room.heightMeters)} m · Paneel ${formatMeters(getPanelWidthMeters())} × ${formatMeters(getPanelHeightMeters())} m · Raster ${getGridCols()} × ${getGridRows()} · ${state.obstacles.length} Sperrfläche(n) · ${plan.combinedPanelCount} kombiniert</p>
        </div>
        <div class="print-plan-frame">${getPrintablePlanSvgMarkup()}</div>
      </section>
      ${getPrintTotalsMarkup(plan)}
      ${getPrintCuttingTableMarkup(plan)}
      ${getPrintPackingTableMarkup(plan)}
      ${getPrintCombinedPanelsTableMarkup(plan)}
      ${getPrintCombinedCutPanelsTableMarkup(plan)}
      ${getPrintShapeDrawingsMarkup(plan)}
      ${getPrintCombinedShapeDrawingsMarkup(plan)}
      ${getPrintCombinedCutShapeDrawingsMarkup(plan)}
    </article>
  `;
}

function printReport() {
  closeShapeDetailModal();
  selectedObstacleId = null;
  localReferenceState = createEmptyLocalReferenceState();
  obstacleAlignmentState = createEmptyObstacleAlignmentState();
  panelCombinationState = createEmptyPanelCombinationState();
  deleteModeState = createEmptyDeleteModeState();
  obstacleEditModeState = createEmptyObstacleEditModeState();
  clearPanelCombinationFeedback();
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  clearInlineEditorLayer();
  latestPlan = calculatePlan();
  renderSvg(latestPlan);
  renderCuttingTable(latestPlan);
  renderCombinedPanelsTable(latestPlan);
  renderCombinedCutPanelsTable(latestPlan);
  renderPackingTable(latestPlan);
  renderDrawingReport(latestPlan);
  renderTotals(latestPlan);

  let printRoot = document.getElementById('print-report-root');
  if (!printRoot) {
    printRoot = document.createElement('div');
    printRoot.id = 'print-report-root';
    document.body.appendChild(printRoot);
  }

  printRoot.innerHTML = buildPrintReportMarkup(latestPlan);
  window.requestAnimationFrame(() => window.print());
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

  bindNumberInput(elements.panelWidthInput, value => {
    state.grid.panelWidthMeters = positiveNumber(value, getPanelWidthMeters());
    clampObstaclesToRoom();
  });

  bindNumberInput(elements.panelHeightInput, value => {
    state.grid.panelHeightMeters = positiveNumber(value, getPanelHeightMeters());
    clampObstaclesToRoom();
  });

  elements.alignLeftButton.addEventListener('click', () => setGridAlignment('left', state.grid.alignmentY));
  elements.alignCenterXButton.addEventListener('click', () => setGridAlignment('center', state.grid.alignmentY));
  elements.alignRightButton.addEventListener('click', () => setGridAlignment('right', state.grid.alignmentY));
  elements.alignTopButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'top'));
  elements.alignCenterYButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'center'));
  elements.alignBottomButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'bottom'));

  elements.originCornerSelect.addEventListener('change', () => {
    rebaseObstaclesToOriginCorner(elements.originCornerSelect.value);
    renderObstacleControls();
    updateAll();
    saveConfigDebounced();
  });

  elements.addObstacleButton?.addEventListener('click', addObstacle);
  ['input', 'change'].forEach(eventName => {
    elements.obstacleEditWidthInput?.addEventListener(eventName, applyObstacleEditSizeFromInputs);
    elements.obstacleEditHeightInput?.addEventListener(eventName, applyObstacleEditSizeFromInputs);
    elements.obstacleEditXInput?.addEventListener(eventName, applyObstacleEditPositionFromInputs);
    elements.obstacleEditYInput?.addEventListener(eventName, applyObstacleEditPositionFromInputs);
  });
  elements.obstacleEditButton?.addEventListener('click', toggleObstacleEditMode);
  elements.obstacleEditApplyButton?.addEventListener('click', commitObstacleEditModeChanges);
  elements.obstacleEditCancelButton?.addEventListener('click', cancelObstacleEditModeChanges);
  elements.localReferenceButton?.addEventListener('click', toggleLocalReferenceMode);
  elements.localReferenceApplyButton?.addEventListener('click', commitLocalReferenceChanges);
  elements.localReferenceCancelButton?.addEventListener('click', cancelLocalReferenceChanges);
  elements.obstacleAlignmentButton?.addEventListener('click', toggleObstacleAlignmentMode);
  elements.obstacleAlignmentReferenceButton?.addEventListener('click', startObstacleAlignmentReferenceSelection);
  elements.obstacleAlignmentStatus1?.addEventListener('click', () => {
    if (elements.obstacleAlignmentStatus1.classList.contains('actionable')) {
      startObstacleAlignmentReferenceSelection();
    }
  });
  elements.obstacleAlignmentStatus1?.addEventListener('keydown', event => {
    if (!elements.obstacleAlignmentStatus1.classList.contains('actionable')) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startObstacleAlignmentReferenceSelection();
    }
  });
  elements.obstacleAlignmentHorizontalButton?.addEventListener('click', () => selectObstacleAlignmentAxis('horizontal'));
  elements.obstacleAlignmentVerticalButton?.addEventListener('click', () => selectObstacleAlignmentAxis('vertical'));
  elements.obstacleAlignmentStartButton?.addEventListener('click', () => applyObstacleAlignment(
    getObstacleAlignmentValuesForAxis(obstacleAlignmentState.axis)[0],
  ));
  elements.obstacleAlignmentCenterButton?.addEventListener('click', () => applyObstacleAlignment('center'));
  elements.obstacleAlignmentEndButton?.addEventListener('click', () => applyObstacleAlignment(
    getObstacleAlignmentValuesForAxis(obstacleAlignmentState.axis)[2],
  ));
  elements.obstacleAlignmentApplyButton?.addEventListener('click', commitObstacleAlignmentChanges);
  elements.obstacleAlignmentCancelButton?.addEventListener('click', cancelObstacleAlignmentChanges);
  elements.panelCombinationButton?.addEventListener('click', togglePanelCombinationMode);
  elements.panelCombinationApplyButton?.addEventListener('click', commitPanelCombinationChanges);
  elements.panelCombinationCancelButton?.addEventListener('click', cancelPanelCombinationChanges);
  elements.deleteModeButton?.addEventListener('click', toggleDeleteMode);
  elements.deleteModeApplyButton?.addEventListener('click', commitDeleteModeChanges);
  elements.deleteModeCancelButton?.addEventListener('click', cancelDeleteModeChanges);
  elements.printButton.addEventListener('click', printReport);
  window.addEventListener('pointermove', updateObstacleDrag);
  window.addEventListener('pointerup', finishObstacleDrag);
  window.addEventListener('pointercancel', finishObstacleDrag);
  window.addEventListener('resize', () => {
    renderSvg(latestPlan || calculatePlan());
    refreshWorkflowTimelineConnectors();
  });
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
    combinedPanelCount: plan.combinedPanelCount,
    combinedStandardCellCount: plan.combinedStandardCellCount,
    extraPanelCount: plan.panels.length,
    totalPanelCount: plan.fullPanelCells.length + plan.combinedPanelCount + plan.panels.length,
    cutArea: roundTo(plan.cutArea),
    cutGroups: plan.groups.map(group => ({
      id: group.id,
      displayId: group.displayId || group.id,
      widthMeters: roundTo(group.width),
      heightMeters: roundTo(group.height),
      quantity: group.quantity,
      zones: group.zonesText,
      area: roundTo(group.area),
      isComplex: group.isComplex,
      shapeAtoms: group.normalizedAtoms,
    })),
    combinedGroups: plan.combinedGroups.map(group => ({
      id: group.id,
      displayId: group.displayId || group.id,
      widthMeters: roundTo(group.width),
      heightMeters: roundTo(group.height),
      quantity: group.quantity,
      standardCellsPerPiece: group.standardCellCountPerPiece,
      totalStandardCells: group.totalStandardCellCount,
      area: roundTo(group.area),
      isComplex: group.isComplex,
      shapeAtoms: group.normalizedAtoms,
    })),
    combinedCutGroups: plan.combinedCutGroups.map(group => ({
      id: group.id,
      displayId: group.displayId || group.id,
      widthMeters: roundTo(group.width),
      heightMeters: roundTo(group.height),
      quantity: group.quantity,
      standardCellsPerPiece: group.standardCellCountPerPiece,
      cutAwayArea: roundTo(group.cutAwayArea || 0),
      area: roundTo(group.area),
      isComplex: group.isComplex,
      shapeAtoms: group.normalizedAtoms,
    })),
    purchasedPanels: plan.panels.map(panel => ({
      id: panel.id,
      cuts: summarizePanelPlacements(panel),
      usedArea: roundTo(panel.usedArea),
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
  clone.querySelectorAll('.svg-obstacle-editor, .svg-local-reference-editor, .svg-obstacle-alignment-editor, .svg-panel-combination-editor').forEach(node => node.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = `
    .room-rect{fill:#fffdf8;stroke:#4e4a44;stroke-width:.018}
    .grid-line{stroke:#c5bbac;stroke-width:.007;vector-effect:non-scaling-stroke}
    .panel-boundary-line{stroke:#5f5140;stroke-width:.013;stroke-opacity:.72;vector-effect:non-scaling-stroke}
    .full-panel{fill:#ead9bd;stroke:#8b7556;stroke-width:.012;vector-effect:non-scaling-stroke}
    .cut-piece-fill{fill:#ef8172;fill-opacity:1;stroke:none}.cut-piece-outline{fill:none;stroke:#8d271e;stroke-width:1.15px;vector-effect:non-scaling-stroke;stroke-linecap:butt;stroke-linejoin:miter}
    .combined-panel-fill{fill:#dbeafe;fill-opacity:1;stroke:none}.combined-panel-outline{fill:none;stroke:#1d4ed8;stroke-width:1.35px;vector-effect:non-scaling-stroke;stroke-linecap:butt;stroke-linejoin:miter}.combined-panel-label{fill:#1e3a8a;font-weight:900;text-anchor:middle;dominant-baseline:middle}
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
