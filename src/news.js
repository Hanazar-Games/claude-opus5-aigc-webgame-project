/** Version + patch notes. `NEWS[0]` is the current announcement; the rest is history. */
export const VERSION = 'v0.8';

export const NEWS = [
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
