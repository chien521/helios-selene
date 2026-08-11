# Helios & Selene — Project Memory

A companion puzzle-adventure to *What the Snow Remembers* (github.com/chien521/What-the-Snow-Remembers) — same engine and tone, standalone codebase, different mechanic and myth. Built with GitHub Copilot doing the primary implementation; Claude Code assists on debugging, architecture review, and structural work.

## Stack

Three.js + Vite, vanilla ES modules, browser-only, no backend required for core gameplay. New standalone repo — not a branch or folder inside What-the-Snow-Remembers.

## Premise

A nameless traveler carries an unfinished telescope through two worlds that can never share a sky: **Helios** (the sun's domain) and **Selene** (the moon's domain) — two figures who love each other but were never in the sky together. The traveler is building a way for them to finally be seen together, once, through a telescope completed from one lens found in each world.

No dialogue, no named traveler, no explanation during play — wordless, first-person-passage storytelling, same as Seasons. The myth is told in full only once, at the very end.

## Core Mechanic — Aim & Observe

- Base verbs: move, jump, **raise/lower telescope**.
- Raising the telescope **locks player movement** — stop to look, then lower it and act on what was seen. This look-then-commit rhythm is the entire puzzle language of the game.
- Telescope starts non-functional beyond basic sight. Each chapter's lens unlocks a new power:
  - **Helios lens → burning glass.** Aim + sustained focus heats/melts distant gates or blockers. Requires held duration, not instant — this duration should shorten/lengthen as the level's color grade progresses (see Visuals below), doubling as a difficulty curve.
  - **Selene lens → stabilize/reveal.** Platforms or the drifting core-object are only solid/visible while directly held in view through the scope; look away and they fade or drift.
- Fail-respawn on hazards — checkpoint and route-aware recovery, same philosophy as Seasons, not punishing.

## The Object — Split Lens

- One mandatory lens per chapter — not optional, not a branching-ending collectible (unlike Seasons' memory keys). Single story, single ending.
- The lens **gates the back half of each chapter**: puzzles requiring its power are mechanically unsolvable without it, so the gate is a necessity, not an arbitrary lock.
- Helios's half: glass fused/slumped by heat. Selene's half: the matching piece, preserved untouched, cold. Two halves of one object, split.

## Structure

- Two chapters: **01. Helios**, **02. Selene**. Strictly sequential — Selene locked on the chapter-select screen until Helios is completed.
- Each chapter is **one open room/space** (not a linear corridor, not a fully open explorable map) with **2-3 vantage points** (ground → climb → payoff), reachable in a soft, non-strict order.
- Vantage-point shape **rhymes** between the two chapters (same relative ground/midpoint/summit structure), so Helios builds intuition for reading Selene even as the mechanics invert.

## Visuals — Orange/Blue Complementary Gradient

Progress-driven color grade via fog + directional/ambient light tint. Favor neutral-toned/matte free 3D assets so they take the tint cleanly rather than fighting pre-colored textures.

| Stage | Color |
|---|---|
| Helios open | `#FF8C1A` |
| Helios mid | `#F5D9A8` |
| Helios close | `#F5F0E6` |
| Selene open | `#DCEFFA` |
| Selene mid | `#9CE6F7` |
| Selene close (pre-ending) | `#1B2A4A` |
| True ending | deep navy + one small saturated orange source breaking into frame |

## Ending Sequence

1. Player reaches Selene's final point, telescope fully assembled.
2. Player raises the telescope one final time — no puzzle, purely ceremonial, same verb used throughout.
3. Fade to full-screen cutscene image (deep navy, one orange point of light).
4. Closing myth text appears — short, myth-cadence, telling the Helios/Selene story in full for the first and only time.
5. Game ends permanently — no control returned to player. Static end screen: "Game is completed. Replay the game."

## UI / Menu Flow (mirrors Seasons' structure)

1. Landing/preview page — title, pitch, chapter screenshots.
2. Enter/start screen — Play, How to Play, VIVERSE-flavored options ("Use my VIVERSE avatar," "See records"). **Stub VIVERSE for now** — UI present, session/leaderboard calls no-op or show "unavailable." Full VIVERSE integration is a planned must-have, just not for the first build.
3. Built-in how-to-play guide — controls, telescope/aim explanation, introduced per-world as each lens unlocks.
4. Chapter selection page — Helios and Selene panels; Selene locked/greyed until Helios is completed.
5. Ending screen — myth text + image, replay option, "Submit my run" slot present but inert until VIVERSE is wired up.

## Suggested Repo Layout

```
src/
  main.js                 // game loop, chapter transitions, UI, pause flow, ending
  chapters/
    helios.js              // data-driven vantage points, lens location, gates
    selene.js
  world/
    ChapterLoader.js         // builds each chapter's runtime mechanics
    Telescope.js              // aim/lock-movement, per-world power state
    LensGates.js               // heat-gate / stabilize-gate interactables
  core/                      // input, camera, checkpoints, physics, color-grade utils
  viverse/
    ViverseSession.js          // stubbed for first build, real integration later
public/                      // chapter screenshots, cutscene image, guide assets
```

## Open / Not Yet Decided

- Exact key/input binding for raise/lower telescope (avoid colliding with other interactions).
- Ambient audio/music direction — sound-as-*mechanic* was explicitly deferred, but ambient mood audio hasn't been decided.
- Exact myth closing text (tone/length reference: a few lines, myth-cadence, not a full retelling).
