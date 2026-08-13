# Helios & Selene

A quiet 3D puzzle adventure about two skies that cannot share a horizon. Guide a traveler through **Helios**, the sun's domain, and **Selene**, the moon's domain, to complete an instrument that can hold both lights in one view.

Built with Three.js, Vite, and vanilla ES modules.

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

## Controls

| Action | Control |
| --- | --- |
| Move | W, A, S, D |
| Jump | W or Up Arrow |
| Interact / turn a mirror | E |
| Select a lockbox dial | Q |
| Raise or lower the magnifier / telescope | R |
| Focus | Hold left mouse button while raised |
| Moon view | Space |
| Pause | Escape |

## Chapters

**Helios** uses a magnifier to route sunlight through rotatable mirrors. Focus on a correctly aligned mirror to latch its receiver and open the route forward.

**Selene** uses a telescope to change the moon phase. Each phase makes different crater ledges solid; raise the telescope to reveal the hidden route.

## Project structure

```text
src/
  main.js             Game state, UI, input, and chapter transitions
  chapters/           Declarative layouts for Helios and Selene
  core/               Player movement, physics, camera, checkpoints
  world/              Puzzles, interactables, lighting, and world loading
  viverse/            Local VIVERSE session stub
```

## Notes

- Progress is stored locally in the browser so Selene unlocks after Helios is complete.
- The project has no backend, test runner, or CI configuration.
- VIVERSE controls are present as local-build placeholders.