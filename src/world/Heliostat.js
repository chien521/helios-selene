import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

const INTERACTION_RANGE = 2.6
const TURN_SPEED = 1.8
const ALIGNMENT_TOLERANCE = .14

const material = (color, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .25 })

export class Heliostat {
  constructor(group, { position, glow }) {
    this.group = group
    this.position = new THREE.Vector3(position.x, position.y, PLAYER_Z_DEPTH)
    this.glow = glow
    this.revealed = false
    this.aimActive = false
    this.rotationAngle = 0
    this.resolved = new Set()

    this.mirror = new THREE.Group()
    this.mirror.position.copy(this.position)
    this.mirror.rotation.x = Math.PI / 2
    this.mirror.visible = false
    const frame = new THREE.Mesh(new THREE.TorusGeometry(.78, .09, 10, 20), material(glow, 1.5))
    const face = new THREE.Mesh(new THREE.CircleGeometry(.66, 20), new THREE.MeshStandardMaterial({ color: '#f7e6b1', emissive: glow, emissiveIntensity: .5, metalness: .75, roughness: .15 }))
    face.position.z = .05
    this.mirror.add(frame, face)
    group.add(this.mirror)

    this.receivers = [
      { id: 'heliostat-east', position: new THREE.Vector3(position.x + 3.4, position.y + 3.2, PLAYER_Z_DEPTH) },
      { id: 'heliostat-west', position: new THREE.Vector3(position.x - 3.4, position.y + 3.9, PLAYER_Z_DEPTH) },
    ]
    this.receivers.forEach((receiver) => {
      receiver.mesh = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 12), material(glow, 1.2))
      receiver.mesh.position.copy(receiver.position)
      receiver.mesh.visible = false
      group.add(receiver.mesh)
    })

    this.previewBeam = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: glow, transparent: true, opacity: .5 }),
    )
    this.previewBeam.visible = false
    group.add(this.previewBeam)
  }

  reveal() {
    if (this.revealed) return false
    this.revealed = true
    this.mirror.visible = true
    this.receivers.forEach((receiver) => { receiver.mesh.visible = true })
    return true
  }

  rotate(delta, rotating, playerPosition) {
    if (!this.revealed || !rotating || playerPosition.distanceTo(this.position) > INTERACTION_RANGE) return false
    this.rotationAngle = (this.rotationAngle + delta * TURN_SPEED) % (Math.PI * 2)
    this.mirror.rotation.y = this.rotationAngle
    return true
  }

  prompt(playerPosition) {
    return this.revealed && playerPosition.distanceTo(this.position) <= INTERACTION_RANGE ? 'E / ROTATE MIRROR' : ''
  }

  targets(playerPosition, aimActive) {
    if (!this.revealed || !aimActive) return []
    return [{ id: 'heliostat-mirror', position: this.position, available: () => this.revealed }]
  }

  resolve() {
    const receiver = this.activeReceiver()
    if (!this.revealed || !receiver || this.resolved.has(receiver.id)) return false
    this.resolved.add(receiver.id)
    receiver.mesh.visible = true
    receiver.mesh.material.color.set('#ff2600')
    receiver.mesh.material.emissive.set('#ff2600')
    return true
  }

  get complete() {
    return this.resolved.size === this.receivers.length
  }

  update(elapsed, playerPosition, aimActive) {
    if (!this.revealed) return
    this.receivers.forEach((receiver, index) => {
      receiver.mesh.visible = true
      receiver.mesh.scale.setScalar(1)
    })
    this.previewBeam.visible = aimActive
    if (aimActive) {
      const receiver = this.activeReceiver()
      const reflectedEnd = receiver?.position ?? this.reflectedEnd()
      this.previewBeam.geometry.setFromPoints([playerPosition, this.position, reflectedEnd])
    }
  }

  activeReceiver() {
    return this.receivers.find((receiver) => {
      const offset = receiver.position.clone().sub(this.position)
      const angle = Math.atan2(offset.y, offset.x)
      const difference = Math.atan2(Math.sin(this.rotationAngle - angle), Math.cos(this.rotationAngle - angle))
      return Math.abs(difference) <= ALIGNMENT_TOLERANCE
    }) ?? null
  }

  reflectedEnd() {
    return this.position.clone().add(new THREE.Vector3(Math.cos(this.rotationAngle), Math.sin(this.rotationAngle), 0).multiplyScalar(12))
  }
}
