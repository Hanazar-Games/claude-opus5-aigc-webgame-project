export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;

/* Every source of randomness in the game routes through `random()` so the
   headless balance sim (tools/sim.mjs) can replay a run bit-for-bit. */
let _rng = Math.random;
export const random = () => _rng();
export function setSeed(seed) {
  let a = seed >>> 0;
  _rng = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (a = 1, b = 0) => b + random() * (a - b);
export const randInt = (a, b) => Math.floor(rand(a, b));
export const pick = arr => arr[(random() * arr.length) | 0];
export const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
export const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Weighted pick: items must expose `.weight` (default 1). */
export function weightedPick(items) {
  let total = 0;
  for (const it of items) total += it.weight ?? 1;
  let r = random() * total;
  for (const it of items) { r -= it.weight ?? 1; if (r <= 0) return it; }
  return items[items.length - 1];
}
