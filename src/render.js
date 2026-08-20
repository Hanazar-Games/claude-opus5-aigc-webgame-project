import { TAU, rand, clamp } from './util.js';
import { G } from './game.js';
import { WEAPONS } from './content.js';

const AFFIX_TINT = { splitter: '#5cff9d', volley: '#ff4d5e', haste: '#4df3ff' };

let stars = [];
export function seedStars(n = 260) {
  stars = Array.from({ length: n }, () => ({
    x: rand(4000, -2000), y: rand(4000, -2000), z: rand(1, 0.25), r: rand(1.6, 0.5),
  }));
}

function shape(ctx, kind, r, t) {
  ctx.beginPath();
  switch (kind) {
    case 'tri':
      ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, r * 0.75); ctx.lineTo(-r * 0.7, -r * 0.75); ctx.closePath(); break;
    case 'diamond':
      ctx.moveTo(r, 0); ctx.lineTo(0, r * 0.7); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 0.7); ctx.closePath(); break;
    case 'square':
      ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); break;
    case 'hex':
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); break;
    case 'star':
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10, rr = i % 2 ? r * 0.48 : r; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); break;
    // A slow, heavy maw: an inner ring of teeth counter-rotating against an outer
    // shell, so at a glance it reads as a different order of thing to a Mothership.
    case 'devourer': {
      for (let i = 0; i < 14; i++) {
        const a = i * TAU / 14 - t * 0.18, rr = r * (i % 2 ? 0.74 : 1);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 + t * 0.5, rr = r * (i % 2 ? 0.2 : 0.5);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); break;
    }
    case 'boss': {
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + t * 0.3, rr = r * (i % 2 ? 0.62 : 1);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); break;
    }
  }
}

export function render(ctx, w, h, dpr) {
  const p = G.player, cam = G.cam, t = G.time;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, w, h);
  if (!p) return;

  const sx = cam.shake ? rand(cam.shake, -cam.shake) : 0;
  const sy = cam.shake ? rand(cam.shake, -cam.shake) : 0;
  const ox = w / 2 - cam.x + sx, oy = h / 2 - cam.y + sy;

  /* parallax starfield (wrapped around camera) */
  ctx.save();
  const SPAN = 3000;
  for (const s of stars) {
    const px = ((s.x - cam.x * s.z) % SPAN + SPAN) % SPAN - SPAN / 2 + w / 2;
    const py = ((s.y - cam.y * s.z) % SPAN + SPAN) % SPAN - SPAN / 2 + h / 2;
    if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
    ctx.globalAlpha = 0.18 + s.z * 0.5;
    ctx.fillStyle = s.z > 0.7 ? '#9fd8ff' : '#3d5a8a';
    ctx.fillRect(px, py, s.r, s.r);
  }
  ctx.restore();

  /* ground grid */
  ctx.save();
  ctx.strokeStyle = 'rgba(80,140,220,.07)';
  ctx.lineWidth = 1;
  const gs = 110;
  const gx = ox % gs, gy = oy % gs;
  ctx.beginPath();
  for (let x = gx; x < w; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = gy; y < h; y += gs) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(ox, oy);

  /* nova rings */
  for (const n of G.novas) {
    const k = n.t / n.dur;
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = '#8f7bff';
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (0.35 + k * 0.75), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  /* xp orbs */
  ctx.fillStyle = '#4df3ff';
  ctx.shadowBlur = 10; ctx.shadowColor = '#4df3ff';
  for (const o of G.orbs) { ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
  ctx.shadowBlur = 0;

  /* pickups */
  for (const pk of G.pickups) {
    const c = pk.kind === 'heal' ? '#5cff9d' : pk.kind === 'magnet' ? '#4df3ff' : '#ffc44d';
    const pulse = 1 + Math.sin(pk.t * 7) * 0.12;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = 16; ctx.shadowColor = c;
    ctx.strokeStyle = c; ctx.fillStyle = c + '2e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, pk.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c;
    if (pk.kind === 'heal') { ctx.fillRect(-5, -1.6, 10, 3.2); ctx.fillRect(-1.6, -5, 3.2, 10); }
    else if (pk.kind === 'magnet') { ctx.fillRect(-5, -4, 3, 8); ctx.fillRect(2, -4, 3, 8); ctx.fillRect(-5, -5, 10, 3); }
    else { for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.fillRect(Math.cos(a) * 4 - 1, Math.sin(a) * 4 - 1, 2.4, 2.4); } }
    ctx.restore();
  }
  ctx.shadowBlur = 0;

  /* enemies */
  for (const e of G.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.atan2(e.vy, e.vx));
    const flash = e.flash > 0;
    ctx.fillStyle = flash ? '#ffffff' : e.color + '33';
    ctx.strokeStyle = flash ? '#ffffff' : e.elite ? '#ffd24d' : e.color;
    ctx.lineWidth = e.boss ? 3 : e.elite ? 3 : 2;
    if (e.boss || e.elite) { ctx.shadowBlur = e.boss ? 24 : 14; ctx.shadowColor = e.elite ? '#ffd24d' : e.color; }
    if (e.def.final) {
      // The last boss has to read as a different order of thing at a glance, not as
      // a larger Mothership: a containment ring that tightens as it takes damage.
      const k = Math.max(0, e.hp / e.maxHp);
      ctx.lineWidth = 3; ctx.shadowBlur = 40;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.22 + i * 0.12;
        ctx.strokeStyle = i === 2 ? '#ffc44d' : '#a0208f';
        ctx.beginPath();
        ctx.arc(0, 0, e.r * (1.5 - i * 0.13) - (1 - k) * 22, t * (0.5 + i * 0.4) % TAU, t * (0.5 + i * 0.4) % TAU + TAU * 0.62);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(120,10,70,.55)';
      ctx.strokeStyle = flash ? '#ffffff' : e.color;
    }
    shape(ctx, e.shape, e.r, t);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    if (e.elite && e.affix) {
      // dashed ring, colour-coded by modifier, so the threat reads at a glance
      const ac = AFFIX_TINT[e.affix];
      ctx.save();
      ctx.translate(e.x, e.y); ctx.rotate(t * 1.6);
      ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.arc(0, 0, e.r + 8, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (e.boss || e.elite) {
      const bw = e.def.final ? 190 : e.boss ? 90 : 44, k = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - bw / 2, e.y - e.r - 16, bw, 5);
      ctx.fillStyle = e.def.final ? '#ff2f6d' : e.boss ? '#ff4d5e' : '#ffd24d';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 16, bw * k, 5);
    }
  }
  ctx.shadowBlur = 0;

  /* enemy bullets */
  for (const b of G.ebullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }

  /* player bullets */
  for (const b of G.bullets) {
    ctx.strokeStyle = b.color; ctx.fillStyle = b.color;
    ctx.shadowBlur = 8; ctx.shadowColor = b.color;
    if (b.beam) {
      const len = 46;
      ctx.lineWidth = b.r; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(b.a) * len, b.y - Math.sin(b.a) * len);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      if (b.trail) {
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(b.x - b.vx * 0.02, b.y - b.vy * 0.02, b.r * 0.8, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.shadowBlur = 0; ctx.lineCap = 'butt';

  /* orbital blades */
  for (const w2 of p.weapons) {
    const def = WEAPONS[w2.id]; if (!def.orbital) continue;
    const s = def.stats(w2.lv), R = s.radius * p.area;
    ctx.strokeStyle = '#5cff9d'; ctx.fillStyle = 'rgba(92,255,157,.22)'; ctx.lineWidth = 2;
    ctx.shadowBlur = 12; ctx.shadowColor = '#5cff9d';
    for (let i = 0; i < s.count; i++) {
      const a = w2.angle + i * TAU / s.count;
      ctx.save();
      ctx.translate((w2.cx ?? p.x) + Math.cos(a) * R, (w2.cy ?? p.y) + Math.sin(a) * R);
      ctx.rotate(a * 3);
      shape(ctx, 'diamond', s.r, t);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  /* player */
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invuln > 0 && ((p.invuln * 20) | 0) % 2) ctx.globalAlpha = 0.35;
  // pickup radius hint
  ctx.strokeStyle = 'rgba(77,243,255,.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, p.pickup, 0, TAU); ctx.stroke();
  ctx.rotate(p.dir);
  if (p.moving > 0.05) {
    ctx.fillStyle = `rgba(255,196,77,${0.5 * p.moving})`;
    ctx.beginPath();
    ctx.moveTo(-p.r * 0.8, -4); ctx.lineTo(-p.r * 0.8 - 14 * p.moving - rand(6), 0); ctx.lineTo(-p.r * 0.8, 4);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(77,243,255,.25)';
  ctx.strokeStyle = '#4df3ff'; ctx.lineWidth = 2.2;
  ctx.shadowBlur = 16; ctx.shadowColor = '#4df3ff';
  shape(ctx, 'tri', p.r, t);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  /* particles */
  for (const q of G.parts) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.r / 2, q.y - q.r / 2, q.r, q.r);
  }
  ctx.globalAlpha = 1;

  /* floating text */
  ctx.textAlign = 'center';
  for (const tx of G.texts) {
    const life = tx.life || 0.9;
    ctx.globalAlpha = Math.max(0, 1 - tx.t / life);
    ctx.fillStyle = tx.color;
    ctx.font = `700 ${tx.big ? 26 : 14}px ui-monospace,monospace`;
    ctx.fillText(tx.v, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  /* off-screen markers for things worth walking toward */
  const M = 26;
  const marker = (wx, wy, color) => {
    let sx2 = wx - cam.x + w / 2, sy2 = wy - cam.y + h / 2;
    if (sx2 > M && sx2 < w - M && sy2 > M && sy2 < h - M) return;
    const cx = clamp(sx2, M, w - M), cy = clamp(sy2, M, h - M);
    const a = Math.atan2(sy2 - h / 2, sx2 - w / 2);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = color; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, 6); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  for (const e of G.enemies) if (e.boss) marker(e.x, e.y, e.def.final ? '#ff2f6d' : '#ff4d5e'); else if (e.elite) marker(e.x, e.y, '#ffd24d');
  for (const pk of G.pickups) marker(pk.x, pk.y, pk.kind === 'heal' ? '#5cff9d' : pk.kind === 'magnet' ? '#4df3ff' : '#ffc44d');
  ctx.globalAlpha = 1;

  /* low-hp vignette */
  const hpk = p.hp / p.maxHp;
  if (hpk < 0.4) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(255,0,40,0)');
    g.addColorStop(1, `rgba(255,0,40,${(0.4 - hpk) * 1.1})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}
