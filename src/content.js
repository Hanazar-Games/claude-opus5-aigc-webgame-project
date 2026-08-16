// All game content: weapons, enemies, upgrades. Pure data + small fire hooks.
import { TAU, rand } from './util.js';

/* ------------------------------------------------------------------ weapons */
// stats(lv) returns the numbers for that level. fire(G, w, s) spawns things.
export const WEAPONS = {
  blaster: {
    name: '脉冲枪', icon: '🔫', max: 6,
    desc: lv => `向最近敌人射出 ${1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0)} 发弹丸`,
    stats: lv => ({ cd: 0.58 - lv * 0.045, dmg: 14 + lv * 7, count: 1 + (lv >= 3) + (lv >= 5), pierce: lv >= 4 ? 1 : 0, speed: 560 }),
    fire(G, s) {
      const t = G.nearestEnemy(G.player, 400); if (!t) return;
      const base = Math.atan2(t.y - G.player.y, t.x - G.player.x);
      const spread = 0.14;
      for (let i = 0; i < s.count; i++) {
        const a = base + (i - (s.count - 1) / 2) * spread;
        G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: 4, pierce: s.pierce, color: '#4df3ff', life: 0.95 });
      }
    },
  },
  missile: {
    name: '追踪导弹', icon: '🚀', max: 6,
    desc: lv => `发射 ${1 + Math.floor(lv / 2)} 枚追踪导弹，爆炸造成范围伤害`,
    stats: lv => ({ cd: 1.5 - lv * 0.1, dmg: 16 + lv * 8, count: 1 + Math.floor(lv / 2), blast: 46 + lv * 6, speed: 260 }),
    fire(G, s) {
      for (let i = 0; i < s.count; i++) {
        const t = G.nearestEnemy(G.player, 560, i);
        const a = t ? Math.atan2(t.y - G.player.y, t.x - G.player.x) + rand(0.5, -0.5) : rand(TAU);
        G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: 6, color: '#ffc44d', life: 2.4, homing: 4.5, blast: s.blast, trail: true });
      }
    },
  },
  laser: {
    name: '湮灭射线', icon: '⚡', max: 6,
    desc: lv => `贯穿一切的高速射线，伤害 ${18 + lv * 11}`,
    stats: lv => ({ cd: 1.35 - lv * 0.09, dmg: 18 + lv * 11, pierce: 99, speed: 1500, w: 3 + lv }),
    fire(G, s) {
      const t = G.nearestEnemy(G.player, 480); if (!t) return;
      const a = Math.atan2(t.y - G.player.y, t.x - G.player.x);
      G.spawnBullet({ a, speed: s.speed, dmg: s.dmg, r: s.w, pierce: s.pierce, color: '#ff4dd2', life: 0.42, beam: true });
    },
  },
  nova: {
    name: '星爆冲击', icon: '💥', max: 6,
    desc: lv => `周期性释放冲击波，半径 ${100 + lv * 26}`,
    stats: lv => ({ cd: 3.4 - lv * 0.22, dmg: 22 + lv * 12, radius: 100 + lv * 26, knock: 220 }),
    fire(G, s) { G.novaBlast(G.player.x, G.player.y, s.radius, s.dmg, s.knock); },
  },
  orbit: {
    name: '环卫刃', icon: '🌀', max: 6,
    desc: lv => `${2 + Math.floor(lv / 2)} 把绕身飞刃，持续切割`,
    stats: lv => ({ count: 2 + Math.floor(lv / 2), dmg: 9 + lv * 6, radius: 74 + lv * 7, spin: 2.4 + lv * 0.16, r: 12 }),
    orbital: true,
  },
};

/* ------------------------------------------------------------------ enemies */
export const ENEMIES = {
  drone: { name: '游荡者', hp: 20, speed: 96, r: 11, dmg: 7, xp: 1, color: '#ff7ba8', shape: 'tri' },
  darter: { name: '尖啸', hp: 12, speed: 152, r: 8, dmg: 6, xp: 1, color: '#ffd24d', shape: 'diamond' },
  brute: { name: '重装', hp: 110, speed: 72, r: 20, dmg: 17, xp: 5, color: '#a77bff', shape: 'hex' },
  spitter: { name: '喷吐者', hp: 42, speed: 80, r: 13, dmg: 10, xp: 3, color: '#5cff9d', shape: 'square',
    shoot: { cd: 2.4, speed: 190, dmg: 11, count: 1 } },
  weaver: { name: '织网者', hp: 70, speed: 112, r: 14, dmg: 11, xp: 4, color: '#4df3ff', shape: 'star', orbitStrafe: true },
  boss: { name: '母舰', hp: 1200, speed: 64, r: 44, dmg: 34, xp: 90, color: '#ff4d5e', shape: 'boss', boss: true,
    shoot: { cd: 2.0, speed: 165, dmg: 16, count: 12 } },
};

// [startTime, type, weight] — director samples from entries unlocked at time t.
export const SPAWN_TABLE = [
  [0, 'drone', 10],
  [25, 'darter', 7],
  [60, 'brute', 4],
  [80, 'spitter', 4],
  [110, 'weaver', 4],
  [150, 'brute', 4],
  [200, 'darter', 8],
];

export const BOSS_INTERVAL = 90; // seconds

/* ----------------------------------------------------------------- upgrades */
export const STAT_UPGRADES = [
  { id: 'dmg', icon: '🗡', name: '能量超载', desc: '所有伤害 +15%', apply: p => p.damage *= 1.15 },
  { id: 'rate', icon: '⏱', name: '快速循环', desc: '攻击间隔 -11%', apply: p => p.rate *= 0.89 },
  { id: 'speed', icon: '👟', name: '推进器', desc: '移动速度 +11%', apply: p => p.speed *= 1.11 },
  { id: 'hp', icon: '❤', name: '装甲增幅', desc: '最大生命 +25 并治疗', apply: p => { p.maxHp += 25; p.hp += 25; } },
  { id: 'regen', icon: '✚', name: '纳米修复', desc: '每秒回复 +0.6 生命', apply: p => p.regen += 0.6 },
  { id: 'armor', icon: '🛡', name: '偏导护盾', desc: '受到伤害 -12%', apply: p => p.armor *= 0.88 },
  { id: 'pickup', icon: '🧲', name: '磁力线圈', desc: '拾取范围 +35%', apply: p => p.pickup *= 1.35 },
  { id: 'crit', icon: '🎯', name: '弱点分析', desc: '暴击率 +8%（2 倍伤害）', apply: p => p.crit += 0.08 },
  { id: 'area', icon: '🌐', name: '场域扩张', desc: '范围效果 +14%', apply: p => p.area *= 1.14 },
  { id: 'xp', icon: '⭐', name: '数据挖掘', desc: '经验获取 +18%', apply: p => p.xpMult *= 1.18 },
];

export const HEAL_CARD = { id: 'heal', icon: '🍀', name: '应急补给', desc: '立即回复 40% 生命', apply: p => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); } };
