/** Movement policies shared by sim.mjs and bench.mjs. */
import { G } from '../src/game.js';
import { DERELICT } from '../src/content.js';

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
    // Bullets. The threat field used to contain enemies only, which was survivable
    // while bullets were a minor damage source — but since the density rework they
    // are 91% of everything the player takes, and a bot that walks straight through
    // them is not a stand-in for a competent player, it is a broken instrument.
    // Only bullets actually closing on us matter, and the dodge is sideways
    // (perpendicular to the shot) the way a person dodges, not straight backwards.
    for (const b of G.ebullets) {
      const dx = p.x - b.x, dy = p.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > 200 || d < 1) continue;
      if (b.vx * dx + b.vy * dy <= 0) continue;          // heading away: ignore
      const w = (200 - d) / 200 / d * 2.6;
      fx += dx * w; fy += dy * w;
      // strafe to whichever side of the shot we are already on
      const side = Math.sign(b.vx * dy - b.vy * dx) || 1;
      const bl = Math.hypot(b.vx, b.vy) || 1;
      fx += -b.vy / bl * side * w * 1.4;
      fy += b.vx / bl * side * w * 1.4;
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

    // Derelicts. A competent player commits to one when healthy and keeps dodging
    // *inside* the ring rather than leaving it, so the seek term is gentle once in
    // and decisive when out. Below 42% health it is not worth the beacon.
    const h = G.hulks[0];
    if (h && p.hp / p.maxHp > 0.42) {
      const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy) || 1;
      const w = d < DERELICT.radius * 0.72 ? 0.45 : 1.9;
      x += dx / d * w; y += dy / d * w;
    }

    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  },
};
