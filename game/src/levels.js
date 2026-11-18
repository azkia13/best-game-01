// The twelve levels, hand-drawn as text. Each row is 12 characters, one per brick column:
//   '.' empty          'o' a normal brick (1 hit)
//   '2' a hard brick (2 hits)   '3' a tough brick (3 hits)
//   'X' an unbreakable brick    'B' a bonus brick (always drops a power-up)
//   'v' a drifting brick (2 hits, slides sideways — time your shot)
//   'K' a boss brick (5 hits, worth 500, drops two power-ups when it falls)
//   's' a sinking brick (2 hits, sinks toward the paddle — break it before it lands)
//   'e' an explosive brick (1 hit — blows up and damages every brick touching it)
// A level may also field drones (moving enemies, `drones`) or a boss (`boss: true`).
// A boss level may override the fight: `bossHp` and `bossFire` (seconds between volleys).
// A level is won when every breakable brick is gone (and the boss is dead, where there is
// one); unbreakable bricks never have to break.
// The layouts are data, not code: the world builds its bricks from them.
export const LEVELS = [
  {
    name: 'First Contact',
    tip: 'Break every coloured brick. Catch the falling capsules.',
    rows: [
      '..oooooooo..',
      '.oooooooooo.',
      'oooooooooooo',
    ],
  },
  {
    name: 'The Wall',
    tip: 'Steel corners never break — go around them.',
    rows: [
      'XXooooooooXX',
      'XooooooooooX',
      'oooooooooooo',
      '.22oooooo22.',
    ],
  },
  {
    name: 'Checkerboard',
    tip: 'Gold bricks always drop a power-up. Grab it.',
    rows: [
      'oXoXoXoXoXoX',
      'oooooooooooo',
      'XoXoXoXoXoXo',
      '.oBooooooBo.',
      '..22222222..',
    ],
  },
  {
    name: 'The Fortress',
    tip: 'The gold vault is behind steel. Crack the floor first.',
    rows: [
      '....XXXX....',
      '..XXXXXXXX..',
      '.XXooooooXX.',
      '.XXoBBBBBXX.',
      '222oooooo222',
    ],
  },
  {
    name: 'Rainbow Ridge',
    tip: 'Sixty-eight bricks. The ball only gets faster.',
    rows: [
      'oooooooooooo',
      '222222222222',
      'oooooooooooo',
      '.3oooooooo3.',
      'oooooooooooo',
      '..oooooooo..',
    ],
  },
  {
    name: 'Final Gauntlet',
    tip: 'Everything you have learned, at once. The steel has a door — use it.',
    rows: [
      'XooooooooooX',
      '2XooooooooX2',
      '22oooooooo22',
      '.3ooBBBBoo3.',
      'oooooooooooo',
      '.XXXX..XXXX.',
      '..22222222..',
    ],
  },
  {
    name: 'Neon Drift',
    tip: 'The blue bricks slide sideways — lead your shot, don\'t chase it.',
    rows: [
      '..vvvvvvvv..',
      '.vvvvvvvvvv.',
      'vvvvvvvvvvvv',
      'oooooooooooo',
      '.oBooooooBo.',
      '..22222222..',
    ],
  },
  {
    name: 'The Core',
    tip: 'Boss bricks take five hits and pay 500 each. Crack the core.',
    rows: [
      '...KKKKKK...',
      '..KooooooK..',
      '.oooooooooo.',
      '.ovvvvvvvvo.',
      '222oBBBBo222',
      'oooooooooooo',
    ],
  },
  {
    name: 'Drone Yard',
    tip: 'Drones patrol the field — smash them for 200 points and 3 shards each.',
    drones: 4,
    rows: [
      '..oooooooo..',
      '.ovvvvvvvvo.',
      'oooooooooooo',
      '.oBooooooBo.',
      '..22222222..',
    ],
  },
  {
    name: 'Sinking City',
    tip: 'The grey bricks sink toward your paddle — break them before they land, or lose a life.',
    rows: [
      'ssssssssssss',
      'oooooooooooo',
      '.o2oooooo2o.',
      'oooooooooooo',
      '..oBBBBBBo..',
    ],
  },
  {
    name: 'Crossfire',
    tip: 'Drones, sinkers and drifters at once. Spend your shards in the shop.',
    drones: 5,
    rows: [
      '..vvvvvvvv..',
      '.ssssssssss.',
      'oooooooooooo',
      '2ovvvvvvvvo2',
      '.oBssssssBo.',
      '..22222222..',
    ],
  },
  {
    name: 'The Core Awakens',
    tip: 'THE BOSS: hit the Core 14 times. Its fire stuns your paddle narrow — dodge it, or smash it with the ball.',
    boss: true,
    drones: 2,
    rows: [
      '............',
      '..oooooooo..',
      '.oKKooooKKo.',
      'oooooooooooo',
      '..22222222..',
    ],
  },
  {
    name: 'Chain Reaction',
    tip: 'Orange bricks explode and take their neighbours with them — set off a chain.',
    rows: [
      '..eeeeeeee..',
      '.eooooooooe.',
      'oeooeooeoooo',
      'oooooooooooo',
      '.oBeeeeeeBo.',
      '..22222222..',
    ],
  },
  {
    name: 'Neon Storm',
    tip: 'Everything at once: drifters, sinkers, drones and explosives. Spend your shards.',
    drones: 5,
    rows: [
      '..vvvvvvvv..',
      '.esssssssse.',
      'oeoevvvvvoeo',
      'oooooooooooo',
      '2oeoBBBBBeo2',
      '..22222222..',
    ],
  },
  {
    name: 'The Final Core',
    tip: 'THE FINAL BOSS: the Core returns with 18 hits and faster fire. Break its explosive guard first.',
    boss: true,
    bossHp: 18,
    bossFire: 2.8,
    drones: 3,
    rows: [
      '............',
      '..eeeeeeee..',
      '.eKKooooKKe.',
      'oooooooooooo',
      '.o2eooooe2o.',
      '..22222222..',
    ],
  },
];
