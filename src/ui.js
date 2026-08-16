import { G, applyCard, newRun } from './game.js';
import { WEAPONS } from './content.js';
import { fmtTime } from './util.js';
import { sfx, audio, unlockAudio } from './audio.js';

const $ = id => document.getElementById(id);
const el = {
  hud: $('hud'), overlay: $('overlay'),
  title: $('panel-title'), levelup: $('panel-levelup'), pause: $('panel-pause'), over: $('panel-over'),
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

function showPanel(name) {
  for (const k of ['title', 'levelup', 'pause', 'over']) el[k].classList.toggle('hidden', k !== name);
  el.overlay.classList.toggle('hidden', !name);
  el.hud.classList.toggle('hidden', name === 'title');
}

export function initUI() {
  loadBest();
  $('best-title').textContent = best.time ? `${fmtTime(best.time)} · ☠${best.kills}` : '--';

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    unlockAudio(); sfx.select();
    const a = btn.dataset.action;
    if (a === 'start') { newRun(); showPanel(null); }
    else if (a === 'resume') { G.state = 'playing'; showPanel(null); }
    else if (a === 'quit') { G.state = 'title'; showPanel('title'); }
  });

  $('btn-pause').addEventListener('click', togglePause);
  $('mute').addEventListener('change', e => { audio.muted = e.target.checked; });

  G.onLevelUp = showCards;
  G.onDeath = showGameOver;
  showPanel('title');
}

export function togglePause() {
  if (G.state === 'playing') { G.state = 'paused'; showPanel('pause'); }
  else if (G.state === 'paused') { G.state = 'playing'; showPanel(null); }
}

function showCards(cards) {
  el.cards.innerHTML = '';
  for (const c of cards) {
    const tag = c.kind === 'evo' ? '<span class="tag evo">进化</span>'
      : c.kind === 'new' ? '<span class="tag new">新武器</span>'
      : c.kind === 'up' ? '<span class="tag up">强化</span>' : '';
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
  $('r-time').textContent = fmtTime(G.time);
  $('r-kills').textContent = G.kills;
  $('r-level').textContent = G.player.level;
  const isBest = G.time > (best.time || 0);
  if (isBest) { best.time = G.time; best.kills = G.kills; best.level = G.player.level; saveBest(); }
  $('r-best').textContent = isBest ? '★ 新纪录！' : `最佳纪录：${fmtTime(best.time)}`;
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
  el.kills.textContent = `☠ ${G.kills}`;
  syncLoadout();
}
