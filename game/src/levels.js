// The eight levels, hand-drawn as text. Each row is 12 characters, one per brick column:
//   '.' empty          'o' a normal brick (1 hit)
//   '2' a hard brick (2 hits)   '3' a tough brick (3 hits)
//   'X' an unbreakable brick    'B' a bonus brick (always drops a power-up)
//   'v' a drifting brick (2 hits, slides sideways — time your shot)
//   'K' a boss brick (5 hits, worth 500, drops two power-ups when it falls)
// A level is won when every breakable brick is gone; unbreakable bricks never have to break.
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
];
