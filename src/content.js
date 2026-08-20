// All game content: weapons, enemies, upgrades. Pure data + small fire hooks.
import { TAU, rand } from './util.js';

/* ------------------------------------------------------------------ weapons */
// stats(lv) returns the numbers for that level. fire(G, w, s) spawns things.
export const WEAPONS = {
  blaster: {
    evo: { id: 'railgun', stat: 'crit' },
    name: 'Pulse Gun', icon: '🔫', max: 4,
    desc: lv => (lv >= 3 ? 'Fires 2 bolts' : 'Fires a bolt') + ' at the nearest target'
      + (lv >= 4 ? ', piercing one extra enemy' : ''),
    stats: lv => ({ cd: 0.58 - lv * 0.045, dmg: 14 + lv * 7, count: lv >= 3 ? 2 : 1, pierce: lv >= 4 ? 1 : 0, speed: 560 }),
    fire(G, s) {
      const t = G.nearestEnemy(G.player, 400); if (!t) return;
      const dx = t.x - G.player.x, dy = t.y - G.player.y;
      const base = Math.atan2(dy, dx);
      // Spread is an angle derived from a fixed lateral gap AT THE TARGET. With a
      // constant angle, an even-numbered volley straddles the target and both
      // bolts sail past it at range — levelling the gun made it miss more.
      const spread = Math.atan2(9, Math.max(40, Math.hypot(dx, dy)));
      for (let i = 0; i < s.count; i++) {
        const a = base + (i - (s.count - 1) / 2) * spread;
        G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: 4, pierce: s.pierce, color: '#4df3ff', life: 0.95 });
      }
    },
  },
  missile: {
    evo: { id: 'swarm', stat: 'rate' },
    name: 'Seeker Missiles', icon: '🚀', max: 4,
    desc: lv => { const n = 1 + Math.floor(lv / 2);
      return `Launches ${n} homing missile${n > 1 ? 's' : ''} that blast${n > 1 ? '' : 's'} on impact`; },
    stats: lv => ({ cd: 1.5 - lv * 0.1, dmg: 16 + lv * 8, count: 1 + Math.floor(lv / 2), blast: 46 + lv * 6, speed: 260 }),
    fire(G, s) {
      for (let i = 0; i < s.count; i++) {
        const t = G.nearestEnemy(G.player, 560, i, true);
        const a = t ? Math.atan2(t.y - G.player.y, t.x - G.player.x) + rand(0.5, -0.5) : rand(TAU);
        G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: 6, color: '#ffc44d', life: 2.4, homing: 4.5, blast: s.blast, trail: true });
      }
    },
  },
  laser: {
    evo: { id: 'prism', stat: 'dmg' },
    name: 'Annihilation Beam', icon: '⚡', max: 4,
    desc: lv => `A piercing beam that cuts through everything · ${18 + lv * 11} dmg`,
    stats: lv => ({ cd: 1.35 - lv * 0.09, dmg: 18 + lv * 11, pierce: 99, speed: 1500, w: 3 + lv }),
    fire(G, s) {
      const t = G.nearestEnemy(G.player, 480, 0, true); if (!t) return;
      const a = Math.atan2(t.y - G.player.y, t.x - G.player.x);
      G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: s.w, pierce: s.pierce, color: '#ff4dd2', life: 0.42, beam: true });
    },
  },
  nova: {
    evo: { id: 'singularity', stat: 'area' },
    name: 'Starburst', icon: '💥', max: 4,
    desc: lv => `Periodic shockwave that knocks enemies back · radius ${100 + lv * 26}`,
    stats: lv => ({ cd: 3.4 - lv * 0.22, dmg: 22 + lv * 12, radius: 100 + lv * 26, knock: 220 }),
    fire(G, s) { G.novaBlast(G.player.x, G.player.y, s.radius, s.dmg, s.knock); },
  },
  orbit: {
    evo: { id: 'bladestorm', stat: 'speed' },
    name: 'Orbit Blades', icon: '🌀', max: 4,
    desc: lv => `${2 + Math.floor(lv / 2)} blades circling you, shredding anything close`,
    // hitCd is how long one enemy is immune after a blade connects. It is the real
    // damage ceiling for an orbital — extra blades only widen coverage — so it has
    // to come down with level, and it is what player attack rate scales.
    stats: lv => ({ count: 2 + Math.floor(lv / 2), dmg: 9 + lv * 6, radius: 78 + lv * 9, spin: 2.4 + lv * 0.16, r: 11 + lv * 2, hitCd: 0.4 - lv * 0.04 }),
    orbital: true,
  },

  /* --- evolutions: max-level weapon + 2 picks of its paired stat --- */
  railgun: {
    name: 'Starbreaker', icon: '🌠', max: 1, evolved: true, from: 'Pulse Gun + Weak Point Analysis',
    desc: () => 'One shot that tears through the entire field',
    stats: () => ({ cd: 0.55, dmg: 205, pierce: 99, speed: 1500, w: 10 }),
    fire(G, s) {
      const t = G.nearestEnemy(G.player, 700, 0, true); if (!t) return;
      const a = Math.atan2(t.y - G.player.y, t.x - G.player.x);
      G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: s.w, pierce: s.pierce, color: '#fff2a8', life: 0.75, beam: true });
    },
  },
  swarm: {
    name: 'Hive', icon: '🛰', max: 1, evolved: true, from: 'Seeker Missiles + Rapid Cycling',
    desc: () => 'Six hard-locking missiles per volley, wide blast',
    stats: () => ({ cd: 1.05, dmg: 64, count: 6, blast: 88, speed: 320 }),
    fire(G, s) {
      for (let i = 0; i < s.count; i++) {
        const t = G.nearestEnemy(G.player, 700, i, true);
        const a = t ? Math.atan2(t.y - G.player.y, t.x - G.player.x) + rand(0.7, -0.7) : rand(TAU);
        G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: 7, color: '#ffdd66', life: 3, homing: 7, blast: s.blast, trail: true });
      }
    },
  },
  prism: {
    name: 'Prism Storm', icon: '✳', max: 1, evolved: true, from: 'Annihilation Beam + Overload',
    desc: () => 'Six piercing beams radiating out from you',
    stats: () => ({ cd: 0.95, dmg: 76, count: 6, speed: 1500, w: 6 }),
    fire(G, s) {
      const t = G.nearestEnemy(G.player, 600, 0, true);
      const base = t ? Math.atan2(t.y - G.player.y, t.x - G.player.x) : rand(TAU);
      for (let i = 0; i < s.count; i++) {
        G.spawnBullet({ a: base + i * TAU / s.count, speed: s.speed, dmg: s.dmg, r: s.w, pierce: 99, color: '#ff8ae6', life: 0.5, beam: true });
      }
    },
  },
  singularity: {
    name: 'Singularity', icon: '🕳', max: 1, evolved: true, from: 'Starburst + Field Expansion',
    desc: () => 'Collapses space, dragging enemies in and shredding them',
    stats: () => ({ cd: 2.5, dmg: 120, radius: 270, knock: -300 }),
    fire(G, s) { G.novaBlast(G.player.x, G.player.y, s.radius, s.dmg, s.knock); },
  },
  bladestorm: {
    name: 'Bladestorm', icon: '🌪', max: 1, evolved: true, from: 'Orbit Blades + Thrusters',
    desc: () => 'Eight massive blades forming a kill zone',
    stats: () => ({ count: 8, dmg: 68, radius: 132, spin: 3.6, r: 20, hitCd: 0.18 }),
    orbital: true,
  },
};

/* ------------------------------------------------------------------ enemies */
export const ENEMIES = {
  drone: { name: 'Drifter', hp: 20, speed: 96, r: 11, dmg: 7, xp: 1, color: '#ff7ba8', shape: 'tri' },
  darter: { name: 'Shrieker', hp: 12, speed: 152, r: 8, dmg: 6, xp: 1, color: '#ffd24d', shape: 'diamond' },
  brute: { name: 'Bulwark', hp: 110, speed: 72, r: 20, dmg: 17, xp: 5, color: '#a77bff', shape: 'hex' },
  spitter: { name: 'Spitter', hp: 42, speed: 80, r: 13, dmg: 10, xp: 3, color: '#5cff9d', shape: 'square',
    shoot: { cd: 2.2, speed: 205, dmg: 11, count: 1 } },
  weaver: { name: 'Weaver', hp: 70, speed: 112, r: 14, dmg: 11, xp: 4, color: '#4df3ff', shape: 'star', orbitStrafe: true },
  boss: { name: 'Mothership', hp: 900, speed: 78, r: 44, dmg: 34, xp: 90, color: '#ff4d5e', shape: 'boss', boss: true,
    shoot: { cd: 2.0, speed: 165, dmg: 16, count: 12 } },
  // The run ends on this thing, one way or the other. It does not use the shared
  // `shoot` block — its patterns and phases live in game.js updateDevourer().
  devourer: { name: 'The Devourer', hp: 34000, speed: 62, r: 78, dmg: 46, xp: 600,
    color: '#ff2f6d', shape: 'devourer', boss: true, final: true },
};

/* -------------------------------------------------------------------- arcs */
/**
 * A run is a campaign, not an open-ended treadmill. Four acts, then The Devourer
 * at FINAL_AT — kill it and the run is won. Every previous version of this game
 * could only end by killing you, which is why five balance passes in a row were
 * spent stopping strong builds from running forever: an endless mode has to be
 * held down by numbers, an arc ends because it was designed to.
 */
export const FINAL_AT = 420;

export const ACTS = [
  { t: 0, name: 'DEBRIS FIELD', sub: 'Scavenge what the void left behind' },
  { t: 130, name: 'THE HUNT', sub: 'Something noticed you' },
  { t: 270, name: 'SWARM TIDE', sub: 'They stop arriving one at a time' },
  { t: FINAL_AT, name: 'THE DEVOURER', sub: 'It has been waiting the whole run' },
];

/** Enemy scaling multipliers per tier. `spawn` scales the director's rate. */
export const DIFFICULTIES = [
  { id: 'recruit', name: 'RECRUIT', desc: 'A shorter climb to the Devourer', hp: 0.62, dmg: 0.76, spawn: 0.86 },
  { id: 'veteran', name: 'VETERAN', desc: 'The intended fight', hp: 1, dmg: 1, spawn: 1 },
  { id: 'nightmare', name: 'NIGHTMARE', desc: 'For a build that already works', hp: 1.45, dmg: 1.22, spawn: 1.15 },
];

// [startTime, type, weight] — director samples from entries unlocked at time t.
export const SPAWN_TABLE = [
  [0, 'drone', 10],
  [25, 'darter', 7],
  [60, 'brute', 4],
  [80, 'spitter', 4],
  [110, 'weaver', 4],
  [150, 'brute', 4],
  [200, 'darter', 8],
  // Act III leans on ranged attackers: an evolved build clears its own radius,
  // so melee chaff stops mattering and only bullets still threaten the player.
  [210, 'spitter', 10],
  [270, 'weaver', 10],
  [330, 'spitter', 14],
];

export const BOSS_INTERVAL = 90; // seconds

/* ----------------------------------------------------------------- upgrades */
/**
 * Stat upgrades stack ADDITIVELY, not multiplicatively. Twenty compounding +15%
 * damage picks is 16x; twenty additive ones is 4x. The compounding version is why
 * every balance pass since v0.3 ended up fighting the same runaway — player power
 * grew exponentially in level, so a two-level swing decided a whole run and the
 * enemy curve had to be knife-edged to contain it. Rate and armour use 1/(1+kn)
 * for the same reason: a multiplier that can be driven toward zero cannot be tuned.
 */
export const STAT_UPGRADES = [
  { id: 'dmg', icon: '🗡', name: 'Overload', desc: '+18% damage to everything', apply: p => p.damage += 0.18 },
  { id: 'rate', icon: '⏱', name: 'Rapid Cycling', desc: 'Fire faster', apply: p => { p.rateN = (p.rateN || 0) + 1; p.rate = 1 / (1 + 0.14 * p.rateN); } },
  { id: 'speed', icon: '👟', name: 'Thrusters', desc: '+16 movement speed', apply: p => p.speed += 16 },
  { id: 'hp', icon: '❤', name: 'Plating', desc: '+28 max HP, and heal for it', apply: p => { p.maxHp += 28; p.hp += 28; } },
  { id: 'regen', icon: '✚', name: 'Nanorepair', desc: 'Regenerate +0.7 HP per second', apply: p => p.regen += 0.7 },
  { id: 'armor', icon: '🛡', name: 'Deflectors', desc: 'Take less damage', apply: p => { p.armorN = (p.armorN || 0) + 1; p.armor = 1 / (1 + 0.16 * p.armorN); } },
  { id: 'pickup', icon: '🧲', name: 'Mag Coil', desc: '+40 pickup range', apply: p => p.pickup += 40 },
  { id: 'crit', icon: '🎯', name: 'Weak Point Analysis', desc: '+9% crit chance (double damage)', apply: p => p.crit += 0.09 },
  { id: 'area', icon: '🌐', name: 'Field Expansion', desc: '+16% area of effect', apply: p => p.area += 0.16 },
  { id: 'xp', icon: '⭐', name: 'Data Mining', desc: '+20% XP gained', apply: p => p.xpMult += 0.2 },
];

export const HEAL_CARD = { id: 'heal', icon: '🍀', name: 'Emergency Supply', desc: 'Instantly restore 40% HP', apply: p => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); } };
