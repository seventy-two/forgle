# forgle

A daily sword-forging game. Every UTC day brings a new commission (a blade,
its steel, its size and shape) to forge, grind, harden and temper, much as
on Forged in Fire, with some of the busy heat management of RuneScape's
Giants' Foundry. Then the blade is tested: paper, a hardwood post, rope, and
a bend. No meat.

All five stages are built. The one-go-a-day lock and stats are still to come.

The commission card can also skip to a stage for practice, with a perfect
blade up to it: forged exactly to the commission, and ground to the line
with an even 1 mm edge.

## The forge

- The billet starts as a plain bar, a quarter wider than the blade's widest
  section and shorter than the blade. The blade is forged in 8 sections:
  pick one (tap it or its box, ← → or 1–8) and strike (Space) as the marker
  crosses the anvil's centre. A centred blow takes up to 6% of the
  section's width; an off-centre one less; a glancing one stresses it. Each
  blow also moves the sections either side by a fifth as much.
- Steel moves, it doesn't vanish: each section keeps its area, so a narrower
  section is a longer one, and a bar forged to the right widths is the right
  length. Over-thin sections can't be widened again.
- The blade has one temperature, shown only by its glow. It cools on the
  anvil (time constant 20s) and heats in the fire (3.2s) towards 1340°C,
  hotter than any steel can stand. Each steel has a range: hot steel moves
  most; near the bottom of the range it moves little, which is how fine
  corrections are made; below it, blows hardly move it and build stress
  (cracks, revealed at the quench). Above the steel's burning point it
  throws sparks and loses metal to scale.
- 90 seconds. The score is three quarters profile (each 1% off on average
  costs 10 points) and a quarter length (each 1% off costs 20).

## The grind

- The forged blade goes to a belt grinder. The belt stays put; the player
  draws the blade across it: press and hold on the blade to put it on the
  belt, move across to draw it along (or ← → and hold Space). The belt
  covers 8% of the blade's length at once, so wherever the blade lingers it
  takes off more.
- The blade is held to the belt at a tilt (1–15° from the face; drag up or
  down while pressing, the wheel, or ↑ ↓). The belt is a flat plane: every
  moment pressed cuts each strip under it 3.2 mm/s deeper along a plane at
  that tilt, starting where the plane first meets the face (the edge on a
  fresh face, the shoulder on a face already ground steeper). The bevel's
  height isn't steered: it's where that plane leaves the face, so a shallow
  tilt runs it high and a steep one keeps it low. A line too low can be
  raised with a shallower pass; one too high stays.
- The edge comes off the anvil between 2.9 and 4.5 mm thick, varying along
  the blade each day, so the right tilt varies along it too. The target is
  a 1 mm edge (±0.3) with the bevel at the day's height (a share of the way
  from edge to spine, or to the centre line on double-edged blades, which
  are ground on both edges at once). Each side takes half of what has to
  come off; the boxes show what's left on the current side (✓ within
  ±0.15 mm). A cross-section of the strip under the belt shows the steel
  (drawn thicker than life), the belt's face and the bevels to cut.
- Steel under the belt heats (faster the thinner its edge) and cools in the
  air (time constant 3s); steady passes stay well below blue, lingering
  blues it in a second or two. The bucket (C) cools it, taking a second.
  Blued strips keep their colour.
- 45 seconds for both sides. 60% for the lines, weighted by the blade's
  width so the point counts little, and 40% for the edge (less a share for
  each blued strip). Strips under 0.6 mm or blued, and unevenly ground
  sides, are kept for the quench.

## Harden

- The heat-treat forge levels off at 900°C (time constant 4s), so it can
  take any steel past its critical temperature (770–800°C) but not much
  further. Every steel's critical temperature glows about the same cherry,
  so the magnet is the tool: it sticks below critical. Testing takes the
  blade out of the fire.
- Quench it in water, brine or oil. It cools for 0.6s on the way. Each
  steel's note on the commission says what it wants. Oil steels in water or
  brine take a shock that nearly doubles everything else; W2 in oil comes
  out 7 HRC soft.
- The quench rocks the blade (a few slow waves, different each day; up to about 15°) for 4s
  in oil or 2.5s in water or brine. Drag sideways (or ← →) to keep it
  upright. The average lean (0.25 mm a degree) plus uneven grinding
  (1.2 mm per mm) is the warp.
- Strain adds up the forge's worst section stress, seconds spent burning,
  edge strips ground under 0.6 mm or blued on the grinder, going in more than 50°C past critical,
  and the quench, scaled by the steel's crack sensitivity. At 100% it
  cracks. No luck involved.
- 35 seconds to get it into the quench, or it cools in the air (30 HRC).
  Score: 0 if cracked, otherwise 55% hardness, 45% warp (4 mm loses it all).

## Temper

- The blade is split into 40 strips, each with a spine and an edge
  temperature. Press and hold to play the torch on the spine (200°C/s at
  its centre, reaching about 7% of the length either way); heat soaks to
  the edge (rate 0.6/s), along the blade, and away into the air, so the
  edge lags the spine and keeps heating after the torch moves on. The
  stage runs on for 8s after it ends to let the colours finish running.
- Each strip keeps the oxide colour of the hottest it got, and that
  temperature sets how much hardness the edge gives up (1.5 HRC by 175°C,
  5.5 by 225°C, 11 by 300°C…). The chart shows the hardness each colour
  leaves this blade, from its as-quenched hardness.
- 45 seconds. 80% for each strip's edge in the commission's band (a
  quarter lost per HRC outside it), 20% for the spine reaching purple
  (265°C).

## Test

No meat. Measurements (the forge score), paper (grind edge and line),
hardwood post (temper, less warp past 1 mm; too hard chips, too soft
rolls, cracked snaps), rope coil (profile and edge), and bend (cracked or
too hard without a tough spine snaps, too soft takes a set). The test
score is their average; the overall score is forge 25%, grind 15%, harden
20%, temper 15%, tests 25%, with a verdict ("It will kill." from 90) and
a line of squares to share.

## How it works

It's a static page with no server.

- `game.js`: the daily commission (seeded by the UTC date; the 12 blades
  come round in a shuffled cycle, once each every 12 days) and scoring.
- `blades.js`: the blade templates (width profile, tip, curve) and drawing
  an outline from section widths. `steels.js`: the steels' temperatures,
  quench and crack sensitivity. `glow.js`: steel's colour by temperature.
- `forge.js`: the forge stage's rules, pure functions of event times: the
  heat model is solved exactly between events, and a blow's quality comes
  from the event's timestamp, not animation frames.
- `grind.js`: the grind stage's rules. Each strip's two faces are followed
  at 25 heights, and the belt cuts them to a plane. The time between two
  events is sampled on a fixed 5ms grid of absolute times, so the result
  doesn't depend on how often the page updates.
- `harden.js`: heating, the magnet, the plunge (the tilt is summed on the
  same kind of fixed grid), hardness, strain and warp.
- `temper.js`: the torch's heat model, oxide colours and tempered
  hardness. `trials.js`: the tests, the overall score and the share text.
- `hilts.js`: the hilt drawn on the commission card for each blade.
  `crack.js`: a quench crack, opening at the edge and running in.
- `app.js` draws it and handles input.

## Running

```sh
python3 -m http.server
npm test
```
