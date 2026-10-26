import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLUMNS, LEVELS, BELT, RATE, EDGE, FLIP_TIME, DUNK_TIME, TILT, BLUE, DT, X_RANGE,
  geometry, newGrind, perfectGrind, depth, sideLeft, edgeLeft, tiltFor, touch, holdAt, grind, flip, dunk, grindScore,
} from "../grind.js";
import { commission, dayKey, STOCK } from "../game.js";
import { bladeById } from "../blades.js";

const c = commission("2026-10-15");
const blade = bladeById[c.blade];
const cols = geometry(blade, c.widths, c.lengths, c.billet, c.stock);
const days = (n) => Array.from({ length: n }, (_, d) => dayKey(new Date(Date.UTC(2026, 9, 15 + d))));
const hold = (o) => ({ down: true, x: 0.5, tilt: 6, vx: 0, vt: 0, at: 0, ...o });

test("every commission's strips run tang to point with an edge to grind", () => {
  for (const key of days(60)) {
    const k = commission(key);
    assert.ok(k.bevel > 0 && k.bevel < 1, key);
    for (const s of k.stock) assert.ok(s >= STOCK[0] && s <= STOCK[1], key);
    const g = geometry(bladeById[k.blade], k.widths, k.lengths, k.billet, k.stock);
    assert.equal(g.length, COLUMNS);
    for (let j = 1; j < COLUMNS; j++) assert.ok(g[j].x > g[j - 1].x, key);
    for (const col of g) {
      assert.ok(col.span > 0 && Number.isFinite(col.edge), key);
      assert.ok(col.stock >= STOCK[0] && col.stock <= STOCK[1], key);
      // The tilt that cuts the bevel can be held.
      const t = tiltFor(col, k.bevel);
      if (col.x < 0.9) assert.ok(t > TILT[0] && t < TILT[1], `${key} ${t}`);
    }
  }
});

test("only the strips under the belt are ground, and only on this side", () => {
  const g = grind(newGrind(), cols, hold({ x: 0.5 }), 1);
  for (let j = 0; j < COLUMNS; j++) {
    const under = Math.abs(cols[j].x - 0.5) <= BELT / 2;
    assert.equal(depth(g, j, 0) > 0, under, `strip ${j}`);
    assert.equal(depth(g, j, 1), 0);
  }
});

test("held still, the belt cuts in at RATE, at the tilt held", () => {
  const j = 20;
  const g = grind(newGrind(), cols, hold({ x: cols[j].x, tilt: 5 }), 0.2);
  const d = depth(g, j, 0);
  assert.ok(Math.abs(d - RATE * 0.2) < 2 * RATE * DT, `cut ${d}`);
  // A flat plane: the face falls away at the tilt, up to the line.
  const tan = Math.tan((5 * Math.PI) / 180);
  const h = d / tan;
  assert.ok(Math.abs(g.lines[0][j] - h / cols[j].span) < 1e-9);
  for (let k = 0; k < LEVELS; k++) {
    const y = (k / (LEVELS - 1)) * cols[j].span;
    assert.ok(Math.abs(g.faces[0][j][k] - Math.max(0, d - y * tan)) < 1e-9);
  }
});

test("a shallower tilt runs the bevel higher for the same edge", () => {
  const j = 20;
  const at = (tilt) => {
    let g = newGrind();
    let t = 0;
    while (depth(g, j, 0) < 1) {
      g = grind(g, cols, hold({ x: cols[j].x, tilt, at: t }), t + 0.01);
      t += 0.01;
    }
    return g.lines[0][j];
  };
  assert.ok(at(3) > at(6) && at(6) > at(10));
});

test("a shallower pass after a steep one meets the shoulder first, leaving the edge", () => {
  const j = 20;
  const x = cols[j].x;
  const steep = grind(newGrind(), cols, hold({ x, tilt: 10 }), 0.2);
  const tan = Math.tan((4 * Math.PI) / 180);
  // The shallow belt touches above the edge, so a short pass doesn't thin it.
  assert.ok(touch(steep.faces[0][j], cols[j].span, tan) < depth(steep, j, 0));
  const shallow = grind(steep, cols, hold({ x, tilt: 4, at: 0.2 }), 0.25);
  assert.equal(depth(shallow, j, 0), depth(steep, j, 0));
  assert.ok(shallow.lines[0][j] > steep.lines[0][j]);
  // Lines only go up: a steep pass never lowers one.
  const back = grind(shallow, cols, hold({ x, tilt: 12, at: 0.25 }), 0.3);
  assert.ok(back.lines[0][j] >= shallow.lines[0][j]);
});

test("not pressing grinds nothing, and nothing grinds through the edge", () => {
  const g = grind(newGrind(), cols, hold({ down: false }), 5);
  assert.deepEqual(g.faces, newGrind().faces);
  let long = grind(newGrind(), cols, hold({ x: cols[20].x }), 5);
  long = grind(flip(long, 5), cols, hold({ x: cols[20].x, at: 5 }), 10);
  for (let j = 0; j < COLUMNS; j++) assert.ok(edgeLeft(long, cols, j) >= 0);
  assert.equal(edgeLeft(long, cols, 20), 0);
});

test("splitting the time between events doesn't change the result", () => {
  const h = hold({ x: 0.1, vx: 0.3, tilt: 7, vt: -0.5, at: 0.013 });
  const once = grind(newGrind(), cols, h, 2.7);
  let many = newGrind();
  let at = h;
  for (const step of [0.016, 0.0331, 0.5, 0.0001, 1.2, 0.017]) {
    many = grind(many, cols, at, at.at + step);
    at = holdAt(at, at.at + step);
  }
  many = grind(many, cols, at, 2.7);
  for (let j = 0; j < COLUMNS; j++) {
    assert.ok(Math.abs(once.lines[0][j] - many.lines[0][j]) < 1e-9);
    assert.ok(Math.abs(once.heat[j] - many.heat[j]) < 1e-9);
    for (let k = 0; k < LEVELS; k++) assert.ok(Math.abs(once.faces[0][j][k] - many.faces[0][j][k]) < 1e-9);
  }
});

test("the hold moves on the keys and stays in bounds", () => {
  const h = hold({ x: 0.5, vx: 1, tilt: 6, vt: -2 });
  const later = holdAt(h, 100);
  assert.equal(later.x, X_RANGE[1]);
  assert.equal(later.tilt, TILT[0]);
  assert.equal(later.at, 100);
});

test("flipping or dunking stops the grinding for a moment", () => {
  const x = cols[15].x;
  const g = flip(newGrind(), 1);
  assert.equal(g.side, 1);
  const early = grind(g, cols, hold({ x, at: 1 }), 1 + FLIP_TIME - DT);
  assert.equal(depth(early, 15, 1), 0);
  const later = grind(g, cols, hold({ x, at: 1 }), 1 + FLIP_TIME + 0.2);
  assert.ok(depth(later, 15, 1) > 0);
  assert.equal(depth(later, 15, 0), 0);
  const wet = dunk(newGrind(), 2);
  assert.equal(depth(grind(wet, cols, hold({ x, at: 2 }), 2 + DUNK_TIME - DT), 15, 0), 0);
});

test("lingering blues the edge, drawing the blade along doesn't, and the bucket cools it", () => {
  const j = 20;
  const still = grind(newGrind(), cols, hold({ x: cols[j].x }), 3);
  assert.ok(still.peak[j] >= BLUE, `peak ${still.peak[j]}`);
  // Passes end to end at a steady pace.
  let g = newGrind();
  let h = hold({ x: X_RANGE[0], vx: 0.8 });
  for (let pass = 0; pass < 8; pass++) {
    const time = (X_RANGE[1] - X_RANGE[0]) / 0.8;
    g = grind(g, cols, h, h.at + time);
    h = { ...holdAt(h, h.at + time), vx: -h.vx };
  }
  assert.ok(Math.max(...g.peak) < 0.8 * BLUE, `peak ${Math.max(...g.peak)}`);
  // Heat fades off the belt, and the bucket takes it all.
  const cooled = grind(still, cols, hold({ down: false, at: 3 }), 6);
  assert.ok(cooled.heat[j] < still.heat[j] / 2);
  assert.equal(cooled.peak[j], still.peak[j], "the colour stays");
  assert.deepEqual(dunk(still, 3).heat, Array(COLUMNS).fill(0));
});

test("a perfect grind scores 100, and mistakes cost", () => {
  const perfect = perfectGrind(cols, c.bevel);
  const s = grindScore(c, perfect, cols);
  assert.equal(s.score, 100);
  assert.equal(s.thin, 0);
  assert.equal(s.blued, 0);
  assert.ok(s.uneven < 1e-9);
  for (let j = 0; j < COLUMNS; j++) {
    assert.ok(Math.abs(edgeLeft(perfect, cols, j) - EDGE) < 1e-9);
    assert.ok(Math.abs(sideLeft(perfect, cols, j, 0)) < 1e-9);
  }
  assert.ok(grindScore(c, newGrind(), cols).score < 10);
  const high = { ...perfect, lines: [perfect.lines[0].map((h) => h + 0.05), perfect.lines[1]] };
  assert.ok(grindScore(c, high, cols).line < 100);
  const blued = { ...perfect, peak: perfect.peak.map((_, j) => (j < 4 ? BLUE : 0)) };
  const bs = grindScore(c, blued, cols);
  assert.equal(bs.blued, 4);
  assert.ok(bs.edge < 100);
  const lopsided = { ...perfect, faces: [perfect.faces[0].map((f) => f.map((r) => 2 * r)), perfect.faces[1].map((f) => f.map(() => 0))] };
  assert.ok(grindScore(c, lopsided, cols).uneven > 0.5);
});

test("a steady player, passing end to end at each section's tilt, grinds both sides in time", () => {
  let g = newGrind(), t = 0;
  let h = hold({ x: X_RANGE[0], vx: 0.8 });
  for (let side = 0; side < 2; side++) {
    if (side) {
      g = flip(g, t);
      h = { ...h, at: t };
    }
    for (let n = 0; n < 1500; n++) {
      const j = Math.max(0, Math.min(COLUMNS - 1, Math.floor(h.x * COLUMNS)));
      h = { ...h, down: sideLeft(g, cols, j, g.side) > 0.02, tilt: tiltFor(cols[j], c.bevel) };
      g = grind(g, cols, h, t + 1 / 60);
      t += 1 / 60;
      h = holdAt(h, t);
      if (h.x >= X_RANGE[1] || h.x <= X_RANGE[0]) h.vx = -h.vx;
      if (cols.every((_, i) => sideLeft(g, cols, i, g.side) <= 0.02)) break;
    }
  }
  assert.ok(t < 35, `took ${t}s`);
  assert.ok(grindScore(c, g, cols).score >= 80);
});
