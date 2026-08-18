import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

// Kenney "Doorway Open" (CC0, part of the Dungeon/Fantasy kits, same source family as the Lockbox's
// chest) -- a frame with no door leaf, matching the existing "always-open portal" design: this game
// never shows the door literally opening or closing, so a model with a hinged panel would be wrong.
const DOORWAY_MODEL_URL = new URL('../assets/models/doorway.glb', import.meta.url).href
const DOORWAY_TARGET_WIDTH = 2.2 // matches the old frame's outer footprint (jambs at x=+-.95, .32 wide)
const DOORWAY_TARGET_HEIGHT = 4.4
const gltfLoader = new GLTFLoader()

// Unlike the chest, this model's own UVs are real and already set up for a tiling texture (U/V
// range roughly [-19, 19] -- confirmed via GLTFLoader.parse() in a standalone Node script, same
// technique used elsewhere in this pass) -- no boxProjectUV() needed here, just assign a map and let
// RepeatWrapping do its job. Reuses the same wood texture as the Lockbox chest (same Kenney/
// Quaternius kit family, same "wood"-named material on the source model) rather than generating a
// second independent one -- these two objects are meant to read as the same kind of wood.
const DOORWAY_WOOD_URL = new URL('../assets/textures/chest/wood.jpg', import.meta.url).href
const doorwayTextureLoader = new THREE.TextureLoader()
const doorwayWoodMap = doorwayTextureLoader.load(DOORWAY_WOOD_URL)
doorwayWoodMap.colorSpace = THREE.SRGBColorSpace
doorwayWoodMap.wrapS = doorwayWoodMap.wrapT = THREE.RepeatWrapping

let doorwayModelPromise = null
const loadDoorwayModel = () => {
  if (!doorwayModelPromise) {
    doorwayModelPromise = new Promise((resolve, reject) => {
      // Ships two near-duplicate nodes (same geometry, different primitive draw order); only the
      // first is used, same reasoning as the Lockbox chest.
      gltfLoader.load(DOORWAY_MODEL_URL, (gltf) => resolve(gltf.scene.children[0]), undefined, reject)
    })
  }
  return doorwayModelPromise
}

// The doorway. Helios pulls it in horizontally while the scope is raised -- walking toward it with
// the glass up is what closes the distance. Selene reuses the same easing on the other axis:
// `riseTo` makes the door climb out of the water while the player holds focus on it, and sink back
// the moment they look away. Same object, same one-line ease, opposite axis and opposite condition.
export class PeriscopeExit {
  constructor(group, { x, nearX = x, surfaceY, riseTo, glow, visible = false }) {
    this.homeY = surfaceY + 2.2
    this.nearY = riseTo ?? this.homeY
    this.position = new THREE.Vector3(x, this.homeY, PLAYER_Z_DEPTH)
    this.homeX = x
    this.nearX = nearX
    this.pulledCloser = false
    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    this.group.visible = visible
    this.glow = glow
    group.add(this.group)

    // The glowing "opening" plane is the actual interactive/pulse signal (reached(), the pulsing
    // update() below) -- a static wood frame model has no equivalent, so this stays procedural and
    // is what the frame model gets built around, not replaced.
    const light = new THREE.MeshStandardMaterial({ color: '#fff3bf', emissive: glow, emissiveIntensity: 2.5, roughness: .2 })
    this.opening = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 3.8), light)
    this.opening.position.z = .57
    this.group.add(this.opening)

    loadDoorwayModel().then((template) => {
      const frame = template.clone(true)
      frame.traverse((node) => {
        if (!node.isMesh) return
        node.material = node.material.clone()
        node.material.map = doorwayWoodMap
        node.castShadow = true
        node.receiveShadow = true
      })
      const rawBox = new THREE.Box3().setFromObject(frame)
      const rawSize = rawBox.getSize(new THREE.Vector3())
      const scale = Math.min(DOORWAY_TARGET_WIDTH / rawSize.x, DOORWAY_TARGET_HEIGHT / rawSize.y)
      frame.scale.setScalar(scale)
      const scaledBox = new THREE.Box3().setFromObject(frame)
      const center = scaledBox.getCenter(new THREE.Vector3())
      frame.position.x -= center.x
      frame.position.y -= center.y
      this.frame = frame
      this.group.add(frame)
    })
  }

  reveal() {
    if (this.group.visible) return false
    this.group.visible = true
    return true
  }

  setPulledCloser(pulledCloser, nearX = this.nearX) {
    this.pulledCloser = pulledCloser
    this.nearX = nearX
  }

  reached(playerPosition) {
    return this.group.visible && playerPosition.distanceTo(this.position) < 2
  }

  update(elapsed, delta = 0) {
    if (!this.group.visible) return
    if (delta > 0) {
      const targetX = this.pulledCloser ? this.nearX : this.homeX
      const targetY = this.pulledCloser ? this.nearY : this.homeY
      const factor = 1 - Math.exp(-delta * 5)
      this.position.x += (targetX - this.position.x) * factor
      this.position.y += (targetY - this.position.y) * factor
      this.group.position.copy(this.position)
    }
    this.opening.material.emissiveIntensity = 2.5
  }
}
