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

// Decaying white noise, cached per duration. Generating one of these per kill was
// allocating a fresh sampleRate*dur Float32Array every time; a crowd wipe did it
// fifty times in a single frame.
const noiseBufs = new Map();
function noiseBuf(c, dur) {
  const key = dur.toFixed(2);
  let buf = noiseBufs.get(key);
  if (!buf) {
    const len = Math.floor(c.sampleRate * dur);
    buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    noiseBufs.set(key, buf);
  }
  return buf;
}

function noise({ dur = 0.18, vol = 0.25, freq = 900, dest = null }) {
  const c = ensure();
  if (!c || audio.muted) return;
  const src = c.createBufferSource(); src.buffer = noiseBuf(c, dur);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(dest || master);
  src.start();
}

/**
 * Voice budget. One frame can end fifty-five enemies — a single Orbital Strike
 * into a late-game crowd — and every one of them used to start its own sound.
 * Fifty-five identical bursts inside 16ms do not read as fifty-five kills, they
 * read as one clipped click, and they cost fifty-five node graphs to say it.
 *
 * Repeats inside `gap` are folded into the next play and make it *bigger*
 * instead, so a crowd wipe lands as one weighty hit rather than a crackle.
 */
const gates = new Map();
function gate(key, gap, fn) {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const g = gates.get(key);
  if (g && now - g.t < gap) { g.n++; return; }
  fn(g ? g.n : 0);
  gates.set(key, { t: now, n: 0 });
}
const swell = (n, per = 0.1, cap = 7) => 1 + Math.min(n, cap) * per;

export const sfx = {
  /* --- high-frequency combat sounds: gated, and louder for what they swallowed --- */
  shoot: () => gate('shoot', 0.05, n => tone({ freq: 760, to: 300, dur: 0.07, type: 'square', vol: 0.085 * swell(n, 0.06, 4) })),
  hit: () => gate('hit', 0.045, n => tone({ freq: 220, to: 120, dur: 0.06, type: 'triangle', vol: 0.11 * swell(n, 0.07, 5) })),
  kill: () => gate('kill', 0.05, n => noise({ dur: 0.14, vol: 0.16 * swell(n), freq: 1400 - Math.min(n, 7) * 90 })),
  pickup: () => gate('pickup', 0.035, n => tone({ freq: 880 + Math.min(n, 5) * 40, to: 1320, dur: 0.06, type: 'sine', vol: 0.09 * swell(n, 0.06, 4) })),
  nova: () => gate('nova', 0.09, n => tone({ freq: 120, to: 40, dur: 0.34, type: 'sine', vol: 0.28 * swell(n, 0.08, 3) })),
  hurt: () => { tone({ freq: 180, to: 60, dur: 0.22, type: 'sawtooth', vol: 0.22 }); noise({ dur: 0.2, freq: 400 }); },

  /* --- one-off events: never gated, they are the ones you must not miss --- */
  levelup: () => [0, 0.08, 0.16].forEach((d, i) => tone({ freq: 520 + i * 220, dur: 0.16, type: 'sine', vol: 0.22, delay: d })),
  boss: () => [0, 0.18].forEach(d => tone({ freq: 90, to: 46, dur: 0.5, type: 'sawtooth', vol: 0.3, delay: d })),
  // The Devourer gets its own arrival, not a louder Mothership: a long sub drop
  // under a detuned pair that beats against itself.
  devourer: () => {
    [0, 0.5, 1.0].forEach(d => tone({ freq: 74, to: 33, dur: 0.9, type: 'sawtooth', vol: 0.3, delay: d }));
    [0.06, 0.62].forEach(d => { tone({ freq: 148, to: 96, dur: 1.1, type: 'square', vol: 0.1, delay: d }); tone({ freq: 152, to: 99, dur: 1.1, type: 'square', vol: 0.1, delay: d }); });
    noise({ dur: 0.9, vol: 0.16, freq: 220 });
  },
  dead: () => [660, 520, 400, 260].forEach((f, i) => tone({ freq: f, to: f * 0.7, dur: 0.3, type: 'triangle', vol: 0.25, delay: i * 0.14 })),
  // Winning used to be silent, which for the one thing the whole run is about was
  // the loudest bug in the mix.
  victory: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.2, delay: i * 0.13 });
      tone({ freq: f / 2, dur: 0.5, type: 'sine', vol: 0.13, delay: i * 0.13 });
    });
    [1046.5, 1318.5, 1568].forEach((f, i) => tone({ freq: f, dur: 1.5, type: 'sine', vol: 0.13, delay: 0.55 + i * 0.02 }));
  },
  act: () => [0, 0.11].forEach((d, i) => tone({ freq: 330 * (i + 1), to: 494 * (i + 1), dur: 0.42, type: 'sine', vol: 0.15 - i * 0.05, delay: d })),
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

// The last fight used to sound exactly like minute three: every layer was already
// on at intensity 1 and the progression never changed. FINAL_ROOTS is a descending
// line that never resolves — Am, G#dim, F, F# — under a doubled bass.
const FINAL_ROOTS = [110.00, 103.83, 87.31, 92.50];

const MUSIC_VOL = 0.34;
let musicGain = null, drumGain = null, lowpass = null;
let timer = null, step = 0, nextTime = 0, paused = false;
export const music = { intensity: 0, final: false };

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

/** Kick and hat share the noise cache with the sfx layer; nothing here is a file. */
function kick(at, vol) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.11);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
  osc.connect(g); g.connect(drumGain);
  osc.start(at); osc.stop(at + 0.21);
}
function hat(at, vol, freq) {
  const c = ctx;
  const src = c.createBufferSource(); src.buffer = noiseBuf(c, 0.06);
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(drumGain);
  src.start(at);
}

function scheduleStep(i, at) {
  const bar = (i >> 3) % 4, beat = i % 8;
  const fin = music.final;
  const root = (fin ? FINAL_ROOTS : ROOTS)[bar];
  const k = fin ? 1 : music.intensity;

  // bass — every fourth eighth normally, every other one in the last fight
  if (beat % (fin ? 2 : 4) === 0) voice(root / 2, at, fin ? 0.26 : 0.5, 'triangle', fin ? 0.42 : 0.5, root / 2 * 0.985);
  if (k > 0.15 && beat % 2 === 0) voice(root, at, 0.34, 'sine', 0.16);              // pulse
  if (k > 0.35 && beat % 2 === 1) {                                                 // arp
    const n = SCALE[(i * 3 + bar) % SCALE.length];
    voice(semi(root * 2, n), at, 0.2, 'square', 0.055);
  }
  if (k > 0.6 && beat === 6) {                                                      // counter-melody
    const n = SCALE[(i * 5) % SCALE.length];
    voice(semi(root * 4, n), at, 0.16, 'triangle', 0.04);
  }
  // A minor-second stab against the root, only in the last fight. It is the one
  // interval in the whole soundtrack that is meant to sound wrong.
  if (fin && beat === 5) voice(semi(root * 2, 1), at, 0.13, 'sawtooth', 0.035);

  /* percussion — the bed had no rhythmic anchor at all before v1.1 */
  if (beat === 0 || beat === 4) kick(at, k > 0.3 ? 0.5 : 0.34);
  if (fin && beat === 6) kick(at, 0.34);
  if (k > 0.25 && (beat === 2 || beat === 6)) hat(at, 0.055, 5200);
  if (k > 0.55 && beat % 2 === 1) hat(at, 0.03, 7000);
  if (k > 0.45 && beat === 4) hat(at, 0.075, 1700);                                 // snare-ish
}

function tick() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.2) {
    scheduleStep(step++, nextTime);
    nextTime += STEP_DUR;
  }
}

function applyMusicGain() {
  const v = (audio.muted || paused) ? 0 : MUSIC_VOL;
  if (musicGain) musicGain.gain.value = v;
  if (drumGain) drumGain.gain.value = v;
}

/** The last fight opens the filter as well as changing the notes. */
export function setMusicFinal(v) {
  if (music.final === v) return;
  music.final = v;
  if (lowpass && ctx) lowpass.frequency.linearRampToValueAtTime(v ? 4400 : 2600, ctx.currentTime + 1.2);
}

export function startMusic() {
  const c = ensure();
  if (!c) return;
  if (!musicGain) {
    musicGain = c.createGain();
    lowpass = c.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.frequency.value = 2600;
    musicGain.connect(lowpass); lowpass.connect(master);
    // Drums bypass the lowpass — a hat behind a 2.6kHz wall is just a thud.
    drumGain = c.createGain(); drumGain.gain.value = 1; drumGain.connect(master);
  }
  stopMusic();
  paused = false;
  music.final = false;
  lowpass.frequency.cancelScheduledValues(c.currentTime);
  lowpass.frequency.value = 2600;
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
