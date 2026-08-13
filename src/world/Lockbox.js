import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

const DEFAULT_GLYPHS = ['sun', 'moon', 'star']
const DEFAULT_SOLUTION = ['sun', 'star', 'moon']
const DEFAULT_HINT = [
  'He rose alone, and could not stay.',
  'Between them scattered a thousand small witnesses.',
  'She came after, wearing what light he left behind.',
]
const INTERACTION_RANGE = 2.2
const PICKUP_RANGE = 1.6

const material = (color, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .35 })

// `shade` is the colour a carved-out region is painted in -- crescents are made by laying a
// near-dark disc over a bright one, so it has to match the box it sits in or the cutout reads as a
// second lit shape. Helios's boxes keep the original brown; Selene passes a navy.
function glyph(type, color, shade = '#352009') {
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
    const cutout = new THREE.Mesh(new THREE.CircleGeometry(.27, 20), material(shade, .1))
    cutout.position.set(.13, .05, .03)
    group.add(cutout)
  } else if (type === 'full') {
    // Selene's three phases share one construction -- a lit disc with a shade disc slid across it --
    // so the dials read as one moon turning rather than three unrelated symbols. Same trick the
    // sky's Moon uses; see Moon.applyPhase().
    group.add(new THREE.Mesh(new THREE.CircleGeometry(.3, 20), material(color, 1.8)))
  } else if (type === 'waning') {
    group.add(new THREE.Mesh(new THREE.CircleGeometry(.3, 20), material(color, 1.8)))
    const cutout = new THREE.Mesh(new THREE.CircleGeometry(.28, 20), material(shade, .1))
    cutout.position.set(.16, 0, .03)
    group.add(cutout)
  } else if (type === 'new') {
    group.add(new THREE.Mesh(new THREE.CircleGeometry(.3, 20), material(color, 1.8)))
    const cutout = new THREE.Mesh(new THREE.CircleGeometry(.255, 20), material(shade, .1))
    cutout.position.set(0, 0, .03)
    group.add(cutout)
  } else if (type === 'owl') {
    group.add(new THREE.Mesh(new THREE.CircleGeometry(.3, 20), material(color, 1.8)))
    for (const x of [-.16, .16]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.13, .28, 3), material(color, 1.8))
      ear.position.set(x, .3, .03)
      group.add(ear)
      const eye = new THREE.Mesh(new THREE.CircleGeometry(.07, 12), material(shade, .1))
      eye.position.set(x, .02, .04)
      group.add(eye)
    }
  } else if (type === 'fox') {
    const face = new THREE.Shape()
    face.moveTo(0, -.38)
    face.lineTo(-.32, .22)
    face.lineTo(-.26, .48)
    face.lineTo(0, .3)
    face.lineTo(.26, .48)
    face.lineTo(.32, .22)
    face.lineTo(0, -.38)
    group.add(new THREE.Mesh(new THREE.ShapeGeometry(face), material(color, 1.8)))
    const snout = new THREE.Mesh(new THREE.CircleGeometry(.1, 12), material(shade, .1))
    snout.position.set(0, -.15, .03)
    group.add(snout)
  } else if (type === 'elephant') {
    group.add(new THREE.Mesh(new THREE.CircleGeometry(.27, 20), material(color, 1.8)))
    for (const x of [-.28, .28]) {
      const ear = new THREE.Mesh(new THREE.CircleGeometry(.2, 16), material(color, 1.5))
      ear.position.set(x, .04, -.01)
      group.add(ear)
    }
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(.13, .42, .03), material(color, 1.8))
    trunk.position.set(0, -.32, .03)
    group.add(trunk)
  } else if (type === 'human') {
    const head = new THREE.Mesh(new THREE.CircleGeometry(.15, 16), material(color, 1.8))
    head.position.y = .28
    group.add(head)
    const body = new THREE.Mesh(new THREE.BoxGeometry(.22, .38, .03), material(color, 1.8))
    body.position.y = -.08
    group.add(body)
    for (const x of [-.15, .15]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.07, .24, .03), material(color, 1.8))
      leg.position.set(x, -.36, .03)
      group.add(leg)
    }
  } else if (type === 'star') {
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
  } else if (type === 'fire') {
    const shape = new THREE.Shape()
    shape.moveTo(-.16, .5)
    shape.bezierCurveTo(-.44, .34, -.39, .12, -.2, -.1)
    shape.bezierCurveTo(-.42, -.23, -.35, -.48, -.04, -.52)
    shape.bezierCurveTo(.3, -.56, .5, -.34, .36, -.08)
    shape.bezierCurveTo(.49, .08, .45, .34, .26, .2)
    shape.bezierCurveTo(.22, .38, .05, .31, -.16, .5)

    const leftCutout = new THREE.Path()
    leftCutout.moveTo(-.22, .13)
    leftCutout.bezierCurveTo(-.08, .02, -.08, -.18, -.22, -.3)
    leftCutout.bezierCurveTo(.01, -.17, .04, .04, -.08, .16)
    leftCutout.bezierCurveTo(-.13, .2, -.18, .18, -.22, .13)

    const rightCutout = new THREE.Path()
    rightCutout.moveTo(.16, .24)
    rightCutout.bezierCurveTo(.32, .12, .28, -.09, .22, -.2)
    rightCutout.bezierCurveTo(.43, -.08, .45, .14, .31, .27)
    rightCutout.bezierCurveTo(.25, .31, .2, .29, .16, .24)

    shape.holes.push(leftCutout, rightCutout)
    group.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), material(color, 1.8)))
  } else if (type === 'wind') {
    const strokes = [
      [[-.38, .17], [-.16, .27], [.06, .12], [.23, .22], [.22, .38], [.05, .37]],
      [[-.34, .02], [-.1, .1], [.14, -.03], [.38, .08], [.37, -.14], [.19, -.18]],
      [[-.25, -.18], [-.04, -.13], [.06, -.35], [.23, -.3], [.2, -.15]],
    ]
    strokes.forEach((points) => {
      const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, .03)))
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .035, 6, false), material(color, 1.8)))
    })
  } else if (type === 'dust') {
    const cloud = new THREE.Shape()
    cloud.moveTo(-.34, -.05)
    cloud.bezierCurveTo(-.48, -.2, -.35, -.4, -.18, -.34)
    cloud.bezierCurveTo(-.09, -.5, .13, -.48, .2, -.32)
    cloud.bezierCurveTo(.43, -.4, .51, -.12, .37, .01)
    cloud.bezierCurveTo(.43, .2, .21, .34, .06, .24)
    cloud.bezierCurveTo(-.13, .36, -.4, .22, -.34, -.05)
    group.add(new THREE.Mesh(new THREE.ShapeGeometry(cloud), material(color, 1.8)))
    for (const [x, y, radius] of [[-.43, .34, .06], [.1, .42, .045], [.48, .23, .07], [-.53, -.27, .045], [.45, -.37, .06], [-.02, -.5, .035]]) {
      const mote = new THREE.Mesh(new THREE.CircleGeometry(radius, 12), material(color, 1.8))
      mote.position.set(x, y, .03)
      group.add(mote)
    }
  } else if (type === 'ice') {
    for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.68, .045, .03), material(color, 1.8))
      arm.rotation.z = angle
      group.add(arm)
      for (const side of [-1, 1]) {
        const branch = new THREE.Mesh(new THREE.BoxGeometry(.18, .035, .03), material(color, 1.8))
        branch.position.set(Math.cos(angle) * .16 * side, Math.sin(angle) * .16 * side, .02)
        branch.rotation.z = angle + side * Math.PI / 3
        group.add(branch)
      }
    }
  }
  return group
}

export class Lockbox {
  constructor(group, { x, surfaceY, shadow, glow, glyphs = DEFAULT_GLYPHS, solution = DEFAULT_SOLUTION, hintLines = DEFAULT_HINT, ringSpacing = .72, interactionRange = INTERACTION_RANGE, showFrameReward = true, glyphColor = '#f5b45d', glyphShade = '#352009' }) {
    this.x = x
    this.surfaceY = surfaceY
    this.glyphColor = glyphColor
    this.glyphShade = glyphShade
    this.group = new THREE.Group()
    this.group.position.set(x, surfaceY, PLAYER_Z_DEPTH)
    group.add(this.group)
    this.glyphs = glyphs
    this.solution = solution
    this.hintLines = hintLines
    this.interactionRange = interactionRange
    this.showFrameReward = showFrameReward
    this.dials = glyphs.map((_, index) => (index + 1) % glyphs.length)
    this.selectedDial = 0
    this.opened = false
    const width = Math.max(3.15, (glyphs.length - 1) * ringSpacing + 1.4)
    this.baseCollider = { x, y: surfaceY + .85, w: width, h: 1.7 }
    this.collider = this.baseCollider
    this.ringPositions = glyphs.map((_, index) => (index - (glyphs.length - 1) / 2) * ringSpacing)
    this.rings = []

    const body = new THREE.Mesh(new THREE.BoxGeometry(width, 1.7, 1.1), material(shadow, .25))
    body.position.y = .85
    this.group.add(body)
    this.lid = new THREE.Mesh(new THREE.BoxGeometry(width + .13, .28, 1.2), material(glow, .65))
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
    ring.glyph = glyph(this.glyphs[this.dials[index]], this.glyphColor, this.glyphShade)
    ring.glyph.position.z = .08
    ring.add(ring.glyph)
  }

  // Picks the dial by horizontal offset once the player is at the box, rather than by 3D distance
  // to rings only .72 apart. Full 3D distance made selecting a specific dial a positioning chore --
  // the player's height above the box dominated the comparison -- which degraded the chapter's one
  // genuine deduction puzzle into fighting the controls.
  nearestDial(playerPosition) {
    if (!this.group.visible) return -1
    if (this.opened) return -1
    if (playerPosition.distanceTo(new THREE.Vector3(this.x, this.surfaceY + .9, PLAYER_Z_DEPTH)) > this.interactionRange) return -1
    let nearest = 0
    let distance = Infinity
    this.ringPositions.forEach((offset, index) => {
      const candidate = Math.abs(playerPosition.x - (this.x + offset))
      if (candidate < distance) {
        distance = candidate
        nearest = index
      }
    })
    return nearest
  }

  interact(playerPosition) {
    if (this.opened) return null
    if (this.nearestDial(playerPosition) < 0) return null
    const dial = this.selectedDial
    this.dials[dial] = (this.dials[dial] + 1) % this.glyphs.length
    this.setGlyph(dial)
    if (this.dials.every((value, index) => this.glyphs[value] === this.solution[index])) {
      this.opened = true
      this.collider = null
      this.group.visible = false
      this.frame.visible = this.showFrameReward
      return { opened: true }
    }
    return { opened: false }
  }

  selectNext(playerPosition) {
    if (this.nearestDial(playerPosition) < 0) return false
    this.selectedDial = (this.selectedDial + 1) % this.glyphs.length
    return true
  }

  hide() {
    this.group.visible = false
    this.collider = null
  }

  reveal() {
    if (this.opened || this.group.visible) return false
    this.group.visible = true
    this.collider = this.baseCollider
    return true
  }

  prompt(playerPosition) {
    if (this.opened || this.nearestDial(playerPosition) < 0) return ''
    return 'Q / SELECT DIAL\nE / TURN DIAL\nH / HINT'
  }

  collectFrame(playerPosition) {
    if (!this.frame.visible || playerPosition.distanceTo(this.frame.position) >= PICKUP_RANGE) return false
    this.frame.visible = false
    return true
  }

  // Highlights the dial that E will actually turn, so selection is visible rather than guessed at.
  update(elapsed, playerPosition) {
    const selected = playerPosition && this.nearestDial(playerPosition) >= 0 ? this.selectedDial : -1
    this.rings.forEach((ring, index) => {
      ring.rotation.z = Math.sin(elapsed * 1.4 + index) * .035
      const lift = index === selected ? .12 : 0
      ring.position.y = .9 + lift
      // Scale each part relative to its own base intensity rather than to a flat value -- the moon
      // glyph's crescent is carved by a deliberately near-dark cutout mesh, and forcing every child
      // to one brightness would light that cutout up and erase the crescent.
      ring.glyph?.children.forEach((part) => {
        if (part.userData.baseIntensity === undefined) part.userData.baseIntensity = part.material.emissiveIntensity
        part.material.emissiveIntensity = part.userData.baseIntensity * (index === selected ? 1.7 : 1)
      })
    })
    if (this.frame.visible) this.frame.rotation.z += .025
  }
}