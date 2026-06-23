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
    panelWidthMeters: 0.6,
    panelHeightMeters: 0.6,
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

function getBoundaryEdges(atoms) {
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

  atoms.forEach(atom => {
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

function getShapePreviewSvgMarkup(group) {
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
    <svg class="shape-icon" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
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
    <svg class="shape-detail-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Maßzeichnung ${escapeHtml(group.id)}">
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
  const relatedObstacleText = getShapeRelatedObstacleText(group);
  const relatedObstacleRow = relatedObstacleText
    ? `<div><dt>Sperrfläche</dt><dd>${escapeHtml(relatedObstacleText)}</dd></div>`
    : '';
  const voidsSection = voids.length > 0
    ? getShapeMeasurementTableMarkup('Aussparungen', voids, '')
    : '';

  return `
    <div class="shape-detail-backdrop" role="presentation">
      <section class="shape-detail-modal" role="dialog" aria-modal="true" aria-labelledby="shape-detail-title">
        <header class="shape-detail-header">
          <div>
            <p class="shape-detail-eyebrow">Maßzeichnung Zuschnitt</p>
            <h3 id="shape-detail-title">${escapeHtml(group.id)} · ${formatMeters(group.width)} × ${formatMeters(group.height)} m</h3>
            <p class="shape-detail-subtitle">Die Maßzeichnung zeigt nur Form und Maße des Zuschnittstücks.</p>
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
  const group = plan.groups.find(item => item.id === groupId);

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

function calculatePlan() {
  const obstacleRects = state.obstacles.map(getObstacleRect);
  const allCells = getAllGridCells();
  const fullPanelCells = getFullPanelCells(allCells, obstacleRects);
  const blockedPanelCells = getBlockedPanelCells(allCells, obstacleRects);
  const cutPieces = calculateCutPieces(allCells, fullPanelCells, blockedPanelCells, obstacleRects);
  const groups = buildGroups(cutPieces);
  const panels = packPiecesIntoPanels(groups);
  const cutArea = cutPieces.reduce((sum, piece) => sum + piece.area, 0);
  const purchasedCutArea = panels.length * getPanelAreaMeters();
  const wasteArea = Math.max(0, purchasedCutArea - cutArea);
  const warnings = [];
  const oversizedGroups = groups.filter(group => group.width > getPanelWidthMeters() + EPS || group.height > getPanelHeightMeters() + EPS);
  if (oversizedGroups.length > 0) {
    warnings.push('Einige Zuschnittstücke sind größer als ein Paneel. Bitte Paneelgröße prüfen.');
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

function addObstacle() {
  const size = Math.min(getPanelBaseMeters(), state.room.widthMeters, state.room.heightMeters);
  const defaultOffset = Math.min(getPanelBaseMeters() * 0.5, state.room.widthMeters * 0.12, state.room.heightMeters * 0.12);
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
    svg.appendChild(createSvgElement('rect', {
      class: 'full-panel',
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
    }));
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
      <td><strong>${escapeHtml(group.id)}</strong></td>
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

  elements.drawingMeta.textContent = `${formatMeters(state.room.widthMeters)} × ${formatMeters(state.room.heightMeters)} m · Paneel ${formatMeters(getPanelWidthMeters())} × ${formatMeters(getPanelHeightMeters())} m · Raster ${getGridCols()} × ${getGridRows()} · ${state.obstacles.length} Sperrfläche(n)`;
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
      isComplex: group.isComplex,
      shapeAtoms: group.normalizedAtoms,
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
    .cut-piece-fill{fill:#ef8172;fill-opacity:1;stroke:none}.cut-piece-outline{fill:none;stroke:#8d271e;stroke-width:1.15px;vector-effect:non-scaling-stroke;stroke-linecap:butt;stroke-linejoin:miter}
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
