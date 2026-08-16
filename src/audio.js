// Tiny WebAudio synth — no assets, everything is generated.
let ctx = null, master = null;
export const audio = { muted: false };

function ensure() {
  if (ctx) return ctx;
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
};
