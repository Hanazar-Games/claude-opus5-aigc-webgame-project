import { clamp } from './util.js';

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

export const input = { x: 0, y: 0, onPause: null };
const held = new Set();

// Headless (tools/sim.mjs) imports this module without a DOM; the sim drives
// `input.x/y` directly and never calls initInput().
const hasDOM = typeof document !== 'undefined';
const jsEl = hasDOM ? document.getElementById('joystick') : null;
const knob = hasDOM ? document.getElementById('joystick-knob') : null;
let touchId = null, ox = 0, oy = 0;
const RADIUS = 46;

function keyVector() {
  let x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  let y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : null;
}

export function initInput(canvas) {
  addEventListener('keydown', e => {
    const k = KEY_MAP[e.code];
    if (k) { held.add(k); e.preventDefault(); }
    if (e.code === 'KeyP' || e.code === 'Escape') input.onPause?.();
  });
  addEventListener('keyup', e => { const k = KEY_MAP[e.code]; if (k) held.delete(k); });
  addEventListener('blur', () => held.clear());

  const start = e => {
    if (touchId !== null) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    touchId = t.identifier ?? 'mouse';
    ox = t.clientX; oy = t.clientY;
    jsEl.style.left = ox + 'px'; jsEl.style.top = oy + 'px';
    jsEl.classList.remove('hidden');
    knob.style.transform = 'translate(-50%,-50%)';
  };
  const move = e => {
    if (touchId === null) return;
    const t = e.changedTouches ? [...e.changedTouches].find(t => t.identifier === touchId) : e;
    if (!t) return;
    let dx = t.clientX - ox, dy = t.clientY - oy;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const cl = clamp(len, 0, RADIUS);
      knob.style.transform = `translate(calc(-50% + ${dx / len * cl}px),calc(-50% + ${dy / len * cl}px))`;
      const mag = Math.min(1, len / (RADIUS * 0.75));
      input.x = dx / len * mag; input.y = dy / len * mag;
    }
  };
  const end = e => {
    if (touchId === null) return;
    if (e.changedTouches && ![...e.changedTouches].some(t => t.identifier === touchId)) return;
    touchId = null; input.x = input.y = 0;
    jsEl.classList.add('hidden');
  };

  canvas.addEventListener('touchstart', e => { e.preventDefault(); start(e); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); move(e); }, { passive: false });
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);
  canvas.addEventListener('mousedown', start);
  addEventListener('mousemove', move);
  addEventListener('mouseup', end);
}

/** Keyboard overrides the stick when pressed. */
export function readMove() {
  const kv = keyVector();
  return kv || { x: input.x, y: input.y };
}
