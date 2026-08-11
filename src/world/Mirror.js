import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

const INTERACTION_RANGE = 2.6
// Slow enough that a player can stop the sweep on a target, since the angular window onto a distant
// mirror is only ~0.25rad wide. Tune together with MIRROR_RADIUS/RECEIVER_RADIUS in SunBeam.js.
const TURN_SPEED = .9
const DARK = '#3a2a18'

// A mirror throws light along the direction it faces. This is deliberately not a physically correct
// reflection about a surface normal: "the mirror sends light where it points" is something a player
// can read off the screen in one glance, whereas angle-of-incidence reasoning is invisible and
// unfun to debug by eye.
//
// `arc` is [min, max] in radians for a rotatable mirror, or null for a fixed relay -- a mirror
// bolted at a set angle that the player cannot turn. Fixed relays are the main authoring tool for
// building real puzzles: they can be placed where the player can never stand, so the question
// becomes "how do I get light TO that mirror" rather than "which way do I point this one".
export class Mirror {
  constructor(group, { id, x, y, angle = 0, arc = null, glow = '#ffd275' }) {
    this.id = id
    this.position = new THREE.Vector3(x, y, PLAYER_Z_DEPTH)
    this.arc = arc
    this.angle = arc ? Math.min(Math.max(angle, arc[0]), arc[1]) : angle
    this.sweep = 1
    this.lit = false
    this.glow = glow

    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    this.group.rotation.x = Math.PI / 2
    this.group.visible = false
    group.add(this.group)

    this.frame = new THREE.Mesh(
      new THREE.TorusGeometry(.78, .09, 10, 20),
      new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.5, roughness: .25 }),
    )
    this.face = new THREE.Mesh(
      new THREE.CircleGeometry(.66, 20),
      new THREE.MeshStandardMaterial({ color: '#f7e6b1', emissive: DARK, emissiveIntensity: .3, metalness: .8, roughness: .15, side: THREE.DoubleSide }),
    )
    this.face.position.z = .05
    this.group.add(this.frame, this.face)

    this.applyAngle()
  }

  applyAngle() {
    this.group.rotation.y = this.angle
  }

  direction() {
    return { x: Math.cos(this.angle), y: Math.sin(this.angle) }
  }

  inRange(playerPosition) {
    return this.group.visible && !!this.arc && playerPosition.distanceTo(this.position) <= INTERACTION_RANGE
  }

  reveal() {
    this.group.visible = true
  }

  // Ping-pongs between the arc's ends rather than stopping dead at one, so a single held key can
  // reach every angle without needing a second key to reverse.
  rotate(delta, rotating, playerPosition) {
    if (!rotating || !this.inRange(playerPosition)) return false
    const [min, max] = this.arc
    this.angle += delta * TURN_SPEED * this.sweep
    if (this.angle >= max) { this.angle = max; this.sweep = -1 }
    else if (this.angle <= min) { this.angle = min; this.sweep = 1 }
    this.applyAngle()
    return true
  }

  prompt(playerPosition) {
    return this.inRange(playerPosition) ? 'E / TURN MIRROR' : ''
  }

  setLit(lit) {
    const color = lit ? this.glow : DARK
    this.frame.material.emissive.set(color)
    this.frame.material.emissiveIntensity = lit ? 1.6 : .3
    this.face.material.emissive.set(color)
    this.face.material.emissiveIntensity = lit ? 1.1 : .3
  }
}

// A sky dot: latches permanently the first time a beam touches it. Used for the heliostat beat,
// which is now the tutorial for the chapter's core verb rather than a one-off.
export class Receiver {
  constructor(group, { id, x, y, glow = '#ffd275' }) {
    this.id = id
    this.position = new THREE.Vector3(x, y, PLAYER_Z_DEPTH)
    this.latched = false
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(.24, 12, 12),
      new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.1, roughness: .25 }),
    )
    this.mesh.position.copy(this.position)
    group.add(this.mesh)
  }

  latch() {
    if (this.latched) return false
    this.latched = true
    this.mesh.material.color.set('#ff2600')
    this.mesh.material.emissive.set('#ff2600')
    this.mesh.material.emissiveIntensity = 2.2
    this.mesh.scale.setScalar(1.35)
    return true
  }

  update(elapsed) {
    if (this.latched) return
    this.mesh.material.emissiveIntensity = 1.1 + Math.sin(elapsed * 2.4) * .35
  }
}
