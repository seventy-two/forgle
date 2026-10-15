// The harden stage's rules: heating the blade to its critical temperature
// (found with a magnet), choosing what to quench it in, keeping it upright
// as it goes in, and what comes out: its hardness, its warp, and whether
// the strain built up over the whole forging cracks it. Pure, and driven by
// event times like the other stages.

import { tempAt } from "./forge.js";

export const HARDEN_TIME = 35; // seconds on the clock to get it hot and into the quench
export const HT_FIRE = 900; // the heat-treat forge runs cooler than the forging fire
export const HT_TAU = 4; // seconds
export const TRANSFER = 0.6; // seconds from the fire to the quench, cooling in the air
export const GOOD_OVER = 50; // up to this far past critical is just right
export const TILT = 14; // degrees: how hard the quench rocks the blade
export const MAX_STEER = 45; // degrees either way the player can lean it
export const KEY_STEER = 50; // degrees per second with the arrow keys
export const CRACK = 1; // strain at which the blade cracks
export const DT = 0.005; // the sampling grid, in seconds
export const AIR_HARDNESS = 30; // HRC: what steel cooled in the air ends up

export const QUENCHES = {
  water: { name: "Water", time: 2.5 },
  brine: { name: "Brine", time: 2.5 },
  oil: { name: "Oil", time: 4 },
};

// --- Heat

export function htTemp(heat, t) {
  return tempAt(heat, t, HT_FIRE, HT_TAU);
}

export function htSetFire(heat, t, inFire) {
  return { T: htTemp(heat, t), at: t, inFire };
}

// magnetSticks: a magnet sticks to steel until it's past critical.
export function magnetSticks(T, steel) {
  return T < steel.critical;
}

// quenchTemp is how hot the blade is when it reaches the quench, if it's
// taken from the fire (or the anvil) at t.
export function quenchTemp(heat, t) {
  const T = htTemp(heat, t);
  return tempAt({ T, at: 0, inFire: false }, TRANSFER);
}

// --- The plunge

// wobbleAt is how far (degrees) the quench has rocked the blade tau seconds
// after it went in: the commission's waves, building up over the first second.
export function wobbleAt(c, tau) {
  const norm = c.wobble.reduce((a, w) => a + w.amp, 0);
  const sum = c.wobble.reduce((a, w) => a + w.sign * w.amp * Math.sin(2 * Math.PI * w.f * tau + w.phase), 0);
  return TILT * (0.6 + 0.4 * Math.min(1, tau)) * (sum / norm) * 1.6;
}

// newPlunge starts the quench at stage time start, in quenchant.
export function newPlunge(start, quenchant) {
  return { start, quenchant, end: start + QUENCHES[quenchant].time, at: start, steer: 0, rate: 0, tilt: 0, samples: 0 };
}

const clampSteer = (u) => Math.max(-MAX_STEER, Math.min(MAX_STEER, u));

// steer leans the blade from time t: to steer degrees, moving at rate
// degrees a second (the arrow keys). First it adds up the tilt from the last
// change to t.
export function steer(p, c, t, to, rate = 0) {
  const until = Math.min(t, p.end);
  let tilt = p.tilt, samples = p.samples;
  for (let k = Math.floor(p.at / DT) + 1; k * DT <= until; k++) {
    const s = k * DT;
    const u = clampSteer(p.steer + p.rate * (s - p.at));
    tilt += Math.abs(wobbleAt(c, s - p.start) + u);
    samples++;
  }
  const now = clampSteer(p.steer + p.rate * (until - p.at));
  return { ...p, at: Math.max(p.at, until), tilt, samples, steer: to === null ? now : clampSteer(to), rate };
}

// tiltAt is how far off upright the blade is at t (for drawing).
export function tiltAt(p, c, t) {
  const u = clampSteer(p.steer + p.rate * (Math.min(t, p.end) - p.at));
  return wobbleAt(c, Math.min(t, p.end) - p.start) + u;
}

export function meanTilt(p) {
  return p.samples ? p.tilt / p.samples : 0;
}

// --- What comes out

// hardness is how hard (HRC) the quench leaves the steel: fully hard from
// critical up, falling away below it, softer if the quench is too slow for
// the steel or it went in far too hot.
export function hardness(steel, T, quenchant) {
  if (quenchant === "air") return AIR_HARDNESS;
  const f = Math.max(0, Math.min(1, (T - (steel.critical - 60)) / 60));
  let h = AIR_HARDNESS + (steel.hard - AIR_HARDNESS) * f;
  if (steel.quench === "brine" && quenchant === "oil") h -= 7;
  if (steel.quench === "brine" && quenchant === "water") h -= 0.5;
  h -= Math.max(0, T - (steel.critical + 80)) / 50;
  return Math.round(h * 10) / 10;
}

// strain adds up everything that might crack the blade in the quench: cold
// and glancing blows (forge stress, by the worst section), steel that
// burned, strips of edge ground too thin, going in too hot, and a quench
// too harsh for the steel. It cracks at CRACK.
export function strain(steel, { stress, burning, thin, T, quenchant }) {
  if (quenchant === "air") return 0;
  const parts = {
    forge: 0.3 * stress * steel.crack,
    burnt: 0.15 * burning * steel.crack,
    edge: 0.08 * thin * steel.crack,
    heat: (Math.max(0, T - (steel.critical + GOOD_OVER)) / 120) * steel.crack,
    quench: 0,
  };
  const harsh = steel.quench === "oil" && quenchant !== "oil";
  if (harsh) {
    // Too fast for an oil steel: everything else counts nearly double, on
    // top of the shock itself.
    for (const k of ["forge", "burnt", "edge", "heat"]) parts[k] *= 1.8;
    parts.quench = (quenchant === "brine" ? 0.85 : 0.7) * steel.crack;
  } else if (steel.quench === "brine" && quenchant === "water") {
    parts.quench = 0.15 * steel.crack;
  }
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts };
}

// warp is how far (mm) the blade bends out of true: from tilting in the
// quench, and from sides ground unevenly.
export function warp(mean, uneven) {
  return 0.33 * mean + 1.2 * uneven;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// hardenScore is 0 for a cracked blade; otherwise 55% for reaching the
// steel's full hardness (from 50 HRC) and 45% for keeping it true (4 mm of
// warp loses it all).
export function hardenScore(steel, { cracked, hrc, warpMm }) {
  if (cracked) return 0;
  const hard = clamp01((hrc - 50) / (steel.hard - 1 - 50));
  const straight = clamp01(1 - warpMm / 4);
  return Math.round(55 * hard + 45 * straight);
}
