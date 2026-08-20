/** Movement policies shared by sim.mjs and bench.mjs. */
import { G } from '../src/game.js';

export const BOTS = {
  // Baseline: blind circling. Deliberately bad — a floor, not a target.
  circle(p, t) {
    const a = t * 0.8 + Math.sin(t * 0.37) * 1.6;
    return { x: Math.cos(a), y: Math.sin(a) };
  },
  // Kite: flee the local threat field, drift toward loose XP, avoid orbiting
  // in one spot. Rough stand-in for a competent human.
  kite(p, t) {
    let fx = 0, fy = 0;
    for (const e of G.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 330 || d < 1) continue;
      const w = (e.boss ? 2.5 : 1) * (330 - d) / 330 / d;
      fx += dx * w; fy += dy * w;
    }
    const fl = Math.hypot(fx, fy);
    if (fl > 0) { fx /= fl; fy /= fl; }
    // pull toward the nearest orb that isn't in the danger direction
    let ox = 0, oy = 0, bd = Infinity;
    for (const o of G.orbs) {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bd) { bd = d; ox = (o.x - p.x) / (d || 1); oy = (o.y - p.y) / (d || 1); }
    }
    const wander = t * 0.35;
    let x = fx * 1.0 + ox * 0.45 + Math.cos(wander) * 0.2;
    let y = fy * 1.0 + oy * 0.45 + Math.sin(wander) * 0.2;
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  },
};
