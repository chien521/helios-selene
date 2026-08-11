import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'
import { createGate, createBridge } from './LensGates.js'
import { Lockbox } from './Lockbox.js'
import { Heliostat } from './Heliostat.js'
import { Triangulation } from './Triangulation.js'

const color = (value) => new THREE.Color(value)
const DEPTH = 8
const PLAYER_STAND_OFFSET = 1.1

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

function paintSky(ctx, topHex, bottomHex) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, topHex)
  gradient.addColorStop(1, bottomHex)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 2, 256)
}

export class ChapterLoader {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.scene.add(this.group)
    this.objects = {}
    this.platforms = []
    this.gateCollider = null
    this.bridgeCollider = null
    this.springCollider = null
    this.lowerPlatform = null
    this.skyCanvas = document.createElement('canvas')
    this.skyCanvas.width = 2
    this.skyCanvas.height = 256
    this.skyCtx = this.skyCanvas.getContext('2d')
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas)
    this.gradeColor = new THREE.Color()
  }

  clear() {
    this.group.clear()
    this.objects = {}
    this.platforms = []
    this.gateCollider = null
    this.bridgeCollider = null
    this.springCollider = null
    this.lowerPlatform = null
  }

  // Builds a ground platform + its physics collider in one place, since every platform in the
  // open room now carries its own elevation (`surfaceY`) instead of sharing one flat GROUND_TOP.
  // `safeX` is the checkpoint/respawn x for this platform (defaults to its center) -- overridden
  // for the gate platform so a respawn never lands the player inside the gate's own collider.
  // `solves: true` marks a platform as only reachable once the chapter's puzzle is actually
  // solved (past the gate/bridge), which main.js uses to flag chapter progress without needing
  // to know which chapter-specific mechanic (melt vs. stabilize) got them there.
  addPlatform({ x, surfaceY, w, safeX, solves }) {
    const boxY = surfaceY - 1
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2, DEPTH), new THREE.MeshBasicMaterial({ color: this.shadow }))
    mesh.position.set(x, boxY, PLAYER_Z_DEPTH)
    this.group.add(mesh)
    const platform = { x, y: boxY, w, h: 2, surfaceY, safeX: safeX ?? x, solves: !!solves }
    this.platforms.push(platform)
    return platform
  }

  addSpring(platform) {
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
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(.16, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#ffd275' }),
    )
    marker.position.set(springX, platform.surfaceY + 1.4, PLAYER_Z_DEPTH)
    marker.visible = false
    this.group.add(marker)
    this.objects.spring = { mesh: spring, collider, marker, revealed: false }
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
    this.gradeColor.copy(this.paletteColors.open)
    this.scene.background = this.skyTexture
    this.scene.fog = new THREE.Fog(shadow, 10, 52)
    const ambient = new THREE.HemisphereLight(chapter.palette.close, chapter.palette.open, 2.4)
    const sun = new THREE.DirectionalLight(chapter.palette.open, 3.8)
    sun.position.set(-10, 14, 7)
    this.group.add(ambient, sun)
    this.ambient = ambient
    this.sun = sun

    // Ground hub, shared by both chapters -- everything past it is chapter-specific (see
    // buildHeliosRoom/buildSeleneRoom), deliberately NOT rhyming in shape between the two: Helios
    // is a wide, twin-branched daytime room; Selene is a single vertical night-time climb.
    const hub = this.addPlatform({ x: 0, surfaceY: 0, w: 14 })
    // The lower platform extends slightly beyond the hub so the spring's launch path clears the
    // upper platform instead of colliding with its underside.
    const lowerPlatform = this.addPlatform({ x: hub.x, surfaceY: -9, w: 18 })
    this.lowerPlatform = lowerPlatform
    this.addSpring(lowerPlatform)

    if (chapter.id === 'helios') this.buildHeliosRoom(shadow, base)
    else this.buildSeleneRoom(shadow)

    this.gradeMinX = Math.min(...this.platforms.map((platform) => platform.x - platform.w / 2))
    this.gradeMaxX = Math.max(...this.platforms.map((platform) => platform.x + platform.w / 2))

    this.objects.collectibles = []
    chapter.fragments.forEach((fragment) => this.addCollectible(fragment, chapter, shadow))

    this.updateGrade(this.gradeMinX, 0)
    return this.objects
  }

  // Wide, twin-branched daytime room: an optional climb branch off to the left and the gated
  // right-side staging area. The former post-gate exit route is intentionally absent while the
  // replacement exit mechanism is being designed.
  buildHeliosRoom(shadow, base) {
    // Gaps between elevated platforms are 2.5, not the 4.5 used for flat crossings elsewhere --
    // a rise of 1.5 with JUMP_VELOCITY=10/GRAVITY=26/SPEED=8 only puts the descending trajectory
    // back at that height at x=4.52 from takeoff (physics, not tuning), so a 4.5 gap left a mere
    // .02-unit landing margin: functionally unjumpable, not just bot-unfriendly. 2.5 gives ~2 units
    // of margin instead. Flat (rise 0) crossings elsewhere keep the wider gap since landing margin
    // there is governed by the full flight distance (~6.15), not this tight per-rise window.
    const climbPlatform = this.addPlatform({ x: -13.5, surfaceY: 1.5, w: 8, safeX: -10.5 })
    const vistaPlatform = this.addPlatform({ x: -25, surfaceY: 3, w: 10 })
    this.objects.lockbox = new Lockbox(this.group, { x: climbPlatform.x, surfaceY: climbPlatform.surfaceY, shadow, glow: '#f5b45d' })
    this.objects.triangulation = new Triangulation(this.group, {
      lensPosition: { x: this.lowerPlatform.x, y: this.lowerPlatform.surfaceY + .55 },
      glow: '#ffd275',
    })

    const gatePlatform = this.addPlatform({ x: 16.5, surfaceY: 0, w: 12, safeX: 12.5 })
    const { mesh: gate, collider: gateCollider } = createGate(this.group, { x: 20, surfaceY: gatePlatform.surfaceY, shadow, base })
    this.objects.gate = gate
    this.gateCollider = gateCollider

    this.objects.heliostat = new Heliostat(this.group, {
      position: { x: vistaPlatform.x, y: vistaPlatform.surfaceY + 1.6 },
      glow: '#ffd275',
    })
  }

  // A single continuous vertical ascent, not a branching room -- deliberately NOT rhyming Helios's
  // shape so the chapter reads as its own place: a night-time climb toward the moon rather than a
  // daytime room split into two wings. No separate optional branch; the "2-3 vantage points" beat
  // comes from staged tiers along one path (ground -> resting ledge -> summit) instead. Same
  // gap=2.5/rise=1.5 margin as Helios's stairs (see buildHeliosRoom for the physics derivation),
  // chained four times to reach roughly double Helios's summit height.
  buildSeleneRoom(shadow) {
    const landing = this.addPlatform({ x: 17, surfaceY: 0, w: 4, solves: true })
    const { mesh: bridge, collider: bridgeCollider } = createBridge(this.group, { left: 7, right: landing.x - landing.w / 2, surfaceY: 0, depth: DEPTH })
    this.objects.bridge = bridge
    this.bridgeCollider = bridgeCollider

    this.addPlatform({ x: 24.5, surfaceY: 1.5, w: 6 })
    // The "resting ledge" -- wider than the other steps, this is Selene's vantage-point beat
    // (staged mid-climb rather than a separate branch) and holds a decorative frost-mote cluster.
    const restPlatform = this.addPlatform({ x: 34, surfaceY: 3, w: 8, safeX: 31.5 })
    this.addPlatform({ x: 43.5, surfaceY: 4.5, w: 6 })
    const summitPlatform = this.addPlatform({ x: 54, surfaceY: 6, w: 10 })

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

  // The sky follows the player's horizontal journey through the chapter, making Helios glow
  // orange on its far-left climb and fade to white toward its right-side summit independently of
  // collectible state. Selene uses the same spatial progression with its own cool palette.
  updateGrade(playerX, delta) {
    const progress = Math.min(1, Math.max(0, (playerX - this.gradeMinX) / (this.gradeMaxX - this.gradeMinX)))
    const target = this.paletteColors.open.clone().lerp(this.paletteColors.close, progress)
    this.gradeColor.lerp(target, 1 - Math.exp(-delta * 1.2))
    const currentHex = `#${this.gradeColor.getHexString()}`
    const shadowHex = darkShade(currentHex)
    this.sun.color.copy(this.gradeColor)
    this.ambient.color.copy(this.gradeColor)
    this.ambient.groundColor.set(shadowHex)
    this.scene.fog.color.set(shadowHex)
    paintSky(this.skyCtx, currentHex, shadowHex)
    this.skyTexture.needsUpdate = true
  }

  getColliders() {
    const colliders = [...this.platforms]
    if (this.objects.gate?.userData.gate.fallen) colliders.push(this.objects.gate.userData.gate.fallenCollider)
    else if (this.objects.gate?.visible) colliders.push(this.gateCollider)
    if (this.objects.bridge?.visible) colliders.push(this.bridgeCollider)
    if (this.objects.lockbox?.collider) colliders.push(this.objects.lockbox.collider)
    if (this.objects.spring?.revealed && this.springCollider) colliders.push(this.springCollider)
    return colliders
  }

  // Ground platforms only (not the gate/bridge) -- used to find safe checkpoint ground under a
  // grounded player, so a checkpoint is never set standing inside a gate wall or on the bridge,
  // which can vanish out from under you.
  platformAt(playerX) {
    return this.platforms.find((p) => playerX >= p.x - p.w / 2 && playerX <= p.x + p.w / 2) ?? null
  }

  standingOnSpring(body) {
    const spring = this.objects.spring
    if (!spring) return false
    const { collider } = spring
    const springTop = collider.y + collider.h / 2
    return Math.abs(body.x - collider.x) <= body.hw + collider.w / 2
      && Math.abs(body.y - body.hh - springTop) < .001
  }

  revealSpringMarker() {
    const spring = this.objects.spring
    if (!spring || spring.revealed || spring.marker.visible) return false
    spring.marker.visible = true
    return true
  }

  revealSpring() {
    const spring = this.objects.spring
    if (!spring || spring.revealed) return false
    spring.revealed = true
    spring.marker.visible = false
    spring.mesh.visible = true
    return true
  }

  standingHeight(platform) {
    return platform.surfaceY + PLAYER_STAND_OFFSET
  }

  updateGlow(elapsed, playerPosition) {
    // Selene's frost-mote vista is a small Group rather than a single mesh, so pulse every child.
    const pulse = (object, base, amplitude, speed) => {
      const value = base + Math.sin(elapsed * speed) * amplitude
      if (object.material) object.material.emissiveIntensity = value
      else object.children.forEach((child) => { child.material.emissiveIntensity = value })
    }
    if (this.objects.summit) pulse(this.objects.summit, 1.4, .4, 1.6)
    if (this.objects.gate?.visible && !this.objects.gate.userData.gate.fallen) pulse(this.objects.gate, .9, .3, 2.4)
    this.objects.lockbox?.update(elapsed)
    this.objects.triangulation?.update(elapsed, playerPosition)
    this.objects.heliostat?.update(elapsed, playerPosition, this.chapter?.id === 'helios' && this.heliostatTargeted)
    this.objects.collectibles?.forEach(({ mesh }, index) => {
      if (!mesh.visible) return
      mesh.rotation.y += .018
      mesh.position.y = this.objects.collectibles[index].baseY + Math.sin(elapsed * 2 + index) * .16
      mesh.material.emissiveIntensity = 1.7 + Math.sin(elapsed * 2.6 + index) * .35
    })
  }
}
