import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTIONS, BILLET_SCALE, dayKey, dayNumber, bladeForDay, commission, forgeScore, barLength } from "../game.js";
import { BLADES, bladeById, outline, outlinePath, pointLength, TIP_STYLES } from "../blades.js";
import { STEELS, steelById } from "../steels.js";
import { newBar } from "../forge.js";

const days = (n) => Array.from({ length: n }, (_, d) => dayKey(new Date(Date.UTC(2026, 9, 15 + d))));

test("the day is the UTC date", () => {
  assert.equal(dayKey(new Date("2026-10-15T23:59:59Z")), "2026-10-15");
  assert.equal(dayKey(new Date("2026-10-16T00:00:00Z")), "2026-10-16");
  assert.equal(dayNumber("2026-10-15"), 1);
});

test("everyone gets the same commission on a day, and a different one each day", () => {
  assert.deepEqual(commission("2026-10-15"), commission("2026-10-15"));
  assert.notDeepEqual(commission("2026-10-15"), commission("2026-10-16"));
});

test("every blade comes round once in each cycle", () => {
  const all = days(BLADES.length * 5).map((k) => bladeForDay(k).id);
  for (let c = 0; c < 5; c++) {
    const cycle = all.slice(c * BLADES.length, (c + 1) * BLADES.length);
    assert.equal(new Set(cycle).size, BLADES.length, `cycle ${c}: ${cycle}`);
  }
});

test("every commission fits its blade and can be forged from its billet", () => {
  for (const key of days(400)) {
    const c = commission(key);
    const blade = bladeById[c.blade];
    assert.ok(steelById[c.steel], key);
    if (blade.steels) assert.ok(blade.steels.includes(c.steel), `${key}: ${c.blade} in ${c.steel}`);
    assert.ok(c.length >= blade.length[0] && c.length <= blade.length[1], key);
    assert.ok(c.width >= blade.width[0] && c.width <= blade.width[1], key);
    assert.equal(c.widths.length, SECTIONS);
    // Every section has to be hammered narrower, never wider.
    for (const w of c.widths) assert.ok(c.billet >= w * BILLET_SCALE - 1e-9, `${key}: billet ${c.billet} for ${w}`);
    // The commission's own widths give exactly its length.
    const bar = { ...newBar(c, steelById[c.steel]), widths: [...c.widths] };
    assert.ok(Math.abs(barLength(c, bar) - c.length) < 1e-6, `${key}: ${barLength(c, bar)} vs ${c.length}`);
    assert.equal(forgeScore(c, bar).score, 100);
  }
});

test("every blade draws as a closed outline with its point", () => {
  for (const b of BLADES) {
    assert.ok(TIP_STYLES[b.tip], b.id);
    const widths = Array.from({ length: SECTIONS }, (_, i) => 40 * b.profile((i + 0.5) / SECTIONS));
    const lengths = Array(SECTIONS).fill(80);
    const o = outline(b, widths, lengths);
    assert.ok(Math.abs(o.length - (640 + pointLength(b, widths.at(-1)))) < 1e-9);
    assert.deepEqual(o.top.at(-1), o.bottom.at(-1), `${b.id}: the point closes`);
    assert.match(outlinePath(o), /^M[\d.,L-]+Z$/);
  }
});

test("an untouched billet scores badly, and the score falls with error", () => {
  const c = commission("2026-10-15");
  const s = steelById[c.steel];
  assert.ok(forgeScore(c, newBar(c, s)).score < 20);
  const off = (f) => forgeScore(c, { ...newBar(c, s), widths: c.widths.map((w) => w * f) }).score;
  assert.ok(off(1.01) > off(1.03));
  assert.ok(off(0.99) > off(0.97));
  assert.ok(off(1.01) >= 85);
});

test("steels are sensible", () => {
  for (const s of STEELS) {
    assert.ok(s.critical < s.low && s.low < s.high && s.high < s.burn, s.id);
    assert.ok(s.burn < 1340, `${s.id} must be able to burn in the fire`);
  }
});
