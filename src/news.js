/** Version + patch notes. `NEWS[0]` is the current announcement; the rest is history. */
export const VERSION = 'v1.7';

export const NEWS = [
  {
    v: 'v1.7', title: 'The Mix',
    notes: [
      '<b>The sound was a wash.</b> Measured across a full run: 83 sound effects requested per second, 71 of them getting through, and a single frame asking for 305. Those thresholds were set when the game killed about six things a second — it now kills thirty, collects thirty pieces of stardust and lands sixteen hits. Seventy-one overlapping voices a second is not sound design, it buries the soundtrack under its own combat. Down to 26, and the ones that do play are bigger: a kill sound now deepens and lengthens with the size of the wipe it is standing in for.',
      'Fixed a latent one: every spatial query in the game shared a single scratch buffer, and the bullet-collision loop iterates that buffer while a blast-on-impact re-enters the same query from inside it. Today a <code>break</code> lands one line later and saves it — safety by luck. Blasts have their own buffer now.',
      'Removed a branch that could not run, and the comment above it that described what it was supposed to do: the Devourer was exempted from the on-screen firing rule through a code path it never takes, because it has no ordinary weapon at all. It fires from its own routine, which is ungated on purpose — it is the arena.',
      'Checked and found healthy, having never been measured before: the touch stick (a second finger cannot steal it, lifting the other finger does not release it, and drags past the edge clamp cleanly), and the opening pace — the first upgrade lands at 11.6 seconds and the gun is a maxed nine-pellet spread by 28.7.',
    ],
  },
  {
    v: 'v1.6', title: 'Shipping It',
    notes: [
      '<b>Deployment is fixed.</b> Every CI failure this project has ever had was a win-rate gate — "8.3% below 12%", "45.8% above 45%" — and not one was a real defect. Win rate is a statistical measurement of a chaotic system, and <code>Math.hypot</code> is not bit-identical across engines: v1.4 measured 34.4% on the development machine and 8.3% on the build runner, from the same seeds. Releases are now gated on <b>invariants</b> instead — bosses killed never exceed bosses spawned, no stat is ever a non-finite number, no run fails to end — which are true on any machine. The pipeline went from 21 minutes to 6, and can no longer block the site over a coin flip.',
      'Fixed: last release said enemies no longer shoot from off screen. Half of them still did. The Volley modifier had no range check at all, Motherships were exempted outright, and the check itself was a <em>circle</em> measured against a <em>rectangular</em> screen — on a 900×620 window the radius reached 468px against a 310px half-height, so everything above and below kept firing blind. Measured now: 0.2% of shots before the final boss are fired from outside the view, against 51.9% before.',
      'The Devourer still fires from anywhere, on purpose. It is the arena; running out of sight of it should not be free.',
      'Fixed: the particle pool reached 5,513 live pieces at the new kill rate. It is capped now — except for your own death, which is the one explosion that should never be swallowed by a budget.',
      'Nanorepair was quietly a dead card: +0.7 health per second on top of a base of 5 is +14%. It is +2 now.',
    ],
  },
  {
    v: 'v1.5', title: 'What the Horde Broke',
    notes: [
      'v1.4 multiplied the number of enemies by about ten. Three separate systems were tuned as a <em>percentage of each spawn</em> and quietly became firehoses. This release is about finding them.',
      '<b>Elites were rolled per spawn</b>, so ten times the chaff meant ten times the elites — and elites are what drop items. Measured: <b>thirty Orbital Strikes a minute</b>, one screen-clearing explosion every two seconds, and forty-nine heal pickups a minute. An item that arrives every two seconds is not a power spike, it is weather. Elites now arrive on their own clock, about two Orbital Strikes a minute.',
      'That healing was also, accidentally, the entire difficulty balance — roughly 3,300 health a minute against about 12 a second of incoming damage. It has been replaced with <b>steady regeneration</b>: the same sustain, made intentional, quiet and tunable, and visible in the pause menu.',
      '<b>Enemies no longer shoot you from off screen.</b> 94% of all damage the player took was bullets, most of them fired by something they could not see. Shooters now need to be on screen — and never further than 520px, so a bigger monitor does not mean more incoming fire.',
      'Act III leaned on ranged attackers by design, but those weights were written for a dozen enemies on screen. At forty, a third of the field shooting is a solid wall, so the shooter share is much smaller and the horde carries the pressure instead.',
      'Fixed in the balance harness itself, which matters more than any of the above: <b>the bot could not see bullets.</b> Its threat field contained enemies only. That was survivable while bullets were a minor damage source; once they were 94% of it, the instrument every balance decision in this project rests on was measuring a player who walks straight through gunfire. It dodges now.',
      'Tuned around the honest numbers: Recruit clears about 3 runs in 5, Veteran about 2 in 5, Nightmare about 1 in 16.',
    ],
  },
  {
    v: 'v1.4', title: 'The Gun',
    notes: [
      '<b>Your gun becomes a shotgun.</b> The Pulse Gun fires one bolt at Lv.1, a <b>five-pellet spread</b> at Lv.2, seven at Lv.3, and nine that punch through at Lv.4. The first upgrade you are ever offered nearly quadruples its damage, and you can see the spread widen every time.',
      'Its evolution is now the <b>Flak Cannon</b>: fourteen pellets in a wall, with enough force behind them to shove a crowd backwards. It replaces Starbreaker, which was a single-beam railgun on the end of what is now a shotgun.',
      'The first six levels offer <b>weapons only</b> — no stat cards while the gun is still growing. Levelling the weapon in your hands is weighted far above picking up a second one, so the opening is about one thing.',
      '<b>Far more enemies.</b> The horde starts arriving a minute in and builds from there: about 27 on screen in the mid-game against 12 before, and roughly 26,000 kills in a full run against 5,000. Runs are still the same length — the enemies are many, weak and individually far less dangerous.',
      'You start with 170 health instead of 120, and the density ramp holds off for the first minute, so the opening is for learning what the gun does rather than dying to a crowd.',
      'Fixed, and caused by the change above: at fifty enemies on screen <b>the player was genuinely hard to find</b> — a small neon triangle among a hundred other neon shapes, fading to a third opacity during invulnerability frames. The ship now sits in a cut-out disc and never fades below half.',
      'Fewer, weightier level-ups: a full run is about 39 now rather than 45+, so there is less time in menus and more in the fight.',
    ],
  },
  {
    v: 'v1.3', title: 'Signal Clarity',
    notes: [
      'Fixed: whenever the main thread stalled — a long garbage collection, a slow phone, a heavy first frame — the soundtrack fired <b>the entire arrangement at once</b> as a single blast. Notes are scheduled ahead of the audio clock, and the catch-up loop replayed every missed step at a time already in the past, which WebAudio plays immediately. Measured after a 2s stall: seven steps scheduled, six of them up to 1.6s overdue. The scheduler now skips the gap instead of replaying it.',
      'Fixed: on the title screen, moving to a difficulty with the keyboard and pressing Space both picked the tier <em>and</em> started the run.',
      'The pause menu now shows what your run has actually become — damage, fire rate, crit, area, range, speed, armour, regen, magnet and XP as real totals. Six versions of stacking percentages and the game never told you the sum, so you could keep taking Weak Point Analysis long after crit was capped and nothing would say so.',
      'The results screen says which act you died in. "04:10" alone does not tell you how far you got.',
      'The Devourer announces its phases. Two thresholds decide that fight and both used to pass in silence.',
      'A derelict drifting away unstripped now has a sound, not just a small grey word on the far side of the screen.',
      'Saved progress is validated rather than trusted: a half-written or hand-edited entry used to throw straight out of start-up and leave nothing on screen at all.',
      'Checked and left alone: rendering. It has never been measured in this project, so it was — 0.6ms for a worst-case frame of 216 enemies, 950 particles, 222 shots and 122 damage numbers at 1920×1080. There was nothing to fix.',
    ],
  },
  {
    v: 'v1.2', title: 'Audit',
    notes: [
      'Fixed a <b>hard freeze</b>. Answering a level-up or a salvage draw closed the panel — including a panel the game had just opened for the next queued offer. The result was a modal game state with nothing on screen: the loop will not step, pause is disabled during a modal, and the only way out was a reload. It was reachable exactly when the v1.1 offer queue did its job, which is to say whenever a derelict finished on the same frame as a level-up.',
      'Fixed: enemy <b>bullet</b> damage never used the difficulty multiplier. Contact damage did, health did, but every Spitter, Mothership and Volley shot in the game fired at the same strength on all three tiers — and the late game is almost entirely bullets. Recruit was not softer where it counted and Nightmare was not harder.',
      'Fixed: ranged damage also ignored the rule that time-based scaling <em>stops</em> when the Devourer arrives. Health and contact damage froze; bullets kept climbing off the raw clock, so stalling the last fight really did make the chaff unsurvivable on its own — the exact thing the freeze was written to prevent.',
      'Modules are no longer invisible once taken. They sit next to your weapons in the HUD, the salvage draw shows what you already have installed, and the results screen lists them.',
      'The music finally answers the tensest seconds in the run: the arrangement holds up while you are stripping a wreck.',
      'The soundtrack no longer rings on underneath the death sting or the victory fanfare — notes are scheduled ahead of the clock, and stopping only stopped the scheduler.',
      'A run started straight after dying in the final fight no longer opens on a bar of full-intensity music.',
      'Balance follows the difficulty fix: Recruit clears about 2 runs in 3, Veteran 1 in 3, Nightmare 1 in 5.',
    ],
  },
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
