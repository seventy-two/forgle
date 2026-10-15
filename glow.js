// The colour hot steel glows at each temperature, as a smith sees it in a
// dim forge. Below about 480°C it's plain grey steel.

const STOPS = [
  [20, [107, 111, 117]],
  [470, [107, 111, 117]],
  [540, [74, 42, 38]],
  [610, [110, 29, 20]],
  [690, [155, 31, 18]],
  [770, [196, 42, 18]],
  [850, [224, 64, 26]],
  [930, [240, 98, 28]],
  [1010, [247, 138, 34]],
  [1090, [251, 176, 59]],
  [1170, [253, 214, 105]],
  [1250, [255, 241, 184]],
  [1330, [255, 255, 255]],
];

// glowRGB is the [r, g, b] steel glows at T °C.
export function glowRGB(T) {
  if (T <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (T <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const f = (T - t0) / (t1 - t0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
    }
  }
  return STOPS.at(-1)[1];
}

export function glowCSS(T) {
  const [r, g, b] = glowRGB(T);
  return `rgb(${r}, ${g}, ${b})`;
}

// glowStrength is 0 for steel too cool to glow, rising to 1 at white heat:
// how much light it gives off.
export function glowStrength(T) {
  return Math.max(0, Math.min(1, (T - 500) / 800));
}

// colourName is what a smith calls the colour at T.
export function colourName(T) {
  if (T < 480) return "black";
  if (T < 650) return "dull red";
  if (T < 750) return "blood red";
  if (T < 850) return "cherry";
  if (T < 950) return "bright cherry";
  if (T < 1050) return "orange";
  if (T < 1150) return "yellow-orange";
  if (T < 1250) return "yellow";
  return "white";
}
