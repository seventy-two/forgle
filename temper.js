// The temper stage's rules: running the colours with a torch. The blade is
// split into strips along its length, each with a spine and an edge
// temperature. The torch heats the spine where it's held; heat soaks down
// to the edge and along the blade, and bleeds away. Steel colours as it
// heats and keeps the colour of the hottest it got, and that hottest
// temperature sets how much of the quench's hardness it gives up. Pure and
// sampled on a fixed grid of absolute times, like the grind.

export const TEMPER_TIME = 45; // seconds on the clock
export const STRIPS = 40;
export const TORCH = 200; // °C a second the torch puts into the spine under its centre
export const TORCH_WIDTH = 0.07; // its reach along the blade (a share of the length; one standard deviation)
export const SOAK = 0.6; // how quickly heat passes from spine to edge (per second)
export const SPREAD = 0.4; // and along the blade
export const LOSS = 0.05; // and bleeds away into the air
export const ROOM = 20;
export const DT = 0.005;
export const TOUGH = 265; // a spine taken to purple or beyond is tough

// DROP is how many HRC steel gives up when tempered at each temperature.
const DROP = [[150, 0], [175, 1.5], [200, 3.5], [225, 5.5], [250, 7.5], [275, 9.5], [300, 11], [350, 14], [400, 18], [500, 25]];

function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table.at(-1)[1];
}

// temperedHardness is the hardness left after tempering steel quenched to
// h0 at up to T °C.
export function temperedHardness(h0, T) {
  return h0 - interp(DROP, T);
}

// temperFor is the temperature that tempers h0 down to h (the inverse of
// temperedHardness).
export function temperFor(h0, h) {
  const want = h0 - h;
  for (let i = 1; i < DROP.length; i++) {
    const [x0, y0] = DROP[i - 1], [x1, y1] = DROP[i];
    if (want <= y1) return y1 === y0 ? x0 : x0 + ((x1 - x0) * (want - y0)) / (y1 - y0);
  }
  return DROP.at(-1)[0];
}

// The oxide colours steel takes on as it's tempered.
const OXIDE = [
  [170, [201, 204, 209]],
  [190, [225, 214, 160]],
  [215, [214, 180, 90]],
  [235, [190, 140, 60]],
  [250, [150, 95, 45]],
  [265, [110, 60, 110]],
  [280, [60, 60, 140]],
  [300, [60, 100, 170]],
  [330, [110, 150, 180]],
  [370, [150, 160, 165]],
];

export function oxideRGB(T) {
  if (T <= OXIDE[0][0]) return OXIDE[0][1];
  for (let i = 1; i < OXIDE.length; i++) {
    if (T <= OXIDE[i][0]) {
      const [t0, c0] = OXIDE[i - 1], [t1, c1] = OXIDE[i];
      const f = (T - t0) / (t1 - t0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
    }
  }
  return OXIDE.at(-1)[1];
}

export function oxideCSS(T) {
  const [r, g, b] = oxideRGB(T);
  return `rgb(${r}, ${g}, ${b})`;
}

// The colours named on the temper chart, and the temperature each shows at.
export const CHART = [
  ["bright", 160],
  ["pale straw", 195],
  ["straw", 215],
  ["bronze", 240],
  ["purple", 265],
  ["blue", 295],
  ["grey", 360],
];

export function newTemper() {
  const room = () => Array(STRIPS).fill(ROOM);
  return { spine: room(), edge: room(), maxSpine: room(), maxEdge: room() };
}

// torch heats the blade from t0 to t1 with the torch at x (a share of the
// blade's length; null for off), and lets the heat move.
export function torch(tp, t0, t1, x) {
  if (t1 <= t0) return tp;
  const spine = [...tp.spine], edge = [...tp.edge], maxSpine = [...tp.maxSpine], maxEdge = [...tp.maxEdge];
  const ns = Array(STRIPS), ne = Array(STRIPS);
  const reach = 2 * TORCH_WIDTH * TORCH_WIDTH;
  for (let k = Math.floor(t0 / DT) + 1; k * DT <= t1; k++) {
    for (let j = 0; j < STRIPS; j++) {
      const xj = (j + 0.5) / STRIPS;
      const heat = x === null || x === undefined ? 0 : TORCH * Math.exp(-((xj - x) ** 2) / reach);
      const sl = spine[Math.max(0, j - 1)], sr = spine[Math.min(STRIPS - 1, j + 1)];
      const el = edge[Math.max(0, j - 1)], er = edge[Math.min(STRIPS - 1, j + 1)];
      const soak = SOAK * (spine[j] - edge[j]);
      ns[j] = spine[j] + DT * (heat - soak - LOSS * (spine[j] - ROOM) + (SPREAD * (sl + sr - 2 * spine[j])) / 4);
      ne[j] = edge[j] + DT * (soak - LOSS * (edge[j] - ROOM) + (SPREAD * (el + er - 2 * edge[j])) / 4);
    }
    for (let j = 0; j < STRIPS; j++) {
      spine[j] = ns[j];
      edge[j] = ne[j];
      if (spine[j] > maxSpine[j]) maxSpine[j] = spine[j];
      if (edge[j] > maxEdge[j]) maxEdge[j] = edge[j];
    }
  }
  return { spine, edge, maxSpine, maxEdge };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// temperScore is 0–100: 80% for the edge's hardness along the blade (each
// strip in the commission's band scores fully, losing a quarter for every
// HRC outside it) and 20% for a tough spine (purple or beyond). It also
// counts strips of edge left too hard (likely to chip) or too soft (likely
// to roll), and the edge's average hardness.
export function temperScore(c, tp, h0) {
  const [lo, hi] = c.hardness;
  let edge = 0, spine = 0, brittle = 0, soft = 0, mean = 0;
  for (let j = 0; j < STRIPS; j++) {
    const h = temperedHardness(h0, tp.maxEdge[j]);
    mean += h;
    const off = h < lo ? lo - h : h > hi ? h - hi : 0;
    edge += clamp01(1 - off / 4);
    if (h > hi + 1.5) brittle++;
    if (h < lo - 1.5) soft++;
    spine += clamp01((tp.maxSpine[j] - 200) / (TOUGH - 200));
  }
  edge /= STRIPS;
  spine /= STRIPS;
  return {
    score: Math.round(80 * edge + 20 * spine),
    edge: Math.round(100 * edge),
    spine: Math.round(100 * spine),
    brittle,
    soft,
    hrc: mean / STRIPS,
  };
}
