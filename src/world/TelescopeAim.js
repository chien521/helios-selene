import * as THREE from 'three'

const RETICLE_RADIUS = 46
const HOLD_SECONDS = 1.15

export class TelescopeAim {
  constructor(overlay, reticle, charge) {
    this.overlay = overlay
    this.reticle = reticle
    this.charge = charge
    this.raised = false
    this.holding = false
    this.chargeAmount = 0
    this.lockedTarget = null
    this.pointer = new THREE.Vector2(.5, .5)
    this.projected = new THREE.Vector3()
  }

  raise(camera, playerPosition) {
    this.raised = true
    this.holding = false
    this.chargeAmount = 0
    this.lockedTarget = null
    this.project(playerPosition, camera)
    this.overlay.classList.add('visible')
    this.render()
  }

  lower() {
    this.raised = false
    this.holding = false
    this.chargeAmount = 0
    this.lockedTarget = null
    this.overlay.classList.remove('visible')
    this.render()
  }

  move(pointerX, pointerY) {
    if (!this.raised) return
    this.pointer.set(pointerX, pointerY)
    this.render()
  }

  beginHold() {
    if (!this.raised) return
    this.holding = true
  }

  cancelHold() {
    this.holding = false
    this.chargeAmount = 0
    this.lockedTarget = null
    this.render()
  }

  update(delta, camera, targets) {
    if (!this.raised) return null
    const target = this.findTarget(camera, targets)
    if (!this.holding) return null
    if (!target || (this.lockedTarget && target.id !== this.lockedTarget.id)) {
      this.cancelHold()
      return null
    }
    this.lockedTarget = target
    const holdSeconds = target.holdSeconds ?? HOLD_SECONDS
    this.chargeAmount = Math.min(1, this.chargeAmount + delta / holdSeconds)
    this.render()
    if (this.chargeAmount < 1) return null
    const resolved = this.lockedTarget
    this.cancelHold()
    return resolved
  }

  project(position, camera) {
    this.projected.copy(position).project(camera)
    this.pointer.set((this.projected.x + 1) / 2, (1 - this.projected.y) / 2)
  }

  findTarget(camera, targets) {
    return targets.find((target) => {
      if (!target.available()) return false
      this.projected.copy(target.position).project(camera)
      const x = (this.projected.x + 1) / 2
      const y = (1 - this.projected.y) / 2
      const distance = Math.hypot((x - this.pointer.x) * innerWidth, (y - this.pointer.y) * innerHeight)
      return this.projected.z >= -1 && this.projected.z <= 1 && distance <= RETICLE_RADIUS
    }) ?? null
  }

  render() {
    this.reticle.style.left = `${this.pointer.x * 100}%`
    this.reticle.style.top = `${this.pointer.y * 100}%`
    this.overlay.style.setProperty('--aim-x', `${this.pointer.x * 100}%`)
    this.overlay.style.setProperty('--aim-y', `${this.pointer.y * 100}%`)
    this.charge.style.transform = `scaleX(${this.chargeAmount})`
    this.overlay.classList.toggle('holding', this.holding)
  }
}
