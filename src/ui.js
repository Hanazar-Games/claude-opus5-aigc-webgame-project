import { G, applyCard, newRun } from './game.js';
import { WEAPONS, DIFFICULTIES, ACTS, FINAL_AT } from './content.js';
import { fmtTime, fmtBig } from './util.js';
import { sfx, unlockAudio, startMusic, stopMusic, setMusicPaused, setMuted, loadMuted, music } from './audio.js';
import { VERSION, NEWS } from './news.js';

const $ = id => document.getElementById(id);
const el = {
  hud: $('hud'), overlay: $('overlay'),
  title: $('panel-title'), levelup: $('panel-levelup'), pause: $('panel-pause'),
  over: $('panel-over'), win: $('panel-win'), news: $('panel-news'),
  hpFill: $('hp-fill'), hpText: $('hp-text'), xpFill: $('xp-fill'), xpText: $('xp-text'),
  timer: $('timer'), kills: $('kills'), loadout: $('loadout'), cards: $('cards'),
  actTrack: $('act-track'), actFill: $('act-fill'), actName: $('act-name'),
  finalBar: $('final-bar'), fbFill: $('fb-fill'), stage: $('stage'),
};

const BEST_KEY = 'starfall.best.v2';      // per difficulty, since v1.0 tiers
const CLEAR_KEY = 'starfall.clears.v1';
const SEEN_KEY = 'starfall.seenVersion';

export const best = {};                   // { [diffId]: { time, kills, level, won } }
let clears = [];                          // difficulty ids the player has actually cleared
let diff = 'veteran';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const bestOf = id => best[id] || { time: 0, kills: 0, level: 1, won: false };
const unlocked = id => id !== 'nightmare' || clears.includes('veteran');

let prevPanel = 'title';
function showPanel(name) {
  for (const k of ['title', 'levelup', 'pause', 'over', 'win', 'news']) el[k].classList.toggle('hidden', k !== name);
  el.overlay.classList.toggle('hidden', !name);
  el.hud.classList.toggle('hidden', name === 'title');
}

export function initUI() {
  Object.assign(best, load(BEST_KEY, {}));
  clears = load(CLEAR_KEY, []);
  diff = load('starfall.diff', 'veteran');
  if (!unlocked(diff)) diff = 'veteran';
  buildDiffs();

  buildNews();
  const badge = $('ver-badge');
  badge.textContent = VERSION;
  // flag the button until the player has actually read this version's notes
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch { }
  if (seen !== VERSION) badge.classList.add('unseen');

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    unlockAudio(); sfx.select();
    const a = btn.dataset.action;
    if (a === 'start') { startRun(); }
    else if (a === 'resume') { G.state = 'playing'; showPanel(null); setMusicPaused(false); }
    else if (a === 'quit') { G.state = 'title'; showPanel('title'); stopMusic(); buildDiffs(); }
    else if (a === 'news') {
      prevPanel = G.state === 'paused' ? 'pause' : 'title';
      showPanel('news');
      $('ver-badge').classList.remove('unseen');
      try { localStorage.setItem(SEEN_KEY, VERSION); } catch { }
    }
    else if (a === 'news-close') showPanel(prevPanel);
  });

  $('btn-pause').addEventListener('click', togglePause);

  // one mute setting, two checkboxes (title + pause), persisted
  const boxes = [...document.querySelectorAll('.mute-box')];
  const muted = loadMuted();
  for (const b of boxes) {
    b.checked = muted;
    b.addEventListener('change', ev => {
      setMuted(ev.target.checked);
      for (const o of boxes) o.checked = ev.target.checked;
    });
  }

  // level-up cards are pickable with 1 / 2 / 3
  addEventListener('keydown', ev => {
    if (G.state !== 'levelup') return;
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(ev.code);
    if (i >= 0) el.cards.children[i]?.click();
  });

  G.onLevelUp = showCards;
  G.onDeath = showGameOver;
  G.onWin = showVictory;
  G.onAct = showActBanner;
  showPanel('title');
}

function startRun() {
  newRun(diff);
  el.finalBar.classList.add('hidden');
  el.actTrack.classList.remove('hidden');
  showPanel(null);
  startMusic();
}

function buildDiffs() {
  $('diffs').innerHTML = DIFFICULTIES.map(d => {
    const b = bestOf(d.id), ok = unlocked(d.id);
    const line = !ok ? 'CLEAR VETERAN TO UNLOCK'
      : clears.includes(d.id) ? `<span class="clear">✔ ${fmtTime(b.time)}</span>`
      : b.time ? `best ${fmtTime(b.time)}` : d.desc;
    return `<button class="diff${d.id === diff ? ' on' : ''}" data-diff="${d.id}"${ok ? '' : ' disabled'}>` +
      `<b>${d.name}</b><small>${line}</small></button>`;
  }).join('');
  for (const b of $('diffs').children)
    b.addEventListener('click', () => { diff = b.dataset.diff; save('starfall.diff', diff); buildDiffs(); });
  const b = bestOf(diff);
  $('best-title').textContent = b.time ? `${fmtTime(b.time)} · ☠${b.kills}` : '--';
}

/** Act turnover: a banner over the field, no pause — the fight does not stop. */
function showActBanner(act) {
  const final = act.t >= FINAL_AT;
  const d = document.createElement('div');
  d.className = 'act-banner' + (final ? ' final' : '');
  d.innerHTML = `<b>${act.name}</b><i>${act.sub}</i>`;
  el.stage.appendChild(d);
  setTimeout(() => d.remove(), 3000);
  if (final) { el.actTrack.classList.add('hidden'); el.finalBar.classList.remove('hidden'); }
}

export function togglePause() {
  if (G.state === 'playing') { G.state = 'paused'; showPanel('pause'); setMusicPaused(true); }
  else if (G.state === 'paused') { G.state = 'playing'; showPanel(null); setMusicPaused(false); }
}

function entryHTML(n) {
  return `<div class="news-entry"><h3><b>${n.v}</b> · ${n.title}</h3><ul>` +
    n.notes.map(x => `<li>${x}</li>`).join('') + '</ul></div>';
}

function buildNews() {
  $('news-current').innerHTML = entryHTML(NEWS[0]);
  $('news-old').innerHTML = NEWS.slice(1).map(entryHTML).join('');
}

function showCards(cards) {
  el.cards.innerHTML = '';
  for (const c of cards) {
    const tag = c.kind === 'evo' ? '<span class="tag evo">EVOLVE</span>'
      : c.kind === 'new' ? '<span class="tag new">NEW</span>'
      : c.kind === 'up' ? '<span class="tag up">UPGRADE</span>' : '';
    const d = document.createElement('button');
    d.className = c.kind === 'evo' ? 'card evo' : 'card';
    const from = c.kind === 'evo' ? `<em>${WEAPONS[c.id].from}</em>` : '';
    d.innerHTML = `<kbd>${cards.indexOf(c) + 1}</kbd><div class="ico">${c.icon}</div>` +
      `<div><h3>${c.name}${tag}</h3><p>${c.desc}${from}</p></div>`;
    d.addEventListener('click', () => { sfx.select(); applyCard(c); showPanel(null); syncLoadout(); });
    el.cards.appendChild(d);
  }
  showPanel('levelup');
}

/**
 * One renderer for both endings. A win records the clear time; a loss records how
 * far you got — and a cleared tier always beats a longer failed run, so a 7:42
 * defeat never displaces a 7:31 clear as your best.
 */
function fillResult(pre, won) {
  $(pre + 'time').textContent = fmtTime(G.time);
  $(pre + 'kills').textContent = G.kills;
  $(pre + 'level').textContent = G.player.level;
  $(pre + 'build').innerHTML = G.player.weapons
    .map(w => `<span class="wchip${WEAPONS[w.id].evolved ? ' evo' : ''}">${WEAPONS[w.id].icon} ${WEAPONS[w.id].name}${WEAPONS[w.id].evolved ? '' : ` Lv.${w.lv}`}</span>`)
    .join('');
  const evos = G.player.weapons.filter(w => WEAPONS[w.id].evolved).length;
  $(pre + 'extra').textContent = `${G.bossKills} mothership${G.bossKills === 1 ? '' : 's'} destroyed · ` +
    `${evos} evolution${evos === 1 ? '' : 's'} · ${fmtBig(G.dmgDealt)} damage dealt`;

  const b = bestOf(diff);
  const better = won ? (!b.won || G.time < b.time) : (!b.won && G.time > b.time);
  if (better) {
    best[diff] = { time: G.time, kills: G.kills, level: G.player.level, won };
    save(BEST_KEY, best);
  }
  const nb = bestOf(diff);
  $(pre + 'best').textContent = better ? '★ NEW RECORD'
    : `Best ${DIFFICULTIES.find(d => d.id === diff).name}: ${fmtTime(nb.time)}${nb.won ? ' ✔' : ''}`;
  buildDiffs();
}

function showGameOver() {
  stopMusic();
  fillResult('r-', false);
  setTimeout(() => showPanel('over'), 700);
}

function showVictory() {
  stopMusic();
  const d = DIFFICULTIES.find(x => x.id === diff);
  const first = !clears.includes(diff);
  if (first) { clears.push(diff); save(CLEAR_KEY, clears); }
  $('w-diff').textContent = d.name + ' CLEARED';
  fillResult('w-', true);
  $('w-unlock').innerHTML = first && diff === 'veteran' ? '<div class="unlock">NIGHTMARE UNLOCKED</div>' : '';
  el.finalBar.classList.add('hidden');
  setTimeout(() => showPanel('win'), 1100);
}

let lastLoadout = '';
function syncLoadout() {
  const key = G.player.weapons.map(w => w.id + w.lv).join();
  if (key === lastLoadout) return;
  lastLoadout = key;
  el.loadout.innerHTML = G.player.weapons
    .map(w => `<div class="slot" title="${WEAPONS[w.id].name}">${WEAPONS[w.id].icon}<i>${w.lv}</i></div>`).join('');
}

export function syncHUD() {
  const p = G.player;
  if (!p) return;
  const hk = Math.max(0, p.hp / p.maxHp);
  el.hpFill.style.width = hk * 100 + '%';
  el.hpText.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
  el.xpFill.style.width = Math.min(100, p.xp / p.xpNext * 100) + '%';
  el.xpText.textContent = `Lv.${p.level}`;
  el.timer.textContent = fmtTime(G.time);
  const arc = Math.min(1, G.time / FINAL_AT);
  el.actFill.style.width = arc * 100 + '%';
  el.actName.textContent = ACTS[G.act].name;
  if (G.final) {
    el.fbFill.style.width = Math.max(0, G.final.hp / G.final.maxHp) * 100 + '%';
    music.intensity = 1;
  } else music.intensity = 0.2 + 0.8 * Math.min(1, G.time / 150);
  el.kills.textContent = `☠ ${G.kills}`;
  syncLoadout();
}
