// Drawing a quench crack. Real ones start at the edge, the thinnest and
// first-hardened part, and run in towards the spine as a fine, jagged
// hairline: widest where they open at the edge, often slanting, sometimes
// forking. Pure; the same blade and seed give the same crack.

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// crackLines gives the segments of a crack on a blade outline ({ top,
// bottom } lines of [x, y]) at `at` (a share of the way along the edge), as
// { x1, y1, x2, y2, w } with w a stroke width in pixels, widest at the edge.
// severity (1 and up) makes it longer, and past 1.3 adds a second hairline.
export function crackLines({ top, bottom }, at, seed, severity = 1) {
  const rand = mulberry32(seed);
  const segs = [];
  const one = (frac, reach, wide) => {
    const n = bottom.length;
    const i = Math.max(1, Math.min(n - 2, Math.round(frac * (n - 1))));
    const [x, y] = bottom[i];
    // Into the blade: perpendicular to the edge, towards the other side.
    const [ax, ay] = bottom[i - 1], [bx, by] = bottom[i + 1];
    let nx = -(by - ay), ny = bx - ax;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const across = top[Math.min(top.length - 1, i)];
    if ((across[0] - x) * nx + (across[1] - y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const depth = Math.hypot(across[0] - x, across[1] - y) * reach;
    // Slant back towards the tang a little, then wander.
    let angle = Math.atan2(ny, nx) + (rand() < 0.75 ? -1 : 1) * (0.15 + rand() * 0.25);
    const steps = 7;
    const nodes = [[x, y]];
    for (let k = 0; k < steps; k++) {
      angle += (rand() - 0.5) * 0.9;
      const step = (depth / steps) * (0.7 + rand() * 0.6);
      const [px, py] = nodes.at(-1);
      nodes.push([px + Math.cos(angle) * step, py + Math.sin(angle) * step]);
    }
    for (let k = 0; k < steps; k++) {
      const w = wide * (1 - k / steps) + 0.5;
      segs.push({ x1: nodes[k][0], y1: nodes[k][1], x2: nodes[k + 1][0], y2: nodes[k + 1][1], w });
    }
    // A fork from part way up.
    const from = 2 + Math.floor(rand() * 2);
    let fa = angle + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.4);
    let [px, py] = nodes[from];
    for (let k = 0; k < 3; k++) {
      fa += (rand() - 0.5) * 0.8;
      const step = (depth / steps) * (0.5 + rand() * 0.4);
      const qx = px + Math.cos(fa) * step, qy = py + Math.sin(fa) * step;
      segs.push({ x1: px, y1: py, x2: qx, y2: qy, w: wide * 0.45 * (1 - k / 3) + 0.4 });
      px = qx;
      py = qy;
    }
  };
  one(at, Math.min(0.9, 0.62 + 0.3 * (severity - 1)), 2.6);
  if (severity > 1.3) one(Math.min(0.97, at + 0.05 + rand() * 0.04), 0.4, 1.6);
  return segs;
}
