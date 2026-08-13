# Helios & Selene — Project Memory

A companion puzzle-adventure to *What the Snow Remembers* (github.com/chien521/What-the-Snow-Remembers) — same engine and tone, standalone codebase, different mechanic and myth. Built with GitHub Copilot doing the primary implementation; Claude Code assists on debugging, architecture review, and structural work.

## Stack

Three.js + Vite, vanilla ES modules, browser-only, no backend required for core gameplay. New standalone repo — not a branch or folder inside What-the-Snow-Remembers.

`npm run dev` (Vite), `npm run build`, `npm run preview`. No tests, no linter, no CI.

## Status (verified by scripted playthroughs of both chapters)

- **Helios is complete and winnable end to end.** Five puzzle beats, five traversal legs, no console errors, no softlocks found.
- **Selene is complete.** `chapters/selene.js` now carries a full `layout`: a crater descending from the hub to still water, with a moon-phase dial box, three phase surfaces, a moonwell relay chain and a doorway in the water. `buildSeleneRoom()` is gone, and with it the `layout`-or-fallback branch in `ChapterLoader.load()`.
- Finishing Helios now shows a **chapter-complete beat** (`#chapter-complete`) before Selene loads, instead of swapping chapters mid-frame. Completion still persists in `localStorage['helios-complete']`.
- Verification is by script, not by hand — there is still no test runner. Two throwaway Node scripts were used and are worth rebuilding if the layouts change: one re-derives Selene's geometry (moonline, jump margins, whether the pool chain has a solution) from `selene.js`, the other runs the real `ChapterLoader` over both chapters behind a stubbed `document`. A Playwright script drives the whole of Selene through the DOM by reading `#scope-label` / `#moon-phase`.

## Premise

A nameless traveler carries an unfinished telescope through two worlds that can never share a sky: **Helios** (the sun's domain) and **Selene** (the moon's domain) — two figures who love each other but were never in the sky together. The traveler is building a way for them to finally be seen together, once, through a telescope completed from one lens found in each world.

No dialogue, no named traveler, no explanation during play — wordless, first-person-passage storytelling, same as Seasons. The myth is told in full only once, at the very end (already written into the `#ending` screen in `main.js`).

## Core Mechanic — as built

Base verbs: **move (WASD), jump (Space), raise/lower telescope (R), interact (E), cycle dial (Q), hint (H), pause (Esc)**.

Three design claims from the original spec were **deliberately reversed during implementation** — do not "restore" them without re-reading the rationale comments in `Telescope.js` and `TelescopeAim.js`:

| Original intent | What ships | Why |
|---|---|---|
| Raising the telescope locks movement | Movement stays free while raised | The player commits by *walking* to a mirror, not by freezing the camera (`main.js` comment above `nearestMirror`) |
| Burning-glass hold duration scales with the colour grade, doubling as a difficulty curve | Flat `FOCUS_SECONDS = 1.15` | "Duration is only difficulty when something can go wrong during it, and nothing could." Difficulty now lives in mirror-chain length |
| Telescope focus is the puzzle | Focus is *confirmation*; the puzzle is routing sunlight | The old hold-to-charge system was a loading bar, and was the chapter's only verb |

**Helios's actual puzzle language: route sunlight, then confirm with the scope.**
- `SunBeam.js` traces 2D rays breadth-first, max chain 4. A mirror standing inside a `lightZones` x-range (was `sunlitZones`; Selene uses the same field for moonlight) is lit and throws a beam **along the direction it faces** — deliberately not physical reflection, because "the mirror sends light where it points" is readable in one glance.
- `Mirror.rotate` ping-pongs within its `arc` at `TURN_SPEED = .9` rad/s while E is held and the player is within 2.6 units.
- Raising the scope and holding LMB on a target for 1.15 s produces a `focusedTarget`. Only then do the receivers the beam currently touches `latch()` (permanently, turning red and scaling 1.35×).
- Hit radii are **gameplay values, not visual ones**: `MIRROR_RADIUS = 1.1`, `RECEIVER_RADIUS = .7`. At ~12 units these give roughly a ±0.05 rad aiming window — tune against `TURN_SPEED`, not against mesh size.

**Selene's puzzle language: turn the moon, and the crater rearranges.** The exact inversion — Helios's scope *confirms* a routing the player already set up, Selene's scope *acts*.
- Holding focus on the moon for the same `FOCUS_SECONDS` advances its phase, `new → full → waning → new`. Phase is one global piece of state.
- A platform declares a `phase` and is solid only during it. No `phase` means stone: solid always, and **the only kind that can hold a checkpoint** (`platformAt` skips phase surfaces, or a respawn would drop the player into air).
- **The moonline is the whole difficulty curve.** The moon is focusable exactly while it is on screen, which `TelescopeAim.hovers` already enforces, so with the camera at `player.y + 5` and ~11.33 units of half-height it reduces to `surfaceY > moonY - 17.43`. With the moon at y=4 that line sits at −13.43: `brink` (−10) is the last place you can turn the dial by looking up. Everything below is entered on a phase chosen before the drop. **Move a platform across that line to change a beat's difficulty; do not add gates.**
- **The grace rule:** the platform the player is standing on stays solid through a phase change and goes intangible when they step off (`setPhase(phase, groundedPlatform)` / `releaseHeld`). Turning the dial can cost you a route, never a fall — that is what keeps Selene as failure-free as Helios.
- Out-of-phase surfaces are ghosts while the scope is raised and invisible while it is down, so raising the scope is how you *read* the room. Ghost opacity is `.36`; `.17` was invisible against the crater's sky in play.
- Below the moonline the **moonwell chain** buys the phase back: a fixed relay (`arc: null`) standing in `lightZones` feeds a rotatable pool, which the player sweeps with E onto a `hold: true` receiver. A hold receiver is lit only while a beam is actually on it, and is a focus target while lit. This is the only place Helios's mirror verb returns, inverted: Helios sends light *out* to a target, Selene brings the moon *in* to where you stand.

## The Object — Split Lens

Helios yields **two parts**, not one (HUD reads `PARTS n / 2`):
1. **Telescope frame** — reward for the 3-dial lockbox. Calls `telescope.unlockAim()`, which switches the whole optical layer on (`updateBeams({ visible })`). Without it, no mirrors, no beams, no scope.
2. **Helios lens** — reward for the 4-dial lens box. Calls `telescope.unlock('helios')`, which is what gates `meltBridge` and `exitBridge` into `focusTargets`. The back half of the chapter is mechanically unsolvable before it, as intended.

Selene yields the other two, and reuses the same two flags (`state.frameCollected` / `state.lensCollected`) so the HUD stays chapter-agnostic:
1. **Moon lens** — reward for the 3-dial phase box. Calls `telescope.unlock('selene')`, which is what makes the moon a focus target at all. The whole crater below the lockbox is unsolvable before it.
2. **Eyepiece** — on the tide ledge at the bottom. Collecting it completes the telescope and reveals the doorway in the water.

The generic `fragments` ring collectibles are gone; both chapters now use frame + lens.

## Chapter 01 — Helios, verified walkthrough

Authoring lives in `chapters/helios.js` so tuning is a one-line data change. Room shape: a **hub** at y=0, a **climb** ledge (+1.5) and **vista** (+3) to the left, a **pit** floor at y=-9 below, and a right-hand aerial route at y≈8.5.

1. **Hub → climb ledge.** Run-jump left across a 2.5-unit gap / 1.5 rise (the recurring margin; jump apex is 1.92, so it is comfortable, not tight).
2. **Lockbox (3 dials: sun / star / moon).** Hint via H: *"He rose alone… / a thousand small witnesses / She came after, wearing what light he left behind."* Q selects, E turns. Opening reveals the mirrors chapter-wide and drops the **frame**; collecting it pans the camera to the heliostat.
3. **Vista → heliostat.** One rotatable mirror at (-25, 4.6), arc [0.6, 2.4], sitting inside the only light zone (-30…-18). Note this leg has to be *jumped* (2.5 gap over a 1.5 rise) — walking off the climb ledge drops into the void and respawns.
4. **Two sky receivers.** Aim ≈1.819 rad for `sky-west`, ≈1.281 rad for `sky-east`; hold focus on the *mirror* (not the dot) for each. Both latched ⇒ the lens box reveals and the camera pans to the pit.
5. **Pit → lens box (4 dials: fire / wind / dust / ice).** Hint: *"could not be held / could not stay / could not remember / could not forget."* Opening reveals the **lens**.
6. **Springs.** Two, at the right edge of the pit floor and of the hub. There is **no step-up in the collision resolver**, so a spring cannot be walked onto — it must be jumped onto. There is also no horizontal momentum (`vx` is rewritten from the input axis every frame), so a mid-air burst is a pure position offset.
7. **Burn the floating wall.** Scope up on the hub, hold focus on the wall at (13.5, 11.1). It vanishes and leaves a walkable deck at y=8.55; the exit reveals and a **sky marker** appears at (16, 20).
8. **Marker → exit bridge.** The marker is only on screen from the melted deck (the camera sits at player.y + 5 with ~11.3 units of half-height), so this beat is correctly sequenced by altitude.
9. **Exit.** Walking the bridge with the scope **raised** pulls the doorway from x=42 in to x=26.8; `finishChapter()` fires when raised *and* within 2 units. The door now starts hidden and is revealed by the burn.

## Chapter 02 — Selene, verified walkthrough

Authored in `chapters/selene.js`. Shape: a **crater**, deliberately not rhyming Helios — it descends from the shared hub (y=0) to still water at y=−30, zigzagging inside x −12…18. The zigzag is not decoration: the moon has to stay within ~14 units of anywhere the player stands or the reticle cannot reach it (~15 units of camera half-width at 4:3).

Spawn is `(2, 1.1)`, set by `chapter.spawn` — Selene opens with the telescope already carried out of Helios (`telescope.carryFrame()`: `aimUnlocked` true, `power` null), so raising it ghosts the phase surfaces while focusing the moon does nothing.

1. **Lip → shelf.** Gap 2, drop 3 — a fall, where Helios's opening is a run-jump *up*.
2. **Phase box (3 dials: new / full / waning).** Hint: *"She showed nothing, and was still there. / She gave back all of it, and kept none. / She turned away by the width of one night."* Solution `['new','full','waning']` is **also the order the sky dial cycles in** — the box is the manual for the verb. Opening drops the **moon lens**; collecting it calls `telescope.unlock('selene')` and pans to the moon.
3. **First turn.** Moon plainly on screen. One focus: `new → full`, and the silver ledge becomes solid. Gap 1.5, drop 3.
4. **Silver → brink.** Gap 1.5, drop 4. `brink` (−10) is the last platform above the moonline.
5. **Commit.** Two turns (`full → waning → new`) *before* dropping left onto `shade` (−15), which is below the line. Guessing wrong is not a failure: the fall continues to `pool-shelf` (−23) and costs a detour, nothing else.
6. **The moonwell chain.** `moonwell` is a fixed relay at (1, −21.9) standing in `lightZones: [[0, 2]]`, always lit — at this depth the moon is not overhead any more, it is in the water, so the light enters from below rather than through a shaft. `pool` at (4, −20.5) is the one rotatable mirror, turnable from `pool-shelf` and deliberately **not** from a phase surface, so the chain can never be stranded behind the phase it is meant to fix. Sweep it to ≈ 0.01 rad (window 0.140 rad) to land the beam on `moon-dial` at (14, −20.4). Focus the lit dial to turn the phase from under the line. The dial sits above head height on purpose: at standing centre the player walks into it and occludes the one thing they need to read.
7. **Tide → eyepiece.** Two turns (`new → full → waning`) makes the tide ledge solid; the **eyepiece** sits on it and is visible from the moment the crater opens up, the way Helios's sky marker is. Collecting it reveals the doorway. The one spring, at x=−11 on the water, is the way back up if it is missed — that is the only column in the crater with no ceiling over it.
8. **Exit.** The moon's reflection, half-drowned in the water at x=8. Holding focus **rises** it toward you and looking away sinks it — the inversion of Helios's door, which comes to you for walking at it with the glass up. `finishChapter()` needs both the completed hold and `reached` (radius 2).

Three constants in the crater are gameplay values with derivations, not art direction. Changing any of them without redoing the arithmetic breaks the chapter:

- **The exit's rise is capped by the reticle.** The door is the thing the player holds the reticle on, and the door moves. `SPOTLIGHT_RADIUS` is 72px and one world unit is ~32px at this camera, so a rise past ~2.2 units walks out from under its own reticle, cancels the focus and sinks again — an unwinnable ending. It ships at 1.2.
- **The tide ledge is a thin slab (`h: .8`).** Platform boxes are 2 deep by default, which over the water at −30 leaves 1.5 of headroom — less than the player's 2.2 — so the ledge becomes a wall across the water floor and pens the player away from the doorway. Any platform authored *over* a walkable floor needs this check.
- **The pool's aiming window is 0.138 rad**, from `RECEIVER_RADIUS = .7` at ~11.5 units, i.e. ~0.15s of sweep at `TURN_SPEED = .9`. That is deliberately in the same range as Helios's heliostat beat. Tune it against `TURN_SPEED`, not against mesh size.

## Visuals

`palette.open / mid / close` is used **two ways at once**, which is easy to trip over:
- as a fixed **vertical sky gradient** painted to a canvas texture (open at top → close at bottom), so all three stages are on screen simultaneously; and
- as a **progress lerp** driving the directional light, hemisphere light and fog. Helios reads that progress across **x** (orange left climb → white summit); Selene sets `gradeAxis: 'y'` and reads it **down** (pale at the lip → deep navy at the water), because its journey is a descent.

The `Moon` uses `MeshBasicMaterial` for both its disc and its shadow, unlike everything else in the scene. It is a light source and must read identically at the pale lip and in the navy depths; lit materials get dragged around by `updateGrade`'s hemisphere and directional colours, which made the full moon come out a dull grey exactly where it should be the brightest thing on screen. At `full` the shadow disc is **hidden**, not slid aside — any offset big enough to clear the face left it sitting inside the halo as a second, black moon.

`darkShade()` derives shadow tones in sRGB channel space on purpose — a plain `multiplyScalar` on a `THREE.Color` reads ~3× brighter than intended after gamma correction. Platforms are near-black by design.

| Stage | Colour |
|---|---|
| Helios open / mid / close | `#ff8c1a` / `#f5d9a8` / `#f5f0e6` |
| Selene open / mid / close | `#dceffa` / `#9ce6f7` / `#36577d` |
| True ending | deep navy + one small saturated orange source (CSS `.end-image`) |

## Physics constants (`core/`)

`SPEED 8`, `JUMP_VELOCITY 10`, `SPRING_VELOCITY 23`, `GRAVITY 26`, player half-extents `.5 × 1.1`, everything on the `PLAYER_Z_DEPTH = -4` plane. `Physics2D.js` is ported verbatim from *What the Snow Remembers* — read its `EPS` comments before touching either resolver; the two tolerances point in opposite directions on purpose.

Respawn: falling below `layout.deathY` (−15 in Helios, −44 in the crater) returns the player to the last platform they stood on (`Checkpoint` stores `platform.safeX`). Bridges, decks and **phase surfaces** are not checkpoint platforms, so the aerial route sets no checkpoint — falling off it returns the player to the hub.

## UI / Menu Flow

Landing → start → chapter select (Selene disabled until `helios-complete`) → play → pause (Esc) → **chapter complete** → play → ending. Plus a built-in **How to play** screen and a **"Where's the exit?"** button, which is now offered in both chapters but only once that chapter's exit has actually been revealed. VIVERSE is stubbed: `ViverseSession` returns *"…unavailable in this local build."* for avatar, records and run submission.

The HUD carries a **`#moon-phase` chip** in Selene. The phase is global state the player changed several screens ago and has to reason about before every drop, and the moon itself is off screen exactly when the answer matters most, so it cannot live only on the object.

## Fixed in the Selene pass

- `#scope-label`'s onboarding string is now the **fallback**, not the initial value, so it actually appears (`onboardingLine()`; reads *FIND THE MOON LENS* in Selene).
- Helios's `layout.exit` shipped `visible: true`, which made the reveal-on-melt a no-op and left a doorway hanging in empty sky from the first frame — which is what **"Where's the exit?" used to point at**. It is `visible: false` now, and the locate button keys off `exit.group.visible`.
- Deleted: `layout.bridges` + `periscopeBridges` + `updatePeriscopeRoutes()` (which read `layout.exit.receiver`, a field no chapter declares), `layout.fragments` and the whole ring-collectible path, `buildSeleneRoom()`, and `LensGates.updateBridge`.
- The hub, pit floor, both springs, the lens box and the lens pickup were hard-coded in `ChapterLoader` and read off `this.lowerPlatform`; only the hub still is. The rest are layout keys (`pit`, `springs`, `lockbox`, `lensBox`, `lens`), so Selene no longer inherits Helios's furniture. `sunlitZones` is now `lightZones`.

## Known gaps still open

- The pit **safety-net spring fires on the intended descent too.** Its guard is `!state.lensCollected && !triangulation.lens.visible`, but the lens only becomes visible *after* the lens box is solved, and the box is at the bottom of the pit — so the spring is always already there when the player arrives, undercutting the "spring as reward for the lens" beat the comment describes. (The net itself works.) Selene sidesteps this entirely: its one spring is `revealed: true` from the start and framed as a marked way back, not a reward.
- **No wordless heat feedback on the burn.** `applyHeat`, `createFallingMass`, `updateGate` and `animateGate` in `LensGates.js` are exported but imported nowhere — the whole heat-ramp/toppling-rock system is dead code. The wall simply disappears after 1.15 s; only the reticle's charge bar moves.
- **HUD legibility**: dark HUD text sits over the pale bottom of the sky gradient. `#scope-label` and `#moon-phase` carry their own dark grounds; `#chapter-name` and `PARTS n / 2` still do not.
- Both sky receivers are **visible from spawn** and overlap the `01 / HELIOS` HUD label at the default camera position.
- `Triangulation` does no triangulation — it is a lens pickup, used for Helios's fire lens and Selene's eyepiece. Worth renaming.
- Selene's pool chain is **one degree of freedom**: the moonwell is a fixed relay pointed at the pool, so the only thing the player sets is the pool's angle. That is the same difficulty as Helios's heliostat tutorial, used at Selene's peak beat. A second rotatable pool in series is the obvious place to add difficulty if the chapter plays too easy.
- **`shade` is optional.** Setting the phase to `new` at the brink is the graceful way down; missing it just costs a longer fall to the same chamber. That is deliberately gentle, but it means beat 5 currently teaches the commitment idea without ever charging for it.

## Actual repo layout

```
src/
  main.js                  // game loop, all UI markup, chapter transitions, ending
  chapters/
    helios.js              // full layout: platforms, pit, springs, mirrors, receivers, boxes, gates, exit
    selene.js              // full layout: the crater, phases, moon, moonwell chain, tide ledge, exit
  world/
    ChapterLoader.js       // builds both rooms from layout alone; sky/grade, colliders, phase layer
    SunBeam.js             // SunField: 2D ray trace, light zones, mirror chains (unchanged by Selene)
    Mirror.js              // Mirror (rotatable / fixed relay) + Receiver (latching, or `hold`)
    Moon.js                // Selene's dial: phase state + procedural phase art; a focus target
    Lockbox.js             // all three dial puzzles, glyph geometry, hint lines
    Triangulation.js       // the lens pickup (Helios's fire lens, Selene's eyepiece)
    LensGates.js           // createBridge / createMeltBridge / meltWall (+ dead heat-gate code)
    PeriscopeExit.js       // the exit doorway: pull-closer in x (Helios), rise in y (Selene)
    Telescope.js           // state only: raised / aimUnlocked / power
    TelescopeAim.js        // overlay, reticle, focus hold
  core/                    // Player, Physics2D, Camera (FollowCamera + reveal pans), Checkpoint
  viverse/ViverseSession.js  // stubbed
```

Note this differs from the originally suggested layout: there is no `player/` directory, no `world/Telescope.js` aim logic (it is split across `Telescope`/`TelescopeAim`), and no `public/` assets — the ending image is CSS, not a bitmap.

## Open / Not Yet Decided

- **Selene's mechanic changed during design.** The earlier plan was *stabilize/reveal while held in view* — a surface solid only while the reticle stays on it — and the `#lens-guide` text still described that. It was replaced by the phase dial because the hold version made looking away a **failure**, which Helios never does, and because a global phase gives the chapter a state the player has to reason about across a whole descent rather than one span at a time. `LensGates.updateBridge` was the last survivor of the old idea and is gone.
- Selene's difficulty is currently carried almost entirely by the moonline. Whether that is enough, or whether the crater wants a second rotatable pool and a fourth phase, needs play.
- Ambient audio/music direction — sound-as-*mechanic* was explicitly deferred; ambient mood audio still undecided. No audio module exists.
- Whether Helios should keep its two-part structure (frame + lens) or hand the frame over before the chapter starts. Selene now assumes the frame carries over (`telescope.carryFrame()`), so this only affects Helios's own opening.
- Full VIVERSE integration (session, avatar, leaderboard) — planned must-have, still stubbed.
