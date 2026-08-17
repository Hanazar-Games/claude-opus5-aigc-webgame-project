import { G, update } from './game.js';
import { render, seedStars } from './render.js';
import { initUI, syncHUD, togglePause } from './ui.js';
import { initInput, input } from './input.js';
import { unlockAudio, setMusicPaused } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let dpr = 1, W = 0, H = 0;

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  G.view.w = W; G.view.h = H;
}
addEventListener('resize', resize);
resize();
seedStars();
initInput(canvas);
initUI();
input.onPause = togglePause;
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G.state === 'playing') togglePause(); setMusicPaused(true); }
  else if (G.state === 'playing') setMusicPaused(false);
});

const STEP = 1 / 60;
let acc = 0, last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  if (G.state === 'playing') {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 6) { update(STEP); acc -= STEP; if (G.state !== 'playing') break; }
    syncHUD();
  } else acc = 0;

  render(ctx, W, H, dpr);
}
requestAnimationFrame(frame);
