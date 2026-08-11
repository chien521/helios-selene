// Helios's room is authored here rather than inside ChapterLoader so puzzle tuning is a one-line
// data change. These puzzles will need many iterations to feel good; editing scene-construction
// code for every "try the mirror three units left" is what makes that expensive.
//
// The left branch holds the lockbox and heliostat tutorial. The right-side route is intentionally
// empty while its traversal and exit design is rebuilt.
export const helios = {
  id: 'helios',
  number: '01',
  title: 'Helios',
  subtitle: 'The day that would not soften.',
  palette: { open: '#ff8c1a', mid: '#f5d9a8', close: '#f5f0e6' },
  fragments: [],
  layout: {
    sunlitZones: [[-30, -18]],
    platforms: [
      { id: 'climb', x: -13.5, surfaceY: 1.5, w: 8, safeX: -10.5 },
      { id: 'vista', x: -25, surfaceY: 3, w: 10 },
    ],
    mirrors: [
      { id: 'heliostat', x: -25, y: 4.6, angle: 1.4, arc: [.6, 2.4] },
    ],
    receivers: [
      { id: 'sky-east', x: -21.6, y: 16 },
      { id: 'sky-west', x: -28.4, y: 18 },
    ],
    lensReceivers: ['sky-east', 'sky-west'],
    bridges: [],
    // A floating wall is melted into a high landing platform after the Helios lens is restored.
    // Its deck sits in the descending arc of the spring jump from the hub's right-edge spring.
    meltBridge: { wallX: 13.5, left: 13, right: 19, surfaceY: 8 },
    exitBridge: { left: 19, right: 25.5, surfaceY: 8.55, markerX: 16, markerY: 20 },
    exit: { x: 42, nearX: 26.8, surfaceY: 8.55, visible: true },
    lockboxOn: 'climb',
  },
}
