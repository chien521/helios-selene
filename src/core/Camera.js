import * as THREE from 'three'

const OFFSET = { x: 0, y: 5, z: 32 }

export class FollowCamera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(39, innerWidth / innerHeight, .1, 100)
    this.reveal = null
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
  }

  // Match What the Snow Remembers' shallow side-on framing: a close, narrow field of view with
  // the camera aimed just below its own height, rather than steeply down at the player.
  lookForward() {
    this.camera.lookAt(this.camera.position.x, this.camera.position.y - .5, this.camera.position.z - OFFSET.z)
  }

  snapTo(player) {
    this.camera.position.set(player.position.x + OFFSET.x, player.position.y + OFFSET.y, player.position.z + OFFSET.z)
    this.lookForward()
  }

  revealObject(position) {
    this.reveal = { target: position.clone(), phase: 'to-object', elapsed: 0 }
  }

  cancelReveal() {
    this.reveal = null
  }

  update(delta, player) {
    const factor = 1 - Math.exp(-delta * 4)
    const playerTarget = {
      x: player.position.x + OFFSET.x,
      y: player.position.y + OFFSET.y,
      z: player.position.z + OFFSET.z,
    }
    let revealFinished = false
    if (this.reveal) {
      this.reveal.elapsed += delta
      const target = this.reveal.phase === 'to-player'
        ? playerTarget
        : { x: this.reveal.target.x + OFFSET.x, y: this.reveal.target.y + OFFSET.y, z: this.reveal.target.z + OFFSET.z }
      const revealFactor = 1 - Math.exp(-delta * 2.2)
      this.camera.position.x += (target.x - this.camera.position.x) * revealFactor
      this.camera.position.y += (target.y - this.camera.position.y) * revealFactor
      this.camera.position.z += (target.z - this.camera.position.z) * revealFactor
      if (this.reveal.phase === 'to-object' && this.reveal.elapsed >= 1.4) {
        this.reveal = { ...this.reveal, phase: 'hold', elapsed: 0 }
      } else if (this.reveal.phase === 'hold' && this.reveal.elapsed >= 1.2) {
        this.reveal = { ...this.reveal, phase: 'to-player', elapsed: 0 }
      } else if (this.reveal.phase === 'to-player' && this.reveal.elapsed >= 1.4) {
        this.reveal = null
        revealFinished = true
      }
    } else {
      this.camera.position.x += (playerTarget.x - this.camera.position.x) * factor
      this.camera.position.y += (playerTarget.y - this.camera.position.y) * factor
      this.camera.position.z += (playerTarget.z - this.camera.position.z) * factor
    }
    this.lookForward()
    return revealFinished
  }
}
