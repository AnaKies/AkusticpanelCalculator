const CONFIG_URL = '/config.json';

const DEFAULT_CONFIG = {
  schemaVersion: 2,
  room: {
    widthMeters: 8.861,
    heightMeters: 4.865,
  },
  grid: {
    rows: 8,
    cols: 14,
    cellMeters: 0.6,
  },
  lamps: [
    { id: 'L1', centerX: 2.1, anchorY: 'top', edgeDistanceY: 0.9, widthMeters: 0.6, heightMeters: 0.6 },
    { id: 'L2', centerX: 4.5, anchorY: 'top', edgeDistanceY: 0.9, widthMeters: 0.6, heightMeters: 0.6 },
    { id: 'L3', centerX: 6.9, anchorY: 'top', edgeDistanceY: 0.9, widthMeters: 0.6, heightMeters: 0.6 },
    { id: 'L4', centerX: 0.3, anchorY: 'bottom', edgeDistanceY: 1.062, widthMeters: 0.6, heightMeters: 0.6 },
    { id: 'L5', centerX: 2.1, anchorY: 'bottom', edgeDistanceY: 1.062, widthMeters: 0.6, heightMeters: 0.6 },
    { id: 'L6', centerX: 3.9, anchorY: 'bottom', edgeDistanceY: 1.062, widthMeters: 0.6, heightMeters: 0.6 },
    { id: 'L7', centerX: 5.7, anchorY: 'bottom', edgeDistanceY: 1.062, widthMeters: 0.6, heightMeters: 0.6 },
    { id: 'L8', centerX: 7.5, anchorY: 'bottom', edgeDistanceY: 0.8, widthMeters: 0.6, heightMeters: 0.6 },
  ],
  measureFlags: {},
};

let state = cloneConfig(DEFAULT_CONFIG);
let isLoadingConfig = false;
let saveConfigTimer = null;
let selectedLamp = null;
let draftLampSize = null;

const elements = {
  grid: document.getElementById('grid'),
  lampLayer: document.getElementById('lampLayer'),
  xChainLayer: document.getElementById('xChainLayer'),
  lampSizeEditor: document.getElementById('lampSizeEditor'),
  lampWidthInput: document.getElementById('lampWidthInput'),
  lampHeightInput: document.getElementById('lampHeightInput'),
  lampSizeAccept: document.getElementById('lampSizeAccept'),
  lampSizeCancel: document.getElementById('lampSizeCancel'),
  widthInput: document.getElementById('widthInput'),
  heightInput: document.getElementById('heightInput'),
  rightLabel: document.getElementById('rightLabel'),
  bottomLabel: document.getElementById('bottomLabel'),
  bottomStrip: document.getElementById('bottomStrip'),
  rightStrip: document.getElementById('rightStrip'),
  widthMeta: document.getElementById('widthMeta'),
  heightMeta: document.getElementById('heightMeta'),
  widthGridMeta: document.getElementById('widthGridMeta'),
  heightGridMeta: document.getElementById('heightGridMeta'),
  ceilingArea: document.getElementById('ceilingArea'),
  heightOverhang: document.getElementById('heightOverhang'),
  exportJsonButton: document.getElementById('exportJsonButton'),
  exportCsvButton: document.getElementById('exportCsvButton'),
  exportSvgButton: document.getElementById('exportSvgButton'),
  printButton: document.getElementById('printButton'),
};

const lampElements = new Map();
const xChainSegments = [];
const flagPositions = new Map();

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function positiveNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function nonNegativeNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function roundMeters(value) {
  return Math.round(value * 1000) / 1000;
}

function formatMeters(value) {
  return String(roundMeters(value)).replace('.', ',');
}

function readInputMeters(input, fallback) {
  const parsed = parseMeasurementValue(input.value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeAnchorY(value, fallback = 'top') {
  return value === 'top' || value === 'bottom' ? value : fallback;
}

function normalizeFlagPositions(rawFlags) {
  const result = {};

  if (!rawFlags || typeof rawFlags !== 'object' || Array.isArray(rawFlags)) {
    return result;
  }

  Object.entries(rawFlags).forEach(([key, value]) => {
    const left = Number(value?.left);
    const top = Number(value?.top);

    if (Number.isFinite(left) && Number.isFinite(top)) {
      result[key] = { left, top };
    }
  });

  return result;
}

function normalizeConfig(rawConfig) {
  const fallback = cloneConfig(DEFAULT_CONFIG);
  const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const fallbackLampById = new Map(fallback.lamps.map(lamp => [lamp.id, lamp]));

  const normalized = {
    schemaVersion: 2,
    room: {
      widthMeters: positiveNumber(config.room?.widthMeters ?? config.room?.width, fallback.room.widthMeters),
      heightMeters: positiveNumber(config.room?.heightMeters ?? config.room?.height, fallback.room.heightMeters),
    },
    grid: {
      rows: Math.max(1, Math.round(positiveNumber(config.grid?.rows, fallback.grid.rows))),
      cols: Math.max(1, Math.round(positiveNumber(config.grid?.cols, fallback.grid.cols))),
      cellMeters: positiveNumber(config.grid?.cellMeters, fallback.grid.cellMeters),
    },
    lamps: [],
    measureFlags: normalizeFlagPositions(config.measureFlags ?? config.flags),
  };

  const sourceLamps = Array.isArray(config.lamps) && config.lamps.length > 0
    ? config.lamps
    : fallback.lamps;

  normalized.lamps = sourceLamps.map((lamp, index) => {
    const id = String(lamp.id ?? lamp.label ?? fallback.lamps[index]?.id ?? `L${index + 1}`);
    const fallbackLamp = fallbackLampById.get(id) ?? fallback.lamps[index] ?? fallback.lamps[0];

    return {
      id,
      centerX: nonNegativeNumber(lamp.centerX ?? lamp.x, fallbackLamp.centerX),
      anchorY: normalizeAnchorY(lamp.anchorY ?? lamp.from, fallbackLamp.anchorY),
      edgeDistanceY: nonNegativeNumber(lamp.edgeDistanceY ?? lamp.distance, fallbackLamp.edgeDistanceY),
      widthMeters: positiveNumber(lamp.widthMeters ?? lamp.width, fallbackLamp.widthMeters),
      heightMeters: positiveNumber(lamp.heightMeters ?? lamp.height, fallbackLamp.heightMeters),
    };
  });

  return normalized;
}

function getGridWidthMeters() {
  return state.grid.cols * state.grid.cellMeters;
}

function getGridHeightMeters() {
  return state.grid.rows * state.grid.cellMeters;
}

function resizeInput(input) {
  const value = input.value || input.placeholder || '';
  const mirror = document.createElement('span');

  mirror.textContent = value || '0';
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre';
  mirror.style.font = getComputedStyle(input).font;
  document.body.appendChild(mirror);

  input.style.width = `${Math.max(Math.ceil(mirror.getBoundingClientRect().width) + 6, 18)}px`;
  mirror.remove();
}

function bindAutoWidth(input) {
  resizeInput(input);
  input.addEventListener('input', () => resizeInput(input));
}

function isCalculationExpression(value) {
  const normalized = value.trim().replaceAll(',', '.');
  return /[0-9).]\s*[+\-*/]\s*[0-9(.]/.test(normalized)
    && /^[0-9+\-*/().\s]+$/.test(normalized);
}

function evaluateCalculation(value) {
  const normalized = value.trim().replaceAll(',', '.');

  if (!isCalculationExpression(normalized)) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    return Number.isFinite(result) ? roundMeters(result) : null;
  } catch {
    return null;
  }
}

function parseMeasurementValue(value) {
  const calculationResult = evaluateCalculation(value);

  if (calculationResult !== null) {
    return calculationResult;
  }

  return Number(value.trim().replaceAll(',', '.'));
}

function ensureCalcActions(input) {
  if (input._calcActions) {
    return input._calcActions;
  }

  const actions = document.createElement('span');
  actions.className = 'calc-actions';

  const accept = document.createElement('button');
  accept.className = 'calc-accept';
  accept.type = 'button';
  accept.textContent = '✓';
  accept.setAttribute('aria-label', 'Berechnung übernehmen');

  const cancel = document.createElement('button');
  cancel.className = 'calc-cancel';
  cancel.type = 'button';
  cancel.textContent = '×';
  cancel.setAttribute('aria-label', 'Berechnung verwerfen');

  actions.append(accept, cancel);
  input.parentElement.appendChild(actions);
  input._calcActions = { actions, accept, cancel };

  return input._calcActions;
}

function setCommittedInputValue(input, value) {
  input.value = String(roundMeters(value));
  input.dataset.committedValue = input.value;
  resizeInput(input);
}

function bindConfirmedInput(input, onCommit) {
  const { actions, accept, cancel } = ensureCalcActions(input);

  const revert = () => {
    input.value = input.dataset.committedValue || '';
    actions.classList.remove('open');
    resizeInput(input);
  };

  const commit = () => {
    const nextValue = parseMeasurementValue(input.value);

    if (!Number.isFinite(nextValue) || nextValue < 0) {
      revert();
      return;
    }

    setCommittedInputValue(input, nextValue);
    actions.classList.remove('open');
    onCommit(roundMeters(nextValue));
    saveConfig();
  };

  input.dataset.committedValue = input.value;

  input.addEventListener('input', () => {
    resizeInput(input);
    actions.classList.toggle('open', input.value !== input.dataset.committedValue);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      revert();
      input.blur();
    }
  });

  input.addEventListener('blur', () => {
    if (input.value !== input.dataset.committedValue) {
      commit();
    }
  });

  accept.addEventListener('click', commit);
  cancel.addEventListener('click', revert);
}

function buildConfig() {
  return {
    schemaVersion: 2,
    room: {
      widthMeters: roundMeters(state.room.widthMeters),
      heightMeters: roundMeters(state.room.heightMeters),
    },
    grid: {
      rows: state.grid.rows,
      cols: state.grid.cols,
      cellMeters: roundMeters(state.grid.cellMeters),
    },
    lamps: state.lamps.map(lamp => ({
      id: lamp.id,
      centerX: roundMeters(lamp.centerX),
      anchorY: lamp.anchorY,
      edgeDistanceY: roundMeters(lamp.edgeDistanceY),
      widthMeters: roundMeters(lamp.widthMeters),
      heightMeters: roundMeters(lamp.heightMeters),
    })),
    measureFlags: Object.fromEntries(flagPositions),
  };
}

async function saveConfig() {
  if (isLoadingConfig) {
    return;
  }

  clearTimeout(saveConfigTimer);

  try {
    await fetch(CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConfig()),
    });
  } catch (error) {
    console.error('Konfiguration konnte nicht gespeichert werden:', error);
  }
}

function saveConfigDebounced() {
  if (isLoadingConfig) {
    return;
  }

  clearTimeout(saveConfigTimer);
  saveConfigTimer = setTimeout(saveConfig, 250);
}

async function loadConfig() {
  isLoadingConfig = true;

  try {
    const response = await fetch(CONFIG_URL, { cache: 'no-store' });

    if (response.ok) {
      state = normalizeConfig(await response.json());
    } else {
      state = cloneConfig(DEFAULT_CONFIG);
    }
  } catch (error) {
    console.error('Konfiguration konnte nicht geladen werden:', error);
    state = cloneConfig(DEFAULT_CONFIG);
  } finally {
    isLoadingConfig = false;
  }
}

function applyStateToInputs() {
  setCommittedInputValue(elements.widthInput, state.room.widthMeters);
  setCommittedInputValue(elements.heightInput, state.room.heightMeters);

  flagPositions.clear();
  Object.entries(state.measureFlags || {}).forEach(([key, pos]) => flagPositions.set(key, pos));
}

function describeDifference(difference, positiveText, negativeText) {
  const amount = formatMeters(Math.abs(difference));
  return difference >= 0
    ? `${positiveText} ${amount} m`
    : `${negativeText} ${amount} m`;
}

function toPixelsX(meters) {
  const gridWidth = elements.grid.getBoundingClientRect().width;
  return meters * (gridWidth / getGridWidthMeters());
}

function toPixelsY(meters) {
  const gridHeight = elements.grid.getBoundingClientRect().height;
  return meters * (gridHeight / getGridHeightMeters());
}

function getLampWidth(lamp) {
  return lamp.widthMeters;
}

function getLampHeight(lamp) {
  return lamp.heightMeters;
}

function getLampCenterY(lamp) {
  const halfHeight = getLampHeight(lamp) / 2;
  return lamp.anchorY === 'top'
    ? lamp.edgeDistanceY + halfHeight
    : state.room.heightMeters - lamp.edgeDistanceY - halfHeight;
}

function getLampLeftX(lamp) {
  return lamp.centerX - getLampWidth(lamp) / 2;
}

function getLampRightX(lamp) {
  return lamp.centerX + getLampWidth(lamp) / 2;
}

function getChainGroups() {
  return [
    state.lamps.filter(lamp => lamp.anchorY === 'top').sort((a, b) => a.centerX - b.centerX),
    state.lamps.filter(lamp => lamp.anchorY === 'bottom').sort((a, b) => a.centerX - b.centerX),
  ].filter(group => group.length > 0);
}

function buildChainDistances(group) {
  if (group.length === 0) {
    return [];
  }

  const distances = [
    { label: `links bis ${group[0].id}`, value: getLampLeftX(group[0]), startIndex: 0 },
  ];

  for (let index = 0; index < group.length - 1; index += 1) {
    distances.push({
      label: `${group[index].id} bis ${group[index + 1].id}`,
      value: getLampLeftX(group[index + 1]) - getLampRightX(group[index]),
      startIndex: index + 1,
    });
  }

  return distances;
}

function moveChainFrom(group, startIndex, newDistance) {
  const currentDistance = startIndex === 0
    ? getLampLeftX(group[0])
    : getLampLeftX(group[startIndex]) - getLampRightX(group[startIndex - 1]);
  const delta = newDistance - currentDistance;

  for (let index = startIndex; index < group.length; index += 1) {
    group[index].centerX = roundMeters(group[index].centerX + delta);
  }
}

function buildGrid() {
  elements.grid.replaceChildren();
  elements.grid.style.gridTemplateColumns = `repeat(${state.grid.cols}, var(--cell))`;
  elements.grid.style.gridTemplateRows = `repeat(${state.grid.rows}, var(--cell))`;

  for (let row = 1; row <= state.grid.rows; row += 1) {
    for (let col = 1; col <= state.grid.cols; col += 1) {
      const cell = document.createElement('div');

      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.title = `Reihe ${row}, Spalte ${col}`;
      cell.textContent = `${row}.${col}`;

      elements.grid.appendChild(cell);
    }
  }
}

function openLampSizeEditor(lamp) {
  const item = lampElements.get(lamp.id);

  if (!item) {
    return;
  }

  const centerX = toPixelsX(lamp.centerX);
  const centerY = toPixelsY(getLampCenterY(lamp));

  lampElements.forEach(elementItem => elementItem.lamp.classList.remove('active'));
  item.lamp.classList.add('active');
  selectedLamp = lamp;
  draftLampSize = {
    widthMeters: getLampWidth(lamp),
    heightMeters: getLampHeight(lamp),
  };

  elements.lampWidthInput.value = String(roundMeters(getLampWidth(lamp)));
  elements.lampHeightInput.value = String(roundMeters(getLampHeight(lamp)));
  elements.lampWidthInput.dataset.committedValue = elements.lampWidthInput.value;
  elements.lampHeightInput.dataset.committedValue = elements.lampHeightInput.value;
  resizeInput(elements.lampWidthInput);
  resizeInput(elements.lampHeightInput);

  elements.lampSizeEditor.style.left = `${centerX + toPixelsX(getLampWidth(lamp) / 2) + 8}px`;
  elements.lampSizeEditor.style.top = `${centerY - 16}px`;
  elements.lampSizeEditor.classList.remove('dirty');
  elements.lampSizeEditor.classList.add('open');
}

function markLampSizeDraft() {
  if (!selectedLamp) {
    return;
  }

  elements.lampSizeEditor.classList.add('dirty');
  resizeInput(elements.lampWidthInput);
  resizeInput(elements.lampHeightInput);
}

function closeLampSizeEditor() {
  elements.lampSizeEditor.classList.remove('open', 'dirty');
  lampElements.forEach(item => item.lamp.classList.remove('active'));
  selectedLamp = null;
  draftLampSize = null;
}

function acceptLampSizeDraft() {
  if (!selectedLamp) {
    return;
  }

  const width = parseMeasurementValue(elements.lampWidthInput.value);
  const height = parseMeasurementValue(elements.lampHeightInput.value);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    elements.lampWidthInput.value = String(roundMeters(draftLampSize?.widthMeters ?? selectedLamp.widthMeters));
    elements.lampHeightInput.value = String(roundMeters(draftLampSize?.heightMeters ?? selectedLamp.heightMeters));
    resizeInput(elements.lampWidthInput);
    resizeInput(elements.lampHeightInput);
    return;
  }

  selectedLamp.widthMeters = roundMeters(width);
  selectedLamp.heightMeters = roundMeters(height);
  updateDimensions();
  saveConfig();
  closeLampSizeEditor();
}

function cancelLampSizeDraft() {
  closeLampSizeEditor();
}

function setFlagPosition(flag, key, defaultLeft, defaultTop) {
  const saved = flagPositions.get(key);
  const left = saved?.left ?? defaultLeft;
  const top = saved?.top ?? defaultTop;

  flag.style.left = `${left}px`;
  flag.style.top = `${top}px`;
  flag.style.transform = 'none';
  return { left, top };
}

function updateFlagFoot(flag, foot, orientation) {
  const left = parseFloat(flag.style.left) || 0;
  const top = parseFloat(flag.style.top) || 0;
  const width = flag.offsetWidth;
  const height = flag.offsetHeight;
  const targetX = orientation === 'y'
    ? 0
    : parseFloat(flag.parentElement.style.width || '0') / 2;
  const targetY = orientation === 'y'
    ? parseFloat(flag.parentElement.style.height || '0') / 2
    : 0;
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const centerDx = targetX - centerX;
  const centerDy = targetY - centerY;
  const scale = Math.max(Math.abs(centerDx) / (width / 2), Math.abs(centerDy) / (height / 2), 1);
  const startX = centerX + centerDx / scale;
  const startY = centerY + centerDy / scale;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  foot.className = 'measure-foot';
  foot.style.left = `${startX}px`;
  foot.style.top = `${startY}px`;
  foot.style.width = `${length}px`;
  foot.style.transform = `rotate(${angle}deg)`;
}

function makeFlagDraggable(flag, foot, key, orientation) {
  flag.classList.add('measure-flag');

  flag.addEventListener('pointerdown', event => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') {
      return;
    }

    event.preventDefault();
    flag.setPointerCapture(event.pointerId);

    const parentRect = flag.offsetParent.getBoundingClientRect();
    const flagRect = flag.getBoundingClientRect();
    const offsetX = event.clientX - flagRect.left;
    const offsetY = event.clientY - flagRect.top;

    const onMove = moveEvent => {
      const left = moveEvent.clientX - parentRect.left - offsetX;
      const top = moveEvent.clientY - parentRect.top - offsetY;

      flagPositions.set(key, { left, top });
      flag.style.left = `${left}px`;
      flag.style.top = `${top}px`;
      flag.style.transform = 'none';
      updateFlagFoot(flag, foot, orientation);
    };

    const onUp = upEvent => {
      flag.releasePointerCapture(upEvent.pointerId);
      flag.removeEventListener('pointermove', onMove);
      flag.removeEventListener('pointerup', onUp);
      flag.removeEventListener('pointercancel', onUp);
      saveConfig();
    };

    flag.addEventListener('pointermove', onMove);
    flag.addEventListener('pointerup', onUp);
    flag.addEventListener('pointercancel', onUp);
  });
}

function buildLampElements() {
  elements.lampLayer.querySelectorAll('.lamp-object, .lamp-guide').forEach(node => node.remove());
  lampElements.clear();

  state.lamps.forEach(lamp => {
    const lampObject = document.createElement('div');
    lampObject.className = 'lamp-object';
    lampObject.textContent = lamp.id;
    lampObject.setAttribute('role', 'button');
    lampObject.tabIndex = 0;
    lampObject.setAttribute('aria-label', `${lamp.id} Größe bearbeiten`);

    const guide = document.createElement('div');
    guide.className = 'lamp-guide';

    const measure = document.createElement('label');
    measure.className = 'lamp-measure';

    const foot = document.createElement('div');
    foot.className = 'measure-foot';

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';

    const unit = document.createElement('span');
    unit.textContent = 'm';

    measure.append(input, unit);
    guide.append(foot, measure);
    elements.lampLayer.append(guide, lampObject);

    bindAutoWidth(input);
    bindConfirmedInput(input, value => {
      lamp.edgeDistanceY = value;
      updateDimensions();
      saveConfigDebounced();
    });

    lampElements.set(lamp.id, { lamp: lampObject, guide, measure, foot, input });
    lampObject.addEventListener('click', () => openLampSizeEditor(lamp));
    lampObject.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLampSizeEditor(lamp);
      }
    });
    makeFlagDraggable(measure, foot, `y-${lamp.id}`, 'y');
  });
}

function buildXChainElements() {
  elements.xChainLayer.replaceChildren();
  xChainSegments.length = 0;

  getChainGroups().forEach(group => {
    group.forEach((_, index) => {
      const distanceSegment = document.createElement('div');
      distanceSegment.className = 'x-chain-segment';

      const measure = document.createElement('label');
      measure.className = 'x-chain-measure';

      const foot = document.createElement('div');
      foot.className = 'measure-foot';

      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      bindAutoWidth(input);

      const unit = document.createElement('span');
      unit.textContent = 'm';

      measure.append(input, unit);
      distanceSegment.append(foot, measure);
      elements.xChainLayer.appendChild(distanceSegment);

      const distanceItem = {
        element: distanceSegment,
        measure,
        foot,
        input,
        key: `x-${group[0].anchorY}-${index}`,
        onCommit: null,
      };

      bindConfirmedInput(input, value => {
        if (distanceItem.onCommit) {
          distanceItem.onCommit(value);
        }
      });

      xChainSegments.push(distanceItem);
      makeFlagDraggable(measure, foot, distanceItem.key, 'x');
    });
  });
}

function updateLampPositions() {
  state.lamps.forEach(lamp => {
    const item = lampElements.get(lamp.id);

    if (!item) {
      return;
    }

    const centerX = toPixelsX(lamp.centerX);
    const centerY = toPixelsY(getLampCenterY(lamp));
    const lampWidth = getLampWidth(lamp);
    const lampHeight = getLampHeight(lamp);
    const edgeY = lamp.anchorY === 'top'
      ? centerY - toPixelsY(lampHeight / 2)
      : centerY + toPixelsY(lampHeight / 2);
    const guideStart = lamp.anchorY === 'top' ? 0 : edgeY;
    const realBottomY = toPixelsY(state.room.heightMeters);
    const guideHeight = lamp.anchorY === 'top' ? edgeY : Math.max(realBottomY - edgeY, 0);

    item.lamp.style.left = `${centerX}px`;
    item.lamp.style.top = `${centerY}px`;
    item.lamp.style.width = `${toPixelsX(lampWidth)}px`;
    item.lamp.style.height = `${toPixelsY(lampHeight)}px`;
    item.guide.style.left = `${centerX}px`;
    item.guide.style.top = `${guideStart}px`;
    item.guide.style.height = `${guideHeight}px`;
    setFlagPosition(item.measure, `y-${lamp.id}`, 8, Math.max(guideHeight / 2 - 13, 0));
    updateFlagFoot(item.measure, item.foot, 'y');
    setCommittedInputValue(item.input, lamp.edgeDistanceY);
    item.input.setAttribute(
      'aria-label',
      `${lamp.id} Y-Abstand ${lamp.anchorY === 'top' ? 'von oben bis Oberkante' : 'von unten bis Unterkante'} in Metern`
    );
  });
}

function updateXChain() {
  const groups = getChainGroups();
  let segmentIndex = 0;

  groups.forEach(group => {
    const rowAnchor = group[0];
    const chainY = toPixelsY(getLampCenterY(rowAnchor));
    const distances = buildChainDistances(group);
    let cursorX = 0;

    distances.forEach(distance => {
      const segment = xChainSegments[segmentIndex];

      if (!segment) {
        return;
      }

      const width = toPixelsX(Math.max(distance.value, 0));

      segment.element.style.left = `${cursorX}px`;
      segment.element.style.top = `${chainY}px`;
      segment.element.style.width = `${width}px`;
      setFlagPosition(segment.measure, segment.key, Math.max(width / 2 - 40, 0), -34);
      updateFlagFoot(segment.measure, segment.foot, 'x');
      setCommittedInputValue(segment.input, Math.max(distance.value, 0));
      segment.input.setAttribute('aria-label', `X-Abstand ${distance.label} in Metern`);
      segment.onCommit = value => {
        moveChainFrom(group, distance.startIndex, value);
        updateDimensions();
        saveConfigDebounced();
      };

      cursorX += width;
      segmentIndex += 1;
      cursorX += toPixelsX(getLampWidth(group[distance.startIndex]));
    });
  });
}

function updateDimensions() {
  const realWidth = state.room.widthMeters;
  const realHeight = state.room.heightMeters;
  const gridWidthMeters = getGridWidthMeters();
  const gridHeightMeters = getGridHeightMeters();
  const widthDifference = realWidth - gridWidthMeters;
  const heightDifference = realHeight - gridHeightMeters;
  const extraWidth = Math.max(widthDifference, 0);
  const extraHeight = Math.max(heightDifference, 0);

  document.documentElement.style.setProperty('--extra-strip', `${toPixelsX(extraWidth)}px`);
  document.documentElement.style.setProperty('--bottom-strip', `${toPixelsY(extraHeight)}px`);
  document.documentElement.style.setProperty('--real-height-line', `${toPixelsY(realHeight)}px`);
  document.documentElement.style.setProperty('--height-overhang', `${toPixelsY(Math.max(gridHeightMeters - realHeight, 0))}px`);

  const widthText = formatMeters(realWidth);
  const heightText = formatMeters(realHeight);
  const extraWidthText = formatMeters(extraWidth);
  const extraHeightText = formatMeters(extraHeight);
  const widthDescription = describeDifference(widthDifference, 'rechts bleiben', 'Rasterüberstand rechts');
  const heightDescription = describeDifference(heightDifference, 'unten bleiben', 'Rasterüberstand unten');

  elements.rightLabel.textContent = `${state.grid.rows} Module x ${formatMeters(state.grid.cellMeters)} m = ${formatMeters(gridHeightMeters)} m, ${heightDescription}`;
  elements.bottomLabel.textContent = `${state.grid.cols} Module x ${formatMeters(state.grid.cellMeters)} m = ${formatMeters(gridWidthMeters)} m, ${widthDescription}`;
  elements.widthMeta.textContent = `${widthText} m gesamt`;
  elements.heightMeta.textContent = `${heightText} m gesamt`;
  elements.widthGridMeta.textContent = `${state.grid.cols} Module = ${formatMeters(gridWidthMeters)} m, ${widthDescription}`;
  elements.heightGridMeta.textContent = `${state.grid.rows} Module = ${formatMeters(gridHeightMeters)} m, ${heightDescription}`;

  elements.rightStrip.hidden = extraWidth <= 0;
  elements.bottomStrip.hidden = extraHeight <= 0;
  elements.heightOverhang.hidden = heightDifference >= 0;
  elements.rightStrip.setAttribute('aria-label', `Freier Streifen rechts ${extraWidthText} m`);
  elements.bottomStrip.setAttribute('aria-label', `Freier Streifen unten ${extraHeightText} m`);
  elements.heightOverhang.setAttribute('aria-label', `Rasterüberstand unten ${formatMeters(Math.max(gridHeightMeters - realHeight, 0))} m`);
  elements.ceilingArea.setAttribute('aria-label', `Decke mit ${widthText} m Länge und ${heightText} m Höhe`);

  updateLampPositions();
  updateXChain();
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
  const parts = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  parts.push(`<rect x="${margin}" y="${margin}" width="${state.room.widthMeters * scale}" height="${state.room.heightMeters * scale}" fill="#fdfcf9" stroke="#4e4a44" stroke-width="2"/>`);

  for (let col = 0; col <= state.grid.cols; col += 1) {
    const x = margin + col * state.grid.cellMeters * scale;
    parts.push(`<line x1="${x}" y1="${margin}" x2="${x}" y2="${margin + gridHeight * scale}" stroke="#8f8a80" stroke-width="1"/>`);
  }

  for (let row = 0; row <= state.grid.rows; row += 1) {
    const y = margin + row * state.grid.cellMeters * scale;
    parts.push(`<line x1="${margin}" y1="${y}" x2="${margin + gridWidth * scale}" y2="${y}" stroke="#8f8a80" stroke-width="1"/>`);
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
