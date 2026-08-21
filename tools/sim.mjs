#!/usr/bin/env node
/**
 * Headless balance harness.
 *
 *   node tools/sim.mjs                       # default: 24 runs, kite bot, greedy picks
 *   node tools/sim.mjs --runs 60 --bot circle --picks random
 *   node tools/sim.mjs --diff nightmare      # recruit | veteran | nightmare
 *   node tools/sim.mjs --tune hulkFirst=99999   # what a run that skips every derelict looks like
 *   node tools/sim.mjs --view 420x780        # phone-shaped viewport
 *
 * Since v1.0 a run is a campaign that can be won, so the headline number is the
 * WIN RATE, not survival time. Survival time was only ever a proxy for difficulty
 * and it was a bad one: it could not tell "died at 300s on the way up" from
 * "died at 300s to the final boss", and those two want opposite fixes.
 *
 * The game logic has no DOM dependency and all randomness routes through
 * util.setSeed(), so a given seed replays exactly. Use this to check whether a
 * balance change actually moved the numbers instead of eyeballing the canvas.
 */
import { G, TUNE, update, newRun, applyCard, applyModule } from '../src/game.js';
import { ACTS, FINAL_AT } from '../src/content.js';
import { input } from '../src/input.js';
import { setSeed } from '../src/util.js';
import { BOTS } from './bots.mjs';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const RUNS = +arg('runs', 24);
const BOT = arg('bot', 'kite');
const PICKS = arg('picks', 'greedy');
const DIFF = arg('diff', 'veteran');
// --tune key=value, repeatable. Unlike --sweep this keeps the normal report and,
// crucially, the invariant checks and the win-rate gate: --sweep exits before them.
for (const kv of argv.filter((_, i) => argv[i - 1] === '--tune')) {
  const [k, v] = kv.split('=');
  if (!(k in TUNE)) { console.error(`FAIL: --tune ${k} is not a TUNE knob`); process.exit(1); }
  TUNE[k] = +v;
}
const CAP = +arg('cap', 900);              // hard stop; a run that hits this is a bug
const [VW, VH] = arg('view', '900x620').split('x').map(Number);
const STEP = 1 / 60;

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
    const p = G.player, owned = p.weapons.length, hurt = p.hp / p.maxHp < 0.4;
    const rank = c => (c.id === 'heal' && hurt ? 6 : c.kind === 'evo' ? 5 : c.kind === 'new' && owned < 4 ? 3
      : c.kind === 'up' ? 2 : c.kind === 'new' ? 1.5 : 1);
    return cards.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  },
};

/* -------------------------------------------------------------------- runs */
function runOne(seed) {
  setSeed(seed);
  G.view.w = VW; G.view.h = VH;
  newRun(DIFF);
  const move = BOTS[BOT], pickCard = PICKERS[PICKS];
  const maxSteps = CAP * 60;
  let peak = 0, visSum = 0, visN = 0;

  for (let i = 0; i < maxSteps; i++) {
    if (G.state === 'levelup') applyCard(pickCard(G.offer));
    // Salvage draws are taken in offer order: the modules are deliberately not
    // comparable on one axis, so ranking them would encode my opinion, not a
    // player's, and the win rate would measure my opinion.
    if (G.state === 'salvage') applyModule(G.offer[0]);
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
    time: G.time, kills: G.kills, level: G.player.level, won: G.state === 'won',
    salvaged: G.salvaged, hulksLost: G.hulksLost, modules: G.player.modules.slice(),
    act: G.act, finalHp: G.final ? Math.max(0, G.final.hp / G.final.maxHp) : 1,
    bossSpawned: G.bossSpawns, bossKilled: G.bossKills,
    weapons: G.player.weapons.map(w => `${w.id}${w.lv}`).join(' '),
    nan: ['x', 'y', 'hp', 'maxHp', 'damage', 'rate', 'speed', 'area', 'crit', 'range', 'pickup']
      .filter(k => !Number.isFinite(G.player[k])),
    visible: visSum / Math.max(1, visN), peak,
  };
}

const q = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const f1 = n => n.toFixed(1);

/* Parameter sweep: run the whole battery once per value of a TUNE knob so a
   balance decision can be made from the curve instead of one hand-picked number. */
const sweep = arg('sweep', null);
if (sweep) {
  const [key, ...vals] = sweep.split(',');
  console.log(`\n  sweep ${key} · ${RUNS} runs each · bot=${BOT} picks=${PICKS} cap=${CAP}s\n`);
  console.log('  value   win%    p25     median  p75     lvl  reached-final');
  for (const v of vals) {
    TUNE[key] = +v;
    const rs = [];
    for (let s = 1; s <= RUNS; s++) rs.push(runOne(s));
    const ts = rs.map(r => r.time), lv = rs.map(r => r.level);
    const w = rs.filter(r => r.won).length, fin = rs.filter(r => r.act >= ACTS.length - 1).length;
    console.log(`  ${String(v).padEnd(7)} ${(f1(w / RUNS * 100) + '%').padEnd(7)} ${f1(q(ts, .25)).padEnd(7)} ${f1(q(ts, .5)).padEnd(7)} ${f1(q(ts, .75)).padEnd(7)} ` +
      `${String(q(lv, .5)).padEnd(4)} ${fin}/${RUNS}`);
  }
  console.log('');
  process.exit(0);
}

const results = [];
for (let s = 1; s <= RUNS; s++) results.push(runOne(s));

const times = results.map(r => r.time);
const levels = results.map(r => r.level);
const wins = results.filter(r => r.won);
const reachedFinal = results.filter(r => r.act >= ACTS.length - 1);
const pct = n => f1(n / RUNS * 100) + '%';

console.log(`\n  sim: ${RUNS} runs · ${DIFF} · bot=${BOT} · picks=${PICKS} · view=${VW}x${VH}\n`);
console.log(`  WON        ${wins.length}/${RUNS}  (${pct(wins.length)})` +
  (wins.length ? `   clear ${f1(q(wins.map(r => r.time), .5))}s, of which ` +
    `${f1(q(wins.map(r => r.time - FINAL_AT), .5))}s was the Devourer` : ''));
console.log(`  reached    ${reachedFinal.length}/${RUNS} got to the Devourer at ${FINAL_AT}s`);
if (reachedFinal.length > wins.length) {
  const lost = reachedFinal.filter(r => !r.won);
  console.log(`             the ${lost.length} that lost there left it at ` +
    `${f1(q(lost.map(r => r.finalHp * 100), .5))}% hp (median)`);
}
console.log(`  died in    ` + ACTS.map((a, i) =>
  `${a.name.toLowerCase()} ${results.filter(r => !r.won && r.act === i).length}`).join(' · '));
console.log(`  survival   p25 ${f1(q(times, .25))}s   median ${f1(q(times, .5))}s   p75 ${f1(q(times, .75))}s`);
console.log(`  level      p25 ${q(levels, .25)}      median ${q(levels, .5)}      p75 ${q(levels, .75)}`);
console.log(`  kills      median ${q(results.map(r => r.kills), .5)}`);
console.log(`  salvage    ${f1(results.reduce((a, r) => a + r.salvaged, 0) / RUNS)} stripped per run, ` +
  `${f1(results.reduce((a, r) => a + r.hulksLost, 0) / RUNS)} drifted away`);
console.log(`  boss       spawned ${results.reduce((a, r) => a + r.bossSpawned, 0)}  killed ${results.reduce((a, r) => a + r.bossKilled, 0)}`);
console.log(`  on-screen  ${f1(results.reduce((a, r) => a + r.visible, 0) / RUNS)} enemies avg`);
console.log(`  perf       peak update ${f1(Math.max(...results.map(r => r.peak)))}ms\n`);

const mc = {};
for (const r of results) for (const m of r.modules) mc[m] = (mc[m] || 0) + 1;
if (Object.keys(mc).length)
  console.log('  modules taken: ' + Object.entries(mc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  ') + '\n');

// weapon popularity, to spot picks that never get taken
const wc = {};
for (const r of results) for (const w of r.weapons.split(' ')) {
  const id = w.replace(/\d+$/, ''); wc[id] = (wc[id] || 0) + 1;
}
console.log('  weapons taken: ' + Object.entries(wc).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${v}`).join('  ') + '\n');

/* Invariants. These need no judgement about whether a number "looks right", and
   they have caught more real bugs than the tuning figures above: double-counted
   kills (v0.3) and a miscounted boss wave (v0.5) both showed up here first. */
const bad = [];
for (const [i, r] of results.entries()) {
  const seed = i + 1;
  if (r.bossKilled > r.bossSpawned) bad.push(`seed ${seed}: killed ${r.bossKilled} bosses but only ${r.bossSpawned} spawned`);
  if (r.time < 0 || !Number.isFinite(r.time)) bad.push(`seed ${seed}: bogus run time ${r.time}`);
  if (r.level < 1) bad.push(`seed ${seed}: level ${r.level} below start`);
  if (r.kills < 0) bad.push(`seed ${seed}: negative kills ${r.kills}`);
  if (r.nan.length) bad.push(`seed ${seed}: player.${r.nan.join('/')} is not a finite number`);
  if (new Set(r.modules).size !== r.modules.length) bad.push(`seed ${seed}: took a salvage module twice (${r.modules})`);
  if (r.modules.length > r.salvaged) bad.push(`seed ${seed}: ${r.modules.length} modules from ${r.salvaged} derelicts`);
  if (r.won && r.time < FINAL_AT) bad.push(`seed ${seed}: won at ${f1(r.time)}s, before the Devourer spawns`);
  if (r.time >= CAP - 0.5) bad.push(`seed ${seed}: run never ended (${CAP}s hard stop) — the arc is not terminating`);
}
if (bad.length) {
  console.error('FAIL: invariant violated\n  ' + bad.slice(0, 5).join('\n  '));
  process.exit(1);
}

/* CI guard. A campaign has one number worth gating on: can a competent player
   clear it, and not every time. */
const wmin = +arg('assert-win-min', 0), wmax = +arg('assert-win-max', 0);
const wr = wins.length / RUNS * 100;
if (wmin && wr < wmin) { console.error(`FAIL: win rate ${f1(wr)}% < ${wmin}%`); process.exit(1); }
if (wmax && wr > wmax) { console.error(`FAIL: win rate ${f1(wr)}% > ${wmax}%`); process.exit(1); }
