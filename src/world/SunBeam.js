import * as THREE from 'three'
import { PLAYER_Z_DEPTH } from '../core/Player.js'

// Everything in this game sits on one z plane, so beam tracing is plain 2D geometry.
const MAX_CHAIN = 4
const BEAM_LENGTH = 30
const MIRROR_RADIUS = 1.1
const RECEIVER_RADIUS = .7
const MAX_SEGMENTS = 16

// Nearest positive ray/circle intersection, or Infinity. Used for mirrors and receivers, whose
// generous radii are gameplay values rather than visual ones -- they set how wide the angular
// window is when sweeping a mirror onto a target, so tune them against TURN_SPEED, not against
// how big the meshes look.
function hitCircle(ox, oy, dx, dy, cx, cy, r) {
  const mx = ox - cx
  const my = oy - cy
  const b = mx * dx + my * dy
  const c = mx * mx + my * my - r * r
  const disc = b * b - c
  if (disc < 0) return Infinity
  const root = Math.sqrt(disc)
  const near = -b - root
  if (near > 1e-4) return near
  const far = -b + root
  return far > 1e-4 ? far : Infinity
}

// Nearest positive ray/AABB intersection (slab method), or Infinity. Used for burnable masses and
// for terrain, so light cannot shine through solid rock.
function hitBox(ox, oy, dx, dy, box) {
  let tmin = -Infinity
  let tmax = Infinity
  const axes = [[ox, dx, box.x, box.w / 2], [oy, dy, box.y, box.h / 2]]
  for (const [origin, direction, center, half] of axes) {
    if (Math.abs(direction) < 1e-8) {
      if (Math.abs(origin - center) > half) return Infinity
      continue
    }
    let near = (center - half - origin) / direction
    let far = (center + half - origin) / direction
    if (near > far) [near, far] = [far, near]
    tmin = Math.max(tmin, near)
    tmax = Math.min(tmax, far)
  }
  if (tmax < Math.max(tmin, 1e-4)) return Infinity
  return tmin > 1e-4 ? tmin : Infinity
}

// Sunlight as a routed, physical thing. Light enters the room in shafts (`zones`, x ranges); a
// mirror standing in a shaft is lit and throws a beam along the direction it faces; that beam can
// light another mirror, which throws its own. Everything the player does to a burnable rock happens
// because light reached it, never because a button was held.
export class SunField {
  constructor(group, { zones = [], color = '#ffd275' } = {}) {
    this.zones = zones
    this.positions = new Float32Array(MAX_SEGMENTS * 2 * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setDrawRange(0, 0)
    this.lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: .85 }),
    )
    this.lines.frustumCulled = false
    group.add(this.lines)

  }

  isSunlit(x) {
    return this.zones.some(([from, to]) => x >= from && x <= to)
  }

  // Breadth-first along the chain so each mirror is processed at most once -- that is also what
  // stops two mirrors pointed at each other from looping forever. A beam still terminates on an
  // already-lit mirror, it just does not re-emit from it.
  trace({ mirrors = [], receivers = [], masses = [], blockers = [] }) {
    const segments = []
    const massHits = new Set()
    const receiverHits = new Set()
    mirrors.forEach((mirror) => { mirror.lit = false })

    let frontier = mirrors.filter((mirror) => mirror.group.visible && this.isSunlit(mirror.position.x))
    frontier.forEach((mirror) => { mirror.lit = true })

    for (let depth = 0; depth < MAX_CHAIN && frontier.length; depth += 1) {
      const next = []
      for (const mirror of frontier) {
        const { x: dx, y: dy } = mirror.direction()
        const ox = mirror.position.x
        const oy = mirror.position.y
        let best = { t: BEAM_LENGTH, kind: null, object: null }
        const consider = (t, kind, object) => { if (t < best.t) best = { t, kind, object } }

        for (const other of mirrors) {
          if (other === mirror || !other.group.visible) continue
          consider(hitCircle(ox, oy, dx, dy, other.position.x, other.position.y, MIRROR_RADIUS), 'mirror', other)
        }
        for (const receiver of receivers) {
          consider(hitCircle(ox, oy, dx, dy, receiver.position.x, receiver.position.y, RECEIVER_RADIUS), 'receiver', receiver)
        }
        for (const mass of masses) {
          if (mass.userData.gate.fallen) continue
          consider(hitBox(ox, oy, dx, dy, mass.userData.gate.collider), 'mass', mass)
        }
        for (const blocker of blockers) consider(hitBox(ox, oy, dx, dy, blocker), 'terrain', null)

        segments.push([ox, oy, ox + dx * best.t, oy + dy * best.t])
        if (best.kind === 'mirror' && !best.object.lit) {
          best.object.lit = true
          next.push(best.object)
        } else if (best.kind === 'receiver') receiverHits.add(best.object)
        else if (best.kind === 'mass') massHits.add(best.object)
      }
      frontier = next
    }
    return { segments, massHits, receiverHits }
  }

  render(segments) {
    const count = Math.min(segments.length, MAX_SEGMENTS)
    for (let index = 0; index < count; index += 1) {
      const [x1, y1, x2, y2] = segments[index]
      const offset = index * 6
      this.positions.set([x1, y1, PLAYER_Z_DEPTH, x2, y2, PLAYER_Z_DEPTH], offset)
    }
    this.lines.geometry.setDrawRange(0, count * 2)
    this.lines.geometry.attributes.position.needsUpdate = true
    this.lines.geometry.computeBoundingSphere()
  }
}
