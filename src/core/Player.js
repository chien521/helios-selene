import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import { moveAndCollide } from './Physics2D.js'

export const PLAYER_Z_DEPTH = -4
const SPEED = 8
const JUMP_VELOCITY = 11
const SPRING_VELOCITY = 23
const GRAVITY = 26
const COYOTE_TIME = .1
const JUMP_BUFFER_TIME = .1

const MODEL_URL = new URL('../assets/models/low_poly_wizard_traveler.glb', import.meta.url).href
const VIVERSE_IDLE_VRMA_URL = `${import.meta.env.BASE_URL}animations/idle.vrma`
const VISUAL_SCALE = 1.12
// The static traveler faces +Z; rotate it into the platformer's side view.
const BASE_FACING_Y = Math.PI / 2
const gltfLoader = new GLTFLoader()
gltfLoader.setCrossOrigin('anonymous')

export class Player {
  constructor(scene, spawnX, spawnY) {
    this.body = { x: spawnX, y: spawnY, vx: 0, vy: 0, hw: .5, hh: 1.1, grounded: false }
    this.coyote = 0
    this.jumpBuffer = 0
    this.position = new THREE.Vector3(spawnX, spawnY, PLAYER_Z_DEPTH)
    this.mesh = new THREE.Group()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)

    this.model = null
    this.mixer = null
    this.actions = {}
    this.currentAction = null
    this.facing = 1
    this.motionTime = 0
    this.landingTime = 0
    this.staticParts = {}
    this.modelRestPosition = new THREE.Vector3()
    this.modelRestScale = new THREE.Vector3()
    this.modelBaseFacingY = BASE_FACING_Y
    this.usingViverseAvatar = false
    this.vrm = null
    this.vrmMixer = null
    this.vrmBones = null
    this.vrmRestRotations = new Map()
    this._loadModel()
  }

  _loadModel() {
    gltfLoader.load(MODEL_URL, (gltf) => {
      if (this.usingViverseAvatar) return
      const model = gltf.scene
      model.traverse((node) => {
        if (node.isMesh) {
          node.material = node.material.clone()
          node.castShadow = true
        }
      })

      // Make the visual slightly larger than the collision capsule while keeping its feet grounded.
      const restBox = new THREE.Box3().setFromObject(model)
      const restHeight = restBox.max.y - restBox.min.y || 1
      const scale = (this.body.hh * 2 * VISUAL_SCALE) / restHeight
      model.scale.setScalar(scale)
      const scaledBox = new THREE.Box3().setFromObject(model)
      model.position.y -= scaledBox.min.y + this.body.hh
      model.position.x -= (scaledBox.max.x + scaledBox.min.x) / 2
      model.rotation.y = BASE_FACING_Y
      this.modelRestPosition.copy(model.position)
      this.modelRestScale.copy(model.scale)
      this.modelBaseFacingY = BASE_FACING_Y

      this.model = model
      this.mesh.add(model)

      for (const name of ['Arms', 'Cape', 'Feet', 'Head', 'Hat', 'Legs', 'SuitCase']) {
        const part = model.getObjectByName(name)
        if (!part) continue
        this.staticParts[name] = {
          node: part,
          position: part.position.clone(),
          rotation: part.rotation.clone(),
        }
      }

      this.mixer = new THREE.AnimationMixer(model)
      for (const clip of gltf.animations) {
        const key = clip.name.split('|').pop()
        this.actions[key] = this.mixer.clipAction(clip)
      }
      this._play('Idle')
    })
  }

  loadViverseAvatar(url) {
    if (!url) return Promise.resolve(false)
    return new Promise((resolve) => {
      const avatarLoader = new GLTFLoader()
      avatarLoader.setCrossOrigin('anonymous')
      avatarLoader.register((parser) => new VRMLoaderPlugin(parser))
      avatarLoader.load(url, async (gltf) => {
        try {
          const model = gltf.scene
          model.traverse((node) => {
            node.visible = true
            node.layers.set(0)
            if (node.isMesh) {
              node.castShadow = true
              node.receiveShadow = true
              node.frustumCulled = false
            }
          })

          const restBox = new THREE.Box3().setFromObject(model)
          const restHeight = restBox.max.y - restBox.min.y || 1
          const scale = (this.body.hh * 2 * VISUAL_SCALE) / restHeight
          model.scale.setScalar(scale)
          const scaledBox = new THREE.Box3().setFromObject(model)
          model.position.y -= scaledBox.min.y + this.body.hh
          model.position.x -= (scaledBox.max.x + scaledBox.min.x) / 2

          const previousModel = this.model
          this.mesh.add(model)
          if (previousModel) this.mesh.remove(previousModel)
          this.model = model
          this.modelRestPosition.copy(model.position)
          this.modelRestScale.copy(model.scale)
          // VRM avatars face -Z by convention; this puts them in the same side-on orientation
          // as the existing player and keeps the regular left/right facing logic intact.
          this.modelBaseFacingY = -Math.PI / 2
          this.staticParts = {}
          this.actions = {}
          this.currentAction = null
          this.mixer = null
          this.usingViverseAvatar = true
          this.vrm = gltf.userData.vrm || null
          this.vrmBones = this.vrm ? this._getVrmBones(this.vrm) : null
          this.vrmRestRotations = new Map(Object.values(this.vrmBones || {})
            .filter(Boolean)
            .map((bone) => [bone, bone.quaternion.clone()]))
          this.vrmMixer = this.vrm ? await this._loadVrmIdleAnimation(this.vrm) : null
          resolve(true)
        } catch (error) {
          console.warn('VIVERSE avatar setup failed.', error)
          resolve(false)
        }
      }, undefined, (error) => {
        console.warn('VIVERSE avatar load failed.', error)
        resolve(false)
      })
    })
  }

  async _loadVrmIdleAnimation(vrm) {
    try {
      if (vrm.lookAt) {
        const lookAtProxy = new VRMLookAtQuaternionProxy(vrm.lookAt)
        lookAtProxy.name = 'lookAtQuaternionProxy'
        vrm.scene.add(lookAtProxy)
      }
      const animationLoader = new GLTFLoader()
      animationLoader.register((parser) => new VRMAnimationLoaderPlugin(parser))
      const animationGltf = await animationLoader.loadAsync(VIVERSE_IDLE_VRMA_URL)
      const animation = animationGltf.userData.vrmAnimations?.[0]
      if (!animation) throw new Error('No VRMA animation was found in the idle clip.')
      const clip = createVRMAnimationClip(animation, vrm)
      const mixer = new THREE.AnimationMixer(vrm.scene)
      mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play()
      return mixer
    } catch (error) {
      console.warn('VIVERSE VRMA idle animation failed to load.', error)
      return null
    }
  }

  _getVrmBones(vrm) {
    const bone = (name) => vrm.humanoid?.getNormalizedBoneNode(name) || null
    return {
      leftUpperArm: bone('leftUpperArm'), rightUpperArm: bone('rightUpperArm'),
      leftLowerArm: bone('leftLowerArm'), rightLowerArm: bone('rightLowerArm'),
      leftUpperLeg: bone('leftUpperLeg'), rightUpperLeg: bone('rightUpperLeg'),
      spine: bone('spine'),
    }
  }

  _poseVrmBone(bone, rotations) {
    const rest = this.vrmRestRotations.get(bone)
    if (!bone || !rest) return
    bone.quaternion.copy(rest)
    rotations.forEach(({ axis, angle, space = 'local' }) => {
      const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle)
      if (space === 'parent') bone.quaternion.premultiply(rotation)
      else bone.quaternion.multiply(rotation)
    })
  }

  _animateViverseAvatar(delta, axis) {
    const moving = Math.min(Math.abs(axis), 1)
    const airborne = !this.body.grounded
    this.motionTime += delta
    if (this.vrmMixer && !airborne && moving < .01) {
      this.vrmMixer.update(delta)
      return
    }

    const bones = this.vrmBones
    if (!bones) return
    const stride = Math.sin(this.motionTime * 13) * moving
    const armLift = airborne ? .2 : 0
    this._poseVrmBone(bones.leftUpperArm, [
      { axis: new THREE.Vector3(0, 0, 1), angle: 1.05 - armLift },
      { axis: new THREE.Vector3(1, 0, 0), angle: -stride * .52, space: 'parent' },
    ])
    this._poseVrmBone(bones.rightUpperArm, [
      { axis: new THREE.Vector3(0, 0, 1), angle: -1.05 + armLift },
      { axis: new THREE.Vector3(1, 0, 0), angle: stride * .52, space: 'parent' },
    ])
    this._poseVrmBone(bones.leftLowerArm, [{ axis: new THREE.Vector3(1, 0, 0), angle: -.12 + Math.max(0, stride) * .22 }])
    this._poseVrmBone(bones.rightLowerArm, [{ axis: new THREE.Vector3(1, 0, 0), angle: -.12 + Math.max(0, -stride) * .22 }])
    this._poseVrmBone(bones.leftUpperLeg, [{ axis: new THREE.Vector3(1, 0, 0), angle: airborne ? -.3 : -stride * .45 }])
    this._poseVrmBone(bones.rightUpperLeg, [{ axis: new THREE.Vector3(1, 0, 0), angle: airborne ? -.3 : stride * .45 }])
    this._poseVrmBone(bones.spine, [{ axis: new THREE.Vector3(0, 0, 1), angle: airborne ? Math.sign(this.body.vy) * -.08 : 0 }])
  }

  _animateStaticTraveler(delta, axis) {
    if (!this.model) return
    this.motionTime += delta
    const moving = Math.abs(axis) > .01 && this.body.grounded
    const airborne = !this.body.grounded
    const pace = moving ? 8 : 2
    const cycle = this.motionTime * pace
    const bob = moving ? Math.sin(cycle) * .035 : Math.sin(cycle) * .012
    const sway = moving ? Math.sin(cycle) : Math.sin(cycle) * .25
    const lift = airborne ? Math.min(.05, Math.abs(this.body.vy) * .003) : 0
    const landing = this.landingTime / .14
    const jumpStretch = airborne ? (this.body.vy > 0 ? .035 : .018) : -landing * .045

    this.model.position.copy(this.modelRestPosition)
    this.model.position.y += bob + lift
    this.model.scale.copy(this.modelRestScale)
    this.model.scale.x *= 1 - jumpStretch
    this.model.scale.y *= 1 + jumpStretch
    this.model.scale.z *= 1 - jumpStretch
    this.model.rotation.z = airborne ? -this.facing * .06 : moving ? -sway * .035 : 0

    this._setStaticPartMotion('Arms', 0, 0, sway * .16)
    this._setStaticPartMotion('Cape', 0, -lift * .3, airborne ? -.13 : -sway * .06)
    this._setStaticPartMotion('Feet', 0, landing * .025, moving ? -sway * .09 : 0, moving ? -sway * .045 : 0)
    this._setStaticPartMotion('Head', 0, bob * .35, -sway * .015)
    this._setStaticPartMotion('Hat', 0, bob * .35, -sway * .02)
    this._setStaticPartMotion('Legs', 0, landing * .02, moving ? sway * .07 : 0, moving ? sway * .05 : 0)
    this._setStaticPartMotion('SuitCase', 0, -lift * .5, airborne ? .16 : sway * .12)
  }

  _setStaticPartMotion(name, x, y, rotationZ, z = 0) {
    const part = this.staticParts[name]
    if (!part) return
    part.node.position.copy(part.position).add({ x, y, z })
    part.node.rotation.copy(part.rotation)
    part.node.rotation.z += rotationZ
  }

  _play(name) {
    const next = this.actions[name]
    if (!next || this.currentAction === next) return
    next.reset().fadeIn(.15).play()
    this.currentAction?.fadeOut(.15)
    this.currentAction = next
  }

  reset(spawnX, spawnY) {
    Object.assign(this.body, { x: spawnX, y: spawnY, vx: 0, vy: 0, grounded: false })
    this.coyote = 0
    this.jumpBuffer = 0
    this.position.set(spawnX, spawnY, PLAYER_Z_DEPTH)
    this.mesh.position.copy(this.position)
  }

  jump() {
    this.jumpBuffer = JUMP_BUFFER_TIME
  }

  launchFromSpring() {
    this.body.vy = SPRING_VELOCITY
    this.body.grounded = false
  }

  update(delta, axis, colliders) {
    this.body.vx = axis * SPEED
    this.coyote = this.body.grounded ? COYOTE_TIME : Math.max(0, this.coyote - delta)
    this.jumpBuffer = Math.max(0, this.jumpBuffer - delta)
    if (this.jumpBuffer > 0 && (this.body.grounded || this.coyote > 0)) {
      this.body.vy = JUMP_VELOCITY
      this.body.grounded = false
      this.coyote = 0
      this.jumpBuffer = 0
    }
    this.body.vy -= GRAVITY * delta
    const wasGrounded = this.body.grounded
    moveAndCollide(this.body, delta, colliders)
    this.landingTime = this.body.grounded && !wasGrounded ? .14 : Math.max(0, this.landingTime - delta)
    this.position.set(this.body.x, this.body.y, PLAYER_Z_DEPTH)
    this.mesh.position.copy(this.position)

    if (axis > 0.01) this.facing = 1
    else if (axis < -0.01) this.facing = -1
    if (this.model) {
      this.model.rotation.y = this.modelBaseFacingY + (this.facing < 0 ? Math.PI : 0)
      if (this.usingViverseAvatar) {
        this.model.position.copy(this.modelRestPosition)
        this.model.scale.copy(this.modelRestScale)
        this.model.rotation.z = 0
        this._animateViverseAvatar(delta, axis)
        this.vrm?.update(delta)
      } else {
        this._animateStaticTraveler(delta, axis)
      }
    }

    this.mixer?.update(delta)
    this._play(!this.body.grounded ? 'Roll' : Math.abs(axis) > 0.01 ? 'Walk' : 'Idle')
  }
}
