import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

const GLYPHS = ['sun', 'moon', 'star']
const SOLUTION = ['sun', 'star', 'moon']
const INTERACTION_RANGE = 2.2
const PICKUP_RANGE = 1.6

const material = (color, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .35 })

function glyph(type, color) {
  const group = new THREE.Group()
  if (type === 'sun') {
    group.add(new THREE.Mesh(new THREE.CircleGeometry(.16, 16), material(color, 1.8)))
    for (let index = 0; index < 8; index += 1) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(.035, .16, .03), material(color, 1.7))
      const angle = index * Math.PI / 4
      ray.position.set(Math.cos(angle) * .32, Math.sin(angle) * .32, .03)
      ray.rotation.z = angle + Math.PI / 2
      group.add(ray)
    }
  } else if (type === 'moon') {
    group.add(new THREE.Mesh(new THREE.CircleGeometry(.3, 20), material(color, 1.8)))
    const cutout = new THREE.Mesh(new THREE.CircleGeometry(.27, 20), material('#352009', .1))
    cutout.position.set(.13, .05, .03)
    group.add(cutout)
  } else {
    const shape = new THREE.Shape()
    for (let index = 0; index < 10; index += 1) {
      const angle = Math.PI / 2 + index * Math.PI / 5
      const radius = index % 2 ? .14 : .34
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()
    group.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), material(color, 1.8)))
  }
  return group
}

export class Lockbox {
  constructor(group, { x, surfaceY, shadow, glow }) {
    this.x = x
    this.surfaceY = surfaceY
    this.group = new THREE.Group()
    this.group.position.set(x, surfaceY, PLAYER_Z_DEPTH)
    group.add(this.group)
    this.dials = [1, 2, 0]
    this.opened = false
    this.collider = { x, y: surfaceY + .85, w: 3.15, h: 1.7 }
    this.ringPositions = [-.72, 0, .72]
    this.rings = []

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.15, 1.7, 1.1), material(shadow, .25))
    body.position.y = .85
    this.group.add(body)
    this.lid = new THREE.Mesh(new THREE.BoxGeometry(3.28, .28, 1.2), material(glow, .65))
    this.lid.position.set(0, 1.84, 0)
    this.group.add(this.lid)
    this.frame = new THREE.Mesh(new THREE.TorusGeometry(.48, .1, 10, 20), material(glow, 2))
    this.frame.position.set(x, surfaceY + .48, PLAYER_Z_DEPTH + .65)
    this.frame.visible = false
    group.add(this.frame)

    this.ringPositions.forEach((xPosition, index) => {
      const ring = new THREE.Group()
      ring.position.set(xPosition, .9, .6)
      this.group.add(ring)
      this.rings.push(ring)
      this.setGlyph(index)
    })
  }

  setGlyph(index) {
    const ring = this.rings[index]
    if (ring.glyph) ring.remove(ring.glyph)
    ring.glyph = glyph(GLYPHS[this.dials[index]], '#f5b45d')
    ring.glyph.position.z = .08
    ring.add(ring.glyph)
  }

  nearestDial(playerPosition) {
    let nearest = -1
    let distance = INTERACTION_RANGE
    this.rings.forEach((ring, index) => {
      const worldPosition = new THREE.Vector3()
      ring.getWorldPosition(worldPosition)
      const candidate = playerPosition.distanceTo(worldPosition)
      if (candidate < distance) {
        distance = candidate
        nearest = index
      }
    })
    return nearest
  }

  interact(playerPosition) {
    if (this.opened) return null
    const dial = this.nearestDial(playerPosition)
    if (dial < 0) return null
    this.dials[dial] = (this.dials[dial] + 1) % GLYPHS.length
    this.setGlyph(dial)
    if (this.dials.every((value, index) => GLYPHS[value] === SOLUTION[index])) {
      this.opened = true
      this.collider = null
      this.group.visible = false
      this.frame.visible = true
      return { opened: true }
    }
    return { opened: false }
  }

  prompt(playerPosition) {
    if (this.opened || this.nearestDial(playerPosition) < 0) return ''
    return 'E / TURN DIAL\nH / HINT'
  }

  collectFrame(playerPosition) {
    if (!this.frame.visible || playerPosition.distanceTo(this.frame.position) >= PICKUP_RANGE) return false
    this.frame.visible = false
    return true
  }

  update(elapsed) {
    this.rings.forEach((ring, index) => { ring.rotation.z = Math.sin(elapsed * 1.4 + index) * .035 })
    if (this.frame.visible) this.frame.rotation.z += .025
  }
}