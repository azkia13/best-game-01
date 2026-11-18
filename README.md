# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/azkia13/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/azkia13/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Neon Breaker: a neon Breakout game with 12 hand-designed levels, 9 power-up capsules (including the Ghost ball, which passes through bricks), drifting bricks that slide sideways, boss bricks worth 500 points, moving drone enemies, sinking bricks that cost a life if they land, a real boss fight against the Core, a shard economy with an upgrade shop between levels, and an endless mode with a local leaderboard — combo scoring, particles, screen shake and synthesized sound, all in plain static files with no libraries and no network.

## What's new in v3

- **Four new levels**: *Drone Yard* (9) introduces drone enemies that patrol the field — smash them for 200 points and 3 shards; *Sinking City* (10) has bricks that sink toward your paddle and cost a life if they land; *Crossfire* (11) mixes drones, sinkers and drifters; *The Core Awakens* (12) is a boss fight against the Core itself — 14 hits, it sinks lower as it takes damage, fires spreads you can dodge or smash with the ball, and calls in drones.
- **Shards (◆) and the upgrade shop**: bonus bricks, boss bricks and drones drop shards; between levels the shop sells five permanent upgrades — Wide Paddle+, Magnet Paddle, Laser Overclock, Aegis Shield (one free ball-save per level) and Extra Life.
- **Endless mode**: press E on the title screen after winning (or any time) for procedurally generated waves that never stop, with a boss every 5th wave and a top-5 local leaderboard on the title and game-over screens.
- **Fairness tuning**: a hit starts 1.2 s of hurt protection so one volley or one landing row never takes more than one life; boss fire stuns the paddle narrow instead of sniping lives; the paddle blinks while protected.

## What's new in v2

- **Two new levels**: *Neon Drift* (level 7) introduces drifting bricks that slide sideways — lead your shot, don't chase it; *The Core* (level 8) is guarded by boss bricks that take 5 hits, pay 500 points each and drop two power-ups when they fall.
- **Ghost ball power-up (G)**: for 8 seconds the ball passes straight through bricks instead of bouncing, carving a path through a wall.
- **Level tips**: the level-clear panel now tells you what's coming next, so each new mechanic is introduced before you meet it.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Move with the mouse or ← → / A D, Space to serve and fire, P to pause, M to mute.

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
