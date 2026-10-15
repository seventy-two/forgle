import { test } from "node:test";
import assert from "node:assert/strict";
import { crackLines } from "../crack.js";
import { BLADES, outline } from "../blades.js";

test("a crack starts on the edge, runs into the blade, and narrows", () => {
  for (const b of BLADES) {
    const widths = Array.from({ length: 8 }, (_, i) => 45 * b.profile((i + 0.5) / 8));
    const shape = outline(b, widths, Array(8).fill(90), { curve: b.curve ? -20 : 0 });
    const segs = crackLines(shape, 0.6, 42, 1.1);
    assert.deepEqual(crackLines(shape, 0.6, 42, 1.1), segs, "the same seed draws the same crack");
    const i = Math.round(0.6 * (shape.bottom.length - 1));
    assert.deepEqual([segs[0].x1, segs[0].y1], shape.bottom[i], `${b.id}: starts on the edge`);
    const ys = [...shape.top, ...shape.bottom].map(([, y]) => y);
    const end = segs[6];
    assert.ok(end.y2 > Math.min(...ys) && end.y2 < Math.max(...ys), `${b.id}: stays in the blade`);
    assert.ok(Math.abs(end.y2 - segs[0].y1) > 5, `${b.id}: runs in`);
    for (let k = 1; k < 7; k++) assert.ok(segs[k].w < segs[k - 1].w, `${b.id}: narrows`);
  }
});

test("a worse crack is longer and has a second hairline", () => {
  const b = BLADES[0];
  const shape = outline(b, Array(8).fill(45), Array(8).fill(60));
  assert.ok(crackLines(shape, 0.5, 1, 1.6).length > crackLines(shape, 0.5, 1, 1).length);
});
