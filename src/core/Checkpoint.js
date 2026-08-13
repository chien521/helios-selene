export class Checkpoint {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX
    this.spawnY = spawnY
    this.reset()
  }

  reset() {
    this.point = { x: this.spawnX, y: this.spawnY }
    this.solved = false
  }

  // Each chapter names its own spawn, so the crater can open somewhere other than Helios's hub.
  setSpawn(spawnX, spawnY) {
    this.spawnX = spawnX
    this.spawnY = spawnY
    this.reset()
  }

  // Call once per frame while the player is grounded on `platform`. Unconditional (no forward-only
  // ordering): the room is open and non-linear, so "further along" isn't well-defined spatially --
  // the checkpoint is simply the last solid ground the player stood on, which is always
  // route-aware and never punishing regardless of which branch they wandered into. `solves`
  // platforms are only physically reachable once the chapter's gate or bridge has actually been
  // dealt with, so standing on one is proof the puzzle is solved. Returns true the instant solved
  // flips false->true, so the caller can react once (e.g. update the objective text).
  update(platform, standingHeight) {
    this.point = { x: platform.safeX, y: standingHeight }
    if (platform.solves && !this.solved) {
      this.solved = true
      return true
    }
    return false
  }
}
