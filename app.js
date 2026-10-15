import { dayKey, commission, forgeScore, barLength } from "./game.js";
import { bladeById, outline, outlinePath } from "./blades.js";
import { steelById } from "./steels.js";
import {
  FORGE_TIME, SWEET, SPAN, newBar, advance, setFire, strike, tempAt, markerAt, sectionLengths,
} from "./forge.js";
import { glowCSS, glowStrength, colourName } from "./glow.js";

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
  phase: "brief", // brief, forge, done
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
};

// --- The commission card

function swordSVG(svg, widths, lengths, { target } = {}) {
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
  sound.init();
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
  $("forge").hidden = true;
  $("result").hidden = false;
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

// --- Input

function setup() {
  renderBrief();
  $("start").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("strike").addEventListener("pointerdown", (e) => { e.preventDefault(); doStrike(e.timeStamp); });
  $("fire").addEventListener("pointerdown", (e) => { e.preventDefault(); toggleFire(e.timeStamp); });
  $("done").addEventListener("click", (e) => finish(stageTime(e.timeStamp)));
  addEventListener("keydown", (e) => {
    if (state.phase !== "forge" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($("help").open) return;
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
