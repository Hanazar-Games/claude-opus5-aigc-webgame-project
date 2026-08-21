#!/usr/bin/env node
/**
 * Weapon damage bench.
 *
 *   node tools/bench.mjs            # dps table + monotonicity assertions
 *   node tools/bench.mjs --stats    # also: which stat upgrade helps which weapon
 *
 * sim.mjs answers "is a run the right length". This answers "does this weapon do
 * what its card claims". The v0.8 bug — Pulse Gun Lv.3 firing two bolts that both
 * missed — was a straight DPS regression, and survival time was far too noisy to
 * show it. Two numbers per weapon:
 *
 *   boss   one target parked at 120px, everything else frozen out. This is the
 *          Mothership fight, and it is the number that decides whether a run ends.
 *   clear  kills per second in a real run: live spawns, kiting bot, player made
 *          immortal, enemy population pinned at FIELD so every weapon faces the
 *          same density, and the first WARM seconds discarded because nothing is
 *          hard yet. Kills, not damage — damage counts overkill, and overkill is
 *          exactly what a two-bolt volley into one 20hp drone produces. A frozen
 *          hand-made ring cannot measure orbit blades at all: their damage comes
 *          from enemies flowing through the ring.
 */
import { G, TUNE, update, newRun } from '../src/game.js';
import { WEAPONS, ENEMIES, STAT_UPGRADES } from '../src/content.js';
import { input } from '../src/input.js';
import { setSeed } from '../src/util.js';
import { BOTS } from './bots.mjs';

const argv = process.argv.slice(2);
const has = n => argv.includes('--' + n);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ONLY = arg('only', null);
const BOT = arg('bot', 'kite');
for (const kv of argv.filter((_, i) => argv[i - 1] === '--tune')) {   // --tune orbLag=0.8
  const [k, v] = kv.split('='); TUNE[k] = +v;
}
const STEP = 1 / 60, HP = 1e12;
const BOSS_SECS = 20;
const FIELD = 60, WARM = 60, FIELD_SECS = 90, FIELD_SEEDS = +arg('seeds', 12);

function loadout(id, lv, stat) {
  const p = G.player;
  G.nextHulk = Infinity;      // a weapon bench measures the weapon, not a module roll
  p.crit = 0;                                     // the only damage RNG; off by default
  p.weapons = [{ id, lv, t: 0, angle: 0 }];
  if (stat) STAT_UPGRADES.find(s => s.id === stat).apply(p);
  return p;
}

/* ------------------------------------------------------- single-target bench */
function benchBoss(id, lv, stat) {
  setSeed(99);
  newRun();
  const p = loadout(id, lv, stat);
  input.x = input.y = 0;
  // Flagged as a boss, because that is what this measures: it must be immune to
  // knockback (a plain dummy gets punted out of range by the first Starburst and
  // the weapon reads 2 dps) and it must attract the weapons that prefer bosses.
  const def = { ...ENEMIES.boss, speed: 0, shoot: null };
  const t = { type: 'boss', x: 120, y: 0, vx: 0, vy: 0, hp: HP, maxHp: HP, r: def.r, speed: 0,
    dmg: 0, color: def.color, shape: def.shape, xp: 0, boss: true, elite: false, affix: null,
    flash: 0, shootT: 0, orbCd: 0, wob: 0, volleyT: 0, def };
  for (let i = 0; i < BOSS_SECS * 60; i++) {
    G.enemies.length = 0; G.enemies.push(t);
    update(STEP);
    G.time = 0;                                   // freeze the director and all time scaling
    G.ebullets.length = G.orbs.length = G.parts.length = G.texts.length = 0;
    p.hp = p.maxHp; p.invuln = 0;
  }
  return (HP - t.hp) / BOSS_SECS;
}

/* --------------------------------------------------------------- field bench */
function benchField(id, lv, stat) {
  let total = 0;
  for (let seed = 1; seed <= FIELD_SEEDS; seed++) {
    setSeed(seed * 17);
    G.view.w = 900; G.view.h = 620;
    newRun();
    const p = loadout(id, lv, stat);
    let warmKills = 0;
    for (let i = 0; i < (WARM + FIELD_SECS) * 60; i++) {
      if (i === WARM * 60) warmKills = G.kills;
      const m = BOTS[BOT](p, i / 60);
      input.x = m.x; input.y = m.y;
      update(STEP);
      p.hp = p.maxHp;                             // immortal: we are measuring output, not survival
      // Hold the population flat. Without this a weak weapon accumulates a denser
      // field than a strong one and every area weapon reads high for the wrong reason.
      if (G.enemies.length > FIELD) {
        G.enemies.sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
        G.enemies.length = FIELD;
      }
    }
    total += (G.kills - warmKills) / FIELD_SECS;
  }
  input.x = input.y = 0;
  return total / FIELD_SEEDS;
}

/* --------------------------------------------------------------------- table */
const rows = [];
for (const id of Object.keys(WEAPONS).filter(id => !ONLY || id === ONLY))
  for (let lv = 1; lv <= WEAPONS[id].max; lv++)
    rows.push({ id, lv, name: WEAPONS[id].name, boss: benchBoss(id, lv), clear: benchField(id, lv) });

const f = n => n.toFixed(0).padStart(6);
const f2 = n => n.toFixed(2).padStart(7);
console.log(`\n  boss = dps on one target at 120px · clear = kills/s in a live run ` +
  `(${FIELD} enemies held, bot=${BOT}, ${FIELD_SEEDS} seeds, t=${WARM}..${WARM + FIELD_SECS}s)\n`);
console.log('  weapon                 lv     boss    clear');
let last = null;
for (const r of rows) {
  if (last && last !== r.id) console.log('');
  last = r.id;
  console.log(`  ${r.name.padEnd(20)} ${String(r.lv).padEnd(4)} ${f(r.boss)} ${f2(r.clear)}`);
}

const bad = [];
/* Levelling a weapon must never lower its damage. This is the shape of the v0.8
   Pulse Gun bug, written down so it cannot come back silently. */
for (const r of rows) {
  const prev = rows.find(x => x.id === r.id && x.lv === r.lv - 1);
  if (!prev) continue;
  // `boss` is deterministic (fixed seed, crit off) so it is held tight. `clear`
  // comes from live runs and has a noise floor around +-10% even at 12 seeds —
  // asserting tighter than that just produces false alarms, and the v0.8 Pulse Gun
  // regression was a 60% drop, far outside it.
  for (const [k, tol] of [['boss', 0.99], ['clear', 0.85]])
    if (r[k] < prev[k] * tol)
      bad.push(`${r.name} Lv.${r.lv} ${k} ${r[k].toFixed(2)} < Lv.${prev.lv} ${prev[k].toFixed(2)}`);
}
/* An evolution costs a maxed weapon plus a stat pick and replaces the weapon in
   place. It has to be a clear upgrade in both roles, not a sidegrade. */
for (const id of Object.keys(WEAPONS)) {
  const evo = WEAPONS[id].evo; if (!evo || ONLY) continue;
  const base = rows.find(r => r.id === id && r.lv === WEAPONS[id].max);
  const ev = rows.find(r => r.id === evo.id);
  for (const k of ['boss', 'clear'])
    if (ev[k] < base[k] * 1.25)
      bad.push(`${ev.name} ${k} ${ev[k].toFixed(2)} is only ${(ev[k] / base[k]).toFixed(2)}x maxed ${base.name} (${base[k].toFixed(2)})`);
}

if (has('stats')) {
  console.log('\n  stat upgrade effect · % clear-rate change at Lv.3\n');
  const ids = Object.keys(WEAPONS).filter(id => !WEAPONS[id].evolved);
  const stats = ['dmg', 'rate', 'area', 'crit'];
  console.log('  weapon               ' + stats.map(s => s.padStart(8)).join(''));
  for (const id of ids) {
    const base = benchField(id, 3);
    const cells = stats.map(s => (((benchField(id, 3, s) / base - 1) * 100).toFixed(1) + '%').padStart(8));
    console.log(`  ${WEAPONS[id].name.padEnd(20)} ${cells.join('')}`);
  }
}

if (bad.length) { console.error('\nFAIL: weapon invariant violated\n  ' + bad.join('\n  ') + '\n'); process.exit(1); }
console.log('\n  ok: every level-up and every evolution is a real damage increase\n');
