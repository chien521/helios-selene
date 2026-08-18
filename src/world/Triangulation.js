import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

const PICKUP_RANGE = 1.6

// Quaternius "Mineral" (CC0, poly.pizza/m/STixpWYaTd) replaces the glowing TorusGeometry ring.
// Unlike Mirror, this object has no parent-group rotation trick to work around -- it just spins on
// its own Z axis in the normal camera-facing orientation, so no edge-on/axis-hiding concerns apply.
const GEM_MODEL_URL = new URL('../assets/models/gem.glb', import.meta.url).href
const GEM_TARGET_SIZE = 1.1
const gltfLoader = new GLTFLoader()

// The 'Grey' rock-base mesh's own UV is degenerate (a single point, U[0,0] V[1,1] -- confirmed via
// GLTFLoader.parse() in a standalone Node script, same technique used on the chest) so a generated
// texture needs boxProjectUV() (see Lockbox.js for the fuller explanation of the technique) before it
// can show any detail. The 'Pink' crystal-facet mesh has a real, non-degenerate UV already, but stays
// procedural/emissive-only on purpose -- same reasoning as Mirror.js's Receiver class: a small,
// glowing focus-signal surface reads better as a clean glow than as textured detail.
const GEM_ROCK_URL = new URL('../assets/textures/gem/rock.jpg', import.meta.url).href
const gemTextureLoader = new THREE.TextureLoader()
const gemRockMap = gemTextureLoader.load(GEM_ROCK_URL)
gemRockMap.colorSpace = THREE.SRGBColorSpace
gemRockMap.wrapS = gemRockMap.wrapT = THREE.RepeatWrapping

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
let gemModelPromise = null
const loadGemModel = () => {
  if (!gemModelPromise) {
    gemModelPromise = new Promise((resolve, reject) => {
      gltfLoader.load(GEM_MODEL_URL, (gltf) => resolve(gltf.scene.children[0]), undefined, reject)
    })
  }
  return gemModelPromise
}

export class Triangulation {
  constructor(group, { lensPosition, glow }) {
    this.group = group
    this.lensPosition = new THREE.Vector3(lensPosition.x, lensPosition.y, PLAYER_Z_DEPTH)

    this.lens = new THREE.Group()
    this.lens.position.copy(this.lensPosition)
    this.lens.visible = false
    group.add(this.lens)

    // The source model ships two primitives ('Grey' rock base, 'Pink' crystal facets) -- tinted here
    // as a darker rock base and a fully emissive glow tip, rather than one flat color across both,
    // since a real two-material mineral cluster can carry that contrast where the old flat torus couldn't.
    loadGemModel().then((template) => {
      const model = template.clone(true)
      model.traverse((node) => {
        if (!node.isMesh) return
        node.material = node.material.clone()
        node.material.color.set(glow)
        if (node.material.name === 'Pink') {
          node.material.emissive.set(glow)
          node.material.emissiveIntensity = 2.4
        } else {
          boxProjectUV(node.geometry)
          node.material.map = gemRockMap
          node.material.emissive.set(glow)
          node.material.emissiveIntensity = .5
        }
      })
      const rawBox = new THREE.Box3().setFromObject(model)
      const rawSize = rawBox.getSize(new THREE.Vector3())
      const scale = GEM_TARGET_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z)
      model.scale.setScalar(scale)
      const scaledBox = new THREE.Box3().setFromObject(model)
      const center = scaledBox.getCenter(new THREE.Vector3())
      model.position.sub(center)
      this.lens.add(model)
    })
  }

  revealLens() {
    if (this.lens.visible) return false
    this.lens.visible = true
    return true
  }

  collectLens(playerPosition) {
    if (!this.lens.visible || playerPosition.distanceTo(this.lensPosition) >= PICKUP_RANGE) return false
    this.lens.visible = false
    return true
  }

  update() {
    if (this.lens.visible) this.lens.rotation.y += .025
  }
}
