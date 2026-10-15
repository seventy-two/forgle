# forgle

A daily sword-forging game. Every UTC day brings a new commission (a blade,
its steel, its size and shape) to forge, grind, harden and temper, much as
on Forged in Fire, with some of the busy heat management of RuneScape's
Giants' Foundry. Then the blade is tested: paper, a hardwood post, rope, and
a bend. No meat.

So far only the first stage, the forge, is built.

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
- `app.js` draws it and handles input.

## Running

```sh
python3 -m http.server
npm test
```
