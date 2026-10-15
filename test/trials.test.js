import { test } from "node:test";
import assert from "node:assert/strict";
import { trials, WEIGHTS, totalScore, verdict, square, shareText } from "../trials.js";
import { commission } from "../game.js";

const c = commission("2026-10-15");
const [lo, hi] = c.hardness;
const perfect = {
  forge: { score: 100, profile: 100, lengthError: 0, meanError: 0 },
  grind: { score: 100, edge: 100, line: 100 },
  harden: { cracked: false, warpMm: 0 },
  temper: { edge: 100, spine: 100, brittle: 0, soft: 0, hrc: (lo + hi) / 2 },
};
const id = (run, k) => run.results.find((r) => r.id === k);

test("a perfect blade passes everything", () => {
  const run = trials(c, perfect);
  assert.equal(run.results.length, 5);
  for (const r of run.results) assert.equal(r.grade, "pass", r.id);
  assert.equal(run.score, 100);
});

test("a cracked blade snaps", () => {
  const run = trials(c, { ...perfect, harden: { cracked: true, warpMm: 0 } });
  assert.equal(id(run, "post").score, 0);
  assert.equal(id(run, "bend").score, 0);
  assert.match(id(run, "bend").text, /Snaps/);
});

test("too hard chips, too soft rolls and bends, warp glances", () => {
  const hard = trials(c, { ...perfect, temper: { edge: 20, spine: 0, brittle: 40, soft: 0, hrc: hi + 4 } });
  assert.match(id(hard, "post").text, /chips/);
  assert.equal(id(hard, "bend").score, 0);
  const soft = trials(c, { ...perfect, temper: { edge: 20, spine: 100, brittle: 0, soft: 40, hrc: lo - 4 } });
  assert.match(id(soft, "post").text, /rolls/);
  assert.match(id(soft, "bend").text, /set/);
  const bent = trials(c, { ...perfect, harden: { cracked: false, warpMm: 3 } });
  assert.match(id(bent, "post").text, /glances/);
  assert.ok(id(bent, "post").score < 100);
});

test("a blunt edge fails the paper and rope", () => {
  const run = trials(c, { ...perfect, grind: { score: 10, edge: 0, line: 30 } });
  assert.equal(id(run, "paper").grade, "fail");
  assert.notEqual(id(run, "rope").grade, "pass");
});

test("the overall score, verdict and share", () => {
  assert.ok(Math.abs(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const all = { forge: 100, grind: 100, harden: 100, temper: 100, test: 100 };
  assert.equal(totalScore(all), 100);
  assert.equal(totalScore({ ...all, forge: 0 }), 75);
  assert.equal(verdict(95, false), "It will kill.");
  assert.match(verdict(95, true), /cracked/);
  assert.equal(square(90) + square(70) + square(40) + square(10), "🟩🟨🟧🟥");
  assert.equal(shareText(3, 82, { ...all, temper: 50 }, "https://0x48.io/forgle/"), "Forgle #3 · 82/100\n🟩🟩🟩🟧🟩\nhttps://0x48.io/forgle/");
});
