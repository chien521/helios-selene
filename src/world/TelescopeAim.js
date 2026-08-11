import * as THREE from 'three'

const SPOTLIGHT_RADIUS = 72
const FOCUS_SECONDS = 1.15

// The scope overlay. This used to own a hold-to-charge targeting system -- point the reticle at a
// static object, hold the mouse, watch a bar fill. Since the target could not move and the player
// could not fail, that was a loading bar rather than a challenge, and it was the chapter's only
// verb. Puzzles now live in routing sunlight through mirrors, so this is purely the visual state of
// looking through the telescope.
export class TelescopeAim {
  constructor(overlay, reticle, charge) {
    this.overlay = overlay
    this.reticle = reticle
    this.charge = charge
    this.raised = false
    this.holding = false
    this.focusAmount = 0
    this.focusedTarget = null
    this.pointer = new THREE.Vector2(.5, .5)
    this.projected = new THREE.Vector3()
  }

  raise(camera, playerPosition) {
    this.raised = true
    this.holding = false
    this.focusAmount = 0
    this.focusedTarget = null
    this.project(playerPosition, camera)
    this.overlay.classList.add('visible')
    this.render()
  }

  lower() {
    this.raised = false
    this.holding = false
    this.focusAmount = 0
    this.focusedTarget = null
    this.overlay.classList.remove('visible')
    this.render()
  }

  move(pointerX, pointerY) {
    if (!this.raised) return
    this.pointer.set(pointerX, pointerY)
    this.render()
  }

  project(position, camera) {
    this.projected.copy(position).project(camera)
    this.pointer.set((this.projected.x + 1) / 2, (1 - this.projected.y) / 2)
  }

  hovers(position, camera) {
    if (!this.raised) return false
    this.projected.copy(position).project(camera)
    if (this.projected.z < -1 || this.projected.z > 1) return false
    const x = (this.projected.x + 1) / 2
    const y = (1 - this.projected.y) / 2
    return Math.hypot((x - this.pointer.x) * innerWidth, (y - this.pointer.y) * innerHeight) <= SPOTLIGHT_RADIUS
  }

  beginFocus() {
    if (this.raised) this.holding = true
  }

  cancelFocus() {
    this.holding = false
    this.focusAmount = 0
    this.focusedTarget = null
    this.render()
  }

  updateFocus(delta, camera, targets) {
    if (!this.raised || !this.holding) return null
    const target = targets.find((entry) => entry.group.visible && this.hovers(entry.position, camera))
    if (!target || (this.focusedTarget && target !== this.focusedTarget)) {
      this.cancelFocus()
      return null
    }
    this.focusedTarget = target
    this.focusAmount = Math.min(1, this.focusAmount + delta / FOCUS_SECONDS)
    this.render()
    if (this.focusAmount < 1) return null
    const focused = this.focusedTarget
    this.cancelFocus()
    return focused
  }

  render() {
    this.reticle.style.left = `${this.pointer.x * 100}%`
    this.reticle.style.top = `${this.pointer.y * 100}%`
    this.overlay.style.setProperty('--aim-x', `${this.pointer.x * 100}%`)
    this.overlay.style.setProperty('--aim-y', `${this.pointer.y * 100}%`)
    this.charge.style.transform = `scaleX(${this.focusAmount})`
    this.overlay.classList.toggle('holding', this.holding)
  }
}
