import * as THREE from 'three'
import { moveAndCollide } from './Physics2D.js'

export const PLAYER_Z_DEPTH = -4
const SPEED = 8
const JUMP_VELOCITY = 10
const SPRING_VELOCITY = 23
const GRAVITY = 26

export class Player {
  constructor(scene, spawnX, spawnY) {
    this.body = { x: spawnX, y: spawnY, vx: 0, vy: 0, hw: .5, hh: 1.1, grounded: false }
    this.position = new THREE.Vector3(spawnX, spawnY, PLAYER_Z_DEPTH)
    this.mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(.5, 1.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: .7 }),
    )
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  reset(spawnX, spawnY) {
    Object.assign(this.body, { x: spawnX, y: spawnY, vx: 0, vy: 0, grounded: false })
    this.position.set(spawnX, spawnY, PLAYER_Z_DEPTH)
    this.mesh.position.copy(this.position)
  }

  jump() {
    if (this.body.grounded) this.body.vy = JUMP_VELOCITY
  }

  launchFromSpring() {
    this.body.vy = SPRING_VELOCITY
    this.body.grounded = false
  }

  update(delta, axis, colliders) {
    this.body.vx = axis * SPEED
    this.body.vy -= GRAVITY * delta
    moveAndCollide(this.body, delta, colliders)
    this.position.set(this.body.x, this.body.y, PLAYER_Z_DEPTH)
    this.mesh.position.copy(this.position)
  }
}
