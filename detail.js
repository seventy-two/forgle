// The details drawn on a blade: its ground bevels, and each kind's fuller,
// ridge, grooves or hamon (see detail in blades.js). Only for show.
//
// Everything is laid out in lanes across an outline (see outline in
// blades.js): lane 0 runs along its top line, lane 1 along its bottom one,
// so a detail keeps its place as the blade widens, narrows and comes to
// its point.

const lerp = (a, b, t) => a + (b - a) * t;

// across is the point a share f of the way from the outline's top line to
// its bottom line at its i-th sample.
function across(shape, i, f) {
  const [tx, ty] = shape.top[i], [bx, by] = shape.bottom[i];
  return [lerp(tx, bx, f), lerp(ty, by, f)];
}

// heightAt reads a bevel's height at x mm along the blade: h is one height
// for the whole edge, or its heights strip by strip, tang to point.
function heightAt(h, x, length) {
  if (!Array.isArray(h)) return h;
  const f = Math.max(0, Math.min(h.length - 1, (x / length) * h.length - 0.5));
  const j = Math.min(h.length - 2, Math.floor(f));
  return lerp(h[j], h[j + 1], f - j);
}

// bladeDetail gives a blade's details as shapes to draw over its steel,
// back to front: { cls, pts, closed }, in the outline's own coordinates
// (see polyPath in blades.js). bevels is how high each edge's bevel is
// ground, as a share of its span (the bottom edge first; one height or one
// per strip), or left out for a blade not yet ground. hamon is whether a
// blade that shows one has been hardened.
export function bladeDetail(blade, shape, { bevels = null, hamon = false } = {}) {
  const n = shape.top.length;
  const body = n - 1 - 12; // the last sample before the point (outline's point is 12 steps)
  const d = blade.detail || {};
  const two = blade.edges === 2;
  const out = [];
  const lane = (f, a = 0, b = n - 1) => {
    const pts = [];
    for (let i = a; i <= b; i++) pts.push(across(shape, i, typeof f === "function" ? f(i) : f));
    return pts;
  };
  const index = (share) => Math.round(share * body);

  // The bevels: each edge's ground face, and the line it's ground up to.
  // An edge's span is the whole width, or half of it on a two-edged blade.
  const bevelLane = [];
  if (bevels) {
    const k = two ? 0.5 : 1;
    for (let e = 0; e < blade.edges; e++) {
      const f = (i) => {
        const h = Math.max(0, Math.min(1, heightAt(bevels[e], shape.top[i][0], shape.length)));
        return e ? k * h : 1 - k * h;
      };
      const line = lane(f);
      const edge = lane(e ? 0 : 1);
      out.push({ cls: "bevel", pts: [...line, ...edge.reverse()], closed: true });
      out.push({ cls: "bevel-line", pts: line, closed: false });
      bevelLane[e] = f;
    }
  }

  // A fuller: a groove between two lanes, running out to nothing at its
  // far end (and at its near end, when it starts clear of the guard).
  if (d.fuller) {
    const [f0, f1] = d.fuller.at;
    const a = index(d.fuller.from), b = index(d.fuller.to);
    const mid = (f0 + f1) / 2;
    const taper = Math.max(2, Math.round((b - a) * 0.12));
    const open = (i) => Math.min(1, (b - i) / taper, d.fuller.from > 0 ? (i - a) / taper : 1) ** 0.5;
    const upper = lane((i) => lerp(mid, f0, open(i)), a, b);
    const lower = lane((i) => lerp(mid, f1, open(i)), a, b);
    out.push({ cls: "fuller", pts: [...upper, ...lower.slice().reverse()], closed: true });
    out.push({ cls: "fuller-shade", pts: upper, closed: false });
    out.push({ cls: "fuller-lip", pts: lower, closed: false });
  }
  // A ridge down the middle, to the very point.
  if (d.ridge) out.push({ cls: "ridge", pts: lane(0.5, index(d.ridge[0]), n - 1), closed: false });
  // Narrow grooves cut along the back.
  if (d.grooves) for (const f of d.grooves.at) out.push({ cls: "groove", pts: lane(f, index(d.grooves.from), index(d.grooves.to)), closed: false });

  // The katana's hamon, once it's hardened: the hard edge shows paler, up
  // to a wavy line, and the yokote marks off the point.
  if (d.hamon && hamon) {
    const wave = (i) => 1 - (0.25 + 0.05 * Math.sin(i * 1.3) + 0.03 * Math.sin(i * 2.9 + 1));
    out.push({ cls: "hamon", pts: [...lane(wave, 1, n - 1), ...lane(1, 1, n - 1).reverse()], closed: true });
  }
  if (d.yokote && bevelLane[0]) out.push({ cls: "yokote", pts: [across(shape, body, bevelLane[0](body)), across(shape, body, 1)], closed: false });
  return out;
}
