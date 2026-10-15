// The test stage, like the show's final tests but with no meat: the blade
// is measured, then cuts paper, chops a hardwood post, cuts a coil of rope
// and is bent. Each result follows from how the blade was made; there's no
// luck. Also the overall score, and the result to share.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const grade = (score) => (score >= 85 ? "pass" : score >= 55 ? "meh" : "fail");

// trials runs every test on a finished blade. Its inputs are the results of
// each stage: forge (forgeScore), grind (grindScore), harden (cracked,
// warpMm) and temper (temperScore). Each test has a score (0–100), a grade
// and what happened.
export function trials(c, { forge, grind, harden, temper }) {
  const cracked = harden.cracked;
  const [lo, hi] = c.hardness;
  const results = [];
  const add = (id, name, score, text) => results.push({ id, name, score: Math.round(score), grade: grade(score), text });

  // Measured against the commission.
  const lenOff = Math.abs(forge.lengthError * 100);
  const widthOff = forge.meanError * 100;
  add("measure", "Measurements", forge.score,
    forge.score >= 85 ? `On the money: ${lenOff.toFixed(1)}% off on length, ${widthOff.toFixed(1)}% on width.`
      : forge.score >= 55 ? `Close: ${lenOff.toFixed(1)}% off on length, ${widthOff.toFixed(1)}% on width.`
        : `Not what was asked for: ${lenOff.toFixed(1)}% off on length, ${widthOff.toFixed(1)}% on width.`);

  // Paper: the edge and the bevel.
  const paper = 0.7 * grind.edge + 0.3 * grind.line;
  add("paper", "Paper", paper,
    paper >= 85 ? "Slices clean through the sheet." : paper >= 55 ? "Cuts, but snags on the way through." : "Tears the paper rather than cutting it.");

  // The hardwood post: three chops, then a look at the edge.
  let post, postText;
  if (cracked) {
    post = 0;
    postText = "Snaps at the crack on the first chop.";
  } else {
    const warpCost = 25 * Math.max(0, harden.warpMm - 1);
    post = clamp01((temper.edge - warpCost) / 100) * 100;
    const chips = temper.brittle >= 4, rolls = temper.soft >= 4;
    if (chips && temper.hrc > hi) postText = `Bites deep, but the edge chips: at ${temper.hrc.toFixed(1)} HRC it's too hard.`;
    else if (rolls && temper.hrc < lo) postText = `The edge rolls over: at ${temper.hrc.toFixed(1)} HRC it's too soft.`;
    else if (harden.warpMm > 2) postText = `It glances off: ${harden.warpMm.toFixed(1)} mm of warp throws the cut.`;
    else if (post >= 85) postText = "Three deep, clean chops, and the edge is untouched.";
    else postText = "Chops well, but the edge shows some wear.";
  }
  add("post", "Hardwood post", post, postText);

  // The rope coil: geometry and edge.
  const rope = 0.5 * forge.profile + 0.5 * grind.edge;
  add("rope", "Rope coil", rope,
    rope >= 85 ? "Severs the coil in one cut." : rope >= 55 ? "Takes two cuts to get through." : "Bounces off, leaving the rope frayed.");

  // The bend.
  let bend, bendText;
  if (cracked) {
    bend = 0;
    bendText = "Snaps clean in two.";
  } else if (temper.spine < 30 && temper.hrc > hi + 1) {
    bend = 0;
    bendText = "Too hard all through: it shatters under the load.";
  } else if (temper.hrc < lo - 2) {
    bend = 40;
    bendText = "Takes a set: it stays bent where it should spring back.";
  } else {
    bend = 60 + 40 * clamp01(temper.spine / 100);
    bendText = bend >= 85 ? "Flexes and springs straight back, true." : "Springs back, though the spine could be tougher.";
  }
  add("bend", "Bend", bend, bendText);

  const score = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length);
  return { results, score };
}

// WEIGHTS is how much each stage counts towards the overall score.
export const WEIGHTS = { forge: 0.25, grind: 0.15, harden: 0.2, temper: 0.15, test: 0.25 };

export function totalScore(scores) {
  return Math.round(Object.entries(WEIGHTS).reduce((a, [k, w]) => a + w * scores[k], 0));
}

// verdict is the judges' word on the blade.
export function verdict(total, cracked) {
  if (cracked) return "It cracked. The blade won't survive the tests.";
  if (total >= 90) return "It will kill.";
  if (total >= 75) return "A fine blade, ready for the next round.";
  if (total >= 55) return "It works, but the judges have doubts.";
  return "Back to the forge.";
}

export function square(score) {
  if (score >= 85) return "🟩";
  if (score >= 60) return "🟨";
  if (score >= 30) return "🟧";
  return "🟥";
}

// shareText is the result players copy and share.
export function shareText(number, total, scores, url) {
  const stages = ["forge", "grind", "harden", "temper", "test"];
  return [`Forgle #${number} · ${total}/100`, stages.map((k) => square(scores[k])).join(""), url].join("\n");
}
