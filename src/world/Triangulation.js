import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

const PICKUP_RANGE = 1.6

export class Triangulation {
  constructor(group, { lensPosition, glow }) {
    this.group = group
    this.lensPosition = new THREE.Vector3(lensPosition.x, lensPosition.y, PLAYER_Z_DEPTH)

    const material = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.4, roughness: .2 })
    this.lens = new THREE.Mesh(new THREE.TorusGeometry(.52, .11, 10, 20), material.clone())
    this.lens.position.copy(this.lensPosition)
    this.lens.visible = false
    group.add(this.lens)
  }

  revealLens() {
    if (this.lens.visible) return false
    this.lens.visible = true
    return true
  }

  collectLens(playerPosition) {
    if (!this.lens.visible || playerPosition.distanceTo(this.lensPosition) >= PICKUP_RANGE) return false
    this.lens.visible = false
    return true
  }

  update() {
    if (this.lens.visible) this.lens.rotation.z += .025
  }
}
