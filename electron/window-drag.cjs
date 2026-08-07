"use strict";

function finitePoint(point) {
  return (
    point != null &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

function calculateDraggedWindowPosition(
  startWindow,
  startCursor,
  currentCursor,
) {
  if (
    !Array.isArray(startWindow) ||
    startWindow.length !== 2 ||
    !startWindow.every(Number.isFinite) ||
    !finitePoint(startCursor) ||
    !finitePoint(currentCursor)
  ) {
    return null;
  }
  return [
    Math.round(startWindow[0] + currentCursor.x - startCursor.x),
    Math.round(startWindow[1] + currentCursor.y - startCursor.y),
  ];
}

module.exports = { calculateDraggedWindowPosition, finitePoint };
