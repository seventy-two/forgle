import { test } from "node:test";
import assert from "node:assert/strict";
import { hilt, HILT_STYLES } from "../hilts.js";
import { BLADES } from "../blades.js";

test("every blade has a hilt that runs left from the blade, in one piece", () => {
  for (const b of BLADES) {
    assert.ok(HILT_STYLES[b.id], b.id);
    const h = hilt(b.id, 45, 750, -3);
    assert.ok(h.x0 < -45 * 0.5, `${b.id} reaches left`);
    assert.ok(h.half > 0);
    assert.ok(h.parts.some((p) => p.front), `${b.id} has a guard`);
    assert.ok(h.parts.some((p) => !p.front), `${b.id} has a grip`);
    for (const p of h.parts) {
      for (const [k, v] of Object.entries(p.attrs)) {
        if (typeof v === "number") assert.ok(Number.isFinite(v), `${b.id} ${p.tag}.${k}`);
        else assert.doesNotMatch(String(v), /NaN|undefined/, `${b.id} ${p.tag}.${k}`);
      }
    }
  }
});
