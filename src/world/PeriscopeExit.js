import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

// The doorway. Helios pulls it in horizontally while the scope is raised -- walking toward it with
// the glass up is what closes the distance. Selene reuses the same easing on the other axis:
// `riseTo` makes the door climb out of the water while the player holds focus on it, and sink back
// the moment they look away. Same object, same one-line ease, opposite axis and opposite condition.
export class PeriscopeExit {
  constructor(group, { x, nearX = x, surfaceY, riseTo, glow, visible = false }) {
    this.homeY = surfaceY + 2.2
    this.nearY = riseTo ?? this.homeY
    this.position = new THREE.Vector3(x, this.homeY, PLAYER_Z_DEPTH)
    this.homeX = x
    this.nearX = nearX
    this.pulledCloser = false
    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    this.group.visible = visible
    this.glow = glow

    const frame = new THREE.MeshStandardMaterial({ color: '#342313', emissive: glow, emissiveIntensity: .8, roughness: .4 })
    const light = new THREE.MeshStandardMaterial({ color: '#fff3bf', emissive: glow, emissiveIntensity: 2.5, roughness: .2 })
    const left = new THREE.Mesh(new THREE.BoxGeometry(.32, 4.4, 1.1), frame)
    const right = left.clone()
    left.position.x = -.95
    right.position.x = .95
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.2, .32, 1.1), frame)
    lintel.position.y = 2.05
    const opening = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 3.8), light)
    opening.position.z = .57
    this.group.add(left, right, lintel, opening)
    group.add(this.group)
  }

  reveal() {
    if (this.group.visible) return false
    this.group.visible = true
    return true
  }

  setPulledCloser(pulledCloser, nearX = this.nearX) {
    this.pulledCloser = pulledCloser
    this.nearX = nearX
  }

  reached(playerPosition) {
    return this.group.visible && playerPosition.distanceTo(this.position) < 2
  }

  update(elapsed, delta = 0) {
    if (!this.group.visible) return
    if (delta > 0) {
      const targetX = this.pulledCloser ? this.nearX : this.homeX
      const targetY = this.pulledCloser ? this.nearY : this.homeY
      const factor = 1 - Math.exp(-delta * 5)
      this.position.x += (targetX - this.position.x) * factor
      this.position.y += (targetY - this.position.y) * factor
      this.group.position.copy(this.position)
    }
    const opening = this.group.children[3]
    opening.material.emissiveIntensity = 2.2 + Math.sin(elapsed * 2.4) * .45
  }
}
