// Selene is being rebuilt from its opening shelf downward. The moon and first lockbox remain as the
// chapter's starting interaction; the lower crater is intentionally empty authoring space.
//
// THE VERB: raise the scope, hold the reticle on the moon, and its phase advances
// new -> full -> waning -> new. A platform is solid only during its own phase; a platform with no
// `phase` is stone and is solid always.
//
// title/subtitle used to live here as plain English; they are now looked up in i18n.js by chapter
// id ('selene.title' / 'selene.subtitle') so every locale reads its own copy.
export const selene = {
  id: 'selene',
  number: '02',
  palette: { open: '#dceffa', mid: '#9ce6f7', close: '#36577d' },
  spawn: [2, 1.1],
  layout: {
    glow: '#9ce6f7',
    gradeAxis: 'y',
    deathY: -44,
    platformHeight: .7,
    phases: ['new', 'full', 'waning'],
    startPhase: 'new',
    // x is centred on the sighted half of the crater, not on the crater as a whole: at 4:3 the
    // camera only carries ~15 units either side, and the moon has to stay on screen from every
    // platform above the moonline. y is the moonline itself -- see the header.
    moon: { x: 7, y: 12, radius: 1.6 },
    platforms: [
      // The retained first-puzzle platform and two matching landings beneath it.
      { id: 'shelf', x: 12.5, surfaceY: -3, w: 9, h: .7, safeX: 10.5 },
      // Each step is 1.75 units down: the 2.33-unit jump apex leaves room to return uphill.
      { id: 'full-step', x: 25, surfaceY: -4.75, w: 8, h: .7, phase: 'full' },
      { id: 'full-landing', x: 42, surfaceY: -4.75, w: 24, h: .7, safeX: 42 },
      { id: 'lower-shelf-one', x: 12.5, surfaceY: -6.5, w: 9, h: .7, safeX: 12.5 },
      { id: 'waning-step', x: 25, surfaceY: -8.25, w: 8, h: .7, phase: 'waning' },
      { id: 'waning-landing', x: 42, surfaceY: -8.25, w: 24, h: .7, safeX: 42 },
      { id: 'lower-shelf-two', x: 12.5, surfaceY: -10, w: 9, h: .7, safeX: 12.5 },
    ],
    lockbox: {
      on: 'shelf',
      glow: '#9ce6f7',
      glyphColor: '#c8f3ff',
      glyphShade: '#101c33',
      glyphs: ['new', 'full', 'waning'],
      // Also the order the sky dial turns in -- the box is the manual for the verb.
      solution: ['new', 'full', 'waning'],
      hintKey: 'selene.lockboxHint',
    },
    lensBox: {
      on: 'full-landing',
      glow: '#c8f3ff',
      glyphColor: '#e8fbff',
      glyphShade: '#101c33',
      glyphs: ['owl', 'fox', 'elephant', 'human'],
      solution: ['owl', 'fox', 'elephant', 'human'],
      ringSpacing: 1.25,
      interactionRange: 4.2,
      showFrameReward: false,
      hintKey: 'selene.lensBoxHint',
    },
    lens: { x: 46, y: -4.25, glow: '#e8fbff' },
    ladderWall: {
      x: 54.4,
      y: -6.5,
      height: 3.5,
      steps: [
        { x: 58, surfaceY: -6.45, w: 4.8, h: .7 },
      ],
    },
    exitTrigger: { x: 42, surfaceY: -8.25 },
    exit: { x: -40, nearX: 6.89, surfaceY: -10, visible: false },
  },
}
