// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { BALL, FIELD, PADDLE, SERVE_WAIT, STEP } from './config.js';
import { EVENT_LEVEL_CLEAR, EVENT_OVER, EVENT_WIN, KIND_STEEL } from './world.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 26;
const LIMIT_SECONDS = 300;
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
 */
function autopilot(state, skill, random) {
  const ball = state.balls.find((b) => !b.stuck);
  if (!ball) return 0;
  const target = landingX(ball);
  const centre = state.paddle.x + state.paddle.width / 2;
  // Aim at the lowest brick still standing, nearest to the ball's line.
  let brick = null;
  for (const b of state.bricks) {
    if (!b.alive || b.kind === KIND_STEEL) continue;
    if (brick === null || b.y > brick.y || (b.y === brick.y && Math.abs(b.x + b.width / 2 - ball.x) < Math.abs(brick.x + brick.width / 2 - ball.x))) brick = b;
  }
  let wanted = target > centre + 10 ? 1 : target < centre - 10 ? -1 : 0;
  if (brick !== null) {
    const aim = Math.atan2(brick.x + brick.width / 2 - target, PADDLE.y - brick.y);
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
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // The play shot stages level 7, Neon Drift: drifting bricks in mid-flight.
    world.loadLevel(6);
    playForward(world, PLAY_SECONDS, 1, random);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    // Play level one for real until it is cleared: the level-clear panel is the win shot.
    const events = playForward(world, LIMIT_SECONDS, 1, random);
    if (events & EVENT_LEVEL_CLEAR) return { screen: SCREEN_CLEAR, best: world.state.score, clearBonus: world.state.lastBonus };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // End: a hurried pilot that reads the ball late and often goes the wrong way.
  const events = playForward(world, LIMIT_SECONDS, 0.15, random);
  if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
