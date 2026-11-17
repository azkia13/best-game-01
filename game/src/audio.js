// Sound, synthesized with the Web Audio API: no audio files, no network. Every call is
// guarded, so a browser that cannot play sound (or a screenshot run with no user gesture)
// simply stays silent instead of throwing.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context !== null && context.state === 'running';
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context !== null;
  }

  /** Call from a user gesture (a key or a click) so the browser lets sound start. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure() || context.state !== 'running') return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // A tone that cannot play is skipped, never fatal.
    }
  }

  function arpeggio(notes, step, type, vol) {
    if (muted || !ensure() || context.state !== 'running') return;
    notes.forEach((freq, index) => {
      window.setTimeout(() => tone(freq, 0.16, type, vol), index * step * 1000);
    });
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    /** A soft tick when the ball is served. */
    serve() {
      tone(520, 0.08, 'sine', 0.5);
    },
    /** The paddle answers every hit with the same short blip. */
    paddle() {
      tone(220, 0.06, 'triangle', 0.6);
    },
    /** A wall bounce, lower and quieter than the paddle. */
    wall() {
      tone(160, 0.05, 'triangle', 0.35);
    },
    /** A brick pops higher the longer the combo runs. */
    brick(combo) {
      tone(340 + Math.min(combo, 24) * 22, 0.09, 'square', 0.4, 180);
    },
    /** A hard brick cracks instead of breaking. */
    crack() {
      tone(140, 0.07, 'sawtooth', 0.4, 90);
    },
    /** A steel brick rings and does not break. */
    steel() {
      tone(980, 0.05, 'sine', 0.3, 700);
    },
    /** A power-up capsule is caught: a bright two-note chime. */
    powerup() {
      arpeggio([660, 990], 0.07, 'sine', 0.5);
    },
    /** A bad capsule: a low warning buzz. */
    bad() {
      tone(130, 0.18, 'sawtooth', 0.4, 70);
    },
    /** A laser shot fires. */
    laser() {
      tone(880, 0.1, 'square', 0.35, 220);
    },
    /** A life is lost: the sound falls away. */
    loseLife() {
      arpeggio([392, 311, 233], 0.12, 'triangle', 0.5);
    },
    /** A level is cleared: a rising arpeggio. */
    levelClear() {
      arpeggio([523, 659, 784, 1047], 0.09, 'triangle', 0.5);
    },
    /** All six levels cleared: the fanfare. */
    win() {
      arpeggio([523, 659, 784, 1047, 1319, 1568], 0.11, 'triangle', 0.55);
    },
    /** No lives left: a short low phrase. */
    gameOver() {
      arpeggio([330, 262, 196, 131], 0.16, 'triangle', 0.5);
    },
  };
}
