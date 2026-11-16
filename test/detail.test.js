import { test } from "node:test";
import assert from "node:assert/strict";
import { BLADES, bladeById, outline } from "../blades.js";
import { bladeDetail, detailPath, PATTERNS } from "../detail.js";
import { commission } from "../game.js";

// inside is whether a point is within an outline at its x (with a hair of slack).
function inside(shape, [x, y]) {
  const at = (line) => {
    let i = 1;
    while (i < line.length - 1 && line[i][0] < x) i++;
    const [x0, y0] = line[i - 1], [x1, y1] = line[i];
    return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  };
  const slack = 0.02 * Math.abs(at(shape.bottom) - at(shape.top)) + 0.8;
  return y >= at(shape.top) - slack && y <= at(shape.bottom) + slack && x >= -0.01 && x <= shape.length + 0.01;
}

// Each blade with a commission of its own, and its outline as on the card.
const made = BLADES.map((blade) => {
  const c = commission("2026-11-20", blade);
  return { blade, c, shape: outline(blade, c.widths, c.lengths, { curve: c.curve }) };
});
const one = (id) => made.find((m) => m.blade.id === id);
const points = (parts) => parts.flatMap((p) => p.lines.flat());

test("every kind of blade has details, and they all stay on the blade", () => {
  for (const { blade, c, shape } of made) {
    const parts = bladeDetail(blade, shape, { bevels: [c.bevel, c.bevel], hamon: true });
    const own = parts.filter((p) => !/^(bevel|glint|back)/.test(p.cls));
    assert.ok(own.length > 0, `${blade.id} has something besides its bevels`);
    for (const part of parts) {
      for (const line of part.lines) assert.ok(line.length >= 2, `${blade.id} ${part.cls}`);
      for (const pt of points([part])) assert.ok(inside(shape, pt), `${blade.id} ${part.cls} at ${pt}`);
      assert.match(detailPath(part), part.closed ? /^(M[-\d.,L]+Z)+$/ : /^(M[-\d.,L]+)+$/);
    }
  }
});

test("every pattern and every decoration draws, and stays on the blade", () => {
  for (const { blade, c, shape } of made) {
    for (const kind of Object.keys(PATTERNS)) {
      const parts = bladeDetail(blade, shape, { bevels: [c.bevel, c.bevel], pattern: { kind, seed: 7 } }).filter((p) => p.cls.startsWith("pattern"));
      assert.equal(parts.length, 2, `${blade.id} ${kind}: dark layers and pale`);
      assert.ok(parts[0].lines.length >= 3 && parts[1].lines.length >= 3, `${blade.id} ${kind}`);
      for (const pt of points(parts)) assert.ok(inside(shape, pt), `${blade.id} ${kind} at ${pt}`);
    }
    for (const decor of blade.decor || []) {
      assert.ok(decor.name, blade.id);
      const plain = bladeDetail(blade, shape, { bevels: [c.bevel, c.bevel] });
      const parts = bladeDetail(blade, shape, { bevels: [c.bevel, c.bevel], decor });
      assert.ok(parts.length > plain.length, `${blade.id} ${decor.kind} adds something`);
      for (const pt of points(parts)) assert.ok(inside(shape, pt), `${blade.id} ${decor.kind} at ${pt}`);
    }
  }
  // The same seed gives the same layers; another gives others.
  const { blade, shape } = one("viking");
  const layers = (seed) => detailPath(bladeDetail(blade, shape, { pattern: { kind: "wild", seed } })[0]);
  assert.equal(layers(3), layers(3));
  assert.notEqual(layers(3), layers(4));
});

test("an inscription fits in its fuller, short of where it ends", () => {
  for (const id of ["viking", "arming", "longsword"]) {
    const { blade, c, shape } = one(id);
    const [decor] = blade.decor;
    const inlay = bladeDetail(blade, shape, { bevels: [c.bevel, c.bevel], decor }).find((p) => p.cls.startsWith("inlay"));
    const xs = points([inlay]).map(([x]) => x);
    const body = shape.top[shape.top.length - 13][0];
    assert.ok(Math.min(...xs) > 0 && Math.max(...xs) < blade.detail.fuller.to * body * 0.95, `${id}: to ${Math.max(...xs)} of ${blade.detail.fuller.to * body}`);
    assert.equal(inlay.lines.length >= decor.text.length, true);
  }
});

test("an unground blade has no bevels, and a hamon only shows once it's hardened", () => {
  const { blade, c, shape } = one("katana");
  const classes = (opts) => bladeDetail(blade, shape, opts).map((p) => p.cls);
  assert.deepEqual(classes(), []);
  assert.deepEqual(classes({ bevels: [c.bevel] }), ["bevel lit", "bevel-line", "glint", "glint", "back", "yokote"]);
  assert.ok(classes({ bevels: [c.bevel], hamon: true }).includes("hamon"));
  // Its bo-hi is cut before it's ground.
  assert.deepEqual(classes({ decor: blade.decor[0] }), ["fuller", "fuller-shade", "fuller-lip"]);
});

test("the bevel line follows the grind, strip by strip", () => {
  const { blade, shape } = one("messer");
  const strips = Array.from({ length: 40 }, (_, j) => (j < 20 ? 0.2 : 0.6));
  const line = bladeDetail(blade, shape, { bevels: [strips] }).find((p) => p.cls === "bevel-line").lines[0];
  const share = (i) => (shape.bottom[i][1] - line[i][1]) / (shape.bottom[i][1] - shape.top[i][1]);
  assert.ok(Math.abs(share(5) - 0.2) < 1e-9);
  assert.ok(Math.abs(share(40) - 0.6) < 1e-9);
  // A two-edged blade's bevels are shares of half its width, one from each
  // side, the upper one lit and the lower in shade.
  const arming = one("arming");
  const [low, , high] = bladeDetail(arming.blade, arming.shape, { bevels: [1, 0.5] }).filter((p) => p.cls.startsWith("bevel"));
  const at = (pts, i) => (pts[i][1] - arming.shape.top[i][1]) / (arming.shape.bottom[i][1] - arming.shape.top[i][1]);
  assert.ok(Math.abs(at(low.lines[0], 10) - 0.5) < 1e-9);
  assert.ok(Math.abs(at(high.lines[0], 10) - 0.25) < 1e-9);
  assert.equal(low.cls, "bevel shade");
  assert.equal(high.cls, "bevel lit");
});
