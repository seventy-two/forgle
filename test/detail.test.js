import { test } from "node:test";
import assert from "node:assert/strict";
import { BLADES, outline, polyPath } from "../blades.js";
import { bladeDetail } from "../detail.js";
import { commission, dayKey } from "../game.js";
import { bladeById } from "../blades.js";

// inside is whether a point is within an outline at its x (with a hair of slack).
function inside(shape, [x, y]) {
  const at = (line) => {
    let i = 1;
    while (i < line.length - 1 && line[i][0] < x) i++;
    const [x0, y0] = line[i - 1], [x1, y1] = line[i];
    return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  };
  return y >= at(shape.top) - 0.6 && y <= at(shape.bottom) + 0.6 && x >= -0.01 && x <= shape.length + 0.01;
}

const days = Array.from({ length: 36 }, (_, d) => dayKey(new Date(Date.UTC(2026, 9, 15 + d))));

test("every kind of blade has details, and they all stay on the blade", () => {
  const seen = new Set();
  for (const key of days) {
    const c = commission(key);
    const blade = bladeById[c.blade];
    seen.add(blade.id);
    const shape = outline(blade, c.widths, c.lengths, { curve: c.curve });
    const parts = bladeDetail(blade, shape, { bevels: [c.bevel, c.bevel], hamon: true });
    assert.ok(parts.length > blade.edges * 2, `${blade.id} has something besides its bevels`);
    for (const part of parts) {
      assert.ok(part.pts.length >= 2, `${blade.id} ${part.cls}`);
      for (const pt of part.pts) assert.ok(inside(shape, pt), `${blade.id} ${part.cls} at ${pt}`);
      assert.match(polyPath(part.pts, part.closed), part.closed ? /^M[-\d.,L]+Z$/ : /^M[-\d.,L]+$/);
    }
  }
  assert.equal(seen.size, BLADES.length);
});

test("an unground blade has no bevels, and a hamon only shows once it's hardened", () => {
  const c = commission(days.find((k) => commission(k).blade === "katana"));
  const blade = bladeById.katana;
  const shape = outline(blade, c.widths, c.lengths, { curve: c.curve });
  const classes = (opts) => bladeDetail(blade, shape, opts).map((p) => p.cls);
  assert.deepEqual(classes(), []);
  assert.deepEqual(classes({ bevels: [c.bevel] }), ["bevel", "bevel-line", "yokote"]);
  assert.ok(classes({ bevels: [c.bevel], hamon: true }).includes("hamon"));
});

test("the bevel line follows the grind, strip by strip", () => {
  const c = commission(days.find((k) => commission(k).blade === "messer"));
  const blade = bladeById.messer;
  const shape = outline(blade, c.widths, c.lengths, { curve: c.curve });
  const strips = Array.from({ length: 40 }, (_, j) => (j < 20 ? 0.2 : 0.6));
  const line = bladeDetail(blade, shape, { bevels: [strips] }).find((p) => p.cls === "bevel-line").pts;
  const share = (i) => (shape.bottom[i][1] - line[i][1]) / (shape.bottom[i][1] - shape.top[i][1]);
  assert.ok(Math.abs(share(5) - 0.2) < 1e-9);
  assert.ok(Math.abs(share(40) - 0.6) < 1e-9);
  // A two-edged blade's bevels are shares of half its width, one from each side.
  const k = commission(days.find((key) => commission(key).blade === "arming"));
  const arming = outline(bladeById.arming, k.widths, k.lengths, {});
  const [low, , high] = bladeDetail(bladeById.arming, arming, { bevels: [1, 0.5] }).filter((p) => p.cls.startsWith("bevel"));
  const at = (pts, i) => (pts[i][1] - arming.top[i][1]) / (arming.bottom[i][1] - arming.top[i][1]);
  assert.ok(Math.abs(at(low.pts, 10) - 0.5) < 1e-9);
  assert.ok(Math.abs(at(high.pts, 10) - 0.25) < 1e-9);
});
