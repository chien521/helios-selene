import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLAYER_Z_DEPTH } from '../core/Player.js'
import { createBridge, createMeltBridge } from './LensGates.js'
import { Lockbox } from './Lockbox.js'
import { Mirror, Receiver } from './Mirror.js'
import { Moon } from './Moon.js'
import { SunField } from './SunBeam.js'
import { Triangulation } from './Triangulation.js'
import { PeriscopeExit } from './PeriscopeExit.js'

const DEPTH = 8
const PLAYER_STAND_OFFSET = 1.1
// One world unit of texture per this many units of plaster -- tuned so the brushwork reads at
// platform scale without looking either smeared (too large) or noisy (too small).
const PLATFORM_TEXTURE_TILE = 3.4

// ambientCG "Plaster001" (CC0) -- a soft, mottled, low-detail surface chosen specifically because it
// reads as painterly rather than photographic-busy (tried and rejected several Rock* materials
// first; see CLAUDE.md). Loaded once at module scope; each platform clones the textures so it can
// set its own `repeat` without fighting every other platform sharing the same object.
const platformTextureLoader = new THREE.TextureLoader()
const platformColorMap = platformTextureLoader.load(new URL('../assets/textures/platform/color.jpg', import.meta.url).href)
platformColorMap.colorSpace = THREE.SRGBColorSpace
const platformNormalMap = platformTextureLoader.load(new URL('../assets/textures/platform/normal.jpg', import.meta.url).href)
const platformRoughnessMap = platformTextureLoader.load(new URL('../assets/textures/platform/roughness.jpg', import.meta.url).href)
;[platformColorMap, platformNormalMap, platformRoughnessMap].forEach((map) => {
  map.wrapS = map.wrapT = THREE.RepeatWrapping
})

// Burn wall's own diffuse map -- a second, independent ComfyUI img2img restyle of the same original
// Plaster001 source (not a recolor of platformColorMap), pushed toward scorched/cracked stone with
// ember-warmed fissures so the wall the player burns away reads as its own object, not reused
// platform stone with a tint. Shares platformNormalMap/platformRoughnessMap on purpose -- only the
// diffuse/color channel is meant to carry "look," the bump/roughness detail is generic rock surface
// data both objects can honestly share. See CLAUDE.md > Visuals > Downloaded art > AI-restyled
// textures, and art-restyle-pipeline/workflows/restyle_burnwall_color.py for the exact workflow.
const burnWallColorMap = platformTextureLoader.load(new URL('../assets/textures/burnwall/color.jpg', import.meta.url).href)
burnWallColorMap.colorSpace = THREE.SRGBColorSpace
burnWallColorMap.wrapS = burnWallColorMap.wrapT = THREE.RepeatWrapping

// Quaternius "Spring"/"Bouncer" (CC0, poly.pizza/m/vKySckBbyb) replaces the hand-built coil-torus
// stack + cylinder cap.
//
// The source file ships as a SkinnedMesh riding an unused "Bounce"/"Idle" armature animation, but
// its own mesh node AND its skeleton's joint chain each carry an independent 100x scale (two
// separate branches of the node tree, both scaled, both feeding the same skinned vertices) -- an
// asset-side quirk that double-applies the scale through three.js's standard skinning path. Loading
// it as a SkinnedMesh (even via SkeletonUtils.clone(), the usual fix for cloning rigged glTF
// assets) reproduced a ~200-unit bounding box lying sideways along world Z instead of a ~1-unit
// object standing on Y -- confirmed by inspecting the loaded scene's Box3 directly, not guessed.
// Fix: skip the node hierarchy and skin entirely. Each mesh's geometry is extracted in its own raw,
// untransformed local space (a small coil-and-cap pair, correctly proportioned, just Z-up like most
// Blender exports) and rebuilt as plain static Meshes rotated -90deg about X to stand them onto Y --
// this also means no animation plays, which is fine, since nothing in this codebase currently
// triggers a bounce clip on launch anyway.
const gltfLoader = new GLTFLoader()
const SPRING_MODEL_URL = new URL('../assets/models/spring.glb', import.meta.url).href

// The source file's meshes ship with no UV attribute at all (confirmed via GLTFLoader.parse() in a
// standalone Node script) -- boxProjectUV() below is the same box/planar-projection technique used
// for the Lockbox chest and the gem's rock base (see Lockbox.js for the fuller explanation), applied
// here to the 'Metal' mesh only; the 'Red' emissive tip stays procedural, same reasoning as the gem's
// crystal facets and Mirror.js's Receiver class.
const SPRING_METAL_URL = new URL('../assets/textures/spring/metal.jpg', import.meta.url).href
const springTextureLoader = new THREE.TextureLoader()
const springMetalMap = springTextureLoader.load(SPRING_METAL_URL)
springMetalMap.colorSpace = THREE.SRGBColorSpace
springMetalMap.wrapS = springMetalMap.wrapT = THREE.RepeatWrapping

function boxProjectUV(geometry) {
  const position = geometry.attributes.position
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const normal = geometry.attributes.normal
  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  const size = bbox.getSize(new THREE.Vector3())
  const worldSize = Math.max(size.x, size.y, size.z) || 1
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i))
    let u, v
    if (nx >= ny && nx >= nz) { u = (z - bbox.min.z) / worldSize; v = (y - bbox.min.y) / worldSize }
    else if (ny >= nx && ny >= nz) { u = (x - bbox.min.x) / worldSize; v = (z - bbox.min.z) / worldSize }
    else { u = (x - bbox.min.x) / worldSize; v = (y - bbox.min.y) / worldSize }
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
const SPRING_TARGET_HEIGHT = 1.06 // matches the old cap top (coils to y=.78, cap to y=1.06)
let springModelPromise = null
const loadSpringModel = () => {
  if (!springModelPromise) {
    springModelPromise = new Promise((resolve, reject) => {
      gltfLoader.load(SPRING_MODEL_URL, (gltf) => {
        const meshes = []
        gltf.scene.traverse((node) => { if (node.isMesh) meshes.push(node) })
        resolve(meshes)
      }, undefined, reject)
    })
  }
  return springModelPromise
}

// Selene's phase families. A platform's colour IS its phase -- that is the whole legend, and it has
// to be readable in one glance from across the crater, the same standard Mirror.js sets for "the
// mirror sends light where it points". A platform with no `phase` is stone: solid in every phase,
// and the only kind that can hold a checkpoint.
const PHASE_TONE = {
  full: { color: '#dff6ff', emissive: '#9fe8ff' },
  new: { color: '#232c56', emissive: '#7a86c9' },
  waning: { color: '#1f4f4a', emissive: '#79dcc8' },
}

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

// Tiny seeded PRNG so a chapter's cloud layout is fixed and reproducible across reloads instead of
// reshuffling every time -- a static painting, not noise.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0
  return h
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [n >> 16 & 255, n >> 8 & 255, n & 255]
}

// Blends two sRGB hex colors directly in 0-255 channel space, same reasoning as darkShade() below:
// mixing through three.js's linear color management shifts the result away from what the hex math
// implies, so the sky's clouds stay exactly within the chapter's own palette by doing it by hand.
function mixHex(hexA, hexB, t) {
  const [ar, ag, ab] = hexToRgb(hexA)
  const [br, bg, bb] = hexToRgb(hexB)
  return [ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]
}

// Paints soft, hand-painted-style cloud light over the flat gradient -- every tint is mixed from the
// chapter's own open/mid/close palette (never a fourth, unrelated color) so the clouds always agree
// with the mirror light, fog and grade colors that already key off those same three hexes. Seeded by
// chapter id so Helios and Selene each get their own fixed layout rather than a shared random one.
function paintClouds(ctx, chapterId, topHex, middleHex, bottomHex) {
  const { width, height } = ctx.canvas
  const rand = mulberry32(hashString(chapterId))
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  const cloudCount = 8
  for (let i = 0; i < cloudCount; i++) {
    const cx = rand() * width
    const cy = height * .1 + rand() * height * .6
    const r = width * (.16 + rand() * .22)
    const [tr, tg, tb] = mixHex(middleHex, topHex, rand() * .6 + .25)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, `rgba(${tr | 0},${tg | 0},${tb | 0},${.45 + rand() * .3})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * (.4 + rand() * .25), 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const emptyObjects = () => ({ mirrors: [], receivers: [] })

export class ChapterLoader {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.scene.add(this.group)
    this.objects = emptyObjects()
    this.platforms = []
    this.phasePlatforms = []
    this.springs = []
    this.lowerPlatform = null
    this.sun = null
    this.moon = null
    this.phase = null
    this.deathY = -15
    this.gradeAxis = 'x'
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
    this.phasePlatforms = []
    this.springs = []
    this.lowerPlatform = null
    this.sun = null
    this.moon = null
    this.phase = null
  }

  // Builds a ground platform + its physics collider in one place, since every platform in the
  // open room now carries its own elevation (`surfaceY`) instead of sharing one flat GROUND_TOP.
  // `safeX` is the checkpoint/respawn x for this platform (defaults to its center) -- overridden
  // for the staging platform so a respawn never lands the player inside a standing rock.
  // `solves: true` marks a platform as only reachable once the chapter's puzzles are actually
  // solved, which main.js uses to flag chapter progress without needing to know which
  // chapter-specific mechanic (burn vs. stabilize) got them there.
  //
  // `h` defaults to the original 2 and only ever needs setting for thin slabs. `phase` makes the
  // platform one of Selene's conditional surfaces -- see setPhase() and updatePhaseVisuals().
  // Used to also be shared with the burn wall in LensGates, both on the same ambientCG "Plaster001"
  // diffuse map -- the burn wall now has its own independently-restyled color map (burnWallMaterial()
  // below) so it reads as a distinct scorched rock, not reused platform stone. Ladder wall (Selene)
  // still shares this one -- see buildFromLayout's ladderWall wiring.
  stoneMaterial(w, h) {
    const colorMap = platformColorMap.clone()
    const normalMap = platformNormalMap.clone()
    const roughnessMap = platformRoughnessMap.clone()
    colorMap.repeat.set(w / PLATFORM_TEXTURE_TILE, h / PLATFORM_TEXTURE_TILE)
    normalMap.repeat.copy(colorMap.repeat)
    roughnessMap.repeat.copy(colorMap.repeat)
    return new THREE.MeshStandardMaterial({
      color: this.platformTint, map: colorMap, normalMap, roughnessMap, roughness: 1,
    })
  }

  // The burn wall's own material: its own restyled diffuse map, but the same platform
  // normal/roughness maps (generic rock bump/roughness data, not "look" -- honest to share).
  burnWallMaterial(w, h) {
    const colorMap = burnWallColorMap.clone()
    const normalMap = platformNormalMap.clone()
    const roughnessMap = platformRoughnessMap.clone()
    colorMap.repeat.set(w / PLATFORM_TEXTURE_TILE, h / PLATFORM_TEXTURE_TILE)
    normalMap.repeat.copy(colorMap.repeat)
    roughnessMap.repeat.copy(colorMap.repeat)
    return new THREE.MeshStandardMaterial({
      color: this.platformTint, map: colorMap, normalMap, roughnessMap, roughness: 1,
    })
  }

  addPlatform({ id, x, surfaceY, w, h = 2, safeX, solves, phase, motion, enabled = true }) {
    const boxY = surfaceY - h / 2
    const tone = phase ? PHASE_TONE[phase] : null
    const material = tone
      ? new THREE.MeshStandardMaterial({ color: tone.color, emissive: tone.emissive, emissiveIntensity: 1.1, roughness: .3, transparent: true, opacity: 1 })
      : this.stoneMaterial(w, h)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), material)
    mesh.position.set(x, boxY, PLAYER_Z_DEPTH)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
    const platform = {
      id: id ?? null,
      x,
      y: boxY,
      w,
      h,
      surfaceY,
      safeX: safeX ?? x,
      solves: !!solves,
      phase: phase ?? null,
      motion: motion ? { ...motion, progress: 0, startedAt: null } : null,
      mesh,
      held: false,
      enabled,
    }
    this.platforms.push(platform)
    if (phase) this.phasePlatforms.push(platform)
    return platform
  }

  // `x` defaults to the platform's right edge, which is where Helios wants both of its springs.
  // Selene has to place its one spring by hand: a spring is only useful under an unobstructed
  // column, and the crater has a ceiling nearly everywhere.
  addSpring(platform, { id, x, revealed = false }) {
    const springX = x ?? platform.x + platform.w / 2 - .8
    const spring = new THREE.Group()
    spring.position.set(springX, platform.surfaceY, PLAYER_Z_DEPTH)
    spring.visible = revealed
    this.group.add(spring)

    // Synchronous placeholder so a spring already revealed by the time this frame renders (or
    // revealed a moment before the async model resolves) is never an invisible collider standing
    // on empty air -- the exact "transparent box" failure mode documented for Lockbox's chest.
    const placeholderMaterial = new THREE.MeshStandardMaterial({ color: '#e8d8ae', emissive: '#ffb347', emissiveIntensity: 1.1, roughness: .45 })
    const placeholder = new THREE.Mesh(new THREE.CylinderGeometry(.36, .42, SPRING_TARGET_HEIGHT, 10), placeholderMaterial)
    placeholder.position.y = SPRING_TARGET_HEIGHT / 2
    placeholder.castShadow = true
    placeholder.receiveShadow = true
    spring.add(placeholder)

    loadSpringModel().then((sourceMeshes) => {
      const model = new THREE.Group()
      sourceMeshes.forEach((node) => {
        const material = node.material.clone()
        if (material.name === 'Red') {
          material.color.set('#ffb347')
          material.emissive.set('#ff8c1a')
          material.emissiveIntensity = 1.3
        } else {
          boxProjectUV(node.geometry)
          material.map = springMetalMap
          material.color.set('#e8d8ae')
          material.emissive.set('#ffb347')
          material.emissiveIntensity = .5
          material.roughness = .4
          material.metalness = .6
        }
        const springMesh = new THREE.Mesh(node.geometry.clone(), material)
        springMesh.castShadow = true
        springMesh.receiveShadow = true
        model.add(springMesh)
      })
      // The source file's own local axes are Z-up (a typical Blender export); rotate onto Y-up
      // BEFORE measuring, so the Box3 below reflects how the object will actually stand in-game.
      model.rotation.x = -Math.PI / 2
      model.updateMatrixWorld(true)
      const rawBox = new THREE.Box3().setFromObject(model)
      const rawHeight = rawBox.max.y - rawBox.min.y || 1
      const scale = SPRING_TARGET_HEIGHT / rawHeight
      model.scale.setScalar(scale)
      model.updateMatrixWorld(true)
      const scaledBox = new THREE.Box3().setFromObject(model)
      model.position.y -= scaledBox.min.y
      model.position.x -= (scaledBox.max.x + scaledBox.min.x) / 2
      model.position.z -= (scaledBox.max.z + scaledBox.min.z) / 2
      spring.remove(placeholder)
      spring.add(model)
    })
    // The collision box reaches from the platform surface to the spring cap. It makes the spring
    // a real, standable object and prevents its launch from triggering through nearby floors.
    const collider = { x: springX, y: platform.surfaceY + .5, w: .84, h: 1 }
    const entry = { id, mesh: spring, collider, revealed }
    this.springs.push(entry)
    this.objects[id] = entry
    return entry
  }

  load(chapter) {
    this.clear()
    const shadow = darkShade(chapter.palette.close)
    this.shadow = shadow
    // Stone platforms used to share `shadow` (near-black, ~5% luma) too -- now they're textured and
    // deliberately brighter so the plaster's brushwork actually reads, while staying well below the
    // glowing interactive objects (mirror, glyphs, moon) so those still read as the brightest things
    // on screen. Same darkShade() helper, just a higher target.
    // Raised from .3 to .55 for the AI-restyled color map (see Visuals > Downloaded art > AI-restyled
    // textures in CLAUDE.md): at .3 the tint's multiply crushed nearly all of the restyled texture's
    // own color/brushwork out before it ever reached the lit material, so the repaint was practically
    // invisible in real gameplay despite reading clearly different as a standalone file. Verified via
    // screenshot, not assumed -- still stays under the glowing interactive objects' brightness.
    this.platformTint = darkShade(chapter.palette.close, .55)
    this.chapter = chapter
    const { layout } = chapter
    this.deathY = layout.deathY ?? -15
    this.gradeAxis = layout.gradeAxis ?? 'x'
    this.paletteColors = {
      open: new THREE.Color(chapter.palette.open),
      mid: new THREE.Color(chapter.palette.mid),
      close: new THREE.Color(chapter.palette.close),
    }
    paintSky(this.skyCtx, chapter.palette.open, chapter.palette.mid, chapter.palette.close)
    paintClouds(this.skyCtx, chapter.id, chapter.palette.open, chapter.palette.mid, chapter.palette.close)
    this.skyTexture.needsUpdate = true
    this.gradeColor.copy(this.paletteColors.open)
    this.scene.background = this.skyTexture
    this.scene.fog = new THREE.Fog(shadow, 10, 52)
    const ambient = new THREE.HemisphereLight(chapter.palette.close, chapter.palette.open, 2.4)
    const sun = new THREE.DirectionalLight(chapter.palette.open, 3.8)
    sun.position.set(-10, 14, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 80
    sun.shadow.camera.left = -45
    sun.shadow.camera.right = 45
    sun.shadow.camera.top = 30
    sun.shadow.camera.bottom = -50
    sun.shadow.bias = -.0015
    sun.shadow.normalBias = .02
    this.group.add(ambient, sun)
    this.ambient = ambient
    this.sun3d = sun

    // The starting ground defaults to the shared central hub, while a chapter may place it to
    // author a directed opening route. Helios uses that override for its left-to-right tutorial.
    this.hub = this.addPlatform({ x: 0, surfaceY: 0, w: 14, h: layout.platformHeight, ...layout.hub })
    this.buildFromLayout(chapter, shadow)

    const spans = this.platforms.map((platform) => ({
      minX: platform.x - platform.w / 2,
      maxX: platform.x + platform.w / 2,
      y: platform.surfaceY,
    }))
    this.gradeMinX = Math.min(...spans.map((span) => span.minX))
    this.gradeMaxX = Math.max(...spans.map((span) => span.maxX))
    this.gradeMinY = Math.min(...spans.map((span) => span.y))
    this.gradeMaxY = Math.max(...spans.map((span) => span.y))

    this.updateGrade(this.gradeAxis === 'y' ? this.gradeMaxY : this.gradeMinX, 0)
    return this.objects
  }

  // Everything is conditional on its layout key being present, so a chapter declares exactly the
  // furniture it wants. Helios: a twin-branched daytime room with a pit, two dial boxes, a burnable
  // wall and a doorway. Selene: a crater with phase surfaces, a moon, a moonwell chain and a dial.
  buildFromLayout(chapter, shadow) {
    const { layout } = chapter
    const platforms = { hub: this.hub }
    if (layout.pit) {
      this.lowerPlatform = this.addPlatform({ id: 'pit', ...layout.pit })
      platforms.pit = this.lowerPlatform
    }
    ;(layout.platforms ?? []).forEach((spec) => { platforms[spec.id] = this.addPlatform(spec) })
    ;(layout.springs ?? []).forEach((spec) => this.addSpring(platforms[spec.on], spec))

    const glow = layout.glow ?? '#ffd275'
    this.sun = new SunField(this.group, { zones: layout.lightZones ?? [], color: glow })
    this.objects.mirrors = (layout.mirrors ?? []).map((spec) => new Mirror(this.group, { ...spec, glow }))
    this.objects.receivers = (layout.receivers ?? []).map((spec) => {
      const receiver = new Receiver(this.group, { ...spec, glow })
      if (spec.hidden) receiver.group.visible = false
      return receiver
    })
    this.lensReceiverIds = new Set(layout.lensReceivers ?? [])

    if (layout.moon) {
      this.moon = new Moon(this.group, { ...layout.moon, phases: layout.phases, phase: layout.startPhase })
      this.moon.hide()
      this.objects.moon = this.moon
      this.phase = this.moon.phase
      this.applyPhase()
    }

    if (layout.lockbox) {
      const platform = platforms[layout.lockbox.on]
      this.objects.lockbox = new Lockbox(this.group, {
        ...layout.lockbox,
        x: platform.x,
        surfaceY: platform.surfaceY,
        shadow,
        glow: layout.lockbox.glow ?? '#f5b45d',
      })
    }
    if (layout.lensBox) {
      const platform = platforms[layout.lensBox.on]
      this.objects.lensBox = new Lockbox(this.group, {
        ...layout.lensBox,
        x: platform.x,
        surfaceY: platform.surfaceY,
        shadow,
        glow: layout.lensBox.glow ?? glow,
      })
      this.objects.lensBox.hide()
    }
    if (layout.lens) {
      this.objects.triangulation = new Triangulation(this.group, {
        lensPosition: { x: layout.lens.x, y: layout.lens.y },
        glow: layout.lens.glow ?? glow,
      })
      if (layout.lens.revealed) this.objects.triangulation.revealLens()
    }

    this.objects.meltBridge = layout.meltBridge
      ? createMeltBridge(this.group, { ...layout.meltBridge, depth: DEPTH, shadow, glow: '#ff8c1a' })
      : null
    if (layout.exitBridge) {
      const bridge = createBridge(this.group, { ...layout.exitBridge, depth: DEPTH, color: '#5b3b1d', emissive: glow })
      bridge.mesh.visible = false
      const marker = new THREE.Group()
      marker.position.set(layout.exitBridge.markerX, layout.exitBridge.markerY, PLAYER_Z_DEPTH)
      marker.add(new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 12), new THREE.MeshBasicMaterial({ color: glow })))
      marker.visible = false
      this.group.add(marker)
      this.objects.exitBridge = { ...bridge, group: marker, position: marker.position, revealed: false }
    }
    this.objects.exit = layout.exit
      ? new PeriscopeExit(this.group, { ...layout.exit, glow })
      : null
    if (layout.ladderWall) {
      const { x, y, height, steps } = layout.ladderWall
      const wall = new THREE.Group()
      wall.position.set(x, y, PLAYER_Z_DEPTH)
      // Same ambientCG "Plaster001" stone material the platforms and the burn wall use (see
      // stoneMaterial() above) -- the ladder is a climbable rock face, same object family. A light
      // emissive tint layers on top, matching the burn wall's treatment.
      const material = this.stoneMaterial(.8, height)
      material.emissive.set(glow)
      material.emissiveIntensity = .35
      const ladderMesh = new THREE.Mesh(new THREE.BoxGeometry(.8, height, DEPTH), material)
      ladderMesh.castShadow = true
      ladderMesh.receiveShadow = true
      wall.add(ladderMesh)
      this.group.add(wall)
      const rungs = steps.map((step, index) => {
        const rung = this.addPlatform({ id: `ladder-rung-${index}`, ...step, enabled: false })
        rung.mesh.visible = false
        return rung
      })
      this.objects.ladderWall = {
        group: wall,
        position: wall.position,
        active: true,
        activate: () => {
          wall.visible = false
          rungs.forEach((rung) => { rung.enabled = true; rung.mesh.visible = true })
        },
      }
    }
    if (layout.exitTrigger) {
      const { x, surfaceY } = layout.exitTrigger
      const marker = new THREE.Group()
      const keyMaterial = new THREE.MeshStandardMaterial({ color: '#f6c453', emissive: '#ff9f1c', emissiveIntensity: 2.2, roughness: .25 })
      const bow = new THREE.Mesh(new THREE.TorusGeometry(.22, .07, 8, 16), keyMaterial)
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(.12, .52, .08), keyMaterial)
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(.24, .12, .08), keyMaterial)
      bow.position.y = .28
      tooth.position.set(.06, -.22, .02)
      marker.add(bow, shaft, tooth)
      marker.position.set(x, surfaceY + .58, PLAYER_Z_DEPTH + .2)
      marker.visible = false
      this.group.add(marker)
      this.objects.exitTrigger = { group: marker, marker, position: marker.position, active: false, used: false }
    }
  }

  // --- Selene's phase layer -------------------------------------------------------------------

  // `groundedPlatform` is the platform the player is standing on right now. If the phase turns away
  // from it, it is *held*: it stays solid until they step off. A surface therefore never vanishes
  // out from under the player, which is what keeps Selene as failure-free as Helios -- turning the
  // dial can cost you a route, never a fall.
  setPhase(phase, groundedPlatform = null) {
    if (this.phase === phase) return false
    this.phase = phase
    this.applyPhase(groundedPlatform)
    return true
  }

  applyPhase(groundedPlatform = null) {
    this.phasePlatforms.forEach((platform) => {
      platform.held = platform.phase !== this.phase && platform === groundedPlatform
      if (!platform.motion) return
      platform.motion.progress = 0
      platform.motion.startedAt = null
      platform.x = platform.motion.fromX
      platform.mesh.position.x = platform.x
    })
  }

  releaseHeld(groundedPlatform) {
    this.phasePlatforms.forEach((platform) => {
      if (platform.held && platform !== groundedPlatform) platform.held = false
    })
  }

  isSolid(platform) {
    if (!platform.enabled) return false
    if (platform.motion && platform.phase === this.phase && platform.motion.progress < 1) return false
    return !platform.phase || platform.phase === this.phase || platform.held
  }

  // Out of phase, a surface is a ghost while the scope is raised and nothing at all while it is
  // down. Raising the scope is therefore how the player *reads* the crater -- the answer is always
  // on screen before they have to commit to a drop. A held surface pulses, which is the wordless
  // "this is going the moment you step off".
  updatePhaseVisuals(scopeRaised, elapsed) {
    this.phasePlatforms.forEach((platform) => {
      const material = platform.mesh.material
      if (platform.motion && platform.phase === this.phase) {
        if (platform.motion.startedAt === null) platform.motion.startedAt = elapsed
        platform.motion.progress = Math.min(1, (elapsed - platform.motion.startedAt) / platform.motion.duration)
        platform.x = THREE.MathUtils.lerp(platform.motion.fromX, platform.motion.toX, platform.motion.progress)
        platform.mesh.position.x = platform.x
      }
      if (platform.phase === this.phase) {
        platform.mesh.visible = true
        material.opacity = platform.motion && platform.motion.progress < 1 ? .62 : 1
        material.emissiveIntensity = platform.motion && platform.motion.progress < 1 ? 1.9 : 1.1
      } else if (platform.held) {
        platform.mesh.visible = true
        material.opacity = .55 + Math.sin(elapsed * 8) * .18
        material.emissiveIntensity = 1.9
      } else {
        // .17 was invisible in play -- a pale ghost at that opacity vanishes into the crater's
        // mid-blue sky, and the whole promise of the verb is that you can SEE what a phase would
        // give you before you commit to the drop. Legibility wins over subtlety here.
        platform.mesh.visible = scopeRaised
        material.opacity = .36
        material.emissiveIntensity = 1
      }
    })
  }

  // --- Light -----------------------------------------------------------------------------------

  // Traces light and applies everything it touches. `visible` gates the whole optical layer on
  // owning the telescope frame; in Helios `focusedMirror` is what commits a receiver, because there
  // the scope is the confirmation step. Selene's receivers are `hold` receivers instead: they are
  // simply true for as long as the beam is on them, so the pool chain has to be a standing
  // arrangement rather than a checklist.
  updateBeams({ visible, showDirections, focusedMirror }) {
    const result = { receiverHits: new Set() }
    if (!this.sun) return result
    const { segments, receiverHits } = this.sun.trace({
      mirrors: this.objects.mirrors,
      receivers: this.objects.receivers,
      masses: [],
      blockers: this.platforms.filter((platform) => this.isSolid(platform)),
    })
    this.sun.render(showDirections ? segments : [])
    this.objects.mirrors.forEach((mirror) => mirror.setLit(visible && mirror.lit))

    this.objects.receivers.forEach((receiver) => {
      if (receiver.hold) receiver.setHeld(visible && receiverHits.has(receiver))
      else if (visible && focusedMirror && receiverHits.has(receiver)) receiver.latch()
    })
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
    const colliders = this.platforms.filter((platform) => this.isSolid(platform))
    if (this.objects.meltBridge) {
      colliders.push(this.objects.meltBridge.melted
        ? this.objects.meltBridge.bridgeCollider
        : this.objects.meltBridge.wallCollider)
    }
    if (this.objects.exitBridge?.revealed) colliders.push(this.objects.exitBridge.collider)
    if (this.objects.lockbox?.collider) colliders.push(this.objects.lockbox.collider)
    if (this.objects.lensBox?.collider) colliders.push(this.objects.lensBox.collider)
    for (const spring of this.springs) {
      if (spring.revealed) colliders.push(spring.collider)
    }
    return colliders
  }

  // Finds safe checkpoint ground under a grounded player. Ledges overlap the platforms they fell
  // onto, so matching on x alone would return the platform *below* the ledge the player is actually
  // standing on and respawn them a step too low -- `feetY` disambiguates.
  //
  // Phase surfaces are deliberately excluded: a checkpoint on one would respawn the player into
  // empty air the moment the phase turned. Same reasoning that keeps Helios's bridges and decks out
  // of the platform list.
  platformAt(playerX, feetY) {
    let best = null
    let bestGap = Infinity
    for (const platform of this.platforms) {
      if (!platform.enabled) continue
      if (platform.phase) continue
      if (playerX < platform.x - platform.w / 2 || playerX > platform.x + platform.w / 2) continue
      const gap = Math.abs(platform.surfaceY - feetY)
      if (gap < bestGap) { bestGap = gap; best = platform }
    }
    return best
  }

  // The platform the player is physically standing on, phase surfaces included. Distinct from
  // platformAt(), which answers "where is it safe to respawn" -- this one answers "what is under
  // their feet", which is what the phase hold rule needs.
  standingOn(playerX, feetY) {
    let best = null
    let bestGap = Infinity
    for (const platform of this.platforms) {
      if (!this.isSolid(platform)) continue
      if (playerX < platform.x - platform.w / 2 || playerX > platform.x + platform.w / 2) continue
      const gap = Math.abs(platform.surfaceY - feetY)
      if (gap < bestGap) { bestGap = gap; best = platform }
    }
    return bestGap < .05 ? best : null
  }

  springUnder(body) {
    return this.springs.find((spring) => {
      if (!spring.revealed) return false
      const springTop = spring.collider.y + spring.collider.h / 2
      return Math.abs(body.x - spring.collider.x) <= body.hw + spring.collider.w / 2
        && Math.abs(body.y - body.hh - springTop) < .001
    }) ?? null
  }

  revealSpring(id) {
    const spring = this.objects[id]
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

  standingHeight(platform) {
    return platform.surfaceY + PLAYER_STAND_OFFSET
  }

  // How far through the chapter the player has travelled, 0-1. Drives the sky grade. Helios reads
  // it across x -- a journey from its orange left edge to its white summit. Selene reads it down y,
  // because its journey is a descent: pale at the crater's lip, deep navy at the water.
  gradeProgress(position) {
    if (this.gradeAxis === 'y') {
      const span = this.gradeMaxY - this.gradeMinY
      return span > 0 ? Math.min(1, Math.max(0, (this.gradeMaxY - position) / span)) : 0
    }
    return Math.min(1, Math.max(0, (position - this.gradeMinX) / (this.gradeMaxX - this.gradeMinX)))
  }

  updateGrade(position, delta) {
    const progress = this.gradeProgress(position)
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

  gradeInput(playerPosition) {
    return this.gradeAxis === 'y' ? playerPosition.y : playerPosition.x
  }

  updateGlow(elapsed, playerPosition) {
    this.objects.receivers.forEach((receiver) => receiver.update(elapsed))
    this.moon?.update(elapsed)
    this.objects.lockbox?.update(elapsed, playerPosition)
    this.objects.lensBox?.update(elapsed, playerPosition)
    this.objects.triangulation?.update(elapsed, playerPosition)
  }
}
