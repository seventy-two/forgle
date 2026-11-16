import { test } from "node:test";
import assert from "node:assert/strict";
import { beltLoop } from "../belt.js";

// Two small wheels on the left, one above the other, a big one to the
// right and a small one above it: a grinder's, more or less.
const wheels = [{ x: 3, y: -10, r: 2 }, { x: 3, y: 10, r: 2 }, { x: 30, y: 12, r: 8 }, { x: 20, y: -20, r: 4 }];

test("each run of the belt touches both its wheels and crosses neither", () => {
  const { runs, d } = beltLoop(wheels);
  assert.equal(runs.length, wheels.length);
  runs.forEach(({ from, to }, i) => {
    const a = wheels[i], b = wheels[(i + 1) % wheels.length];
    assert.ok(Math.abs(Math.hypot(from[0] - a.x, from[1] - a.y) - a.r) < 1e-9);
    assert.ok(Math.abs(Math.hypot(to[0] - b.x, to[1] - b.y) - b.r) < 1e-9);
    // Tangent: the run is square to the radius at each end.
    const run = [to[0] - from[0], to[1] - from[1]];
    assert.ok(Math.abs(run[0] * (from[0] - a.x) + run[1] * (from[1] - a.y)) < 1e-9);
    assert.ok(Math.abs(run[0] * (to[0] - b.x) + run[1] * (to[1] - b.y)) < 1e-9);
    // Every wheel is on the inside of every run (to the left, going round).
    for (const w of wheels) {
      const side = run[0] * (w.y - from[1]) - run[1] * (w.x - from[0]);
      assert.ok(side / Math.hypot(...run) <= -w.r + 1e-9, `run ${i}`);
    }
  });
  assert.match(d, /^M[\d.,-]+(L[\d.,-]+A[\d., -]+){4}Z$/);
});

test("between two wheels of a size one above the other, the run is straight down their side", () => {
  const { runs } = beltLoop(wheels);
  assert.deepEqual(runs[0].from.map((v) => Number(v.toFixed(9))), [1, -10]);
  assert.deepEqual(runs[0].to.map((v) => Number(v.toFixed(9))), [1, 10]);
});
