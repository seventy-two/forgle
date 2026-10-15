// The forge stage's rules: the blade's heat, the hammer's timing, and how
// each strike moves the steel. Everything is pure, and every result comes
// from event times rather than animation frames, so a slow device plays the
// same as a fast one. Times are seconds from the start of the stage.

export const FORGE_TIME = 90; // seconds on the clock for the forge stage
export const FIRE = 1340; // the forge's temperature: hotter than any steel can stand
export const ROOM = 20;
export const HEAT_TAU = 3.2; // seconds: how quickly the fire heats the blade
export const COOL_TAU = 20; // and how quickly it cools on the anvil
export const STRIKE_COOL = 6; // °C each blow takes out of the steel
export const MARKER_PERIOD = 1.1; // seconds for the hammer marker to sweep there and back
export const SWEET = 0.05; // how far either side of the centre still counts as a perfect blow
export const SPAN = 0.3; // how far past that a blow still lands at all
export const GLANCING = 0.35; // blows below this quality glance off
export const STRIKE_GAP = 0.25; // seconds to lift the hammer between blows
export const MAX_DRAW = 0.06; // the most of a section's width one perfect, hot blow takes
export const SPREAD = 0.2; // share of a blow that also moves each neighbouring section
export const MIN_WIDTH = 3; // mm
export const SCALE_RATE = 0.004; // share of the steel lost to scale per second it's burning

// --- Heat

// tempAt is the blade's temperature at time t, from its heat state: the
// temperature at its last change (at) and whether it's in the fire.
export function tempAt(heat, t) {
  const dt = Math.max(0, t - heat.at);
  if (heat.inFire) return FIRE - (FIRE - heat.T) * Math.exp(-dt / HEAT_TAU);
  return ROOM + (heat.T - ROOM) * Math.exp(-dt / COOL_TAU);
}

// burningBetween is how many seconds the blade spends above burn between
// heat.at and t.
export function burningBetween(heat, t, burn) {
  const dt = Math.max(0, t - heat.at);
  if (heat.inFire) {
    if (heat.T >= burn) return dt;
    return Math.max(0, dt - HEAT_TAU * Math.log((FIRE - heat.T) / (FIRE - burn)));
  }
  if (heat.T <= burn) return 0;
  return Math.min(dt, COOL_TAU * Math.log((heat.T - ROOM) / (burn - ROOM)));
}

// --- The hammer

// markerAt is where the hammer marker is at time t, from 0 to 1 and back;
// 0.5 is the centre of the anvil.
export function markerAt(t) {
  const phase = (((t / MARKER_PERIOD) % 1) + 1) % 1;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

// blowQuality is 1 for a blow struck in the centre, falling to 0 at the
// edge of the strike zone.
export function blowQuality(p) {
  const off = Math.max(0, Math.abs(p - 0.5) - SWEET);
  return Math.max(0, Math.min(1, 1 - off / SPAN));
}

// workability is how readily the steel moves at temperature T: little
// below its forging range, most at the top of it.
export function workability(T, steel) {
  if (T < steel.low) return 0.08 * Math.max(0, Math.min(1, (T - 500) / (steel.low - 500)));
  const h = Math.min(1, (T - steel.low) / (steel.high - steel.low));
  return 0.15 + 0.85 * h;
}

// --- The bar

// newBar is the billet at the start of the stage: every section as wide as
// the billet, fresh from the fire at the top of its forging range.
export function newBar(commission, steel) {
  const n = commission.widths.length;
  return {
    heat: { T: steel.high, at: 0, inFire: false },
    widths: Array(n).fill(commission.billet),
    areas: [...commission.areas],
    stress: Array(n).fill(0),
    burning: 0, // seconds spent burning
    strikes: 0,
    cold: 0, // blows struck below the forging range
    glancing: 0,
    lastStrike: -Infinity,
  };
}

// sectionLengths is how long each section is: steel moves, it doesn't
// vanish, so a narrower section is a longer one.
export function sectionLengths(bar) {
  return bar.areas.map((a, i) => a / bar.widths[i]);
}

// advance brings a bar up to time t: its heat, and any steel lost to scale
// while it burned.
export function advance(bar, t, steel) {
  if (t <= bar.heat.at) return bar;
  const burnt = burningBetween(bar.heat, t, steel.burn);
  const keep = Math.exp(-SCALE_RATE * burnt);
  return {
    ...bar,
    heat: { ...bar.heat, T: tempAt(bar.heat, t), at: t },
    areas: burnt ? bar.areas.map((a) => a * keep) : bar.areas,
    burning: bar.burning + burnt,
  };
}

// setFire puts the bar in the fire or takes it out at time t.
export function setFire(bar, t, steel, inFire) {
  const b = advance(bar, t, steel);
  return { ...b, heat: { ...b.heat, inFire } };
}

// strike hits section i at time t. It returns the new bar and what the blow
// was: "blocked" (in the fire, or the hammer's still up), "cold" (below the
// forging range: hardly moves and puts stress in the steel), "glancing"
// (badly timed: moves less and stresses it a little) or "clean".
export function strike(bar, t, i, steel) {
  if (bar.heat.inFire || t - bar.lastStrike < STRIKE_GAP) return { bar, blow: { kind: "blocked" } };
  const b = advance(bar, t, steel);
  const T = b.heat.T;
  const q = blowQuality(markerAt(t));
  const draw = MAX_DRAW * (0.3 + 0.7 * q) * workability(T, steel);
  const widths = [...b.widths];
  const stress = [...b.stress];
  const squeeze = (j, share) => {
    if (j < 0 || j >= widths.length) return;
    widths[j] = Math.max(MIN_WIDTH, widths[j] * (1 - draw * share));
  };
  squeeze(i, 1);
  squeeze(i - 1, SPREAD);
  squeeze(i + 1, SPREAD);

  let kind = "clean";
  if (T < steel.low) {
    kind = "cold";
    stress[i] += (0.25 + (steel.low - T) / 200) * steel.crack;
  } else if (q < GLANCING) {
    kind = "glancing";
    stress[i] += 0.08 * steel.crack;
  }
  return {
    bar: {
      ...b,
      heat: { ...b.heat, T: T - STRIKE_COOL },
      widths,
      stress,
      strikes: b.strikes + 1,
      cold: b.cold + (kind === "cold" ? 1 : 0),
      glancing: b.glancing + (kind === "glancing" ? 1 : 0),
      lastStrike: t,
    },
    blow: { kind, q, draw, T },
  };
}
