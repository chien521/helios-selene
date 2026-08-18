import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { PLAYER_Z_DEPTH } from '../core/Player.js'
import { t } from '../i18n.js'

const DEFAULT_GLYPHS = ['sun', 'moon', 'star']
const DEFAULT_SOLUTION = ['sun', 'star', 'moon']
const DEFAULT_HINT_KEY = 'helios.lockboxHint'
const INTERACTION_RANGE = 2.2
const PICKUP_RANGE = 1.6

const material = (color, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .35 })

// Quaternius "Wood Chest" (CC0, poly.pizza) replaces the plain BoxGeometry body/lid.
const CHEST_MODEL_URL = new URL('../assets/models/chest.glb', import.meta.url).href
const gltfLoader = new GLTFLoader()

// The source model's own UVs sample a tiny sliver (~0.06 x 0.001) of a shared Kenney/Quaternius
// "Atlas" texture -- packed color-chip style, no room for real surface variation, which is why the
// chest read as flat-tinted even though it technically had a `map`. A fresh AI-generated wood
// texture needs real UVs to show any detail, so boxProjectUV() below replaces the atlas UVs with a
// simple box/planar projection before this map is applied.
const CHEST_WOOD_URL = new URL('../assets/textures/chest/wood.jpg', import.meta.url).href
const chestTextureLoader = new THREE.TextureLoader()
const chestWoodMap = chestTextureLoader.load(CHEST_WOOD_URL)
chestWoodMap.colorSpace = THREE.SRGBColorSpace
chestWoodMap.wrapS = chestWoodMap.wrapT = THREE.RepeatWrapping

// Simple box/planar UV projection: for each vertex, pick the projection plane from its normal's
// dominant axis, then normalize position on that plane by the SAME divisor (the mesh's own largest
// bounding-box extent) for every axis -- using per-face extents instead would stretch the square
// source texture into whatever aspect ratio each face happens to have. The biggest face gets exactly
// one full tile; smaller faces get a proportional fraction, so nothing looks stretched.
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
let chestModelPromise = null
const loadChestModel = () => {
  if (!chestModelPromise) {
    chestModelPromise = new Promise((resolve, reject) => {
      gltfLoader.load(CHEST_MODEL_URL, (gltf) => resolve(gltf.scene.children.find((n) => n.isMesh) || gltf.scene.children[0]), undefined, reject)
    })
  }
  return chestModelPromise
}

// Ten of the fourteen glyph types are sourced from game-icons.net (CC BY 3.0 -- credited in the
// How to play screen, see main.js) instead of hand-built THREE.Shape data. `new`/`full`/`waning`
// (Selene's moon dial) and the Helios `moon` glyph stay procedural on purpose: they're built with
// the exact same "lit disc + shade cutout" trick Moon.js itself uses (see the comment in glyph()
// below), which visually ties the dial to the actual sky object -- an SVG icon would lose that.
const SVG_GLYPH_FILES = {
  sun: 'sun', star: 'star', owl: 'owl', fox: 'fox', elephant: 'elephant', human: 'human',
  fire: 'fire', wind: 'wind', dust: 'dust', ice: 'ice',
}
const svgLoader = new SVGLoader()
const svgShapePromises = {}
const svgShapeResolved = {} // synchronous lookup once a promise settles, so glyph() itself can stay sync
const loadGlyphShapes = (type) => {
  if (!SVG_GLYPH_FILES[type]) return Promise.resolve(null) // procedural type, nothing to load
  if (!svgShapePromises[type]) {
    const url = new URL(`../assets/glyphs/${SVG_GLYPH_FILES[type]}.svg`, import.meta.url).href
    svgShapePromises[type] = new Promise((resolve, reject) => {
      svgLoader.load(url, (data) => resolve(data.paths.flatMap((path) => path.toShapes())), undefined, reject)
    }).then((shapes) => { svgShapeResolved[type] = shapes; return shapes })
  }
  return svgShapePromises[type]
}

// Builds a glyph mesh from cached game-icons.net SVG shapes (see SVG_GLYPH_FILES above). SVG space
// is Y-down and in pixel units (viewBox 0 0 512 512); THREE shapes are Y-up, so this normalizes to
// `targetSize` world units and flips Y while recentring on the shape's own bounding box, rather than
// assuming every icon is centred on the SVG origin the way the hand-built shapes were.
function svgGlyph(type, color, targetSize = .68) {
  const group = new THREE.Group()
  const shapes = svgShapeResolved[type]
  if (!shapes) { group.add(new THREE.Mesh(new THREE.CircleGeometry(.3, 20), material(color, 1.8))); return group } // pre-load race guard, see loadGlyphShapes
  const geometry = new THREE.ShapeGeometry(shapes)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const scale = targetSize / Math.max(box.max.x - box.min.x, box.max.y - box.min.y)
  const mesh = new THREE.Mesh(geometry, material(color, 1.8))
  mesh.scale.set(scale, -scale, 1)
  mesh.position.set(-(box.min.x + box.max.x) / 2 * scale, (box.min.y + box.max.y) / 2 * scale, 0)
  group.add(mesh)
  return group
}

const digitTextures = {}
function digitGlyph(type, color) {
  if (!digitTextures[type]) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.font = '900 112px Arial Black, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(type, 64, 66)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    digitTextures[type] = texture
  }
  const group = new THREE.Group()
  group.add(new THREE.Mesh(
    new THREE.PlaneGeometry(.66, .76),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, map: digitTextures[type], transparent: true, depthWrite: false, roughness: .3 }),
  ))
  return group
}

// `shade` is the colour a carved-out region is painted in -- crescents are made by laying a
// near-dark disc over a bright one, so it has to match the box it sits in or the cutout reads as a
// second lit shape. Helios's boxes keep the original brown; Selene passes a navy.
function glyph(type, color, shade = '#352009') {
  if (SVG_GLYPH_FILES[type]) return svgGlyph(type, color)
  if (/^[1-3]$/.test(type)) return digitGlyph(type, color)
  const group = new THREE.Group()
  if (type === 'moon') {
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
  }
  return group
}

export class Lockbox {
  constructor(group, { x, surfaceY, shadow, glow, glyphs = DEFAULT_GLYPHS, solution = DEFAULT_SOLUTION, hintKey = DEFAULT_HINT_KEY, ringSpacing = .72, interactionRange = INTERACTION_RANGE, showFrameReward = true, glyphColor = '#f5b45d', glyphShade = '#352009' }) {
    this.x = x
    this.surfaceY = surfaceY
    this.glyphColor = glyphColor
    this.glyphShade = glyphShade
    this.group = new THREE.Group()
    this.group.position.set(x, surfaceY, PLAYER_Z_DEPTH)
    group.add(this.group)
    this.glyphs = glyphs
    this.solution = solution
    this.hintKey = hintKey
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

    this.frame = new THREE.Mesh(new THREE.TorusGeometry(.48, .1, 10, 20), material(glow, 2))
    this.frame.position.set(x, surfaceY + .48, PLAYER_Z_DEPTH + .65)
    this.frame.visible = false
    group.add(this.frame)

    // A plain box, sized and positioned exactly where the real chest will end up once it loads, is
    // added synchronously here -- so there is never a frame where the box's collider/interaction
    // prompt are live but nothing is actually rendered on the platform. Without this, a slow enough
    // chest-model load (real network latency, not just the artificial delay used to test it) reads
    // to a player as "the box is transparent": they can see straight through its footprint to the
    // platform underneath. Combined with the atomic swap below, the box is solid from frame one and
    // its face only gains detail (real chest geometry + dial icons) once both are ready.
    this.chestPlaceholder = new THREE.Mesh(new THREE.BoxGeometry(width, 1.7, 1.1), new THREE.MeshStandardMaterial({ color: shadow, roughness: .85 }))
    this.chestPlaceholder.position.set(0, .85, 0)
    this.chestPlaceholder.castShadow = true
    this.chestPlaceholder.receiveShadow = true
    this.group.add(this.chestPlaceholder)

    // The chest body (Quaternius "Wood Chest", CC0) and the dial glyphs (game-icons.net SVGs) load
    // from two very differently-sized files -- the glyph SVGs are ~1-3KB and resolve almost
    // instantly, while the chest model is a ~130KB binary that measurably lags behind. Building the
    // rings as soon as the glyphs alone were ready (an earlier version) left a real, visible window
    // where the dial icons floated with no box body under them yet. Both now wait on the same
    // combined Promise.all so the real chest and its dials always appear in the same frame,
    // atomically, replacing the placeholder above rather than racing each other.
    Promise.all([loadChestModel(), ...glyphs.map(loadGlyphShapes)]).then(([template]) => {
      const chest = template.clone(true)
      chest.traverse((node) => {
        if (!node.isMesh) return
        node.material = node.material.clone()
        node.castShadow = true
        node.receiveShadow = true
        // Replace the source model's unusable atlas-sliver UVs with a real box projection, then swap
        // in the AI-generated wood map. Deliberately NOT tinted with `shadow` (the near-black color
        // the rest of this constructor uses) -- that already crushed one AI-restyled texture to
        // invisible once (see platformTint in ChapterLoader.js/CLAUDE.md) and would do the same here.
        // White multiply lets the generated texture's own painted color carry the look.
        boxProjectUV(node.geometry)
        node.material.map = chestWoodMap
        node.material.color.set('#ffffff')
      })
      const rawBox = new THREE.Box3().setFromObject(chest)
      const rawSize = rawBox.getSize(new THREE.Vector3())
      chest.scale.set(width / rawSize.x, 1.7 / rawSize.y, 1.1 / rawSize.z)
      const scaledBox = new THREE.Box3().setFromObject(chest)
      chest.position.x -= (scaledBox.max.x + scaledBox.min.x) / 2
      chest.position.y -= scaledBox.min.y
      chest.position.z -= (scaledBox.max.z + scaledBox.min.z) / 2
      this.chest = chest
      this.group.remove(this.chestPlaceholder)
      this.group.add(chest)

      this.ringPositions.forEach((xPosition, index) => {
        const ring = new THREE.Group()
        ring.position.set(xPosition, .9, .6)
        ring.selectionHalo = new THREE.Mesh(
          new THREE.TorusGeometry(.48, .025, 8, 24),
          material(this.glyphColor, 2.4),
        )
        ring.selectionHalo.position.z = .1
        ring.selectionHalo.visible = false
        ring.add(ring.selectionHalo)
        this.group.add(ring)
        this.rings.push(ring)
        this.setGlyph(index)
      })
    })
  }

  setGlyph(index) {
    const ring = this.rings[index]
    if (!ring) return // rings still awaiting their glyph SVGs, see the constructor
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
    return t('lockboxPrompt')
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
      ring.selectionHalo.visible = index === selected
      if (ring.selectionHalo.visible) ring.selectionHalo.material.emissiveIntensity = 2.2 + Math.sin(elapsed * 7) * .9
      // Scale each part relative to its own base intensity rather than to a flat value -- the moon
      // glyph's crescent is carved by a deliberately near-dark cutout mesh, and forcing every child
      // to one brightness would light that cutout up and erase the crescent.
      ring.glyph?.children.forEach((part) => {
        if (part.userData.baseIntensity === undefined) part.userData.baseIntensity = part.material.emissiveIntensity
        part.material.emissiveIntensity = part.userData.baseIntensity * (index === selected ? 2.6 : 1)
      })
    })
    if (this.frame.visible) this.frame.rotation.z += .025
  }
}