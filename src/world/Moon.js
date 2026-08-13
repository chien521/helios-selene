import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

// Selene's dial. Helios's telescope is passive -- sunlight arrives from outside the room, mirrors
// route it, and the scope only confirms what the routing already decided. Selene inverts that: the
// scope *acts*. Holding focus on the moon advances its phase, and the phase decides which surfaces
// in the crater are solid.
//
// The moon deliberately has no line-of-sight test against terrain. It does not need one: it is
// focusable exactly when it is on screen, and TelescopeAim.hovers() already enforces that (it
// projects the position and rejects anything the reticle cannot reach). With the camera pinned at
// player.y + 5 and ~11.33 units of half-height, that reduces to a single readable rule --
//
//     the moon is reachable while player.y > moonY - 16.33
//
// -- i.e. THE MOON SETS AS YOU DESCEND. That one line is the chapter's whole difficulty curve:
// every chamber below the moonline has to be entered on a phase chosen before the drop, and the
// moonpools exist to buy the phase back once you are under it. Tune the beat by moving a platform's
// surfaceY relative to the moon, not by adding gates.
const HALO_SCALE = 2.6
const NEW_MOON = '#1b2029'
const NEW_RIM = '#4a5361'
const FULL_MOON = '#ffe6a3'
const FULL_CRATER = '#d7b66d'
const MOON_RIM = '#fff3c9'

function addCraters(group, radius, color, positions) {
  positions.forEach(([xOffset, yOffset, size]) => {
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(radius * size, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .46 }),
    )
    crater.position.set(radius * xOffset, radius * yOffset, .03)
    group.add(crater)
  })
}

function crescentGeometry(radius) {
  const shape = new THREE.Shape()
  shape.moveTo(-radius * .44, -radius * .9)
  shape.bezierCurveTo(radius * .42, -radius * .86, radius * .9, -radius * .2, radius * .66, radius * .48)
  shape.bezierCurveTo(radius * .44, radius * .92, -radius * .18, radius * 1.02, -radius * .44, radius * .9)
  shape.bezierCurveTo(radius * .08, radius * .48, radius * .1, -radius * .43, -radius * .44, -radius * .9)
  return new THREE.ShapeGeometry(shape)
}

export class Moon {
  constructor(group, { x, y, radius = 1.5, phases, phase, glow = '#e8f7ff' }) {
    this.phases = phases
    this.index = Math.max(0, phases.indexOf(phase))
    this.position = new THREE.Vector3(x, y, PLAYER_Z_DEPTH)

    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    group.add(this.group)

    // Each phase owns its own module. This lets the moon read as three deliberate celestial forms
    // instead of a single disc with a different shadow offset.
    this.modules = {
      new: this.createNewMoon(radius),
      full: this.createFullMoon(radius),
      waning: this.createWaningMoon(radius),
    }
    Object.values(this.modules).forEach((module) => this.group.add(module.group))

    this.radius = radius
    this.applyPhase()
  }

  get phase() {
    return this.phases[this.index]
  }

  createNewMoon(radius) {
    const group = new THREE.Group()
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({ color: NEW_MOON }),
    )
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * .96, radius * .025, 8, 32),
      new THREE.MeshBasicMaterial({ color: NEW_RIM, transparent: true, opacity: .72 }),
    )
    rim.position.z = .04
    group.add(disc, rim)
    return { group, pulse: null }
  }

  createFullMoon(radius) {
    const group = new THREE.Group()
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(radius * HALO_SCALE, 32),
      new THREE.MeshBasicMaterial({ color: FULL_MOON, transparent: true, opacity: .14 }),
    )
    halo.position.z = -.04
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({ color: FULL_MOON }),
    )
    const craters = new THREE.Group()
    addCraters(craters, radius, FULL_CRATER, [[-.28, .32, .1], [.31, .2, .075], [-.05, -.18, .13], [.36, -.36, .055], [-.43, -.28, .06]])
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * .96, radius * .025, 8, 32),
      new THREE.MeshBasicMaterial({ color: MOON_RIM, transparent: true, opacity: .62 }),
    )
    rim.position.z = .05
    group.add(halo, disc, craters, rim)
    return { group, pulse: halo, pulseBase: .14 }
  }

  createWaningMoon(radius) {
    const group = new THREE.Group()
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(radius * HALO_SCALE, 32),
      new THREE.MeshBasicMaterial({ color: FULL_MOON, transparent: true, opacity: .06 }),
    )
    halo.position.z = -.04
    const crescent = new THREE.Mesh(
      crescentGeometry(radius),
      new THREE.MeshBasicMaterial({ color: FULL_MOON }),
    )
    const craters = new THREE.Group()
    addCraters(craters, radius, FULL_CRATER, [[.28, -.38, .06], [.46, .04, .055], [.25, .47, .045]])
    group.add(halo, crescent, craters)
    return { group, pulse: halo, pulseBase: .06 }
  }

  applyPhase() {
    Object.entries(this.modules).forEach(([name, module]) => {
      module.group.visible = name === this.phase
    })
  }

  hide() {
    this.group.visible = false
  }

  reveal() {
    this.group.visible = true
  }

  advance() {
    this.index = (this.index + 1) % this.phases.length
    this.applyPhase()
    return this.phase
  }

  update(elapsed) {
    if (!this.group.visible) return
    const active = this.modules[this.phase]
    if (active?.pulse) active.pulse.material.opacity = active.pulseBase + Math.sin(elapsed * 1.3) * .02
  }
}
