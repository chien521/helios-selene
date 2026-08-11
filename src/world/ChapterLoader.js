import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'
import { createBridge, createMeltBridge } from './LensGates.js'
import { Lockbox } from './Lockbox.js'
import { Mirror, Receiver } from './Mirror.js'
import { SunField } from './SunBeam.js'
import { Triangulation } from './Triangulation.js'
import { PeriscopeExit } from './PeriscopeExit.js'

const color = (value) => new THREE.Color(value)
const DEPTH = 8
const PLAYER_STAND_OFFSET = 1.1
// Time a beam must stay on a rock before it topples. Kept short on purpose: once the routing is
// correct the outcome is already decided, so a longer wait would just be the old loading bar in a
// new costume. This is confirmation, not challenge.

// Derives a near-black shade of `hex` at a fixed target luma, working directly in sRGB
// channel space (0-255) rather than three.js's internal linear color management — a plain
// multiplyScalar() on a THREE.Color looked far brighter than intended on screen, because
// scaling in linear space and then gamma-correcting back to sRGB for display raises shadows
// far more than the scalar suggests (a "10%" linear color reads as ~33% gray on screen).
function darkShade(hex, targetLuma = .05) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255
  const luma = .2126 * r + .7152 * g + .0722 * b
  const factor = luma > 0 ? Math.min(1, targetLuma / luma) : 1
  const channel = (v) => Math.round(v * factor * 255).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function paintSky(ctx, topHex, middleHex, bottomHex) {
  const { width, height } = ctx.canvas
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, topHex)
  gradient.addColorStop(.52, middleHex)
  gradient.addColorStop(1, bottomHex)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

const emptyObjects = () => ({ mirrors: [], receivers: [], periscopeBridges: [] })

export class ChapterLoader {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.scene.add(this.group)
    this.objects = emptyObjects()
    this.platforms = []
    this.bridgeCollider = null
    this.springCollider = null
    this.lowerPlatform = null
    this.sun = null
    this.lensReceiverIds = new Set()
    this.skyCanvas = document.createElement('canvas')
    this.skyCanvas.width = 512
    this.skyCanvas.height = 512
    this.skyCtx = this.skyCanvas.getContext('2d')
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas)
    this.skyTexture.colorSpace = THREE.SRGBColorSpace
    this.gradeColor = new THREE.Color()
  }

  clear() {
    this.group.clear()
    this.objects = emptyObjects()
    this.platforms = []
    this.bridgeCollider = null
    this.springCollider = null
    this.lowerPlatform = null
    this.sun = null
  }

  // Builds a ground platform + its physics collider in one place, since every platform in the
  // open room now carries its own elevation (`surfaceY`) instead of sharing one flat GROUND_TOP.
  // `safeX` is the checkpoint/respawn x for this platform (defaults to its center) -- overridden
  // for the staging platform so a respawn never lands the player inside a standing rock.
  // `solves: true` marks a platform as only reachable once the chapter's puzzles are actually
  // solved, which main.js uses to flag chapter progress without needing to know which
  // chapter-specific mechanic (burn vs. stabilize) got them there.
  addPlatform({ x, surfaceY, w, safeX, solves }) {
    const boxY = surfaceY - 1
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2, DEPTH), new THREE.MeshBasicMaterial({ color: this.shadow }))
    mesh.position.set(x, boxY, PLAYER_Z_DEPTH)
    this.group.add(mesh)
    const platform = { x, y: boxY, w, h: 2, surfaceY, safeX: safeX ?? x, solves: !!solves }
    this.platforms.push(platform)
    return platform
  }

  addSpring(platform, id) {
    const springX = platform.x + platform.w / 2 - .8
    const spring = new THREE.Group()
    const material = new THREE.MeshStandardMaterial({ color: '#e8d8ae', emissive: '#ffb347', emissiveIntensity: 1.1, roughness: .45 })
    for (let index = 0; index < 4; index += 1) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(.36, .055, 8, 16), material)
      coil.rotation.x = Math.PI / 2
      coil.position.y = .18 + index * .2
      spring.add(coil)
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .12, 12), material)
    cap.position.y = 1
    spring.add(cap)
    spring.position.set(springX, platform.surfaceY, PLAYER_Z_DEPTH)
    spring.visible = false
    this.group.add(spring)
    // The collision box reaches from the platform surface to the spring cap. It makes the spring
    // a real, standable object and prevents its launch from triggering through nearby floors.
    const collider = { x: springX, y: platform.surfaceY + .5, w: .84, h: 1 }
    this.springCollider = collider
    this.objects[id] = { mesh: spring, collider, revealed: false }
  }

  addCollectible(fragment, chapter, shadow) {
    const part = new THREE.Mesh(
      new THREE.TorusGeometry(.72, .13, 10, 20),
      new THREE.MeshStandardMaterial({ color: shadow, emissive: chapter.id === 'helios' ? '#f5b45d' : '#c8f3ff', emissiveIntensity: 1.9, roughness: .2 }),
    )
    part.position.set(fragment.position[0], fragment.position[1], PLAYER_Z_DEPTH)
    part.rotation.set(Math.PI / 2, .2, .35)
    this.group.add(part)
    this.objects.collectibles.push({ ...fragment, mesh: part, baseY: fragment.position[1] })
  }

  load(chapter) {
    this.clear()
    const base = color(chapter.palette.open)
    const shadow = darkShade(chapter.palette.close)
    this.shadow = shadow
    this.chapter = chapter
    this.paletteColors = {
      open: new THREE.Color(chapter.palette.open),
      mid: new THREE.Color(chapter.palette.mid),
      close: new THREE.Color(chapter.palette.close),
    }
    paintSky(this.skyCtx, chapter.palette.open, chapter.palette.mid, chapter.palette.close)
    this.skyTexture.needsUpdate = true
    this.gradeColor.copy(this.paletteColors.open)
    this.scene.background = this.skyTexture
    this.scene.fog = new THREE.Fog(shadow, 10, 52)
    const ambient = new THREE.HemisphereLight(chapter.palette.close, chapter.palette.open, 2.4)
    const sun = new THREE.DirectionalLight(chapter.palette.open, 3.8)
    sun.position.set(-10, 14, 7)
    this.group.add(ambient, sun)
    this.ambient = ambient
    this.sun3d = sun

    // Ground hub, shared by both chapters -- everything past it is chapter-specific.
    const hub = this.addPlatform({ x: 0, surfaceY: 0, w: 14 })
    // The lower platform extends slightly beyond the hub so the spring's launch path clears the
    // upper platform instead of colliding with its underside.
    const lowerPlatform = this.addPlatform({ x: hub.x, surfaceY: -9, w: 18 })
    this.lowerPlatform = lowerPlatform
    this.addSpring(lowerPlatform, 'spring')
    this.addSpring(hub, 'upperSpring')

    if (chapter.layout) this.buildFromLayout(chapter, shadow, base)
    else this.buildSeleneRoom(shadow)

    this.gradeMinX = Math.min(...this.platforms.map((platform) => platform.x - platform.w / 2))
    this.gradeMaxX = Math.max(...this.platforms.map((platform) => platform.x + platform.w / 2))

    this.objects.collectibles = []
    chapter.fragments.forEach((fragment) => this.addCollectible(fragment, chapter, shadow))

    this.updateGrade(this.gradeMinX, 0)
    return this.objects
  }

  // Helios: a wide, twin-branched daytime room. The left branch teaches the mirror verb (heliostat
  // + sky dots) and yields the lens; the right branch is a three-stage ascent where every gap is
  // opened by routing sunlight onto a rock. Placement all lives in the chapter data.
  buildFromLayout(chapter, shadow, base) {
    const { layout } = chapter
    const platforms = {}
    layout.platforms.forEach((spec) => { platforms[spec.id] = this.addPlatform(spec) })

    this.sun = new SunField(this.group, { zones: layout.sunlitZones, color: '#ffd275' })
    this.objects.mirrors = layout.mirrors.map((spec) => new Mirror(this.group, { ...spec, glow: '#ffd275' }))
    this.objects.receivers = layout.receivers.map((spec) => new Receiver(this.group, { ...spec, glow: '#ffd275' }))
    const lockboxPlatform = platforms[layout.lockboxOn]
    this.objects.lockbox = new Lockbox(this.group, {
      x: lockboxPlatform.x,
      surfaceY: lockboxPlatform.surfaceY,
      shadow,
      glow: '#f5b45d',
    })
    this.objects.triangulation = new Triangulation(this.group, {
      lensPosition: { x: this.lowerPlatform.x, y: this.lowerPlatform.surfaceY + .55 },
      glow: '#ffd275',
    })
    this.objects.lensBox = new Lockbox(this.group, {
      x: this.lowerPlatform.x,
      surfaceY: this.lowerPlatform.surfaceY,
      shadow,
      glow: '#ffd275',
      glyphs: ['fire', 'wind', 'dust', 'ice'],
      solution: ['fire', 'wind', 'dust', 'ice'],
      ringSpacing: 1.25,
      interactionRange: 4.2,
      showFrameReward: false,
      hintLines: [
        'The first could not be held.',
        'The second could not stay.',
        'The third could not remember.',
        'The fourth could not forget.',
      ],
    })
    this.objects.lensBox.hide()
    this.lensReceiverIds = new Set(layout.lensReceivers)
    this.objects.periscopeBridges = layout.bridges.map((spec) => {
      const bridge = createBridge(this.group, { ...spec, depth: DEPTH, color: '#5b3b1d', emissive: '#ffd275' })
      bridge.mesh.visible = false
      return { ...spec, ...bridge, revealed: false }
    })
    this.objects.meltBridge = layout.meltBridge
      ? createMeltBridge(this.group, { ...layout.meltBridge, depth: DEPTH, shadow, glow: '#ff8c1a' })
      : null
    if (layout.exitBridge) {
      const bridge = createBridge(this.group, { ...layout.exitBridge, depth: DEPTH, color: '#5b3b1d', emissive: '#ffd275' })
      bridge.mesh.visible = false
      const marker = new THREE.Group()
      marker.position.set(layout.exitBridge.markerX, layout.exitBridge.markerY, PLAYER_Z_DEPTH)
      marker.add(new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 12), new THREE.MeshBasicMaterial({ color: '#ffd275' })))
      marker.visible = false
      this.group.add(marker)
      this.objects.exitBridge = { ...bridge, group: marker, position: marker.position, revealed: false }
    }
    this.objects.exit = layout.exit
      ? new PeriscopeExit(this.group, { ...layout.exit, glow: '#ffd275' })
      : null
  }

  // A single continuous vertical ascent, not a branching room -- deliberately NOT rhyming Helios's
  // shape so the chapter reads as its own place: a night-time climb toward the moon rather than a
  // daytime room split into two wings. Same gap=2.5/rise=1.5 margin as Helios's stairs, chained
  // four times to reach roughly double Helios's summit height.
  buildSeleneRoom(shadow) {
    const landing = this.addPlatform({ x: 17, surfaceY: 0, w: 4 })
    const { mesh: bridge, collider: bridgeCollider } = createBridge(this.group, { left: 7, right: landing.x - landing.w / 2, surfaceY: 0, depth: DEPTH })
    this.objects.bridge = bridge
    this.bridgeCollider = bridgeCollider

    this.addPlatform({ x: 24.5, surfaceY: 1.5, w: 6 })
    // The "resting ledge" -- wider than the other steps, this is Selene's vantage-point beat
    // (staged mid-climb rather than a separate branch) and holds a decorative frost-mote cluster.
    const restPlatform = this.addPlatform({ x: 34, surfaceY: 3, w: 8, safeX: 31.5 })
    this.addPlatform({ x: 43.5, surfaceY: 4.5, w: 6 })
    // `solves` belongs on the summit, not on the landing just past the bridge. It used to sit on the
    // landing, which meant Selene's completion flag fired the moment the player stepped off the
    // bridge -- and the ending screen could never actually be reached.
    const summitPlatform = this.addPlatform({ x: 54, surfaceY: 6, w: 10, solves: true })

    // Frost motes: a small drifting cluster instead of Helios's single solid vista gem.
    const motes = new THREE.Group()
    for (const [dx, dy] of [[-2.6, 1.4], [-1.5, 2.1], [-1.9, 1.7]]) {
      const mote = new THREE.Mesh(new THREE.IcosahedronGeometry(.35, 0), new THREE.MeshStandardMaterial({ color: shadow, emissive: '#c8f3ff', emissiveIntensity: 1.5, roughness: .3 }))
      mote.position.set(dx, dy, 0)
      motes.add(mote)
    }
    motes.position.set(restPlatform.x, restPlatform.surfaceY, PLAYER_Z_DEPTH)
    this.group.add(motes)
    this.objects.vista = motes

    // Crystalline, faceted shard -- floating-feeling rather than Helios's solid grounded cone.
    const summit = new THREE.Mesh(new THREE.OctahedronGeometry(3.2, 0), new THREE.MeshStandardMaterial({ color: '#1b2a4a', emissive: '#8fe3ff', emissiveIntensity: 1.4, roughness: .25 }))
    summit.position.set(summitPlatform.x, summitPlatform.surfaceY + 3.2, PLAYER_Z_DEPTH)
    this.group.add(summit)
    this.objects.summit = summit
  }

  // Traces sunlight and applies everything it touches. `visible` gates the whole optical layer on
  // owning the telescope frame; `canBurn` gates *burning* on the Helios lens, which is what keeps
  // the back half of the chapter mechanically unsolvable until the lens is collected.
  updateBeams({ visible, showDirections, focusedMirror }) {
    const result = { receiverHits: new Set() }
    if (!this.sun) return result
    const { segments, massHits, receiverHits } = this.sun.trace({
      mirrors: this.objects.mirrors,
      receivers: this.objects.receivers,
      masses: [],
      blockers: this.platforms,
    })
    this.sun.render(showDirections ? segments : [])
    this.objects.mirrors.forEach((mirror) => mirror.setLit(visible && mirror.lit))

    if (visible && focusedMirror) {
      this.objects.receivers.forEach((receiver) => { if (receiverHits.has(receiver)) receiver.latch() })
    }
    result.receiverHits = receiverHits
    return result
  }

  nearestMirror(playerPosition) {
    let best = null
    let bestDistance = Infinity
    for (const mirror of this.objects.mirrors) {
      if (!mirror.inRange(playerPosition)) continue
      const distance = playerPosition.distanceTo(mirror.position)
      if (distance < bestDistance) { bestDistance = distance; best = mirror }
    }

    return best
  }

  nearestLockbox(playerPosition) {
    return [this.objects.lockbox, this.objects.lensBox]
      .find((box) => box && !box.opened && box.nearestDial(playerPosition) >= 0) ?? null
  }

  getColliders() {
    const colliders = [...this.platforms]
    this.objects.periscopeBridges.forEach((bridge) => {
      if (bridge.revealed) colliders.push(bridge.collider)
    })
    if (this.objects.meltBridge) {
      colliders.push(this.objects.meltBridge.melted
        ? this.objects.meltBridge.bridgeCollider
        : this.objects.meltBridge.wallCollider)
    }
    if (this.objects.exitBridge?.revealed) colliders.push(this.objects.exitBridge.collider)
    if (this.objects.bridge?.visible) colliders.push(this.bridgeCollider)
    if (this.objects.lockbox?.collider) colliders.push(this.objects.lockbox.collider)
    if (this.objects.lensBox?.collider) colliders.push(this.objects.lensBox.collider)
    for (const spring of [this.objects.spring, this.objects.upperSpring]) {
      if (spring?.revealed) colliders.push(spring.collider)
    }
    return colliders
  }

  // Finds safe checkpoint ground under a grounded player. Ledges overlap the platforms they fell
  // onto, so matching on x alone would return the platform *below* the ledge the player is actually
  // standing on and respawn them a step too low -- `feetY` disambiguates.
  platformAt(playerX, feetY) {
    let best = null
    let bestGap = Infinity
    for (const platform of this.platforms) {
      if (playerX < platform.x - platform.w / 2 || playerX > platform.x + platform.w / 2) continue
      const gap = Math.abs(platform.surfaceY - feetY)
      if (gap < bestGap) { bestGap = gap; best = platform }
    }
    return best
  }

  springUnder(body) {
    return [this.objects.spring, this.objects.upperSpring].find((spring) => {
      if (!spring?.revealed) return false
      const springTop = spring.collider.y + spring.collider.h / 2
      return Math.abs(body.x - spring.collider.x) <= body.hw + spring.collider.w / 2
        && Math.abs(body.y - body.hh - springTop) < .001
    }) ?? null
  }

  revealSpring() {
    const spring = this.objects.spring
    if (!spring || spring.revealed) return false
    spring.revealed = true
    spring.mesh.visible = true
    return true
  }

  revealUpperSpring() {
    const spring = this.objects.upperSpring
    if (!spring || spring.revealed) return false
    spring.revealed = true
    spring.mesh.visible = true
    return true
  }

  revealExitBridgeMarker() {
    const bridge = this.objects.exitBridge
    if (!bridge || bridge.revealed || bridge.group.visible) return false
    bridge.group.visible = true
    return true
  }

  revealExitBridge() {
    const bridge = this.objects.exitBridge
    if (!bridge || bridge.revealed) return false
    bridge.revealed = true
    bridge.group.visible = false
    bridge.mesh.visible = true
    return true
  }

  receiversLatched(ids) {
    return [...ids].every((id) => this.objects.receivers.some((receiver) => receiver.id === id && receiver.latched))
  }

  updatePeriscopeRoutes() {
    const revealedBridges = []
    this.objects.periscopeBridges.forEach((bridge) => {
      if (!bridge.revealed && this.receiversLatched([bridge.receiver])) {
        bridge.revealed = true
        bridge.mesh.visible = true
        revealedBridges.push(bridge)
      }
    })
    const exitRevealed = !!this.objects.exit
      && !this.objects.exit.group.visible
      && this.receiversLatched([this.chapter.layout.exit.receiver])
      && this.objects.exit.reveal()
    return { revealedBridges, exitRevealed }
  }

  standingHeight(platform) {
    return platform.surfaceY + PLAYER_STAND_OFFSET
  }

  // How far across the chapter the player has travelled, 0-1. Drives the sky grade.
  gradeProgress(playerX) {
    return Math.min(1, Math.max(0, (playerX - this.gradeMinX) / (this.gradeMaxX - this.gradeMinX)))
  }

  // The sky follows the player's horizontal journey through the chapter, making Helios glow
  // orange on its far-left climb and fade to white toward its right-side summit.
  updateGrade(playerX, delta) {
    const progress = this.gradeProgress(playerX)
    const target = progress < .5
      ? this.paletteColors.open.clone().lerp(this.paletteColors.mid, progress * 2)
      : this.paletteColors.mid.clone().lerp(this.paletteColors.close, (progress - .5) * 2)
    this.gradeColor.lerp(target, 1 - Math.exp(-delta * 1.2))
    const currentHex = `#${this.gradeColor.getHexString()}`
    const shadowHex = darkShade(currentHex)
    this.sun3d.color.copy(this.gradeColor)
    this.ambient.color.copy(this.gradeColor)
    this.ambient.groundColor.set(shadowHex)
    this.scene.fog.color.set(shadowHex)
  }

  updateGlow(elapsed, playerPosition) {
    // Selene's frost-mote vista is a small Group rather than a single mesh, so pulse every child.
    const pulse = (object, base, amplitude, speed) => {
      const value = base + Math.sin(elapsed * speed) * amplitude
      if (object.material) object.material.emissiveIntensity = value
      else object.children.forEach((child) => { child.material.emissiveIntensity = value })
    }
    if (this.objects.summit) pulse(this.objects.summit, 1.4, .4, 1.6)
    this.objects.receivers.forEach((receiver) => receiver.update(elapsed))
    this.objects.lockbox?.update(elapsed, playerPosition)
    this.objects.lensBox?.update(elapsed, playerPosition)
    this.objects.triangulation?.update(elapsed, playerPosition)
    this.objects.collectibles?.forEach(({ mesh }, index) => {
      if (!mesh.visible) return
      mesh.rotation.y += .018
      mesh.position.y = this.objects.collectibles[index].baseY + Math.sin(elapsed * 2 + index) * .16
      mesh.material.emissiveIntensity = 1.7 + Math.sin(elapsed * 2.6 + index) * .35
    })
  }
}
