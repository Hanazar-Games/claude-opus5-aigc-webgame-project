#!/usr/bin/env node
/**
 * Headless balance harness.
 *
 *   node tools/sim.mjs                       # default: 24 runs, kite bot, greedy picks
 *   node tools/sim.mjs --runs 60 --bot circle --picks random
 *   node tools/sim.mjs --view 420x780        # phone-shaped viewport
 *
 * The game logic has no DOM dependency and all randomness routes through
 * util.setSeed(), so a given seed replays exactly. Use this to check whether a
 * balance change actually moved the numbers instead of eyeballing the canvas.
 */
import { G, update, newRun, rollCards, applyCard } from '../src/game.js';
import { input } from '../src/input.js';
import { setSeed } from '../src/util.js';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const RUNS = +arg('runs', 24);
const BOT = arg('bot', 'kite');
const PICKS = arg('picks', 'greedy');
const CAP = +arg('cap', 600);              // seconds before we call it a win
const [VW, VH] = arg('view', '900x620').split('x').map(Number);
const STEP = 1 / 60;

/* ----------------------------------------------------------------- movement */
const BOTS = {
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

/* ------------------------------------------------------------------- picks */
const PICKERS = {
  random: cards => cards[(Math.random() * cards.length) | 0],
  // Funnel everything into the first weapon line to chase its evolution.
  focused(cards) {
    const rank = c => (c.kind === 'evo' ? 5 : c.kind === 'up' ? 4 : c.kind === 'stat' ? 2 : 1);
    return cards.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  },
  // Breadth first (weapons beat stats), then deepen. Mirrors how people build.
  greedy(cards) {
    const owned = G.player.weapons.length;
    const rank = c => (c.kind === 'evo' ? 5 : c.kind === 'new' && owned < 4 ? 3 : c.kind === 'up' ? 2 : c.kind === 'new' ? 1.5 : 1);
    return cards.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  },
};

/* -------------------------------------------------------------------- runs */
function runOne(seed) {
  setSeed(seed);
  G.view.w = VW; G.view.h = VH;
  newRun();
  const move = BOTS[BOT], pickCard = PICKERS[PICKS];
  const maxSteps = CAP * 60;
  let peak = 0, visSum = 0, visN = 0;

  for (let i = 0; i < maxSteps; i++) {
    if (G.state === 'levelup') applyCard(pickCard(rollCards()));
    if (G.state !== 'playing') break;
    const p = G.player, t = i / 60;
    const m = move(p, t);
    input.x = m.x; input.y = m.y;

    const t0 = performance.now();
    update(STEP);
    peak = Math.max(peak, performance.now() - t0);

    if (i % 30 === 0) {
      const c = G.cam, hw = VW / 2, hh = VH / 2;
      visSum += G.enemies.filter(e => Math.abs(e.x - c.x) < hw && Math.abs(e.y - c.y) < hh).length;
      visN++;
    }
  }
  input.x = input.y = 0;
  return {
    time: G.time, kills: G.kills, level: G.player.level,
    bossSpawned: G.bossCount, bossKilled: G.bossKills,
    weapons: G.player.weapons.map(w => `${w.id}${w.lv}`).join(' '),
    visible: visSum / Math.max(1, visN), peak,
  };
}

const q = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const f1 = n => n.toFixed(1);

const results = [];
for (let s = 1; s <= RUNS; s++) results.push(runOne(s));

const times = results.map(r => r.time);
const levels = results.map(r => r.level);
const survived = results.filter(r => r.time >= CAP - 0.5).length;

console.log(`\n  sim: ${RUNS} runs · bot=${BOT} · picks=${PICKS} · view=${VW}x${VH} · cap=${CAP}s\n`);
console.log(`  survival   p25 ${f1(q(times, .25))}s   median ${f1(q(times, .5))}s   p75 ${f1(q(times, .75))}s   max ${f1(Math.max(...times))}s`);
console.log(`  level      p25 ${q(levels, .25)}      median ${q(levels, .5)}      p75 ${q(levels, .75)}`);
console.log(`  kills      median ${q(results.map(r => r.kills), .5)}`);
console.log(`  boss       spawned ${results.reduce((a, r) => a + r.bossSpawned, 0)}  killed ${results.reduce((a, r) => a + r.bossKilled, 0)}`);
console.log(`  on-screen  ${f1(results.reduce((a, r) => a + r.visible, 0) / RUNS)} enemies avg`);
console.log(`  perf       peak update ${f1(Math.max(...results.map(r => r.peak)))}ms`);
console.log(`  reached cap ${survived}/${RUNS}\n`);

// weapon popularity, to spot picks that never get taken
const wc = {};
for (const r of results) for (const w of r.weapons.split(' ')) {
  const id = w.replace(/\d+$/, ''); wc[id] = (wc[id] || 0) + 1;
}
console.log('  weapons taken: ' + Object.entries(wc).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${v}`).join('  ') + '\n');

/* CI guard: a balance edit that tanks or trivialises the game should fail loudly. */
const min = +arg('assert-min', 0), max = +arg('assert-max', 0);
const med = q(times, .5);
if (min && med < min) { console.error(`FAIL: median survival ${f1(med)}s < ${min}s`); process.exit(1); }
if (max && med > max) { console.error(`FAIL: median survival ${f1(med)}s > ${max}s`); process.exit(1); }
