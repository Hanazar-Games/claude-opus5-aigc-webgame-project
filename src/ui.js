import { G, applyCard, applyModule, newRun, clearWorld } from './game.js';
import { WEAPONS, MODULES, DIFFICULTIES, ACTS, FINAL_AT } from './content.js';
import { fmtTime, fmtBig } from './util.js';
import { sfx, unlockAudio, startMusic, stopMusic, setMusicPaused, setMusicFinal, salvageHum, setMuted, loadMuted, music } from './audio.js';
import { VERSION, NEWS } from './news.js';

const $ = id => document.getElementById(id);
const el = {
  hud: $('hud'), overlay: $('overlay'),
  title: $('panel-title'), levelup: $('panel-levelup'), pause: $('panel-pause'),
  over: $('panel-over'), win: $('panel-win'), news: $('panel-news'), salvage: $('panel-salvage'),
  hpFill: $('hp-fill'), hpText: $('hp-text'), xpFill: $('xp-fill'), xpText: $('xp-text'),
  timer: $('timer'), kills: $('kills'), loadout: $('loadout'), cards: $('cards'),
  actTrack: $('act-track'), actFill: $('act-fill'), actName: $('act-name'),
  finalBar: $('final-bar'), fbFill: $('fb-fill'), stage: $('stage'), mods: $('mods'),
  salvHud: $('salv-hud'),
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
  salvageHum(false);          // every state change goes through here; nothing sustains across one
  for (const k of ['title', 'levelup', 'pause', 'over', 'win', 'news', 'salvage']) el[k].classList.toggle('hidden', k !== name);
  el.overlay.classList.toggle('hidden', !name);
  el.hud.classList.toggle('hidden', name === 'title');
}

export function initUI() {
  // Saved state is validated, not trusted. A half-written or hand-edited entry used
  // to throw straight out of initUI — `clears.includes` on a number, or a bad
  // difficulty id reaching `.name` — and the whole UI never finished building, which
  // is unrecoverable because the failure is the thing that draws the reset.
  const savedBest = load(BEST_KEY, {});
  if (savedBest && typeof savedBest === 'object' && !Array.isArray(savedBest)) Object.assign(best, savedBest);
  const savedClears = load(CLEAR_KEY, []);
  clears = Array.isArray(savedClears) ? savedClears.filter(id => DIFFICULTIES.some(d => d.id === id)) : [];
  const savedDiff = load('starfall.diff', 'veteran');
  diff = DIFFICULTIES.some(d => d.id === savedDiff) ? savedDiff : 'veteran';
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
    else if (a === 'quit') { G.state = 'title'; clearWorld(); showPanel('title'); stopMusic(); clearBanners(); buildDiffs(); }
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
    if (G.state === 'levelup' || G.state === 'salvage') {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(ev.code);
      if (i >= 0) (G.state === 'salvage' ? el.mods : el.cards).children[i]?.click();
      return;
    }
    // Enter / Space runs the primary action of whatever panel is up, so a run can
    // be restarted without reaching for the mouse.
    if (ev.code !== 'Enter' && ev.code !== 'Space') return;
    // A focused button already handles Enter/Space itself. Without this, tabbing to
    // a difficulty and pressing Space both picked the tier AND started the run.
    if (document.activeElement?.tagName === 'BUTTON') return;
    const panel = ['title', 'over', 'win', 'pause'].find(k => !el[k].classList.contains('hidden'));
    if (!panel) return;
    ev.preventDefault();
    el[panel].querySelector('.btn.primary')?.click();
  });

  G.onLevelUp = showCards;
  G.onDeath = showGameOver;
  G.onWin = showVictory;
  G.onAct = showActBanner;
  G.onSalvage = showModules;
  showPanel('title');
}

function clearBanners() { for (const b of el.stage.querySelectorAll('.act-banner')) b.remove(); }

function startRun() {
  newRun(diff);
  clearBanners();
  el.finalBar.classList.add('hidden');
  el.actTrack.classList.remove('hidden');
  $('run-diff').textContent = DIFFICULTIES.find(d => d.id === diff).name;
  showPanel(null);
  startMusic();
  showActBanner(ACTS[0]);          // acts 2-4 announce themselves; act 1 never did
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
  if (!final) sfx.act();           // the final act has the Devourer's own arrival cue
  setMusicFinal(final);
  clearBanners();
  const d = document.createElement('div');
  d.className = 'act-banner' + (final ? ' final' : '');
  d.innerHTML = `<b>${act.name}</b><i>${act.sub}</i>`;
  el.stage.appendChild(d);
  setTimeout(() => d.remove(), 3000);
  if (final) { el.actTrack.classList.add('hidden'); el.finalBar.classList.remove('hidden'); }
}

/**
 * What the run has actually become. Six versions of stacking percentages and the
 * game never told you the total — you could take Weak Point Analysis past the
 * point where crit is capped and nothing anywhere would say so.
 */
function statSheet() {
  const p = G.player;
  const pct = v => Math.round(v * 100) + '%';
  const rows = [
    ['DMG', '×' + p.damage.toFixed(2)],
    ['RATE', '×' + (1 / p.rate).toFixed(2)],
    ['CRIT', p.crit >= 1 ? '100% MAX' : pct(p.crit)],
    ['AREA', '×' + p.area.toFixed(2)],
    ['RANGE', '×' + p.range.toFixed(2)],
    ['SPEED', Math.round(p.speed)],
    ['ARMOR', '−' + pct(1 - p.armor) + ' taken'],
    ['REGEN', p.regen.toFixed(1) + '/s'],
    ['MAGNET', Math.round(p.pickup)],
    ['XP', '×' + p.xpMult.toFixed(2)],
  ];
  return rows.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
}

export function togglePause() {
  if (G.state === 'playing') {
    $('pause-info').textContent =
      `${DIFFICULTIES.find(d => d.id === diff).name} · ${ACTS[G.act].name} · ${fmtTime(G.time)} · Lv.${G.player.level}`;
    $('pause-stats').innerHTML = statSheet();
    G.state = 'paused'; showPanel('pause'); setMusicPaused(true);
  }
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

/**
 * Answering a modal hands control back to the game — but the game may immediately
 * raise the NEXT queued one, which shows its own panel. Blindly calling
 * showPanel(null) afterwards hid that panel while the state stayed modal: no
 * overlay, no cards, and main.js refusing to step because the state was not
 * 'playing'. A hard freeze with no way out but a reload, reachable precisely when
 * the v1.1 modal queue did its job.
 */
function dismiss() { if (G.state === 'playing') showPanel(null); }

/**
 * Safety net for the whole class, run every frame. A modal game state with no
 * panel on screen is unrecoverable — main.js will not step, and pause is disabled
 * during a modal — so if the two ever disagree again, re-raise instead of freezing.
 */
export function guardPanels() {
  const want = G.state === 'levelup' ? 'levelup' : G.state === 'salvage' ? 'salvage' : null;
  if (!want || !G.offer || !el[want].classList.contains('hidden')) return;
  if (want === 'levelup') showCards(G.offer); else showModules(G.offer);
}

/** Salvage draw. Same shape as a level-up, deliberately a different colour. */
function showModules(mods) {
  // What you already hold, so the choice is made against the build rather than blind
  $('mods-held').innerHTML = G.player.modules.length
    ? 'INSTALLED  ' + G.player.modules.map(id => `<span title="${modDef(id).name}">${modDef(id).icon}</span>`).join(' ')
    : '';
  el.mods.innerHTML = '';
  for (const m of mods) {
    const d = document.createElement('button');
    d.className = 'card mod';
    d.innerHTML = `<kbd>${mods.indexOf(m) + 1}</kbd><div class="ico">${m.icon}</div>` +
      `<div><h3>${m.name}</h3><p>${m.desc}</p></div>`;
    d.addEventListener('click', () => { sfx.select(); applyModule(m); dismiss(); });
    el.mods.appendChild(d);
  }
  showPanel('salvage');
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
    d.addEventListener('click', () => { sfx.select(); applyCard(c); dismiss(); syncLoadout(); });
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
  $(pre + 'mods').innerHTML = G.player.modules
    .map(id => `<span class="wchip mod">${modDef(id).icon} ${modDef(id).name}</span>`).join('');
  const evos = G.player.weapons.filter(w => WEAPONS[w.id].evolved).length;
  $(pre + 'extra').textContent = `${G.bossKills} mothership${G.bossKills === 1 ? '' : 's'} destroyed · ` +
    `${evos} evolution${evos === 1 ? '' : 's'} · ${G.salvaged} derelict${G.salvaged === 1 ? '' : 's'} stripped · ` +
    `${fmtBig(G.dmgDealt)} damage dealt`;

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
  // where the run ended matters in a campaign; "04:17" alone does not say it
  $('r-where').textContent = G.final ? 'FELL TO THE DEVOURER' : `LOST IN ${ACTS[G.act].name}`;
  fillResult('r-', false);
  setTimeout(() => showPanel('over'), 700);
}

function showVictory() {
  stopMusic();
  sfx.victory();
  const d = DIFFICULTIES.find(x => x.id === diff);
  const first = !clears.includes(diff);
  if (first) { clears.push(diff); save(CLEAR_KEY, clears); }
  $('w-diff').textContent = d.name + ' CLEARED';
  fillResult('w-', true);
  $('w-unlock').innerHTML = first && diff === 'veteran' ? '<div class="unlock">NIGHTMARE UNLOCKED</div>' : '';
  el.finalBar.classList.add('hidden');
  setTimeout(() => showPanel('win'), 1100);
}

const modDef = id => MODULES.find(m => m.id === id);

let lastLoadout = '';
function syncLoadout() {
  const p = G.player;
  const key = p.weapons.map(w => w.id + w.lv).join() + '|' + p.modules.join();
  if (key === lastLoadout) return;
  lastLoadout = key;
  // Modules were invisible once taken — nothing in the run told you what you were
  // holding, for the one system whose whole point is that it changes a rule.
  el.loadout.innerHTML = p.weapons
    .map(w => `<div class="slot" title="${WEAPONS[w.id].name}">${WEAPONS[w.id].icon}<i>${w.lv}</i></div>`).join('')
    + p.modules.map(id => {
      const m = modDef(id);
      return `<div class="slot mod" title="${m.name} — ${m.desc}">${m.icon}</div>`;
    }).join('');
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
  const hulk = G.hulks.find(h => h.active);
  const arc = Math.min(1, G.time / FINAL_AT);
  el.actFill.style.width = arc * 100 + '%';
  el.actName.textContent = ACTS[G.act].name;
  if (G.final) {
    el.fbFill.style.width = Math.max(0, G.final.hp / G.final.maxHp) * 100 + '%';
    music.intensity = 1;
  } else music.intensity = 0.2 + 0.8 * Math.min(1, G.time / 150);
  // The tensest seconds in the run had no musical answer at all: hold the
  // arrangement up while a wreck is being stripped, then let it fall back.
  if (hulk && !G.final) music.intensity = Math.max(music.intensity, 0.9);
  el.kills.textContent = `☠ ${G.kills}`;
  salvageHum(!!hulk, hulk ? hulk.p : 0);
  el.salvHud.textContent = hulk ? `SALVAGING  ${Math.round(hulk.p * 100)}%  ·  HOLD POSITION` : '';
  syncLoadout();
}
