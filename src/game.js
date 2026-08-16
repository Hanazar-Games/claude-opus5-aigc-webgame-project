import { TAU, clamp, rand, random, angleTo, weightedPick } from './util.js';
import { WEAPONS, ENEMIES, SPAWN_TABLE, BOSS_INTERVAL, STAT_UPGRADES, HEAL_CARD } from './content.js';
import { sfx } from './audio.js';
import { readMove } from './input.js';

const ENEMY_CAP = 380;
const CELL = 64;

export const G = {
  state: 'title',
  time: 0, kills: 0, bossCount: 0, bossKills: 0,
  player: null,
  enemies: [], bullets: [], ebullets: [], orbs: [], pickups: [], parts: [], texts: [], novas: [],
  cam: { x: 0, y: 0, shake: 0 },
  view: { w: 800, h: 600 },
  spawnAcc: 0, nextBoss: BOSS_INTERVAL,
  grid: new Map(),
  onLevelUp: null, onDeath: null,
};

/* ------------------------------------------------------------------- setup */
export function newRun() {
  G.time = 0; G.kills = 0; G.bossCount = 0; G.bossKills = 0; G.spawnAcc = 0; G.nextBoss = BOSS_INTERVAL;
  G.enemies.length = G.bullets.length = G.ebullets.length = 0;
  G.orbs.length = G.pickups.length = G.parts.length = G.texts.length = G.novas.length = 0;
  G.cam.x = G.cam.y = 0; G.cam.shake = 0;
  G.player = {
    x: 0, y: 0, r: 13, hp: 120, maxHp: 120, speed: 178,
    damage: 1, rate: 1, armor: 1, pickup: 125, crit: 0.05, area: 1, xpMult: 1, regen: 0,
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
  const md2 = maxD * maxD;
  if (prefer) {
    let bb = null, bbd = Infinity;
    for (const e of G.enemies) {
      if (!e.boss) continue;
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d <= md2 && d < bbd) { bbd = d; bb = e; }
    }
    if (bb) return bb;
  }
  let best = null, bd = Infinity;
  const cands = idx > 0 ? [] : null;
  for (const e of G.enemies) {
    const dx = e.x - from.x, dy = e.y - from.y, d = dx * dx + dy * dy;
    if (d > md2) continue;
    if (cands) cands.push([d, e]);
    else if (d < bd) { bd = d; best = e; }
  }
  if (!cands) return best;
  if (!cands.length) return null;
  cands.sort((a, b) => a[0] - b[0]);
  return cands[Math.min(idx, cands.length - 1)][1];
};

G.spawnBullet = o => {
  G.bullets.push({
    x: G.player.x, y: G.player.y,
    vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed,
    a: o.a, r: o.r, dmg: o.dmg * G.player.damage, life: o.life,
    pierce: o.pierce || 0, color: o.color, homing: o.homing || 0,
    blast: o.blast || 0, beam: !!o.beam, trail: !!o.trail, hit: null,
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
  e.hp -= d; e.flash = 0.1;
  if (crit) G.texts.push({ x: e.x, y: e.y - e.r, t: 0, v: Math.round(d), color: '#ffc44d' });
  if (e.hp <= 0) killEnemy(e);
  else if (random() < 0.35) sfx.hit();
}

function killEnemy(e) {
  e.dead = true;
  G.kills++;
  burst(e.x, e.y, e.color, e.boss ? 40 : e.elite ? 20 : 8, e.boss ? 260 : 150);
  const n = e.boss ? 14 : e.elite ? 5 : 1;
  for (let i = 0; i < n; i++)
    G.orbs.push({ x: e.x + rand(20, -20), y: e.y + rand(20, -20), vx: rand(60, -60), vy: rand(60, -60), xp: e.xp / n, r: e.elite || e.boss ? 7 : 5 });
  if (e.boss) {
    G.bossKills++; G.cam.shake = 18; sfx.boss();
    dropPickup(e.x, e.y, 'heal'); dropPickup(e.x + 40, e.y, 'bomb');
    G.texts.push({ x: e.x, y: e.y - 40, t: 0, v: 'MOTHERSHIP DOWN', color: '#5cff9d', big: true, life: 2 });
  } else {
    sfx.kill();
    if (e.elite) dropPickup(e.x, e.y, weightedPick(DROPS).kind);
  }
}

const DROPS = [{ kind: 'heal', weight: 5 }, { kind: 'magnet', weight: 3 }, { kind: 'bomb', weight: 3 }];

function dropPickup(x, y, kind) {
  G.pickups.push({ x, y, kind, r: 11, t: 0 });
}

function collectPickup(pk) {
  const p = G.player;
  pk.got = true;
  sfx.levelup();
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

/* ------------------------------------------------------------------ spawns */
function spawnPoint() {
  const a = rand(TAU);
  const d = Math.hypot(G.view.w, G.view.h) * 0.5 + 110;
  return { x: G.player.x + Math.cos(a) * d, y: G.player.y + Math.sin(a) * d };
}

function spawnEnemy(type, at) {
  const def = ENEMIES[type];
  const t = G.time;
  const hpMult = 1 + t / 80 + (t / 190) ** 2 + (def.boss ? (G.bossCount - 1) * 0.75 : 0);
  const dmgMult = 1 + t / 200;
  const p = at || spawnPoint();
  // Elites: rare, fat, slow, worth a lot — they hand out the run's power spikes.
  const elite = !def.boss && t > 45 && random() < 0.045;
  const hp = def.hp * hpMult * (elite ? 4 : 1);
  G.enemies.push({
    type, x: p.x, y: p.y, vx: 0, vy: 0, hp, maxHp: hp,
    r: def.r * (elite ? 1.5 : 1),
    speed: def.speed * (1 + t / 600) * (def.boss ? 1 : rand(1.1, 0.9)) * (elite ? 0.72 : 1),
    dmg: def.dmg * dmgMult * (elite ? 1.3 : 1),
    color: def.color, shape: def.shape, xp: def.xp * (elite ? 8 : 1) * (1 + t / 150),
    boss: !!def.boss, elite,
    flash: 0, shootT: rand(2), orbCd: 0, wob: rand(TAU), def,
  });
}

function director(dt) {
  const t = G.time;
  if (t >= G.nextBoss) {
    G.nextBoss += BOSS_INTERVAL; G.bossCount++;
    spawnEnemy('boss');
    G.texts.push({ x: G.player.x, y: G.player.y - 70, t: 0, v: 'MOTHERSHIP INBOUND', color: '#ff4d5e', big: true, life: 2.4 });
    sfx.boss();
  }
  const bossFight = G.enemies.some(e => e.boss);
  const rate = (0.45 + t / 34) * (bossFight ? 0.5 : 1);   // ease the chaff during a boss
  G.spawnAcc += dt * rate;
  const table = SPAWN_TABLE.filter(r => t >= r[0]).map(r => ({ type: r[1], weight: r[2] }));
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length >= ENEMY_CAP) break;
    spawnEnemy(weightedPick(table).type);
  }
  // occasional tight cluster for pressure
  if (t > 55 && random() < dt * 0.12 && G.enemies.length < ENEMY_CAP - 20) {
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

  /* player movement */
  const mv = readMove();
  const len = Math.hypot(mv.x, mv.y);
  if (len > 0.02) {
    p.x += mv.x * p.speed * dt; p.y += mv.y * p.speed * dt;
    p.dir = Math.atan2(mv.y, mv.x); p.moving = Math.min(1, p.moving + dt * 6);
  } else p.moving = Math.max(0, p.moving - dt * 8);
  p.invuln = Math.max(0, p.invuln - dt);
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  /* weapons */
  for (const w of p.weapons) {
    const def = WEAPONS[w.id], s = def.stats(w.lv);
    if (def.orbital) { w.angle = (w.angle + s.spin * dt) % TAU; continue; }
    w.t += dt;
    const cd = Math.max(0.06, s.cd * p.rate);
    if (w.t >= cd) { w.t = 0; def.fire(G, s); if (w.id !== 'nova') sfx.shoot(); }
  }
  updateOrbitals(dt);

  /* enemies */
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

    if (e.def.shoot) {
      e.shootT += dt;
      if (e.shootT >= e.def.shoot.cd) {
        e.shootT = 0;
        const sh = e.def.shoot, base = angleTo(e, p);
        for (let i = 0; i < sh.count; i++) {
          const ang = sh.count > 1 ? base + i * TAU / sh.count : base;
          G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sh.speed, vy: Math.sin(ang) * sh.speed, r: 6, dmg: sh.dmg * (1 + G.time / 260), life: 5, color: e.color });
        }
      }
    }

    // contact damage
    const rr = e.r + p.r;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr && p.invuln <= 0) {
      hurtPlayer(e.dmg);
      if (!e.boss) { e.vx = Math.cos(a) * -260; e.vy = Math.sin(a) * -260; }  // bounce off, no instant re-hit
    }

    // recycle far strays
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > 1000 * 1000 && !e.boss) {
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
      if (b.blast) { G.novaBlast(b.x, b.y, b.blast, b.dmg * 0.6, 90); b.life = 0; break; }
      if (b.pierce > 0) { b.pierce--; (b.hit ||= new Set()).add(e); }
      else { b.life = 0; break; }
    }
    if (b.life <= 0 && b.blast) burst(b.x, b.y, b.color, 6, 120);
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
    if (d < pr || o.age > 7) {
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

function updateOrbitals(dt) {
  const p = G.player;
  for (const w of p.weapons) {
    const def = WEAPONS[w.id]; if (!def.orbital) continue;
    const s = def.stats(w.lv), R = s.radius * p.area;
    for (let i = 0; i < s.count; i++) {
      const a = w.angle + i * TAU / s.count;
      const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
      for (const e of queryGrid(bx, by, s.r + 26, _q)) {
        if (e.dead || e.orbCd > 0) continue;
        const rr = e.r + s.r;
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 > rr * rr) continue;
        damageEnemy(e, s.dmg * p.damage);
        e.orbCd = 0.32;
      }
    }
  }
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

/* ---------------------------------------------------------------- progress */
function gainXp(n) {
  const p = G.player;
  p.xp += n;
  sfx.pickup();
  if (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = Math.floor(5 + p.level * 4 + p.level * p.level * 0.35);
    p.hp = Math.min(p.maxHp, p.hp + 4);
    G.state = 'levelup';
    sfx.levelup();
    G.onLevelUp?.(rollCards());
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
  for (const [id, w] of owned) {
    if (w.lv < WEAPONS[id].max)
      pool.push({ kind: 'up', id, icon: WEAPONS[id].icon, name: `${WEAPONS[id].name} Lv.${w.lv + 1}`, desc: WEAPONS[id].desc(w.lv + 1), weight: 5 });
  }
  if (owned.size < 4)
    for (const id of Object.keys(WEAPONS))
      if (!owned.has(id) && !WEAPONS[id].evolved)
        pool.push({ kind: 'new', id, icon: WEAPONS[id].icon, name: WEAPONS[id].name, desc: WEAPONS[id].desc(1), weight: 4 });
  for (const s of STAT_UPGRADES) {
    // Nudge the stat that would unlock a pending evolution.
    const unlocks = p.weapons.some(w => {
      const def = WEAPONS[w.id];
      return def.evo && def.evo.stat === s.id && w.lv >= def.max && !owned.has(def.evo.id);
    });
    pool.push({ kind: 'stat', id: s.id, icon: s.icon, name: s.name, desc: s.desc, weight: unlocks ? 12 : 3 });
  }

  const out = [];
  const bag = pool.slice();
  while (out.length < 3 && bag.length) {
    const c = weightedPick(bag);
    bag.splice(bag.indexOf(c), 1);
    out.push(c);
  }
  if (!out.length) out.push({ kind: 'stat', ...HEAL_CARD, name: HEAL_CARD.name });
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
}
