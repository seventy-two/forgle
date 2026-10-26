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

- The forged blade goes to a belt grinder that stays put on the right of
  the scene; the player holds the sword upright, point up, and drags it
  around: up and down to run it along the belt, right to push the edge in
  (or ↑ ↓ ← →). The sword is drawn as on the commission, true to life with
  its hilt; the scene shows 0.9 of the blade's length around the belt, and
  along the blade it moves 1.5 times as far as the pointer, so one drag
  covers the whole blade. The belt is
  12% of the blade's length wide.
- Wherever the edge is pushed onto the belt, the bevel there climbs, at up
  to 1.2 of the span a second, with the square of how far it's pushed in
  (a light touch grinds slowly). Letting go lifts the blade clear.
  It's a slack belt: it gives by up to 40% of the blade's widest span, so
  nearby parts of a curved edge touch too, more lightly; the blade can't be
  pushed in further.
- The edge thins as the bevel climbs, from its thickness off the anvil
  (2.9–4.5 mm, varying along the blade each day) to 1 mm as the bevel
  reaches the day's line, and on past it. Both faces are ground alike.
  The ground bevel is coloured strip by strip for its edge: pale while
  over 1.3 mm, green to 0.7, amber to 0.4, red below (it may crack), and a
  red dotted line marks the height where it gets there.
- Double-edged blades are turned over (F) to grind the other edge.
- 55 seconds. 60% for the lines, weighted by the blade's width so the
  point counts little, and 40% for the edge (1 mm ± 0.3). Strips under
  0.4 mm are kept for the quench.

## Harden

- The harden and temper stages draw the sword true to life, as on the
  commission, but with its bare tang: the hilt goes on after heat
  treatment.

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
  upright. The average lean (0.25 mm a degree) is the warp.
- Strain adds up the forge's worst section stress, seconds spent burning,
  edge strips ground under 0.4 mm, going in more than 50°C past critical,
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
- `grind.js`: the grind stage's rules. The time between two events is
  sampled on a fixed 5ms grid of absolute times, so the result doesn't
  depend on how often the page updates.
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
