// The game's rules and state, with no drawing and no browser in it: the paddle, the balls,
// the bricks of one level, falling power-ups, laser bullets, particles and floating score
// text. step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sound, announcements) without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns, except the short particle lists.
import { BALL, BOSS, BRICK, COMBO, DRONE, DURATION, ENDLESS, FIELD, LIVES, MAX_LIVES, PADDLE, PALETTE, POWERUP, SCORE, SHARDS, SINKER, UPGRADES } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_BRICK = 1;
export const EVENT_CRACK = 2;
export const EVENT_STEEL = 4;
export const EVENT_POWERUP = 8;
export const EVENT_BAD = 16;
export const EVENT_LIFE_LOST = 32;
export const EVENT_LEVEL_CLEAR = 64;
export const EVENT_WIN = 128;
export const EVENT_OVER = 256;
export const EVENT_LAUNCH = 512;
export const EVENT_LASER = 1024;
export const EVENT_BOSS = 2048;
export const EVENT_DRONE = 4096;
export const EVENT_BOSS_HIT = 8192;
export const EVENT_SHARD = 16384;
export const EVENT_SHIELD_SAVE = 32768;
export const EVENT_SINKER_LAND = 65536;
export const EVENT_BOSS_DEAD = 131072;
export const EVENT_STUN = 262144;

export const KIND_NORMAL = 0;
export const KIND_HARD = 1;
export const KIND_TOUGH = 2;
export const KIND_STEEL = 3;
export const KIND_BONUS = 4;
export const KIND_MOVING = 5;
export const KIND_BOSS = 6;
export const KIND_SINKER = 7;

/** The capsule letters, what they do, and whether catching one is good news. */
export const POWERUP_INFO = {
  W: { label: 'Wide paddle', good: true, color: '#22d3ee' },
  M: { label: 'Multiball', good: true, color: '#ff2d78' },
  L: { label: 'Laser paddle', good: true, color: '#ff5d8f' },
  S: { label: 'Slow ball', good: true, color: '#3ddc84' },
  E: { label: 'Extra life', good: true, color: '#f2c94c' },
  C: { label: 'Catch', good: true, color: '#a855f7' },
  G: { label: 'Ghost ball', good: true, color: '#7dd3fc' },
  N: { label: 'Narrow paddle', good: false, color: '#8b93b8' },
  F: { label: 'Fast ball', good: false, color: '#ff8a00' },
};
const POWERUP_KEYS = ['W', 'M', 'L', 'S', 'E', 'C', 'G', 'N', 'F'];
/** How often each capsule is the one that drops, out of 100. */
const POWERUP_WEIGHTS = { W: 18, M: 16, L: 14, S: 12, E: 6, C: 12, G: 10, N: 6, F: 6 };

const MAX_PARTICLES = 400;
const LASER_COOLDOWN = 0.18;
const BULLET_SPEED = 900;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createWorld(random) {
  const paddle = { x: 0, width: PADDLE.width, targetWidth: PADDLE.width, laser: 0, catch: 0, wide: 0, narrow: 0 };
  const balls = [];
  const bricks = [];
  const powerups = [];
  const bullets = [];
  const particles = [];
  const floaters = [];
  const enemies = [];
  const projectiles = [];
  const state = {
    paddle, balls, bricks, powerups, bullets, particles, floaters, enemies, projectiles,
    score: 0, combo: 0, mult: 1, lives: LIVES, level: 0,
    bricksLeft: 0, elapsed: 0, shake: 0, slow: 0, fast: 0, pierce: 0, hurtTimer: 0,
    laserCooldown: 0, serveTimer: 0, levelCleared: false, won: false, lastBonus: 0,
    shards: 0, upgrades: { wide: 0, magnet: 0, laser: 0, shield: 0, life: 0 },
    shieldReady: false, endless: false, wave: 0, boss: null, bossDead: false,
    dronesToSpawn: 0, droneTimer: 0,
  };

  /** The paddle's resting width, grown forever by Wide Paddle+ upgrades. */
  function baseWidth() {
    return PADDLE.width + 20 * state.upgrades.wide;
  }

  /** Spend shards on a shop upgrade; returns true when the purchase lands. */
  function buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    if (state.upgrades[id] >= def.max) return false;
    if (state.shards < def.cost) return false;
    state.shards -= def.cost;
    state.upgrades[id] += 1;
    if (id === 'wide') {
      paddle.targetWidth = baseWidth();
      paddle.width = baseWidth();
    } else if (id === 'shield') {
      state.shieldReady = true;
    } else if (id === 'life') {
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
    }
    return true;
  }

  function brickPoints(kind) {
    if (kind === KIND_HARD) return SCORE.hard;
    if (kind === KIND_TOUGH) return SCORE.tough;
    if (kind === KIND_BONUS) return SCORE.bonus;
    if (kind === KIND_BOSS) return SCORE.boss;
    if (kind === KIND_SINKER) return SCORE.tough;
    return SCORE.brick;
  }

  function earnShards(amount, x, y) {
    if (amount <= 0) return 0;
    state.shards += amount;
    floater(x, y, `◆+${amount}`, PALETTE.gold);
    return EVENT_SHARD;
  }

  function loadLevelData(level, index) {
    bricks.length = 0;
    powerups.length = 0;
    bullets.length = 0;
    particles.length = 0;
    balls.length = 0;
    enemies.length = 0;
    projectiles.length = 0;
    state.level = index;
    state.bricksLeft = 0;
    state.levelCleared = false;
    state.elapsed = 0;
    state.slow = 0;
    state.fast = 0;
    state.pierce = 0;
    state.hurtTimer = 0;
    state.boss = null;
    state.bossDead = false;
    state.dronesToSpawn = level.drones ?? 0;
    state.droneTimer = 3;
    paddle.width = baseWidth();
    paddle.targetWidth = baseWidth();
    paddle.laser = 0;
    paddle.catch = 0;
    paddle.wide = 0;
    paddle.narrow = 0;
    if (state.upgrades.shield > 0) state.shieldReady = true;
    for (let row = 0; row < level.rows.length; row += 1) {
      const line = level.rows[row];
      for (let col = 0; col < line.length; col += 1) {
        const cell = line[col];
        if (cell === '.') continue;
        const kind = cell === '2' ? KIND_HARD : cell === '3' ? KIND_TOUGH : cell === 'X' ? KIND_STEEL : cell === 'B' ? KIND_BONUS : cell === 'v' ? KIND_MOVING : cell === 'K' ? KIND_BOSS : cell === 's' ? KIND_SINKER : KIND_NORMAL;
        const hp = kind === KIND_HARD ? 2 : kind === KIND_TOUGH ? 3 : kind === KIND_MOVING ? 2 : kind === KIND_BOSS ? 5 : kind === KIND_SINKER ? 2 : 1;
        const bx = BRICK.left + col * (BRICK.width + BRICK.gapX);
        const brick = {
          x: bx, y: BRICK.top + row * (BRICK.height + BRICK.gapY),
          width: BRICK.width, height: BRICK.height,
          hp, maxHp: hp, kind, row,
          color: kind === KIND_STEEL ? PALETTE.unbreakable : kind === KIND_BONUS ? PALETTE.gold : kind === KIND_MOVING ? PALETTE.moving : kind === KIND_BOSS ? PALETTE.boss : kind === KIND_SINKER ? '#9aa3b8' : PALETTE.rows[row % PALETTE.rows.length],
          alive: true,
        };
        if (kind === KIND_MOVING) {
          // Drifting bricks slide sideways around their home column, each on its own phase.
          brick.baseX = bx;
          brick.range = 58;
          brick.speed = 0.7 + (row % 3) * 0.22;
          brick.phase = (col * 0.9 + row * 1.7) % (Math.PI * 2);
        }
        bricks.push(brick);
        if (kind !== KIND_STEEL) state.bricksLeft += 1;
      }
    }
    if (level.boss) {
      state.boss = {
        x: FIELD.width / 2, y: BOSS.y, hp: BOSS.hp, maxHp: BOSS.hp,
        fireTimer: BOSS.fireInterval, spawnTimer: BOSS.spawnInterval,
      };
    }
    paddle.x = (FIELD.width - paddle.width) / 2;
    serveBall();
  }

  function loadLevel(index) {
    loadLevelData(LEVELS[index], index);
  }

  /** An endless wave, drawn from the seed: rows grow with the wave, bosses every 5th. */
  function generateWave(n) {
    const rows = Math.min(ENDLESS.maxRows, ENDLESS.baseRows + Math.floor(n / 2));
    const lines = [];
    const letters = ['o', 'o', 'o', '2', '3', 'B', 'v', 's'];
    for (let row = 0; row < rows; row += 1) {
      let line = '';
      for (let col = 0; col < BRICK.cols; col += 1) {
        const roll = random();
        if (roll < 0.12) line += '.';
        else if (row === 0 && roll < 0.2) line += 'X';
        else line += letters[Math.floor(random() * letters.length)];
      }
      lines.push(line);
    }
    // A wave must always have something breakable.
    if (!lines.some((line) => /[o23Bvs]/.test(line))) lines[0] = 'oooooooooooo';
    return {
      name: `Wave ${n}`,
      tip: n % ENDLESS.bossEvery === 0 ? 'A boss guards this wave.' : 'The waves never stop. How far can you go?',
      rows: lines,
      drones: Math.min(2 + n, 6),
      boss: n % ENDLESS.bossEvery === 0,
    };
  }

  function loadWave(n) {
    state.endless = true;
    state.wave = n;
    const level = generateWave(n);
    loadLevelData(level, LEVELS.length - 1);
    if (state.boss) {
      state.boss.hp = BOSS.hp + BOSS.hpPerWave * Math.floor(n / ENDLESS.bossEvery);
      state.boss.maxHp = state.boss.hp;
    }
  }

  function startEndless() {
    state.score = 0;
    state.combo = 0;
    state.mult = 1;
    state.lives = LIVES;
    state.won = false;
    state.shake = 0;
    state.shards = 0;
    state.upgrades = { wide: 0, magnet: 0, laser: 0, shield: 0, life: 0 };
    state.shieldReady = false;
    state.endless = true;
    floaters.length = 0;
    loadWave(1);
  }

  function reset() {
    state.score = 0;
    state.combo = 0;
    state.mult = 1;
    state.lives = LIVES;
    state.won = false;
    state.shake = 0;
    state.shards = 0;
    state.upgrades = { wide: 0, magnet: 0, laser: 0, shield: 0, life: 0 };
    state.shieldReady = false;
    state.endless = false;
    state.wave = 0;
    floaters.length = 0;
    loadLevel(0);
  }

  function ballSpeed() {
    const base = BALL.speed + state.level * BALL.speedPerLevel;
    if (state.slow > 0) return base * 0.72;
    if (state.fast > 0) return base * 1.3;
    return base;
  }

  function serveBall() {
    const speed = ballSpeed();
    balls.push({
      x: paddle.x + paddle.width / 2, y: PADDLE.y - BALL.radius - 1,
      vx: 0, vy: 0, speed, stuck: true,
    });
    state.serveTimer = 0;
  }

  function launchBall(ball) {
    const speed = ballSpeed();
    const angle = (random() * 0.7 - 0.35) * Math.PI;
    ball.vx = Math.sin(angle) * speed * 0.6;
    ball.vy = -Math.cos(angle) * speed;
    ball.stuck = false;
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i += 1) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const angle = random() * Math.PI * 2;
      const speed = (0.3 + random() * 0.7) * power;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60,
        life: 0.45 + random() * 0.35, maxLife: 0.8,
        color, size: 3 + random() * 4,
      });
    }
  }

  function floater(x, y, text, color) {
    floaters.push({ x, y, text, life: 0.9, color });
  }

  function dropPowerup(x, y, force) {
    let roll = random();
    if (!force && roll > POWERUP.dropChance) return;
    let pick = random() * 100;
    let type = 'W';
    for (const key of POWERUP_KEYS) {
      pick -= POWERUP_WEIGHTS[key];
      if (pick <= 0) {
        type = key;
        break;
      }
    }
    powerups.push({ x: x - POWERUP.width / 2, y, width: POWERUP.width, height: POWERUP.height, vy: POWERUP.fallSpeed, type });
  }

  function applyPowerup(type) {
    const info = POWERUP_INFO[type];
    if (type === 'W') {
      paddle.targetWidth = PADDLE.wide;
      paddle.wide = DURATION.wide;
      paddle.narrow = 0;
    } else if (type === 'N') {
      paddle.targetWidth = PADDLE.narrow;
      paddle.narrow = DURATION.narrow;
      paddle.wide = 0;
    } else if (type === 'M') {
      const source = balls.find((ball) => !ball.stuck) ?? balls[0];
      if (source) {
        for (const angle of [-0.6, 0.6]) {
          if (balls.length >= 5) break;
          const speed = ballSpeed();
          const base = Math.atan2(source.vy, source.vx) + angle;
          balls.push({ x: source.x, y: source.y, vx: Math.cos(base) * speed, vy: Math.sin(base) * speed, speed, stuck: false });
        }
      }
    } else if (type === 'L') {
      paddle.laser = DURATION.laser + 6 * state.upgrades.laser;
    } else if (type === 'S') {
      state.slow = DURATION.slow;
      state.fast = 0;
    } else if (type === 'F') {
      state.fast = DURATION.fast;
      state.slow = 0;
    } else if (type === 'E') {
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
    } else if (type === 'C') {
      paddle.catch = DURATION.catch;
    } else if (type === 'G') {
      state.pierce = DURATION.pierce;
    }
    return info.good ? EVENT_POWERUP : EVENT_BAD;
  }

  /** Lose one life; returns EVENT_LIFE_LOST, plus EVENT_OVER when that was the last.
   * A hit starts 1.2 s of hurt protection, so one volley or one landing row can
   * never take more than one life: the second hit inside the window costs nothing. */
  function loseLife() {
    if (state.hurtTimer > 0) return 0;
    state.hurtTimer = 1.2;
    state.lives -= 1;
    state.combo = 0;
    state.mult = 1;
    state.shake = 16;
    if (state.lives <= 0) return EVENT_LIFE_LOST | EVENT_OVER;
    return EVENT_LIFE_LOST;
  }

  /** The level (or wave) is done when no breakable brick stands and no boss lives. */
  function maybeClear() {
    if (state.bricksLeft !== 0 || state.levelCleared) return 0;
    if (state.boss && !state.bossDead) return 0;
    state.levelCleared = true;
    const bonus = SCORE.levelBonus * state.lives;
    state.lastBonus = bonus;
    state.score += bonus;
    floater(FIELD.width / 2, FIELD.height / 2 - 40, `LEVEL BONUS +${bonus}`, PALETTE.gold);
    if (!state.endless && state.level === LEVELS.length - 1) {
      state.won = true;
      return EVENT_WIN;
    }
    return EVENT_LEVEL_CLEAR;
  }

  /** Damage one brick by one hit; returns the events it caused. */
  function damageBrick(brick) {
    let events = 0;
    if (brick.kind === KIND_STEEL) {
      burst(brick.x + brick.width / 2, brick.y + brick.height / 2, PALETTE.unbreakable, 4, 140);
      return EVENT_STEEL;
    }
    brick.hp -= 1;
    if (brick.hp > 0) {
      burst(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 5, 160);
      return EVENT_CRACK;
    }
    brick.alive = false;
    state.bricksLeft -= 1;
    state.combo += 1;
    state.mult = Math.min(COMBO.maxMult, 1 + Math.floor(state.combo / COMBO.perStep));
    const points = brickPoints(brick.kind) * state.mult;
    state.score += points;
    burst(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, brick.kind === KIND_BOSS ? 30 : 12, brick.kind === KIND_BOSS ? 420 : 260);
    floater(brick.x + brick.width / 2, brick.y, `+${points}`, brick.color);
    events |= EVENT_BRICK;
    if (brick.kind === KIND_BOSS) {
      // A boss pays twice: two capsules, a shake, shards and its own sound.
      state.shake = 12;
      events |= earnShards(SHARDS.boss, brick.x + brick.width / 2, brick.y + brick.height + 18);
      dropPowerup(brick.x + brick.width / 2 - 20, brick.y + brick.height, true);
      dropPowerup(brick.x + brick.width / 2 + 20, brick.y + brick.height, true);
      events |= EVENT_BOSS;
    } else if (brick.kind === KIND_BONUS) {
      events |= earnShards(SHARDS.bonus, brick.x + brick.width / 2, brick.y + brick.height + 18);
      dropPowerup(brick.x + brick.width / 2, brick.y + brick.height, true);
    } else dropPowerup(brick.x + brick.width / 2, brick.y + brick.height, false);
    events |= maybeClear();
    return events;
  }

  /** One hit on the boss: a bounce, points, and — at zero — the fight is over. */
  function damageBoss(ball) {
    const boss = state.boss;
    if (!boss || state.bossDead) return 0;
    boss.hp -= 1;
    state.score += SCORE.bossHit;
    state.shake = Math.max(state.shake, 6);
    burst(ball.x, ball.y, '#ff5470', 10, 240);
    floater(boss.x, boss.y + BOSS.radius + 12, `+${SCORE.bossHit}`, '#ff8ba0');
    if (boss.hp > 0) return EVENT_BOSS_HIT;
    state.bossDead = true;
    state.boss = null;
    state.score += 1000;
    state.shake = 18;
    burst(FIELD.width / 2, BOSS.y, '#ff5470', 60, 520);
    burst(FIELD.width / 2, BOSS.y, '#ffd60a', 40, 420);
    floater(FIELD.width / 2, BOSS.y + 70, 'BOSS DOWN! +1000', PALETTE.gold);
    let events = EVENT_BOSS_DEAD | EVENT_BOSS;
    events |= earnShards(10, FIELD.width / 2, BOSS.y + 100);
    events |= maybeClear();
    return events;
  }

  /** A drone falls to the ball or a laser: points, shards, sometimes a capsule. */
  function destroyDrone(index) {
    const drone = enemies[index];
    enemies.splice(index, 1);
    state.combo += 1;
    state.mult = Math.min(COMBO.maxMult, 1 + Math.floor(state.combo / COMBO.perStep));
    const points = SCORE.drone * state.mult;
    state.score += points;
    burst(drone.x, drone.y, '#c084fc', 16, 300);
    floater(drone.x, drone.y, `+${points}`, '#c084fc');
    let events = EVENT_DRONE | EVENT_BRICK;
    events |= earnShards(SHARDS.drone, drone.x, drone.y + 20);
    if (random() < 0.5) dropPowerup(drone.x, drone.y, true);
    return events;
  }

  function fireLaser() {
    if (paddle.laser <= 0 || state.laserCooldown > 0) return 0;
    state.laserCooldown = LASER_COOLDOWN / (state.upgrades.laser > 0 ? 2 : 1);
    const y = PADDLE.y - 6;
    bullets.push({ x: paddle.x + 8, y, width: 4, height: 14, vy: -BULLET_SPEED });
    bullets.push({ x: paddle.x + paddle.width - 12, y, width: 4, height: 14, vy: -BULLET_SPEED });
    return EVENT_LASER;
  }

  function stepBall(ball, dt, demo) {
    const speed = ballSpeed();
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Walls.
    if (ball.x - BALL.radius < 0) {
      ball.x = BALL.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + BALL.radius > FIELD.width) {
      ball.x = FIELD.width - BALL.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - BALL.radius < 0) {
      ball.y = BALL.radius;
      ball.vy = Math.abs(ball.vy);
    }
    // The floor: in the demo the ball bounces, in play it is lost.
    if (ball.y + BALL.radius > FIELD.height) {
      if (demo) {
        ball.y = FIELD.height - BALL.radius;
        ball.vy = -Math.abs(ball.vy);
      }
      return 'lost';
    }
    // Keep the speed honest and the angle away from flat: a ball that rolls along a wall
    // forever is a boring ball, and a flat angle stalls the screenshot autopilot.
    const len = Math.hypot(ball.vx, ball.vy);
    if (len > 0) {
      let nx = (ball.vx / len) * speed;
      let ny = (ball.vy / len) * speed;
      if (Math.abs(ny) < speed * 0.25) {
        ny = (ny < 0 ? -1 : 1) * speed * 0.25;
        const scale = speed / Math.hypot(nx, ny);
        nx *= scale;
        ny *= scale;
      }
      ball.vx = nx;
      ball.vy = ny;
    }
    return 'alive';
  }

  /**
   * One fixed step. `input` is { dir, pointerFieldX, confirm } and `demo` runs the title
   * backdrop: the ball bounces off the floor, bricks only flash, nothing scores or dies.
   */
  function step(dt, input, demo) {
    let events = 0;
    state.elapsed += dt;
    state.serveTimer += dt;
    if (state.hurtTimer > 0) state.hurtTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 34 * dt);
    if (state.laserCooldown > 0) state.laserCooldown -= dt;
    if (state.slow > 0) state.slow -= dt;
    if (state.fast > 0) state.fast -= dt;
    if (state.pierce > 0) state.pierce -= dt;
    // Drifting bricks slide sideways around their home column, clamped to the field.
    for (const brick of bricks) {
      if (brick.alive && brick.kind === KIND_MOVING) {
        brick.x = Math.min(FIELD.width - brick.width, Math.max(0, brick.baseX + Math.sin(state.elapsed * brick.speed + brick.phase) * brick.range));
      }
    }
    // Sinking bricks fall toward the paddle line; one that lands costs a life.
    if (!demo) {
      for (const brick of bricks) {
        if (!brick.alive || brick.kind !== KIND_SINKER) continue;
        brick.y += SINKER.fallSpeed * dt;
        if (brick.y > SINKER.dangerY) {
          brick.alive = false;
          state.bricksLeft -= 1;
          burst(brick.x + brick.width / 2, brick.y, '#9aa3b8', 14, 260);
          floater(brick.x + brick.width / 2, brick.y, 'LANDED! -1 LIFE', PALETTE.danger);
          events |= EVENT_SINKER_LAND;
          events |= loseLife();
          events |= maybeClear();
          if (events & EVENT_OVER) return events;
        }
      }
    }
    // Drones drift in on a timer and patrol the upper field.
    if (!demo && state.dronesToSpawn > 0) {
      state.droneTimer -= dt;
      if (state.droneTimer <= 0 && enemies.length < DRONE.maxAlive) {
        state.dronesToSpawn -= 1;
        state.droneTimer = DRONE.spawnInterval;
        enemies.push({
          x: 120 + random() * (FIELD.width - 240), y: 190 + random() * 90,
          baseY: 190 + random() * 90, vx: (random() < 0.5 ? -1 : 1) * DRONE.speed,
          phase: random() * Math.PI * 2,
        });
      }
    }
    for (const drone of enemies) {
      drone.x += drone.vx * dt;
      if (drone.x < DRONE.radius + 10) { drone.x = DRONE.radius + 10; drone.vx = Math.abs(drone.vx); }
      if (drone.x > FIELD.width - DRONE.radius - 10) { drone.x = FIELD.width - DRONE.radius - 10; drone.vx = -Math.abs(drone.vx); }
      drone.y = drone.baseY + Math.sin(state.elapsed * 1.8 + drone.phase) * 28;
    }
    // The boss slides across the top, fires spreads, and calls in drones — and
    // sinks lower as it takes damage, so the fight closes in.
    if (!demo && state.boss) {
      const boss = state.boss;
      boss.x = FIELD.width / 2 + Math.sin(state.elapsed * 0.55) * 420;
      boss.y = BOSS.y + (1 - boss.hp / boss.maxHp) * 90;
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0) {
        boss.fireTimer = BOSS.fireInterval;
        // One spread, aimed near the boss with a little drift: a hazard to avoid,
        // never a shot at the paddle itself — dodging it must never cost the ball.
        const baseX = boss.x + (random() * 140 - 70);
        for (const dx of [-30, 30]) {
          const sx = boss.x + dx;
          projectiles.push({ x: sx, y: boss.y + BOSS.radius - 6, vx: (baseX + dx - sx) * 0.3, vy: BOSS.projectileSpeed });
        }
        state.shake = Math.max(state.shake, 3);
      }
      boss.spawnTimer -= dt;
      if (boss.spawnTimer <= 0 && enemies.length < 2) {
        boss.spawnTimer = BOSS.spawnInterval;
        enemies.push({
          x: boss.x, y: boss.y + 70, baseY: boss.y + 70,
          vx: (random() < 0.5 ? -1 : 1) * DRONE.speed, phase: random() * Math.PI * 2,
        });
      }
    }
    // Boss fire falls; a shot that reaches the paddle stuns it narrow for 6 s
    // instead of costing a life — the boss pressures the ball, never snipes lives.
    if (!demo) {
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        const shot = projectiles[i];
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (shot.y > FIELD.height + 20) { projectiles.splice(i, 1); continue; }
        const pad = { x: paddle.x, y: PADDLE.y, width: paddle.width, height: PADDLE.height };
        const box = { x: shot.x - BOSS.projectileRadius, y: shot.y - BOSS.projectileRadius, width: BOSS.projectileRadius * 2, height: BOSS.projectileRadius * 2 };
        if (overlaps(box, pad)) {
          projectiles.splice(i, 1);
          burst(shot.x, PADDLE.y, PALETTE.danger, 12, 240);
          paddle.targetWidth = PADDLE.narrow;
          paddle.wide = 0;
          paddle.narrow = 6;
          state.shake = Math.max(state.shake, 8);
          floater(paddle.x + paddle.width / 2, PADDLE.y - 30, 'STUNNED!', PALETTE.danger);
          events |= EVENT_STUN;
        }
      }
    }
    if (paddle.laser > 0) paddle.laser -= dt;
    if (paddle.catch > 0) paddle.catch -= dt;
    if (paddle.wide > 0) {
      paddle.wide -= dt;
      if (paddle.wide <= 0) paddle.targetWidth = baseWidth();
    }
    if (paddle.narrow > 0) {
      paddle.narrow -= dt;
      if (paddle.narrow <= 0) paddle.targetWidth = baseWidth();
    }
    // The paddle eases toward its target width instead of snapping.
    const widthStep = 260 * dt;
    if (paddle.width < paddle.targetWidth) paddle.width = Math.min(paddle.targetWidth, paddle.width + widthStep);
    else if (paddle.width > paddle.targetWidth) paddle.width = Math.max(paddle.targetWidth, paddle.width - widthStep);

    // Steering: the keyboard wins when held; otherwise the pointer glides the paddle.
    if (input.dir !== 0) {
      paddle.x = Math.min(FIELD.width - paddle.width, Math.max(0, paddle.x + input.dir * PADDLE.speed * dt));
    } else if (input.pointerFieldX !== null && input.pointerFieldX !== undefined) {
      const target = Math.min(FIELD.width - paddle.width, Math.max(0, input.pointerFieldX - paddle.width / 2));
      const diff = target - paddle.x;
      paddle.x += diff * Math.min(1, dt * 22);
    }
    paddle.x = Math.min(FIELD.width - paddle.width, Math.max(0, paddle.x));

    // Serving and firing.
    const stuck = balls.find((ball) => ball.stuck);
    if (stuck) {
      stuck.x = paddle.x + paddle.width / 2;
      stuck.y = PADDLE.y - BALL.radius - 1;
      if (input.confirm) {
        launchBall(stuck);
        events |= EVENT_LAUNCH;
      }
    } else if (input.confirm) {
      events |= fireLaser();
    }

    // Balls.
    for (let i = balls.length - 1; i >= 0; i -= 1) {
      const ball = balls[i];
      if (ball.stuck) continue;
      const fate = stepBall(ball, dt, demo);
      if (fate === 'lost') {
        balls.splice(i, 1);
        continue;
      }
      // The paddle: only a ball coming down can meet it.
      if (ball.vy > 0) {
        const pad = { x: paddle.x, y: PADDLE.y, width: paddle.width, height: PADDLE.height };
        const box = { x: ball.x - BALL.radius, y: ball.y - BALL.radius, width: BALL.radius * 2, height: BALL.radius * 2 };
        if (overlaps(box, pad)) {
          if ((paddle.catch > 0 || state.upgrades.magnet > 0) && !demo) {
            ball.stuck = true;
            ball.vx = 0;
            ball.vy = 0;
          } else {
            const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)));
            const speed = ballSpeed();
            const angle = offset * (Math.PI / 3);
            ball.vx = Math.sin(angle) * speed;
            ball.vy = -Math.cos(angle) * speed;
            ball.y = PADDLE.y - BALL.radius - 1;
            burst(ball.x, PADDLE.y, PALETTE.paddle, 3, 90);
          }
        }
      }
      // Bricks: one hit per ball per step keeps the bounce honest.
      for (let j = 0; j < bricks.length; j += 1) {
        const brick = bricks[j];
        if (!brick.alive) continue;
        const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        if (dx * dx + dy * dy > BALL.radius * BALL.radius) continue;
        const overlapX = Math.min(ball.x + BALL.radius - brick.x, brick.x + brick.width - (ball.x - BALL.radius));
        const overlapY = Math.min(ball.y + BALL.radius - brick.y, brick.y + brick.height - (ball.y - BALL.radius));
        if (state.pierce > 0 && brick.kind !== KIND_STEEL) {
          // A ghost ball passes straight through a breakable brick: no bounce.
          events |= damageBrick(brick);
        } else {
          if (overlapX < overlapY) ball.vx = -ball.vx;
          else ball.vy = -ball.vy;
          if (demo) {
            burst(ball.x, ball.y, brick.color, 3, 120);
          } else {
            events |= damageBrick(brick);
          }
        }
        break;
      }
      // Drones: the ball smashes them and bounces on.
      if (!demo) {
        for (let j = enemies.length - 1; j >= 0; j -= 1) {
          const drone = enemies[j];
          const dx = ball.x - drone.x;
          const dy = ball.y - drone.y;
          const dist = Math.hypot(dx, dy);
          if (dist < DRONE.radius + BALL.radius) {
            ball.vy = -ball.vy;
            ball.y = drone.y + (ball.vy < 0 ? -1 : 1) * (DRONE.radius + BALL.radius + 1);
            events |= destroyDrone(j);
            break;
          }
        }
        // The boss: a big target at the top, hit it from below.
        if (state.boss) {
          const boss = state.boss;
          const dx = ball.x - boss.x;
          const dy = ball.y - boss.y;
          const dist = Math.hypot(dx, dy);
          if (dist < BOSS.radius + BALL.radius) {
            // Bounce back down with a capped sideways angle: a nearly flat
            // return would outrun the paddle, so keep most of the speed downward.
            const speed = ballSpeed();
            const nx0 = dist > 0 ? dx / dist : 0;
            const ny0 = dist > 0 ? dy / dist : 1;
            const nx = Math.max(-0.6, Math.min(0.6, nx0));
            ball.vx = nx * speed;
            ball.vy = Math.sqrt(Math.max(0, 1 - nx * nx)) * speed;
            ball.x = boss.x + nx0 * (BOSS.radius + BALL.radius + 1);
            ball.y = boss.y + Math.abs(ny0) * (BOSS.radius + BALL.radius + 1);
            events |= damageBoss(ball);
          }
        }
        // The ball smashes boss fire out of the sky: +10, no bounce.
        for (let j = projectiles.length - 1; j >= 0; j -= 1) {
          const shot = projectiles[j];
          const pdx = ball.x - shot.x;
          const pdy = ball.y - shot.y;
          const reach = BALL.radius + BOSS.projectileRadius + 2;
          if (pdx * pdx + pdy * pdy < reach * reach) {
            projectiles.splice(j, 1);
            state.score += SCORE.projectile;
            burst(shot.x, shot.y, '#ffd60a', 6, 180);
          }
        }
      }
    }

    // A lost last ball costs a life, or ends the game — unless the shield saves it,
    // or hurt protection is still up from a hit a moment ago (then just re-serve).
    if (!demo && balls.length === 0 && !state.levelCleared) {
      if (state.hurtTimer > 0) {
        serveBall();
      } else if (state.shieldReady) {
        state.shieldReady = false;
        state.shake = 14;
        burst(FIELD.width / 2, FIELD.height - 30, '#7dd3fc', 24, 320);
        floater(FIELD.width / 2, FIELD.height - 80, 'AEGIS SHIELD SAVED THE BALL!', '#7dd3fc');
        serveBall();
        const saved = balls[0];
        if (saved) launchBall(saved);
        events |= EVENT_SHIELD_SAVE;
      } else {
        events |= loseLife();
        if (events & EVENT_OVER) return events;
        serveBall();
      }
    }

    // Laser bullets climb and break what they touch: drones, boss fire, then bricks.
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.height < 0) {
        bullets.splice(i, 1);
        continue;
      }
      let spent = false;
      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const drone = enemies[j];
        if (Math.abs(bullet.x - drone.x) < DRONE.radius + 4 && Math.abs(bullet.y - drone.y) < DRONE.radius + 8) {
          bullets.splice(i, 1);
          events |= destroyDrone(j);
          spent = true;
          break;
        }
      }
      if (spent) continue;
      for (let j = projectiles.length - 1; j >= 0; j -= 1) {
        const shot = projectiles[j];
        if (Math.abs(bullet.x - shot.x) < BOSS.projectileRadius + 4 && Math.abs(bullet.y - shot.y) < BOSS.projectileRadius + 8) {
          projectiles.splice(j, 1);
          bullets.splice(i, 1);
          state.score += SCORE.projectile;
          burst(shot.x, shot.y, '#ffd60a', 6, 180);
          spent = true;
          break;
        }
      }
      if (spent) continue;
      for (let j = 0; j < bricks.length; j += 1) {
        const brick = bricks[j];
        if (!brick.alive) continue;
        if (!overlaps(bullet, brick)) continue;
        bullets.splice(i, 1);
        events |= damageBrick(brick);
        break;
      }
    }

    // Power-ups fall and are caught by the paddle.
    for (let i = powerups.length - 1; i >= 0; i -= 1) {
      const power = powerups[i];
      power.y += power.vy * dt;
      if (power.y > FIELD.height) {
        powerups.splice(i, 1);
        continue;
      }
      const pad = { x: paddle.x, y: PADDLE.y, width: paddle.width, height: PADDLE.height };
      if (overlaps(power, pad)) {
        powerups.splice(i, 1);
        events |= applyPowerup(power.type);
        floater(paddle.x + paddle.width / 2, PADDLE.y - 30, POWERUP_INFO[power.type].label, POWERUP_INFO[power.type].color);
      }
    }

    // Particles drift, fall and fade; floating scores rise and fade.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.y -= 42 * dt;
      f.life -= dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
    return events;
  }

  reset();
  return { state, reset, loadLevel, loadWave, startEndless, buyUpgrade, step, serveBall };
}
