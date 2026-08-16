# 星海拾荒者 · Starfall Scavenger

一款纯前端的霓虹幸存者类 Roguelite 网页游戏。无构建步骤、无第三方依赖、无美术资源——
全部图形由 Canvas 2D 绘制，音效由 WebAudio 实时合成。

**▶ 在线游玩：https://hanazar-games.github.io/claude-opus5-aigc-webgame-project/**

## 玩法

- **移动**：`WASD` / 方向键；触屏在任意位置按下拖动即为虚拟摇杆
- **开火**：全自动，武器自动锁定屏幕内最近的敌人
- **成长**：击杀掉落星尘，拾取升级，每级从 3 张卡中三选一
- **暂停**：`P` / `Esc` / 右下角按钮
- 每 90 秒降临一次**母舰**，越往后敌人越快、越硬、越多
- **精英怪**（金色描边）血厚移动慢，但给 8 倍经验并必定掉落道具
- **道具**：✚ 治疗 · 磁暴（吸取全场星尘）· 轨道打击（全屏爆发）
- 母舰与精英在屏幕外时，边缘会有箭头指示方向

### 武器

| 武器 | 说明 |
| --- | --- |
| 🔫 脉冲枪 | 起手武器，射向最近敌人，高等级分裂多发并穿透 |
| 🚀 追踪导弹 | 追踪目标，命中后爆炸造成范围伤害 |
| ⚡ 湮灭射线 | 高速贯穿射线，无视数量 |
| 💥 星爆冲击 | 周期性以自身为中心释放冲击波并击退 |
| 🌀 环卫刃 | 绕身旋转的飞刃，持续切割贴身敌人 |

## 技术

```
index.html      入口 + DOM 界面层（标题/升级/暂停/结算）
styles.css      霓虹主题
src/main.js     画布尺寸、固定步长主循环
src/game.js     世界状态、更新、碰撞、成长（空间哈希网格加速）
src/content.js  全部数值内容：武器 / 敌人 / 升级卡
src/render.js   Canvas 2D 渲染
src/ui.js       HUD 与面板
src/input.js    键盘 + 虚拟摇杆
src/audio.js    WebAudio 音效合成
src/util.js     数学与随机工具
```

- 固定 1/60 秒逻辑步长，渲染与逻辑解耦，掉帧不影响手感
- 敌人碰撞与索敌走统一空间哈希网格，300 敌人下单帧更新 < 6ms
- 无打包器：浏览器原生 ES Module 直接加载，推到 GitHub Pages 即可运行

## 本地运行

```bash
python3 -m http.server 8099   # 然后打开 http://localhost:8099
```

## 平衡回归

游戏逻辑不依赖 DOM，且所有随机都走 `util.setSeed()`，因此可以在 Node 里无头跑对局：

```bash
node tools/sim.mjs                                  # 24 局，kite 机器人
node tools/sim.mjs --runs 60 --bot circle --view 420x780
node tools/sim.mjs --assert-min 90 --assert-max 420  # CI 用的护栏
```

输出存活时间分位数、等级曲线、母舰击杀率、平均屏内敌人数、单帧耗时。
CI 在部署前会跑一次，中位存活跌出 90~420 秒区间就拒绝上线。

## 开发日志

见 [DEVLOG.md](DEVLOG.md)。

## License

MIT
