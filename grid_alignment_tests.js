#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_PATH = path.join(__dirname, 'app.js');
const source = fs.readFileSync(APP_PATH, 'utf8').replace(/\ninit\(\);\s*$/, '\n');

function createStubElement() {
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    style: {},
    dataset: {},
    appendChild() {},
    remove() {},
    replaceChildren() {},
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    cloneNode() { return createStubElement(); },
  };
}

const context = {
  console,
  document: {
    getElementById() { return createStubElement(); },
    createElement() { return createStubElement(); },
    createElementNS() { return createStubElement(); },
    body: createStubElement(),
    addEventListener() {},
  },
  window: {
    setTimeout() { return 0; },
    clearTimeout() {},
    addEventListener() {},
    innerWidth: 1200,
  },
  URL: {
    createObjectURL() { return 'blob:test'; },
    revokeObjectURL() {},
  },
  Blob: function BlobStub() {},
  fetch: async () => ({ ok: true, json: async () => ({}) }),
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'app.js' });

const ROOM_WIDTH = 8.861;
const ROOM_HEIGHT = 4.865;
const TOLERANCE = 0.00001;

function getFullPanelCornerBounds(angle, alignmentX, alignmentY) {
  const script = `
    state.room.widthMeters = ${ROOM_WIDTH};
    state.room.heightMeters = ${ROOM_HEIGHT};
    state.grid.panelWidthMeters = 0.6;
    state.grid.panelHeightMeters = 0.6;
    state.originCorner = 'top-left';
    state.grid.rotationDegrees = ${angle};
    state.grid.alignmentX = '${alignmentX}';
    state.grid.alignmentY = '${alignmentY}';
    state.grid.trueCenter = false;
    (() => {
      const cells = getRotatedGridCells();
      const fullPanelCells = getFullPanelCells(cells, []);
      const points = fullPanelCells.flatMap(cell => cell.polygon || []);
      const xs = points.map(point => point.x);
      const ys = points.map(point => point.y);
      return JSON.stringify({
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        fullPanelCount: fullPanelCells.length,
        pointCount: points.length,
      });
    })();
  `;

  const result = JSON.parse(vm.runInContext(script, context));
  assert.ok(result, `no bounds for angle=${angle}, x=${alignmentX}, y=${alignmentY}`);
  assert.ok(result.fullPanelCount > 0, `no full panel cells for angle=${angle}, x=${alignmentX}, y=${alignmentY}`);
  return result;
}

function assertAlmostEqual(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) <= TOLERANCE,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function assertAlignment(angle, alignmentX, alignmentY) {
  const bounds = getFullPanelCornerBounds(angle, alignmentX, alignmentY);

  if (alignmentX === 'left') {
    assertAlmostEqual(bounds.minX, 0, `left edge at ${angle}°`);
  } else if (alignmentX === 'right') {
    assertAlmostEqual(bounds.maxX, ROOM_WIDTH, `right edge at ${angle}°`);
  } else if (alignmentX === 'center') {
    assertAlmostEqual(bounds.minX + bounds.maxX, ROOM_WIDTH, `center X at ${angle}°`);
  }

  if (alignmentY === 'top') {
    assertAlmostEqual(bounds.minY, 0, `top edge at ${angle}°`);
  } else if (alignmentY === 'bottom') {
    assertAlmostEqual(bounds.maxY, ROOM_HEIGHT, `bottom edge at ${angle}°`);
  } else if (alignmentY === 'center') {
    assertAlmostEqual(bounds.minY + bounds.maxY, ROOM_HEIGHT, `center Y at ${angle}°`);
  }
}

const angles = [5, -5, 12.5, -12.5, 20, -20, 30, -30, 45, -45, 67, -67];
const alignments = [
  ['left', 'center'],
  ['right', 'center'],
  ['center', 'top'],
  ['center', 'bottom'],
  ['left', 'top'],
  ['right', 'bottom'],
  ['center', 'center'],
];

for (const angle of angles) {
  for (const [alignmentX, alignmentY] of alignments) {
    assertAlignment(angle, alignmentX, alignmentY);
  }
}

const trueCenterRect = JSON.parse(vm.runInContext(`
  state.room.widthMeters = 7;
  state.room.heightMeters = 7;
  state.grid.panelWidthMeters = 2;
  state.grid.panelHeightMeters = 2;
  state.grid.panelGapMeters = 0;
  state.grid.rotationDegrees = 0;
  state.grid.alignmentX = 'center';
  state.grid.alignmentY = 'center';
  state.grid.trueCenter = true;
  JSON.stringify(getGridRect());
`, context));

assert.equal(trueCenterRect.cols, 2, 'true center should keep an even number of full columns');
assert.equal(trueCenterRect.rows, 2, 'true center should keep an even number of full rows');
assertAlmostEqual(trueCenterRect.x, 1.5, 'true center X offset');
assertAlmostEqual(trueCenterRect.y, 1.5, 'true center Y offset');

const gappedGridRect = JSON.parse(vm.runInContext(`
  state.room.widthMeters = 3.1;
  state.room.heightMeters = 3.1;
  state.grid.panelWidthMeters = 1;
  state.grid.panelHeightMeters = 1;
  state.grid.panelGapMeters = 0.1;
  state.grid.rotationDegrees = 0;
  state.grid.alignmentX = 'left';
  state.grid.alignmentY = 'top';
  state.grid.trueCenter = false;
  JSON.stringify({
    rect: getGridRect(),
    cells: getAllGridCells(),
  });
`, context));

assert.equal(gappedGridRect.rect.cols, 2, 'gapped grid should fit two columns when the pitch exceeds the remaining room width');
assert.equal(gappedGridRect.rect.rows, 2, 'gapped grid should fit two rows when the pitch exceeds the remaining room height');
assertAlmostEqual(gappedGridRect.rect.width, 2.1, 'gapped grid width should include the inter-panel gap');
assertAlmostEqual(gappedGridRect.rect.height, 2.1, 'gapped grid height should include the inter-panel gap');
assertAlmostEqual(gappedGridRect.cells[1].x, 1.1, 'second gapped cell should start after panel width plus gap');
assertAlmostEqual(gappedGridRect.cells[2].y, 1.1, 'third gapped cell should start after panel height plus gap');

const trueCenterGapRect = JSON.parse(vm.runInContext(`
  state.room.widthMeters = 5;
  state.room.heightMeters = 5;
  state.grid.panelWidthMeters = 1;
  state.grid.panelHeightMeters = 1;
  state.grid.panelGapMeters = 0.2;
  state.grid.rotationDegrees = 0;
  state.grid.alignmentX = 'center';
  state.grid.alignmentY = 'center';
  state.grid.trueCenter = true;
  JSON.stringify(getGridRect());
`, context));

assert.equal(trueCenterGapRect.cols, 4, 'true center with gaps should keep an even number of columns');
assert.equal(trueCenterGapRect.rows, 4, 'true center with gaps should keep an even number of rows');
assertAlmostEqual(trueCenterGapRect.x, 0.2, 'true center with gaps should stay symmetric on X');
assertAlmostEqual(trueCenterGapRect.y, 0.2, 'true center with gaps should stay symmetric on Y');

const rotatedTrueCenter = JSON.parse(vm.runInContext(`
  state.room.widthMeters = ${ROOM_WIDTH};
  state.room.heightMeters = ${ROOM_HEIGHT};
  state.grid.panelWidthMeters = 0.6;
  state.grid.panelHeightMeters = 0.6;
  state.originCorner = 'top-left';
  state.grid.rotationDegrees = 45;
  state.grid.alignmentX = 'center';
  state.grid.alignmentY = 'center';
  state.grid.trueCenter = true;
  (() => {
    const basis = getGridBasis();
    const roomCenter = { x: state.room.widthMeters / 2, y: state.room.heightMeters / 2 };
    const centerCoords = pointToBasisCoordinates(roomCenter, basis);
    return JSON.stringify({
      originX: basis.origin.x,
      originY: basis.origin.y,
      centerX: centerCoords.x,
      centerY: centerCoords.y,
    });
  })();
`, context));

assertAlmostEqual(rotatedTrueCenter.originX, ROOM_WIDTH / 2, 'rotated true center origin X');
assertAlmostEqual(rotatedTrueCenter.originY, ROOM_HEIGHT / 2, 'rotated true center origin Y');
assertAlmostEqual(rotatedTrueCenter.centerX, 0, 'rotated true center basis X');
assertAlmostEqual(rotatedTrueCenter.centerY, 0, 'rotated true center basis Y');

const trueCenterGuides = JSON.parse(vm.runInContext(`
  state.room.widthMeters = 8;
  state.room.heightMeters = 6;
  JSON.stringify(getTrueCenterGuideGeometry());
`, context));

assert.equal(trueCenterGuides.points.length, 9, 'true center guide should expose nine selectable points');
assert.equal(trueCenterGuides.lines.length, 4, 'true center guide should expose four construction lines');
assert.deepEqual(
  trueCenterGuides.points.find(point => point.id === 'center'),
  { id: 'center', x: 4, y: 3 },
  'true center guide center point',
);
assert.deepEqual(
  trueCenterGuides.points.find(point => point.id === 'mid-left'),
  { id: 'mid-left', x: 0, y: 3 },
  'true center guide left midpoint',
);

const measurementPoints = JSON.parse(vm.runInContext(`
  state.room.widthMeters = 2;
  state.room.heightMeters = 2;
  state.grid.panelWidthMeters = 1;
  state.grid.panelHeightMeters = 1;
  state.grid.panelGapMeters = 0;
  state.grid.rotationDegrees = 0;
  state.grid.alignmentX = 'left';
  state.grid.alignmentY = 'top';
  state.grid.trueCenter = false;
  state.obstacles = [];
  state.combinedPanels = [];
  JSON.stringify(getMeasurementPoints(calculatePlan()));
`, context));

assert.equal(measurementPoints.length, 9, 'measurement mode should expose all unique 2x2 grid nodes');
assert.equal(measurementPoints[0].displayId, 'P1', 'measurement points should receive stable display ids');
assert.deepEqual(
  measurementPoints.find(point => point.x === 1 && point.y === 1),
  {
    id: 'pt:1,1',
    x: 1,
    y: 1,
    sources: [
      { kind: 'full-panel', sourceId: 'R1C1' },
      { kind: 'full-panel', sourceId: 'R1C2' },
      { kind: 'full-panel', sourceId: 'R2C1' },
      { kind: 'full-panel', sourceId: 'R2C2' },
    ],
    displayId: 'P5',
  },
  'measurement mode center grid node',
);

const measurementDistance = Number(vm.runInContext(`
  getMeasurementDistanceMeters({ x: 0, y: 0 }, { x: 3, y: 4 });
`, context));

assertAlmostEqual(measurementDistance, 5, 'measurement mode should use euclidean distance between two selected points');

const measurementConfigKeyWithoutOriginShift = String(vm.runInContext(`
  state.room.widthMeters = 5;
  state.room.heightMeters = 4;
  state.grid.panelWidthMeters = 0.6;
  state.grid.panelHeightMeters = 1.2;
  state.grid.panelGapMeters = 0.005;
  state.grid.panelGapUnit = 'mm';
  state.grid.alignmentX = 'center';
  state.grid.alignmentY = 'bottom';
  state.grid.trueCenter = true;
  state.grid.rotationDegrees = 45;
  state.obstacles = [{ id: 'S2', x: 1, y: 2, widthMeters: 0.4, heightMeters: 0.5 }];
  state.combinedPanels = [{ id: 'K2', cellIds: ['B2', 'A1'] }];
  state.originCorner = 'top-left';
  const first = getCurrentMeasurementConfigKey();
  state.originCorner = 'bottom-right';
  const second = getCurrentMeasurementConfigKey();
  JSON.stringify({ first, second });
`, context));

assert.deepEqual(
  JSON.parse(measurementConfigKeyWithoutOriginShift),
  (() => {
    const parsed = JSON.parse(measurementConfigKeyWithoutOriginShift);
    return { first: parsed.first, second: parsed.first };
  })(),
  'measurement configuration key should ignore origin corner changes',
);

const measurementConfigKeyWithGapChange = JSON.parse(vm.runInContext(`
  (() => {
    state.room.widthMeters = 5;
    state.room.heightMeters = 4;
    state.grid.panelWidthMeters = 0.6;
    state.grid.panelHeightMeters = 1.2;
    state.grid.panelGapUnit = 'mm';
    state.grid.panelGapMeters = 0;
    const first = getCurrentMeasurementConfigKey();
    state.grid.panelGapMeters = 0.005;
    const second = getCurrentMeasurementConfigKey();
    return JSON.stringify({ first, second });
  })();
`, context));

assert.notEqual(
  measurementConfigKeyWithGapChange.first,
  measurementConfigKeyWithGapChange.second,
  'measurement configuration key should change when the panel gap changes',
);

const migratedMeasurementCollections = JSON.parse(vm.runInContext(`
  mergeState({
    schemaVersion: 6,
    room: { widthMeters: 3, heightMeters: 2 },
    grid: {
      panelWidthMeters: 1,
      panelHeightMeters: 1,
      alignmentX: 'left',
      alignmentY: 'top',
      trueCenter: false,
      rotationDegrees: 0,
    },
    obstacles: [],
    combinedPanels: [],
    measurements: [
      { id: 'M1', pointIds: ['P:A', 'P:B'], pointDisplayIds: ['P1', 'P2'], distanceMeters: 1.5 },
    ],
  });
  JSON.stringify({
    collections: state.measurementCollections,
    activeMeasurements: state.measurements,
  });
`, context));

assert.equal(migratedMeasurementCollections.collections.length, 1, 'legacy measurements should migrate into one measurement collection');
assert.equal(migratedMeasurementCollections.collections[0].measurements.length, 1, 'migrated collection should keep legacy entries');
assert.equal(migratedMeasurementCollections.activeMeasurements.length, 0, 'active measurements should be re-synced by updateAll after mergeState');

const configurationArchive = JSON.parse(vm.runInContext(`
  mergeState({
    schemaVersion: 7,
    room: { widthMeters: 8, heightMeters: 3 },
    grid: {
      panelWidthMeters: 0.6,
      panelHeightMeters: 1.2,
      panelGapMeters: 0.005,
      panelGapUnit: 'mm',
      alignmentX: 'right',
      alignmentY: 'bottom',
      trueCenter: true,
      rotationDegrees: 90,
    },
    originCorner: 'bottom-left',
    obstacles: [{ id: 'S1', x: 1, y: 0.5, widthMeters: 0.4, heightMeters: 0.6 }],
    combinedPanels: [{ id: 'K1', cellIds: ['A1', 'A2'] }],
    measurementCollections: [{
      id: 'MC1',
      configSnapshot: {
        room: { widthMeters: 8, heightMeters: 3 },
        grid: {
          panelWidthMeters: 0.6,
          panelHeightMeters: 1.2,
          panelGapMeters: 0.005,
          panelGapUnit: 'mm',
          alignmentX: 'right',
          alignmentY: 'bottom',
          trueCenter: true,
          rotationDegrees: 90,
        },
        obstacles: [{ id: 'S1', x: 1, y: 0.5, widthMeters: 0.4, heightMeters: 0.6 }],
        combinedPanels: [{ id: 'K1', cellIds: ['A1', 'A2'] }],
      },
      measurements: [{ id: 'M1', pointIds: ['P1', 'P2'], pointDisplayIds: ['P1', 'P2'], distanceMeters: 2.4 }],
    }],
    labelCallouts: {},
    measureFlags: {},
  });
  JSON.stringify(buildConfigurationArchivePayload(buildConfig(), {
    displayName: 'Wohnzimmer Nord',
    savedAt: '2026-07-12T10:11:12.000Z',
  }));
`, context));

assert.equal(configurationArchive.kind, 'akustikpanele-configuration-archive', 'configuration archive should mark its kind');
assert.equal(configurationArchive.version, 1, 'configuration archive should expose a version');
assert.equal(configurationArchive.displayName, 'Wohnzimmer Nord', 'configuration archive should keep the chosen display name');
assert.equal(configurationArchive.extension, '.akpconfig.json', 'configuration archive should expose the custom file extension');
assert.equal(configurationArchive.summary.measurementEntryCount, 1, 'configuration archive summary should count saved measurements');
assert.equal(configurationArchive.summary.obstacleCount, 1, 'configuration archive summary should count obstacles');
assert.equal(configurationArchive.config.measurementCollections.length, 1, 'configuration archive should embed the full config payload');

const archiveReadback = JSON.parse(vm.runInContext(`
  JSON.stringify({
    fromArchive: getConfigFromArchivePayload({
      kind: CONFIGURATION_ARCHIVE_KIND,
      config: { room: { widthMeters: 7 } },
    }),
    fromPlain: getConfigFromArchivePayload({ room: { widthMeters: 9 } }),
  });
`, context));

assert.equal(archiveReadback.fromArchive.room.widthMeters, 7, 'config reader should unwrap archive payloads');
assert.equal(archiveReadback.fromPlain.room.widthMeters, 9, 'config reader should accept plain config payloads');

const slugifiedConfigurationName = String(vm.runInContext(`
  slugifyConfigurationName('  Wohnraum Süd / 90° Test  ');
`, context));

assert.equal(slugifiedConfigurationName, 'wohnraum-sud-90-test', 'configuration filename slug should be filesystem-friendly');

console.log(`OK: ${angles.length * alignments.length} full-panel rotated-grid alignment checks passed.`);
