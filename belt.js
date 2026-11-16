// The belt grinder's drawing: the path of a belt stretched round its wheels.

// beltLoop is the path of a belt round wheels ([{ x, y, r }], y down, given
// in the order the belt meets them, running anticlockwise on screen: down
// the left, along the bottom, up the right). It returns the SVG path and
// each straight run as { from, to }, wheel to wheel. The wheels must all be
// on the outside of the loop (it doesn't cross itself or bend back).
export function beltLoop(wheels) {
  const n = wheels.length;
  // The run leaving wheel i for wheel i + 1 touches both at their centres
  // plus their radius along the same normal, which leans from the outward
  // side of the line between the centres by the difference in their radii.
  const normals = wheels.map((a, i) => {
    const b = wheels[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const along = (a.r - b.r) / d;
    const out = Math.sqrt(Math.max(0, 1 - along * along));
    return [(along * dx - out * dy) / d, (along * dy + out * dx) / d];
  });
  const at = (w, [nx, ny]) => [w.x + w.r * nx, w.y + w.r * ny];
  const f = (v) => v.toFixed(2);
  const runs = wheels.map((a, i) => ({ from: at(a, normals[i]), to: at(wheels[(i + 1) % n], normals[i]) }));
  let d = `M${f(runs[0].from[0])},${f(runs[0].from[1])}`;
  for (let i = 0; i < n; i++) {
    const w = wheels[(i + 1) % n];
    const [ax, ay] = normals[i], [bx, by] = normals[(i + 1) % n];
    // How far round the wheel the belt wraps, anticlockwise on screen.
    const wrap = (Math.atan2(ay, ax) - Math.atan2(by, bx) + 4 * Math.PI) % (2 * Math.PI);
    const next = runs[(i + 1) % n].from;
    d += `L${f(runs[i].to[0])},${f(runs[i].to[1])}A${f(w.r)},${f(w.r)} 0 ${wrap > Math.PI ? 1 : 0} 0 ${f(next[0])},${f(next[1])}`;
  }
  return { d: d + "Z", runs };
}
