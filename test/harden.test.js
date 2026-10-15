import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HT_FIRE, TRANSFER, CRACK, MAX_STEER, QUENCHES, AIR_HARDNESS,
  htTemp, htSetFire, magnetSticks, quenchTemp, wobbleAt, newPlunge, steer, tiltAt, meanTilt,
  hardness, strain, warp, hardenScore,
} from "../harden.js";
import { commission } from "../game.js";
import { steelById, STEELS } from "../steels.js";

const c = commission("2026-10-15");
const oil = steelById["1084"];
const w2 = steelById.w2;
const clean = { stress: 0, burning: 0, thin: 0 };

test("the heat-treat forge can't take steel past its own heat, but past critical", () => {
  let h = htSetFire({ T: 20, at: 0, inFire: false }, 0, true);
  assert.ok(htTemp(h, 1000) <= HT_FIRE);
  for (const s of STEELS) assert.ok(HT_FIRE > s.critical + 60, s.id);
  assert.ok(magnetSticks(htTemp(h, 2), oil));
  assert.ok(!magnetSticks(htTemp(h, 30), oil));
  // On the way to the quench it cools a little.
  assert.ok(quenchTemp(h, 30) < htTemp(h, 30) && quenchTemp(h, 30) > htTemp(h, 30) - 40);
});

test("the quench rocks the blade the same way for everyone, and steering cancels it", () => {
  assert.equal(wobbleAt(c, 1.3), wobbleAt(commission("2026-10-15"), 1.3));
  assert.ok(Math.abs(wobbleAt(c, 1)) <= 30);
  let left = newPlunge(2, "oil");
  left = steer(left, c, 2 + QUENCHES.oil.time, null);
  let held = newPlunge(2, "oil");
  for (let t = 2; t < 2 + QUENCHES.oil.time; t += 0.01) held = steer(held, c, t, -wobbleAt(c, t + 0.01 - 2));
  held = steer(held, c, 2 + QUENCHES.oil.time, null);
  assert.ok(meanTilt(held) < 0.3 * meanTilt(left), `${meanTilt(held)} vs ${meanTilt(left)}`);
  assert.ok(meanTilt(left) > 3);
});

test("steering is clamped, the keys move it steadily, and nothing counts after the quench", () => {
  let p = steer(newPlunge(0, "water"), c, 0.5, 999);
  assert.equal(p.steer, MAX_STEER);
  p = steer(newPlunge(0, "water"), c, 0, null, 10);
  assert.ok(Math.abs(tiltAt(p, c, 1) - (wobbleAt(c, 1) + 10)) < 1e-9);
  const done = steer(p, c, 100, null);
  assert.equal(done.at, QUENCHES.water.time);
  assert.equal(steer(done, c, 200, null).samples, done.samples);
});

test("hardness: full past critical, less below, less from a slow quench, none from air", () => {
  assert.equal(hardness(oil, oil.critical + 20, "oil"), oil.hard);
  assert.ok(hardness(oil, oil.critical - 30, "oil") < oil.hard - 10);
  assert.equal(hardness(oil, oil.critical - 100, "oil"), AIR_HARDNESS);
  assert.ok(hardness(w2, w2.critical + 20, "oil") <= w2.hard - 7);
  assert.equal(hardness(w2, w2.critical + 20, "brine"), w2.hard);
  assert.ok(hardness(oil, oil.critical + 200, "oil") < oil.hard);
  assert.equal(hardness(oil, 900, "air"), AIR_HARDNESS);
});

test("a clean blade in the right quench is under no strain", () => {
  for (const s of STEELS) {
    assert.equal(strain(s, { ...clean, T: s.critical + 30, quenchant: s.quench }).total, 0, s.id);
  }
});

test("strain builds from every mistake, and the wrong quench makes it worse", () => {
  const T = oil.critical + 30;
  const cold = strain(oil, { ...clean, stress: 1.5, T, quenchant: "oil" }).total;
  assert.ok(cold > 0 && cold < CRACK);
  assert.ok(strain(oil, { ...clean, stress: 1.5, T, quenchant: "brine" }).total >= CRACK, "cold blows plus brine cracks an oil steel");
  assert.ok(strain(oil, { ...clean, thin: 4, T, quenchant: "oil" }).total > 0);
  assert.ok(strain(oil, { ...clean, burning: 2, T, quenchant: "oil" }).total > 0);
  assert.ok(strain(oil, { ...clean, T: oil.critical + 200, quenchant: "oil" }).total > 0);
  assert.ok(strain(steelById["1095"], { ...clean, T, quenchant: "brine" }).total >= CRACK, "1095 can't take brine at all");
  assert.equal(strain(oil, { ...clean, stress: 9, T, quenchant: "air" }), 0);
});

test("warp and the score", () => {
  assert.equal(warp(0, 0), 0);
  assert.ok(warp(5, 0) > warp(2, 0));
  assert.ok(warp(2, 0.5) > warp(2, 0));
  assert.equal(hardenScore(oil, { cracked: false, hrc: oil.hard, warpMm: 0 }), 100);
  assert.equal(hardenScore(oil, { cracked: true, hrc: oil.hard, warpMm: 0 }), 0);
  assert.ok(hardenScore(oil, { cracked: false, hrc: 55, warpMm: 0 }) < 80);
  assert.equal(hardenScore(oil, { cracked: false, hrc: oil.hard, warpMm: 4 }), 55);
});
