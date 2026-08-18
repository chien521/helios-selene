// The walkthrough is intentionally separate from Helios's full Chapter 1 route.
export const heliosTutorial = {
  id: 'helios',
  number: '01',
  spawn: [-25, 1.1],
  palette: { open: '#ff8c1a', mid: '#f5d9a8', close: '#f5f0e6' },
  layout: {
    glow: '#ffd275',
    hub: { x: -25, surfaceY: 0, w: 7 },
    lightZones: [[-8, 2]],
    platforms: [
      { id: 'climb', x: -14.5, surfaceY: 1.5, w: 8, safeX: -14.5 },
      { id: 'vista', x: -3, surfaceY: 3, w: 10 },
    ],
    mirrors: [
      { id: 'heliostat', x: -3, y: 4.6, angle: -.7, arc: [-1, .8] },
    ],
    lockbox: {
      on: 'climb', glow: '#f5b45d', glyphs: ['1', '2', '3'], solution: ['1', '2', '3'],
      hintKey: 'helios.tutorialLockboxHint',
    },
    receivers: [{ id: 'doorway-dot', x: 0, y: 8, hidden: true }],
    exit: { x: 2, nearX: 2, surfaceY: 3, visible: false },
  },
}
