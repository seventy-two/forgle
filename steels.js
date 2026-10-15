// The steels a commission can call for. Temperatures are °C and loosely
// follow real smithing practice, simplified for the game:
//
//   low      don't hammer below this: the steel stops moving and starts to crack
//   high     the top of the forging range, where it moves most
//   burn     past this the steel burns: scale eats it and the grain blows up
//   critical the hardening temperature (non-magnetic), for the quench
//   quench   the quench oil or water that hardens it properly
//   crack    how easily it cracks from cold hammering and a harsh quench (1 is average)
//   hard     the hardness (HRC) a good quench gives it, before tempering

export const STEELS = [
  {
    id: "1084", name: "1084", low: 820, high: 1150, burn: 1240, critical: 770, quench: "oil", crack: 1.0, hard: 65,
    note: "Forgiving plain carbon steel that hardens in oil. Forges well across its whole range.",
  },
  {
    id: "1095", name: "1095", low: 840, high: 1120, burn: 1210, critical: 780, quench: "oil", crack: 1.25, hard: 66,
    note: "High carbon, hardened in a fast oil. Holds a keen edge, but cracks if worked cold.",
  },
  {
    id: "w2", name: "W2", low: 830, high: 1100, burn: 1190, critical: 790, quench: "brine", crack: 1.5, hard: 66,
    note: "Water-hardening tool steel: smiths quench it in brine for a lively hamon. Fussy about heat.",
  },
  {
    id: "5160", name: "5160", low: 870, high: 1180, burn: 1270, critical: 800, quench: "oil", crack: 0.7, hard: 62,
    note: "Tough oil-hardening spring steel. Likes to be worked hot and forgives a lot.",
  },
  {
    id: "80crv2", name: "80CrV2", low: 860, high: 1140, burn: 1230, critical: 790, quench: "oil", crack: 0.85, hard: 64,
    note: "Tough, fine-grained oil-hardening steel. A smith's favourite.",
  },
  {
    id: "damascus", name: "1084/15N20 damascus", low: 850, high: 1120, burn: 1190, critical: 790, quench: "oil", crack: 1.35, hard: 64,
    note: "Pattern-welded billet, hardened in oil. Work it cold and the welds open up.",
  },
];
export const steelById = Object.fromEntries(STEELS.map((s) => [s.id, s]));
