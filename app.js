import { dayKey, commission, forgeScore, barLength } from "./game.js";
import { bladeById, outline, outlinePath } from "./blades.js";
import { steelById } from "./steels.js";
import {
  FORGE_TIME, SWEET, SPAN, newBar, advance, setFire, strike, tempAt, markerAt, sectionLengths,
} from "./forge.js";
import { glowCSS, glowStrength, colourName } from "./glow.js";
import {
  GRIND_TIME, COLUMNS, BELT, EDGE, EDGE_OK, FLIP_TIME, beltAt, geometry, newGrind, edgeLeft, grind, flip, grindScore,
} from "./grind.js";
import {
  HARDEN_TIME, TRANSFER, CRACK, KEY_STEER, MAX_STEER, QUENCHES, htTemp, htSetFire, magnetSticks, quenchTemp,
  newPlunge, steer, tiltAt, meanTilt, hardness, strain, warp, hardenScore,
} from "./harden.js";

const KEY = dayKey();
const C = commission(KEY);
const BLADE = bladeById[C.blade];
const STEEL = steelById[C.steel];
const N = C.widths.length;
const HELP_STORE = "forgle:seen-help";
const SOUND_STORE = "forgle:sound";

// How each blade's hilt is drawn on the commission card: the grip's length
// as a share of the blade's, and the guard's height as a multiple of its
// width. Only for show.
const HILTS = {
  gladius: { grip: 0.2, guard: 1.6 },
  seax: { grip: 0.3, guard: 1.1 },
  katana: { grip: 0.34, guard: 2.2, round: true },
  falcata: { grip: 0.2, guard: 1.3 },
  longsword: { grip: 0.28, guard: 3.2 },
  shamshir: { grip: 0.15, guard: 2.6 },
};
const HILT = HILTS[C.blade] || { grip: 0.2, guard: 3 };

const $ = (id) => document.getElementById(id);
const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: play still works */ }
  },
};
const cm = (mm) => (mm / 10).toFixed(1);
const svgNS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

const state = {
  phase: "brief", // brief, forge, forged, grind, ground
  forged: null, // the forged blade: { widths, lengths }
  forgeScore: null,
  g: null, // the grind
  cols: null, // the forged blade's strips, for the grind
  press: { down: false, y: null, at: 0 }, // the grind's hold on the belt
  grindScore: null,
  heat: null, // the harden stage's heat
  plunge: null, // the quench, once it's in
  drag: null, // { x, steer } where a drag on the tank started
  hardened: null,
  practice: null, // the stage being practised, from a perfect blade, or null for a real go
  bar: null,
  picked: 0,
  t0: 0, // performance.now() when the forge stage started
  feedback: { text: "", kind: "", until: 0 },
};

// --- Sound: a dull thud for hot steel, a ring for cold, made on the fly.

const sound = {
  ctx: null,
  on: store.get(SOUND_STORE) !== false,
  init() {
    if (this.ctx || !this.on) return;
    try { this.ctx = new AudioContext(); } catch { this.on = false; }
  },
  blow(kind) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(ctx.destination);
    // A burst of noise for the hammer meeting steel.
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = kind === "cold" ? 5000 : 900;
    noise.connect(filter).connect(out);
    noise.start(now);
    // Cold steel rings; hot steel just thuds.
    const tones = kind === "cold" ? [2350, 3530, 4710] : kind === "glancing" ? [620] : [150];
    const decay = kind === "cold" ? 0.9 : 0.14;
    for (const f of tones) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = f;
      osc.type = kind === "cold" ? "sine" : "triangle";
      g.gain.setValueAtTime(kind === "cold" ? 0.12 : 0.35, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(g).connect(out);
      osc.start(now);
      osc.stop(now + decay);
    }
    out.gain.value = 0.6;
  },
  // hiss starts or stops the grinder's noise.
  hiss(on) {
    if (!this.ctx) return;
    if (on && this.on && !this.hissing) {
      const ctx = this.ctx;
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 3200;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      this.hissing = src;
    } else if (!on && this.hissing) {
      this.hissing.stop();
      this.hissing = null;
    }
  },
};

// --- The commission card

function swordSVG(svg, widths, lengths, { target, crack } = {}) {
  const shape = outline(BLADE, widths, lengths, { curve: C.curve, ref: Math.max(...C.widths) });
  const L = C.length;
  const grip = L * HILT.grip;
  const guardT = Math.max(6, L * 0.014);
  const guardH = C.width * HILT.guard;
  const ys = [...shape.top, ...shape.bottom].map(([, y]) => y);
  const minY = Math.min(...ys, -guardH / 2), maxY = Math.max(...ys, guardH / 2);
  const x0 = -grip - guardT - C.width * 0.5;
  const x1 = Math.max(L, shape.length) + 4;
  svg.setAttribute("viewBox", `${x0} ${minY - 4} ${x1 - x0} ${maxY - minY + 8}`);
  svg.replaceChildren();
  svg.append(
    el("rect", { class: "hilt", x: -grip - guardT, y: -C.width * 0.32, width: grip, height: C.width * 0.64, rx: C.width * 0.2 }),
    el("circle", { class: "fitting", cx: -grip - guardT, cy: 0, r: C.width * 0.42 }),
    HILT.round
      ? el("ellipse", { class: "fitting", cx: -guardT / 2, cy: 0, rx: guardT / 2 + 1, ry: guardH / 2 })
      : el("rect", { class: "fitting", x: -guardT, y: -guardH / 2, width: guardT, height: guardH, rx: guardT / 3 }),
    el("path", { class: "steel", d: outlinePath(shape) }),
  );
  if (target) {
    const goal = outline(BLADE, C.widths, C.lengths, { curve: C.curve, ref: Math.max(...C.widths) });
    svg.append(el("path", { class: "target", d: outlinePath(goal) }));
  }
  if (crack !== undefined) {
    // A jagged crack running up from the edge at crack (a share of the length).
    const i = Math.min(shape.bottom.length - 1, Math.round(crack * (shape.bottom.length - 1)));
    const [x, y] = shape.bottom[i];
    const h = C.width * 0.55;
    const d = `M${x},${y} l${-h * 0.15},${-h * 0.25} l${h * 0.2},${-h * 0.2} l${-h * 0.12},${-h * 0.3} l${h * 0.1},${-h * 0.25}`;
    svg.append(el("path", { class: "crack", d }));
  }
}

function swatch(T) {
  return `<span class="swatch" style="background:${glowCSS(T)};--glow:${glowCSS(T)}"></span>`;
}

function renderBrief() {
  const date = new Date(KEY + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  $("day").textContent = `#${C.number} · ${date}`;
  const article = /^[aeiou]/i.test(BLADE.name) ? "An" : "A";
  $("brief-title").textContent = `${article} ${BLADE.name} in ${STEEL.name}`;
  $("brief-about").textContent = BLADE.about;
  swordSVG($("sword"), C.widths, C.lengths);
  const rows = [
    ["Length", `${cm(C.length)} cm`],
    ["Width", `${cm(C.width)} cm at the guard<small>${cm(C.widths.at(-1))} cm where the point starts</small>`],
    ...(C.curve ? [["Curve", `${cm(Math.abs(C.curve))} cm at the point`]] : []),
    ["Steel", `${STEEL.name}<small>${STEEL.note}</small>`],
    ["Hammer", `${swatch(STEEL.low)}not below ${colourName(STEEL.low)}<small>${swatch(STEEL.burn)}it burns at ${colourName(STEEL.burn)}</small>`],
    ["Hardness", `${C.hardness[0]}–${C.hardness[1]} HRC`],
  ];
  $("spec").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}

// --- The forge scene

const scene = {
  sy: 1, // how much taller than life widths are drawn
  ref: 0,
  path: null,
  target: null,
  dividers: null,
  pick: null,
  hits: null,
};

function buildScene() {
  const svg = $("bar");
  scene.ref = C.billet;
  // Draw the billet about a fifth as tall as the scene is wide.
  scene.sy = Math.min(4, Math.max(1, (0.2 * C.length) / C.billet));
  const tang = C.length * 0.08;
  const h = C.billet * scene.sy;
  const x1 = C.length * 1.05;
  svg.setAttribute("viewBox", `${-tang} ${-h * 0.6} ${x1 + tang} ${h * 1.2}`);
  const goal = outline(BLADE, C.widths, C.lengths, { ref: scene.ref });
  scene.target = el("path", { class: "target", d: outlinePath(goal, { sy: scene.sy }) });
  scene.path = el("path", { class: "hot" });
  scene.tang = el("rect", { class: "tang", x: -tang, y: -h * 0.17, width: tang, height: h * 0.34 });
  scene.dividers = el("g");
  scene.pick = el("rect", { class: "pick", rx: 3 });
  scene.hits = el("g");
  svg.replaceChildren(scene.tang, scene.path, scene.dividers, scene.target, scene.pick, scene.hits);
  scene.vb = { x: -tang, w: x1 + tang };

  const cells = $("cells");
  cells.replaceChildren();
  for (let i = 0; i < N; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell";
    b.setAttribute("aria-label", `Section ${i + 1}`);
    b.innerHTML = `<div class="bar"></div><span></span>`;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); pick(i); });
    cells.append(b);
  }

  const meter = document.querySelector(".meter");
  meter.querySelector(".sweet").style.cssText = `left:${(0.5 - SWEET) * 100}%;width:${SWEET * 200}%`;
  meter.querySelector(".zone").style.cssText = `left:${(0.5 - SWEET - SPAN) * 100}%;width:${(SWEET + SPAN) * 200}%`;

  $("swatches").innerHTML = `<span>${swatch(STEEL.low)}not below</span><span>${swatch(STEEL.burn)}burns</span>`;
}

// sectionBounds is where each section starts and ends along the bar, in mm.
function sectionBounds(bar) {
  const lengths = sectionLengths(bar);
  const bounds = [];
  let x = 0;
  for (const l of lengths) {
    bounds.push([x, x + l]);
    x += l;
  }
  return bounds;
}

function drawBar() {
  const bar = state.bar;
  const lengths = sectionLengths(bar);
  scene.path.setAttribute("d", outlinePath(outline(BLADE, bar.widths, lengths, { ref: scene.ref }), { sy: scene.sy }));
  const bounds = sectionBounds(bar);
  const h = C.billet * scene.sy;
  scene.dividers.replaceChildren(...bounds.slice(1).map(([x]) => el("line", { class: "divider", x1: x, x2: x, y1: -h / 2, y2: h / 2 })));
  scene.hits.replaceChildren(...bounds.map(([a, b], i) => {
    const r = el("rect", { class: "hit", x: a, y: -h * 0.6, width: b - a, height: h * 1.2 });
    r.addEventListener("pointerdown", (e) => { e.preventDefault(); pick(i); });
    return r;
  }));
  const [a, b] = bounds[state.picked];
  scene.pick.setAttribute("x", a);
  scene.pick.setAttribute("width", b - a);
  scene.pick.setAttribute("y", -h * 0.56);
  scene.pick.setAttribute("height", h * 1.12);

  const cells = $("cells").children;
  for (let i = 0; i < N; i++) {
    const e = bar.widths[i] / C.widths[i] - 1;
    const cell = cells[i];
    const on = Math.abs(e) < 0.01;
    const thin = e <= -0.01;
    cell.classList.toggle("on", on);
    cell.classList.toggle("thin", thin);
    cell.classList.toggle("picked", i === state.picked);
    cell.querySelector("span").textContent = on ? "✓" : `${e > 0 ? "+" : "−"}${Math.round(Math.abs(e) * 100) || 1}`;
    cell.querySelector(".bar").style.height = on || thin ? "100%" : `${Math.min(1, e / 0.3) * 100}%`;
  }
  const i = state.picked;
  $("readout").textContent =
    `Section ${i + 1}: ${bar.widths[i].toFixed(1)} mm, wants ${C.widths[i].toFixed(1)} · ` +
    `${cm(barLength(C, bar))} of ${cm(C.length)} cm long`;
}

function pick(i) {
  if (state.phase !== "forge") return;
  state.picked = Math.max(0, Math.min(N - 1, i));
  drawBar();
}

function sparks(x, colour, count, spread = 1) {
  const svg = $("bar").getBoundingClientRect();
  const sc = $("scene").getBoundingClientRect();
  const px = svg.left - sc.left + ((x - scene.vb.x) / scene.vb.w) * svg.width;
  const py = svg.top - sc.top + svg.height / 2;
  const box = $("sparks");
  for (let k = 0; k < count; k++) {
    const s = document.createElement("i");
    s.className = "spark";
    const a = Math.PI * (1 + Math.random());
    const d = (30 + Math.random() * 60) * spread;
    s.style.cssText = `left:${px}px;top:${py}px;background:${colour};box-shadow:0 0 4px ${colour};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    box.append(s);
    s.addEventListener("animationend", () => s.remove());
  }
}

function say(text, kind = "", ms = 1200) {
  state.feedback = { text, kind, until: performance.now() + ms };
}

// --- Playing

const stageTime = (stamp) => (stamp - state.t0) / 1000;

function start() {
  state.practice = null;
  sound.init();
  sound.hiss(false);
  $("grind").hidden = true;
  $("harden").hidden = true;
  state.phase = "forge";
  state.bar = newBar(C, STEEL);
  state.picked = 0;
  state.t0 = performance.now();
  $("brief").hidden = true;
  $("result").hidden = true;
  $("forge").hidden = false;
  setStage("forge");
  buildScene();
  drawBar();
  say("Pick a section and strike while it's hot", "", 2500);
}

function doStrike(stamp) {
  if (state.phase !== "forge") return;
  const t = stageTime(stamp);
  if (state.bar.heat.inFire) {
    say("Take it out of the fire first");
    return;
  }
  const { bar, blow } = strike(state.bar, t, state.picked, STEEL);
  if (blow.kind === "blocked") return;
  state.bar = bar;
  sound.blow(blow.kind);
  drawBar();
  const [a, b] = sectionBounds(bar)[state.picked];
  const mid = (a + b) / 2;
  const meter = document.querySelector(".meter");
  meter.classList.add("hit");
  setTimeout(() => meter.classList.remove("hit"), 120);
  if (blow.kind === "cold") {
    say("Too cold: the steel rings", "cold");
    sparks(mid, "#9aa3ad", 2, 0.4);
  } else if (blow.kind === "glancing") {
    say("Glancing blow", "bad");
    sparks(mid, glowCSS(blow.T), 3, 0.6);
  } else {
    say(blow.q > 0.95 ? "Clean blow" : "Good blow");
    sparks(mid, glowCSS(blow.T + 150), 8);
  }
}

function toggleFire(stamp) {
  if (state.phase !== "forge") return;
  const inFire = !state.bar.heat.inFire;
  state.bar = setFire(state.bar, stageTime(stamp), STEEL, inFire);
  $("scene").classList.toggle("in-fire", inFire);
  $("fire").classList.toggle("active", inFire);
  $("fire").querySelector(".label").textContent = inFire ? "Pull out" : "Heat";
  say(inFire ? "In the fire" : "On the anvil", "", 800);
}

function finish(t) {
  if (state.phase !== "forge") return;
  state.phase = "done";
  state.bar = setFire(state.bar, Math.min(t, FORGE_TIME), STEEL, false);
  $("scene").classList.remove("in-fire");
  $("fire").classList.remove("active");
  $("fire").querySelector(".label").textContent = "Heat";
  showResult();
}

function showResult() {
  const bar = state.bar;
  const s = forgeScore(C, bar);
  state.forged = { widths: [...bar.widths], lengths: sectionLengths(bar) };
  state.forgeScore = s;
  state.phase = "forged";
  $("forge").hidden = true;
  $("result").hidden = false;
  kicker("Forging");
  $("result-note").textContent = "Next, grind the bevels.";
  $("next").textContent = "To the grinder";
  $("next").hidden = false;
  $("score").textContent = s.score;
  const final = $("final");
  swordSVG(final, bar.widths, sectionLengths(bar), { target: true });
  const rows = [
    ["Profile", `${s.profile}/100`],
    ["Average width off", `${(s.meanError * 100).toFixed(1)}%`],
    ["Length", `${cm(s.lengthMm)} of ${cm(C.length)} cm`],
    ["Length score", `${s.length}/100`],
    ["Blows", bar.strikes],
    ["Cold blows", bar.cold],
    ["Glancing blows", bar.glancing],
    ["Time burning", `${bar.burning.toFixed(1)} s`],
  ];
  $("breakdown").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const worries = [];
  if (bar.cold) worries.push(`${bar.cold} cold blow${bar.cold > 1 ? "s" : ""}: that may crack in the quench`);
  if (bar.burning > 0.5) worries.push("burnt steel: coarse grain and scale");
  $("verdict").textContent = worries.length ? `Watch out for ${worries.join(", and ")}.` : "No cold blows and nothing burnt: it should survive the quench.";
}

function kicker(text) {
  $("result-kicker").textContent = state.practice ? `${text} · practice` : text;
}

// practise skips to a stage with a perfect blade up to it: forged exactly
// to the commission, and ground to the line with an even 1 mm edge.
function practise(stage) {
  sound.init();
  sound.hiss(false);
  state.practice = stage;
  const bar = { ...newBar(C, STEEL), widths: [...C.widths] };
  state.bar = bar;
  state.forged = { widths: [...bar.widths], lengths: sectionLengths(bar) };
  state.forgeScore = forgeScore(C, bar);
  if (stage === "harden") {
    const cols = geometry(BLADE, state.forged.widths, state.forged.lengths, C.billet, C.stock);
    const half = cols.map((col) => (col.stock - EDGE) / 2);
    const g = { side: 1, lines: [cols.map(() => C.bevel), cols.map(() => C.bevel)], depth: [half, [...half]], flippedAt: -Infinity };
    state.grindScore = grindScore(C, g, cols);
  }
  for (const id of ["brief", "forge", "grind", "harden", "result"]) $(id).hidden = true;
  if (stage === "grind") startGrind();
  else startHarden();
}

// showBrief goes back to the commission, to start a real go or practise.
function showBrief() {
  sound.hiss(false);
  state.phase = "brief";
  for (const id of ["forge", "grind", "harden", "result"]) $(id).hidden = true;
  $("brief").hidden = false;
  setStage("forge");
}

function setStage(id) {
  let past = true;
  for (const li of $("stages").children) {
    const current = li.dataset.stage === id;
    if (current) past = false;
    li.classList.toggle("current", current);
    li.classList.toggle("done", past && !current);
  }
}

// --- The frame loop: the clock, the marker and the steel's glow. None of
// it changes the result, which comes from event times.

function frame(now) {
  requestAnimationFrame(frame);
  if (state.phase === "grind") grindFrame(now);
  if (state.phase === "harden" || state.phase === "plunge") hardenFrame(now);
  if (state.phase !== "forge") return;
  const t = stageTime(now);
  if (t >= FORGE_TIME) {
    finish(FORGE_TIME);
    return;
  }
  const left = FORGE_TIME - t;
  $("clock").textContent = Math.ceil(left);
  $("track").style.transform = `scaleX(${left / FORGE_TIME})`;
  $("forge").classList.toggle("low", left < 10);
  $("marker").style.left = `${markerAt(t) * 100}%`;

  const T = tempAt(state.bar.heat, t);
  const colour = glowCSS(T);
  const g = glowStrength(T);
  scene.path.style.fill = colour;
  scene.tang.style.fill = glowCSS(T - 120);
  scene.path.style.filter = g > 0 ? `drop-shadow(0 0 ${2 + g * 10}px ${colour})` : "none";

  const burning = T > STEEL.burn;
  if (burning && Math.random() < 0.5) {
    const bounds = sectionBounds(advance(state.bar, t, STEEL));
    const [a, b] = bounds[Math.floor(Math.random() * N)];
    sparks(a + Math.random() * (b - a), "#fff7d6", 1, 0.8);
  }
  const fb = state.feedback;
  const msg = $("feedback");
  if (burning) {
    msg.textContent = "It's burning! Get it out";
    msg.className = "feedback bad";
  } else if (now < fb.until) {
    msg.textContent = fb.text;
    msg.className = `feedback ${fb.kind}`;
  } else {
    msg.textContent = "";
  }
}


// --- The grinder

const gscene = { sy: 1, ref: 0 };

function startGrind() {
  state.phase = "grind";
  state.g = newGrind();
  state.press = { down: false, y: null, at: 0 };
  state.t0 = performance.now();
  const { widths, lengths } = state.forged;
  gscene.ref = C.billet;
  state.cols = geometry(BLADE, widths, lengths, gscene.ref, C.stock);
  $("result").hidden = true;
  $("grind").hidden = false;
  setStage("grind");
  buildGrinder();
  drawGrind(0);
  say("Hold the blade to the belt along the dashed line", "", 2500);
}

function buildGrinder() {
  const svg = $("gbar");
  const { widths, lengths } = state.forged;
  const shape = outline(BLADE, widths, lengths, { ref: gscene.ref });
  const L = shape.length;
  const ys = [...shape.top, ...shape.bottom].map(([, y]) => y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const tall = maxY - minY;
  // Draw the blade about a quarter as tall as the scene is wide, so the
  // line has room to be traced.
  gscene.sy = Math.min(8, Math.max(1.5, (0.26 * L) / tall));
  gscene.L = L;
  const pad = tall * gscene.sy * 0.18;
  gscene.vb = { x: -L * 0.02, y: minY * gscene.sy - pad, w: L * 1.04, h: tall * gscene.sy + 2 * pad };
  svg.setAttribute("viewBox", `${gscene.vb.x} ${gscene.vb.y} ${gscene.vb.w} ${gscene.vb.h}`);
  gscene.steel = el("path", { class: "steel", d: outlinePath(shape, { sy: gscene.sy }) });
  gscene.ground = el("path", { class: "ground" });
  gscene.goal = el("path", { class: "goal" });
  gscene.line = el("path", { class: "line" });
  gscene.other = el("path", { class: "other" });
  gscene.belt = el("rect", { class: "belt", y: gscene.vb.y, height: gscene.vb.h, width: BELT * L, rx: 2 });
  gscene.contact = el("line", { class: "contact" });
  svg.replaceChildren(gscene.steel, gscene.ground, gscene.other, gscene.goal, gscene.line, gscene.belt, gscene.contact);

  // The target line, mirrored on double-edged blades.
  gscene.goal.setAttribute("d", linePath(state.cols.map(() => C.bevel)));

  const cells = $("gcells");
  cells.replaceChildren();
  for (let i = 0; i < N; i++) {
    const b = document.createElement("div");
    b.className = "cell";
    b.innerHTML = `<div class="bar"></div><span></span>`;
    cells.append(b);
  }
}

// lineY is where a line at height h (a share of the span) sits over strip j,
// in drawn coordinates; mirror gives the other edge's on double-edged blades.
function lineY(j, h, mirror = false) {
  const c = state.cols[j];
  const y = mirror ? c.edge - 2 * c.span + h * c.span : c.edge - h * c.span;
  return y * gscene.sy;
}

function linePath(hs) {
  const cols = state.cols;
  const pts = (mirror) => cols.map((c, j) => `${c.mm.toFixed(1)},${lineY(j, hs[j], mirror).toFixed(2)}`).join("L");
  let d = `M${pts(false)}`;
  if (BLADE.edges === 2) d += `M${pts(true)}`;
  return d;
}

function groundPath(hs) {
  const cols = state.cols;
  const band = (mirror) => {
    const up = cols.map((c, j) => `${c.mm.toFixed(1)},${lineY(j, hs[j], mirror).toFixed(2)}`);
    const edge = cols.map((c, j) => `${c.mm.toFixed(1)},${lineY(j, 0, mirror).toFixed(2)}`).reverse();
    return `M${up.join("L")}L${edge.join("L")}Z`;
  };
  return band(false) + (BLADE.edges === 2 ? band(true) : "");
}

function drawGrind(t) {
  const g = state.g;
  const side = g.side;
  gscene.ground.setAttribute("d", groundPath(g.lines[side]));
  gscene.line.setAttribute("d", linePath(g.lines[side]));
  gscene.other.setAttribute("d", linePath(g.lines[1 - side]));
  $("side").textContent = side === 0 ? "First side" : "Second side";

  // Each section's edge, from the strips in it.
  const per = COLUMNS / N;
  const cells = $("gcells").children;
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = i * per; j < (i + 1) * per; j++) sum += edgeLeft(g, state.cols, j);
    const e = sum / per;
    const cell = cells[i];
    const on = Math.abs(e - EDGE) <= EDGE_OK;
    const thin = e < EDGE - EDGE_OK;
    cell.classList.toggle("on", on);
    cell.classList.toggle("thin", thin);
    cell.querySelector("span").textContent = e.toFixed(1);
    cell.querySelector(".bar").style.height = on || thin ? "100%" : `${Math.min(1, (e - EDGE) / 3) * 100}%`;
  }
  const off = (k) => (g.depth[k].reduce((a, b) => a + b, 0) / COLUMNS).toFixed(2);
  $("greadout").textContent = `Edge (mm), aim for ${EDGE.toFixed(1)} · ground off ${off(0)} | ${off(1)} mm`;

  const u = beltAt(t);
  gscene.belt.setAttribute("x", (u - BELT / 2) * gscene.L);
  const y = state.press.y;
  if (y === null) {
    gscene.contact.setAttribute("x1", 0);
    gscene.contact.setAttribute("x2", 0);
  } else {
    gscene.contact.setAttribute("x1", (u - BELT / 2) * gscene.L);
    gscene.contact.setAttribute("x2", (u + BELT / 2) * gscene.L);
    gscene.contact.setAttribute("y1", y * gscene.sy);
    gscene.contact.setAttribute("y2", y * gscene.sy);
  }
}

// bladeY turns a pointer event's position into the blade's own y (mm).
function bladeY(e) {
  const svg = $("gbar");
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return p.y / gscene.sy;
}

// holdAt records the blade being held to the belt (or let go) at an event:
// first grinding up to the event's time with the hold as it was, then
// taking the new height and grip.
function holdAt(e, down) {
  if (state.phase !== "grind") return;
  const t = stageTime(e.timeStamp);
  flushGrind(t);
  if (!e.keyboard) state.press.y = bladeY(e);
  state.press.down = down;
  $("gscene").classList.toggle("pressing", down);
  sound.hiss(down);
}

function flushGrind(t) {
  const p = state.press;
  const until = Math.min(t, GRIND_TIME);
  if (until > p.at) {
    state.g = grind(state.g, state.cols, p.at, until, p.down ? p.y : null);
    p.at = until;
  }
}

function doFlip(stamp) {
  if (state.phase !== "grind") return;
  const t = stageTime(stamp);
  flushGrind(t);
  state.g = flip(state.g, t);
  const sc = $("gscene");
  sc.classList.add("flipping");
  setTimeout(() => sc.classList.remove("flipping"), FLIP_TIME * 1000);
  say(state.g.side === 0 ? "Back to the first side" : "Flipped: now match the other side", "", 1500);
}

function grindFrame(now) {
  const t = stageTime(now);
  if (t >= GRIND_TIME) {
    finishGrind(GRIND_TIME);
    return;
  }
  flushGrind(t);
  const left = GRIND_TIME - t;
  $("gclock").textContent = Math.ceil(left);
  $("gtrack").style.transform = `scaleX(${left / GRIND_TIME})`;
  $("grind").classList.toggle("low", left < 10);
  drawGrind(t);

  // Sparks where the belt bites.
  const p = state.press;
  if (p.down && p.y !== null && t > state.g.flippedAt + FLIP_TIME) {
    const u = beltAt(t);
    const j = Math.max(0, Math.min(COLUMNS - 1, Math.floor(u * COLUMNS)));
    if (p.y < state.cols[j].edge && Math.random() < 0.8) {
      const svg = $("gbar").getBoundingClientRect();
      const sc = $("gscene").getBoundingClientRect();
      const px = svg.left - sc.left + ((u * gscene.L - gscene.vb.x) / gscene.vb.w) * svg.width;
      const py = svg.top - sc.top + ((state.cols[j].edge * gscene.sy - gscene.vb.y) / gscene.vb.h) * svg.height;
      const box = $("gsparks");
      for (let k = 0; k < 2; k++) {
        const s = document.createElement("i");
        s.className = "spark";
        const a = Math.PI * (0.25 + Math.random() * 0.5);
        const d = 30 + Math.random() * 50;
        s.style.cssText = `left:${px}px;top:${py}px;background:#ffcf7a;box-shadow:0 0 4px #ff9a3a;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
        box.append(s);
        s.addEventListener("animationend", () => s.remove());
      }
    }
  }
  const fb = state.feedback;
  const msg = $("gfeedback");
  msg.textContent = now < fb.until ? fb.text : "";
  msg.className = `feedback ${now < fb.until ? fb.kind : ""}`;
}

function finishGrind(t) {
  if (state.phase !== "grind") return;
  flushGrind(t);
  state.press.down = false;
  sound.hiss(false);
  state.phase = "ground";
  const g = state.g;
  const s = grindScore(C, g, state.cols);
  $("grind").hidden = true;
  $("result").hidden = false;
  kicker("Grinding");
  $("score").textContent = s.score;
  swordSVG($("final"), state.forged.widths, state.forged.lengths, { target: true });
  const rows = [
    ["Bevel lines", `${s.line}/100`],
    ["Lines off on average", `${(s.lineErr * 100).toFixed(1)}%`],
    ["Edge", `${s.edge}/100`],
    ["Strips too thin", `${s.thin} of ${COLUMNS}`],
    ["Sides uneven by", `${s.uneven.toFixed(2)} mm`],
    ["Forging", `${state.forgeScore.score}/100`],
  ];
  $("breakdown").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const worries = [];
  if (s.thin) worries.push(`${s.thin} strip${s.thin > 1 ? "s" : ""} of edge too thin, which may crack`);
  if (s.uneven > 0.3) worries.push("sides ground unevenly, which may warp it");
  $("verdict").textContent = worries.length ? `In the quench, watch out for ${worries.join(", and ")}.` : "Even sides and a sound edge: ready to harden.";
  state.grindScore = s;
  $("result-note").textContent = "Next, harden it.";
  $("next").textContent = "To the quench";
  $("next").hidden = false;
}

// --- Hardening

const hscene = { sy: 1 };
const ROOM_T = 20;

function startHarden() {
  state.phase = "harden";
  state.heat = { T: ROOM_T, at: 0, inFire: false };
  state.plunge = null;
  state.t0 = performance.now();
  $("result").hidden = true;
  $("harden").hidden = false;
  $("hbar").removeAttribute("hidden");
  $("tank").setAttribute("hidden", "");
  $("heat-controls").hidden = false;
  $("plunge-hint").hidden = true;
  $("hscene").classList.remove("plunging", "in-fire");
  $("hfire").classList.remove("active");
  $("hfire").querySelector(".label").textContent = "Heat";
  $("hstatus").textContent = "";
  setStage("harden");

  const { widths, lengths } = state.forged;
  const shape = outline(BLADE, widths, lengths, { ref: C.billet });
  const L = shape.length;
  const ys = [...shape.top, ...shape.bottom].map(([, y]) => y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  hscene.sy = Math.min(4, Math.max(1, (0.2 * L) / (maxY - minY)));
  const h = (maxY - minY) * hscene.sy;
  const svg = $("hbar");
  svg.setAttribute("viewBox", `${-L * 0.03} ${minY * hscene.sy - h * 0.2} ${L * 1.06} ${h * 1.4}`);
  hscene.path = el("path", { class: "hot", d: outlinePath(shape, { sy: hscene.sy }) });
  svg.replaceChildren(hscene.path);
  // The same blade, stood on its point, for the tank.
  const k = 205 / L;
  $("pblade").setAttribute("d", outlinePath(shape));
  $("pblade").setAttribute("transform", `rotate(90) scale(${k}) translate(0 ${-(minY + maxY) / 2})`);
  say("Heat it to just past critical: the magnet tells you when", "", 3000);
}

function htFire(stamp) {
  if (state.phase !== "harden") return;
  const t = stageTime(stamp);
  const inFire = !state.heat.inFire;
  state.heat = htSetFire(state.heat, t, inFire);
  $("hscene").classList.toggle("in-fire", inFire);
  $("hfire").classList.toggle("active", inFire);
  $("hfire").querySelector(".label").textContent = inFire ? "Pull out" : "Heat";
}

function useMagnet(stamp) {
  if (state.phase !== "harden") return;
  const t = stageTime(stamp);
  if (state.heat.inFire) htFire(stamp);
  const sticks = magnetSticks(htTemp(state.heat, t), STEEL);
  sound.blow(sticks ? "glancing" : "clean");
  say(sticks ? "The magnet sticks: not hot enough yet" : "The magnet falls away: it's past critical", sticks ? "cold" : "", 2000);
  $("hstatus").textContent = `Magnet at ${Math.floor(t)}s: ${sticks ? "sticks" : "doesn't stick"}`;
}

function quench(q, stamp) {
  if (state.phase !== "harden") return;
  const t = stageTime(stamp);
  state.quenchT = quenchTemp(state.heat, t);
  state.plunge = newPlunge(t + TRANSFER, q);
  state.phase = "plunge";
  state.drag = null;
  $("hscene").classList.remove("in-fire");
  $("hscene").classList.add("plunging");
  $("hbar").setAttribute("hidden", "");
  $("tank").removeAttribute("hidden");
  $("heat-controls").hidden = true;
  $("plunge-hint").hidden = false;
  $("liquid").style.setProperty("--liquid", { water: "#2d5f8a", brine: "#5b7d8f", oil: "#9a6a17" }[q]);
  $("pblade").style.setProperty("--glow", glowCSS(state.quenchT));
  $("hstatus").textContent = `Into the ${QUENCHES[q].name.toLowerCase()}`;
  sound.hiss(true);
  say("Keep it upright!", "", 1500);
}

function hardenFrame(now) {
  const t = stageTime(now);
  const fb = state.feedback;
  const msg = $("hfeedback");
  msg.textContent = now < fb.until ? fb.text : "";
  msg.className = `feedback ${now < fb.until ? fb.kind : ""}`;

  if (state.phase === "harden") {
    if (t >= HARDEN_TIME) {
      revealHarden("air");
      return;
    }
    const left = HARDEN_TIME - t;
    $("hclock").textContent = Math.ceil(left);
    $("htrack").style.transform = `scaleX(${left / HARDEN_TIME})`;
    $("harden").classList.toggle("low", left < 10);
    const T = htTemp(state.heat, t);
    const colour = glowCSS(T);
    const g = glowStrength(T);
    hscene.path.style.fill = colour;
    hscene.path.style.filter = g > 0 ? `drop-shadow(0 0 ${2 + g * 10}px ${colour})` : "none";
    return;
  }

  // In the quench: lower it in, rock it, cool its glow.
  const p = state.plunge;
  const into = Math.max(0, Math.min(1, (t - p.start + TRANSFER) / (TRANSFER + 0.3)));
  const tilt = t < p.start ? 0 : tiltAt(p, C, t);
  // A positive lean swings the tip right, the way a drag to the right does.
  $("plunger").setAttribute("transform", `translate(100 ${-150 + 158 * into}) rotate(${-tilt})`);
  const cool = Math.max(0, Math.min(1, (t - p.start) / (p.end - p.start)));
  $("pblade").style.setProperty("--glow", glowCSS(state.quenchT - cool * 700 - (t < p.start ? 0 : 150)));
  $("hstatus").textContent = t < p.start ? "" : `${Math.abs(tilt).toFixed(0)}° off upright`;
  const left = Math.max(0, p.end - t);
  $("hclock").textContent = left.toFixed(1);
  $("htrack").style.transform = `scaleX(${left / QUENCHES[p.quenchant].time})`;
  if (t > p.start && Math.random() < (p.quenchant === "oil" ? 0.35 : 0.8)) bubble(tilt);
  if (t >= p.end) {
    state.plunge = steer(p, C, p.end, null);
    revealHarden(p.quenchant);
  }
}

function bubble(tilt) {
  const reach = 60 + Math.random() * 60;
  const c = el("circle", {
    class: "bubble",
    cx: 100 + Math.sin((-tilt * Math.PI) / 180) * reach + (Math.random() - 0.5) * 14,
    cy: 120 + reach,
    r: 1 + Math.random() * 2.5,
  });
  c.style.setProperty("--bx", `${(Math.random() - 0.5) * 20}px`);
  $("bubbles").append(c);
  c.addEventListener("animationend", () => c.remove());
}

function revealHarden(quenchant) {
  const air = quenchant === "air";
  sound.hiss(false);
  const T = air ? htTemp(state.heat, HARDEN_TIME) : state.quenchT;
  const stress = Math.max(...state.bar.stress);
  const gs = state.grindScore;
  const st = strain(STEEL, { stress, burning: state.bar.burning, thin: gs.thin, T, quenchant });
  const cracked = !air && st.total >= CRACK;
  const hrc = hardness(STEEL, T, quenchant);
  const tiltMean = air ? 0 : meanTilt(state.plunge);
  const warpMm = air ? 1.2 * gs.uneven : warp(tiltMean, gs.uneven);
  const score = hardenScore(STEEL, { cracked, hrc, warpMm });
  state.hardened = { quenchant, T, strain: st, cracked, hrc, warpMm, tiltMean, score };
  state.phase = "hardened";
  if (cracked) {
    sound.blow("cold");
    const f = document.createElement("div");
    f.className = "crack-flash";
    $("hscene").append(f);
    f.addEventListener("animationend", () => f.remove());
    say("Ting! It cracked", "bad", 3000);
  } else {
    say(air ? "Too slow: it cooled in the air" : "It held", "", 3000);
  }
  $("hfeedback").textContent = state.feedback.text;
  $("hfeedback").className = `feedback ${state.feedback.kind}`;
  setTimeout(showHardenResult, 1400);
}

// crackAt is where along the blade (a share of its length) a crack shows:
// at the section with the most stress from the forge, or the middle.
function crackAt() {
  const stress = state.bar.stress;
  const most = Math.max(...stress);
  return most > 0 ? ((stress.indexOf(most) + 0.5) / N) * 0.92 : 0.5;
}

function showHardenResult() {
  const h = state.hardened;
  $("harden").hidden = true;
  $("result").hidden = false;
  kicker("Hardening");
  $("score").textContent = h.score;
  swordSVG($("final"), state.forged.widths, state.forged.lengths, h.cracked ? { crack: crackAt() } : {});
  const air = h.quenchant === "air";
  const wanted = QUENCHES[STEEL.quench].name.toLowerCase();
  const rows = [
    ["Quenched at", air ? "never: it cooled in the air" : `${Math.round(h.T)}°C (critical ${STEEL.critical}°C)`],
    ["Quench", air ? "air" : h.quenchant === STEEL.quench ? `${QUENCHES[h.quenchant].name} ✓` : `${QUENCHES[h.quenchant].name} (${STEEL.name} wants ${wanted})`],
    ["Strain", `${Math.round(h.strain.total * 100)}% (cracks at 100%)`],
    ["Cracked", h.cracked ? "yes" : "no"],
    ["Hardness", h.cracked ? "–" : `${h.hrc.toFixed(1)} HRC of ${STEEL.hard}`],
    ["Lean in the quench", air ? "–" : `${h.tiltMean.toFixed(1)}° on average`],
    ["Warp", `${h.warpMm.toFixed(1)} mm`],
    ["Forging, grinding", `${state.forgeScore.score}, ${state.grindScore.score}`],
  ];
  $("breakdown").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const names = { forge: "cold or glancing blows", burnt: "burnt steel", edge: "an edge ground too thin", heat: "quenching too hot", quench: "too harsh a quench" };
  const causes = Object.entries(h.strain.parts).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]).map(([k]) => names[k]);
  const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);
  let verdict;
  if (air) verdict = "It never reached the quench, so it's barely harder than when it left the anvil.";
  else if (h.cracked) verdict = `It cracked, from ${list(causes)}. On the show, that's you out.`;
  else if (h.hrc < STEEL.hard - 3) verdict = h.T < STEEL.critical ? "It wasn't past critical, so it didn't fully harden." : "It didn't fully harden: the quench was too slow for this steel, or it went in far too hot.";
  else verdict = causes.length ? `Hard and whole, though ${list(causes)} put strain on it.` : "Hard, whole and sound.";
  if (!h.cracked && h.warpMm >= 1.5) verdict += ` It's come out ${h.warpMm.toFixed(1)} mm out of true.`;
  $("verdict").textContent = verdict;
  $("result-note").textContent = "Tempering and testing come next.";
  $("next").hidden = true;
}

// --- Input

function setup() {
  renderBrief();
  $("start").addEventListener("click", start);
  $("again").addEventListener("click", showBrief);
  for (const b of document.querySelectorAll("[data-practise]")) {
    b.addEventListener("click", () => practise(b.dataset.practise));
  }
  $("next").addEventListener("click", () => {
    if (state.phase === "forged") startGrind();
    else if (state.phase === "ground") startHarden();
  });
  $("hfire").addEventListener("pointerdown", (e) => { e.preventDefault(); htFire(e.timeStamp); });
  $("magnet").addEventListener("pointerdown", (e) => { e.preventDefault(); useMagnet(e.timeStamp); });
  for (const b of document.querySelectorAll(".tank")) {
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); quench(b.dataset.q, e.timeStamp); });
  }
  const hs = $("hscene");
  hs.addEventListener("pointerdown", (e) => {
    if (state.phase !== "plunge") return;
    e.preventDefault();
    hs.setPointerCapture(e.pointerId);
    state.drag = { x: e.clientX, steer: state.plunge.steer };
  });
  hs.addEventListener("pointermove", (e) => {
    if (state.phase !== "plunge" || !state.drag) return;
    const w = hs.getBoundingClientRect().width;
    const to = state.drag.steer + ((e.clientX - state.drag.x) / w) * 2 * MAX_STEER;
    state.plunge = steer(state.plunge, C, stageTime(e.timeStamp), to);
  });
  const endDrag = () => { state.drag = null; };
  hs.addEventListener("pointerup", endDrag);
  hs.addEventListener("pointercancel", endDrag);
  $("flip").addEventListener("pointerdown", (e) => { e.preventDefault(); doFlip(e.timeStamp); });
  $("gdone").addEventListener("click", (e) => finishGrind(stageTime(e.timeStamp)));
  const gs = $("gscene");
  gs.addEventListener("pointerdown", (e) => { e.preventDefault(); gs.setPointerCapture(e.pointerId); holdAt(e, true); });
  gs.addEventListener("pointermove", (e) => holdAt(e, state.press.down));
  gs.addEventListener("pointerup", (e) => holdAt(e, false));
  gs.addEventListener("pointercancel", (e) => holdAt(e, false));
  addEventListener("keyup", (e) => {
    if (state.phase === "grind" && e.key === " ") holdAt({ timeStamp: e.timeStamp, keyboard: true }, false);
    if (state.phase === "plunge" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      state.plunge = steer(state.plunge, C, stageTime(e.timeStamp), null, 0);
    }
  });
  $("strike").addEventListener("pointerdown", (e) => { e.preventDefault(); doStrike(e.timeStamp); });
  $("fire").addEventListener("pointerdown", (e) => { e.preventDefault(); toggleFire(e.timeStamp); });
  $("done").addEventListener("click", (e) => finish(stageTime(e.timeStamp)));
  addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || $("help").open) return;
    if (state.phase === "harden" || state.phase === "plunge") {
      const k = e.key.toLowerCase();
      if (state.phase === "plunge" && (k === "arrowleft" || k === "arrowright")) {
        state.plunge = steer(state.plunge, C, stageTime(e.timeStamp), null, k === "arrowleft" ? -KEY_STEER : KEY_STEER);
      } else if (state.phase !== "harden") return;
      else if (k === "f") htFire(e.timeStamp);
      else if (k === "m") useMagnet(e.timeStamp);
      else if (k === "1" || k === "2" || k === "3") quench(["water", "brine", "oil"][Number(k) - 1], e.timeStamp);
      else return;
      e.preventDefault();
      return;
    }
    if (state.phase === "grind") {
      const k = e.key.toLowerCase();
      if (k === " ") holdAt({ timeStamp: e.timeStamp, keyboard: true }, true);
      else if (k === "f") doFlip(e.timeStamp);
      else return;
      e.preventDefault();
      return;
    }
    if (state.phase !== "forge") return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "j") doStrike(e.timeStamp);
    else if (k === "f") toggleFire(e.timeStamp);
    else if (k === "arrowleft" || k === "a") pick(state.picked - 1);
    else if (k === "arrowright" || k === "d") pick(state.picked + 1);
    else if (k >= "1" && k <= String(N)) pick(Number(k) - 1);
    else return;
    e.preventDefault();
  });
  $("help-open").addEventListener("click", () => $("help").showModal());
  const soundBtn = $("sound");
  soundBtn.setAttribute("aria-pressed", String(sound.on));
  soundBtn.addEventListener("click", () => {
    sound.on = !sound.on;
    store.set(SOUND_STORE, sound.on);
    soundBtn.setAttribute("aria-pressed", String(sound.on));
    sound.init();
  });
  if (!store.get(HELP_STORE)) {
    $("help").showModal();
    store.set(HELP_STORE, true);
  }
  setStage("forge");
  requestAnimationFrame(frame);
}

setup();
