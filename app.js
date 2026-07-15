const EPS = 0.000001;
const DISPLAY_DIGITS = 3;
const CONFIG_URL = 'config.json';
const CONFIGURATION_STORAGE_URL = '/api/configurations';
const CONFIGURATION_ARCHIVE_KIND = 'akustikpanele-configuration-archive';
const CONFIGURATION_ARCHIVE_VERSION = 1;
const WORKSPACE_SCHEMA_VERSION = 8;

const DEFAULT_STATE = {
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  room: {
    widthMeters: 8.861,
    heightMeters: 4.865,
  },
  grid: {
    panelWidthMeters: 0.6,
    panelHeightMeters: 0.6,
    alignmentX: 'center',
    alignmentY: 'center',
    trueCenter: false,
    rotationDegrees: 0,
    coordinateMode: 'absolute',
  },
  originCorner: 'top-left',
  obstacles: [],
  combinedPanels: [],
  measurementCollections: [],
  measurements: [],
  measureFlags: {},
  labelCallouts: {},
};

const state = structuredCloneSafe(DEFAULT_STATE);
let latestPlan = null;
let saveTimer = null;
let selectedObstacleId = null;
let obstacleDragState = null;
let labelCalloutDragState = null;
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

function createEmptyMeasurementModeState() {
  return {
    isActive: false,
    selectedPointIds: [],
    previewMeasurementId: null,
    editingMeasurementId: null,
    editingMissingSlotIndex: null,
  };
}

let localReferenceState = createEmptyLocalReferenceState();
let obstacleAlignmentState = createEmptyObstacleAlignmentState();
let panelCombinationState = createEmptyPanelCombinationState();
let deleteModeState = createEmptyDeleteModeState();
let obstacleEditModeState = createEmptyObstacleEditModeState();
let measurementModeState = createEmptyMeasurementModeState();
let panelCombinationFeedbackTimer = null;
let shapeDetailModal = null;
let previousFocusedElement = null;
let activeMeasurementConfigKey = null;
let workspaceState = {
  activeTabId: null,
  tabs: [],
  expandedTabId: null,
};

const elements = {
  widthInput: document.getElementById('width-input'),
  heightInput: document.getElementById('height-input'),
  panelWidthInput: document.getElementById('panel-width-input'),
  panelHeightInput: document.getElementById('panel-height-input'),
  gridAngleInput: document.getElementById('grid-angle-input'),
  gridAngleResetButton: document.getElementById('grid-angle-reset-button'),
  gridAnglePreset45Button: document.getElementById('grid-angle-preset-45-button'),
  gridAnglePreset90Button: document.getElementById('grid-angle-preset-90-button'),
  gridAnglePreset180Button: document.getElementById('grid-angle-preset-180-button'),
  gridAlignmentButtons: document.getElementById('grid-alignment-buttons'),
  trueCenterCheckbox: document.getElementById('true-center-checkbox'),
  originCornerLabel: document.getElementById('origin-corner-label'),
  originCornerHint: document.getElementById('origin-corner-hint'),
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
  deleteModeClearObstaclesButton: document.getElementById('delete-mode-clear-obstacles-button'),
  deleteModeClearCombinedPanelsButton: document.getElementById('delete-mode-clear-combined-panels-button'),
  deleteModeApplyButton: document.getElementById('delete-mode-apply-button'),
  deleteModeCancelButton: document.getElementById('delete-mode-cancel-button'),
  measurementControl: document.getElementById('measurement-control'),
  measurementButton: document.getElementById('measurement-button'),
  measurementPanel: document.getElementById('measurement-panel'),
  measurementStep1: document.getElementById('measurement-step-1'),
  measurementStatus: document.getElementById('measurement-status'),
  measurementApplyButton: document.getElementById('measurement-apply-button'),
  measurementCancelButton: document.getElementById('measurement-cancel-button'),
  measurementSavedSection: document.getElementById('measurement-saved-section'),
  measurementSavedDetails: document.getElementById('measurement-saved-details'),
  measurementSavedTable: document.getElementById('measurement-saved-table'),
  measurementPointPicker: document.getElementById('measurement-point-picker'),
  workspaceTabsBar: document.getElementById('workspace-tabs-bar'),
  workspaceTabsPanel: document.getElementById('workspace-tabs-panel'),
  workspaceNewTabButton: document.getElementById('workspace-new-tab-button'),
  configurationSaveButton: document.getElementById('configuration-save-button'),
  configurationStorageStatus: document.getElementById('configuration-storage-status'),
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

function positiveModulo(value, divisor) {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || Math.abs(divisor) < EPS) {
    return 0;
  }

  return ((value % divisor) + divisor) % divisor;
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

function normalizeGridRotationDegrees(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return clamp(roundTo(number, 3), -180, 180);
}

function normalizeTrueCenter(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }

  return Boolean(fallback);
}

function getGridRotationDegrees() {
  return normalizeGridRotationDegrees(state.grid.rotationDegrees, DEFAULT_STATE.grid.rotationDegrees);
}

function isTrueCenterEnabled() {
  return normalizeTrueCenter(state.grid.trueCenter, DEFAULT_STATE.grid.trueCenter);
}

function usesTrueCenterOnXAxis() {
  return isTrueCenterEnabled() && state.grid.alignmentX === 'center';
}

function usesTrueCenterOnYAxis() {
  return isTrueCenterEnabled() && state.grid.alignmentY === 'center';
}

function usesTrueCenterNodeAlignment() {
  return usesTrueCenterOnXAxis() && usesTrueCenterOnYAxis();
}

function isGridRotated() {
  return Math.abs(getGridRotationDegrees()) > 0.0001;
}

function getCoordinateMode() {
  return 'absolute';
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

function normalizeLabelCallouts(callouts) {
  if (!callouts || typeof callouts !== 'object') {
    return {};
  }

  return Object.entries(callouts).reduce((result, [label, value]) => {
    const dx = Number(value?.dx);
    const dy = Number(value?.dy);
    if (label && Number.isFinite(dx) && Number.isFinite(dy)) {
      result[String(label)] = {
        dx: roundTo(dx, 6),
        dy: roundTo(dy, 6),
      };
    }
    return result;
  }, {});
}

function normalizeMeasurementEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const pointIds = Array.isArray(entry.pointIds)
    ? entry.pointIds.map(id => String(id)).filter(Boolean).slice(0, 2)
    : [];

  if (pointIds.length !== 2) {
    return null;
  }

  const pointDisplayIds = Array.isArray(entry.pointDisplayIds)
    ? entry.pointDisplayIds.map(id => String(id)).filter(Boolean).slice(0, 2)
    : pointIds;

  return {
    id: String(entry.id || `M${index + 1}`),
    pointIds,
    pointDisplayIds,
    distanceMeters: roundTo(Math.max(0, Number(entry.distanceMeters) || 0), 6),
  };
}

function getMeasurementConfigSnapshot() {
  return {
    room: {
      widthMeters: roundTo(state.room.widthMeters, 6),
      heightMeters: roundTo(state.room.heightMeters, 6),
    },
    grid: {
      panelWidthMeters: roundTo(getPanelWidthMeters(), 6),
      panelHeightMeters: roundTo(getPanelHeightMeters(), 6),
      alignmentX: normalizeAlignmentX(state.grid.alignmentX, DEFAULT_STATE.grid.alignmentX),
      alignmentY: normalizeAlignmentY(state.grid.alignmentY, DEFAULT_STATE.grid.alignmentY),
      trueCenter: isTrueCenterEnabled(),
      rotationDegrees: roundTo(getGridRotationDegrees(), 6),
    },
    obstacles: state.obstacles
      .map(obstacle => ({
        id: String(obstacle.id),
        x: roundTo(obstacle.x, 6),
        y: roundTo(obstacle.y, 6),
        widthMeters: roundTo(obstacle.widthMeters, 6),
        heightMeters: roundTo(obstacle.heightMeters, 6),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    combinedPanels: state.combinedPanels
      .map(panel => ({
        id: String(panel.id),
        cellIds: [...new Set(panel.cellIds.map(id => String(id)))].sort(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function normalizeMeasurementConfigSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const roomWidth = positiveNumber(snapshot.room?.widthMeters, NaN);
  const roomHeight = positiveNumber(snapshot.room?.heightMeters, NaN);
  const panelWidth = positiveNumber(snapshot.grid?.panelWidthMeters, NaN);
  const panelHeight = positiveNumber(snapshot.grid?.panelHeightMeters, NaN);
  if (!Number.isFinite(roomWidth) || !Number.isFinite(roomHeight) || !Number.isFinite(panelWidth) || !Number.isFinite(panelHeight)) {
    return null;
  }

  const obstacles = Array.isArray(snapshot.obstacles)
    ? snapshot.obstacles
      .map((obstacle, index) => ({
        id: String(obstacle?.id || `S${index + 1}`),
        x: roundTo(Number(obstacle?.x) || 0, 6),
        y: roundTo(Number(obstacle?.y) || 0, 6),
        widthMeters: roundTo(positiveNumber(obstacle?.widthMeters, panelWidth), 6),
        heightMeters: roundTo(positiveNumber(obstacle?.heightMeters, panelHeight), 6),
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
    : [];

  const combinedPanels = Array.isArray(snapshot.combinedPanels)
    ? snapshot.combinedPanels
      .map((panel, index) => ({
        id: String(panel?.id || `K${index + 1}`),
        cellIds: [...new Set(Array.isArray(panel?.cellIds) ? panel.cellIds.map(id => String(id)).filter(Boolean) : [])].sort(),
      }))
      .filter(panel => panel.cellIds.length >= 2)
      .sort((left, right) => left.id.localeCompare(right.id))
    : [];

  return {
    room: {
      widthMeters: roundTo(roomWidth, 6),
      heightMeters: roundTo(roomHeight, 6),
    },
    grid: {
      panelWidthMeters: roundTo(panelWidth, 6),
      panelHeightMeters: roundTo(panelHeight, 6),
      alignmentX: normalizeAlignmentX(snapshot.grid?.alignmentX, DEFAULT_STATE.grid.alignmentX),
      alignmentY: normalizeAlignmentY(snapshot.grid?.alignmentY, DEFAULT_STATE.grid.alignmentY),
      trueCenter: normalizeTrueCenter(snapshot.grid?.trueCenter, DEFAULT_STATE.grid.trueCenter),
      rotationDegrees: roundTo(normalizeGridRotationDegrees(snapshot.grid?.rotationDegrees, DEFAULT_STATE.grid.rotationDegrees), 6),
    },
    obstacles,
    combinedPanels,
  };
}

function getMeasurementConfigKeyFromSnapshot(snapshot) {
  return JSON.stringify(snapshot);
}

function formatMeasurementConfigSummary(snapshot) {
  if (!snapshot) {
    return '';
  }

  const parts = [
    `Raum ${formatMeters(snapshot.room.widthMeters)} × ${formatMeters(snapshot.room.heightMeters)} m`,
    `Paneel ${formatMeters(snapshot.grid.panelWidthMeters)} × ${formatMeters(snapshot.grid.panelHeightMeters)} m`,
    `Ausrichtung ${getGridAlignmentSummaryText(snapshot.grid.alignmentX, snapshot.grid.alignmentY, snapshot.grid.trueCenter)}`,
    `Winkel ${formatMeters(snapshot.grid.rotationDegrees, 1)}°`,
  ];

  if (snapshot.obstacles.length > 0) {
    parts.push(`Sperrflächen ${snapshot.obstacles.length}`);
  }
  if (snapshot.combinedPanels.length > 0) {
    parts.push(`Kombinierte Paneele ${snapshot.combinedPanels.length}`);
  }

  return parts.join(' • ');
}

function normalizeMeasurementCollection(collection, index = 0) {
  if (!collection || typeof collection !== 'object') {
    return null;
  }

  const configSnapshot = normalizeMeasurementConfigSnapshot(collection.configSnapshot);
  if (!configSnapshot) {
    return null;
  }

  return {
    id: String(collection.id || `MC${index + 1}`),
    configSnapshot,
    configKey: String(collection.configKey || getMeasurementConfigKeyFromSnapshot(configSnapshot)),
    label: String(collection.label || formatMeasurementConfigSummary(configSnapshot)),
    measurements: Array.isArray(collection.measurements)
      ? collection.measurements.map(normalizeMeasurementEntry).filter(Boolean)
      : [],
  };
}

function slugifyConfigurationName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/[_\s.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function getConfigurationSummaryFromConfig(config) {
  const roomWidth = positiveNumber(config?.room?.widthMeters, DEFAULT_STATE.room.widthMeters);
  const roomHeight = positiveNumber(config?.room?.heightMeters, DEFAULT_STATE.room.heightMeters);
  const panelWidth = positiveNumber(config?.grid?.panelWidthMeters, DEFAULT_STATE.grid.panelWidthMeters);
  const panelHeight = positiveNumber(config?.grid?.panelHeightMeters, DEFAULT_STATE.grid.panelHeightMeters);
  const alignmentX = normalizeAlignmentX(config?.grid?.alignmentX, DEFAULT_STATE.grid.alignmentX);
  const alignmentY = normalizeAlignmentY(config?.grid?.alignmentY, DEFAULT_STATE.grid.alignmentY);
  const trueCenter = normalizeTrueCenter(config?.grid?.trueCenter, DEFAULT_STATE.grid.trueCenter);
  const rotationDegrees = normalizeGridRotationDegrees(config?.grid?.rotationDegrees, DEFAULT_STATE.grid.rotationDegrees);
  const obstacles = Array.isArray(config?.obstacles) ? config.obstacles.length : 0;
  const combinedPanels = Array.isArray(config?.combinedPanels) ? config.combinedPanels.length : 0;
  const measurementCollections = Array.isArray(config?.measurementCollections) ? config.measurementCollections : [];
  const measurementEntryCount = measurementCollections.reduce((total, collection) => {
    return total + (Array.isArray(collection?.measurements) ? collection.measurements.length : 0);
  }, 0);
  const label = [
    `Raum ${formatMeters(roomWidth)} × ${formatMeters(roomHeight)} m`,
    `Paneel ${formatMeters(panelWidth)} × ${formatMeters(panelHeight)} m`,
    `Ausrichtung ${getGridAlignmentSummaryText(alignmentX, alignmentY, trueCenter)}`,
    `Winkel ${formatMeters(rotationDegrees, 1)}°`,
  ].join(' • ');

  return {
    label,
    roomLabel: `${formatMeters(roomWidth)} × ${formatMeters(roomHeight)} m`,
    panelLabel: `${formatMeters(panelWidth)} × ${formatMeters(panelHeight)} m`,
    alignmentLabel: getGridAlignmentSummaryText(alignmentX, alignmentY, trueCenter),
    rotationLabel: `${formatMeters(rotationDegrees, 1)}°`,
    obstacleCount: obstacles,
    combinedPanelCount: combinedPanels,
    measurementCollectionCount: measurementCollections.length,
    measurementEntryCount,
  };
}

function buildConfigurationArchivePayload(config = buildConfig(), options = {}) {
  const savedAt = options.savedAt || new Date().toISOString();
  const summary = getConfigurationSummaryFromConfig(config);
  const displayName = String(options.displayName || summary.label);

  return {
    kind: CONFIGURATION_ARCHIVE_KIND,
    version: CONFIGURATION_ARCHIVE_VERSION,
    savedAt,
    displayName,
    extension: '.akpconfig.json',
    summary,
    config,
  };
}

function getConfigFromArchivePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.kind === CONFIGURATION_ARCHIVE_KIND && payload.config && typeof payload.config === 'object') {
    return payload.config;
  }

  return payload;
}

function formatDateTimeLabel(value) {
  if (!value) {
    return 'ohne Zeitstempel';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function sanitizeConfigForWorkspace(config) {
  const snapshot = structuredCloneSafe(config || DEFAULT_STATE);
  delete snapshot.workspaceTabs;
  delete snapshot.activeWorkspaceTabId;
  return snapshot;
}

function nextWorkspaceTabId() {
  const used = new Set((workspaceState.tabs || []).map(tab => String(tab.id)));
  let index = Math.max(1, used.size + 1);
  while (used.has(`TAB${index}`)) {
    index += 1;
  }
  return `TAB${index}`;
}

function getWorkspaceDefaultTitle(index = (workspaceState.tabs?.length || 0) + 1) {
  return `Projekt ${index}`;
}

function normalizeWorkspaceTab(tab, index = 0) {
  if (!tab || typeof tab !== 'object' || !tab.config || typeof tab.config !== 'object') {
    return null;
  }

  return {
    id: String(tab.id || `TAB${index + 1}`),
    title: String(tab.title || getWorkspaceDefaultTitle(index + 1)),
    config: sanitizeConfigForWorkspace(tab.config),
  };
}

function getWorkspaceTabsFromConfig(config) {
  const tabs = Array.isArray(config?.workspaceTabs)
    ? config.workspaceTabs.map(normalizeWorkspaceTab).filter(Boolean)
    : [];

  if (tabs.length > 0) {
    return tabs;
  }

  return [{
    id: 'TAB1',
    title: getWorkspaceDefaultTitle(1),
    config: sanitizeConfigForWorkspace(config || DEFAULT_STATE),
  }];
}

function getActiveWorkspaceTab() {
  return (workspaceState.tabs || []).find(tab => tab.id === workspaceState.activeTabId) || workspaceState.tabs?.[0] || null;
}

function getActiveWorkspaceTabConfig() {
  return getActiveWorkspaceTab()?.config || sanitizeConfigForWorkspace(DEFAULT_STATE);
}

function initializeWorkspaceState(config) {
  const tabs = getWorkspaceTabsFromConfig(config);
  const requestedActiveTabId = String(config?.activeWorkspaceTabId || '');
  const activeTabId = tabs.some(tab => tab.id === requestedActiveTabId) ? requestedActiveTabId : tabs[0].id;
  workspaceState = {
    tabs,
    activeTabId,
    expandedTabId: activeTabId,
  };
  mergeState(getActiveWorkspaceTabConfig());
}

function syncCurrentStateIntoActiveWorkspaceTab(configSnapshot = null) {
  const activeTab = getActiveWorkspaceTab();
  if (!activeTab) {
    return;
  }

  activeTab.config = sanitizeConfigForWorkspace(configSnapshot || buildStandaloneConfig());
}

function buildConfigPayloadString() {
  return `${JSON.stringify(buildConfig(), null, 2)}\n`;
}

function persistWorkspaceKeepalive() {
  const payload = buildConfigPayloadString();
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json; charset=utf-8' });
      if (navigator.sendBeacon('/api/config', blob)) {
        return;
      }
    }
  } catch (error) {
    console.info('Workspace konnte nicht per sendBeacon gesichert werden.', error);
  }

  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(error => {
    console.info('Workspace konnte nicht per keepalive-Fetch gesichert werden.', error);
  });
}

function renderWorkspaceTabs() {
  if (!elements.workspaceTabsBar || !elements.workspaceTabsPanel) {
    return;
  }

  elements.workspaceTabsBar.innerHTML = '';
  elements.workspaceTabsPanel.innerHTML = '';
  (workspaceState.tabs || []).forEach((tab, index) => {
    const isActive = tab.id === workspaceState.activeTabId;
    const tabNode = document.createElement('div');
    tabNode.className = `workspace-tab-shell${isActive ? ' active' : ''}`;
    tabNode.setAttribute('data-workspace-tab-id', tab.id);
    const summary = getConfigurationSummaryFromConfig(tab.config);
    tabNode.innerHTML = `
      <button class="workspace-tab" type="button" aria-selected="${isActive ? 'true' : 'false'}">
        <span class="workspace-tab-index">${index + 1}</span>
        <span class="workspace-tab-text">
          <span class="workspace-tab-title">${escapeHtml(tab.title)}</span>
          <span class="workspace-tab-meta">${escapeHtml(summary.roomLabel)}</span>
        </span>
      </button>
      <button class="workspace-tab-delete" type="button" aria-label="Projekt ${escapeHtml(tab.title)} löschen">×</button>
    `;
    tabNode.querySelector('.workspace-tab')?.addEventListener('click', () => toggleWorkspaceTab(tab.id));
    tabNode.querySelector('.workspace-tab')?.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      renameWorkspaceTab(tab.id);
    });
    tabNode.querySelector('.workspace-tab-delete')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      deleteWorkspaceTab(tab.id);
    });
    elements.workspaceTabsBar.appendChild(tabNode);
  });

  const expandedTab = (workspaceState.tabs || []).find(tab => tab.id === workspaceState.expandedTabId);
  if (!expandedTab) {
    elements.workspaceTabsPanel.hidden = true;
    return;
  }

  const expandedSummary = getConfigurationSummaryFromConfig(expandedTab.config);
  const expandedIndex = Math.max(0, (workspaceState.tabs || []).findIndex(tab => tab.id === expandedTab.id));
  elements.workspaceTabsPanel.hidden = false;
  elements.workspaceTabsPanel.innerHTML = `
    <div class="workspace-tab-panel-head">
      <div>
        <p class="workspace-tab-panel-kicker">Projekt ${expandedIndex + 1}${expandedTab.id === workspaceState.activeTabId ? ' · aktiv' : ''}</p>
        <h3 class="workspace-tab-panel-title">${escapeHtml(expandedTab.title)}</h3>
        <p class="workspace-tab-panel-note">Doppelklick auf den Projekttitel oben benennt die Registerkarte um.</p>
      </div>
    </div>
    <dl class="workspace-tab-grid">
      <div><dt>Raum</dt><dd>${escapeHtml(expandedSummary.roomLabel)}</dd></div>
      <div><dt>Paneel</dt><dd>${escapeHtml(expandedSummary.panelLabel)}</dd></div>
      <div><dt>Ausrichtung</dt><dd>${escapeHtml(expandedSummary.alignmentLabel)}</dd></div>
      <div><dt>Rotation</dt><dd>${escapeHtml(expandedSummary.rotationLabel)}</dd></div>
      <div><dt>Messungen</dt><dd>${Number(expandedSummary.measurementEntryCount || 0)} in ${Number(expandedSummary.measurementCollectionCount || 0)} Tabelle(n)</dd></div>
      <div><dt>Sperrflächen</dt><dd>${Number(expandedSummary.obstacleCount || 0)}</dd></div>
      <div><dt>Kombiniert</dt><dd>${Number(expandedSummary.combinedPanelCount || 0)}</dd></div>
    </dl>
  `;
}

function updateConfigurationWorkspaceStatus(message = '') {
  if (!elements.configurationStorageStatus) {
    return;
  }

  if (message) {
    elements.configurationStorageStatus.textContent = message;
    return;
  }

  const activeTab = getActiveWorkspaceTab();
  if (!activeTab) {
    elements.configurationStorageStatus.textContent = 'Noch keine Registerkarte aktiv.';
    return;
  }

  elements.configurationStorageStatus.textContent = `Aktive Registerkarte: ${activeTab.title}`;
}

function toggleWorkspaceTab(tabId) {
  if (!tabId) {
    return;
  }

  if (workspaceState.activeTabId !== tabId) {
    activateWorkspaceTab(tabId, { expand: true });
    return;
  }

  workspaceState.expandedTabId = workspaceState.expandedTabId === tabId ? null : tabId;
  renderWorkspaceTabs();
  updateConfigurationWorkspaceStatus();
}

function activateWorkspaceTab(tabId, options = {}) {
  if (!tabId || workspaceState.activeTabId === tabId) {
    if (options.expand) {
      workspaceState.expandedTabId = tabId;
      renderWorkspaceTabs();
      updateConfigurationWorkspaceStatus();
    }
    return;
  }

  syncCurrentStateIntoActiveWorkspaceTab();
  workspaceState.activeTabId = tabId;
  workspaceState.expandedTabId = options.expand ? tabId : workspaceState.expandedTabId;
  mergeState(getActiveWorkspaceTabConfig());
  applyStateToInputs();
  updateAll();
  saveConfig();
  saveConfigDebounced();
}

function renameWorkspaceTab(tabId) {
  const targetTab = (workspaceState.tabs || []).find(tab => tab.id === tabId);
  if (!targetTab) {
    return;
  }

  const nextTitle = window.prompt('Neuer Name für das Projekt:', targetTab.title);
  if (nextTitle === null) {
    return;
  }

  const trimmedTitle = nextTitle.trim();
  if (!trimmedTitle) {
    return;
  }

  targetTab.title = trimmedTitle;
  renderWorkspaceTabs();
  updateConfigurationWorkspaceStatus(`Projekt umbenannt: ${trimmedTitle}`);
  saveConfigDebounced();
}

function deleteWorkspaceTab(tabId) {
  const targetTab = (workspaceState.tabs || []).find(tab => tab.id === tabId);
  if (!targetTab) {
    return;
  }

  const shouldDelete = window.confirm(`Projekt "${targetTab.title}" wirklich löschen?`);
  if (!shouldDelete) {
    return;
  }

  syncCurrentStateIntoActiveWorkspaceTab();
  const remainingTabs = (workspaceState.tabs || []).filter(tab => tab.id !== tabId);

  if (remainingTabs.length === 0) {
    const fallbackTab = createWorkspaceTabFromConfig(createBlankWorkspaceConfig(), {
      title: getWorkspaceDefaultTitle(1),
    });
    workspaceState.tabs = [fallbackTab];
    workspaceState.activeTabId = fallbackTab.id;
    workspaceState.expandedTabId = fallbackTab.id;
    mergeState(fallbackTab.config);
  } else {
    workspaceState.tabs = remainingTabs;
    if (workspaceState.activeTabId === tabId) {
      const nextActiveTab = remainingTabs[0];
      workspaceState.activeTabId = nextActiveTab.id;
      workspaceState.expandedTabId = nextActiveTab.id;
      mergeState(nextActiveTab.config);
      applyStateToInputs();
    } else if (workspaceState.expandedTabId === tabId) {
      workspaceState.expandedTabId = null;
    }
  }

  applyStateToInputs();
  updateAll();
  saveConfig();
  updateConfigurationWorkspaceStatus(`Projekt gelöscht: ${targetTab.title}`);
}

function createWorkspaceTabFromConfig(config, options = {}) {
  return {
    id: options.id || nextWorkspaceTabId(),
    title: String(options.title || getWorkspaceDefaultTitle()),
    config: sanitizeConfigForWorkspace(config),
  };
}

function createBlankWorkspaceConfig() {
  return sanitizeConfigForWorkspace(DEFAULT_STATE);
}

function ensureMeasurementCollections() {
  if (!Array.isArray(state.measurementCollections)) {
    state.measurementCollections = [];
  }
}

function getCurrentMeasurementConfigKey() {
  return getMeasurementConfigKeyFromSnapshot(getMeasurementConfigSnapshot());
}

function getMeasurementCollectionByKey(configKey) {
  ensureMeasurementCollections();
  return state.measurementCollections.find(collection => collection.configKey === configKey) || null;
}

function upsertCurrentMeasurementCollection() {
  ensureMeasurementCollections();
  const configSnapshot = getMeasurementConfigSnapshot();
  const configKey = getMeasurementConfigKeyFromSnapshot(configSnapshot);
  const existingIndex = state.measurementCollections.findIndex(collection => collection.configKey === configKey);

  if (!Array.isArray(state.measurements) || state.measurements.length === 0) {
    if (existingIndex >= 0) {
      state.measurementCollections.splice(existingIndex, 1);
    }
    activeMeasurementConfigKey = configKey;
    return;
  }

  const nextCollection = normalizeMeasurementCollection({
    id: getMeasurementCollectionByKey(configKey)?.id || `MC${state.measurementCollections.length + 1}`,
    configSnapshot,
    configKey,
    label: formatMeasurementConfigSummary(configSnapshot),
    measurements: state.measurements,
  }, state.measurementCollections.length);

  if (existingIndex >= 0) {
    state.measurementCollections.splice(existingIndex, 1, nextCollection);
  } else {
    state.measurementCollections = [nextCollection, ...state.measurementCollections];
  }

  activeMeasurementConfigKey = configKey;
}

function syncMeasurementsForCurrentConfig() {
  ensureMeasurementCollections();
  const configKey = getCurrentMeasurementConfigKey();
  const collection = getMeasurementCollectionByKey(configKey);
  state.measurements = collection ? collection.measurements.map(normalizeMeasurementEntry).filter(Boolean) : [];

  if (activeMeasurementConfigKey !== configKey) {
    measurementModeState.selectedPointIds = [];
    measurementModeState.previewMeasurementId = null;
    measurementModeState.editingMeasurementId = null;
    measurementModeState.editingMissingSlotIndex = null;
  }

  activeMeasurementConfigKey = configKey;
}

function isMeasurementCollectionCurrent(collection) {
  return Boolean(collection) && collection.configKey === getCurrentMeasurementConfigKey();
}

function showMeasurementCollectionMismatchMessage(collection) {
  const summary = collection?.label || formatMeasurementConfigSummary(collection?.configSnapshot);
  if (elements.measurementStatus) {
    elements.measurementStatus.textContent = `Diese Maßtabelle gehört zu einer anderen Konfiguration. Stelle links wieder ${summary} ein, um sie zu bearbeiten.`;
  }
}

function getManualLabelCalloutOffset(label) {
  const key = String(label || '');
  const value = state.labelCallouts?.[key];
  if (!value) {
    return null;
  }

  const dx = Number(value.dx);
  const dy = Number(value.dy);
  return Number.isFinite(dx) && Number.isFinite(dy) ? { dx, dy } : null;
}

function setManualLabelCalloutOffset(label, dx, dy) {
  const key = String(label || '');
  if (!key || !Number.isFinite(dx) || !Number.isFinite(dy)) {
    return;
  }

  if (!state.labelCallouts || typeof state.labelCallouts !== 'object') {
    state.labelCallouts = {};
  }

  state.labelCallouts[key] = {
    dx: roundTo(dx, 6),
    dy: roundTo(dy, 6),
  };
}

function clearManualLabelCalloutOffset(label) {
  const key = String(label || '');
  if (key && state.labelCallouts && Object.prototype.hasOwnProperty.call(state.labelCallouts, key)) {
    delete state.labelCallouts[key];
  }
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
  state.grid.trueCenter = normalizeTrueCenter(config.grid?.trueCenter, DEFAULT_STATE.grid.trueCenter);
  state.grid.rotationDegrees = normalizeGridRotationDegrees(config.grid?.rotationDegrees, DEFAULT_STATE.grid.rotationDegrees);
  state.grid.coordinateMode = 'absolute';
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

  const currentConfigSnapshot = normalizeMeasurementConfigSnapshot({
    room: {
      widthMeters: state.room.widthMeters,
      heightMeters: state.room.heightMeters,
    },
    grid: {
      panelWidthMeters: state.grid.panelWidthMeters,
      panelHeightMeters: state.grid.panelHeightMeters,
      alignmentX: state.grid.alignmentX,
      alignmentY: state.grid.alignmentY,
      trueCenter: state.grid.trueCenter,
      rotationDegrees: state.grid.rotationDegrees,
    },
    obstacles: state.obstacles,
    combinedPanels: state.combinedPanels,
  });

  if (Array.isArray(config.measurementCollections)) {
    state.measurementCollections = config.measurementCollections.map(normalizeMeasurementCollection).filter(Boolean);
  } else if (Array.isArray(config.measurements)) {
    state.measurementCollections = [{
      id: 'MC1',
      configSnapshot: currentConfigSnapshot,
      configKey: getMeasurementConfigKeyFromSnapshot(currentConfigSnapshot),
      label: formatMeasurementConfigSummary(currentConfigSnapshot),
      measurements: config.measurements.map(normalizeMeasurementEntry).filter(Boolean),
    }];
  } else {
    state.measurementCollections = [];
  }

  state.measurements = [];
  activeMeasurementConfigKey = null;

  state.measureFlags = config.measureFlags && typeof config.measureFlags === 'object' ? config.measureFlags : {};
  state.labelCallouts = normalizeLabelCallouts(config.labelCallouts);
}

function buildStandaloneConfig() {
  syncMeasurementsForCurrentConfig();
  upsertCurrentMeasurementCollection();
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    room: {
      widthMeters: roundTo(state.room.widthMeters),
      heightMeters: roundTo(state.room.heightMeters),
    },
    grid: {
      panelWidthMeters: roundTo(getPanelWidthMeters()),
      panelHeightMeters: roundTo(getPanelHeightMeters()),
      alignmentX: state.grid.alignmentX,
      alignmentY: state.grid.alignmentY,
      trueCenter: isTrueCenterEnabled(),
      rotationDegrees: roundTo(getGridRotationDegrees()),
      coordinateMode: getCoordinateMode(),
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
    measurementCollections: state.measurementCollections.map((collection, collectionIndex) => ({
      id: String(collection.id || `MC${collectionIndex + 1}`),
      configKey: collection.configKey,
      label: String(collection.label || formatMeasurementConfigSummary(collection.configSnapshot)),
      configSnapshot: normalizeMeasurementConfigSnapshot(collection.configSnapshot),
      measurements: collection.measurements.map((entry, index) => ({
        id: String(entry.id || `M${index + 1}`),
        pointIds: [...entry.pointIds],
        pointDisplayIds: [...(entry.pointDisplayIds || entry.pointIds)],
        distanceMeters: roundTo(entry.distanceMeters, 6),
      })),
    })),
    measurements: state.measurements.map((entry, index) => ({
      id: String(entry.id || `M${index + 1}`),
      pointIds: [...entry.pointIds],
      pointDisplayIds: [...(entry.pointDisplayIds || entry.pointIds)],
      distanceMeters: roundTo(entry.distanceMeters, 6),
    })),
    measureFlags: state.measureFlags,
    labelCallouts: normalizeLabelCallouts(state.labelCallouts),
  };
}

function buildConfig() {
  const activeConfig = buildStandaloneConfig();
  syncCurrentStateIntoActiveWorkspaceTab(activeConfig);
  return {
    ...activeConfig,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    activeWorkspaceTabId: workspaceState.activeTabId,
    workspaceTabs: (workspaceState.tabs || []).map(tab => ({
      id: String(tab.id),
      title: String(tab.title),
      config: sanitizeConfigForWorkspace(tab.id === workspaceState.activeTabId ? activeConfig : tab.config),
    })),
  };
}

async function loadConfig() {
  try {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    initializeWorkspaceState(await response.json());
  } catch (error) {
    console.warn('Konfiguration konnte nicht geladen werden. Standardwerte werden verwendet.', error);
    initializeWorkspaceState(DEFAULT_STATE);
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

async function refreshConfigurationStorageList(options = {}) {
  renderWorkspaceTabs();
  updateConfigurationWorkspaceStatus(options.message);
}

function saveConfigDebounced() {
  clearTimeout(saveTimer);
  syncCurrentStateIntoActiveWorkspaceTab();
  saveTimer = window.setTimeout(saveConfig, 350);
}

function applyStateToInputs() {
  elements.widthInput.value = formatMeters(state.room.widthMeters);
  elements.heightInput.value = formatMeters(state.room.heightMeters);
  elements.panelWidthInput.value = formatMeters(getPanelWidthMeters());
  elements.panelHeightInput.value = formatMeters(getPanelHeightMeters());
  if (elements.gridAngleInput) {
    elements.gridAngleInput.value = formatMeters(getGridRotationDegrees());
  }
  if (elements.trueCenterCheckbox) {
    elements.trueCenterCheckbox.checked = isTrueCenterEnabled();
  }
  if (elements.originCornerSelect) {
    elements.originCornerSelect.value = state.originCorner;
  }
  renderObstacleControls();
}

async function saveCurrentConfigurationToStorage() {
  syncCurrentStateIntoActiveWorkspaceTab();
  const currentConfig = buildStandaloneConfig();
  const activeTab = getActiveWorkspaceTab();
  const defaultName = activeTab?.title ? `${activeTab.title} Kopie` : getConfigurationSummaryFromConfig(currentConfig).label;
  const input = window.prompt('Name für die neue Registerkarte:', defaultName);
  if (input === null) {
    updateConfigurationWorkspaceStatus('Speichern der Registerkarte abgebrochen.');
    return false;
  }
  const nextTab = createWorkspaceTabFromConfig(currentConfig, {
    title: input.trim() || defaultName,
  });
  workspaceState.tabs = [...workspaceState.tabs, nextTab];
  workspaceState.activeTabId = nextTab.id;
  workspaceState.expandedTabId = nextTab.id;
  await saveConfig();
  applyStateToInputs();
  updateAll();
  await refreshConfigurationStorageList({
    message: `Neue Registerkarte gespeichert: ${nextTab.title}`,
  });
  return true;
}

async function createNewWorkspaceTab() {
  syncCurrentStateIntoActiveWorkspaceTab();
  const nextTab = createWorkspaceTabFromConfig(createBlankWorkspaceConfig(), {
    title: getWorkspaceDefaultTitle((workspaceState.tabs?.length || 0) + 1),
  });
  workspaceState.tabs = [...workspaceState.tabs, nextTab];
  workspaceState.activeTabId = nextTab.id;
  workspaceState.expandedTabId = nextTab.id;
  mergeState(nextTab.config);
  applyStateToInputs();
  updateAll();
  await saveConfig();
  await refreshConfigurationStorageList({
    message: `Neue leere Registerkarte erstellt: ${nextTab.title}`,
  });
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
  if (usesTrueCenterOnXAxis()) {
    return Math.max(0, Math.floor(((state.room.widthMeters / 2) + EPS) / getPanelWidthMeters()) * 2);
  }

  return Math.max(0, Math.floor((state.room.widthMeters + EPS) / getPanelWidthMeters()));
}

function getGridRows() {
  if (usesTrueCenterOnYAxis()) {
    return Math.max(0, Math.floor(((state.room.heightMeters / 2) + EPS) / getPanelHeightMeters()) * 2);
  }

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

  if (usesTrueCenterOnXAxis()) {
    return (state.room.widthMeters / 2) - (gridWidth / 2);
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

  if (usesTrueCenterOnYAxis()) {
    return (state.room.heightMeters / 2) - (gridHeight / 2);
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

function getRoomCenterPoint() {
  return {
    x: state.room.widthMeters / 2,
    y: state.room.heightMeters / 2,
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

function getOriginCornerPoint(corner = state.originCorner) {
  const roomWidth = state.room.widthMeters;
  const roomHeight = state.room.heightMeters;
  return {
    'top-left': { x: 0, y: 0 },
    'top-right': { x: roomWidth, y: 0 },
    'bottom-left': { x: 0, y: roomHeight },
    'bottom-right': { x: roomWidth, y: roomHeight },
  }[normalizeOriginCorner(corner, state.originCorner)] || { x: 0, y: 0 };
}

function getCornerBaseAxes(corner = state.originCorner) {
  return {
    'top-left': { xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, xDir: 1, yDir: 1 },
    'top-right': { xAxis: { x: -1, y: 0 }, yAxis: { x: 0, y: 1 }, xDir: -1, yDir: 1 },
    'bottom-left': { xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: -1 }, xDir: 1, yDir: -1 },
    'bottom-right': { xAxis: { x: -1, y: 0 }, yAxis: { x: 0, y: -1 }, xDir: -1, yDir: -1 },
  }[normalizeOriginCorner(corner, state.originCorner)] || { xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, xDir: 1, yDir: 1 };
}

function rotateVector(vector, degrees) {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

function getRotatedGridCellsForBasis(basis) {
  const panelWidth = getPanelWidthMeters();
  const panelHeight = getPanelHeightMeters();
  const projections = getRoomCorners().map(point => pointToBasisCoordinates(point, basis));
  const minX = Math.min(...projections.map(point => point.x));
  const maxX = Math.max(...projections.map(point => point.x));
  const minY = Math.min(...projections.map(point => point.y));
  const maxY = Math.max(...projections.map(point => point.y));
  const colMin = Math.floor(minX / panelWidth) - 2;
  const colMax = Math.ceil(maxX / panelWidth) + 2;
  const rowMin = Math.floor(minY / panelHeight) - 2;
  const rowMax = Math.ceil(maxY / panelHeight) + 2;
  const cells = [];

  for (let row = rowMin; row < rowMax; row += 1) {
    for (let col = colMin; col < colMax; col += 1) {
      const cell = createRotatedGridCell(row, col, basis, panelWidth, panelHeight);
      if (getPolygonArea(cell.roomPolygon) > EPS) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

function getRotatedGridVisibleCornerBounds(basis) {
  const cells = getRotatedGridCellsForBasis(basis);
  const fullPanelCornerPoints = [];
  const fallbackVisibleCornerPoints = [];
  const addUniquePoint = (points, point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }

    const rounded = { x: roundTo(point.x, 6), y: roundTo(point.y, 6) };
    const exists = points.some(existing => Math.abs(existing.x - rounded.x) <= EPS && Math.abs(existing.y - rounded.y) <= EPS);
    if (!exists) {
      points.push(rounded);
    }
  };

  cells.forEach(cell => {
    if (polygonInsideRoom(cell.polygon)) {
      (cell.polygon || []).forEach(point => addUniquePoint(fullPanelCornerPoints, point));
      return;
    }

    (cell.polygon || []).forEach(point => {
      if (pointInsideRect(point.x, point.y, getRoomRect())) {
        addUniquePoint(fallbackVisibleCornerPoints, point);
      }
    });
  });

  const anchorPoints = fullPanelCornerPoints.length > 0
    ? fullPanelCornerPoints
    : fallbackVisibleCornerPoints;
  const finiteMin = values => values.length > 0 ? Math.min(...values) : null;
  const finiteMax = values => values.length > 0 ? Math.max(...values) : null;
  const xs = anchorPoints.map(point => point.x);
  const ys = anchorPoints.map(point => point.y);
  const minX = finiteMin(xs);
  const maxX = finiteMax(xs);
  const minY = finiteMin(ys);
  const maxY = finiteMax(ys);

  if ([minX, maxX, minY, maxY].some(value => value === null)) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    leftAnchorX: minX,
    rightAnchorX: maxX,
    topAnchorY: minY,
    bottomAnchorY: maxY,
    width: maxX - minX,
    height: maxY - minY,
    pointCount: anchorPoints.length,
    fullPanelCornerCount: fullPanelCornerPoints.length,
    fallbackVisibleCornerCount: fallbackVisibleCornerPoints.length,
    horizontalCandidateCount: anchorPoints.length,
    verticalCandidateCount: anchorPoints.length,
  };
}

function getRotatedGridWorldAlignmentShift(bounds) {
  if (!bounds) {
    return { x: 0, y: 0 };
  }

  let x = 0;
  let y = 0;

  if (state.grid.alignmentX === 'left') {
    x = -bounds.minX;
  } else if (state.grid.alignmentX === 'right') {
    x = state.room.widthMeters - bounds.maxX;
  } else {
    x = (state.room.widthMeters - bounds.minX - bounds.maxX) / 2;
  }

  if (state.grid.alignmentY === 'top') {
    y = -bounds.minY;
  } else if (state.grid.alignmentY === 'bottom') {
    y = state.room.heightMeters - bounds.maxY;
  } else {
    y = (state.room.heightMeters - bounds.minY - bounds.maxY) / 2;
  }

  return { x: cleanNumber(x), y: cleanNumber(y) };
}

function getAlignedRotatedGridOrigin(origin, xAxis, yAxis, angle) {
  if (!isGridRotated()) {
    return origin;
  }

  let alignedOrigin = { ...origin };

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const basis = { origin: alignedOrigin, xAxis, yAxis, angle };
    const bounds = getRotatedGridVisibleCornerBounds(basis);
    const shift = getRotatedGridWorldAlignmentShift(bounds);

    if (Math.abs(shift.x) <= EPS && Math.abs(shift.y) <= EPS) {
      break;
    }

    alignedOrigin = {
      x: alignedOrigin.x + shift.x,
      y: alignedOrigin.y + shift.y,
    };
  }

  return alignedOrigin;
}

function getGridBasis() {
  if (isGridRotated() && usesTrueCenterNodeAlignment()) {
    const base = getCornerBaseAxes();
    const angle = getGridRotationDegrees();
    return {
      origin: {
        x: state.room.widthMeters / 2,
        y: state.room.heightMeters / 2,
      },
      baseOrigin: getOriginCornerPoint(),
      xAxis: rotateVector(base.xAxis, angle),
      yAxis: rotateVector(base.yAxis, angle),
      angle,
    };
  }

  const baseOrigin = getOriginCornerPoint();
  const base = getCornerBaseAxes();
  const angle = getGridRotationDegrees();
  const xAxis = rotateVector(base.xAxis, angle);
  const yAxis = rotateVector(base.yAxis, angle);
  const origin = getAlignedRotatedGridOrigin(baseOrigin, xAxis, yAxis, angle);

  return {
    origin,
    baseOrigin,
    xAxis,
    yAxis,
    angle,
  };
}

function getCoordinateBasis() {
  const base = getCornerBaseAxes();

  return {
    origin: getOriginCornerPoint(),
    xAxis: base.xAxis,
    yAxis: base.yAxis,
    xDir: base.xDir,
    yDir: base.yDir,
    angle: 0,
  };
}

function pointFromBasisCoordinates(x, y, basis = getCoordinateBasis()) {
  return {
    x: basis.origin.x + x * basis.xAxis.x + y * basis.yAxis.x,
    y: basis.origin.y + x * basis.xAxis.y + y * basis.yAxis.y,
  };
}

function pointToBasisCoordinates(point, basis = getCoordinateBasis()) {
  const vx = point.x - basis.origin.x;
  const vy = point.y - basis.origin.y;
  return {
    x: vx * basis.xAxis.x + vy * basis.xAxis.y,
    y: vx * basis.yAxis.x + vy * basis.yAxis.y,
  };
}

function getRoomCorners() {
  return [
    { x: 0, y: 0 },
    { x: state.room.widthMeters, y: 0 },
    { x: state.room.widthMeters, y: state.room.heightMeters },
    { x: 0, y: state.room.heightMeters },
  ];
}

function getTrueCenterGuideGeometry() {
  const room = getRoomRect();
  const center = getRoomCenterPoint();
  const points = [
    { id: 'corner-top-left', x: room.x, y: room.y },
    { id: 'corner-top-right', x: rectRight(room), y: room.y },
    { id: 'corner-bottom-left', x: room.x, y: rectBottom(room) },
    { id: 'corner-bottom-right', x: rectRight(room), y: rectBottom(room) },
    { id: 'mid-top', x: center.x, y: room.y },
    { id: 'mid-right', x: rectRight(room), y: center.y },
    { id: 'mid-bottom', x: center.x, y: rectBottom(room) },
    { id: 'mid-left', x: room.x, y: center.y },
    { id: 'center', x: center.x, y: center.y },
  ];
  const pointMap = new Map(points.map(point => [point.id, point]));
  const lines = [
    { id: 'diag-main', startId: 'corner-top-left', endId: 'corner-bottom-right' },
    { id: 'diag-counter', startId: 'corner-top-right', endId: 'corner-bottom-left' },
    { id: 'axis-horizontal', startId: 'mid-left', endId: 'mid-right' },
    { id: 'axis-vertical', startId: 'mid-top', endId: 'mid-bottom' },
  ];

  return { points, pointMap, lines };
}

function getTrueCenterGuideSelectablePoints() {
  return getTrueCenterGuideGeometry().points.filter(point => point.id.startsWith('mid-') || point.id === 'center');
}

function getRectCornerPoints(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rectRight(rect), y: rect.y },
    { x: rectRight(rect), y: rectBottom(rect) },
    { x: rect.x, y: rectBottom(rect) },
  ];
}

function addMeasurementPoint(pointMap, x, y, source = null) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }

  const roundedX = roundTo(x, 6);
  const roundedY = roundTo(y, 6);
  const id = `pt:${roundedX},${roundedY}`;

  if (!pointMap.has(id)) {
    pointMap.set(id, {
      id,
      x: roundedX,
      y: roundedY,
      sources: [],
    });
  }

  if (source) {
    pointMap.get(id).sources.push(source);
  }
}

function addMeasurementPointsFromPolygon(pointMap, polygon, source = null) {
  (polygon || []).forEach(point => addMeasurementPoint(pointMap, point.x, point.y, source));
}

function addMeasurementPointsFromRect(pointMap, rect, source = null) {
  getRectCornerPoints(rect).forEach(point => addMeasurementPoint(pointMap, point.x, point.y, source));
}

function addMeasurementPointsFromAtoms(pointMap, atoms, source = null) {
  getBoundaryEdges(atoms || []).forEach(edge => {
    addMeasurementPoint(pointMap, edge.x1, edge.y1, source);
    addMeasurementPoint(pointMap, edge.x2, edge.y2, source);
  });
}

function getMeasurementPoints(plan = latestPlan || calculatePlan()) {
  const pointMap = new Map();

  getRoomCorners().forEach(point => addMeasurementPoint(pointMap, point.x, point.y, { kind: 'room-corner' }));

  (plan.fullPanelCells || []).forEach(cell => {
    if (cell.isRotated) {
      addMeasurementPointsFromPolygon(pointMap, cell.polygon, { kind: 'full-panel', sourceId: cell.id });
    } else {
      addMeasurementPointsFromRect(pointMap, cell, { kind: 'full-panel', sourceId: cell.id });
    }
  });

  (plan.cutPieces || []).forEach(piece => {
    if (Array.isArray(piece.polygons) && piece.polygons.length > 0) {
      piece.polygons.forEach(polygon => addMeasurementPointsFromPolygon(pointMap, polygon, { kind: 'cut-piece', sourceId: piece.id || piece.groupId }));
    } else {
      addMeasurementPointsFromAtoms(pointMap, piece.atoms, { kind: 'cut-piece', sourceId: piece.id || piece.groupId });
    }
  });

  (plan.combinedPieces || []).forEach(piece => {
    if (Array.isArray(piece.polygons) && piece.polygons.length > 0) {
      piece.polygons.forEach(polygon => addMeasurementPointsFromPolygon(pointMap, polygon, { kind: 'combined-piece', sourceId: piece.id || piece.groupId }));
    } else {
      addMeasurementPointsFromAtoms(pointMap, piece.atoms, { kind: 'combined-piece', sourceId: piece.id || piece.groupId });
    }
  });

  (plan.combinedCutPieces || []).forEach(piece => {
    if (Array.isArray(piece.polygons) && piece.polygons.length > 0) {
      piece.polygons.forEach(polygon => addMeasurementPointsFromPolygon(pointMap, polygon, { kind: 'combined-cut-piece', sourceId: piece.id || piece.groupId }));
    } else {
      addMeasurementPointsFromAtoms(pointMap, piece.atoms, { kind: 'combined-cut-piece', sourceId: piece.id || piece.groupId });
    }
  });

  (plan.obstacleRects || []).forEach(obstacle => {
    addMeasurementPointsFromRect(pointMap, obstacle, { kind: 'obstacle', sourceId: obstacle.id });
  });

  const regularPoints = [...pointMap.values()]
    .sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.id.localeCompare(b.id));

  const combinedPoints = [...regularPoints];
  if (isTrueCenterEnabled()) {
    getTrueCenterGuideSelectablePoints().forEach(point => {
      combinedPoints.push({
        id: `guide:${point.id}`,
        x: roundTo(point.x, 6),
        y: roundTo(point.y, 6),
        sources: [{ kind: 'true-center-guide', pointId: point.id }],
        pointType: 'geometry',
        geometryGuideId: point.id,
      });
    });
  }

  return combinedPoints
    .sort((a, b) => {
      const pointTypeGap = Number(isGeometryMeasurementPoint(b)) - Number(isGeometryMeasurementPoint(a));
      return (a.y - b.y) || (a.x - b.x) || pointTypeGap || a.id.localeCompare(b.id);
    })
    .map((point, index) => ({
      ...point,
      displayId: `P${index + 1}`,
    }));
}

function getMeasurementPointSelection(plan = latestPlan || calculatePlan()) {
  const points = getMeasurementPoints(plan);
  const pointMap = new Map(points.map(point => [point.id, point]));
  const selectedPoints = (measurementModeState.selectedPointIds || [])
    .map(id => pointMap.get(id))
    .filter(Boolean);

  return { points, pointMap, selectedPoints };
}

function getMeasurementDistanceMeters(pointA, pointB) {
  return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

function isEditingMeasurement() {
  return Boolean(measurementModeState.editingMeasurementId);
}

function isGeometryMeasurementPoint(point) {
  return point?.pointType === 'geometry';
}

function selectMeasurementPointById(pointId) {
  const currentIds = measurementModeState.selectedPointIds || [];
  let nextIds;

  if (currentIds.length === 0) {
    nextIds = [pointId];
  } else if (currentIds.length === 1 && currentIds[0] !== pointId) {
    if (isEditingMeasurement() && measurementModeState.editingMissingSlotIndex === 0) {
      nextIds = [pointId, currentIds[0]];
    } else {
      nextIds = [currentIds[0], pointId];
    }
  } else {
    nextIds = [pointId];
  }

  measurementModeState.previewMeasurementId = null;
  if (currentIds.length !== 1 || currentIds[0] !== pointId) {
    measurementModeState.editingMissingSlotIndex = null;
  }
  measurementModeState.selectedPointIds = nextIds;
  updateMeasurementModeButton();
  renderSvg(latestPlan || calculatePlan());
}

function getMeasurementPointVisualRadius(point, radius, geometryHalfSize) {
  if (isGeometryMeasurementPoint(point)) {
    return Math.max(radius * 0.92, geometryHalfSize * 0.92);
  }

  return radius;
}

function getMeasurementPointOverlapMap(points, radius, geometryHalfSize) {
  const pointById = new Map(points.map(point => [point.id, point]));
  const adjacency = new Map(points.map(point => [point.id, new Set([point.id])]));

  for (let index = 0; index < points.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < points.length; otherIndex += 1) {
      const point = points[index];
      const other = points[otherIndex];
      const distance = getMeasurementDistanceMeters(point, other);
      const limit = getMeasurementPointVisualRadius(point, radius, geometryHalfSize)
        + getMeasurementPointVisualRadius(other, radius, geometryHalfSize);

      if (distance > limit) {
        continue;
      }

      adjacency.get(point.id)?.add(other.id);
      adjacency.get(other.id)?.add(point.id);
    }
  }

  const overlapMap = new Map();
  const visited = new Set();

  points.forEach(point => {
    if (visited.has(point.id)) {
      return;
    }

    const queue = [point.id];
    const clusterIds = [];
    visited.add(point.id);

    while (queue.length > 0) {
      const currentId = queue.shift();
      clusterIds.push(currentId);
      (adjacency.get(currentId) || []).forEach(nextId => {
        if (visited.has(nextId)) {
          return;
        }
        visited.add(nextId);
        queue.push(nextId);
      });
    }

    if (clusterIds.length <= 1) {
      return;
    }

    const cluster = clusterIds
      .map(id => pointById.get(id))
      .filter(Boolean)
      .sort((left, right) => {
        const typeGap = Number(isGeometryMeasurementPoint(right)) - Number(isGeometryMeasurementPoint(left));
        return typeGap || left.displayId.localeCompare(right.displayId, undefined, { numeric: true });
      });

    cluster.forEach(candidate => {
      overlapMap.set(candidate.id, cluster);
    });
  });

  return overlapMap;
}

function hideMeasurementPointPicker() {
  if (!elements.measurementPointPicker) {
    return;
  }

  elements.measurementPointPicker.hidden = true;
  elements.measurementPointPicker.innerHTML = '';
}

function showMeasurementPointPicker(points, anchorClientX, anchorClientY) {
  const picker = elements.measurementPointPicker;
  const frame = elements.svgFrame;
  if (!picker || !frame || !Array.isArray(points) || points.length <= 1) {
    hideMeasurementPointPicker();
    return;
  }

  picker.innerHTML = '';
  points.forEach(point => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'measurement-point-picker-item';
    button.setAttribute('data-measurement-picker-item', point.id);
    button.setAttribute('aria-label', `Messpunkt ${point.displayId} wählen`);

    const icon = document.createElement('span');
    icon.className = `measurement-point-picker-icon ${isGeometryMeasurementPoint(point) ? 'geometry' : 'regular'}`;
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'measurement-point-picker-label';
    label.textContent = point.displayId;

    button.append(icon, label);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      hideMeasurementPointPicker();
      selectMeasurementPointById(point.id);
    });
    picker.appendChild(button);
  });

  picker.hidden = false;
  const frameRect = frame.getBoundingClientRect();
  const maxLeft = Math.max(12, frame.clientWidth - picker.offsetWidth - 12);
  const maxTop = Math.max(12, frame.clientHeight - picker.offsetHeight - 12);
  const relativeX = anchorClientX - frameRect.left + frame.scrollLeft;
  const relativeY = anchorClientY - frameRect.top + frame.scrollTop;
  picker.style.left = `${Math.min(Math.max(12, relativeX + 14), maxLeft + frame.scrollLeft)}px`;
  picker.style.top = `${Math.min(Math.max(12, relativeY + 14), maxTop + frame.scrollTop)}px`;
}

function nextMeasurementEntryId() {
  const used = new Set(state.measurements.map(entry => entry.id));
  let index = state.measurements.length + 1;

  while (used.has(`M${index}`)) {
    index += 1;
  }

  return `M${index}`;
}

function getSavedMeasurementEntryById(entryId) {
  return state.measurements.find(entry => entry.id === entryId) || null;
}

function getMeasurementCollectionsForDisplay() {
  ensureMeasurementCollections();
  const currentKey = getCurrentMeasurementConfigKey();

  return [...state.measurementCollections].sort((left, right) => {
    if (left.configKey === currentKey && right.configKey !== currentKey) {
      return -1;
    }
    if (left.configKey !== currentKey && right.configKey === currentKey) {
      return 1;
    }
    return String(left.id).localeCompare(String(right.id));
  });
}

function getRoomPolygon() {
  return getRoomCorners();
}

function getRectPolygon(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rectRight(rect), y: rect.y },
    { x: rectRight(rect), y: rectBottom(rect) },
    { x: rect.x, y: rectBottom(rect) },
  ];
}

function getPolygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function getSignedPolygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function getPolygonCentroid(points) {
  const area = getSignedPolygonArea(points);
  if (Math.abs(area) <= EPS) {
    const bounds = getPolygonBounds(points);
    return rectCenter(bounds);
  }

  let cx = 0;
  let cy = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    cx += (current.x + next.x) * cross;
    cy += (current.y + next.y) * cross;
  }

  const factor = 1 / (6 * area);
  return { x: cx * factor, y: cy * factor };
}

function getPolygonBounds(points) {
  const validPoints = Array.isArray(points) ? points : [];
  if (validPoints.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...validPoints.map(point => point.x));
  const minY = Math.min(...validPoints.map(point => point.y));
  const maxX = Math.max(...validPoints.map(point => point.x));
  const maxY = Math.max(...validPoints.map(point => point.y));
  return {
    x: roundTo(minX, 6),
    y: roundTo(minY, 6),
    width: roundTo(maxX - minX, 6),
    height: roundTo(maxY - minY, 6),
  };
}

function getPolygonsBounds(polygons) {
  const points = polygons.flatMap(poly => poly || []);
  return getPolygonBounds(points);
}

function cleanPolygon(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  const cleaned = [];
  points.forEach(point => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }
    const rounded = { x: roundTo(point.x, 6), y: roundTo(point.y, 6) };
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.abs(previous.x - rounded.x) > EPS || Math.abs(previous.y - rounded.y) > EPS) {
      cleaned.push(rounded);
    }
  });

  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.abs(first.x - last.x) <= EPS && Math.abs(first.y - last.y) <= EPS) {
      cleaned.pop();
    }
  }

  return getPolygonArea(cleaned) > EPS ? cleaned : [];
}

function clipPolygonByHalfPlane(points, isInside, intersect) {
  const polygon = cleanPolygon(points);
  if (polygon.length === 0) {
    return [];
  }

  const output = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = isInside(current);
    const previousInside = isInside(previous);

    if (currentInside) {
      if (!previousInside) {
        output.push(intersect(previous, current));
      }
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }

  return cleanPolygon(output);
}

function clipPolygonToRect(points, rect) {
  let polygon = cleanPolygon(points);
  if (polygon.length === 0) {
    return [];
  }

  const xMin = rect.x;
  const xMax = rectRight(rect);
  const yMin = rect.y;
  const yMax = rectBottom(rect);

  const interpolateX = (a, b, x) => {
    const t = Math.abs(b.x - a.x) <= EPS ? 0 : (x - a.x) / (b.x - a.x);
    return { x, y: a.y + (b.y - a.y) * t };
  };
  const interpolateY = (a, b, y) => {
    const t = Math.abs(b.y - a.y) <= EPS ? 0 : (y - a.y) / (b.y - a.y);
    return { x: a.x + (b.x - a.x) * t, y };
  };

  polygon = clipPolygonByHalfPlane(polygon, point => point.x >= xMin - EPS, (a, b) => interpolateX(a, b, xMin));
  polygon = clipPolygonByHalfPlane(polygon, point => point.x <= xMax + EPS, (a, b) => interpolateX(a, b, xMax));
  polygon = clipPolygonByHalfPlane(polygon, point => point.y >= yMin - EPS, (a, b) => interpolateY(a, b, yMin));
  polygon = clipPolygonByHalfPlane(polygon, point => point.y <= yMax + EPS, (a, b) => interpolateY(a, b, yMax));

  return cleanPolygon(polygon);
}

function clipPolygonToBand(points, rect) {
  let polygon = cleanPolygon(points);
  if (polygon.length === 0) {
    return [];
  }
  return clipPolygonToRect(polygon, rect);
}

function subtractRectFromPolygon(points, rect) {
  const source = cleanPolygon(points);
  if (source.length === 0) {
    return [];
  }

  if (getPolygonArea(clipPolygonToRect(source, rect)) <= EPS) {
    return [source];
  }

  const roomWide = Math.max(state.room.widthMeters, state.room.heightMeters, getPanelWidthMeters(), getPanelHeightMeters()) * 4 + 10;
  const sourceBounds = getPolygonBounds(source);
  const minX = Math.min(sourceBounds.x, 0) - roomWide;
  const minY = Math.min(sourceBounds.y, 0) - roomWide;
  const maxX = Math.max(rectRight(sourceBounds), state.room.widthMeters) + roomWide;
  const maxY = Math.max(rectBottom(sourceBounds), state.room.heightMeters) + roomWide;

  const bands = [
    { x: minX, y: minY, width: rect.x - minX, height: maxY - minY },
    { x: rectRight(rect), y: minY, width: maxX - rectRight(rect), height: maxY - minY },
    { x: rect.x, y: minY, width: rect.width, height: rect.y - minY },
    { x: rect.x, y: rectBottom(rect), width: rect.width, height: maxY - rectBottom(rect) },
  ].filter(band => band.width > EPS && band.height > EPS);

  return bands
    .map(band => clipPolygonToBand(source, band))
    .filter(poly => getPolygonArea(poly) > EPS);
}

function subtractObstaclesFromPolygon(points, obstacleRects) {
  let polygons = [cleanPolygon(points)].filter(poly => poly.length >= 3);

  obstacleRects.forEach(obstacle => {
    polygons = polygons.flatMap(poly => subtractRectFromPolygon(poly, obstacle));
  });

  return polygons.filter(poly => getPolygonArea(poly) > EPS);
}

function polygonIntersectsRect(points, rect) {
  return getPolygonArea(clipPolygonToRect(points, rect)) > EPS;
}

function polygonInsideRoom(points) {
  return cleanPolygon(points).every(point => pointInsideRect(point.x, point.y, getRoomRect()));
}

function polygonToPathData(points, transform = (x, y) => ({ x, y })) {
  const polygon = cleanPolygon(points);
  if (polygon.length < 3) {
    return '';
  }

  return polygon.map((point, index) => {
    const transformed = transform(point.x, point.y);
    return `${index === 0 ? 'M' : 'L'} ${roundTo(transformed.x, 6)} ${roundTo(transformed.y, 6)}`;
  }).join(' ') + ' Z';
}

function getPolygonsPathData(polygons, transform = (x, y) => ({ x, y })) {
  return (polygons || [])
    .map(points => polygonToPathData(points, transform))
    .filter(Boolean)
    .join(' ');
}

function pointOnSegment(point, a, b) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > EPS) {
    return false;
  }

  const minX = Math.min(a.x, b.x) - EPS;
  const maxX = Math.max(a.x, b.x) + EPS;
  const minY = Math.min(a.y, b.y) - EPS;
  const maxY = Math.max(a.y, b.y) + EPS;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function getPolygonEdgeOverlapLength(edgeA, edgeB) {
  const ax = edgeA.x2 - edgeA.x1;
  const ay = edgeA.y2 - edgeA.y1;
  const bx = edgeB.x2 - edgeB.x1;
  const by = edgeB.y2 - edgeB.y1;
  const lengthA = Math.hypot(ax, ay);
  const lengthB = Math.hypot(bx, by);

  if (lengthA <= EPS || lengthB <= EPS) {
    return 0;
  }

  const cross = ax * by - ay * bx;
  if (Math.abs(cross) > EPS) {
    return 0;
  }

  if (!pointOnSegment({ x: edgeB.x1, y: edgeB.y1 }, { x: edgeA.x1, y: edgeA.y1 }, { x: edgeA.x2, y: edgeA.y2 })
    && !pointOnSegment({ x: edgeB.x2, y: edgeB.y2 }, { x: edgeA.x1, y: edgeA.y1 }, { x: edgeA.x2, y: edgeA.y2 })
    && !pointOnSegment({ x: edgeA.x1, y: edgeA.y1 }, { x: edgeB.x1, y: edgeB.y1 }, { x: edgeB.x2, y: edgeB.y2 })
    && !pointOnSegment({ x: edgeA.x2, y: edgeA.y2 }, { x: edgeB.x1, y: edgeB.y1 }, { x: edgeB.x2, y: edgeB.y2 })) {
    return 0;
  }

  const ux = ax / lengthA;
  const uy = ay / lengthA;
  const origin = { x: edgeA.x1, y: edgeA.y1 };
  const project = point => ux * (point.x - origin.x) + uy * (point.y - origin.y);
  const aStart = 0;
  const aEnd = lengthA;
  const bStart = project({ x: edgeB.x1, y: edgeB.y1 });
  const bEnd = project({ x: edgeB.x2, y: edgeB.y2 });
  const overlapStart = Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd));
  const overlapEnd = Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd));

  return Math.max(0, overlapEnd - overlapStart);
}

function polygonsShareBoundarySegment(polygonA, polygonB) {
  const edgesA = getPolygonEdges(polygonA);
  const edgesB = getPolygonEdges(polygonB);

  return edgesA.some(edgeA => edgesB.some(edgeB => getPolygonEdgeOverlapLength(edgeA, edgeB) > EPS));
}

function splitPolygonsIntoConnectedComponents(polygons) {
  const validPolygons = (polygons || [])
    .map(cleanPolygon)
    .filter(points => points.length >= 3 && getPolygonArea(points) > EPS);

  if (validPolygons.length <= 1) {
    return validPolygons.length === 1 ? [validPolygons] : [];
  }

  const visited = new Set();
  const components = [];

  for (let startIndex = 0; startIndex < validPolygons.length; startIndex += 1) {
    if (visited.has(startIndex)) {
      continue;
    }

    const queue = [startIndex];
    visited.add(startIndex);
    const component = [];

    while (queue.length > 0) {
      const index = queue.shift();
      const current = validPolygons[index];
      component.push(current);

      for (let otherIndex = 0; otherIndex < validPolygons.length; otherIndex += 1) {
        if (visited.has(otherIndex) || otherIndex === index) {
          continue;
        }

        if (polygonsShareBoundarySegment(current, validPolygons[otherIndex])) {
          visited.add(otherIndex);
          queue.push(otherIndex);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function pointInsidePolygon(point, points) {
  const polygon = cleanPolygon(points);
  if (polygon.length < 3) {
    return false;
  }

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    if (pointOnSegment(point, current, next)) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previousIndex];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || EPS) + a.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInsideAnyPolygon(point, polygons) {
  return (polygons || []).some(points => pointInsidePolygon(point, points));
}

function getPolygonEdges(points) {
  const polygon = cleanPolygon(points);
  if (polygon.length < 3) {
    return [];
  }

  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return {
      x1: point.x,
      y1: point.y,
      x2: next.x,
      y2: next.y,
    };
  }).filter(edge => Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1) > EPS);
}

function getPolygonsBoundaryPathData(polygons, transform = (x, y) => ({ x, y })) {
  const sourcePolygons = (polygons || [])
    .map(cleanPolygon)
    .filter(points => points.length >= 3 && getPolygonArea(points) > EPS);

  if (sourcePolygons.length === 0) {
    return '';
  }

  const precision = 4;
  const lineTolerance = 10 ** -precision;
  const edgeGroups = [];
  const canonicalizeLine = edge => {
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const length = Math.hypot(dx, dy);
    if (length <= EPS) {
      return null;
    }

    let ux = dx / length;
    let uy = dy / length;
    if (ux < -EPS || (Math.abs(ux) <= EPS && uy < -EPS)) {
      ux *= -1;
      uy *= -1;
    }

    const nx = -uy;
    const ny = ux;
    const offset = nx * edge.x1 + ny * edge.y1;
    const start = ux * edge.x1 + uy * edge.y1;
    const end = ux * edge.x2 + uy * edge.y2;

    return {
      ux,
      uy,
      nx,
      ny,
      offset,
      start: Math.min(start, end),
      end: Math.max(start, end),
    };
  };

  sourcePolygons.flatMap(points => getPolygonEdges(points)).forEach(edge => {
    const line = canonicalizeLine(edge);
    if (!line || line.end <= line.start + EPS) {
      return;
    }

    let group = edgeGroups.find(candidate => Math.abs(candidate.ux - line.ux) <= lineTolerance
      && Math.abs(candidate.uy - line.uy) <= lineTolerance
      && Math.abs(candidate.offset - line.offset) <= lineTolerance * 2);

    if (!group) {
      group = {
        ux: line.ux,
        uy: line.uy,
        nx: line.nx,
        ny: line.ny,
        offset: line.offset,
        intervals: [],
      };
      edgeGroups.push(group);
    }

    group.intervals.push({ start: line.start, end: line.end });
  });

  const pathParts = [];

  edgeGroups.forEach(group => {
    const cuts = uniqueSorted(group.intervals.flatMap(interval => [interval.start, interval.end]));
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const start = cuts[index];
      const end = cuts[index + 1];
      if (end <= start + EPS) {
        continue;
      }

      const middle = (start + end) / 2;
      const coverage = group.intervals.reduce((count, interval) => {
        return middle >= interval.start - lineTolerance && middle <= interval.end + lineTolerance ? count + 1 : count;
      }, 0);

      // A visible boundary is covered by exactly one polygon edge. If two or more polygon parts
      // cover the same segment, it is an internal seam of one logical surface and must not be drawn.
      if (coverage !== 1) {
        continue;
      }

      const p1 = {
        x: group.ux * start + group.nx * group.offset,
        y: group.uy * start + group.ny * group.offset,
      };
      const p2 = {
        x: group.ux * end + group.nx * group.offset,
        y: group.uy * end + group.ny * group.offset,
      };
      const startPoint = transform(p1.x, p1.y);
      const endPoint = transform(p2.x, p2.y);
      pathParts.push(`M ${roundTo(startPoint.x, 6)} ${roundTo(startPoint.y, 6)} L ${roundTo(endPoint.x, 6)} ${roundTo(endPoint.y, 6)}`);
    }
  });

  return pathParts.join(' ');
}

function getExactPolygonsBoundaryPathData(polygons, transform = (x, y) => ({ x, y })) {
  const edgeMap = new Map();
  const pointKey = (x, y) => `${roundTo(x, 6)},${roundTo(y, 6)}`;

  (polygons || []).flatMap(points => getPolygonEdges(points)).forEach(edge => {
    const startKey = pointKey(edge.x1, edge.y1);
    const endKey = pointKey(edge.x2, edge.y2);
    const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;

    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        count: 0,
        edge: {
          x1: roundTo(edge.x1, 6),
          y1: roundTo(edge.y1, 6),
          x2: roundTo(edge.x2, 6),
          y2: roundTo(edge.y2, 6),
        },
      });
    }

    edgeMap.get(key).count += 1;
  });

  return [...edgeMap.values()]
    .filter(entry => entry.count % 2 === 1)
    .map(entry => entry.edge)
    .map(edge => {
      const start = transform(edge.x1, edge.y1);
      const end = transform(edge.x2, edge.y2);
      return `M ${roundTo(start.x, 6)} ${roundTo(start.y, 6)} L ${roundTo(end.x, 6)} ${roundTo(end.y, 6)}`;
    })
    .join(' ');
}

function getNormalizedPolygons(polygons, bounds) {
  return polygons
    .map(points => cleanPolygon(points).map(point => ({
      x: roundTo(point.x - bounds.x, 6),
      y: roundTo(point.y - bounds.y, 6),
    })))
    .filter(points => points.length >= 3)
    .sort((a, b) => {
      const ab = getPolygonBounds(a);
      const bb = getPolygonBounds(b);
      return (ab.y - bb.y) || (ab.x - bb.x) || (ab.width - bb.width) || (ab.height - bb.height);
    });
}


function isAxisAlignedRectanglePolygon(points) {
  const polygon = cleanPolygon(points);
  if (polygon.length !== 4) {
    return false;
  }
  const xs = uniqueSorted(polygon.map(point => point.x));
  const ys = uniqueSorted(polygon.map(point => point.y));
  return xs.length === 2 && ys.length === 2;
}

function getPolygonShapeSignature(normalizedPolygons, bounds) {
  return `${roundTo(bounds.width, 6)}x${roundTo(bounds.height, 6)}|poly|${normalizedPolygons
    .map(points => points.map(point => `${roundTo(point.x, 6)}:${roundTo(point.y, 6)}`).join(';'))
    .join('|')}`;
}

function getCellPolygonBoundsAtom(cell) {
  const bounds = getPolygonBounds(cell.polygon || getRectPolygon(cell));
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

function createRotatedGridCell(row, col, basis, panelWidth, panelHeight) {
  const localX = col * panelWidth;
  const localY = row * panelHeight;
  const p1 = pointFromBasisCoordinates(localX, localY, basis);
  const p2 = pointFromBasisCoordinates(localX + panelWidth, localY, basis);
  const p3 = pointFromBasisCoordinates(localX + panelWidth, localY + panelHeight, basis);
  const p4 = pointFromBasisCoordinates(localX, localY + panelHeight, basis);
  const polygon = cleanPolygon([p1, p2, p3, p4]);
  const bounds = getPolygonBounds(polygon);
  const roomPolygon = clipPolygonToRect(polygon, getRoomRect());

  return {
    id: `D${row}C${col}`,
    row,
    col,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    panelWidth,
    panelHeight,
    polygon,
    roomPolygon,
    isRotated: true,
  };
}

function getRotatedGridCells() {
  const panelWidth = getPanelWidthMeters();
  const panelHeight = getPanelHeightMeters();
  const basis = getGridBasis();
  const projections = getRoomCorners().map(point => pointToBasisCoordinates(point, basis));
  const minX = Math.min(...projections.map(point => point.x));
  const maxX = Math.max(...projections.map(point => point.x));
  const minY = Math.min(...projections.map(point => point.y));
  const maxY = Math.max(...projections.map(point => point.y));
  const colMin = Math.floor(minX / panelWidth) - 1;
  const colMax = Math.ceil(maxX / panelWidth) + 1;
  const rowMin = Math.floor(minY / panelHeight) - 1;
  const rowMax = Math.ceil(maxY / panelHeight) + 1;
  const cells = [];

  for (let row = rowMin; row < rowMax; row += 1) {
    for (let col = colMin; col < colMax; col += 1) {
      const cell = createRotatedGridCell(row, col, basis, panelWidth, panelHeight);
      if (getPolygonArea(cell.roomPolygon) > EPS) {
        cells.push(cell);
      }
    }
  }

  return cells.sort((a, b) => (a.row - b.row) || (a.col - b.col));
}

function getAllGridCells() {
  if (isGridRotated()) {
    return getRotatedGridCells();
  }

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
  if (isGridRotated()) {
    const panelArea = getPanelAreaMeters();
    return allCells.filter(cell => getPolygonArea(cell.roomPolygon) >= panelArea - 0.0001
      && polygonInsideRoom(cell.polygon)
      && !obstacleRects.some(obstacle => polygonIntersectsRect(cell.polygon, obstacle)));
  }

  return allCells.filter(cell => rectInsideRoom(cell)
    && !obstacleRects.some(obstacle => rectIntersects(cell, obstacle)));
}

function getRoomInsideGridCells(allCells) {
  if (isGridRotated()) {
    return allCells.filter(cell => polygonInsideRoom(cell.polygon));
  }

  return allCells.filter(cell => rectInsideRoom(cell));
}

function getBlockedPanelCells(allCells, obstacleRects) {
  if (isGridRotated()) {
    return allCells.filter(cell => getPolygonArea(cell.roomPolygon) > EPS
      && obstacleRects.some(obstacle => polygonIntersectsRect(cell.roomPolygon, obstacle)));
  }

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


function parseGridCellId(cellId) {
  const value = String(cellId || '');
  const orthogonalMatch = /^R(-?\d+)C(-?\d+)$/.exec(value);
  if (orthogonalMatch) {
    return {
      row: Number(orthogonalMatch[1]) - 1,
      col: Number(orthogonalMatch[2]) - 1,
    };
  }

  const rotatedMatch = /^D(-?\d+)C(-?\d+)$/.exec(value);
  if (rotatedMatch) {
    return {
      row: Number(rotatedMatch[1]),
      col: Number(rotatedMatch[2]),
    };
  }

  return null;
}

function getGridCellIdForRowCol(row, col) {
  if (isGridRotated()) {
    return `D${row}C${col}`;
  }

  return `R${row + 1}C${col + 1}`;
}

function getCombinedPanelCellCoordinates(panel, gridCellMap) {
  const normalized = normalizeCombinedPanel(panel);
  if (!normalized) {
    return [];
  }

  return normalized.cellIds.map(id => {
    const currentCell = gridCellMap.get(id);
    if (currentCell) {
      return { id, row: currentCell.row, col: currentCell.col };
    }

    const parsed = parseGridCellId(id);
    return parsed ? { id, row: parsed.row, col: parsed.col } : null;
  }).filter(point => point && Number.isFinite(point.row) && Number.isFinite(point.col));
}

function getCombinedPanelCellOffsets(panel, gridCellMap) {
  const coordinates = getCombinedPanelCellCoordinates(panel, gridCellMap);
  if (coordinates.length < 2) {
    return null;
  }

  const uniqueCoordinates = [];
  const seenCoordinates = new Set();
  coordinates.forEach(point => {
    const key = `${point.row}:${point.col}`;
    if (!seenCoordinates.has(key)) {
      seenCoordinates.add(key);
      uniqueCoordinates.push(point);
    }
  });

  if (uniqueCoordinates.length < 2) {
    return null;
  }

  const minRow = Math.min(...uniqueCoordinates.map(point => point.row));
  const minCol = Math.min(...uniqueCoordinates.map(point => point.col));
  const offsets = uniqueCoordinates
    .map(point => ({ row: point.row - minRow, col: point.col - minCol }))
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));

  return {
    anchorRow: minRow,
    anchorCol: minCol,
    offsets,
  };
}

function getCellIdsForCombinedPanelAnchor(anchorRow, anchorCol, offsets) {
  return offsets.map(offset => getGridCellIdForRowCol(anchorRow + offset.row, anchorCol + offset.col));
}

function getCombinedPanelCellIdsScore(cellIds, allCellMap, targetAnchor) {
  const cells = cellIds.map(id => allCellMap.get(id)).filter(Boolean);
  const minRow = Math.min(...cells.map(cell => cell.row));
  const minCol = Math.min(...cells.map(cell => cell.col));
  const maxRow = Math.max(...cells.map(cell => cell.row));
  const maxCol = Math.max(...cells.map(cell => cell.col));

  return Math.abs(minRow - targetAnchor.row)
    + Math.abs(minCol - targetAnchor.col)
    + Math.abs(maxRow - targetAnchor.maxRow)
    + Math.abs(maxCol - targetAnchor.maxCol);
}

function repairCombinedPanelCellIds(panel, candidateCells, candidateCellMap) {
  const geometry = getCombinedPanelCellOffsets(panel, candidateCellMap);
  if (!geometry) {
    return null;
  }

  const originalMaxRow = geometry.anchorRow + Math.max(...geometry.offsets.map(offset => offset.row));
  const originalMaxCol = geometry.anchorCol + Math.max(...geometry.offsets.map(offset => offset.col));
  const targetAnchor = {
    row: geometry.anchorRow,
    col: geometry.anchorCol,
    maxRow: originalMaxRow,
    maxCol: originalMaxCol,
  };
  const candidateAnchors = [];
  const seenAnchors = new Set();

  candidateCells.forEach(cell => {
    geometry.offsets.forEach(offset => {
      const anchorRow = cell.row - offset.row;
      const anchorCol = cell.col - offset.col;
      const key = `${anchorRow}:${anchorCol}`;
      if (!seenAnchors.has(key)) {
        seenAnchors.add(key);
        candidateAnchors.push({ row: anchorRow, col: anchorCol });
      }
    });
  });

  let best = null;

  candidateAnchors.forEach(anchor => {
    const cellIds = getCellIdsForCombinedPanelAnchor(anchor.row, anchor.col, geometry.offsets);
    if (cellIds.length < 2
      || cellIds.some(id => !candidateCellMap.has(id))
      || !areCellIdsConnected(cellIds, candidateCellMap)) {
      return;
    }

    const score = getCombinedPanelCellIdsScore(cellIds, candidateCellMap, targetAnchor);
    const tieBreaker = cellIds.join('|');
    if (!best || score < best.score || (Math.abs(score - best.score) <= EPS && tieBreaker < best.tieBreaker)) {
      best = { cellIds, score, tieBreaker };
    }
  });

  return best ? best.cellIds : null;
}

function getValidCombinedPanelEntries(gridCells) {
  const roomInsideCells = getRoomInsideGridCells(gridCells);
  const roomInsideCellMap = getGridCellMap(roomInsideCells);
  const validEntries = [];
  const repairedCellIdsByPanelId = new Map();

  state.combinedPanels.forEach((panel, index) => {
    const normalized = normalizeCombinedPanel(panel, index);
    if (!normalized) {
      return;
    }

    const tryAcceptCellIds = cellIds => {
      if (cellIds.length < 2
        || cellIds.some(id => !roomInsideCellMap.has(id))
        || !areCellIdsConnected(cellIds, roomInsideCellMap)) {
        return false;
      }

      validEntries.push({ ...normalized, cellIds });
      return true;
    };

    if (tryAcceptCellIds(normalized.cellIds)) {
      return;
    }

    const repairedCellIds = repairCombinedPanelCellIds(normalized, roomInsideCells, roomInsideCellMap);
    if (!repairedCellIds || !tryAcceptCellIds(repairedCellIds)) {
      return;
    }

    repairedCellIdsByPanelId.set(normalized.id, [...repairedCellIds]);
  });

  if (repairedCellIdsByPanelId.size > 0) {
    state.combinedPanels = state.combinedPanels.map((panel, index) => {
      const normalized = normalizeCombinedPanel(panel, index);
      if (!normalized) {
        return panel;
      }

      const repairedCellIds = repairedCellIdsByPanelId.get(normalized.id);
      return repairedCellIds
        ? { id: normalized.id, cellIds: repairedCellIds }
        : { id: normalized.id, cellIds: [...normalized.cellIds] };
    });
  }

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

function createPolygonCutPiece(id, polygons, zone, mergeKey = '', options = {}) {
  const validPolygons = (polygons || [])
    .map(cleanPolygon)
    .filter(points => points.length >= 3 && getPolygonArea(points) > EPS);

  if (validPolygons.length === 0) {
    return null;
  }

  const worldBounds = getPolygonsBounds(validPolygons);
  const basis = options.basis || null;
  const measurementPolygons = basis
    ? validPolygons.map(points => points.map(point => pointToBasisCoordinates(point, basis)))
    : validPolygons;
  const measurementBounds = getPolygonsBounds(measurementPolygons);
  const normalizedPolygons = getNormalizedPolygons(measurementPolygons, measurementBounds);
  const area = validPolygons.reduce((sum, points) => sum + getPolygonArea(points), 0);
  const atoms = validPolygons.map(points => getPolygonBounds(points));

  return {
    id,
    x: worldBounds.x,
    y: worldBounds.y,
    width: roundTo(measurementBounds.width),
    height: roundTo(measurementBounds.height),
    area: roundTo(area),
    zone,
    mergeKey,
    atoms,
    polygons: validPolygons,
    normalizedAtoms: [],
    normalizedPolygons,
    shapeSignature: getPolygonShapeSignature(normalizedPolygons, measurementBounds),
    isComplex: validPolygons.length > 1 || normalizedPolygons.some(points => !isAxisAlignedRectanglePolygon(points)),
    isPolygon: true,
  };
}

function getPieceLabelRects(piece) {
  if (Array.isArray(piece?.atoms) && piece.atoms.length > 0) {
    return piece.atoms;
  }

  if (Array.isArray(piece?.polygons) && piece.polygons.length > 0) {
    return piece.polygons.map(points => getPolygonBounds(points));
  }

  return piece ? [{ x: piece.x, y: piece.y, width: piece.width, height: piece.height }] : [];
}

function getLargestAtom(piece) {
  const atoms = getPieceLabelRects(piece);
  return atoms.reduce((largest, atom) => {
    if (!largest || rectArea(atom) > rectArea(largest)) {
      return atom;
    }
    return largest;
  }, null);
}

function getPieceLabelPoint(piece) {
  if (Array.isArray(piece?.polygons) && piece.polygons.length > 0) {
    const largestPolygon = piece.polygons.reduce((largest, polygon) => {
      if (!largest || getPolygonArea(polygon) > getPolygonArea(largest)) {
        return polygon;
      }
      return largest;
    }, null);

    if (largestPolygon) {
      return getPolygonCentroid(largestPolygon);
    }
  }

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


function hasShapePolygons(group) {
  return Array.isArray(group?.normalizedPolygons) && group.normalizedPolygons.length > 0;
}

function getShapeFillMarkup(group, transform) {
  if (hasShapePolygons(group)) {
    return `<path fill-rule="evenodd" d="${getPolygonsPathData(group.normalizedPolygons, transform)}"></path>`;
  }

  return group.normalizedAtoms.map(atom => {
    const point = transform(atom.x, atom.y);
    const w = roundTo(atom.width * (transform.scale || 1), 3);
    const h = roundTo(atom.height * (transform.scale || 1), 3);
    return `<rect x="${roundTo(point.x, 3)}" y="${roundTo(point.y, 3)}" width="${w}" height="${h}" rx="1.4"></rect>`;
  }).join('');
}

function getShapeOutlinePathData(group, transform = (x, y) => ({ x, y })) {
  return hasShapePolygons(group)
    ? getPolygonsBoundaryPathData(group.normalizedPolygons, transform)
    : getBoundaryPathData(group.normalizedAtoms, transform);
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
  transform.scale = scale;

  const rects = getShapeFillMarkup(group, transform);
  const outline = getShapeOutlinePathData(group, transform);

  return `
    <svg class="${iconClass}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect class="shape-icon-frame" x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="5"></rect>
      <g class="shape-icon-fill">${rects}</g>
      <path class="shape-icon-outline" d="${outline}"></path>
    </svg>
  `;
}


function getShapeMeasurementAtoms(group) {
  if (hasShapePolygons(group)) {
    return group.normalizedPolygons.map((points, index) => ({
      id: `P${index + 1}`,
      ...getPolygonBounds(points),
    }));
  }

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
  if (hasShapePolygons(group)) {
    group.normalizedPolygons.flat().forEach(point => {
      values.push(axis === 'x' ? point.x : point.y);
    });
    values.push(0, axis === 'x' ? group.width : group.height);
    return uniqueSorted(values);
  }

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
  if (hasShapePolygons(group)) {
    return [];
  }

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
  transform.scale = scale;
  const atoms = getShapeMeasurementAtoms(group);
  const voids = getShapeVoidRects(group);
  const outline = getShapeOutlinePathData(group, transform);
  const outerBottomY = offsetY + shapeHeight + 58;
  const outerRightX = offsetX + shapeWidth + 58;
  const segmentTopY = Math.max(28, offsetY - 38);
  const segmentLeftX = Math.max(38, offsetX - 42);

  const atomRects = hasShapePolygons(group)
    ? `<path class="shape-detail-atom shape-detail-polygon-atom" fill-rule="evenodd" d="${getPolygonsPathData(group.normalizedPolygons, transform)}"></path>`
    : atoms.map(atom => {
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

function getRotatedCellZoneLabel(cell, obstacleRects = []) {
  const obstacleIds = obstacleRects
    .filter(obstacle => polygonIntersectsRect(cell.roomPolygon || cell.polygon, obstacle))
    .map(obstacle => obstacle.id);

  if (obstacleIds.length > 0) {
    return `um ${obstacleIds.join('/')}`;
  }

  const outsideSides = [];
  (cell.polygon || []).forEach(point => {
    if (point.x < -EPS) outsideSides.push('links');
    if (point.x > state.room.widthMeters + EPS) outsideSides.push('rechts');
    if (point.y < -EPS) outsideSides.push('oben');
    if (point.y > state.room.heightMeters + EPS) outsideSides.push('unten');
  });

  return outsideSides.length > 0
    ? [...new Set(outsideSides)].join(' / ')
    : 'Diagonal-Zuschnitt';
}

function calculateRotatedCutPieces(allCells, fullPanelCells, obstacleRects, excludedCellIds = new Set()) {
  const fullCellIds = new Set(fullPanelCells.map(cell => cell.id));
  const pieces = [];
  const measurementBasis = getGridBasis();

  allCells.forEach(cell => {
    if (fullCellIds.has(cell.id) || excludedCellIds.has(cell.id)) {
      return;
    }

    const roomPolygon = cleanPolygon(cell.roomPolygon || clipPolygonToRect(cell.polygon, getRoomRect()));
    if (getPolygonArea(roomPolygon) <= EPS) {
      return;
    }

    const cutPolygons = subtractObstaclesFromPolygon(roomPolygon, obstacleRects);
    const validCutPolygons = cutPolygons.filter(polygon => getPolygonArea(polygon) > EPS);
    if (validCutPolygons.length === 0) {
      return;
    }

    const zone = getRotatedCellZoneLabel(cell, obstacleRects);
    const cutComponents = splitPolygonsIntoConnectedComponents(validCutPolygons);

    cutComponents.forEach(componentPolygons => {
      const piece = createPolygonCutPiece(
        `diagonal-${pieces.length + 1}`,
        componentPolygons,
        zone,
        `rotated-cell:${cell.id}`,
        { basis: measurementBasis },
      );

      if (!piece) {
        return;
      }

      piece.sourceCellId = cell.id;
      piece.sourceCellArea = roundTo(getPolygonArea(roomPolygon));
      piece.cutComponentCount = componentPolygons.length;
      piece.disconnectedComponentCount = cutComponents.length;
      pieces.push(piece);
    });
  });

  return pieces.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.height - b.height) || (a.width - b.width));
}

function calculateCutPieces(allCells, fullPanelCells, blockedPanelCells, obstacleRects, excludedCellIds = new Set()) {
  if (isGridRotated()) {
    return calculateRotatedCutPieces(allCells, fullPanelCells, obstacleRects, excludedCellIds);
  }

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
        normalizedAtoms: piece.normalizedAtoms || [],
        normalizedPolygons: piece.normalizedPolygons || null,
        isComplex: piece.isComplex,
        isPolygon: Boolean(piece.isPolygon),
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


function calculateRotatedCombinedPanelPieces(validCombinedPanels, gridCellMap, obstacleRects) {
  const originalPieces = [];
  const displayPieces = [];
  const cutPieces = [];
  const measurementBasis = getGridBasis();

  validCombinedPanels.forEach((panel, index) => {
    const sourceId = panel.id || `K${index + 1}`;
    const cells = panel.cellIds.map(id => gridCellMap.get(id)).filter(Boolean);
    const originalPolygons = cells.map(cell => cell.polygon).filter(poly => getPolygonArea(poly) > EPS);
    const originalPiece = createPolygonCutPiece(sourceId, originalPolygons, 'kombiniert', `combined:${sourceId}`, { basis: measurementBasis });

    if (!originalPiece) {
      return;
    }

    originalPiece.sourceCombinedPanelId = sourceId;
    originalPiece.standardCellCount = panel.cellIds.length;
    originalPiece.isCombinedOriginal = true;
    originalPieces.push(originalPiece);

    const displayPolygons = cells.flatMap(cell => subtractObstaclesFromPolygon(cell.roomPolygon || cell.polygon, obstacleRects));
    const displayPiece = createPolygonCutPiece(sourceId, displayPolygons, 'kombiniert mit Sperrflächen-Zuschnitt', `combined-cut:${sourceId}`, { basis: measurementBasis });

    if (!displayPiece) {
      return;
    }

    displayPiece.sourceCombinedPanelId = sourceId;
    displayPiece.standardCellCount = panel.cellIds.length;
    displayPiece.originalShapeSignature = originalPiece.shapeSignature;
    displayPiece.originalArea = originalPiece.area;
    displayPiece.cutAwayArea = roundTo(Math.max(0, originalPiece.area - displayPiece.area));
    const hasObstacleIntersection = cells.some(cell => obstacleRects.some(obstacle => polygonIntersectsRect(cell.roomPolygon || cell.polygon, obstacle)));
    displayPiece.hasCombinedCut = hasObstacleIntersection
      && (displayPiece.shapeSignature !== originalPiece.shapeSignature
        || Math.abs(displayPiece.area - originalPiece.area) > EPS);
    displayPieces.push(displayPiece);

    if (displayPiece.hasCombinedCut) {
      cutPieces.push({
        ...displayPiece,
        atoms: displayPiece.atoms.map(atom => ({ ...atom })),
        polygons: displayPiece.polygons.map(poly => poly.map(point => ({ ...point }))),
        normalizedPolygons: displayPiece.normalizedPolygons.map(poly => poly.map(point => ({ ...point }))),
      });
    }
  });

  return { originalPieces, displayPieces, cutPieces };
}

function calculateCombinedPanelPieces(validCombinedPanels, gridCellMap, obstacleRects) {
  if (isGridRotated()) {
    return calculateRotatedCombinedPanelPieces(validCombinedPanels, gridCellMap, obstacleRects);
  }

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
        normalizedAtoms: piece.normalizedAtoms || [],
        normalizedPolygons: piece.normalizedPolygons || null,
        isComplex: Boolean(piece.isComplex) || piece.area < (piece.width * piece.height) - EPS,
        isPolygon: Boolean(piece.isPolygon),
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
  const cutPieces = calculateCutPieces(allCells, fullPanelCells, blockedPanelCells, obstacleRects, combinedCellIds);
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
  const warnings = [];
  const oversizedGroups = groups.filter(group => !group.isPolygon && (group.width > getPanelWidthMeters() + EPS || group.height > getPanelHeightMeters() + EPS));
  if (oversizedGroups.length > 0) {
    warnings.push('Einige Zuschnittstücke sind größer als ein Paneel. Bitte Paneelgröße prüfen.');
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
  const rect = getObstacleRect(obstacle);
  const anchor = getObstacleOriginAnchor(rect);
  return pointToBasisCoordinates(anchor, getCoordinateBasis());
}

function getObstacleOriginLimits(width, height) {
  const xMax = Math.max(0, state.room.widthMeters - width);
  const yMax = Math.max(0, state.room.heightMeters - height);
  return {
    xMin: 0,
    xMax,
    yMin: 0,
    yMax,
    x: xMax,
    y: yMax,
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
  const safeOriginX = clamp(getNumberOrFallback(originX, 0), limits.xMin, limits.xMax);
  const safeOriginY = clamp(getNumberOrFallback(originY, 0), limits.yMin, limits.yMax);
  const anchor = pointFromBasisCoordinates(safeOriginX, safeOriginY, getCoordinateBasis());
  let x = anchor.x;
  let y = anchor.y;

  if (state.originCorner.includes('right')) {
    x -= safeWidth;
  }

  if (state.originCorner.includes('bottom')) {
    y -= safeHeight;
  }

  obstacle.widthMeters = safeWidth;
  obstacle.heightMeters = safeHeight;
  obstacle.x = clamp(x, 0, Math.max(0, state.room.widthMeters - safeWidth));
  obstacle.y = clamp(y, 0, Math.max(0, state.room.heightMeters - safeHeight));
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
          <label>X, m<input data-field="x" type="number" min="${formatMeters(originLimits.xMin)}" max="${formatMeters(originLimits.xMax)}" step="0.001" inputmode="decimal" value="${formatMeters(origin.x)}"></label>
          <label>Y, m<input data-field="y" type="number" min="${formatMeters(originLimits.yMin)}" max="${formatMeters(originLimits.yMax)}" step="0.001" inputmode="decimal" value="${formatMeters(origin.y)}"></label>
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
function getGridAnglePresetButtons() {
  return [
    { button: elements.gridAngleResetButton, angle: 0 },
    { button: elements.gridAnglePreset45Button, angle: 45 },
    { button: elements.gridAnglePreset90Button, angle: 90 },
    { button: elements.gridAnglePreset180Button, angle: 180 },
  ].filter(item => item.button);
}

function updateGridAnglePresetButtons() {
  const currentAngle = getGridRotationDegrees();
  getGridAnglePresetButtons().forEach(({ button, angle }) => {
    button.classList.toggle('active', Math.abs(currentAngle - angle) <= EPS);
  });
}

function setGridRotationDegrees(degrees) {
  state.grid.rotationDegrees = normalizeGridRotationDegrees(degrees, state.grid.rotationDegrees);
  state.grid.coordinateMode = 'absolute';
}

function updateAlignmentControls() {
  updateGridAnglePresetButtons();
  elements.alignLeftButton.classList.toggle('active', state.grid.alignmentX === 'left');
  elements.alignCenterXButton.classList.toggle('active', state.grid.alignmentX === 'center');
  elements.alignRightButton.classList.toggle('active', state.grid.alignmentX === 'right');
  elements.alignTopButton.classList.toggle('active', state.grid.alignmentY === 'top');
  elements.alignCenterYButton.classList.toggle('active', state.grid.alignmentY === 'center');
  elements.alignBottomButton.classList.toggle('active', state.grid.alignmentY === 'bottom');
  if (elements.trueCenterCheckbox) {
    elements.trueCenterCheckbox.checked = isTrueCenterEnabled();
  }

  if (elements.gridAlignmentButtons) {
    elements.gridAlignmentButtons.hidden = false;
  }
  if (elements.originCornerLabel) {
    elements.originCornerLabel.textContent = 'Koordinaten-Nullpunkt';
  }
  if (elements.originCornerHint) {
    elements.originCornerHint.textContent = 'Der Nullpunkt bestimmt, von welcher Raumecke aus X/Y-Koordinaten für Sperrflächen gemessen werden. Die Koordinatenachsen bleiben immer orthogonal zum Raum.';
  }
  if (elements.originCornerSelect) {
    elements.originCornerSelect.value = state.originCorner;
  }
  [elements.alignLeftButton, elements.alignCenterXButton, elements.alignRightButton,
    elements.alignTopButton, elements.alignCenterYButton, elements.alignBottomButton]
    .filter(Boolean)
    .forEach(button => {
      button.disabled = false;
      button.setAttribute('aria-disabled', 'false');
    });
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
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isPanelCombinationActive() || isDeleteModeActive() || isMeasurementModeActive()) {
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
    elements.panelCombinationButton.title = '';
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
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive() || isMeasurementModeActive()) {
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
    elements.obstacleEditXInput.min = formatMeters(limits.xMin);
    elements.obstacleEditXInput.max = formatMeters(limits.xMax);
  }
  if (elements.obstacleEditYInput && document.activeElement !== elements.obstacleEditYInput) {
    elements.obstacleEditYInput.value = formatMeters(origin.y);
    elements.obstacleEditYInput.min = formatMeters(limits.yMin);
    elements.obstacleEditYInput.max = formatMeters(limits.yMax);
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
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive() || isMeasurementModeActive()) {
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

function getDeleteModeVisibleCombinedPanelIds() {
  try {
    const plan = calculatePlan();
    const pieceIds = [...new Set((plan.combinedPieces || [])
      .map(piece => piece.sourceCombinedPanelId)
      .filter(Boolean))];

    if (pieceIds.length > 0) {
      return pieceIds;
    }

    const validIds = [...new Set((plan.validCombinedPanels || [])
      .map(panel => panel.id)
      .filter(Boolean))];

    if (validIds.length > 0) {
      return validIds;
    }
  } catch (error) {
    console.warn('Kombinierte Flächen konnten für den Löschmodus nicht gezählt werden.', error);
  }

  return [...new Set(state.combinedPanels.map(panel => panel.id).filter(Boolean))];
}

function formatDeleteModeCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDeleteModeDeletedStatus(obstacleCount, combinedCount) {
  const parts = [];

  if (obstacleCount > 0) {
    parts.push(formatDeleteModeCount(obstacleCount, 'Sperrfläche', 'Sperrflächen'));
  }

  if (combinedCount > 0) {
    parts.push(formatDeleteModeCount(combinedCount, 'kombinierte Fläche', 'kombinierte Flächen'));
  }

  if (parts.length === 0) {
    return 'Noch nichts gelöscht.';
  }

  return `✓ ${parts.join(' und ')} gelöscht.`;
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
      ? formatDeleteModeDeletedStatus(deletedObstacles, deletedCombined)
      : 'Noch nichts gelöscht. Klick auf eine Sperrfläche oder kombinierte Fläche, oder wähle eine Sammelaktion.',
    { variant: deletedTotal > 0 ? 'success' : 'info' },
  );

  if (elements.deleteModeClearObstaclesButton) {
    elements.deleteModeClearObstaclesButton.disabled = state.obstacles.length === 0;
    elements.deleteModeClearObstaclesButton.textContent = 'Alle Sperrflächen löschen';
  }

  if (elements.deleteModeClearCombinedPanelsButton) {
    const visibleCombinedPanelIds = getDeleteModeVisibleCombinedPanelIds();
    elements.deleteModeClearCombinedPanelsButton.disabled = state.combinedPanels.length === 0 && visibleCombinedPanelIds.length === 0;
    elements.deleteModeClearCombinedPanelsButton.textContent = 'Alle kombinierten Flächen löschen';
  }

  if (elements.deleteModeApplyButton) {
    elements.deleteModeApplyButton.disabled = false;
  }

  refreshWorkflowTimelineConnectors();
}

function activateDeleteMode() {
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive() || isMeasurementModeActive()) {
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

function deleteAllObstaclesInDeleteMode() {
  if (!isDeleteModeActive()) {
    return;
  }

  const obstacleIds = state.obstacles.map(obstacle => obstacle.id).filter(Boolean);
  if (obstacleIds.length === 0) {
    return;
  }

  state.obstacles = [];
  deleteModeState.deletedObstacleIds = [...new Set([...deleteModeState.deletedObstacleIds, ...obstacleIds])];
  deleteModeState.hasDraft = true;
  selectedObstacleId = null;
  renderObstacleControls();
  updateAll();
}

function deleteAllCombinedPanelsInDeleteMode() {
  if (!isDeleteModeActive()) {
    return;
  }

  const visibleCombinedPanelIds = getDeleteModeVisibleCombinedPanelIds();
  const fallbackCombinedPanelIds = state.combinedPanels.map(panel => panel.id).filter(Boolean);
  const combinedPanelIds = visibleCombinedPanelIds.length > 0 ? visibleCombinedPanelIds : fallbackCombinedPanelIds;
  if (combinedPanelIds.length === 0 && state.combinedPanels.length === 0) {
    return;
  }

  state.combinedPanels = [];
  deleteModeState.deletedCombinedPanelIds = [...new Set([...deleteModeState.deletedCombinedPanelIds, ...combinedPanelIds])];
  deleteModeState.hasDraft = true;
  updateAll();
}

function isMeasurementModeActive() {
  return Boolean(measurementModeState.isActive);
}

function updateMeasurementModeButton() {
  const active = isMeasurementModeActive();
  const blocked = isObstacleEditModeActive()
    || isLocalReferenceActive()
    || isObstacleAlignmentActive()
    || isPanelCombinationActive()
    || isDeleteModeActive();
  const { selectedPoints } = active ? getMeasurementPointSelection(latestPlan || calculatePlan()) : { selectedPoints: [] };
  const hasPendingMeasurement = active
    && selectedPoints.length >= 2
    && (!measurementModeState.previewMeasurementId || isEditingMeasurement());

  if (elements.measurementControl) {
    elements.measurementControl.classList.toggle('active', active);
  }

  if (elements.measurementButton) {
    elements.measurementButton.classList.toggle('active', active);
    elements.measurementButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.measurementButton.disabled = !active && blocked;
  }

  if (elements.measurementPanel) {
    elements.measurementPanel.hidden = !active;
  }

  if (elements.measurementApplyButton) {
    elements.measurementApplyButton.hidden = !hasPendingMeasurement;
    elements.measurementApplyButton.disabled = !hasPendingMeasurement;
  }

  if (elements.measurementCancelButton) {
    elements.measurementCancelButton.hidden = !hasPendingMeasurement;
    elements.measurementCancelButton.disabled = !hasPendingMeasurement;
  }

  if (elements.measurementStep1) {
    if (!active) {
      elements.measurementStep1.textContent = 'Messmodus inaktiv';
    } else if (isEditingMeasurement() && measurementModeState.editingMissingSlotIndex !== null) {
      elements.measurementStep1.textContent = 'Neue Ersatz-Punkt wählen';
    } else if (isEditingMeasurement() && selectedPoints.length >= 2) {
      elements.measurementStep1.textContent = 'Änderung speichern oder verwerfen';
    } else if (measurementModeState.previewMeasurementId && selectedPoints.length >= 2) {
      elements.measurementStep1.textContent = 'Gespeichertes Maß ansehen';
    } else if (selectedPoints.length >= 2) {
      elements.measurementStep1.textContent = 'Messung speichern oder verwerfen';
    } else {
      elements.measurementStep1.textContent = 'Messpunkte im Plan wählen';
    }
  }

  if (elements.measurementStatus) {
    if (!active) {
      elements.measurementStatus.textContent = 'Messmodus inaktiv.';
    } else if (isEditingMeasurement() && measurementModeState.editingMissingSlotIndex !== null) {
      elements.measurementStatus.textContent = 'Punkt entfernt. Wähle jetzt einen neuen Ersatzpunkt.';
    } else if (isEditingMeasurement() && selectedPoints.length >= 2) {
      elements.measurementStatus.textContent = `Maß wird bearbeitet: ${selectedPoints[0].displayId} ↔ ${selectedPoints[1].displayId}.`;
    } else if (measurementModeState.previewMeasurementId && selectedPoints.length >= 2) {
      elements.measurementStatus.textContent = `Gespeichertes Maß ${selectedPoints[0].displayId} ↔ ${selectedPoints[1].displayId} eingeblendet. Klick außerhalb blendet es wieder aus.`;
    } else if (selectedPoints.length >= 2) {
      elements.measurementStatus.textContent = `Punkte ${selectedPoints[0].displayId} und ${selectedPoints[1].displayId} ausgewählt. Abstand wird im Plan eingeblendet.`;
    } else if (selectedPoints.length === 1) {
      elements.measurementStatus.textContent = `Messpunkt ${selectedPoints[0].displayId} ausgewählt. Wähle den zweiten Punkt.`;
    } else {
      elements.measurementStatus.textContent = 'Messmodus aktiv. Wähle den ersten Punkt im Plan.';
    }
  }

  refreshWorkflowTimelineConnectors();
}

function activateMeasurementMode() {
  if (isObstacleEditModeActive() || isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive() || isMeasurementModeActive()) {
    return;
  }

  measurementModeState = {
    ...createEmptyMeasurementModeState(),
    isActive: true,
  };
  updateMeasurementModeButton();
  renderSvg(latestPlan || calculatePlan());
}

function clearMeasurementMode() {
  hideMeasurementPointPicker();
  measurementModeState = createEmptyMeasurementModeState();
  updateMeasurementModeButton();
  renderSvg(latestPlan || calculatePlan());
}

function clearMeasurementPreview() {
  if (!isMeasurementModeActive()) {
    return;
  }

  hideMeasurementPointPicker();
  measurementModeState.selectedPointIds = [];
  measurementModeState.previewMeasurementId = null;
  measurementModeState.editingMeasurementId = null;
  measurementModeState.editingMissingSlotIndex = null;
  updateMeasurementModeButton();
  renderSvg(latestPlan || calculatePlan());
}

function commitMeasurementSelection() {
  if (!isMeasurementModeActive()) {
    return;
  }

  const { selectedPoints } = getMeasurementPointSelection(latestPlan || calculatePlan());
  if (selectedPoints.length < 2 || (measurementModeState.previewMeasurementId && !isEditingMeasurement())) {
    return;
  }

  const entry = {
    id: measurementModeState.editingMeasurementId || nextMeasurementEntryId(),
    pointIds: selectedPoints.map(point => point.id),
    pointDisplayIds: selectedPoints.map(point => point.displayId),
    distanceMeters: roundTo(getMeasurementDistanceMeters(selectedPoints[0], selectedPoints[1]), 6),
  };

  if (measurementModeState.editingMeasurementId) {
    state.measurements = state.measurements.map(existing => existing.id === measurementModeState.editingMeasurementId ? entry : existing);
  } else {
    state.measurements = [...state.measurements, entry];
  }
  measurementModeState.selectedPointIds = [];
  measurementModeState.previewMeasurementId = null;
  measurementModeState.editingMeasurementId = null;
  measurementModeState.editingMissingSlotIndex = null;
  upsertCurrentMeasurementCollection();
  updateAll();
  saveConfigDebounced();
}

function previewSavedMeasurement(entryId, options = {}) {
  const entry = getSavedMeasurementEntryById(entryId);
  if (!entry) {
    return;
  }

  if (!isMeasurementModeActive()) {
    measurementModeState = {
      ...createEmptyMeasurementModeState(),
      isActive: true,
    };
  }

  measurementModeState.selectedPointIds = [...entry.pointIds];
  measurementModeState.previewMeasurementId = entry.id;
  measurementModeState.editingMeasurementId = null;
  measurementModeState.editingMissingSlotIndex = null;
  updateMeasurementModeButton();
  renderSvg(latestPlan || calculatePlan());

  if (options.scrollIntoView && elements.measurementPanel) {
    elements.measurementPanel.scrollIntoView({ block: 'nearest' });
  }
}

function startEditingMeasurement(entryId) {
  const entry = getSavedMeasurementEntryById(entryId);
  if (!entry) {
    return;
  }

  if (!isMeasurementModeActive()) {
    measurementModeState = {
      ...createEmptyMeasurementModeState(),
      isActive: true,
    };
  }

  measurementModeState.selectedPointIds = [...entry.pointIds];
  measurementModeState.previewMeasurementId = null;
  measurementModeState.editingMeasurementId = entry.id;
  measurementModeState.editingMissingSlotIndex = null;
  hideMeasurementPointPicker();
  updateMeasurementModeButton();
  renderSvg(latestPlan || calculatePlan());
}

function deleteSavedMeasurement(entryId) {
  const entry = getSavedMeasurementEntryById(entryId);
  if (!entry) {
    return;
  }

  if (!window.confirm(`Maß ${entry.pointDisplayIds?.[0] || entry.pointIds[0]} ↔ ${entry.pointDisplayIds?.[1] || entry.pointIds[1]} wirklich löschen?`)) {
    return;
  }

  state.measurements = state.measurements.filter(existing => existing.id !== entryId);
  if (measurementModeState.previewMeasurementId === entryId || measurementModeState.editingMeasurementId === entryId) {
    measurementModeState.selectedPointIds = [];
    measurementModeState.previewMeasurementId = null;
    measurementModeState.editingMeasurementId = null;
    measurementModeState.editingMissingSlotIndex = null;
  }
  upsertCurrentMeasurementCollection();
  updateAll();
  saveConfigDebounced();
}

function toggleMeasurementMode() {
  if (isMeasurementModeActive()) {
    clearMeasurementMode();
    return;
  }

  activateMeasurementMode();
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
  if (isObstacleEditModeActive() || isObstacleAlignmentActive() || isPanelCombinationActive() || isDeleteModeActive() || isMeasurementModeActive()) {
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

function getCombinedPanelBoundaryHiddenIntervals(axis, coordinate, combinedBoundaryRects = []) {
  if (!Array.isArray(combinedBoundaryRects) || combinedBoundaryRects.length === 0) {
    return [];
  }

  return combinedBoundaryRects.flatMap(rect => {
    if (!rect || rect.width <= EPS || rect.height <= EPS) {
      return [];
    }

    if (axis === 'x') {
      if (coordinate < rect.x - EPS || coordinate > rectRight(rect) + EPS) {
        return [];
      }

      return [{ start: rect.y, end: rectBottom(rect) }];
    }

    if (coordinate < rect.y - EPS || coordinate > rectBottom(rect) + EPS) {
      return [];
    }

    return [{ start: rect.x, end: rectRight(rect) }];
  });
}

function appendPanelBoundaryOverlay(svg, blockedPanelCells = [], obstacleRects = [], combinedBoundaryRects = []) {
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
      const hiddenIntervals = [
        ...getObstacleAxisHiddenIntervals('x', x, blockedPanelCells, obstacleRects),
        ...getCombinedPanelBoundaryHiddenIntervals('x', x, combinedBoundaryRects),
      ];
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
      const hiddenIntervals = [
        ...getObstacleAxisHiddenIntervals('y', y, blockedPanelCells, obstacleRects),
        ...getCombinedPanelBoundaryHiddenIntervals('y', y, combinedBoundaryRects),
      ];
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


function getLabelTextBoxSize(label, fontSize) {
  const text = String(label || '');
  return {
    width: Math.max(fontSize * 1.15, text.length * fontSize * 0.68),
    height: fontSize * 1.12,
  };
}

function getLabelBoxAtPoint(point, size) {
  return {
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

function rectIntersectsAny(rect, candidates = []) {
  return candidates.some(candidate => rectIntersects(rect, candidate));
}

function getAtomsCentroid(atoms) {
  const validAtoms = atoms.filter(atom => atom && atom.width > EPS && atom.height > EPS);
  if (validAtoms.length === 0) {
    return null;
  }

  const totalArea = validAtoms.reduce((sum, atom) => sum + rectArea(atom), 0);
  if (totalArea <= EPS) {
    return rectCenter(getAtomsBounds(validAtoms));
  }

  return validAtoms.reduce((point, atom) => {
    const area = rectArea(atom);
    const center = rectCenter(atom);
    point.x += center.x * area / totalArea;
    point.y += center.y * area / totalArea;
    return point;
  }, { x: 0, y: 0 });
}

function getDistanceSquared(a, b) {
  return ((a.x - b.x) ** 2) + ((a.y - b.y) ** 2);
}

function getSortedLabelAtoms(atoms, centroid) {
  return atoms
    .filter(atom => atom && atom.width > EPS && atom.height > EPS)
    .map(atom => ({
      atom,
      center: rectCenter(atom),
      containsCentroid: centroid ? pointInsideRect(centroid.x, centroid.y, atom) : false,
    }))
    .sort((a, b) => {
      if (a.containsCentroid !== b.containsCentroid) {
        return a.containsCentroid ? -1 : 1;
      }
      const distanceA = centroid ? getDistanceSquared(a.center, centroid) : 0;
      const distanceB = centroid ? getDistanceSquared(b.center, centroid) : 0;
      return distanceA - distanceB || rectArea(b.atom) - rectArea(a.atom);
    })
    .map(entry => entry.atom);
}

function getInternalLabelPlacement(atoms, label, preferredFontSize, options = {}) {
  const validAtoms = atoms.filter(atom => atom && atom.width > EPS && atom.height > EPS);
  if (validAtoms.length === 0) {
    return null;
  }

  const minFontSize = options.minFontSize || Math.max(0.052, getPanelBaseMeters() * 0.1);
  const blockers = Array.isArray(options.blockers) ? options.blockers : [];
  const centroid = getAtomsCentroid(validAtoms);
  const sortedAtoms = getSortedLabelAtoms(validAtoms, centroid);
  const fontSizes = [preferredFontSize, preferredFontSize * 0.88, preferredFontSize * 0.76]
    .map(size => Math.max(minFontSize, size))
    .filter((size, index, array) => index === 0 || Math.abs(size - array[index - 1]) > EPS);

  for (const fontSize of fontSizes) {
    const boxSize = getLabelTextBoxSize(label, fontSize);
    const margin = Math.max(0.008, fontSize * 0.18);

    for (const atom of sortedAtoms) {
      if (atom.width < boxSize.width + margin * 2 || atom.height < boxSize.height + margin * 2) {
        continue;
      }

      const point = centroid || rectCenter(atom);
      const x = clamp(point.x, atom.x + margin + boxSize.width / 2, rectRight(atom) - margin - boxSize.width / 2);
      const y = clamp(point.y, atom.y + margin + boxSize.height / 2, rectBottom(atom) - margin - boxSize.height / 2);
      const labelBox = getLabelBoxAtPoint({ x, y }, boxSize);

      if (rectInsideRect(labelBox, atom) && !rectIntersectsAny(labelBox, blockers)) {
        return { type: 'internal', x, y, fontSize, atom, box: labelBox };
      }
    }
  }

  return null;
}

function getLabelCalloutRoomBounds() {
  const margin = Math.max(0.28, getPanelBaseMeters() * 0.55);
  return {
    x: -margin,
    y: -margin,
    width: state.room.widthMeters + margin * 2,
    height: state.room.heightMeters + margin * 2,
  };
}

function clampLabelCalloutBoxToRoom(box, roomBounds = getLabelCalloutRoomBounds()) {
  return {
    ...box,
    x: clamp(box.x, roomBounds.x, rectRight(roomBounds) - box.width),
    y: clamp(box.y, roomBounds.y, rectBottom(roomBounds) - box.height),
  };
}

function getLabelCalloutSideForBox(anchor, box) {
  const center = rectCenter(box);
  const dx = center.x - anchor.x;
  const dy = center.y - anchor.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'bottom' : 'top';
}

function getLabelCalloutPlacement(atoms, label, fontSize, options = {}) {
  const validAtoms = atoms.filter(atom => atom && atom.width > EPS && atom.height > EPS);
  if (validAtoms.length === 0) {
    return null;
  }

  const bounds = getAtomsBounds(validAtoms);
  const centroid = getAtomsCentroid(validAtoms) || rectCenter(bounds);
  const anchorAtom = getSortedLabelAtoms(validAtoms, centroid)[0] || validAtoms[0];
  const anchor = {
    x: clamp(centroid.x, anchorAtom.x + EPS, rectRight(anchorAtom) - EPS),
    y: clamp(centroid.y, anchorAtom.y + EPS, rectBottom(anchorAtom) - EPS),
  };
  const paddingX = fontSize * 0.58;
  const paddingY = fontSize * 0.38;
  const textSize = getLabelTextBoxSize(label, fontSize);
  const boxWidth = textSize.width + paddingX * 2;
  const boxHeight = textSize.height + paddingY * 2;
  const gap = Math.max(0.09, fontSize * 1.15);
  const roomBounds = getLabelCalloutRoomBounds();
  const blockers = Array.isArray(options.blockers) ? options.blockers : [];
  const preferred = [
    { side: 'top', x: anchor.x - boxWidth / 2, y: bounds.y - gap - boxHeight },
    { side: 'right', x: rectRight(bounds) + gap, y: anchor.y - boxHeight / 2 },
    { side: 'bottom', x: anchor.x - boxWidth / 2, y: rectBottom(bounds) + gap },
    { side: 'left', x: bounds.x - gap - boxWidth, y: anchor.y - boxHeight / 2 },
  ];

  const candidates = preferred.map(candidate => {
    const box = clampLabelCalloutBoxToRoom({ x: candidate.x, y: candidate.y, width: boxWidth, height: boxHeight }, roomBounds);
    const center = rectCenter(box);
    const blockerHits = blockers.filter(blocker => rectIntersects(box, blocker)).length;
    const ownShapeHits = validAtoms.filter(atom => rectIntersects(box, atom)).length;
    return {
      ...candidate,
      box,
      center,
      score: blockerHits * 1000 + ownShapeHits * 30 + getDistanceSquared(center, anchor),
    };
  }).sort((a, b) => a.score - b.score);

  const best = candidates[0];
  if (!best) {
    return null;
  }

  const calloutKey = String(options.calloutKey || label || '');
  const manualOffset = getManualLabelCalloutOffset(calloutKey);
  if (manualOffset) {
    const manualBox = clampLabelCalloutBoxToRoom({
      x: anchor.x + manualOffset.dx - boxWidth / 2,
      y: anchor.y + manualOffset.dy - boxHeight / 2,
      width: boxWidth,
      height: boxHeight,
    }, roomBounds);

    return {
      type: 'callout',
      anchor,
      box: manualBox,
      fontSize,
      side: getLabelCalloutSideForBox(anchor, manualBox),
      isManual: true,
      calloutKey,
    };
  }

  return { type: 'callout', anchor, box: best.box, fontSize, side: best.side, isManual: false, calloutKey };
}

function getSvgLabelCalloutTailPoints(placement) {
  const box = placement.box;
  const anchor = placement.anchor;
  const side = placement.side || 'top';
  const tailHalf = Math.max(0.026, placement.fontSize * 0.34);
  const edgePadding = Math.max(0.035, placement.fontSize * 0.42);
  const minX = box.x + edgePadding + tailHalf;
  const maxX = rectRight(box) - edgePadding - tailHalf;
  const minY = box.y + edgePadding + tailHalf;
  const maxY = rectBottom(box) - edgePadding - tailHalf;

  if (side === 'top') {
    const baseX = clamp(anchor.x, minX, maxX);
    const baseY = rectBottom(box) - EPS;
    return [
      { x: baseX - tailHalf, y: baseY },
      { x: anchor.x, y: anchor.y },
      { x: baseX + tailHalf, y: baseY },
    ];
  }

  if (side === 'bottom') {
    const baseX = clamp(anchor.x, minX, maxX);
    const baseY = box.y + EPS;
    return [
      { x: baseX - tailHalf, y: baseY },
      { x: anchor.x, y: anchor.y },
      { x: baseX + tailHalf, y: baseY },
    ];
  }

  if (side === 'left') {
    const baseX = rectRight(box) - EPS;
    const baseY = clamp(anchor.y, minY, maxY);
    return [
      { x: baseX, y: baseY - tailHalf },
      { x: anchor.x, y: anchor.y },
      { x: baseX, y: baseY + tailHalf },
    ];
  }

  const baseX = box.x + EPS;
  const baseY = clamp(anchor.y, minY, maxY);
  return [
    { x: baseX, y: baseY - tailHalf },
    { x: anchor.x, y: anchor.y },
    { x: baseX, y: baseY + tailHalf },
  ];
}

function getSvgPointsAttribute(points) {
  return points
    .map(point => `${roundTo(point.x, 6)},${roundTo(point.y, 6)}`)
    .join(' ');
}

function startLabelCalloutDrag(event, label, placement) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  if (!placement || !placement.anchor || !placement.box) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const point = getSvgPointerPoint(event);
  const boxCenter = rectCenter(placement.box);
  const currentOffset = {
    dx: boxCenter.x - placement.anchor.x,
    dy: boxCenter.y - placement.anchor.y,
  };

  labelCalloutDragState = {
    pointerId: event.pointerId,
    label: String(placement.calloutKey || label || ''),
    startX: point.x,
    startY: point.y,
    startDx: currentOffset.dx,
    startDy: currentOffset.dy,
    moved: false,
  };

  if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer-Capture ist nur Komfort; das globale pointermove bleibt die robuste Rückfallebene.
    }
  }
}

function updateLabelCalloutDrag(event) {
  if (!labelCalloutDragState || event.pointerId !== labelCalloutDragState.pointerId) {
    return;
  }

  event.preventDefault();
  const point = getSvgPointerPoint(event);
  const deltaX = point.x - labelCalloutDragState.startX;
  const deltaY = point.y - labelCalloutDragState.startY;
  labelCalloutDragState.moved = labelCalloutDragState.moved || Math.abs(deltaX) > EPS || Math.abs(deltaY) > EPS;
  setManualLabelCalloutOffset(
    labelCalloutDragState.label,
    labelCalloutDragState.startDx + deltaX,
    labelCalloutDragState.startDy + deltaY,
  );
  renderSvg(latestPlan || calculatePlan());
}

function finishLabelCalloutDrag(event) {
  if (!labelCalloutDragState || event.pointerId !== labelCalloutDragState.pointerId) {
    return;
  }

  event.preventDefault();
  const didMove = labelCalloutDragState.moved;
  labelCalloutDragState = null;

  if (didMove) {
    saveConfigDebounced();
  }
}

function appendSvgLabelCallout(parent, label, placement, className = '') {
  const group = createSvgElement('g', {
    class: `svg-label-callout draggable-label-callout${placement?.isManual ? ' manual-label-callout' : ''}${className ? ` ${className}` : ''}`,
    'data-label-id': String(label || ''),
    'data-callout-key': String(placement?.calloutKey || label || ''),
    role: 'button',
    tabindex: '0',
    'aria-label': `${String(label || '')} Beschriftung verschieben`,
  });
  const box = placement.box;
  const center = rectCenter(box);
  const cornerRadius = Math.max(0.035, placement.fontSize * 0.34);
  const tailPoints = getSvgLabelCalloutTailPoints(placement);

  group.appendChild(createSvgElement('polygon', {
    class: 'svg-label-callout-tail',
    points: getSvgPointsAttribute(tailPoints),
  }));
  group.appendChild(createSvgElement('rect', {
    class: 'svg-label-callout-box',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rx: cornerRadius,
    ry: cornerRadius,
  }));
  appendSvgText(group, label, {
    class: 'svg-label-callout-text',
    x: center.x,
    y: center.y,
    'font-size': placement.fontSize,
  });
  group.addEventListener('pointerdown', event => startLabelCalloutDrag(event, label, placement));
  group.addEventListener('dblclick', event => {
    event.preventDefault();
    event.stopPropagation();
    clearManualLabelCalloutOffset(placement?.calloutKey || label);
    renderSvg(latestPlan || calculatePlan());
    saveConfigDebounced();
  });
  parent.appendChild(group);
  return group;
}

function getMeasurementDistanceCalloutPlacement(anchor, label, fontSize, options = {}) {
  const calloutKey = String(options.calloutKey || label || '');
  const paddingX = fontSize * 0.72;
  const paddingY = fontSize * 0.4;
  const textSize = getLabelTextBoxSize(label, fontSize);
  const actionWidth = Number(options.actionWidth) || 0;
  const boxWidth = textSize.width + paddingX * 2 + actionWidth;
  const boxHeight = textSize.height + paddingY * 2;
  const gap = Math.max(0.12, fontSize * 1.2);
  const roomBounds = getLabelCalloutRoomBounds();
  const manualOffset = getManualLabelCalloutOffset(calloutKey);

  if (manualOffset) {
    const manualBox = clampLabelCalloutBoxToRoom({
      x: anchor.x + manualOffset.dx - boxWidth / 2,
      y: anchor.y + manualOffset.dy - boxHeight / 2,
      width: boxWidth,
      height: boxHeight,
    }, roomBounds);

    return {
      type: 'callout',
      anchor,
      box: manualBox,
      fontSize,
      side: getLabelCalloutSideForBox(anchor, manualBox),
      isManual: true,
      calloutKey,
    };
  }

  const preferredBox = clampLabelCalloutBoxToRoom({
    x: anchor.x - boxWidth / 2,
    y: anchor.y - gap - boxHeight,
    width: boxWidth,
    height: boxHeight,
  }, roomBounds);

  return {
    type: 'callout',
    anchor,
    box: preferredBox,
    fontSize,
    side: getLabelCalloutSideForBox(anchor, preferredBox),
    isManual: false,
    calloutKey,
  };
}

function appendMeasurementDistanceCallout(parent, label, placement, options = {}) {
  const group = createSvgElement('g', {
    class: `svg-label-callout draggable-label-callout measurement-distance-callout${placement?.isManual ? ' manual-label-callout' : ''}`,
    'data-label-id': String(label || ''),
    'data-callout-key': String(placement?.calloutKey || label || ''),
    role: 'button',
    tabindex: '0',
    'aria-label': `${String(label || '')} Mess-Callout verschieben`,
  });
  const box = placement.box;
  const center = rectCenter(box);
  const cornerRadius = Math.max(0.04, placement.fontSize * 0.36);
  const tailPoints = getSvgLabelCalloutTailPoints(placement);

  group.appendChild(createSvgElement('polygon', {
    class: 'svg-label-callout-tail',
    points: getSvgPointsAttribute(tailPoints),
  }));
  group.appendChild(createSvgElement('rect', {
    class: 'svg-label-callout-box',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rx: cornerRadius,
    ry: cornerRadius,
  }));

  const actionDiameter = Number(options.actionDiameter) || 0;
  const actionGap = Number(options.actionGap) || 0;
  const showInlineActions = Array.isArray(options.actions) && options.actions.length > 0;
  const totalActionWidth = showInlineActions
    ? (actionDiameter * options.actions.length) + (actionGap * Math.max(0, options.actions.length - 1))
    : 0;
  const actionInset = placement.fontSize * 0.62;
  const actionReservedWidth = showInlineActions ? totalActionWidth + actionInset * 1.6 : 0;
  const textCenterX = showInlineActions
    ? box.x + Math.max(placement.fontSize, box.width - actionReservedWidth) / 2
    : center.x;

  appendSvgText(group, label, {
    class: 'svg-label-callout-text',
    x: textCenterX,
    y: center.y,
    'font-size': placement.fontSize,
  });

  if (showInlineActions) {
    const actionAreaRight = rectRight(box) - actionInset;
    const currentX = actionAreaRight - totalActionWidth + actionDiameter / 2;

    options.actions.forEach((action, index) => {
      const actionX = currentX + index * (actionDiameter + actionGap);
      const buttonNode = createSvgElement('circle', {
        class: `measurement-distance-action ${action.variant || ''}`.trim(),
        cx: actionX,
        cy: center.y,
        r: actionDiameter / 2,
        tabindex: 0,
        role: 'button',
        'aria-label': action.ariaLabel,
      });
      const triggerAction = event => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.currentTarget?.blur === 'function') {
          event.currentTarget.blur();
        }
        action.handler();
      };
      buttonNode.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
      });
      buttonNode.addEventListener('click', triggerAction);
      buttonNode.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          triggerAction(event);
        }
      });
      group.appendChild(buttonNode);
      appendSvgText(group, action.labelText, {
        class: 'measurement-distance-action-text',
        x: actionX,
        y: center.y,
        'font-size': actionDiameter * 0.7,
      });
    });
  }

  group.addEventListener('pointerdown', event => startLabelCalloutDrag(event, label, placement));
  group.addEventListener('dblclick', event => {
    event.preventDefault();
    event.stopPropagation();
    clearManualLabelCalloutOffset(placement?.calloutKey || label);
    renderSvg(latestPlan || calculatePlan());
    saveConfigDebounced();
  });
  parent.appendChild(group);
  return group;
}

function appendAdaptiveSvgLabel(parent, label, atoms, options = {}) {
  const className = options.className || 'piece-label';
  const preferredFontSize = options.fontSize || Math.max(0.08, Math.min(0.18, getPanelBaseMeters() * 0.22));
  const blockers = Array.isArray(options.blockers) ? options.blockers : [];
  const placement = getInternalLabelPlacement(atoms, label, preferredFontSize, {
    minFontSize: options.minFontSize,
    blockers,
  });

  if (placement) {
    return appendSvgText(parent, label, {
      class: `${className} adaptive-piece-label`,
      x: placement.x,
      y: placement.y,
      'font-size': placement.fontSize,
      'data-label-id': String(label || ''),
    });
  }

  if (options.allowCallout === false) {
    return null;
  }

  const calloutPlacement = getLabelCalloutPlacement(atoms, label, Math.max(options.calloutFontSize || preferredFontSize, options.minCalloutFontSize || 0.07), {
    blockers,
    calloutKey: options.calloutKey || label,
  });
  if (!calloutPlacement) {
    return null;
  }

  return appendSvgLabelCallout(parent, label, calloutPlacement, options.calloutClassName || className);
}

function getDeleteBadgeAnchorRect(rect) {
  const atoms = Array.isArray(rect?.atoms)
    ? rect.atoms.filter(atom => atom && atom.width > EPS && atom.height > EPS)
    : [];

  if (atoms.length === 0) {
    return rect;
  }

  const topY = Math.min(...atoms.map(atom => atom.y));
  return atoms
    .filter(atom => Math.abs(atom.y - topY) <= EPS)
    .sort((a, b) => rectRight(b) - rectRight(a) || b.width - a.width || a.x - b.x)[0];
}

function appendElementDeleteBadge(parent, rect, onClick, options = {}) {
  const anchorRect = getDeleteBadgeAnchorRect(rect);
  if (!anchorRect || anchorRect.width <= EPS || anchorRect.height <= EPS) {
    return null;
  }

  const badgeRadius = Math.max(0.065, Math.min(0.11, getPanelBaseMeters() * 0.13));
  const hitRadius = Math.max(badgeRadius * 1.55, Math.min(anchorRect.width, anchorRect.height) * 0.2);
  const offset = badgeRadius * 1.08;
  const x = clamp(rectRight(anchorRect) - offset, anchorRect.x + offset, rectRight(anchorRect) - offset);
  const y = clamp(anchorRect.y + offset, anchorRect.y + offset, rectBottom(anchorRect) - offset);
  const deleteKind = options.kind || 'element';
  const deleteId = options.id || rect.id || rect.sourceCombinedPanelId || '';
  const group = createSvgElement('g', {
    class: 'element-delete-badge',
    role: 'button',
    tabindex: '0',
    'aria-label': `${deleteId ? `${deleteId} ` : ''}löschen`,
    'data-delete-kind': deleteKind,
    'data-delete-id': deleteId,
  });

  group.appendChild(createSvgElement('circle', {
    class: 'element-delete-badge-hit',
    cx: x,
    cy: y,
    r: hitRadius,
  }));

  group.appendChild(createSvgElement('circle', {
    class: 'element-delete-badge-bg',
    cx: x,
    cy: y,
    r: badgeRadius,
  }));

  appendSvgText(group, '×', {
    class: 'element-delete-badge-x',
    x,
    y,
    'font-size': badgeRadius * 2.05,
  });

  const handleDelete = event => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };

  group.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
  });
  group.addEventListener('click', handleDelete);
  group.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleDelete(event);
    }
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


function getElementShapeBounds(element) {
  if (Array.isArray(element?.polygons) && element.polygons.length > 0) {
    return getPolygonsBounds(element.polygons);
  }

  const atoms = Array.isArray(element?.atoms) ? element.atoms.filter(atom => atom && atom.width > EPS && atom.height > EPS) : [];
  if (atoms.length > 0) {
    return getAtomsBounds(atoms);
  }

  return element?.bounds || { x: 0, y: 0, width: 0, height: 0 };
}

function getElementCalloutAtoms(element) {
  const atoms = Array.isArray(element?.atoms) ? element.atoms.filter(atom => atom && atom.width > EPS && atom.height > EPS) : [];
  if (atoms.length > 0) {
    return atoms;
  }

  if (Array.isArray(element?.polygons) && element.polygons.length > 0) {
    return element.polygons.map(points => getPolygonBounds(points)).filter(rect => rect.width > EPS && rect.height > EPS);
  }

  const bounds = getElementShapeBounds(element);
  return bounds.width > EPS && bounds.height > EPS ? [bounds] : [];
}

function pointInsideRenderedElement(point, element) {
  if (!point || !element) {
    return false;
  }

  if (Array.isArray(element.polygons) && element.polygons.length > 0) {
    return pointInsideAnyPolygon(point, element.polygons);
  }

  const atoms = getElementCalloutAtoms(element);
  return atoms.some(atom => pointInsideRect(point.x, point.y, atom));
}

function getCombinedOverlapElements(plan) {
  const visualPieces = Array.isArray(plan.combinedOriginalPieces) && plan.combinedOriginalPieces.length > 0
    ? plan.combinedOriginalPieces
    : plan.combinedPieces || [];

  return visualPieces.map((piece, index) => {
    const label = piece.sourceCombinedPanelId || piece.groupId || piece.id || `K${index + 1}`;
    const atoms = getPieceLabelRects(piece).filter(atom => atom && atom.width > EPS && atom.height > EPS);
    const polygons = Array.isArray(piece.polygons) && piece.polygons.length > 0 ? piece.polygons : null;
    return {
      id: `combined:${label}`,
      label,
      kind: 'combined',
      zIndex: 20 + index,
      atoms,
      polygons,
      bounds: polygons ? getPolygonsBounds(polygons) : atoms.length > 0 ? getAtomsBounds(atoms) : null,
      anchor: getPieceLabelPoint(piece),
    };
  }).filter(element => element.bounds && element.bounds.width > EPS && element.bounds.height > EPS);
}

function getObstacleOverlapElements(plan) {
  return (plan.obstacleRects || []).map((obstacle, index) => ({
    id: `obstacle:${obstacle.id}`,
    label: obstacle.id,
    kind: 'obstacle',
    zIndex: 1000 + index,
    atoms: [obstacle],
    polygons: null,
    bounds: obstacle,
    anchor: rectCenter(obstacle),
  }));
}

function shouldShowCoveredElementCallout(lower, upper) {
  if (!lower || !upper || upper.zIndex <= lower.zIndex || lower.id === upper.id) {
    return false;
  }

  const lowerBounds = getElementShapeBounds(lower);
  const upperBounds = getElementShapeBounds(upper);
  if (!rectIntersects(lowerBounds, upperBounds)) {
    return false;
  }

  return pointInsideRenderedElement(lower.anchor, upper);
}

function renderCoveredElementCallouts(parent, plan) {
  const elements = [
    ...getCombinedOverlapElements(plan),
    ...getObstacleOverlapElements(plan),
  ];

  if (elements.length < 2) {
    return;
  }

  const coveredElements = [];
  const coveredIds = new Set();

  elements.forEach(lower => {
    const coveringElement = elements
      .filter(upper => shouldShowCoveredElementCallout(lower, upper))
      .sort((a, b) => b.zIndex - a.zIndex)[0];

    if (coveringElement && !coveredIds.has(lower.id)) {
      coveredIds.add(lower.id);
      coveredElements.push({ lower, coveringElement });
    }
  });

  if (coveredElements.length === 0) {
    return;
  }

  const blockerRects = elements
    .map(getElementShapeBounds)
    .filter(rect => rect && rect.width > EPS && rect.height > EPS);
  const fontSize = Math.max(0.082, Math.min(0.15, getPanelBaseMeters() * 0.18));

  coveredElements.forEach(({ lower }) => {
    const atoms = getElementCalloutAtoms(lower);
    if (atoms.length === 0) {
      return;
    }

    const placement = getLabelCalloutPlacement(atoms, lower.label, fontSize, {
      blockers: blockerRects,
      calloutKey: `covered:${lower.id}`,
    });

    if (!placement) {
      return;
    }

    appendSvgLabelCallout(parent, lower.label, placement, 'covered-element-callout');
  });
}

function renderCombinedPanelPieces(svg, plan, labelLayer = svg) {
  const labelSize = Math.max(0.1, Math.min(0.2, getPanelBaseMeters() * 0.24));
  const combinationActive = isPanelCombinationActive();
  const deleteActive = isDeleteModeActive();
  const visualPieces = Array.isArray(plan.combinedOriginalPieces) && plan.combinedOriginalPieces.length > 0
    ? plan.combinedOriginalPieces
    : plan.combinedPieces;
  const visiblePieceBySource = new Map((plan.combinedPieces || [])
    .filter(piece => piece.sourceCombinedPanelId)
    .map(piece => [piece.sourceCombinedPanelId, piece]));

  visualPieces.forEach(piece => {
    const sourceCombinedPanelId = piece.sourceCombinedPanelId;
    const visiblePiece = visiblePieceBySource.get(sourceCombinedPanelId) || piece;
    const isCombinedCut = Boolean(visiblePiece?.hasCombinedCut);
    const drawPiece = isCombinedCut ? visiblePiece : piece;
    const canCombineBySurface = Boolean(sourceCombinedPanelId && combinationActive);
    const canDeleteBySurface = Boolean(sourceCombinedPanelId && deleteActive);
    const candidateClass = combinationActive ? ' panel-combination-candidate' : '';
    const deleteTargetClass = canDeleteBySurface ? ' delete-mode-surface-target' : '';
    const semanticClass = isCombinedCut ? ' combined-panel-cut' : '';
    const outlineSourcePiece = isCombinedCut ? piece : drawPiece;
    const fillPath = Array.isArray(drawPiece.polygons) && drawPiece.polygons.length > 0
      ? getPolygonsPathData(drawPiece.polygons)
      : getClosedBoundaryPathData(drawPiece.atoms) || getBoundaryFillPathData(drawPiece.atoms);
    const outlinePath = Array.isArray(outlineSourcePiece.polygons) && outlineSourcePiece.polygons.length > 0
      ? getPolygonsBoundaryPathData(outlineSourcePiece.polygons)
      : getBoundaryPathData(outlineSourcePiece.atoms);

    const fill = createSvgElement('path', {
      class: `combined-panel-fill${semanticClass}${candidateClass}${deleteTargetClass}`,
      d: fillPath,
      'fill-rule': 'evenodd',
    });
    if (canCombineBySurface) {
      fill.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handlePanelCombinationCombinedPanelClick(sourceCombinedPanelId);
      });
    } else if (canDeleteBySurface) {
      fill.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        deleteCombinedPanelInDeleteMode(sourceCombinedPanelId);
      });
    }
    svg.appendChild(fill);

    const outline = createSvgElement('path', {
      class: `combined-panel-outline${semanticClass}${candidateClass}${deleteTargetClass}`,
      d: outlinePath,
    });
    if (canCombineBySurface) {
      outline.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handlePanelCombinationCombinedPanelClick(sourceCombinedPanelId);
      });
    } else if (canDeleteBySurface) {
      outline.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        deleteCombinedPanelInDeleteMode(sourceCombinedPanelId);
      });
    }
    svg.appendChild(outline);

    const largestAtom = getLargestAtom(visiblePiece);
    if (largestAtom) {
      appendAdaptiveSvgLabel(labelLayer, piece.sourceCombinedPanelId || piece.groupId, getPieceLabelRects(visiblePiece), {
        className: isCombinedCut ? 'combined-panel-label combined-panel-cut-label' : 'combined-panel-label',
        calloutClassName: isCombinedCut ? 'combined-panel-label-callout combined-panel-cut-label-callout' : 'combined-panel-label-callout',
        fontSize: Math.min(labelSize, Math.max(0.04, largestAtom.height * 0.72)),
        minFontSize: Math.max(0.056, getPanelBaseMeters() * 0.105),
        minCalloutFontSize: Math.max(0.075, getPanelBaseMeters() * 0.12),
        blockers: plan.obstacleRects,
        calloutKey: `combined:${piece.sourceCombinedPanelId || piece.groupId || piece.id}`,
      });
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

    if (cell.isRotated) {
      group.appendChild(createSvgElement('path', {
        class: 'panel-combination-selected-highlight',
        d: polygonToPathData(cell.polygon),
      }));
      group.appendChild(createSvgElement('path', {
        class: 'panel-combination-selected-frame',
        d: polygonToPathData(cell.polygon),
      }));
    } else {
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
    }
  });

  if (panelCombinationState.rejectedCellId) {
    const rejectedCell = allCellMap.get(panelCombinationState.rejectedCellId);
    if (rejectedCell) {
      if (rejectedCell.isRotated) {
        group.appendChild(createSvgElement('path', {
          class: 'panel-combination-rejected-frame',
          d: polygonToPathData(rejectedCell.polygon),
        }));
      } else {
        group.appendChild(createSvgElement('rect', {
          class: 'panel-combination-rejected-frame',
          x: rejectedCell.x,
          y: rejectedCell.y,
          width: rejectedCell.width,
          height: rejectedCell.height,
        }));
      }
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
  hideMeasurementPointPicker();

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

  const labelLayer = createSvgElement('g', { class: 'svg-label-layer' });

  plan.fullPanelCells.forEach(cell => {
    const fullPanelNode = cell.isRotated
      ? createSvgElement('path', {
        class: `full-panel full-panel-rotated${isPanelCombinationActive() ? ' panel-combination-candidate' : ''}`,
        d: polygonToPathData(cell.polygon),
      })
      : createSvgElement('rect', {
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

  if (!isGridRotated()) {
    appendPanelBoundaryOverlay(svg, plan.blockedPanelCells, plan.obstacleRects, plan.combinedOriginalPieces.flatMap(piece => piece.atoms));
  }

  const labelSize = Math.max(0.09, Math.min(0.18, getPanelBaseMeters() * 0.22));
  plan.cutPieces.forEach(piece => {
    if (Array.isArray(piece.polygons) && piece.polygons.length > 0) {
      svg.appendChild(createSvgElement('path', {
        class: 'cut-piece-fill cut-piece-fill-rotated',
        d: getPolygonsPathData(piece.polygons),
        'fill-rule': 'evenodd',
      }));
      svg.appendChild(createSvgElement('path', {
        class: 'cut-piece-outline cut-piece-outline-rotated',
        d: getPolygonsBoundaryPathData(piece.polygons),
      }));
    } else {
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
    }

    const largestAtom = getLargestAtom(piece);
    if (largestAtom) {
      appendAdaptiveSvgLabel(labelLayer, piece.groupId, getPieceLabelRects(piece), {
        className: 'piece-label',
        calloutClassName: 'piece-label-callout',
        fontSize: Math.min(labelSize, Math.max(0.035, largestAtom.height * 0.72)),
        minFontSize: Math.max(0.052, getPanelBaseMeters() * 0.095),
        minCalloutFontSize: Math.max(0.07, getPanelBaseMeters() * 0.115),
        blockers: plan.obstacleRects,
        calloutKey: `cut:${piece.id || piece.mergeKey || piece.groupId}`,
      });
    }
  });

  renderCombinedPanelPieces(svg, plan, labelLayer);


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
      if (isMeasurementModeActive()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (isDeleteModeActive()) {
        event.stopPropagation();
        return;
      }

      if (isLocalReferenceActive() || isObstacleAlignmentActive() || isPanelCombinationActive()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      startObstacleDrag(event, obstacle.id);
    });
    obstacleNode.addEventListener('click', event => {
      event.stopPropagation();
      if (isMeasurementModeActive()) {
        event.preventDefault();
        return;
      }

      if (isPanelCombinationActive()) {
        return;
      }

      if (isDeleteModeActive()) {
        event.preventDefault();
        deleteObstacleInDeleteMode(obstacle.id);
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

  });

  renderTrueCenterGuides(svg);
  renderCoveredElementCallouts(labelLayer, plan);
  svg.appendChild(labelLayer);
  renderMeasurementOverlay(svg, plan);
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
  const basis = getCoordinateBasis();
  const origin = basis.origin;
  const labelPoint = {
    x: origin.x + (basis.xAxis.x + basis.yAxis.x) * size * 0.22,
    y: origin.y + (basis.xAxis.y + basis.yAxis.y) * size * 0.22,
  };

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
    x2: origin.x + basis.xAxis.x * size,
    y2: origin.y + basis.xAxis.y * size,
  }));
  svg.appendChild(createSvgElement('line', {
    class: 'origin-axis',
    x1: origin.x,
    y1: origin.y,
    x2: origin.x + basis.yAxis.x * size,
    y2: origin.y + basis.yAxis.y * size,
  }));
  appendSvgText(svg, '0', {
    class: 'origin-label',
    x: labelPoint.x,
    y: labelPoint.y,
    'font-size': size * 0.34,
  });
}

function renderTrueCenterGuides(svg) {
  if (!isTrueCenterEnabled()) {
    return;
  }

  const { pointMap, lines } = getTrueCenterGuideGeometry();
  const group = createSvgElement('g', { class: 'true-center-guides' });

  lines.forEach(line => {
    const start = pointMap.get(line.startId);
    const end = pointMap.get(line.endId);
    if (!start || !end) {
      return;
    }

    group.appendChild(createSvgElement('line', {
      class: 'true-center-guide-line',
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    }));
  });

  svg.appendChild(group);
}

function renderMeasurementPointBadge(parent, point, radius) {
  const fontSize = getMeasurementOverlayFontSize();
  const textWidth = Math.max(fontSize * 1.7, point.displayId.length * fontSize * 0.68);
  const boxWidth = textWidth + fontSize * 0.7;
  const boxHeight = fontSize * 1.3;
  const boxX = point.x - (boxWidth / 2);
  const boxY = point.y - radius * 3.1 - boxHeight;

  parent.appendChild(createSvgElement('rect', {
    class: 'measurement-point-id-box',
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
  }));
  appendSvgText(parent, point.displayId, {
    class: 'measurement-point-id-text',
    x: point.x,
    y: boxY + boxHeight / 2,
    'font-size': fontSize,
  });
}

function getMeasurementOverlayFontSize() {
  return Math.max(0.11, Math.min(0.15, getPanelBaseMeters() * 0.22));
}

function renderMeasurementOverlay(svg, plan) {
  if (!isMeasurementModeActive()) {
    return;
  }

  const { points, selectedPoints } = getMeasurementPointSelection(plan);
  const group = createSvgElement('g', { class: 'measurement-overlay' });
  const radius = Math.max(0.026, Math.min(0.06, getPanelBaseMeters() * 0.07));
  const geometryHalfSize = Math.max(radius * 1.05, getMeasurementOverlayFontSize() * 0.42);
  const selectedPointIdSet = new Set(selectedPoints.map(point => point.id));
  const overlapMap = getMeasurementPointOverlapMap(points, radius, geometryHalfSize);
  const regularPoints = points.filter(point => !isGeometryMeasurementPoint(point));
  const geometryPoints = points.filter(point => isGeometryMeasurementPoint(point));

  const renderSelectablePoint = point => {
    const isSelected = selectedPointIdSet.has(point.id);
    const overlapCluster = overlapMap.get(point.id) || [];
    const pointClasses = ['measurement-point', isGeometryMeasurementPoint(point) ? 'geometry' : 'regular'];
    if (isSelected) {
      pointClasses.push('selected');
    }
    if (overlapCluster.length > 1) {
      pointClasses.push('overlap-candidate');
    }
    const node = isGeometryMeasurementPoint(point)
      ? createSvgElement('rect', {
        class: pointClasses.join(' '),
        x: point.x - geometryHalfSize,
        y: point.y - geometryHalfSize,
        width: geometryHalfSize * 2,
        height: geometryHalfSize * 2,
        rx: geometryHalfSize * 0.22,
        ry: geometryHalfSize * 0.22,
        tabindex: 0,
        role: 'button',
        'aria-label': `Geometriepunkt ${point.displayId}`,
        'data-measurement-point-id': point.id,
      })
      : createSvgElement('circle', {
        class: pointClasses.join(' '),
        cx: point.x,
        cy: point.y,
        r: radius,
        tabindex: 0,
        role: 'button',
        'aria-label': `Messpunkt ${point.displayId}`,
        'data-measurement-point-id': point.id,
      });

    const openOverlapPicker = event => {
      if (overlapCluster.length <= 1) {
        hideMeasurementPointPicker();
        return false;
      }
      showMeasurementPointPicker(overlapCluster, event.clientX, event.clientY);
      return true;
    };

    const selectPoint = event => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.currentTarget?.blur === 'function') {
        event.currentTarget.blur();
      }
      if (openOverlapPicker(event)) {
        return;
      }
      hideMeasurementPointPicker();
      selectMeasurementPointById(point.id);
    };

    node.addEventListener('pointerdown', event => {
      event.preventDefault();
    });
    node.addEventListener('pointerenter', event => {
      if (overlapCluster.length <= 1) {
        hideMeasurementPointPicker();
        return;
      }
      showMeasurementPointPicker(overlapCluster, event.clientX, event.clientY);
    });
    node.addEventListener('click', selectPoint);
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        selectPoint(event);
      }
    });
    group.appendChild(node);

    if (isSelected) {
      renderMeasurementPointBadge(group, point, radius);
    }
  };

  regularPoints.forEach(renderSelectablePoint);
  geometryPoints.forEach(renderSelectablePoint);

  if (isEditingMeasurement() && selectedPoints.length > 0) {
    const overlayFontSize = getMeasurementOverlayFontSize();
    selectedPoints.forEach((point, index) => {
      const removeRadius = Math.max(radius * 1.06, overlayFontSize * 0.58);
      const removeCenterX = point.x + radius * 1.35;
      const removeCenterY = point.y - radius * 1.35;
      const removeNode = createSvgElement('circle', {
        class: 'measurement-point-remove',
        cx: removeCenterX,
        cy: removeCenterY,
        r: removeRadius,
        tabindex: 0,
        role: 'button',
        'aria-label': `Messpunkt ${point.displayId} ersetzen`,
      });

      const removePoint = event => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.currentTarget?.blur === 'function') {
          event.currentTarget.blur();
        }
        measurementModeState.selectedPointIds = selectedPoints
          .filter((_, selectedIndex) => selectedIndex !== index)
          .map(selectedPoint => selectedPoint.id);
        measurementModeState.editingMissingSlotIndex = index;
        measurementModeState.previewMeasurementId = null;
        updateMeasurementModeButton();
        renderSvg(latestPlan || calculatePlan());
      };

      removeNode.addEventListener('pointerdown', event => {
        event.preventDefault();
      });
      removeNode.addEventListener('click', removePoint);
      removeNode.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          removePoint(event);
        }
      });
      group.appendChild(removeNode);
      appendSvgText(group, '×', {
        class: 'measurement-point-remove-text',
        x: removeCenterX,
        y: removeCenterY,
        'font-size': Math.max(overlayFontSize * 1.08, removeRadius * 1.24),
      });
    });
  }

  if (selectedPoints.length >= 2) {
    const [pointA, pointB] = selectedPoints;
    const centerX = (pointA.x + pointB.x) / 2;
    const centerY = (pointA.y + pointB.y) / 2;
    const distance = getMeasurementDistanceMeters(pointA, pointB);
    const fontSize = getMeasurementOverlayFontSize();
    const label = `${formatMeters(distance)} m`;
    const showInlineActions = !measurementModeState.previewMeasurementId || isEditingMeasurement();
    const actionDiameter = fontSize * 1.08;
    const actionGap = fontSize * 0.34;
    const actionBlockWidth = showInlineActions ? (actionDiameter * 2) + actionGap + (fontSize * 1.1) : 0;
    const calloutKey = measurementModeState.editingMeasurementId
      ? `measurement:${measurementModeState.editingMeasurementId}`
      : `measurement:${selectedPoints.map(point => point.id).join('::')}`;
    const calloutPlacement = getMeasurementDistanceCalloutPlacement(
      { x: centerX, y: centerY },
      label,
      fontSize,
      {
        calloutKey,
        actionWidth: actionBlockWidth,
      },
    );

    group.appendChild(createSvgElement('line', {
      class: 'measurement-distance-line measurement-distance-line-underlay',
      x1: pointA.x,
      y1: pointA.y,
      x2: pointB.x,
      y2: pointB.y,
    }));

    group.appendChild(createSvgElement('line', {
      class: 'measurement-distance-line',
      x1: pointA.x,
      y1: pointA.y,
      x2: pointB.x,
      y2: pointB.y,
    }));
    appendMeasurementDistanceCallout(group, label, calloutPlacement, {
      actionDiameter,
      actionGap,
      actions: showInlineActions ? [
        {
          labelText: '✓',
          ariaLabel: isEditingMeasurement() ? 'Maßänderung speichern' : 'Messung speichern',
          variant: 'apply',
          handler: commitMeasurementSelection,
        },
        {
          labelText: '×',
          ariaLabel: isEditingMeasurement() ? 'Maßänderung verwerfen' : 'Messung verwerfen',
          variant: 'cancel',
          handler: clearMeasurementPreview,
        },
      ] : [],
    });
  }

  svg.appendChild(group);
}

function renderSavedMeasurementsTable() {
  if (!elements.measurementSavedTable || !elements.measurementSavedSection) {
    return;
  }

  elements.measurementSavedSection.hidden = false;
  elements.measurementSavedTable.innerHTML = '';

  const collections = getMeasurementCollectionsForDisplay();
  if (collections.length === 0) {
    elements.measurementSavedTable.innerHTML = '<p class="measurement-empty-state">Noch keine Maße gespeichert.</p>';
    return;
  }

  collections.forEach(collection => {
    const current = isMeasurementCollectionCurrent(collection);
    const card = document.createElement('section');
    card.className = `measurement-config-card${current ? ' current' : ''}`;
    card.innerHTML = `
      <header class="measurement-config-header">
        <div>
          <h3>${current ? 'Aktuelle Konfiguration' : 'Gespeicherte Konfiguration'}</h3>
          <p class="measurement-config-summary">${escapeHtml(collection.label || formatMeasurementConfigSummary(collection.configSnapshot))}</p>
        </div>
        <span class="measurement-config-badge">${current ? 'aktiv' : 'nur Ansicht'}</span>
      </header>
      ${current ? '' : `<p class="measurement-config-note">Bearbeiten ist erst wieder möglich, wenn links dieselbe Konfiguration aktiv ist.</p>`}
    `;

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Punkt A</th>
          <th>Punkt B</th>
          <th>Abstand (m)</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    if (!collection.measurements.length) {
      tbody.innerHTML = '<tr><td class="empty-row" colspan="4">Noch keine Maße gespeichert.</td></tr>';
    }

    collection.measurements.forEach(entry => {
      const row = document.createElement('tr');
      const isActive = current && measurementModeState.previewMeasurementId === entry.id;
      row.className = `measurement-saved-row${isActive ? ' active' : ''}${current ? '' : ' is-readonly'}`;
      row.dataset.measurementSavedRow = entry.id;
      row.innerHTML = `
        <td>${escapeHtml(entry.pointDisplayIds?.[0] || entry.pointIds[0])}</td>
        <td>${escapeHtml(entry.pointDisplayIds?.[1] || entry.pointIds[1])}</td>
        <td>${formatMeters(entry.distanceMeters)}</td>
        <td>
          <div class="measurement-row-actions">
            <button class="measurement-row-icon" type="button" data-measurement-edit="${escapeHtml(entry.id)}" aria-label="Maß bearbeiten"${current ? '' : ' data-measurement-readonly="true"'}>✎</button>
            <button class="measurement-row-icon" type="button" data-measurement-delete="${escapeHtml(entry.id)}" aria-label="Maß löschen"${current ? '' : ' data-measurement-readonly="true"'}>🗑</button>
          </div>
        </td>
      `;
      row.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!current) {
          showMeasurementCollectionMismatchMessage(collection);
          return;
        }
        previewSavedMeasurement(entry.id);
      });
      row.querySelector('[data-measurement-edit]')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!current) {
          showMeasurementCollectionMismatchMessage(collection);
          return;
        }
        startEditingMeasurement(entry.id);
      });
      row.querySelector('[data-measurement-delete]')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!current) {
          showMeasurementCollectionMismatchMessage(collection);
          return;
        }
        deleteSavedMeasurement(entry.id);
      });
      tbody.appendChild(row);
    });

    tableWrap.appendChild(table);
    card.appendChild(tableWrap);
    elements.measurementSavedTable.appendChild(card);
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

function getGridAlignmentSummaryText(alignmentX = state.grid.alignmentX, alignmentY = state.grid.alignmentY, trueCenter = isTrueCenterEnabled()) {
  const suffix = trueCenter ? ' · Wahre Mitte' : '';
  return `${getAlignmentXLabel(alignmentX)} / ${getAlignmentYLabel(alignmentY)}${suffix}`;
}

function getCurrentGridReportBounds() {
  if (isGridRotated()) {
    const bounds = getRotatedGridVisibleCornerBounds(getGridBasis());
    if (bounds) {
      return {
        minX: bounds.minX,
        maxX: bounds.maxX,
        minY: bounds.minY,
        maxY: bounds.maxY,
      };
    }

    const cells = getRotatedGridCells();
    const polygons = cells
      .map(cell => cell.roomPolygon || cell.polygon || [])
      .filter(polygon => getPolygonArea(polygon) > EPS);
    const fallbackBounds = getPolygonsBounds(polygons);
    return {
      minX: fallbackBounds.x,
      maxX: fallbackBounds.x + fallbackBounds.width,
      minY: fallbackBounds.y,
      maxY: fallbackBounds.y + fallbackBounds.height,
    };
  }

  const grid = getGridRect();
  return {
    minX: grid.x,
    maxX: grid.x + grid.width,
    minY: grid.y,
    maxY: grid.y + grid.height,
  };
}

function getGridEdgeOffsets() {
  const bounds = getCurrentGridReportBounds();
  return {
    links: Math.max(0, bounds.minX),
    rechts: Math.max(0, state.room.widthMeters - bounds.maxX),
    oben: Math.max(0, bounds.minY),
    unten: Math.max(0, state.room.heightMeters - bounds.maxY),
  };
}

function formatGridEdgeOffsetsText() {
  const offsets = getGridEdgeOffsets();
  return [
    `links ${formatMeters(offsets.links)} m`,
    `rechts ${formatMeters(offsets.rechts)} m`,
    `oben ${formatMeters(offsets.oben)} m`,
    `unten ${formatMeters(offsets.unten)} m`,
  ].join(' · ');
}

function getGridEdgeOffsetReportLines() {
  const offsets = getGridEdgeOffsets();
  return [
    'Randabstände:',
    reportSubline(`links: ${formatMeters(offsets.links)} m`),
    reportSubline(`rechts: ${formatMeters(offsets.rechts)} m`),
    reportSubline(`oben: ${formatMeters(offsets.oben)} m`),
    reportSubline(`unten: ${formatMeters(offsets.unten)} m`),
  ];
}

function getObstacleReportLine(obstacle) {
  return reportSubline(`${obstacle.id}: ${formatMeters(obstacle.widthMeters)} × ${formatMeters(obstacle.heightMeters)} m`);
}

function normalizeReportLine(line) {
  if (line === null || line === undefined) {
    return null;
  }

  if (typeof line === 'object') {
    const text = line.html !== undefined ? String(line.html) : escapeHtml(String(line.text ?? ''));
    return {
      html: text,
      indent: Boolean(line.indent),
    };
  }

  return {
    html: String(line),
    indent: false,
  };
}

function reportSubline(text) {
  return { text, indent: true };
}

function reportParagraphs(lines) {
  return lines
    .map(normalizeReportLine)
    .filter(line => line && String(line.html).trim() !== '')
    .map(line => `<p${line.indent ? ' class="report-subline"' : ''}>${line.html}</p>`)
    .join('');
}

function renderDrawingReport(plan) {
  if (!elements.drawingStatusReport) {
    return;
  }

  const grid = getGridRect();
  const obstacleLines = state.obstacles.length > 0
    ? state.obstacles.map(getObstacleReportLine)
    : [];
  const combinedText = plan.combinedPanelCount > 0
    ? reportParagraphs([
      `${plan.combinedPanelCount} kombinierte Paneel-Elemente`,
      reportSubline(`aus ${plan.combinedStandardCellCount} Standard-Raster-Paneelen`),
      plan.combinedCutGroups.length > 0
        ? reportSubline(`${plan.combinedCutGroups.length} Zuschnitt-Form${plan.combinedCutGroups.length === 1 ? '' : 'en'} an kombinierten Paneelen`)
        : '',
    ])
    : '<p>keine kombinierten Paneele</p>';

  elements.drawingStatusReport.innerHTML = `
    <dl class="drawing-report-grid">
      <div><dt>Raum</dt><dd>${reportParagraphs([
        `${formatMeters(state.room.widthMeters)} × ${formatMeters(state.room.heightMeters)} m`,
        `Koordinaten-Nullpunkt: ${escapeHtml(getCornerLabel(state.originCorner))}`,
      ])}</dd></div>
      <div><dt>Raster</dt><dd>${reportParagraphs(isGridRotated() ? [
        `Rastermaß: ${formatMeters(getPanelWidthMeters())} × ${formatMeters(getPanelHeightMeters())} m`,
        `Rasterwinkel: ${formatMeters(getGridRotationDegrees(), 1)}°`,
        `Ausrichtung: ${escapeHtml(getGridAlignmentSummaryText())}`,
        ...getGridEdgeOffsetReportLines(),
      ] : [
        `Rastermaß: ${formatMeters(getPanelWidthMeters())} × ${formatMeters(getPanelHeightMeters())} m`,
        `Raster: ${grid.cols} × ${grid.rows}`,
        `Ausrichtung: ${escapeHtml(getGridAlignmentSummaryText())}`,
        ...getGridEdgeOffsetReportLines(),
      ])}</dd></div>
      <div><dt>Sperrflächen</dt><dd>${reportParagraphs([`${state.obstacles.length} Stück`, ...obstacleLines])}</dd></div>
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
  syncMeasurementsForCurrentConfig();
  latestPlan = calculatePlan();
  syncCurrentStateIntoActiveWorkspaceTab();
  updateAlignmentControls();
  updateObstacleEditModeButton();
  updateLocalReferenceButton();
  updateObstacleAlignmentButton();
  updatePanelCombinationButton();
  updateDeleteModeButton();
  updateMeasurementModeButton();
  renderSvg(latestPlan);
  renderCuttingTable(latestPlan);
  renderCombinedPanelsTable(latestPlan);
  renderCombinedCutPanelsTable(latestPlan);
  renderPackingTable(latestPlan);
  renderSavedMeasurementsTable();
  renderDrawingReport(latestPlan);
  renderTotals(latestPlan);
  renderWorkspaceTabs();
  updateConfigurationWorkspaceStatus();
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
          <p>${formatMeters(state.room.widthMeters)} × ${formatMeters(state.room.heightMeters)} m · Paneel ${formatMeters(getPanelWidthMeters())} × ${formatMeters(getPanelHeightMeters())} m · ${isGridRotated() ? `Winkel ${formatMeters(getGridRotationDegrees(), 1)}°` : `Raster ${getGridCols()} × ${getGridRows()}`} · Ausrichtung ${escapeHtml(getGridAlignmentSummaryText())} · Rand ${escapeHtml(formatGridEdgeOffsetsText())} · ${state.obstacles.length} Sperrfläche(n) · ${plan.combinedPanelCount} kombiniert</p>
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
  measurementModeState = createEmptyMeasurementModeState();
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
  if (!input) {
    return;
  }

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

  bindNumberInput(elements.gridAngleInput, value => {
    setGridRotationDegrees(value);
  });

  getGridAnglePresetButtons().forEach(({ button, angle }) => {
    button.addEventListener('click', () => {
      setGridRotationDegrees(angle);
      applyStateToInputs();
      updateAll();
      saveConfigDebounced();
    });
  });

  elements.alignLeftButton.addEventListener('click', () => setGridAlignment('left', state.grid.alignmentY));
  elements.alignCenterXButton.addEventListener('click', () => setGridAlignment('center', state.grid.alignmentY));
  elements.alignRightButton.addEventListener('click', () => setGridAlignment('right', state.grid.alignmentY));
  elements.alignTopButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'top'));
  elements.alignCenterYButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'center'));
  elements.alignBottomButton.addEventListener('click', () => setGridAlignment(state.grid.alignmentX, 'bottom'));
  elements.trueCenterCheckbox?.addEventListener('change', () => {
    state.grid.trueCenter = elements.trueCenterCheckbox.checked;
    updateAll();
    saveConfigDebounced();
  });

  elements.originCornerSelect?.addEventListener('change', () => {
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
  elements.deleteModeClearObstaclesButton?.addEventListener('click', deleteAllObstaclesInDeleteMode);
  elements.deleteModeClearCombinedPanelsButton?.addEventListener('click', deleteAllCombinedPanelsInDeleteMode);
  elements.deleteModeApplyButton?.addEventListener('click', commitDeleteModeChanges);
  elements.deleteModeCancelButton?.addEventListener('click', cancelDeleteModeChanges);
  elements.measurementButton?.addEventListener('click', toggleMeasurementMode);
  elements.measurementApplyButton?.addEventListener('click', commitMeasurementSelection);
  elements.measurementCancelButton?.addEventListener('click', clearMeasurementPreview);
  elements.configurationSaveButton?.addEventListener('click', saveCurrentConfigurationToStorage);
  elements.workspaceNewTabButton?.addEventListener('click', createNewWorkspaceTab);
  elements.printButton.addEventListener('click', printReport);
  window.addEventListener('pointermove', updateObstacleDrag);
  window.addEventListener('pointerup', finishObstacleDrag);
  window.addEventListener('pointercancel', finishObstacleDrag);
  window.addEventListener('pointermove', updateLabelCalloutDrag);
  window.addEventListener('pointerup', finishLabelCalloutDrag);
  window.addEventListener('pointercancel', finishLabelCalloutDrag);
  window.addEventListener('resize', () => {
    renderSvg(latestPlan || calculatePlan());
    refreshWorkflowTimelineConnectors();
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(saveTimer);
    syncCurrentStateIntoActiveWorkspaceTab();
    persistWorkspaceKeepalive();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') {
      return;
    }
    clearTimeout(saveTimer);
    syncCurrentStateIntoActiveWorkspaceTab();
    persistWorkspaceKeepalive();
  });
  document.addEventListener('click', event => {
    const target = event.target;
    if (target?.closest?.('[data-measurement-point-picker]')) {
      return;
    }

    hideMeasurementPointPicker();

    if (!isMeasurementModeActive() || !measurementModeState.previewMeasurementId) {
      return;
    }

    if (target?.closest?.('[data-measurement-saved-row]') || target?.closest?.('[data-measurement-point-id]')) {
      return;
    }

    clearMeasurementPreview();
  });
  elements.svgFrame?.addEventListener('pointerleave', () => {
    hideMeasurementPointPicker();
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
      shapePolygons: group.normalizedPolygons || null,
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
      shapePolygons: group.normalizedPolygons || null,
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
      shapePolygons: group.normalizedPolygons || null,
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
  await refreshConfigurationStorageList({
    message: 'Projekt-Registerkarten geladen.',
  });
}

init();
