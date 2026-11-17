// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, level clear, win and
// game over. Sound answers every event; the status line announces the screens.
//
// ?seed=N fixes the random pattern. ?shot=start|play|win|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, LIVES, MUTE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BAD, EVENT_BRICK, EVENT_CRACK, EVENT_LASER, EVENT_LAUNCH, EVENT_LEVEL_CLEAR, EVENT_LIFE_LOST, EVENT_OVER, EVENT_POWERUP, EVENT_STEEL, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { LEVELS } from './levels.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
let currentScreen = SCREEN_TITLE;

// A handle on the live game for debugging and automated play-tests.
window.__game = { world, get screen() { return currentScreen; } };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(value) {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // See saveBest.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, createRandom(seed));
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: scene.best,
      levelName: LEVELS[world.state.level].name,
      clearBonus: scene.clearBonus ?? 0,
      muted: false,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let clearBonus = 0;
  let accumulator = 0;
  let last = performance.now();
  audio.setMuted(readMuted());

  function setScreen(next) {
    screen = next;
    currentScreen = next;
  }

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    setScreen(SCREEN_PLAY);
    audio.unlock();
    audio.serve();
    announce(`Playing level 1, ${LEVELS[0].name}. ${LIVES} lives.`);
  }

  function endGame(won) {
    if (won) {
      setScreen(SCREEN_WIN);
      audio.win();
      announce(`You win! Final score ${world.state.score}.`);
    } else {
      setScreen(SCREEN_OVER);
      audio.gameOver();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_BRICK) audio.brick(world.state.combo);
    if (events & EVENT_CRACK) audio.crack();
    if (events & EVENT_STEEL) audio.steel();
    if (events & EVENT_POWERUP) audio.powerup();
    if (events & EVENT_BAD) audio.bad();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_LAUNCH) audio.serve();
    if (events & EVENT_LIFE_LOST) {
      audio.loseLife();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_LEVEL_CLEAR) {
      clearBonus = world.state.lastBonus;
      setScreen(SCREEN_CLEAR);
      audio.levelClear();
      announce(`Level ${world.state.level + 1} clear. Bonus ${clearBonus}.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function pointerFieldX() {
    const clientX = input.pointerClientX();
    if (clientX === null) return null;
    const field = renderer.screenToField(clientX, window.innerHeight / 2);
    return field === null ? null : field.x;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One take per frame: the flags below are spent once, never twice.
    const actions = input.takeActions();
    let confirm = (actions & ACTION_CONFIRM) !== 0;
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      saveMuted(audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    // A confirm on a still screen changes the screen and is spent: it must not also
    // serve the ball in the same frame.
    if (confirm) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
        startGame();
        confirm = false;
      } else if (screen === SCREEN_CLEAR) {
        world.loadLevel(world.state.level + 1);
        accumulator = 0;
        setScreen(SCREEN_PLAY);
        announce(`Playing level ${world.state.level + 1}, ${LEVELS[world.state.level].name}.`);
        confirm = false;
      } else if (screen === SCREEN_PAUSED) {
        setScreen(SCREEN_PLAY);
        announce('Playing.');
        confirm = false;
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        setScreen(SCREEN_PAUSED);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        setScreen(SCREEN_PLAY);
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        if (screen === SCREEN_TITLE) {
          world.step(STEP, { dir: 0, pointerFieldX: null, confirm: false }, true);
        } else {
          const events = world.step(STEP, {
            dir: input.direction(),
            pointerFieldX: pointerFieldX(),
            confirm: firstStep && confirm,
          }, false);
          handleEvents(events);
        }
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      levelName: LEVELS[world.state.level].name,
      clearBonus,
      muted: audio.isMuted(),
    });
  }

  // Leaving the tab pauses a running game rather than letting the ball fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  });

  announce('Neon Breaker. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
