/** Version + patch notes. `NEWS[0]` is the current announcement; the rest is history. */
export const VERSION = 'v1.1';

export const NEWS = [
  {
    v: 'v1.1', title: 'Salvage',
    notes: [
      'The game is called <b>Scavenger</b> and until now there was nothing in it to scavenge. <b>Derelicts</b> drift into the field: stand inside one long enough and you strip it for a <b>module</b> — a fifth weapon hardpoint, point defense that burns incoming fire, coils that heal you on every kill. Modules never appear in a level-up.',
      'The reason to build this was measured, not thematic. Every number this game has ever produced says the same thing: run away forever. The kiting bot beats the charging one, and an entire weapon line was five times weaker for kiters. The cause was that nothing ever asked you to hold ground. A derelict asks.',
      'Holding one costs you. Stripping a hulk diverts the reactor, so your weapons fire slower for exactly the seconds the field is closing in, and its beacon drops reinforcements around the wreck instead of around you. The first version made salvaging <em>spawn more enemies</em> and the win rate went <em>up</em> — in a game where a built player out-clears the spawn rate, extra enemies are extra XP. A cost you can convert into progress is not a cost.',
      'Derelicts are optional on Recruit and part of the campaign above it: a Recruit run that ignores every one still clears about one time in four.',
      'Fixed: a level-up and a salvage draw that landed on the same frame used to overwrite each other, and the unanswered offer was gone for good. Both are queued now.',
      'Fixed, and it is the reason a bench exists: a missing tuning knob made the salvage penalty <code>NaN</code>, which silently stopped every weapon from firing while you stood in a wreck — <code>Math.max(0.06, NaN)</code> is <code>NaN</code>, and <code>t >= NaN</code> is never true. The sim now asserts that no player stat is ever a non-finite number.',
      'Fixed a second viewport bug, this one live since v0.1 as well: a tab that loads in the background can report a window size of zero, and the game measured itself exactly once at load. The world became 0x0, which put the enemy spawn ring 110px away — enemies materialised inside your own reaction time. The size is now floored and re-measured when the tab is first shown.',
      'Fixed: screen shake and thruster flicker drew from the simulation\'s random stream, so <em>drawing a frame advanced the world\'s RNG</em> and a given seed played out differently depending on how many frames were rendered. Cosmetic jitter has its own source now, and the browser and the headless sim run frame-for-frame identical from the same seed.',
      'Balance: enemy health doubles every 84s (was 110), the Devourer has 330k health (was 175k). The Devourer now kills about a third of the players who reach it on Veteran.',
    ],
  },
  {
    v: 'v1.0', title: 'The Campaign',
    notes: [
      'A run is now a campaign with an ending. Four acts, then <b>The Devourer</b> at 7:00 — kill it and you win. Every version before this could only end by killing you.',
      'That was not a content decision. Five balance passes in a row were spent stopping strong builds from running forever; an endless mode has to be held down by numbers, an arc ends because it was designed to.',
      'Three difficulties: Recruit, Veteran, and Nightmare, which you unlock by clearing Veteran. Best times are tracked per tier, and a clear always outranks a longer failed run.',
      'Stat upgrades now stack additively instead of compounding. Twenty compounding +15% damage picks is 16x; that exponential is why a two-level swing used to decide a whole run and the enemy curve had to be knife-edged to contain it.',
      'Level-ups follow an exponential XP curve, so how far you level responds to your clear rate logarithmically. The old quadratic curve made runs a threshold: snowball to level 75, or die at 3:00, with nothing in between.',
      'Fixed: the Starbreaker evolution was a sidegrade — 0.98x the single-target damage of the maxed Pulse Gun it consumes. The other four evolutions are 2x to 4x.',
      'Fixed: Orbit Blades ignored attack speed entirely — the re-hit cooldown was a hard-coded constant, so "Rapid Cycling" was worth exactly 0% to that whole weapon line.',
      'Fixed: the Emergency Supply card was offered 0 times in 27,000 card draws. It hung off a fallback branch that cannot run. It now appears when you are actually hurt.',
      'Orbit blades trail behind you as you move. Measured, they cleared 0.57 kills/s for a kiting player and 3.08 for one who charges in — a 5x swing on playstyle, with nothing in the game to tell you that.',
      'Fixed a bad one, live since v0.1: on any browser window wider than about 1780px diagonal — a maximised window on a 1080p monitor — enemies spawned outside a hard-coded 1000px cull radius and were teleported back to the edge every frame. They never reached you, nothing died, and you never levelled. Every balance run and screenshot for nine versions had been taken at 900x620, just under the threshold.',
      'Difficulty no longer depends on your window size. Standing enemy count is spawn rate times flight time, and flight time is the screen — the same tier was a 31% clear on a desktop and 59% on a phone. Spawn rate now cancels the screen out.',
      'New tool: <code>tools/bench.mjs</code>, a weapon damage bench that asserts every level-up and every evolution is a real damage increase.',
    ],
  },
  {
    v: 'v0.8', title: 'Accuracy & Feel',
    notes: [
      'Fixed a big one: upgrading the Pulse Gun to Lv.3 made it <em>worse</em>. The two bolts were spread by a fixed angle, so past ~250px they straddled the target and both missed — inside the gun\'s own 400px range. Spread is now derived from a fixed gap at the target, so every bolt connects.',
      'The soundtrack no longer opens with 20+ seconds of a lone bass note — the pulse layer is in from the first bar, and the full arrangement arrives by 110s instead of 150s.',
      'Level-up cards now show their 1 / 2 / 3 key.',
      'Patch notes are reachable from the pause menu, and the version badge flags a release you have not read yet.',
      'Text fixes: "Fires 1 bolt(s)" and a dead upgrade tier that could never trigger.',
    ],
  },
  {
    v: 'v0.7', title: 'Audit & Polish',
    notes: [
      'Fixed: weapons you had already evolved could be re-offered as a "new" pickup, wasting a slot on a strictly worse version.',
      'Fixed: muting before your first run did nothing — the soundtrack started at full volume anyway.',
      'Fixed: music kept playing while paused or after switching tabs.',
      'Mute is now remembered between sessions, and is reachable from the title screen.',
      'Health, Magnet and Orbital Strike pickups now have their own sounds instead of reusing the level-up jingle.',
      'Level-up cards can be picked with the 1 / 2 / 3 keys.',
      'Added this patch notes screen.',
    ],
  },
  {
    v: 'v0.6', title: 'The Runaway Fix',
    notes: [
      'Enemy health now scales exponentially instead of additively, matching the way player damage compounds. Strong builds no longer become unkillable.',
      'Balance sim gained a --sweep mode and hard invariant assertions.',
    ],
  },
  {
    v: 'v0.5', title: 'Soundtrack',
    notes: [
      'Added a generative soundtrack — a four-bar minor progression whose layers build as the run intensifies. No audio files.',
      'Results screen now shows your final build, Mothership kills and evolutions.',
    ],
  },
  {
    v: 'v0.4', title: 'Elite Modifiers',
    notes: [
      'Elites past 100s now carry a modifier: Splitter, Volley or Haste, each shown as a coloured dashed ring.',
      'Fixed a late-game frame spike caused by missile volleys re-sorting every enemy on screen.',
    ],
  },
  {
    v: 'v0.3', title: 'Weapon Evolutions',
    notes: [
      'Max a weapon and take its paired stat to unlock an evolution: Starbreaker, Hive, Prism Storm, Singularity or Bladestorm.',
      'Fixed enemies being killed twice in a single frame, which double-counted kills, XP and drops.',
    ],
  },
  {
    v: 'v0.2', title: 'Elites & Items',
    notes: [
      'Added elites, item drops, and screen-edge markers for off-screen threats.',
      'Missiles and beams now prioritise the Mothership, which previously could never be killed.',
    ],
  },
  { v: 'v0.1', title: 'First Playable', notes: ['Initial release: 5 weapons, 6 enemy types, Mothership boss.'] },
];
