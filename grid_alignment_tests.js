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

console.log(`OK: ${angles.length * alignments.length} full-panel rotated-grid alignment checks passed.`);
