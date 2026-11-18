// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon glow is used where it earns its cost: the ball, the paddle and the capsules;
// the bricks carry their colour in a flat face and a bright top edge instead.
import { BALL, BRICK, FIELD, FONT, LIVES, MAX_LIVES, PALETTE, PADDLE } from './config.js';
import { KIND_BONUS, KIND_BOSS, KIND_HARD, KIND_MOVING, KIND_STEEL, KIND_TOUGH, POWERUP_INFO } from './world.js';
import { LEVELS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 78 };
const HUD_TOP = 18;

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.arcTo(x + width, y, x + width, y + radius, radius);
  context.lineTo(x + width, y + height - radius);
  context.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  context.lineTo(x + radius, y + height);
  context.arcTo(x, y + height, x, y + height - radius, radius);
  context.lineTo(x, y + radius);
  context.arcTo(x, y, x + radius, y, radius);
  context.closePath();
}

function shade(hex, factor) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.width = width;
    view.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight ?? 400}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? 400} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.fillText(value, x, y);
  }

  /** Client pixels (a pointer event) into playfield pixels, or null outside the field. */
  function screenToField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * view.width;
    const y = ((clientY - rect.top) / rect.height) * view.height;
    const fieldX = (x - view.x) / view.scale;
    const fieldY = (y - view.y) / view.scale;
    if (fieldX < 0 || fieldX > FIELD.width || fieldY < 0 || fieldY > FIELD.height) return null;
    return { x: fieldX, y: fieldY };
  }

  function drawBackdrop() {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.backdropTop);
    gradient.addColorStop(1, PALETTE.backdrop);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    for (let x = 80; x < FIELD.width; x += 80) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, PADDLE.y + PADDLE.height + 8, FIELD.width, FIELD.height - PADDLE.y - PADDLE.height - 8);
  }

  function drawBricks(state) {
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const dim = brick.kind === KIND_BOSS ? 0.55 + 0.09 * brick.hp
        : (brick.kind === KIND_HARD || brick.kind === KIND_TOUGH || brick.kind === KIND_MOVING) ? 0.62 + 0.19 * brick.hp : 1;
      context.fillStyle = shade(brick.color, dim);
      roundRect(context, brick.x, brick.y, brick.width, brick.height, 5);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.28)';
      context.fillRect(brick.x + 4, brick.y + 3, brick.width - 8, 4);
      if (brick.kind === KIND_BOSS) {
        // A pulsing frame and one pip per hit left: the boss is the brick to watch.
        const pulse = 0.45 + 0.35 * Math.sin(state.elapsed * 5);
        context.strokeStyle = `rgba(255,84,112,${pulse.toFixed(2)})`;
        context.lineWidth = 3;
        roundRect(context, brick.x - 2, brick.y - 2, brick.width + 4, brick.height + 4, 7);
        context.stroke();
        for (let i = 0; i < brick.maxHp; i += 1) {
          context.fillStyle = i < brick.hp ? '#ffffff' : 'rgba(255,255,255,0.22)';
          context.beginPath();
          context.arc(brick.x + brick.width / 2 + (i - (brick.maxHp - 1) / 2) * 13, brick.y + brick.height - 7, 3, 0, Math.PI * 2);
          context.fill();
        }
      } else if (brick.kind === KIND_MOVING) {
        // A double arrow: this brick slides sideways.
        const cy = brick.y + brick.height / 2;
        context.strokeStyle = 'rgba(255,255,255,0.8)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(brick.x + 14, cy);
        context.lineTo(brick.x + brick.width - 14, cy);
        context.moveTo(brick.x + 14, cy);
        context.lineTo(brick.x + 20, cy - 4);
        context.moveTo(brick.x + 14, cy);
        context.lineTo(brick.x + 20, cy + 4);
        context.moveTo(brick.x + brick.width - 14, cy);
        context.lineTo(brick.x + brick.width - 20, cy - 4);
        context.moveTo(brick.x + brick.width - 14, cy);
        context.lineTo(brick.x + brick.width - 20, cy + 4);
        context.stroke();
      }
      if (brick.kind === KIND_STEEL) {
        context.fillStyle = PALETTE.unbreakableDark;
        context.fillRect(brick.x + 8, brick.y + brick.height / 2 - 2, brick.width - 16, 4);
        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.fillRect(brick.x + 10, brick.y + 6, 3, 3);
        context.fillRect(brick.x + brick.width - 13, brick.y + 6, 3, 3);
      } else if (brick.kind === KIND_BONUS) {
        text('★', brick.x + brick.width / 2, brick.y + brick.height / 2 + 7, 18, '#3a2b00', 'center', 700);
      } else if (brick.hp === 2 && brick.kind !== KIND_MOVING && brick.kind !== KIND_BOSS) {
        context.strokeStyle = 'rgba(0,0,0,0.45)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(brick.x + 12, brick.y + 4);
        context.lineTo(brick.x + brick.width / 2, brick.y + brick.height / 2);
        context.lineTo(brick.x + brick.width - 14, brick.y + 6);
        context.stroke();
      } else if (brick.hp === 3 && brick.kind !== KIND_BOSS) {
        context.strokeStyle = 'rgba(0,0,0,0.5)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(brick.x + 10, brick.y + 4);
        context.lineTo(brick.x + brick.width / 2, brick.y + brick.height / 2);
        context.lineTo(brick.x + brick.width - 12, brick.y + 5);
        context.moveTo(brick.x + brick.width / 2, brick.y + 3);
        context.lineTo(brick.x + brick.width / 2 - 8, brick.y + brick.height - 5);
        context.stroke();
      }
    }
  }

  function drawPaddle(state) {
    const paddle = state.paddle;
    const y = PADDLE.y;
    context.save();
    context.shadowColor = PALETTE.paddle;
    context.shadowBlur = 18;
    context.fillStyle = PALETTE.paddle;
    roundRect(context, paddle.x, y, paddle.width, PADDLE.height, 8);
    context.fill();
    context.restore();
    context.fillStyle = 'rgba(255,255,255,0.55)';
    context.fillRect(paddle.x + 8, y + 3, paddle.width - 16, 4);
    if (paddle.laser > 0) {
      context.fillStyle = PALETTE.paddleLaser;
      context.fillRect(paddle.x + 6, y - 10, 6, 12);
      context.fillRect(paddle.x + paddle.width - 12, y - 10, 6, 12);
    }
    if (paddle.catch > 0) {
      context.fillStyle = '#a855f7';
      context.beginPath();
      context.arc(paddle.x + paddle.width / 2, y - 8, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBalls(state) {
    for (const ball of state.balls) {
      if (state.pierce > 0) {
        // A ghost ball wears a pale halo: it passes through bricks.
        context.save();
        context.globalAlpha = 0.22 + 0.1 * Math.sin(state.elapsed * 6);
        context.fillStyle = PALETTE.ghost;
        context.beginPath();
        context.arc(ball.x, ball.y, BALL.radius + 7, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      context.save();
      context.shadowColor = state.pierce > 0 ? PALETTE.ghost : PALETTE.ballTrail;
      context.shadowBlur = 16;
      context.fillStyle = PALETTE.ball;
      context.beginPath();
      context.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
      if (!ball.stuck) {
        context.strokeStyle = state.pierce > 0 ? 'rgba(125,211,252,0.55)' : 'rgba(34,211,238,0.45)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(ball.x - ball.vx * 0.03, ball.y - ball.vy * 0.03);
        context.lineTo(ball.x, ball.y);
        context.stroke();
      }
    }
  }

  function drawPowerups(state) {
    for (const power of state.powerups) {
      const info = POWERUP_INFO[power.type];
      context.save();
      context.shadowColor = info.color;
      context.shadowBlur = 12;
      context.fillStyle = info.color;
      roundRect(context, power.x, power.y, power.width, power.height, 9);
      context.fill();
      context.restore();
      text(power.type, power.x + power.width / 2, power.y + 14, 13, '#0a0e1a', 'center', 800);
    }
  }

  function drawBullets(state) {
    context.fillStyle = '#ffd60a';
    for (const bullet of state.bullets) {
      context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawFloaters(state) {
    context.textBaseline = 'alphabetic';
    for (const f of state.floaters) {
      context.globalAlpha = Math.max(0, f.life / 0.9);
      text(f.text, f.x, f.y, 20, f.color, 'center', 700);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, levelName) {
    context.textBaseline = 'top';
    text(`SCORE ${state.score}`, 24, HUD_TOP, 26, PALETTE.text, 'left', 700);
    text(`LEVEL ${state.level + 1} · ${levelName}`, FIELD.width / 2, HUD_TOP, 22, PALETTE.muted, 'center', 600);
    const livesLabel = 'LIVES ';
    const livesWidth = context.measureText(livesLabel).width + MAX_LIVES * 22;
    let lx = FIELD.width - 24 - livesWidth;
    text(livesLabel, lx, HUD_TOP, 22, PALETTE.muted, 'left', 600);
    lx += context.measureText(livesLabel).width + 4;
    for (let i = 0; i < MAX_LIVES; i += 1) {
      context.fillStyle = i < state.lives ? PALETTE.ball : 'rgba(255,255,255,0.14)';
      context.beginPath();
      context.arc(lx + 8 + i * 22, HUD_TOP + 12, 7, 0, Math.PI * 2);
      context.fill();
    }
    if (state.mult > 1) {
      text(`COMBO ×${state.mult}`, FIELD.width - 24, HUD_TOP + 34, 20, PALETTE.gold, 'right', 800);
    }
    if (state.pierce > 0) {
      text('GHOST BALL', FIELD.width - 24, HUD_TOP + 60, 18, PALETTE.ghost, 'right', 800);
    }
    // Thin progress bar: how much of this level is cleared.
    const total = state.bricks.length > 0 ? state.bricks.filter((b) => b.kind !== KIND_STEEL).length : 1;
    const done = total - state.bricksLeft;
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(24, 56, 220, 5);
    context.fillStyle = PALETTE.gold;
    context.fillRect(24, 56, 220 * (done / total), 5);
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(4,6,14,0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, PANEL.width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, y, PANEL.width, height, 14);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, accent ?? PALETTE.text, 'center', 800);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center', 400);
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center', 700);
  }

  function draw(state, screen, ui) {
    const { best, levelName, clearBonus, muted } = ui;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 0.6 : 0;
    const shakeY = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake * 0.6 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackdrop();
    drawBricks(state);
    drawPowerups(state);
    drawBullets(state);
    drawPaddle(state);
    drawBalls(state);
    drawParticles(state);
    drawFloaters(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('NEON BREAKER', [
        'Break every brick. Keep the ball alive.',
        'Mouse or ← → to move · Space to serve and fire',
        'Catch the falling capsules — some help, some hurt.',
        `${LEVELS.length} levels · ${LIVES} lives · best ${best}`,
      ], 'Press Space or click to start');
      return;
    }
    drawHud(state, levelName);
    if (muted) text('MUTED', FIELD.width - 24, FIELD.height - 34, 16, PALETTE.muted, 'right', 600);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The ball waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CLEAR) {
      const next = LEVELS[Math.min(state.level + 1, LEVELS.length - 1)];
      drawPanel(`Level ${state.level + 1} clear!`, [
        `${levelName} is done.`,
        `Level bonus +${clearBonus} · Score ${state.score}`,
        `Next: ${next.name} — ${next.tip}`,
      ], 'Press Space for the next level', PALETTE.gold);
    } else if (screen === SCREEN_WIN) {
      drawPanel('YOU WIN!', [
        `All ${LEVELS.length} levels cleared.`,
        `Final score ${state.score} · Best ${Math.max(best, state.score)}`,
        state.score >= best && best > 0 ? 'A new best score!' : 'The neon is yours.',
      ], 'Press Space to play again', PALETTE.gold);
    } else if (screen === SCREEN_OVER) {
      drawPanel('Game over', [
        `Score ${state.score} · Best ${Math.max(best, state.score)}`,
        state.score >= best && best > 0 ? 'A new best score!' : 'The bricks win this time.',
        '',
      ], 'Press Space or click to play again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToField };
}
