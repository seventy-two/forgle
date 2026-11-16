import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTIONS, BILLET_SCALE, FIRST_BLADES, MORE_FROM, dayKey, dayNumber, bladeForDay, commission, forgeScore, barLength } from "../game.js";
import { PATTERNS } from "../detail.js";
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

test("every blade comes round once each time round: the first twelve for 36 days, then all of them", () => {
  const all = days(MORE_FROM + BLADES.length * 4).map((k) => bladeForDay(k).id);
  const first = BLADES.slice(0, FIRST_BLADES).map((b) => b.id);
  for (let c = 0; c < MORE_FROM / FIRST_BLADES; c++) {
    const cycle = all.slice(c * FIRST_BLADES, (c + 1) * FIRST_BLADES);
    assert.deepEqual([...cycle].sort(), [...first].sort(), `cycle ${c}: ${cycle}`);
  }
  for (let c = 0; c < 4; c++) {
    const cycle = all.slice(MORE_FROM + c * BLADES.length, MORE_FROM + (c + 1) * BLADES.length);
    assert.equal(new Set(cycle).size, BLADES.length, `round ${c}: ${cycle}`);
  }
  // The days before the rest joined are as they were.
  assert.deepEqual(all.slice(0, 12), ["gladius", "falcata", "longsword", "messer", "cutlass", "arming", "seax", "shamshir", "katana", "viking", "falchion", "jian"]);
  assert.ok(BLADES.length > FIRST_BLADES);
});

test("a commission's looks: a pattern for pattern-welded steel, a decoration on some of a blade's days", () => {
  let patterned = 0, decorated = 0, could = 0;
  for (const key of days(400)) {
    const c = commission(key);
    const blade = bladeById[c.blade];
    assert.equal(Boolean(c.pattern), c.steel === "damascus", key);
    if (c.pattern) {
      assert.ok(PATTERNS[c.pattern.kind], key);
      assert.equal(c.decor, null, key);
      patterned++;
    }
    if (c.decor) assert.ok(blade.decor.includes(c.decor), key);
    if (blade.decor && !c.pattern) could++;
    if (c.decor) decorated++;
  }
  assert.ok(patterned > 20);
  assert.ok(decorated > 0.4 * could && decorated < 0.8 * could, `${decorated} of ${could}`);
  // A blade can be asked for by name, on any day.
  assert.equal(commission("2026-10-15", bladeById.rapier).blade, "rapier");
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
