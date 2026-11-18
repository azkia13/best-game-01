// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { BALL, FIELD, PADDLE, SERVE_WAIT, STEP } from './config.js';
import { EVENT_LEVEL_CLEAR, EVENT_OVER, EVENT_WIN, KIND_STEEL } from './world.js';
import { LEVELS } from './levels.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 18;
const LIMIT_SECONDS = 600;
/** One campaign level may take the pilot a long while (level 6 took 746 s of sim). */
const CAMPAIGN_LIMIT_SECONDS = 1500;
const SAMPLE = 1 / 60;

/** Where the ball will cross the paddle's line, from its current flight. */
function landingX(ball) {
  if (ball.vy <= 0) return ball.x;
  const time = (PADDLE.y - ball.y) / ball.vy;
  let x = ball.x + ball.vx * time;
  const width = FIELD.width - BALL.radius * 2;
  x = ((x - BALL.radius) % (2 * width) + 2 * width) % (2 * width);
  return BALL.radius + (x > width ? 2 * width - x : x);
}

/**
 * Steer the paddle. The pilot watches the ball's landing spot and, instead of meeting it
 * dead centre, aims the return at a brick that is still standing: the offset it leaves
 * between the ball and the paddle's centre sets the ball's angle off the paddle, so a
 * centred return (which would send the ball straight up and down one column forever)
 * never happens. `skill` is 1 for a good player and near 0 for a hurried one: the bad
 * pilot reads the landing spot late and often picks the wrong side, so it loses its lives.
 * Exported so the headless full-game test drives the same pilot the screenshots use.
 */
export function autopilot(state, skill, random) {
  const ball = state.balls.find((b) => !b.stuck);
  if (!ball) return 0;
  // Dodge boss fire: a shot falling onto the paddle's span means step aside —
  // but only while the ball is not about to land; catching the ball comes first.
  // The whole threatening volley is dodged at once, by its mean x, so dodging
  // one shot of a pair never walks the paddle into the other.
  const ballIncoming = ball.vy > 0 && (PADDLE.y - ball.y) / ball.vy < 0.45;
  if (!ballIncoming) {
    const centre = state.paddle.x + state.paddle.width / 2;
    let sum = 0;
    let count = 0;
    for (const shot of state.projectiles) {
      if (shot.vy > 0 && shot.y > PADDLE.y - 340 && shot.y < PADDLE.y && Math.abs(shot.x - centre) < state.paddle.width / 2 + 12) {
        sum += shot.x;
        count += 1;
      }
    }
    if (count > 0) return sum / count > centre ? -1 : 1;
  }
  const target = landingX(ball);
  const centre = state.paddle.x + state.paddle.width / 2;
  // Aim at a brick that is still standing — but the target cycles every 18 s
  // between the lowest, the highest and the nearest brick: a fixed target can
  // loop the ball forever against steel, and a target that changes with time
  // breaks the cycle. (The level clock resets on every level, so each level
  // gets a fresh cycle.)
  const phase = Math.floor(state.elapsed / 18) % 3;
  let aimX = null;
  let aimY = null;
  let brick = null;
  for (const b of state.bricks) {
    if (!b.alive || b.kind === KIND_STEEL) continue;
    if (brick === null) {
      brick = b;
      continue;
    }
    const nearer = Math.abs(b.x + b.width / 2 - ball.x) < Math.abs(brick.x + brick.width / 2 - ball.x);
    if (phase === 0) {
      if (b.y > brick.y || (b.y === brick.y && nearer)) brick = b;
    } else if (phase === 1) {
      if (b.y < brick.y || (b.y === brick.y && nearer)) brick = b;
    } else if (nearer) {
      brick = b;
    }
  }
  if (brick !== null) {
    aimX = brick.x + brick.width / 2;
    aimY = brick.y;
  } else if (state.boss) {
    aimX = state.boss.x;
    aimY = state.boss.y;
  }
  // Once the wall is nearly down, the boss is the target — don't chase the last bricks.
  if (state.boss && state.bricksLeft <= 6) {
    aimX = state.boss.x;
    aimY = state.boss.y;
  }
  let wanted = target > centre + 10 ? 1 : target < centre - 10 ? -1 : 0;
  if (aimX !== null) {
    const aim = Math.atan2(aimX - target, PADDLE.y - aimY);
    const offset = Math.max(-0.85, Math.min(0.85, aim / (Math.PI / 3)));
    const aimCentre = target - offset * (state.paddle.width / 2);
    wanted = aimCentre > centre + 10 ? 1 : aimCentre < centre - 10 ? -1 : 0;
  }
  if (random() > skill) wanted = -wanted;
  return wanted;
}

/** Step the world forward with the autopilot until the level ends or the limit is hit. */
function playForward(world, seconds, skill, random) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const state = world.state;
    const stuck = state.balls.find((b) => b.stuck);
    const confirm = stuck !== undefined && state.serveTimer > SERVE_WAIT;
    const events = world.step(STEP, { dir: autopilot(state, skill, random), pointerFieldX: null, confirm }, false);
    if (events & (EVENT_OVER | EVENT_WIN | EVENT_LEVEL_CLEAR)) return events;
  }
  return 0;
}

/**
 * Play the whole campaign with the autopilot, buying shop upgrades between levels the
 * way a good player would (shield first, then wide, laser, life, magnet). Returns
 * EVENT_WIN when the campaign is won, or the event that stopped it.
 */
function playCampaign(world, random) {
  for (let level = 0; level < LEVELS.length; level += 1) {
    const events = playForward(world, CAMPAIGN_LIMIT_SECONDS, 1, random);
    if (events & EVENT_WIN) return events;
    if (events & EVENT_OVER) return events;
    if (!(events & EVENT_LEVEL_CLEAR)) return 0;
    // The shop, between levels: spend shards greedily, shield first.
    for (const id of ['shield', 'wide', 'laser', 'life', 'magnet']) {
      while (world.buyUpgrade(id)) { /* bought */ }
    }
    if (level + 1 < LEVELS.length) world.loadLevel(level + 1);
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world, random) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    // Title over a live demo: the ball bounces and the paddle follows it, nothing scores.
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { dir: autopilot(world.state, 1, random), pointerFieldX: null, confirm: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0, board: [] };
  }
  if (name === 'play') {
    // The play shot stages level 15, the final boss fight: the Core firing, drones out.
    world.loadLevel(14);
    playForward(world, PLAY_SECONDS, 1, random);
    return { screen: SCREEN_PLAY, best: world.state.score, board: [] };
  }
  if (name === 'win') {
    // Play the whole campaign for real: the win shot is the true YOU WIN screen,
    // with the final score. If the pilot ever fails, fall back to a level-1 clear.
    const events = playCampaign(world, random);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score, board: [] };
    world.reset();
    const clear = playForward(world, LIMIT_SECONDS, 1, random);
    if (clear & EVENT_LEVEL_CLEAR) return { screen: SCREEN_CLEAR, best: world.state.score, clearBonus: world.state.lastBonus, flawless: world.state.lastFlawless, board: [] };
    return { screen: SCREEN_PLAY, best: world.state.score, board: [] };
  }
  // End: a hurried pilot that reads the ball late and often goes the wrong way.
  const events = playForward(world, LIMIT_SECONDS, 0.15, random);
  if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score, board: [] };
  return { screen: SCREEN_PLAY, best: world.state.score, board: [] };
}
