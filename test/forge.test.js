import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIRE, ROOM, HEAT_TAU, COOL_TAU, MARKER_PERIOD, STRIKE_GAP, SPREAD,
  tempAt, burningBetween, markerAt, blowQuality, workability, newBar, sectionLengths, advance, setFire, strike,
} from "../forge.js";
import { commission } from "../game.js";
import { steelById } from "../steels.js";

const c = commission("2026-10-15");
const steel = steelById[c.steel];
const centre = MARKER_PERIOD / 4; // the marker crosses the centre here, and every half period after

test("the fire heats the blade towards its own heat, and the anvil cools it", () => {
  const hot = { T: 800, at: 0, inFire: true };
  assert.equal(tempAt(hot, 0), 800);
  assert.ok(tempAt(hot, HEAT_TAU) > 800 && tempAt(hot, 100) < FIRE + 1e-9);
  assert.ok(Math.abs(tempAt(hot, 100) - FIRE) < 1e-6);
  const out = { T: 1000, at: 0, inFire: false };
  assert.ok(Math.abs(tempAt(out, COOL_TAU) - (ROOM + (1000 - ROOM) / Math.E)) < 1e-9);
});

test("burning time is exact", () => {
  // In the fire from below burn: burning starts when it crosses burn.
  const h = { T: 1000, at: 0, inFire: true };
  const cross = HEAT_TAU * Math.log((FIRE - 1000) / (FIRE - 1200));
  assert.ok(Math.abs(burningBetween(h, cross + 2, 1200) - 2) < 1e-9);
  assert.equal(burningBetween(h, cross - 0.1, 1200), 0);
  // Cooling from above burn: burns until it drops below.
  const o = { T: 1250, at: 0, inFire: false };
  const below = COOL_TAU * Math.log((1250 - ROOM) / (1200 - ROOM));
  assert.ok(Math.abs(burningBetween(o, 10, 1200) - below) < 1e-9);
  assert.ok(Math.abs(burningBetween(o, below / 2, 1200) - below / 2) < 1e-9);
});

test("the marker sweeps there and back, and centred blows are best", () => {
  assert.equal(markerAt(0), 0);
  assert.ok(Math.abs(markerAt(centre) - 0.5) < 1e-9);
  assert.ok(Math.abs(markerAt(MARKER_PERIOD / 2) - 1) < 1e-9);
  assert.equal(blowQuality(0.5), 1);
  assert.equal(blowQuality(0.53), 1);
  assert.ok(blowQuality(0.7) < 1 && blowQuality(0.7) > 0);
  assert.equal(blowQuality(0), 0);
});

test("hot steel moves more than cool, and cold steel hardly at all", () => {
  assert.ok(workability(steel.high, steel) > workability(steel.low + 50, steel));
  assert.ok(workability(steel.low - 1, steel) < 0.1);
  assert.equal(workability(steel.burn, steel), 1);
});

test("a blow narrows its section, spreads to its neighbours and conserves steel", () => {
  const bar = newBar(c, steel);
  const { bar: after, blow } = strike(bar, centre, 3, steel);
  assert.equal(blow.kind, "clean");
  assert.ok(after.widths[3] < bar.widths[3]);
  const own = bar.widths[3] - after.widths[3];
  const side = bar.widths[2] - after.widths[2];
  assert.ok(Math.abs(side / own - SPREAD) < 1e-9);
  assert.equal(after.widths[0], bar.widths[0]);
  assert.deepEqual(after.areas, bar.areas);
  assert.ok(sectionLengths(after)[3] > sectionLengths(bar)[3]);
  assert.equal(after.strikes, 1);
});

test("the hammer has to come up, and nothing's struck in the fire", () => {
  const bar = newBar(c, steel);
  const first = strike(bar, centre, 0, steel).bar;
  assert.equal(strike(first, centre + STRIKE_GAP / 2, 0, steel).blow.kind, "blocked");
  const inFire = setFire(bar, 0.1, steel, true);
  assert.equal(strike(inFire, centre, 0, steel).blow.kind, "blocked");
});

test("cold and glancing blows stress the steel; clean ones don't", () => {
  const bar = newBar(c, steel);
  assert.equal(strike(bar, centre, 0, steel).bar.stress[0], 0);
  const glancing = strike(bar, 0.02, 0, steel);
  assert.equal(glancing.blow.kind, "glancing");
  assert.ok(glancing.bar.stress[0] > 0);
  const cold = { ...bar, heat: { T: steel.low - 100, at: 0, inFire: false } };
  const r = strike(cold, centre, 0, steel);
  assert.equal(r.blow.kind, "cold");
  assert.ok(r.bar.stress[0] > glancing.bar.stress[0]);
  const hot = { ...bar, heat: { T: steel.high, at: 0, inFire: false } };
  assert.ok(bar.widths[0] - r.bar.widths[0] < 0.1 * (bar.widths[0] - strike(hot, centre, 0, steel).bar.widths[0]));
});

test("burning steel loses metal to scale", () => {
  let bar = setFire(newBar(c, steel), 0, steel, true);
  bar = advance(bar, 30, steel);
  assert.ok(bar.burning > 20);
  assert.ok(bar.areas[0] < c.areas[0]);
});
