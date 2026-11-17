// The game's rules and state, with no drawing and no browser in it: the paddle, the balls,
// the bricks of one level, falling power-ups, laser bullets, particles and floating score
// text. step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sound, announcements) without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns, except the short particle lists.
import { BALL, BRICK, COMBO, DURATION, FIELD, LIVES, MAX_LIVES, PADDLE, PALETTE, POWERUP, SCORE } from './config.js';
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

export const KIND_NORMAL = 0;
export const KIND_HARD = 1;
export const KIND_TOUGH = 2;
export const KIND_STEEL = 3;
export const KIND_BONUS = 4;

/** The capsule letters, what they do, and whether catching one is good news. */
export const POWERUP_INFO = {
  W: { label: 'Wide paddle', good: true, color: '#22d3ee' },
  M: { label: 'Multiball', good: true, color: '#ff2d78' },
  L: { label: 'Laser paddle', good: true, color: '#ff5d8f' },
  S: { label: 'Slow ball', good: true, color: '#3ddc84' },
  E: { label: 'Extra life', good: true, color: '#f2c94c' },
  C: { label: 'Catch', good: true, color: '#a855f7' },
  N: { label: 'Narrow paddle', good: false, color: '#8b93b8' },
  F: { label: 'Fast ball', good: false, color: '#ff8a00' },
};
const POWERUP_KEYS = ['W', 'M', 'L', 'S', 'E', 'C', 'N', 'F'];
/** How often each capsule is the one that drops, out of 100. */
const POWERUP_WEIGHTS = { W: 20, M: 18, L: 16, S: 14, E: 6, C: 12, N: 7, F: 7 };

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
  const state = {
    paddle, balls, bricks, powerups, bullets, particles, floaters,
    score: 0, combo: 0, mult: 1, lives: LIVES, level: 0,
    bricksLeft: 0, elapsed: 0, shake: 0, slow: 0, fast: 0,
    laserCooldown: 0, serveTimer: 0, levelCleared: false, won: false, lastBonus: 0,
  };

  function brickPoints(kind) {
    if (kind === KIND_HARD) return SCORE.hard;
    if (kind === KIND_TOUGH) return SCORE.tough;
    if (kind === KIND_BONUS) return SCORE.bonus;
    return SCORE.brick;
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    bricks.length = 0;
    powerups.length = 0;
    bullets.length = 0;
    particles.length = 0;
    balls.length = 0;
    state.level = index;
    state.bricksLeft = 0;
    state.levelCleared = false;
    state.elapsed = 0;
    state.slow = 0;
    state.fast = 0;
    paddle.width = PADDLE.width;
    paddle.targetWidth = PADDLE.width;
    paddle.laser = 0;
    paddle.catch = 0;
    paddle.wide = 0;
    paddle.narrow = 0;
    for (let row = 0; row < level.rows.length; row += 1) {
      const line = level.rows[row];
      for (let col = 0; col < line.length; col += 1) {
        const cell = line[col];
        if (cell === '.') continue;
        const kind = cell === '2' ? KIND_HARD : cell === '3' ? KIND_TOUGH : cell === 'X' ? KIND_STEEL : cell === 'B' ? KIND_BONUS : KIND_NORMAL;
        const hp = kind === KIND_HARD ? 2 : kind === KIND_TOUGH ? 3 : 1;
        bricks.push({
          x: BRICK.left + col * (BRICK.width + BRICK.gapX),
          y: BRICK.top + row * (BRICK.height + BRICK.gapY),
          width: BRICK.width, height: BRICK.height,
          hp, maxHp: hp, kind, row,
          color: kind === KIND_STEEL ? PALETTE.unbreakable : kind === KIND_BONUS ? PALETTE.gold : PALETTE.rows[row % PALETTE.rows.length],
          alive: true,
        });
        if (kind !== KIND_STEEL) state.bricksLeft += 1;
      }
    }
    paddle.x = (FIELD.width - paddle.width) / 2;
    serveBall();
  }

  function reset() {
    state.score = 0;
    state.combo = 0;
    state.mult = 1;
    state.lives = LIVES;
    state.won = false;
    state.shake = 0;
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
      paddle.laser = DURATION.laser;
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
    }
    return info.good ? EVENT_POWERUP : EVENT_BAD;
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
    burst(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 12, 260);
    floater(brick.x + brick.width / 2, brick.y, `+${points}`, brick.color);
    events |= EVENT_BRICK;
    if (brick.kind === KIND_BONUS) dropPowerup(brick.x + brick.width / 2, brick.y + brick.height, true);
    else dropPowerup(brick.x + brick.width / 2, brick.y + brick.height, false);
    if (state.bricksLeft === 0 && !state.levelCleared) {
      state.levelCleared = true;
      const bonus = SCORE.levelBonus * state.lives;
      state.lastBonus = bonus;
      state.score += bonus;
      floater(FIELD.width / 2, FIELD.height / 2 - 40, `LEVEL BONUS +${bonus}`, PALETTE.gold);
      events |= state.level === LEVELS.length - 1 ? EVENT_WIN : EVENT_LEVEL_CLEAR;
      if (state.level === LEVELS.length - 1) state.won = true;
    }
    return events;
  }

  function fireLaser() {
    if (paddle.laser <= 0 || state.laserCooldown > 0) return 0;
    state.laserCooldown = LASER_COOLDOWN;
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
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 34 * dt);
    if (state.laserCooldown > 0) state.laserCooldown -= dt;
    if (state.slow > 0) state.slow -= dt;
    if (state.fast > 0) state.fast -= dt;
    if (paddle.laser > 0) paddle.laser -= dt;
    if (paddle.catch > 0) paddle.catch -= dt;
    if (paddle.wide > 0) {
      paddle.wide -= dt;
      if (paddle.wide <= 0) paddle.targetWidth = PADDLE.width;
    }
    if (paddle.narrow > 0) {
      paddle.narrow -= dt;
      if (paddle.narrow <= 0) paddle.targetWidth = PADDLE.width;
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
          if (paddle.catch > 0 && !demo) {
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
        if (overlapX < overlapY) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;
        if (demo) {
          burst(ball.x, ball.y, brick.color, 3, 120);
        } else {
          events |= damageBrick(brick);
        }
        break;
      }
    }

    // A lost last ball costs a life, or ends the game.
    if (!demo && balls.length === 0 && !state.levelCleared) {
      state.lives -= 1;
      state.combo = 0;
      state.mult = 1;
      state.shake = 16;
      events |= EVENT_LIFE_LOST;
      if (state.lives <= 0) {
        events |= EVENT_OVER;
      } else {
        serveBall();
      }
    }

    // Laser bullets climb and break what they touch.
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.height < 0) {
        bullets.splice(i, 1);
        continue;
      }
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
  return { state, reset, loadLevel, step, serveBall };
}
