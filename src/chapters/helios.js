// Helios's room is authored here rather than inside ChapterLoader so puzzle tuning is a one-line
// data change. These puzzles will need many iterations to feel good; editing scene-construction
// code for every "try the mirror three units left" is what makes that expensive.
//
// The pit floor, both springs, the lens box and the lens pickup used to be hard-coded in
// ChapterLoader and read off `this.lowerPlatform`, which meant Selene silently inherited all of
// them. They are declared here now; the values are exactly what the loader used to build.
// title/subtitle used to live here as plain English; they are now looked up in i18n.js by chapter
// id ('helios.title' / 'helios.subtitle') so every locale reads its own copy.
export const helios = {
  id: 'helios',
  number: '01',
  palette: { open: '#ff8c1a', mid: '#f5d9a8', close: '#f5f0e6' },
  layout: {
    glow: '#ffd275',
    lightZones: [[-30, -18]],
    pit: { x: 0, surfaceY: -9, w: 18 },
    platforms: [
      { id: 'climb', x: -13.5, surfaceY: 1.5, w: 8, safeX: -10.5 },
      { id: 'vista', x: -25, surfaceY: 3, w: 10 },
    ],
    springs: [
      { id: 'spring', on: 'pit', revealed: true },
      { id: 'upperSpring', on: 'hub' },
    ],
    mirrors: [
      { id: 'heliostat', x: -25, y: 4.6, angle: 1.4, fullRotation: true },
    ],
    receivers: [
      { id: 'sky-east', x: -21.6, y: 16, glow: '#36C7FF' },
      { id: 'sky-west', x: -28.4, y: 18, glow: '#36C7FF' },
    ],
    lensReceivers: ['sky-east', 'sky-west'],
    lockbox: { on: 'climb', glow: '#f5b45d' },
    lensBox: {
      on: 'pit',
      glyphs: ['fire', 'wind', 'dust', 'ice'],
      solution: ['fire', 'wind', 'dust', 'ice'],
      ringSpacing: 1.25,
      interactionRange: 4.2,
      showFrameReward: false,
      hintLines: [
        'The first could not be held.',
        'The second could not stay.',
        'The third could not remember.',
        'The fourth could not forget.',
      ],
    },
    lens: { x: 0, y: -8.45 },
    meltBridge: { wallX: 13.5, left: 13, right: 19, surfaceY: 8 },
    exitBridge: { left: 19, right: 25.5, surfaceY: 8.55, markerX: 16, markerY: 20 },
    exit: { x: 42, nearX: 26.8, surfaceY: 8.55, visible: true },
  },
}
