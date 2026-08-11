import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

// Helios's focus target begins as a standing rock. When charged, it falls rightward to become the
// first platform of the redesigned exit route.
export function createGate(group, { x, surfaceY, shadow, base }) {
  const height = 6.2
  const thickness = 1.2
  const gate = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, 1.5), new THREE.MeshStandardMaterial({ color: shadow, emissive: base, emissiveIntensity: .9, roughness: .8 }))
  const standingY = surfaceY + height / 2
  gate.position.set(x, standingY, PLAYER_Z_DEPTH)
  gate.userData.gate = {
    fallen: false,
    fallProgress: 0,
    standing: { x, y: standingY },
    fallenPosition: { x: x + height / 2, y: surfaceY + thickness / 2 },
    fallenCollider: { x: x + height / 2, y: surfaceY + .4, w: height, h: .8 },
  }
  group.add(gate)
  return { mesh: gate, collider: { x, y: standingY, w: thickness, h: height } }
}

// Selene's lens power: stabilize/reveal. The bridge is only a solid collider while the telescope
// is raised and trained on it -- lower the telescope and it fades, same as any stabilized surface
// in this chapter. Spans flush between `left` and `right` (typically the hub's edge and a landing
// platform's edge) -- its top surface must land exactly on `surfaceY` (center = surfaceY - h/2):
// centering it AT surfaceY instead left its deck .2 above the platforms' surface, and since
// there's no step-up in the collision resolver, that tiny mismatch reads as a low wall blocking
// entry, not a floor.
export function createBridge(group, { left, right, surfaceY, depth }) {
  const height = .4
  const width = right - left
  const x = (left + right) / 2
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color: '#b7edfb', transparent: true, opacity: .18, emissive: '#9ce6f7', emissiveIntensity: 1 }))
  bridge.position.set(x, surfaceY - height / 2, PLAYER_Z_DEPTH)
  group.add(bridge)
  return { mesh: bridge, collider: { x, y: surfaceY - height / 2, w: width, h: height } }
}

// Returns true the instant focus topples the standing rock, so the caller can update the objective
// exactly once.
export function updateGate(gate, focus) {
  const state = gate.userData.gate
  if (focus >= 1 && !state.fallen) {
    state.fallen = true
    return true
  }
  return false
}

export function animateGate(gate, delta) {
  const state = gate.userData.gate
  if (!state.fallen || state.fallProgress >= 1) return
  state.fallProgress = Math.min(1, state.fallProgress + delta * 1.7)
  const t = state.fallProgress
  gate.rotation.z = -Math.PI / 2 * t
  gate.position.x = state.standing.x + (state.fallenPosition.x - state.standing.x) * t
  gate.position.y = state.standing.y + (state.fallenPosition.y - state.standing.y) * t
}

export function updateBridge(bridge, stabilized) {
  bridge.material.opacity = stabilized ? .92 : .1
  bridge.visible = stabilized
}
