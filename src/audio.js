// Tiny WebAudio synth — no assets, everything is generated.
let ctx = null, master = null;
export const audio = { muted: false };

function ensure() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;   // headless sim
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.28;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

function tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.3, delay = 0 }) {
  const c = ensure();
  if (!c || audio.muted) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.18, vol = 0.25, freq = 900 }) {
  const c = ensure();
  if (!c || audio.muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

export const sfx = {
  shoot: () => tone({ freq: 760, to: 300, dur: 0.07, type: 'square', vol: 0.09 }),
  hit: () => tone({ freq: 220, to: 120, dur: 0.06, type: 'triangle', vol: 0.12 }),
  kill: () => noise({ dur: 0.14, vol: 0.18, freq: 1400 }),
  hurt: () => { tone({ freq: 180, to: 60, dur: 0.22, type: 'sawtooth', vol: 0.22 }); noise({ dur: 0.2, freq: 400 }); },
  pickup: () => tone({ freq: 880, to: 1320, dur: 0.06, type: 'sine', vol: 0.1 }),
  levelup: () => [0, 0.08, 0.16].forEach((d, i) => tone({ freq: 520 + i * 220, dur: 0.16, type: 'sine', vol: 0.22, delay: d })),
  nova: () => tone({ freq: 120, to: 40, dur: 0.34, type: 'sine', vol: 0.3 }),
  boss: () => [0, 0.18].forEach(d => tone({ freq: 90, to: 46, dur: 0.5, type: 'sawtooth', vol: 0.3, delay: d })),
  dead: () => [660, 520, 400, 260].forEach((f, i) => tone({ freq: f, to: f * 0.7, dur: 0.3, type: 'triangle', vol: 0.25, delay: i * 0.14 })),
  select: () => tone({ freq: 620, to: 900, dur: 0.09, type: 'sine', vol: 0.18 }),
  heal: () => [523, 784].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'sine', vol: 0.2, delay: i * 0.07 })),
  magnet: () => tone({ freq: 300, to: 1200, dur: 0.26, type: 'triangle', vol: 0.18 }),
  strike: () => { tone({ freq: 160, to: 50, dur: 0.42, type: 'sawtooth', vol: 0.28 }); noise({ dur: 0.4, vol: 0.22, freq: 700 }); },
};

/* ------------------------------------------------------------------- music */
// Generative bed, no audio files: a 4-bar minor progression whose layers switch
// on as the run heats up. `intensity` (0..1) is driven by elapsed run time.
const BPM = 104, STEP_DUR = 60 / BPM / 2;      // eighth notes
const ROOTS = [110.00, 87.31, 130.81, 98.00];  // Am · F · C · G
const SCALE = [0, 3, 5, 7, 10];                // minor pentatonic offsets (semitones)
const semi = (f, n) => f * Math.pow(2, n / 12);

const MUSIC_VOL = 0.34;
let musicGain = null, timer = null, step = 0, nextTime = 0, paused = false;
export const music = { intensity: 0 };

function voice(freq, at, dur, type, vol, glide) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(at); osc.stop(at + dur + 0.02);
}

function scheduleStep(i, at) {
  const bar = (i >> 3) % 4, beat = i % 8;
  const root = ROOTS[bar];
  const k = music.intensity;

  if (beat % 4 === 0) voice(root / 2, at, 0.5, 'triangle', 0.5, root / 2 * 0.985);  // bass
  if (k > 0.15 && beat % 2 === 0) voice(root, at, 0.34, 'sine', 0.16);              // pulse
  if (k > 0.35 && beat % 2 === 1) {                                                  // arp
    const n = SCALE[(i * 3 + bar) % SCALE.length];
    voice(semi(root * 2, n), at, 0.2, 'square', 0.055);
  }
  if (k > 0.6 && beat === 6) {                                                       // counter-melody
    const n = SCALE[(i * 5) % SCALE.length];
    voice(semi(root * 4, n), at, 0.16, 'triangle', 0.04);
  }
}

function tick() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.2) {
    scheduleStep(step++, nextTime);
    nextTime += STEP_DUR;
  }
}

function applyMusicGain() {
  if (musicGain) musicGain.gain.value = (audio.muted || paused) ? 0 : MUSIC_VOL;
}

export function startMusic() {
  const c = ensure();
  if (!c) return;
  if (!musicGain) {
    musicGain = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    musicGain.connect(lp); lp.connect(master);
  }
  stopMusic();
  paused = false;
  applyMusicGain();          // respect a mute chosen before music ever started
  step = 0; nextTime = c.currentTime + 0.1;
  timer = setInterval(tick, 40);
}

export function stopMusic() {
  if (timer) { clearInterval(timer); timer = null; }
}

/** Silence and stop scheduling while the game is paused / the tab is hidden. */
export function setMusicPaused(v) {
  if (v === paused) return;
  paused = v;
  applyMusicGain();
  if (v) { if (timer) { clearInterval(timer); timer = null; } }
  else if (ctx && !timer) { nextTime = ctx.currentTime + 0.05; timer = setInterval(tick, 40); }
}

export function setMuted(v) {
  audio.muted = v;
  applyMusicGain();
  try { localStorage.setItem('starfall.muted', v ? '1' : '0'); } catch { }
}

export function loadMuted() {
  try { audio.muted = localStorage.getItem('starfall.muted') === '1'; } catch { }
  return audio.muted;
}
