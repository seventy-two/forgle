// Forgle's daily commission and scoring. Everything here is pure so it runs
// the same in the browser and in tests.

import { BLADES, bladeById, pointLength } from "./blades.js";
import { STEELS } from "./steels.js";
import { sectionLengths } from "./forge.js";

export const SECTIONS = 8; // the blade is forged a section at a time
export const BILLET_SCALE = 1.25; // the billet starts this much wider than the blade's widest section
export const STOCK = [2.9, 4.5]; // mm: the range of the edge's thickness off the anvil
export const FIRST_DAY = "2026-10-15"; // Forgle #1

// mulberry32: a small, fast seeded PRNG.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a hash of a string, for seeding.
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const between = (rand, [lo, hi]) => lo + (hi - lo) * rand();
const round = (x, step) => Math.round(x / step) * step;

// dayKey is the UTC date of t as YYYY-MM-DD; everyone gets the same
// commission on the same UTC day.
export function dayKey(t = new Date()) {
  return t.toISOString().slice(0, 10);
}

// dayNumber is the puzzle number for a day key, counting FIRST_DAY as 1.
export function dayNumber(key) {
  return Math.round((Date.parse(key) - Date.parse(FIRST_DAY)) / 86400000) + 1;
}

// bladeForDay picks the day's kind of blade. The blades come round in a
// shuffled cycle, so each turns up once every BLADES.length days.
export function bladeForDay(key) {
  const n = dayNumber(key) - 1;
  const cycle = Math.floor(n / BLADES.length);
  const order = shuffle(BLADES, mulberry32(hash("forgle:cycle:" + cycle)));
  return order[((n % BLADES.length) + BLADES.length) % BLADES.length];
}

// commission builds a day's commission: the blade, its steel, its size and
// shape (a target width for each section), the billet it's forged from, the
// grind (bevel height, and the edge's thickness per section before it), how
// the quench rocks it, and the hardness it must be tempered to.
export function commission(key) {
  const rand = mulberry32(hash("forgle:" + key));
  const blade = bladeForDay(key);
  const steels = blade.steels || STEELS.map((s) => s.id);
  const steel = steels[Math.floor(rand() * steels.length)];
  const length = round(between(rand, blade.length), 5);
  const width = round(between(rand, blade.width), 0.5);
  const curve = blade.curve ? Math.round(between(rand, blade.curve.amount)) : 0;

  const widths = Array.from({ length: SECTIONS }, (_, i) => Number((width * blade.profile((i + 0.5) / SECTIONS)).toFixed(1)));
  const body = length - pointLength(blade, widths[SECTIONS - 1]);
  const lengths = Array(SECTIONS).fill(body / SECTIONS);
  const billet = Math.ceil(Math.max(...widths) * BILLET_SCALE);
  // How high the grind line runs, and how thick the edge comes off the
  // anvil along the blade (forging never leaves it even).
  const bevel = Number(between(rand, blade.bevel).toFixed(2));
  const stock = Array.from({ length: SECTIONS }, () => Number(between(rand, STOCK).toFixed(1)));
  // How the quench rocks the blade: a few waves, the slowest strongest.
  const wobble = [0.3, 0.7, 1.5].map((f, i) => ({
    f: Number((f * between(rand, [0.8, 1.25])).toFixed(3)),
    phase: Number((rand() * 2 * Math.PI).toFixed(3)),
    amp: [1, 0.45, 0.15][i],
    sign: rand() < 0.5 ? -1 : 1,
  }));

  return {
    key,
    number: dayNumber(key),
    blade: blade.id,
    steel,
    length,
    width,
    curve,
    widths,
    lengths,
    billet,
    areas: widths.map((w, i) => w * lengths[i]),
    hardness: blade.hardness,
    bevel,
    stock,
    wobble,
  };
}

// barLength is a forged bar's overall length, point and all.
export function barLength(c, bar) {
  const lengths = sectionLengths(bar);
  return lengths.reduce((a, b) => a + b, 0) + pointLength(bladeById[c.blade], bar.widths.at(-1));
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// forgeScore is 0–100 for how closely the forged bar matches the
// commission: three quarters for the profile (each section's width; every
// 1% off on average costs 10 points of it) and a quarter for the length
// (every 1% off costs 20 points of it).
export function forgeScore(c, bar) {
  const errors = bar.widths.map((w, i) => w / c.widths[i] - 1);
  const meanError = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
  const length = barLength(c, bar);
  const lengthError = length / c.length - 1;
  const profile = 100 * clamp01(1 - meanError / 0.1);
  const len = 100 * clamp01(1 - Math.abs(lengthError) / 0.05);
  return {
    score: Math.round(0.75 * profile + 0.25 * len),
    profile: Math.round(profile),
    length: Math.round(len),
    errors,
    meanError,
    lengthMm: length,
    lengthError,
  };
}

// msUntilNextDay is how long until the next UTC day's commission.
export function msUntilNextDay(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}
