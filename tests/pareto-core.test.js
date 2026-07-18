const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../pareto-core.js");

test("calculates the default top-left frontier", () => {
  const points = [
    { x: 1, y: 1, radius: 6 },
    { x: 2, y: 2, radius: 6 },
    { x: 3, y: 0, radius: 6 },
    { x: 4, y: 4, radius: 6 },
  ];

  assert.deepEqual(core.getParetoIndices(points, "top_left"), [0, 2]);
  assert.deepEqual(
    core.buildFrontier(points, ["A", "B", "C", "D"], "top_left")
      .map((item) => item.name),
    ["A", "C"],
  );
});

test("supports the other visual directions", () => {
  const points = [
    { x: 1, y: 1, radius: 6 },
    { x: 2, y: 0, radius: 6 },
    { x: 3, y: 2, radius: 6 },
    { x: 4, y: 4, radius: 6 },
  ];

  assert.deepEqual(core.getParetoIndices(points, "top_right"), [1, 2, 3]);
  assert.deepEqual(core.getParetoIndices(points, "bottom_left"), [0, 2, 3]);
  assert.deepEqual(core.getParetoIndices(points, "bottom_right"), [3]);
});

test("associates labels with points using guide-line geometry", () => {
  const labels = [
    { name: "Alpha", textX: 0, textY: 0, line: [0, 0, 4, 10], iconX: null },
    { name: "Beta", textX: 40, textY: 40, line: [40, 40, 36, 30], iconX: null },
  ];
  const points = [
    { x: 10, y: 10, radius: 6 },
    { x: 30, y: 30, radius: 6 },
  ];

  const result = core.associateLabelsToPoints(labels, points);
  assert.deepEqual(result.nameByPoint, ["Alpha", "Beta"]);
  assert.ok(result.maxCost < 0.001);
});
