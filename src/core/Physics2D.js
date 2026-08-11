// Ported from puzzle_game (What the Snow Remembers) src/core/Physics2D.js — proven AABB
// collision, not re-derived. See that file's history for why the epsilon handling below
// exists before changing any of it.

// Boundary checks below compare a body's edge against a collider's edge for exact equality
// (e.g. "is the player's foot exactly at the platform's top?"). Resting positions are computed
// from the same arithmetic (top + hh), so in principle they land exactly on that boundary — but
// floating-point sums like .5 + .5 + .9 don't reliably reproduce the same bit pattern as the
// left side of the comparison, landing a hair on the wrong side of a strict >= / <=. That silent
// off-by-one-ULP miss reads as "falls through the platform it's standing on" or "gets shoved out
// the side while landing on top." EPS gives the comparison room to still call it a match.
const EPS = 1e-6

// The opposite tolerance direction from EPS above: resolveX's fallback below asks "are we
// already fully inside this box" as a catch-all for fast/skipped-frame cases. A player resting
// exactly on TOP of a box also touches its side-check boundary at zero penetration (same float
// imprecision, opposite sign this time) — without shrinking the box here, "just touching the top"
// reads as "penetrating the side," and the player gets shoved off sideways on every single frame
// they stand still, unable to ever walk off — the game's worst-case version of this bug.
const penetrates = (a, b) => Math.abs(a.x - b.x) < a.hw + b.w / 2 - EPS && Math.abs(a.y - b.y) < a.hh + b.h / 2 - EPS

export function moveAndCollide(body, dt, colliders) {
  body.grounded = false
  const distance = Math.max(Math.abs(body.vx * dt), Math.abs(body.vy * dt))
  const steps = Math.max(1, Math.ceil(distance / .18))
  const stepDt = dt / steps
  for (let step = 0; step < steps; step += 1) {
    // Resolve Y before X: a diagonal landing (falling while moving horizontally) must settle
    // onto the platform's top first. Doing X first checks vertical overlap against last frame's
    // stale Y, which reads a from-above landing as a from-the-side wall hit and shoves the
    // player out sideways or snaps them to the ledge's corner instead of standing on it.
    const startY = body.y
    body.y += body.vy * stepDt
    for (const box of colliders) resolveY(body, box, startY)
    const startX = body.x
    body.x += body.vx * stepDt
    for (const box of colliders) resolveX(body, box, startX)
  }
}

function resolveX(body, box, startX) {
  // An exact top or underside contact is a vertical collision, not a side wall. Shrink this
  // test by EPS so swimmers can move beneath a low ceiling after their upward motion is resolved.
  const verticalOverlap = Math.abs(body.y - box.y) < body.hh + box.h / 2 - EPS
  if (!verticalOverlap) return
  const left = box.x - box.w / 2
  const right = box.x + box.w / 2
  const crossedFromLeft = body.vx > 0 && startX + body.hw <= left + EPS && body.x + body.hw >= left - EPS
  const crossedFromRight = body.vx < 0 && startX - body.hw >= right - EPS && body.x - body.hw <= right + EPS
  if (crossedFromLeft || (body.vx > 0 && penetrates(body, box))) body.x = left - body.hw
  else if (crossedFromRight || (body.vx < 0 && penetrates(body, box))) body.x = right + body.hw
  else return
  body.vx = 0
}

function resolveY(body, box, startY) {
  const horizontalOverlap = Math.abs(body.x - box.x) < body.hw + box.w / 2 + EPS
  if (!horizontalOverlap) return
  const top = box.y + box.h / 2
  const bottom = box.y - box.h / 2
  const crossedBottom = body.vy > 0 && startY + body.hh <= bottom + EPS && body.y + body.hh >= bottom - EPS
  const crossedTop = body.vy < 0 && startY - body.hh >= top - EPS && body.y - body.hh <= top + EPS
  if (crossedBottom) body.y = bottom - body.hh
  else if (crossedTop) { body.y = top + body.hh; body.grounded = true }
  else return
  body.vy = 0
}
