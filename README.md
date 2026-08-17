# Starfall Scavenger

A neon roguelite survivors game that runs entirely in the browser. No build step,
no dependencies, no art assets — every shape is drawn with Canvas 2D, and every
sound *and the soundtrack itself* is synthesised at runtime with WebAudio. The
whole game is about 40 KB of source.

**▶ Play: https://hanazar-games.github.io/claude-opus5-aigc-webgame-project/**

## How to play

- **Move** — `WASD` / arrow keys, or drag anywhere on a touch screen for a virtual stick
- **Shoot** — automatic. Most weapons hit the nearest enemy; missiles and beams prioritise the Mothership
- **Grow** — kills drop stardust; collect it to level up and pick 1 of 3 cards
- **Pause** — `P` / `Esc` / the button in the corner
- A **Mothership** arrives every 90 seconds, and the gap shrinks each time one appears. Enemies get faster, tougher and denser as you survive
- **Elites** (gold outline) are slow and tanky but worth 8× XP and always drop an item.
  Past 100s they carry a modifier, shown as a coloured dashed ring:
  - 🟢 **Splitter** — shatters into four chaff when killed
  - 🔴 **Volley** — fires rings of bullets you cannot shoot down
  - 🔵 **Haste** — accelerates continuously until it catches you
- **Items** — ✚ Heal · Magnet (pulls in every orb on the field) · Orbital Strike (screen-wide blast)
- Off-screen Motherships, elites and items are flagged by arrows at the screen edge

### Weapons

| Weapon | Behaviour |
| --- | --- |
| 🔫 Pulse Gun | Starting weapon. Fires at the nearest target; splits and pierces at higher levels |
| 🚀 Seeker Missiles | Home in on targets and blast on impact |
| ⚡ Annihilation Beam | High-speed beam that pierces everything in a line |
| 💥 Starburst | Periodic shockwave centred on you, knocking enemies back |
| 🌀 Orbit Blades | Blades circling you, shredding anything that gets close |

### Evolutions

Max a weapon (Lv.4), then take its **paired stat** — a gold evolution card enters
the pool. Evolving replaces the weapon in place with a step-change upgrade.
Funnelling one line beats spreading yourself thin.

| Evolution | Recipe | Effect |
| --- | --- | --- |
| 🌠 Starbreaker | Pulse Gun + Weak Point Analysis | One shot that tears through the entire field |
| 🛰 Hive | Seeker Missiles + Rapid Cycling | Six hard-locking missiles per volley |
| ✳ Prism Storm | Annihilation Beam + Overload | Six piercing beams radiating out from you |
| 🕳 Singularity | Starburst + Field Expansion | Drags enemies in and shreds them |
| 🌪 Bladestorm | Orbit Blades + Thrusters | Eight massive blades forming a kill zone |

## Architecture

```
index.html      Entry point + DOM UI layer (title / level-up / pause / results)
styles.css      Neon theme
src/main.js     Canvas sizing, fixed-timestep main loop
src/game.js     World state, update, collision, progression (spatial hash grid)
src/content.js  All tunable content: weapons / enemies / upgrade cards
src/render.js   Canvas 2D rendering
src/ui.js       HUD and panels
src/input.js    Keyboard + virtual joystick
src/audio.js    WebAudio sound synthesis
src/util.js     Math, seeded RNG
tools/sim.mjs   Headless balance harness
```

- Logic runs at a fixed 1/60s step, decoupled from rendering, so frame drops don't change feel
- Collision and targeting share one spatial hash grid: < 6ms per update at 300 enemies
- No bundler — the browser loads native ES modules straight from GitHub Pages
- The music is generated, not streamed: a 4-bar minor progression whose layers
  (bass → pulse → arpeggio → counter-melody) switch on as the run intensifies

## Running locally

```bash
python3 -m http.server 8099   # then open http://localhost:8099
```

## Balance regression

The game logic has no DOM dependency and all randomness routes through
`util.setSeed()`, so runs replay bit-for-bit and can be simulated headlessly in Node:

```bash
node tools/sim.mjs                                   # 24 runs, kite bot
node tools/sim.mjs --runs 60 --bot circle --view 420x780
node tools/sim.mjs --picks focused                   # one-weapon-line build
node tools/sim.mjs --assert-min 90 --assert-max 420  # the CI guard
node tools/sim.mjs --sweep hpDouble,70,85,100        # sweep a balance knob
```

It reports survival quantiles, the level curve, Mothership kill rate, average
on-screen enemy count and peak update cost. `--sweep` re-runs the whole battery
across values of a knob in `TUNE`, so balance calls are made from a curve rather
than a single hand-picked number.

It also asserts **invariants** — e.g. bosses killed can never exceed bosses
spawned. Those checks need no judgement about whether a figure looks plausible,
and they have caught more real bugs than the tuning numbers have.

CI runs it before every deploy and refuses to ship on a violated invariant or if
median survival leaves the 90–420s band.

## Devlog

See [DEVLOG.md](DEVLOG.md) — a running record of what each version changed and
which bugs the headless simulator caught.

## License

MIT
