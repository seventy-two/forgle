import { test } from "node:test";
import assert from "node:assert/strict";
import { STRIPS, ROOM, TOUGH, CHART, temperedHardness, temperFor, oxideRGB, newTemper, torch, temperScore } from "../temper.js";
import { commission } from "../game.js";

const c = commission("2026-10-15");
const [lo, hi] = c.hardness;

test("hotter tempers soften steel more, and temperFor undoes it", () => {
  assert.equal(temperedHardness(64, 100), 64);
  let last = 65;
  for (let T = 150; T <= 500; T += 10) {
    const h = temperedHardness(64, T);
    assert.ok(h <= last, `${T}`);
    last = h;
    if (T > 150) assert.ok(Math.abs(temperedHardness(64, temperFor(64, h)) - h) < 1e-9, `${T}`);
  }
});

test("the chart runs from bright steel to blue, straw to bronze landing in a usual band", () => {
  assert.deepEqual(oxideRGB(20), oxideRGB(170));
  assert.notDeepEqual(oxideRGB(215), oxideRGB(295));
  const straw = temperedHardness(64, CHART.find(([n]) => n === "straw")[1]);
  assert.ok(straw >= 57 && straw <= 61, `${straw}`);
});

test("the torch heats the spine first, the edge follows, and it all cools", () => {
  let tp = torch(newTemper(), 0, 2.5, 0.5);
  const j = Math.floor(0.5 * STRIPS);
  assert.ok(tp.spine[j] > tp.edge[j] + 50, "the spine leads");
  assert.ok(tp.spine[j] > tp.spine[0] + 100, "heat is local");
  const edgeThen = tp.edge[j];
  tp = torch(tp, 2.5, 4, null);
  assert.ok(tp.maxEdge[j] > edgeThen, "the edge keeps heating after the torch moves");
  tp = torch(tp, 4, 200, null);
  assert.ok(tp.edge[j] < 40, "it cools");
  assert.ok(tp.maxEdge[j] > 180, "but keeps its colour");
});

test("splitting the time between events doesn't change the result", () => {
  const once = torch(newTemper(), 0.011, 3.3, 0.4);
  let many = newTemper();
  let t = 0.011;
  for (const step of [0.016, 0.5, 0.0002, 1.1, 0.033]) {
    many = torch(many, t, t + step, 0.4);
    t += step;
  }
  assert.deepEqual(torch(many, t, 3.3, 0.4), once);
});

test("a perfect temper scores 100; untempered, overdone and patchy ones don't", () => {
  const blank = newTemper();
  const at = (edge, spine) => ({ ...blank, maxEdge: blank.maxEdge.map(() => edge), maxSpine: blank.maxSpine.map(() => spine) });
  const perfect = temperScore(c, at(temperFor(64, (lo + hi) / 2), TOUGH), 64);
  assert.equal(perfect.score, 100);
  assert.equal(perfect.brittle + perfect.soft, 0);
  const raw = temperScore(c, at(ROOM, ROOM), 64);
  assert.equal(raw.brittle, STRIPS);
  assert.ok(raw.score < 40);
  const blue = temperScore(c, at(330, 360), 64);
  assert.equal(blue.soft, STRIPS);
  assert.ok(blue.edge < 20);
  assert.ok(temperScore(c, at(temperFor(64, (lo + hi) / 2), 200), 64).score < 100, "an untoughened spine costs");
});
