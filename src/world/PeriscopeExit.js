import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

export class PeriscopeExit {
  constructor(group, { x, nearX = x, surfaceY, glow, visible = false }) {
    this.position = new THREE.Vector3(x, surfaceY + 2.2, PLAYER_Z_DEPTH)
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

  setPulledCloser(pulledCloser) {
    this.pulledCloser = pulledCloser
  }

  reached(playerPosition) {
    return this.group.visible && playerPosition.distanceTo(this.position) < 2
  }

  update(elapsed, delta = 0) {
    if (!this.group.visible) return
    if (delta > 0) {
      const targetX = this.pulledCloser ? this.nearX : this.homeX
      const factor = 1 - Math.exp(-delta * 5)
      this.position.x += (targetX - this.position.x) * factor
      this.group.position.copy(this.position)
    }
    const opening = this.group.children[3]
    opening.material.emissiveIntensity = 2.2 + Math.sin(elapsed * 2.4) * .45
  }
}
