"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateDraggedWindowPosition,
  finitePoint,
} = require("./window-drag.cjs");

test("moves the window by the exact pointer delta", () => {
  assert.deepEqual(
    calculateDraggedWindowPosition(
      [1466, 328],
      { x: 1681, y: 668 },
      { x: 1561, y: 568 },
    ),
    [1346, 228],
  );
});

test("rejects malformed renderer coordinates", () => {
  assert.equal(finitePoint({ x: 2, y: Number.NaN }), false);
  assert.equal(
    calculateDraggedWindowPosition([0, 0], null, { x: 1, y: 1 }),
    null,
  );
});
