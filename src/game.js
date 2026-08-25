import { TAU, clamp, rand, random, pick, angleTo, weightedPick } from './util.js';
import { WEAPONS, ENEMIES, SPAWN_TABLE, BOSS_INTERVAL, STAT_UPGRADES, HEAL_CARD, FINAL_AT, ACTS, DIFFICULTIES, DERELICT, MODULES } from './content.js';
import { sfx } from './audio.js';
import { readMove } from './input.js';


const CELL = 64;

/** Knobs the balance sim can sweep (see `node tools/sim.mjs --sweep`). */
export const TUNE = { hpDouble: 120, orbLag: 1.0, spawnRamp: 3, xpCurve: 0.27, finalHp: 95000, orbHome: 7, rageRamp: 95, salvageHeat: 1.5, salvageChoke: 1.85,
  hulkFirst: 46, hulkEvery: 88,
  spawnBase: 3.2, spawnDelay: 60, gunLevels: 6, startHp: 170,
  eliteBase: 0.08, eliteRamp: 1400, dmgRamp: 200, contactMul: 1, enemyCap: 300, baseRegen: 5 };

export const G = {
  state: 'title',
  time: 0, kills: 0, dmgDealt: 0, bossCount: 0, bossSpawns: 0, bossKills: 0,
  diff: DIFFICULTIES[1], act: 0, final: null,
  nextHulk: 0, salvaged: 0, hulksLost: 0, eliteAcc: 0,
  player: null,
  enemies: [], bullets: [], ebullets: [], orbs: [], pickups: [], parts: [], texts: [], novas: [], hulks: [],
  cam: { x: 0, y: 0, shake: 0 },
  view: { w: 800, h: 600 },
  spawnAcc: 0, nextBoss: BOSS_INTERVAL,
  grid: new Map(),
  modal: [], offer: null,
  onLevelUp: null, onDeath: null, onWin: null, onAct: null, onSalvage: null,
};

/* ------------------------------------------------------------------- setup */
export function newRun(diffId = 'veteran') {
  G.diff = DIFFICULTIES.find(d => d.id === diffId) || DIFFICULTIES[1];
  G.act = 0; G.final = null;
  G.time = 0; G.kills = 0; G.dmgDealt = 0; G.bossCount = 0; G.bossSpawns = 0; G.bossKills = 0; G.spawnAcc = 0; G.nextBoss = BOSS_INTERVAL;
  G.enemies.length = G.bullets.length = G.ebullets.length = 0;
  G.orbs.length = G.pickups.length = G.parts.length = G.texts.length = G.novas.length = G.hulks.length = 0;
  G.nextHulk = TUNE.hulkFirst; G.salvaged = 0; G.hulksLost = 0; G.eliteAcc = 0;
  G.modal.length = 0; G.offer = null;
  G.cam.x = G.cam.y = 0; G.cam.shake = 0;
  G.player = {
    x: 0, y: 0, r: 13, hp: TUNE.startHp, maxHp: TUNE.startHp, speed: 178,
    damage: 1, rate: 1, armor: 1, pickup: 125, crit: 0.05, area: 1, xpMult: 1,
    // A horde game chips at you every second, so it has to give a little back every
    // second. Until v1.5 that came from elite drops — forty-nine heal pickups a
    // minute, which was an accident of the density rework, not a design. This is the
    // same sustain, made intentional, quiet and tunable.
    regen: TUNE.baseRegen,
    slots: 4, range: 1, pointDef: 0, pointDefT: 0, lifesteal: 0, reactive: 0,
    modules: [],
    level: 1, xp: 0, xpNext: 5, invuln: 0, dir: -Math.PI / 2, moving: 0, picks: {},
    weapons: [{ id: 'blaster', lv: 1, t: 0, angle: 0 }],
  };
  G.state = 'playing';
}

/* ------------------------------------------------------- spatial hash grid */
function buildGrid() {
  G.grid.clear();
  for (const e of G.enemies) {
    const k = ((e.x / CELL) | 0) + ',' + ((e.y / CELL) | 0);
    let a = G.grid.get(k); if (!a) G.grid.set(k, a = []);
    a.push(e);
  }
}
function queryGrid(x, y, r, out) {
  out.length = 0;
  const x0 = ((x - r) / CELL) | 0, x1 = ((x + r) / CELL) | 0;
  const y0 = ((y - r) / CELL) | 0, y1 = ((y + r) / CELL) | 0;
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = G.grid.get(cx + ',' + cy);
    if (a) for (const e of a) out.push(e);
  }
  return out;
}
const _q = [];

/* --------------------------------------------------------------- API hooks */
/**
 * Target acquisition. `prefer` makes a weapon lock onto a boss in range instead
 * of the nearest body — without it, single-target weapons spend the whole boss
 * fight chewing on the chaff swarming between the player and the boss, and the
 * boss can never be killed.
 */
G.nearestEnemy = (from, maxD = 900, idx = 0, prefer = false) => {
  const md2 = (maxD * G.player.range) ** 2;
  if (prefer) {
    let bb = null, bbd = Infinity;
    for (const e of G.enemies) {
      if (!e.boss) continue;
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d <= md2 && d < bbd) { bbd = d; bb = e; }
    }
    if (bb) return bb;
  }
  if (idx === 0) {
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d <= md2 && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // Nth-nearest via top-K selection. Collecting every candidate and sorting cost
  // ~18ms/frame once volleys of 6 missiles each did it against 380 enemies.
  const k = idx + 1;
  const bE = _topE, bD = _topD;
  let n = 0;
  for (const e of G.enemies) {
    const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
    if (d > md2) continue;
    if (n < k) {                        // insertion into a tiny sorted buffer
      let i = n++;
      while (i > 0 && bD[i - 1] > d) { bD[i] = bD[i - 1]; bE[i] = bE[i - 1]; i--; }
      bD[i] = d; bE[i] = e;
    } else if (d < bD[k - 1]) {
      let i = k - 1;
      while (i > 0 && bD[i - 1] > d) { bD[i] = bD[i - 1]; bE[i] = bE[i - 1]; i--; }
      bD[i] = d; bE[i] = e;
    }
  }
  return n ? bE[Math.min(idx, n - 1)] : null;
};
const _topE = [], _topD = [];

G.spawnBullet = o => {
  G.bullets.push({
    x: G.player.x, y: G.player.y,
    vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed,
    a: o.a, r: o.r, dmg: o.dmg * G.player.damage, life: o.life,
    pierce: o.pierce || 0, color: o.color, homing: o.homing || 0,
    blast: o.blast || 0, beam: !!o.beam, trail: !!o.trail, knock: o.knock || 0, hit: null,
  });
};

G.novaBlast = (x, y, radius, dmg, knock) => {
  const r = radius * G.player.area;
  G.novas.push({ x, y, r, t: 0, dur: 0.42 });
  G.cam.shake = Math.max(G.cam.shake, 7);
  sfx.nova();
  for (const e of queryGrid(x, y, r + 40, _q)) {
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > r + e.r) continue;
    damageEnemy(e, dmg * G.player.damage);
    if (knock && !e.boss) { e.vx += dx / (d || 1) * knock; e.vy += dy / (d || 1) * knock; }
  }
};

/* ------------------------------------------------------------------ combat */
function damageEnemy(e, dmg, canCrit = true) {
  if (e.dead) return;   // multi-hit frames (prism beams, nova) would kill it twice
  let d = dmg, crit = false;
  if (canCrit && random() < G.player.crit) { d *= 2; crit = true; }
  G.dmgDealt += Math.min(d, e.hp);   // effective, not overkill
  e.hp -= d; e.flash = 0.1;
  if (crit) G.texts.push({ x: e.x, y: e.y - e.r, t: 0, v: Math.round(d), color: '#ffc44d' });
  if (e.hp <= 0) killEnemy(e);
  else if (random() < 0.35) sfx.hit();
}

function killEnemy(e) {
  e.dead = true;
  G.kills++;
  if (G.player.lifesteal) G.player.hp = Math.min(G.player.maxHp, G.player.hp + G.player.lifesteal);
  burst(e.x, e.y, e.color, e.boss ? 40 : e.elite ? 20 : 8, e.boss ? 260 : 150);
  const n = e.boss ? 14 : e.elite ? 5 : 1;
  for (let i = 0; i < n; i++)
    G.orbs.push({ x: e.x + rand(20, -20), y: e.y + rand(20, -20), vx: rand(60, -60), vy: rand(60, -60), xp: e.xp / n, r: e.elite || e.boss ? 7 : 5 });
  if (e.def.final) {
    G.cam.shake = 34; sfx.boss();
    burst(e.x, e.y, e.color, 90, 420);
    G.state = 'won';
    G.onWin?.();
    return;
  }
  if (e.boss) {
    G.bossKills++; G.cam.shake = 18; sfx.boss();
    dropPickup(e.x, e.y, 'heal'); dropPickup(e.x + 40, e.y, 'bomb');
    G.texts.push({ x: e.x, y: e.y - 40, t: 0, v: 'MOTHERSHIP DOWN', color: '#5cff9d', big: true, life: 2 });
  } else {
    sfx.kill();
    if (e.elite) {
      dropPickup(e.x, e.y, weightedPick(DROPS).kind);
      if (e.affix === 'splitter')
        for (let i = 0; i < 4; i++) {
          const a = i * TAU / 4 + rand(0.6);
          spawnEnemy(e.type, { x: e.x + Math.cos(a) * 34, y: e.y + Math.sin(a) * 34 }, true);
        }
    }
  }
}

const DROPS = [{ kind: 'heal', weight: 5 }, { kind: 'magnet', weight: 3 }, { kind: 'bomb', weight: 3 }];

function dropPickup(x, y, kind) {
  G.pickups.push({ x, y, kind, r: 11, t: 0 });
}

function collectPickup(pk) {
  const p = G.player;
  pk.got = true;
  sfx[pk.kind === 'heal' ? 'heal' : pk.kind === 'magnet' ? 'magnet' : 'strike']();
  if (pk.kind === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
    G.texts.push({ x: p.x, y: p.y - 30, t: 0, v: '+HP', color: '#5cff9d' });
  } else if (pk.kind === 'magnet') {
    for (const o of G.orbs) o.age = 99;               // every orb homes in
    G.texts.push({ x: p.x, y: p.y - 30, t: 0, v: 'MAGNET', color: '#4df3ff' });
  } else {
    G.novaBlast(p.x, p.y, 620, 90 + p.level * 22, 340);
    G.cam.shake = 22;
    G.texts.push({ x: p.x, y: p.y - 30, t: 0, v: 'ORBITAL STRIKE', color: '#ffc44d' });
  }
}

function hurtPlayer(dmg) {
  const p = G.player;
  if (p.invuln > 0) return;
  p.hp -= dmg * p.armor;
  p.invuln = 0.7;
  G.cam.shake = Math.max(G.cam.shake, 9);
  sfx.hurt();
  if (p.reactive) G.novaBlast(p.x, p.y, 150 + p.reactive * 40, 45 + scaleT() * 0.9, 300);
  if (p.hp <= 0) {
    p.hp = 0; G.state = 'dead'; sfx.dead();
    burst(p.x, p.y, '#4df3ff', 50, 300);
    G.onDeath?.();
  }
}

function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), s = rand(spd, spd * 0.2);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 0.25), max: 0.6, color, r: rand(3.4, 1.2) });
  }
}

/**
 * The difficulty clock, and the ONLY thing allowed to scale enemy numbers with
 * time. It stops at FINAL_AT because the last fight is a designed encounter whose
 * escalation is the Devourer's own rage — but until v1.2 only enemy health and
 * contact damage honoured the freeze. Every ranged attack in the game still read
 * the raw clock, so stalling the boss did make the chaff unsurvivable on its own,
 * which is exactly what the freeze was written to prevent.
 */
const scaleT = () => Math.min(G.time, FINAL_AT);

/* ------------------------------------------------------------------ spawns */
/** Enemies arrive just past the corner of the screen, wherever that is. */
const REF_RING = Math.hypot(900, 620) * 0.5 + 110;
// Floored, so a viewport the page failed to measure degrades into a small screen
// instead of a ring that spawns enemies inside the player's own reaction time.
const spawnRing = () => Math.max(420, Math.hypot(G.view.w, G.view.h) * 0.5 + 110);

function spawnPoint() {
  const a = rand(TAU);
  // A live beacon calls reinforcements in close and drops them around the wreck,
  // not around you. That is the whole price of standing still: they arrive sooner
  // and they arrive already between you and the way out.
  const h = G.hulks.find(x => x.active);
  if (h) return { x: h.x + Math.cos(a) * spawnRing() * 0.6, y: h.y + Math.sin(a) * spawnRing() * 0.6 };
  const d = spawnRing();
  return { x: G.player.x + Math.cos(a) * d, y: G.player.y + Math.sin(a) * d };
}

function spawnEnemy(type, at, forceNormal = false, forceElite = false) {
  const def = ENEMIES[type];
  // Time-based scaling stops at FINAL_AT. The last fight is a designed encounter
  // with its own escalation (the Devourer's rage), not one more tick of the curve;
  // without the freeze, stalling it would make the chaff unsurvivable on its own.
  const t = scaleT();
  // Player DPS compounds (damage% x rate% x crit x weapon levels x evolution),
  // so it grows roughly exponentially with pick count. Additive enemy HP could
  // never keep up, which is why strong builds ran away. Match the shape: HP
  // doubles every TUNE.hpDouble seconds.
  // The Devourer's health is set outright rather than read off the time curve:
  // it is the length of one designed fight, and it should not move every time the
  // chaff curve is retuned.
  // The Devourer takes only part of the tier's health multiplier. A harder tier
  // already means you arrive at it with a weaker build and less time on the clock;
  // charging the full multiplier on top made Nightmare 0 for 12 at the wall.
  const hpMult = def.final ? 1 + (G.diff.hp - 1) * 0.7
    : (Math.pow(2, t / TUNE.hpDouble) + (def.boss ? (G.bossCount - 1) * 0.75 : 0)) * G.diff.hp;
  // Contact damage is scaled separately from ranged. In a horde game the player is
  // touching something almost every frame the invulnerability window allows, so
  // chaff has to be nearly harmless on contact — the threat is being surrounded and
  // unable to move, plus the things that shoot.
  const dmgMult = (1 + t / TUNE.dmgRamp) * G.diff.dmg * (def.boss ? 1 : TUNE.contactMul);
  const p = at || spawnPoint();
  // Elites are a power-spike delivery system, so their cadence is per SECOND and
  // lives in the director — NOT a percentage of each spawn. That percentage was
  // written when the chaff rate was a tenth of what v1.4 made it, and it turned
  // "rare" into thirty screen-clearing Orbital Strikes and forty-nine heals a
  // minute. An item that arrives every two seconds is not a power spike.
  const elite = forceElite && !forceNormal && !def.boss;
  const hp = (def.final ? TUNE.finalHp : def.hp) * hpMult * (elite ? 4 : 1);
  G.enemies.push({
    type, x: p.x, y: p.y, vx: 0, vy: 0, hp, maxHp: hp,
    r: def.r * (elite ? 1.5 : 1),
    speed: def.speed * (1 + t / 600) * (def.boss ? 1 : rand(1.1, 0.9)) * (elite ? 0.72 : 1),
    dmg: def.dmg * dmgMult * (elite ? 1.3 : 1),
    color: def.color, shape: def.shape, xp: def.xp * (elite ? 8 : 1) * (1 + t / 150),
    boss: !!def.boss, elite, affix: elite && t > 100 ? pick(AFFIXES) : null,
    flash: 0, shootT: rand(2), orbCd: 0, wob: rand(TAU), volleyT: rand(2), def,
  });
}

/**
 * Elite modifiers. Each one attacks a different assumption an evolved build makes:
 * splitter punishes clearing your radius, volley ignores it entirely (bullets
 * can't be shot down), haste closes the gap kiting relies on.
 */
const AFFIXES = ['splitter', 'volley', 'haste'];

function director(dt) {
  const t = G.time;

  while (G.act < ACTS.length - 1 && t >= ACTS[G.act + 1].t) {
    G.act++;
    G.onAct?.(ACTS[G.act]);          // the banner is DOM; a canvas copy just doubled it
  }

  if (t >= FINAL_AT && !G.final) {
    spawnEnemy('devourer', { x: G.player.x, y: G.player.y - 460 });
    G.final = G.enemies[G.enemies.length - 1];
    G.final.rage = 0; G.final.spiral = 0; G.final.burst = 0; G.final.summon = 6; G.final.phase = 1;
    G.cam.shake = 26; sfx.devourer();
    return;                                   // no chaff wave on the frame it lands
  }
  if (!G.final && t >= G.nextBoss) {
    G.bossCount++;
    // Motherships are the only threat that scales with kill count, so tighten
    // their cadence over a run — this is what ends otherwise-unbounded games.
    G.nextBoss += Math.max(42, BOSS_INTERVAL - G.bossCount * 9);
    // Deep runs get escorts; a single boss stops mattering to an evolved build.
    const wave = G.bossCount >= 4 ? 2 : 1;
    for (let i = 0; i < wave; i++) { spawnEnemy('boss'); G.bossSpawns++; }
    G.texts.push({ x: G.player.x, y: G.player.y - 70, t: 0, v: 'MOTHERSHIP INBOUND', color: '#ff4d5e', big: true, life: 2.4 });
    sfx.boss();
  }
  const bossFight = G.enemies.some(e => e.boss);
  // Chaff eases off during any boss, and hard during the final fight — that one is
  // about the Devourer, not about the crowd you happen to be standing in.
  // Standing population is spawn rate x flight time, and flight time is the spawn
  // ring, which is the screen. Left alone that made the same difficulty tier a
  // different game per window: 77 enemies alive on a 900x620 desktop against 47 on
  // a 420x780 phone, and a 31% win rate against 59%. Cancel the screen out.
  // The density ramp starts AFTER spawnDelay. The first minute is when the gun is
  // still growing from one bolt to a spread, and a field that saturates before then
  // just kills you while you are learning what the weapon does.
  const rate = (TUNE.spawnBase + Math.max(0, Math.min(t, FINAL_AT) - TUNE.spawnDelay) / TUNE.spawnRamp)
    * (G.final ? 0.22 : bossFight ? 0.5 : 1) * G.diff.spawn * (REF_RING / spawnRing())
    * (salvaging() ? TUNE.salvageHeat : 1);
  G.spawnAcc += dt * rate;
  const table = SPAWN_TABLE.filter(r => t >= r[0]).map(r => ({ type: r[1], weight: r[2] }));
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length >= TUNE.enemyCap) break;
    spawnEnemy(weightedPick(table).type);
  }
  // Elites on their own clock, independent of how thick the chaff is.
  if (t > 45 && !G.final) {
    G.eliteAcc += dt * (TUNE.eliteBase + t / TUNE.eliteRamp) * G.diff.spawn;
    while (G.eliteAcc >= 1) {
      G.eliteAcc--;
      if (G.enemies.length >= TUNE.enemyCap) break;
      spawnEnemy(weightedPick(table).type, null, false, true);
    }
  }

  // occasional tight cluster for pressure
  if (t > 55 && random() < dt * 0.12 && G.enemies.length < TUNE.enemyCap - 20) {
    const c = spawnPoint(), type = weightedPick(table).type;
    for (let i = 0; i < 10; i++) spawnEnemy(type, { x: c.x + rand(70, -70), y: c.y + rand(70, -70) });
  }
}

/* ------------------------------------------------------------------ update */
export function update(dt) {
  const p = G.player;
  G.time += dt;
  buildGrid();
  director(dt);
  updateHulks(dt);

  /* player movement */
  const mv = readMove();
  const len = Math.hypot(mv.x, mv.y);
  if (len > 0.02) {
    p.x += mv.x * p.speed * dt; p.y += mv.y * p.speed * dt;
    p.dir = Math.atan2(mv.y, mv.x); p.moving = Math.min(1, p.moving + dt * 6);
  } else p.moving = Math.max(0, p.moving - dt * 8);
  p.invuln = Math.max(0, p.invuln - dt);
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  /**
   * Weapons. `choke` is the real price of a derelict: stripping one diverts the
   * reactor, so you fire slower for exactly the seconds the field is closing on
   * you. It had to be this rather than "more enemies" — the first version of the
   * beacon spawned reinforcements and the win rate went UP, because in a game
   * where a built player out-clears the spawn rate, extra enemies are extra XP.
   * A cost the player can convert into progress is not a cost.
   */
  const choke = G.hulks.some(h => h.active) ? TUNE.salvageChoke : 1;
  for (const w of p.weapons) {
    const def = WEAPONS[w.id], s = def.stats(w.lv);
    if (def.orbital) { w.angle = (w.angle + s.spin * dt / choke) % TAU; continue; }
    w.t += dt;
    const cd = Math.max(0.06, s.cd * p.rate * choke);
    if (w.t >= cd) { w.t = 0; def.fire(G, s); if (!def.ownSfx && w.id !== 'nova') sfx.shoot(); }
  }
  updateOrbitals(dt, choke);

  /* enemies */
  const cull = (spawnRing() + 380) ** 2;
  // Two rules at once: never be shot from off screen, and never let a bigger
  // monitor mean more incoming fire. The viewport term is the fairness half; the
  // absolute cap is the difficulty half, and it binds on anything above ~1000px.
  const shootRange = Math.min(Math.max(G.view.w, G.view.h) * 0.52, 520) ** 2;
  for (const e of G.enemies) {
    const a = angleTo(e, p);
    let ax = Math.cos(a), ay = Math.sin(a);
    if (e.def.orbitStrafe) { const s = Math.sin(G.time * 1.6 + e.wob) * 0.9; const c = Math.cos(a + Math.PI / 2), sn = Math.sin(a + Math.PI / 2); ax += c * s; ay += sn * s; }
    const l = Math.hypot(ax, ay) || 1;
    e.vx += (ax / l * e.speed - e.vx) * Math.min(1, dt * 6);
    e.vy += (ay / l * e.speed - e.vy) * Math.min(1, dt * 6);
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.flash = Math.max(0, e.flash - dt);
    e.orbCd = Math.max(0, e.orbCd - dt);

    if (e.affix === 'haste') e.speed = Math.min(e.speed * (1 + dt * 0.11), 300);
    if (e.affix === 'volley') {
      e.volleyT += dt;
      if (e.volleyT >= 2.4) {
        e.volleyT = 0;
        const base = angleTo(e, p);
        for (let i = 0; i < 8; i++) {
          const ang = base + i * TAU / 8;
          G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200,
            r: 6, dmg: 12 * G.diff.dmg * (1 + scaleT() / TUNE.dmgRamp), life: 4.5, color: '#ff4d5e' });
        }
      }
    }

    if (e.def.final) updateDevourer(e, dt);

    // Shooters only fire from on screen. Enemy bullet volume scales linearly with
    // enemy count, and v1.4 multiplied enemy count by ten: measured, 94% of all
    // damage the player took was bullets, most of them launched from somewhere the
    // player could not see. A shot you cannot see coming is not difficulty.
    if (e.def.shoot && (e.boss || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < shootRange)) {
      e.shootT += dt;
      if (e.shootT >= e.def.shoot.cd) {
        e.shootT = 0;
        const sh = e.def.shoot, base = angleTo(e, p);
        for (let i = 0; i < sh.count; i++) {
          const ang = sh.count > 1 ? base + i * TAU / sh.count : base;
          G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sh.speed, vy: Math.sin(ang) * sh.speed, r: 6, dmg: sh.dmg * G.diff.dmg * (1 + scaleT() / 260), life: 5, color: e.color });
        }
      }
    }

    // contact damage
    const rr = e.r + p.r;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr && p.invuln <= 0) {
      hurtPlayer(e.dmg);
      if (!e.boss) { e.vx = Math.cos(a) * -260; e.vy = Math.sin(a) * -260; }  // bounce off, no instant re-hit
    }

    // Recycle far strays. This radius MUST be derived from the spawn ring, not a
    // constant: with the old flat 1000px, any window with a diagonal over ~1780px
    // spawned enemies already outside it, and every one of them was teleported back
    // to the ring every frame. On a maximised 1080p browser the game was unplayable
    // — zero kills, zero level-ups — from v0.1 until this was measured, because
    // every sim run and every screenshot had been taken at 900x620 or smaller.
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > cull && !e.boss) {
      const np = spawnPoint(); e.x = np.x; e.y = np.y;
    }
  }
  separate(dt);

  /* player bullets */
  for (const b of G.bullets) {
    b.life -= dt;
    if (b.homing) {
      const t = G.nearestEnemy(b, 420);
      if (t) {
        const want = angleTo(b, t), cur = Math.atan2(b.vy, b.vx);
        let d = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
        const na = cur + clamp(d, -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; b.a = na;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    for (const e of queryGrid(b.x, b.y, b.r + 24, _q)) {
      if (e.dead) continue;
      const rr = e.r + b.r;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) continue;
      if (b.hit && b.hit.has(e)) continue;
      damageEnemy(e, b.dmg);
      if (b.knock && !e.boss) {
        const d = Math.hypot(b.vx, b.vy) || 1;
        e.vx += b.vx / d * b.knock; e.vy += b.vy / d * b.knock;
      }
      if (b.blast) { G.novaBlast(b.x, b.y, b.blast, b.dmg * 0.6, 90); b.life = 0; break; }
      if (b.pierce > 0) { b.pierce--; (b.hit ||= new Set()).add(e); }
      else { b.life = 0; break; }
    }
    if (b.life <= 0 && b.blast) burst(b.x, b.y, b.color, 6, 120);
  }

  /* point defense — the late game is bullets, and this is the only answer to them */
  if (p.pointDef) {
    p.pointDefT -= dt;
    if (p.pointDefT <= 0) {
      p.pointDefT = 1.7;
      const r2 = p.pointDef * p.pointDef;
      let burned = 0;
      for (const b of G.ebullets)
        if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < r2) { b.life = 0; burned++; }
      G.novas.push({ x: p.x, y: p.y, r: p.pointDef, t: 0, dur: 0.3, calm: true });
      if (burned) sfx.pdef();
    }
  }

  /* enemy bullets */
  for (const b of G.ebullets) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    const rr = b.r + p.r;
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) { hurtPlayer(b.dmg); b.life = 0; }
  }

  /* xp orbs */
  const pr = p.pickup;
  for (const o of G.orbs) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
    o.age = (o.age || 0) + dt;
    // Inside the magnet radius (or once a straggler ages out) orbs are *driven*,
    // not nudged — a force-based pull stalls at the radius edge and never lands.
    if (d < pr || o.age > TUNE.orbHome) {
      const sp = d < pr ? 300 + (1 - d / pr) * 800 : 300;
      o.vx = dx / d * sp; o.vy = dy / d * sp;
    } else { o.vx *= 0.93; o.vy *= 0.93; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (d < 24) { o.got = true; gainXp(o.xp * p.xpMult); }
  }

  /* pickups */
  for (const pk of G.pickups) {
    pk.t += dt;
    const dx = p.x - pk.x, dy = p.y - pk.y, d = Math.hypot(dx, dy) || 1;
    if (d < pr) { const sp = 240 + (1 - d / pr) * 500; pk.x += dx / d * sp * dt; pk.y += dy / d * sp * dt; }
    if (d < 28) collectPickup(pk);
  }

  /* fx */
  for (const q of G.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.93; q.vy *= 0.93; }
  for (const n of G.novas) n.t += dt;
  for (const t of G.texts) { t.t += dt; t.y -= dt * 34; }

  prune();

  /* camera */
  const lead = 40;
  G.cam.x += (p.x + Math.cos(p.dir) * lead * p.moving - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (p.y + Math.sin(p.dir) * lead * p.moving - G.cam.y) * Math.min(1, dt * 5);
  G.cam.shake = Math.max(0, G.cam.shake - dt * 26);
}

/**
 * Orbitals hit whatever is inside their ring, so their whole output depends on
 * where the crowd is relative to you — and a player who kites keeps the crowd
 * exactly outside it. Measured with tools/bench.mjs, Orbit Blades Lv.4 cleared
 * 0.57 kills/s for the kiting bot and 3.08 for the one that ploughs straight in:
 * a 5x swing on playstyle alone, with nothing in the game to tell you that.
 * So the ring trails behind you while you move, sweeping the wake you are
 * dragging the crowd through instead of the empty space ahead of you.
 */
function updateOrbitals(dt, choke = 1) {
  const p = G.player;
  for (const w of p.weapons) {
    const def = WEAPONS[w.id]; if (!def.orbital) continue;
    const s = def.stats(w.lv), R = s.radius * p.area;
    const lag = R * TUNE.orbLag * p.moving;   // 1.0 keeps the ring's leading edge on the player
    w.cx = p.x - Math.cos(p.dir) * lag; w.cy = p.y - Math.sin(p.dir) * lag;
    for (let i = 0; i < s.count; i++) {
      const a = w.angle + i * TAU / s.count;
      const bx = w.cx + Math.cos(a) * R, by = w.cy + Math.sin(a) * R;
      for (const e of queryGrid(bx, by, s.r + 26, _q)) {
        if (e.dead || e.orbCd > 0) continue;
        const rr = e.r + s.r;
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 > rr * rr) continue;
        damageEnemy(e, s.dmg * p.damage);
        e.orbCd = s.hitCd * p.rate * choke;
      }
    }
  }
}

/* --------------------------------------------------------------- derelicts */
function spawnHulk() {
  const a = rand(TAU), d = spawnRing() * 0.8;
  G.hulks.push({
    x: G.player.x + Math.cos(a) * d, y: G.player.y + Math.sin(a) * d,
    vx: rand(14, -14), vy: rand(14, -14),
    r: 30, t: 0, p: 0, active: false, spin: rand(TAU),
  });
  G.texts.push({ x: G.player.x, y: G.player.y - 60, t: 0, v: 'DERELICT DETECTED', color: '#ffc44d', life: 1.8 });
  sfx.hulk();
}

/**
 * A hulk is only worth anything if you stand in it, and standing still is the one
 * thing this game has always punished. So the price is explicit: while you are
 * stripping one, its beacon drags the whole field onto your position and the
 * director spawns harder. Step out and progress bleeds back, but slower than it
 * built — a dodge should cost you, not erase you.
 */
function updateHulks(dt) {
  const p = G.player;
  if (!G.final && G.time >= G.nextHulk) { G.nextHulk = G.time + TUNE.hulkEvery; spawnHulk(); }

  for (const h of G.hulks) {
    h.t += dt;
    h.x += h.vx * dt; h.y += h.vy * dt;
    h.spin += dt * 0.35;
    const inside = Math.hypot(p.x - h.x, p.y - h.y) < DERELICT.radius;
    h.active = inside;
    h.p = clamp(h.p + (inside ? dt / DERELICT.secs : -dt * DERELICT.decay / DERELICT.secs), 0, 1);

    if (inside) {
      for (const e of G.enemies) {
        if (e.boss) continue;
        const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
        e.x += dx / d * DERELICT.pull * dt; e.y += dy / d * DERELICT.pull * dt;
      }
    }
    if (h.p >= 1) {
      h.done = true; G.salvaged++;
      burst(h.x, h.y, '#ffc44d', 34, 240);
      G.cam.shake = Math.max(G.cam.shake, 12);
      const empty = G.player.modules.length >= MODULES.length;
      G.texts.push({ x: h.x, y: h.y - 40, t: 0, v: empty ? 'PICKED CLEAN' : 'SALVAGED',
        color: '#ffc44d', big: true, life: 1.8 });
      if (!empty) queueModal('salvage');
    } else if (h.t > DERELICT.life) {
      h.done = true; G.hulksLost++;
      G.texts.push({ x: h.x, y: h.y, t: 0, v: 'LOST', color: '#8a97b8', life: 1.2 });
      sfx.hulkLost();
    }
  }
  if (G.hulks.some(h => h.done)) G.hulks = G.hulks.filter(h => !h.done);
}

/** True while the player is actually stripping a hulk — the director reads this. */
const salvaging = () => G.hulks.some(h => h.active);

export function rollModules() {
  const have = new Set(G.player.modules);
  const pool = MODULES.filter(m => !have.has(m.id));
  const out = [];
  while (out.length < DERELICT.draw && pool.length) out.push(...pool.splice((random() * pool.length) | 0, 1));
  return out;
}

export function applyModule(m) {
  m.apply(G.player);
  G.player.modules.push(m.id);
  G.state = 'playing';
  flushModal();
}

/**
 * The Devourer. Three things make this a fight instead of a fat Mothership:
 * a spiral that forces you to keep moving rather than orbit, escorts from 66%
 * that punish a build with no crowd clear, and a rage that grows with the fight
 * clock — the last one is why the run is guaranteed to end. Stalling is not a
 * strategy, it is just a slower loss.
 */
function updateDevourer(e, dt) {
  const p = G.player;
  const k = e.hp / e.maxHp;
  // Rage does NOT cap. It used to stop at 1.0, and a build that could survive the
  // Devourer without out-damaging it simply stalled: the sim's "no run may reach
  // the hard stop" invariant caught runs still going at 900s. Past the first ramp
  // it goes into overdrive, which is what actually guarantees the arc terminates.
  // The first `rageRamp` seconds are unchanged, so the tuned fight is untouched.
  e.rage = (G.time - FINAL_AT) / TUNE.rageRamp;
  const r = Math.min(1, e.rage), over = Math.max(0, e.rage - 1);
  const phase = k < 0.33 ? 3 : k < 0.66 ? 2 : 1;
  if (phase !== e.phase) {           // the fight has three acts of its own; say so
    e.phase = phase;
    G.cam.shake = Math.max(G.cam.shake, 16);
    sfx.phase();
    G.texts.push({ x: e.x, y: e.y - e.r - 26, t: 0, v: `PHASE ${phase}`, color: '#ff2f6d', big: true, life: 1.6 });
  }
  e.speed = e.def.speed * (1 + r * 0.9 + over * 0.85 + (e.phase - 1) * 0.16);
  e.dmg = e.def.dmg * G.diff.dmg * (1 + scaleT() / TUNE.dmgRamp) * (1 + over * 1.3);

  const arms = 2 + e.phase;
  e.spiral += dt * (1.5 + e.rage * 0.7);
  e.burst -= dt;
  if (e.burst <= 0) {
    e.burst = Math.max(0.11, 0.3 - r * 0.1 - over * 0.05 - (e.phase - 1) * 0.03);
    for (let i = 0; i < arms; i++) {
      const a = e.spiral + i * TAU / arms;
      G.ebullets.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r,
        vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, r: 7,
        dmg: 15 * G.diff.dmg * (1 + r * 0.8 + over * 1.1), life: 6, color: '#ff2f6d' });
    }
  }

  e.summon -= dt;
  if (e.phase >= 2 && e.summon <= 0) {
    e.summon = 10 - e.phase * 1.5;
    for (let i = 0; i < 3 + e.phase; i++) {
      const a = rand(TAU), d = 150 + rand(90);
      spawnEnemy(e.phase >= 3 ? 'weaver' : 'spitter', { x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d }, true);
    }
    G.texts.push({ x: e.x, y: e.y - e.r - 20, t: 0, v: 'SPAWNING', color: '#ff2f6d', life: 1.2 });
  }

  // A slow inward pull, so backing off forever is not free either.
  const a = angleTo(p, e), pull = 26 * Math.min(e.rage, 5) * dt;
  p.x += Math.cos(a) * pull; p.y += Math.sin(a) * pull;
}

/** Keep enemies from stacking into a single point. */
function separate(dt) {
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    for (const o of queryGrid(e.x, e.y, e.r + 22, _q)) {
      if (o === e) continue;
      const dx = o.x - e.x, dy = o.y - e.y;
      const md = e.r + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > md * md || d2 < 0.0001) continue;
      const d = Math.sqrt(d2), push = (md - d) * 0.5 * Math.min(1, dt * 22);
      const nx = dx / d * push, ny = dy / d * push;
      if (!e.boss) { e.x -= nx; e.y -= ny; }
      if (!o.boss) { o.x += nx; o.y += ny; }
    }
  }
}

function prune() {
  G.enemies = G.enemies.filter(e => !e.dead);
  G.bullets = G.bullets.filter(b => b.life > 0);
  G.ebullets = G.ebullets.filter(b => b.life > 0);
  G.orbs = G.orbs.filter(o => !o.got);
  G.pickups = G.pickups.filter(pk => !pk.got);
  G.parts = G.parts.filter(q => q.life > 0);
  G.novas = G.novas.filter(n => n.t < n.dur);
  G.texts = G.texts.filter(t => t.t < (t.life || 0.9));
}

/* ------------------------------------------------------------------ modals */
/**
 * Level-ups and salvage draws are both modal, and both can be raised inside the
 * same `update()`. Raising one directly used to overwrite whichever was already
 * on screen and the unanswered offer was gone for good — collect the last orb of
 * a boss drop as a hulk finishes and the module choice simply never happened.
 * They queue instead, and the contents are rolled at the moment one is shown so
 * a pick made in the first offer is reflected in the second.
 */
function queueModal(kind) {
  G.modal.push(kind);
  flushModal();
}

function flushModal() {
  if (G.state !== 'playing' || !G.modal.length) return;
  const kind = G.modal.shift();
  // The offer is published on G so a headless driver answers the SAME three cards
  // the player would see. Calling rollCards() again to decide consumes more of the
  // seeded stream and silently forks the run: the sim was not testing the offers
  // the game actually makes, and a browser replay of a given seed could not match.
  const offer = kind === 'levelup' ? rollCards() : rollModules();
  if (!offer.length) return flushModal();        // module pool exhausted
  G.offer = offer;
  G.state = kind;
  if (kind === 'levelup') { sfx.levelup(); G.onLevelUp?.(offer); }
  else { sfx.salvage(); G.onSalvage?.(offer); }
}

/* ---------------------------------------------------------------- progress */
function gainXp(n) {
  const p = G.player;
  p.xp += n;
  sfx.pickup();
  if (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    // Exponential, so level responds to clear rate logarithmically. Under the old
    // quadratic curve the run was a threshold: clear faster than they spawn and you
    // snowballed to level 75, fall behind and you died at 180s, with nothing in
    // between — a tenth of a point on the xp curve swung the win rate 0% to 58%.
    p.xpNext = Math.floor(7 * Math.pow(1 + TUNE.xpCurve, p.level));
    p.hp = Math.min(p.maxHp, p.hp + 4);
    queueModal('levelup');
  }
}

const EVO_STAT_PICKS = 1;   // times the paired stat must be taken

/** Is this owned weapon ready to evolve? */
function evoReady(w, p, owned) {
  const def = WEAPONS[w.id];
  return def.evo && w.lv >= def.max
    && (p.picks[def.evo.stat] || 0) >= EVO_STAT_PICKS
    && !owned.has(def.evo.id);
}

/** Three offers: evolutions, weapon level-ups, new weapons, stat mods. */
export function rollCards() {
  const p = G.player;
  const owned = new Map(p.weapons.map(w => [w.id, w]));
  const pool = [];

  // Evolutions are the run's payoff — weighted high so they surface promptly.
  for (const w of p.weapons) {
    if (!evoReady(w, p, owned)) continue;
    const evo = WEAPONS[w.id].evo, def = WEAPONS[evo.id];
    pool.push({ kind: 'evo', id: evo.id, base: w.id, icon: def.icon, name: def.name, desc: def.desc(1), weight: 40 });
  }
  // The opening is about the gun and nothing else. For the first few levels the
  // pool holds weapons only — no stat cards to read, and levelling the weapon you
  // are already holding is weighted far above picking up a second one. By level 5
  // the starting gun has gone from one bolt to a seven-pellet spread, and the
  // player watched every step of it happen.
  const gunFirst = p.level <= TUNE.gunLevels;
  for (const [id, w] of owned) {
    if (w.lv < WEAPONS[id].max)
      pool.push({ kind: 'up', id, icon: WEAPONS[id].icon, name: `${WEAPONS[id].name} Lv.${w.lv + 1}`, desc: WEAPONS[id].desc(w.lv + 1), weight: gunFirst ? 14 : 5 });
  }
  if (owned.size < p.slots)
    for (const id of Object.keys(WEAPONS)) {
      const def = WEAPONS[id];
      // Never re-offer a base weapon once its evolution is owned: taking it would
      // burn a slot on a strictly worse version of something you already have.
      if (owned.has(id) || def.evolved || (def.evo && owned.has(def.evo.id))) continue;
      pool.push({ kind: 'new', id, icon: def.icon, name: def.name, desc: def.desc(1), weight: gunFirst ? 3 : 4 });
    }
  if (!gunFirst) for (const s of STAT_UPGRADES) {
    // Nudge the stat that would unlock a pending evolution.
    const unlocks = p.weapons.some(w => {
      const def = WEAPONS[w.id];
      return def.evo && def.evo.stat === s.id && w.lv >= def.max && !owned.has(def.evo.id);
    });
    pool.push({ kind: 'stat', id: s.id, icon: s.icon, name: s.name, desc: s.desc, weight: unlocks ? 12 : 3 });
  }

  // Emergency Supply exists for the moment you are one hit from dying, so its
  // weight tracks missing health: absent at full hp, a common offer below a third.
  // It used to hang off an `if (!out.length)` fallback that cannot run — the pool
  // always holds ten stat upgrades, so three cards always fill. Measured: it was
  // offered 0 times in 27,000 card slots.
  // Offered often enough to be a lifeline, damped hard by how many you have already
  // taken: at a flat weight it stops being a lifeline and becomes a sustain engine,
  // and 5 of 24 sim runs stopped being able to end at all.
  const missing = 1 - p.hp / p.maxHp;
  if (missing > 0.35) pool.push({ kind: 'stat', ...HEAL_CARD, weight: missing * 18 / (1 + (p.picks.heal || 0) * 1.5) });

  const out = [];
  const bag = pool.slice();
  while (out.length < 3 && bag.length) {
    const c = weightedPick(bag);
    bag.splice(bag.indexOf(c), 1);
    out.push(c);
  }
  return out;
}

export function applyCard(card) {
  const p = G.player;
  if (card.kind === 'new') p.weapons.push({ id: card.id, lv: 1, t: 0, angle: 0 });
  else if (card.kind === 'up') p.weapons.find(w => w.id === card.id).lv++;
  else if (card.kind === 'evo') {
    const slot = p.weapons.find(w => w.id === card.base);
    slot.id = card.id; slot.lv = 1; slot.t = 0;      // evolution replaces in place
    G.texts.push({ x: p.x, y: p.y - 46, t: 0, v: 'EVOLVED!', color: '#ffc44d', big: true, life: 2 });
  } else {
    (STAT_UPGRADES.find(s => s.id === card.id) || HEAL_CARD).apply(p);
    p.picks[card.id] = (p.picks[card.id] || 0) + 1;
  }
  G.state = 'playing';
  flushModal();
}
