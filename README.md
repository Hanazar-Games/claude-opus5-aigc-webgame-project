# Starfall Scavenger

A neon roguelite survivors game that runs entirely in the browser. No build step,
no dependencies, no art assets — every shape is drawn with Canvas 2D, and every
sound *and the soundtrack itself* is synthesised at runtime with WebAudio. The
whole game is about 45 KB of source.

It is a **campaign, not an endless mode**: four acts, then The Devourer at 7:00.
Kill it and you have won the run. Along the way, **derelicts** drift in — stand
inside one long enough and you strip it for a module you cannot get any other way.

**▶ Play: https://hanazar-games.github.io/claude-opus5-aigc-webgame-project/**

## How to play

- **Move** — `WASD` / arrow keys, or drag anywhere on a touch screen for a virtual stick
- **Shoot** — automatic. Most weapons hit the nearest enemy; missiles and beams prioritise the Mothership
- **Grow** — kills drop stardust; collect it to level up and pick 1 of 3 cards
- **Pause** — `P` / `Esc` / the button in the corner. Level-up cards can also be picked with `1` / `2` / `3`
- **Salvage** — a **derelict** drifts in every ~90s. Hold position inside its ring to strip it
- **Win** — survive four acts and destroy **The Devourer**, which arrives at 7:00 and does not leave
- A **Mothership** arrives every 90 seconds, and the gap shrinks each time one appears. Enemies get faster, tougher and denser as you survive
- **Elites** (gold outline) are slow and tanky but worth 8× XP and always drop an item.
  Past 100s they carry a modifier, shown as a coloured dashed ring:
  - 🟢 **Splitter** — shatters into four chaff when killed
  - 🔴 **Volley** — fires rings of bullets you cannot shoot down
  - 🔵 **Haste** — accelerates continuously until it catches you
- **Items** — ✚ Heal · Magnet (pulls in every orb on the field) · Orbital Strike (screen-wide blast)
- Off-screen Motherships, elites and items are flagged by arrows at the screen edge

### The arc

| Act | From | What changes |
| --- | --- | --- |
| Debris Field | 0:00 | Drifters and Shriekers. Room to build |
| The Hunt | 2:10 | Bulwarks, Spitters, Weavers. The first Motherships matter |
| Swarm Tide | 4:30 | Density, clusters, elites with modifiers |
| The Devourer | 7:00 | One fight. Chaff spawns drop to a fifth |

The Devourer summons escorts below 66% health, adds a spiral arm below 33%, and
**rages** with the fight clock — its damage and speed climb for 150 seconds.
Stalling it is not a strategy, only a slower loss. That rage is what guarantees a
run terminates; every version before v1.0 could only end by killing you, and five
balance passes in a row were spent stopping strong builds from running forever.

Three tiers: **Recruit**, **Veteran**, and **Nightmare**, unlocked by clearing
Veteran. Best times are kept per tier, and a clear always outranks a longer loss.

### Derelicts

The game is named for scavenging and for eleven versions there was nothing to
scavenge. The reason to add it was measured rather than thematic: every number
this project has produced says the dominant strategy is to run away forever — the
kiting bot beats the charging one, and Orbit Blades measured 0.57 kills/s for a
kiter against 3.08 for a bot that charges in. Nothing in the game ever asked the
player to hold ground. A derelict asks.

Stand inside the ring and a meter fills; step out and it bleeds back, slower than
it built. Holding it costs you two things:

- **the reactor** — your weapons fire ~45% slower for the whole strip
- **the beacon** — reinforcements arrive around the *wreck*, not around you

Finish it and you draw one of eight **modules**, which never appear in a level-up:

| Module | Effect |
| --- | --- |
| 🔩 Reactor Coupling | A fifth weapon hardpoint |
| 🛰 Point Defense | Periodically burns every enemy shot near you |
| 🩸 Vampiric Coils | Each kill restores health |
| ⚙ Overclock | +35% damage, −22% max HP |
| 🧲 Salvage Drone | +260 pickup range |
| 💢 Reactive Plating | Taking a hit detonates a shockwave |
| 🧱 Ablative Hull | +90 max HP, −9% speed |
| 📡 Targeting Uplink | +30% weapon range |

Derelicts are **optional on Recruit** — a run that ignores every one still clears
about one time in four — and part of the campaign above it.

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
src/audio.js    WebAudio SFX + generative soundtrack
src/news.js     Version + patch notes
src/util.js     Math, seeded RNG
tools/sim.mjs   Headless campaign harness (win rate)
tools/bench.mjs Weapon damage bench (does a level-up actually do anything?)
tools/bots.mjs  Movement policies shared by both
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
`util.setSeed()`, so runs replay exactly and can be simulated headlessly in Node.

Two caveats, both measured rather than assumed. Cosmetic jitter (screen shake,
thruster flicker) draws from its **own** unseeded source: until v1.1 it used the
simulation's stream, so drawing a frame advanced the world's RNG and the same seed
produced a different run depending on how many frames were rendered. And replay is
exact *within* one JS engine — driving the browser and Node from the same seed
agrees frame-for-frame for ~55 seconds, after which `Math.hypot`/`Math.atan2`
differences between engines (they are not specified to be bit-identical) accumulate
in what is a chaotic system.

### `tools/sim.mjs` — can the campaign be cleared?

```bash
node tools/sim.mjs                                    # 24 runs, kite bot, veteran
node tools/sim.mjs --diff nightmare --runs 40
node tools/sim.mjs --picks focused --view 420x780     # one-weapon build, phone screen
node tools/sim.mjs --sweep hpDouble,70,84,100         # sweep a balance knob
node tools/sim.mjs --tune hulkFirst=99999             # what a run that skips every derelict looks like
node tools/sim.mjs --view 1920x1080                    # difficulty must not track window size
node tools/sim.mjs --assert-win-min 15 --assert-win-max 55   # the CI guard
```

Since v1.0 the headline number is the **win rate**, not survival time. Survival
time was only ever a proxy for difficulty, and a bad one: it cannot tell "died at
5:00 on the way up" from "died at 5:00 to the final boss", and those two want
opposite fixes. The report breaks deaths down by act, and for runs that reached
the Devourer and lost, reports how much of its health was left.

It also asserts **invariants** — bosses killed can never exceed bosses spawned; a
win cannot happen before the Devourer spawns; no run may reach the hard stop,
because that would mean the arc does not terminate; no salvage module is ever
taken twice; and **no player stat is ever a non-finite number**, which is how a
missing tuning knob turned a cooldown into `NaN` and silently stopped every weapon
from firing (`Math.max(0.06, NaN)` is `NaN`, and `t >= NaN` is never true). Those checks need no judgement
about whether a figure looks plausible, and they have caught more real bugs than
the tuning numbers have.

### `tools/bench.mjs` — does this weapon do what its card says?

```bash
node tools/bench.mjs             # dps table + assertions
node tools/bench.mjs --stats     # which stat upgrade helps which weapon
node tools/bench.mjs --only orbit --bot circle --seeds 24
```

Two numbers per weapon per level: **boss** dps against a single knockback-immune
target at 120px, and **clear** rate — kills per second in a real run with live
spawns, an immortal kiting bot and the enemy population pinned so every weapon
faces the same density. Two assertions:

- a level-up must never *lower* a weapon's output (v0.8 shipped a Pulse Gun whose
  Lv.3 upgrade made it miss at range — survival time was far too noisy to see it)
- an evolution must be at least 1.25× the maxed weapon it consumes (v0.9 caught
  Starbreaker at 0.98×)

CI runs both tools before every deploy and refuses to ship on a violated
invariant, a weapon regression, or a win rate outside the intended band per tier.

## Devlog

See [DEVLOG.md](DEVLOG.md) — a running record of what each version changed and
which bugs the headless simulator caught.

## License

MIT
