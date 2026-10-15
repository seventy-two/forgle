// Hilts for the commission card: a guard, grip and pommel to suit each
// blade, drawn as one piece. Only for show. Shapes are in mm, with the
// blade starting at x = 0 and running right; the hilt runs left from there,
// centred on cy, where the middle of the blade meets the guard.
//
// hilt returns the parts to draw, back to front, as { tag, cls, attrs,
// front } (front parts, the guard, go over the blade's root), and how far
// left the hilt reaches (x0, negative) and up and down (half its height).

export const HILT_STYLES = {
  gladius: { grip: 0.19, guard: "block", pommel: "ball", ribbed: true },
  seax: { grip: 0.32, guard: "ferrule", pommel: "cap" },
  katana: { grip: 0.36, guard: "tsuba", pommel: "kashira", wrap: "ito" },
  falchion: { grip: 0.2, guard: "cross", span: 3, pommel: "wheel", wrap: "spiral" },
  shamshir: { grip: 0.16, guard: "cross", span: 2.6, pommel: "cap", wrap: "spiral" },
  arming: { grip: 0.18, guard: "cross", span: 3.4, pommel: "wheel", wrap: "spiral" },
  viking: { grip: 0.13, guard: "cross", span: 1.9, pommel: "lobed", wrap: "spiral" },
  jian: { grip: 0.24, guard: "cross", span: 2, pommel: "cap", wrap: "spiral" },
  messer: { grip: 0.2, guard: "cross", span: 2.8, pommel: "cap", ribbed: true },
  longsword: { grip: 0.3, guard: "cross", span: 4, pommel: "wheel", wrap: "spiral" },
  cutlass: { grip: 0.17, guard: "cross", span: 2.4, pommel: "cap", ribbed: true },
  falcata: { grip: 0.2, guard: "cross", span: 1.4, pommel: "hook", ribbed: true },
};

const f = (n) => Number(n.toFixed(2));

// gripPath is a grip from x = a (the pommel end) to x = b (the guard end),
// half-height h, swelling a little in the middle.
function gripPath(a, b, cy, h) {
  const m = (a + b) / 2;
  const top = (k) => f(cy - h * k), bot = (k) => f(cy + h * k);
  return `M${f(b)},${top(0.95)} Q${f(m)},${top(1.18)} ${f(a)},${top(0.9)} L${f(a)},${bot(0.9)} Q${f(m)},${bot(1.18)} ${f(b)},${bot(0.95)} Z`;
}

export function hilt(bladeId, width, length, cy = 0) {
  const st = HILT_STYLES[bladeId] || HILT_STYLES.arming;
  const w = width;
  const parts = [];
  let front = true; // the guard comes first, and sits over the blade
  const add = (tag, cls, attrs) => parts.push({ tag, cls, attrs, front });
  let half = w * 0.6;

  // The guard, from x = -g (its back) to 0.
  let g;
  if (st.guard === "cross") {
    g = Math.max(w * 0.22, length * 0.012);
    const span = (w * st.span) / 2;
    // A straight bar with rounded tips, and a block at its middle.
    add("rect", "fitting", { x: f(-g), y: f(cy - span), width: f(g), height: f(2 * span), rx: f(g * 0.35) });
    for (const sgn of [-1, 1]) add("ellipse", "fitting", { cx: f(-g / 2), cy: f(cy + sgn * span), rx: f(g * 0.75), ry: f(g * 0.55) });
    add("rect", "fitting", { x: f(-g * 1.5), y: f(cy - w * 0.62), width: f(g * 1.5 + 1), height: f(w * 1.24), rx: f(g * 0.3) });
    half = Math.max(half, span + g * 0.55);
    g *= 1.5;
  } else if (st.guard === "block") {
    g = w * 0.42;
    add("path", "wood", {
      d: `M0,${f(cy - w * 0.8)} Q${f(-g * 1.1)},${f(cy - w * 0.75)} ${f(-g)},${f(cy)} Q${f(-g * 1.1)},${f(cy + w * 0.75)} 0,${f(cy + w * 0.8)} Z`,
    });
    add("rect", "fitting", { x: f(-w * 0.06), y: f(cy - w * 0.72), width: f(w * 0.08), height: f(w * 1.44) });
    half = Math.max(half, w * 0.8);
  } else if (st.guard === "tsuba") {
    g = w * 0.32;
    add("rect", "brass", { x: f(-g * 0.35), y: f(cy - w * 0.62), width: f(w * 0.55), height: f(w * 1.24), rx: f(w * 0.05) }); // habaki
    add("ellipse", "iron", { cx: f(-g * 0.6), cy: f(cy), rx: f(g * 0.42), ry: f(w * 1.15) });
    add("rect", "brass", { x: f(-g * 0.25), y: f(cy - w * 0.75), width: f(w * 0.05), height: f(w * 1.5) }); // seppa
    half = Math.max(half, w * 1.15);
  } else {
    // A ferrule: a plain ring where the grip meets the blade.
    g = w * 0.12;
    add("rect", "fitting", { x: f(-g), y: f(cy - w * 0.4), width: f(g + 1), height: f(w * 0.8), rx: f(g * 0.3) });
  }

  // The grip, overlapping the guard and the pommel so nothing shows between.
  front = false;
  const gripLen = length * st.grip;
  const b = -g + 0.5;
  const a = -g - gripLen;
  const gh = w * (st.guard === "tsuba" ? 0.42 : 0.3);
  const grip = gripPath(a - 1, b, cy, gh);
  add("path", st.guard === "block" || st.guard === "ferrule" ? "wood" : "hilt", { d: grip });
  if (st.wrap === "spiral") {
    const step = w * 0.28;
    const lines = [];
    for (let x = a + step * 0.5; x < b - step * 0.3; x += step) lines.push(`M${f(x)},${f(cy + gh * 1.2)} L${f(x + step * 0.6)},${f(cy - gh * 1.2)}`);
    add("path", "wrap", { d: lines.join(""), clip: grip });
  } else if (st.wrap === "ito") {
    // The katana's diamond wrap: crossing bands with the ray skin showing between.
    const step = w * 0.55;
    const lines = [];
    for (let x = a + step * 0.4; x < b - step * 0.2; x += step) {
      lines.push(`M${f(x)},${f(cy - gh * 1.2)} L${f(x + step / 2)},${f(cy + gh * 1.2)}`);
      lines.push(`M${f(x)},${f(cy + gh * 1.2)} L${f(x + step / 2)},${f(cy - gh * 1.2)}`);
    }
    add("path", "ito", { d: lines.join(""), clip: grip });
  } else if (st.ribbed) {
    const n = 3;
    const lines = [];
    for (let i = 1; i <= n; i++) {
      const x = a + (gripLen * i) / (n + 1);
      lines.push(`M${f(x)},${f(cy - gh * 1.2)} L${f(x)},${f(cy + gh * 1.2)}`);
    }
    add("path", "rib", { d: lines.join(""), clip: grip });
  }

  // The pommel, sitting on the end of the grip.
  let x0 = a;
  if (st.pommel === "wheel") {
    const rx = w * 0.2, ry = w * 0.42;
    add("ellipse", "fitting", { cx: f(a - rx * 0.7), cy: f(cy), rx: f(rx), ry: f(ry) });
    add("rect", "fitting", { x: f(a - rx * 1.7 - w * 0.08), y: f(cy - w * 0.08), width: f(w * 0.12), height: f(w * 0.16), rx: f(w * 0.03) });
    x0 = a - rx * 1.7 - w * 0.08;
  } else if (st.pommel === "ball") {
    const rx = w * 0.4, ry = w * 0.5;
    add("ellipse", "wood", { cx: f(a - rx * 0.75), cy: f(cy), rx: f(rx), ry: f(ry) });
    add("rect", "fitting", { x: f(a - rx * 1.75 - w * 0.06), y: f(cy - w * 0.07), width: f(w * 0.1), height: f(w * 0.14), rx: f(w * 0.02) });
    x0 = a - rx * 1.75 - w * 0.06;
  } else if (st.pommel === "lobed") {
    // A Viking upper guard and its lobed pommel.
    const t = w * 0.2;
    add("rect", "fitting", { x: f(a - t), y: f(cy - w * 0.6), width: f(t + 1), height: f(w * 1.2), rx: f(t * 0.3) });
    const r = w * 0.22;
    const xc = a - t - r * 0.8;
    add("path", "fitting", {
      d: `M${f(a - t + 0.5)},${f(cy - w * 0.55)} Q${f(xc - r)},${f(cy - w * 0.62)} ${f(xc - r * 0.6)},${f(cy - w * 0.22)} Q${f(xc - r * 1.4)},${f(cy)} ${f(xc - r * 0.6)},${f(cy + w * 0.22)} Q${f(xc - r)},${f(cy + w * 0.62)} ${f(a - t + 0.5)},${f(cy + w * 0.55)} Z`,
    });
    x0 = xc - r * 1.4;
  } else if (st.pommel === "kashira") {
    const t = w * 0.28;
    add("rect", "iron", { x: f(a - t), y: f(cy - gh * 1.0), width: f(t + 1.5), height: f(gh * 2), rx: f(t * 0.35) });
    x0 = a - t;
  } else if (st.pommel === "hook") {
    // The falcata's bird-head pommel, curling down over the hand.
    add("path", "wood", {
      d: `M${f(a + 1)},${f(cy - gh * 1.1)} Q${f(a - w * 0.7)},${f(cy - gh * 1.6)} ${f(a - w * 0.55)},${f(cy + w * 0.35)} Q${f(a - w * 0.4)},${f(cy + w * 0.75)} ${f(a - w * 0.15)},${f(cy + w * 0.55)} Q${f(a - w * 0.25)},${f(cy + gh)} ${f(a + 1)},${f(cy + gh * 0.9)} Z`,
    });
    x0 = a - w * 0.62;
    half = Math.max(half, w * 0.75);
  } else {
    // A plain cap.
    const t = w * 0.16;
    add("rect", "fitting", { x: f(a - t), y: f(cy - gh * 1.05), width: f(t + 1.5), height: f(gh * 2.1), rx: f(t * 0.5) });
    x0 = a - t;
  }
  return { parts, x0, half };
}
