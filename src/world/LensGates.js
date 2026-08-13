import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

// Color a mass glows toward as the burning glass heats it, and again once it has toppled.
const HOT = new THREE.Color('#ff2600')

// Helios's focus targets: standing rocks that topple into walkable ledges once the burning glass
// has held on them long enough. Helios uses three of these at increasing heights, so this builds a
// generic mass rather than one bespoke gate.
//
// `thickness` is deliberately small (.8). The toppled ledge's top sits at surfaceY + thickness, and
// the player has to jump onto it from a standstill hard against the *standing* mass's near face --
// there is no run-up. With JUMP_VELOCITY=10/GRAVITY=26/SPEED=8 the player's feet clear a .8 rise
// after .73 units of travel but need 1.19 units to clear a 1.2 rise, and only ~.9 units of
// clearance exist between where the standing mass blocks them and where the fallen ledge begins.
// A thicker mass therefore makes its own ledge unjumpable -- the player clips the corner and gets
// resolved back. Do not raise this without re-deriving that margin.
export function createFallingMass(group, { x, surfaceY, height = 6.2, thickness = .8, depth = 1.5, fallDirection = 1, shadow, base }) {
  const mass = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, height, depth),
    new THREE.MeshStandardMaterial({ color: shadow, emissive: base, emissiveIntensity: .9, roughness: .8 }),
  )
  const standingY = surfaceY + height / 2
  mass.position.set(x, standingY, PLAYER_Z_DEPTH)
  const fallenX = x + fallDirection * height / 2
  mass.userData.gate = {
    fallen: false,
    fallProgress: 0,
    registered: false,
    heat: 0,
    fallDirection,
    baseEmissive: new THREE.Color(base),
    standing: { x, y: standingY },
    collider: { x, y: standingY, w: thickness, h: height },
    fallenPosition: { x: fallenX, y: surfaceY + thickness / 2 },
    fallenCollider: { x: fallenX, y: surfaceY + thickness / 2, w: height, h: thickness },
  }
  group.add(mass)
  return mass
}

// Selene's lens power: stabilize/reveal. The bridge is only a solid collider while the telescope
// is raised and trained on it -- lower the telescope and it fades, same as any stabilized surface
// in this chapter. Spans flush between `left` and `right` (typically the hub's edge and a landing
// platform's edge) -- its top surface must land exactly on `surfaceY` (center = surfaceY - h/2):
// centering it AT surfaceY instead left its deck .2 above the platforms' surface, and since
// there's no step-up in the collision resolver, that tiny mismatch reads as a low wall blocking
// entry, not a floor.
export function createBridge(group, { left, right, surfaceY, depth, color = '#b7edfb', emissive = '#9ce6f7' }) {
  const height = .4
  const width = right - left
  const x = (left + right) / 2
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: .18, emissive, emissiveIntensity: 1 }))
  bridge.position.set(x, surfaceY - height / 2, PLAYER_Z_DEPTH)
  group.add(bridge)
  return { mesh: bridge, collider: { x, y: surfaceY - height / 2, w: width, h: height } }
}

export function createMeltBridge(group, { wallX, left, right, surfaceY, depth, shadow, glow }) {
  const wallHeight = 6.2
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, wallHeight, 1.5),
    new THREE.MeshStandardMaterial({ color: shadow, emissive: glow, emissiveIntensity: .8, roughness: .8 }),
  )
  wall.position.set(wallX, surfaceY + wallHeight / 2, PLAYER_Z_DEPTH)
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(right - left, .55, depth),
    new THREE.MeshStandardMaterial({ color: '#5b3b1d', emissive: glow, emissiveIntensity: .8, roughness: .7 }),
  )
  bridge.position.set((left + right) / 2, surfaceY + .275, PLAYER_Z_DEPTH)
  bridge.visible = false
  const object = new THREE.Group()
  object.add(wall, bridge)
  object.position.set(0, 0, 0)
  group.add(object)
  return {
    group: object,
    position: wall.position,
    wall,
    bridge,
    melted: false,
    wallCollider: { x: wallX, y: surfaceY + wallHeight / 2, w: 1.2, h: wallHeight },
    bridgeCollider: { x: (left + right) / 2, y: surfaceY + .275, w: right - left, h: .55 },
  }
}

export function meltWall(meltBridge) {
  if (meltBridge.melted) return false
  meltBridge.melted = true
  meltBridge.wall.visible = false
  meltBridge.bridge.visible = true
  return true
}

// Returns true the instant focus topples the standing mass, so the caller can register its fallen
// ledge as standable ground exactly once.
export function updateGate(mass, focus) {
  const state = mass.userData.gate
  if (focus >= 1 && !state.fallen) {
    state.fallen = true
    state.heat = 1
    return true
  }
  return false
}

export function animateGate(mass, delta) {
  const state = mass.userData.gate
  if (!state.fallen || state.fallProgress >= 1) return
  state.fallProgress = Math.min(1, state.fallProgress + delta * 1.7)
  const t = state.fallProgress
  mass.rotation.z = -Math.PI / 2 * t * state.fallDirection
  mass.position.x = state.standing.x + (state.fallenPosition.x - state.standing.x) * t
  mass.position.y = state.standing.y + (state.fallenPosition.y - state.standing.y) * t
}

// Wordless feedback for the burning glass: a mass visibly heats toward red while the player holds
// focus on it and cools the instant they let go, so a partial hold leaves a readable mark and
// teaches "hold longer" without a line of text.
export function applyHeat(mass, amount) {
  const state = mass.userData.gate
  state.heat = state.fallen ? 1 : amount
  mass.material.emissive.copy(state.baseEmissive).lerp(HOT, state.heat)
  mass.material.emissiveIntensity = .9 + state.heat * 1.8
}

