// Neon Breaker tuning: every number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. Nothing here draws or listens: it is only numbers.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PADDLE = {
  width: 112,
  height: 16,
  y: 662,
  speed: 760,
  wide: 168,
  narrow: 72,
  laserWidth: 92,
};

export const BALL = {
  radius: 8,
  speed: 540,
  maxSpeed: 980,
  speedPerLevel: 34,
  minUpward: 0.35,
};

export const LIVES = 3;
export const MAX_LIVES = 5;

/** Brick grid geometry: 12 columns, centred with a margin on each side. */
export const BRICK = {
  cols: 12,
  width: 94,
  height: 26,
  gapX: 6,
  gapY: 8,
  top: 78,
  left: 43,
};

/** Combo: every COMBO.perStep bricks broken without losing a ball raises the multiplier by one. */
export const COMBO = { perStep: 8, maxMult: 5 };

export const POWERUP = {
  fallSpeed: 210,
  dropChance: 0.12,
  width: 36,
  height: 18,
};

/** Points for one brick, before the combo multiplier; clearing a level pays a bonus per life left. */
export const SCORE = { brick: 50, hard: 80, tough: 120, bonus: 150, levelBonus: 500 };

/** How long each timed effect lasts, in seconds. */
export const DURATION = { wide: 14, narrow: 10, laser: 12, slow: 9, fast: 8, catch: 14 };

/** Seconds the ball waits stuck to the paddle before the autopilot serves it in a screenshot. */
export const SERVE_WAIT = 0.6;

export const PALETTE = {
  backdrop: '#070a14',
  backdropTop: '#0d1530',
  grid: '#141c36',
  ground: '#0a0f1e',
  text: '#eef2ff',
  muted: '#8b93b8',
  gold: '#f2c94c',
  paddle: '#22d3ee',
  paddleLaser: '#ff5d8f',
  ball: '#ffffff',
  ballTrail: '#22d3ee',
  unbreakable: '#7d8598',
  unbreakableDark: '#565e73',
  panel: '#10182e',
  panelEdge: '#2a3a5f',
  danger: '#ff5470',
  // One colour per brick row, top row first.
  rows: ['#ff2d78', '#ff8a00', '#ffd60a', '#3ddc84', '#22d3ee', '#a855f7', '#ff5d8f'],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-breaker.best';
export const MUTE_KEY = 'neon-breaker.muted';
