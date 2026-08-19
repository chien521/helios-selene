# Helios & Selene

A quiet 3D puzzle adventure about two skies that cannot share a horizon. Guide a nameless traveler through **Helios**, the sun's domain, and **Selene**, the moon's domain, gathering the two halves of an unfinished telescope so its two lovers can, for one moment, be seen together through the same glass.

No dialogue, no on-screen explanation — the story is told wordlessly through play, and in full only once, at the very end.

Built with Three.js, Vite, and vanilla ES modules.

## Live Demo

[Play Helios & Selene](https://chien521.github.io/helios-selene/)

## Play locally

Prerequisite: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Build a production bundle with:

```bash
npm run build
```

Preview that bundle with:

```bash
npm run preview
```

## Deploy to VIVERSE

Create the VIVERSE upload archive with:

```bash
npm run package:viverse
```

This creates `helios-selene-viverse.zip` at the project root. Upload that ZIP file to
VIVERSE. Its root contains `index.html` and `assets/`; do not zip the project folder
or the `dist/` folder around it, as that can add extra directory levels that VIVERSE
cannot find.

The VIVERSE bundle uses relative asset URLs, so it also works from the platform's
content URL rather than only from the GitHub Pages path. GitHub Pages uses the
dedicated `npm run build:github-pages` command in its deployment workflow.

## Controls

| Action | Control |
| --- | --- |
| Move | W, A, S, D (or arrow keys) |
| Jump | W or Up Arrow |
| Interact / turn a mirror | E |
| Select a lockbox dial | Q |
| Raise or lower the magnifier / telescope | R |
| Focus | Hold Q while raised |
| Moon view | Space |
| Pause | Escape |

The same instrument is called the **magnifier** in Helios and the **telescope** in Selene — same key, same mechanic, different name for where you are.

## Chapters

**01 · Helios — "The day that would not soften."** Solve lockbox dials to reveal a network of rotatable mirrors, then raise the magnifier and focus on a correctly aligned mirror to latch its receiver and route sunlight forward.

**02 · Selene — "Locked until Helios is complete."** Raise the telescope on the moon to cycle its phase (new → full → waning). Each phase makes different crater ledges solid, so the way down is chosen before you jump, not after.

Selene unlocks automatically once Helios is finished — progress is saved locally in the browser.

## Menus & extras

- **Chapter select, pause menu, and a restart-game dialog**, all reachable mid-run.
- **A guided "Gameplay walkthrough"** from the start screen — a short, skippable step-by-step tutorial covering movement, jumping, lockbox dials, and the magnifier, before the real chapters begin.
- **14 languages** (English, Traditional & Simplified Chinese, Japanese, Russian, Spanish, Portuguese, French, German, Italian, Korean, Hindi, Arabic, Thai), selected once up front and changeable again from the pause menu.
- **Optional VIVERSE integration**: connect a VIVERSE avatar/login, and submit a completed run's time to a global speedrun leaderboard visible from "See records" on the start screen. Entirely optional — the game is fully playable as a guest with no account.

## Project structure

```text
src/
  main.js       Game state, UI, input, i18n wiring, and chapter transitions
  i18n.js       All UI strings, in 14 languages
  chapters/     Declarative layouts for the Helios/Selene rooms and the tutorial
  core/         Player movement, physics, camera, checkpoints
  world/        Puzzles, interactables, lighting, and world loading
  viverse/      VIVERSE login, avatar, and leaderboard session
```

## Notes

- Progress (chapter completion, language) is stored locally in the browser; the speedrun timer and leaderboard are the only features that talk to a server (VIVERSE's), and only if you opt in.
- The project has no backend of its own, no test runner, and no CI configuration.
- To enable the leaderboard locally, copy `.env.example` to `.env` and fill in your own VIVERSE app credentials; without it, the game runs normally but "See records" has nothing to show.