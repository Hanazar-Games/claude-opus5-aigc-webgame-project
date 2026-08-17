import { G, applyCard, newRun } from './game.js';
import { WEAPONS } from './content.js';
import { fmtTime } from './util.js';
import { sfx, unlockAudio, startMusic, stopMusic, setMusicPaused, setMuted, loadMuted, music } from './audio.js';
import { VERSION, NEWS } from './news.js';

const $ = id => document.getElementById(id);
const el = {
  hud: $('hud'), overlay: $('overlay'),
  title: $('panel-title'), levelup: $('panel-levelup'), pause: $('panel-pause'), over: $('panel-over'), news: $('panel-news'),
  hpFill: $('hp-fill'), hpText: $('hp-text'), xpFill: $('xp-fill'), xpText: $('xp-text'),
  timer: $('timer'), kills: $('kills'), loadout: $('loadout'), cards: $('cards'),
};

const BEST_KEY = 'starfall.best.v1';
export const best = { time: 0, kills: 0, level: 1 };

function loadBest() {
  try { Object.assign(best, JSON.parse(localStorage.getItem(BEST_KEY)) || {}); } catch { }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { }
}

let prevPanel = 'title';
function showPanel(name) {
  for (const k of ['title', 'levelup', 'pause', 'over', 'news']) el[k].classList.toggle('hidden', k !== name);
  el.overlay.classList.toggle('hidden', !name);
  el.hud.classList.toggle('hidden', name === 'title');
}

export function initUI() {
  loadBest();
  $('best-title').textContent = best.time ? `${fmtTime(best.time)} · ☠${best.kills}` : '--';

  buildNews();
  $('ver-badge').textContent = VERSION;

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    unlockAudio(); sfx.select();
    const a = btn.dataset.action;
    if (a === 'start') { newRun(); showPanel(null); startMusic(); }
    else if (a === 'resume') { G.state = 'playing'; showPanel(null); setMusicPaused(false); }
    else if (a === 'quit') { G.state = 'title'; showPanel('title'); stopMusic(); }
    else if (a === 'news') { prevPanel = G.state === 'paused' ? 'pause' : 'title'; showPanel('news'); }
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
  showPanel('title');
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
    d.innerHTML = `<div class="ico">${c.icon}</div><div><h3>${c.name}${tag}</h3><p>${c.desc}${from}</p></div>`;
    d.addEventListener('click', () => { sfx.select(); applyCard(c); showPanel(null); syncLoadout(); });
    el.cards.appendChild(d);
  }
  showPanel('levelup');
}

function showGameOver() {
  stopMusic();
  $('r-time').textContent = fmtTime(G.time);
  $('r-kills').textContent = G.kills;
  $('r-level').textContent = G.player.level;
  // final loadout + what the run actually achieved
  $('r-build').innerHTML = G.player.weapons
    .map(w => `<span class="wchip${WEAPONS[w.id].evolved ? ' evo' : ''}">${WEAPONS[w.id].icon} ${WEAPONS[w.id].name}${WEAPONS[w.id].evolved ? '' : ` Lv.${w.lv}`}</span>`)
    .join('');
  const evos = G.player.weapons.filter(w => WEAPONS[w.id].evolved).length;
  $('r-extra').textContent = `${G.bossKills} mothership${G.bossKills === 1 ? '' : 's'} destroyed · ${evos} evolution${evos === 1 ? '' : 's'}`;
  const isBest = G.time > (best.time || 0);
  if (isBest) { best.time = G.time; best.kills = G.kills; best.level = G.player.level; saveBest(); }
  $('r-best').textContent = isBest ? '★ NEW RECORD' : `Best: ${fmtTime(best.time)}`;
  $('best-title').textContent = best.time ? `${fmtTime(best.time)} · ☠${best.kills}` : '--';
  setTimeout(() => showPanel('over'), 700);
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
  music.intensity = Math.min(1, G.time / 150);
  el.kills.textContent = `☠ ${G.kills}`;
  syncLoadout();
}
