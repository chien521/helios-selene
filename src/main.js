import * as THREE from 'three'
import './style.css'
import { helios } from './chapters/helios.js'
import { selene } from './chapters/selene.js'
import { ChapterLoader } from './world/ChapterLoader.js'
import { Telescope } from './world/Telescope.js'
import { TelescopeAim } from './world/TelescopeAim.js'
import { meltWall } from './world/LensGates.js'
import { viverseSession } from './viverse/ViverseSession.js'
import { Player } from './core/Player.js'
import { FollowCamera } from './core/Camera.js'
import { Checkpoint } from './core/Checkpoint.js'

const chapters = [helios, selene]
const saved = (key) => { try { return localStorage.getItem(key) === 'true' } catch { return false } }
const save = (key) => { try { localStorage.setItem(key, 'true') } catch {} }
const removeSaved = (key) => { try { localStorage.removeItem(key) } catch {} }
const SPAWN_X = -3
const SPAWN_Y = 1.1
// Each chapter assembles its own optic: Helios's magnifier uses a frame and fire lens, while
// Selene's telescope uses a moon lens and eyepiece. Shared flags keep the parts HUD generic.
const state = { chapter: null, frameCollected: false, lensBoxRevealed: false, lensCollected: false, unlocked: saved('helios-complete'), playing: false, ending: false, revealing: false, moonViewing: false }
const app = document.querySelector('#app')
app.innerHTML = `
  <canvas id="world" aria-label="A quiet three dimensional puzzle landscape"></canvas>
  <div id="chapter-fade" aria-hidden="true"></div>
  <div id="aim-overlay" aria-hidden="true"><div id="aim-reticle"><span></span></div></div>
  <section id="landing" class="screen visible"><h1>helios <i>&</i> selene</h1><p class="pitch">Two skies. Two unfinished instruments.<br>Look long enough to make a way through.</p><button class="command" data-show="start">Enter the observatory</button></section>
  <section id="start" class="screen"><h2>Choose where to begin.</h2><button class="command" data-show="chapters">Play</button><button class="command quiet" data-show="guide">How to play</button><button class="command quiet" data-viverse="avatar">Use my VIVERSE avatar</button><button class="command quiet" data-viverse="records">See records</button><p id="notice" aria-live="polite"></p></section>
  <section id="chapters" class="screen"><p class="eyebrow">CHAPTER SELECT</p><div class="chapter-list"><button class="chapter-card helios" data-chapter="helios"><span>01</span><strong>Helios</strong><small>The day that would not soften.</small></button><button class="chapter-card selene" data-chapter="selene" disabled><span>02</span><strong>Selene</strong><small data-lock>Locked until Helios is complete.</small></button></div><button class="command quiet" data-restart>Restart game</button><button class="back" data-show="start" aria-label="Return">Back</button></section>
  <section id="guide" class="screen"><div class="guide-board"><p class="eyebrow">FIELD NOTES</p><h2>Look. Commit. Move.</h2><dl><div><dt>Move</dt><dd>W A S D</dd></div><div><dt>Jump</dt><dd>W or Up Arrow</dd></div><div><dt>Interact</dt><dd>E</dd></div><div><dt>Lockbox dial</dt><dd>Q to select, E to turn</dd></div><div><dt>Magnifier / telescope</dt><dd>R to raise or lower</dd></div><div><dt>Focus</dt><dd>Hold left mouse while raised</dd></div><div><dt>Moon view</dt><dd>Space</dd></div><div><dt>Pause</dt><dd>Escape</dd></div></dl><p class="instrument-note">Helios: move freely with the magnifier raised. Turn the heliostat with E, then keep its glass on the mirror to send a reflection skyward.</p><p class="instrument-note">Selene: hold the telescope on the moon to turn its phase, which decides which crater ledges are solid. Raise the telescope to see the hidden ones.</p><button class="back" data-show="start">Back</button></div></section>
  <section id="hud"><p id="chapter-name"></p><div id="fragments" aria-label="Instrument parts: 0 of 2"><span id="fragment-count">PARTS 0 / 2</span><div class="fragment-slots" aria-hidden="true"><i></i><i></i></div></div><p id="moon-phase" hidden></p><p id="scope-label">FIND AN INSTRUMENT PART</p></section>
  <aside id="selene-intro" aria-live="polite">The Helios magnifier cannot reach here. Find the moon lens and eyepiece for Selene's telescope.</aside>
  <button id="locate-moon" data-locate-moon>Where's the moon?</button>
  <button id="locate-exit" data-locate-exit>Where's the exit?</button>
  <aside id="lockbox-hint" aria-live="polite" aria-hidden="true"><div id="lockbox-hint-text"></div><p class="hint-close">H / CLOSE</p></aside>
  <section id="pause" class="screen"><p class="eyebrow">PAUSED</p><button class="command" data-resume>Return</button><button class="command quiet" data-show="chapters">Chapter select</button><button class="command quiet" data-restart>Restart game</button></section>
  <section id="chapter-complete" class="screen"><p class="eyebrow">CHAPTER 01 COMPLETE</p><h2>One lens, changed by the sun.</h2><p>The other is somewhere under the night.</p><button class="command" data-continue>Go on to Selene</button><button class="command quiet" data-show="chapters">Chapter select</button></section>
  <section id="ending" class="screen"><div class="end-image"><span></span></div><div class="myth"><p class="eyebrow">THE ONE NIGHT</p><h2>Helios crossed the day<br>and Selene kept the night.</h2><p>Between them there was never a single hour where both could be seen at once. That was the whole of it, the plain unbendable fact the two of them had lived inside since before either could remember choosing it: one sky, and never at the same time for both of them.</p><p>He rose alone, every morning, into a light too full to share with anything but itself — a thousand small witnesses, and none of them her. She came after, always after, wearing what light he'd left behind, changed by the going of him the way a coal keeps a fire's shape long after the fire is out. They had loved each other across that gap for longer than the gap had a name.</p><p>Nothing either of them tried had closed it. A door left open at dusk closes again at dawn regardless of who wanted it open. A tide that reaches all the way to the shore still has to go back out. So it went, day folding into night folding into day, the two of them close enough to leave a mark on each other's light and never once close enough to stand in the same one.</p><p>Then a traveler came through with an unfinished telescope and a plan neither of them had asked for and both of them, in their own way, had been waiting on: one lens ground in his fire, held over flame until the glass forgot it had ever been sand; one lens turned and turned again under her light until she finally, grudgingly, stayed still enough to be caught in it. Two worlds' worth of patience, carried in two pockets, toward a frame that took both lenses without complaint — the way a door doesn't care which key opens it, so long as one does.</p><p>Raised and held steady, the glass showed what neither sky alone ever could: not his light, not hers, but both together, entire, inside the same small circle — for exactly as long as someone kept the glass from moving. Look away, and it would go back to being two skies again. But held, even once, even briefly, it was enough to undo the one thing the whole of both their lives had insisted was impossible.</p><p>They loved across a sky that never held them both.</p><p>For one looking, they were together.</p><p class="complete">Game is completed. Replay the game.</p><button class="command" data-replay>Replay the game</button><button class="command quiet" data-viverse="submit">Submit my run</button></div></section>
  <dialog id="restart-dialog" aria-labelledby="restart-title"><p id="restart-title">Restart the game?</p><p>Your chapter progress and unlocked chapter will be reset.</p><form method="dialog"><button class="command quiet" value="cancel">Cancel</button><button class="command" value="confirm" data-confirm-restart>Restart</button></form></dialog>`

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#world'), antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
const scene = new THREE.Scene()
const followCamera = new FollowCamera()
const camera = followCamera.camera
const player = new Player(scene, SPAWN_X, SPAWN_Y)
followCamera.snapTo(player)
const loader = new ChapterLoader(scene)
const telescope = new Telescope()
const aim = new TelescopeAim(document.querySelector('#aim-overlay'), document.querySelector('#aim-reticle'), document.querySelector('#aim-reticle span'))
const checkpoint = new Checkpoint(SPAWN_X, SPAWN_Y)
const clock = new THREE.Clock()
const screens = [...document.querySelectorAll('.screen')]
const chapterFade = document.querySelector('#chapter-fade')
const hud = document.querySelector('#hud')
const fragmentSlots = [...document.querySelectorAll('.fragment-slots i')]
const restartDialog = document.querySelector('#restart-dialog')
const lockboxHint = document.querySelector('#lockbox-hint')
const lockboxHintText = document.querySelector('#lockbox-hint-text')
const locateExit = document.querySelector('#locate-exit')
const locateMoon = document.querySelector('#locate-moon')
const moonPhaseLabel = document.querySelector('#moon-phase')
const seleneIntro = document.querySelector('#selene-intro')
const hideLockboxHint = () => { lockboxHint.classList.remove('visible'); lockboxHint.setAttribute('aria-hidden', 'true') }
const showSeleneIntro = () => {
  seleneIntro.classList.remove('visible')
  if (state.chapter?.id !== 'selene') return
  void seleneIntro.offsetWidth
  seleneIntro.classList.add('visible')
}
const showLockboxHint = (box) => {
  lockboxHintText.replaceChildren(...box.hintLines.map((line) => {
    const paragraph = document.createElement('p')
    const italic = document.createElement('i')
    italic.textContent = line
    paragraph.append(italic)
    return paragraph
  }))
  lockboxHint.classList.add('visible')
  lockboxHint.setAttribute('aria-hidden', 'false')
}
// The exit hint used to be live from second one in Helios, where it panned to a door floating in
// empty sky with nothing near it. It is now only offered once the chapter's own exit has actually
// been revealed, which in both chapters means the route to it exists.
const exitLocatable = () => state.playing && !!loader.objects.exit?.group.visible
const refreshLocateExit = () => {
  const paused = document.querySelector('#pause').classList.contains('visible')
  locateExit.classList.toggle('visible', exitLocatable() && !paused)
}
const refreshLocateMoon = () => {
  const paused = document.querySelector('#pause').classList.contains('visible')
  const moonAvailable = state.playing && state.chapter?.id === 'selene' && !!loader.objects.moon?.group.visible
  locateMoon.classList.toggle('visible', moonAvailable && !paused)
  locateMoon.textContent = state.moonViewing ? 'Get back to player view' : "Where's the moon?"
}
const show = (id) => {
  screens.forEach((screen) => screen.classList.toggle('visible', screen.id === id))
  document.querySelector('#landing').classList.toggle('dimmed', id !== 'landing')
  hud.classList.toggle('visible', state.playing && id !== 'pause')
  refreshLocateExit()
  refreshLocateMoon()
}
const updateChapterCards = () => {
  const seleneCard = document.querySelector('[data-chapter="selene"]')
  seleneCard.disabled = !state.unlocked
  seleneCard.querySelector('[data-lock]').textContent = state.unlocked ? 'The night that kept its shape.' : 'Locked until Helios is complete.'
}
const resetPlayer = () => {
  player.reset(checkpoint.point.x, checkpoint.point.y)
  followCamera.snapTo(player)
}
const restartGame = () => {
  removeSaved('helios-complete')
  state.chapter = null
  state.unlocked = false
  state.playing = false
  state.ending = false
  state.revealing = false
  state.moonViewing = false
  checkpoint.setSpawn(SPAWN_X, SPAWN_Y)
  telescope.resetPower()
  aim.lower()
  followCamera.cancelReveal()
  followCamera.clearFocus()
  loader.clear()
  resetPlayer()
  hideLockboxHint()
  hud.removeAttribute('data-chapter')
  updateChapterCards()
  show('landing')
}
const updateFragmentHud = () => {
  const collected = Number(state.frameCollected) + Number(state.lensCollected)
  document.querySelector('#fragment-count').textContent = `PARTS ${collected} / 2`
  document.querySelector('#fragments').setAttribute('aria-label', `Instrument parts: ${collected} of 2`)
  fragmentSlots.forEach((slot, index) => slot.classList.toggle('filled', index < collected))
}
// Selene's phase is global state the player changed several screens ago and has to reason about
// before every drop, so it belongs on the HUD rather than only on the moon itself -- which is off
// screen exactly when the answer matters most.
const updatePhaseHud = () => {
  const phase = loader.moon?.phase
  moonPhaseLabel.hidden = !phase
  moonPhaseLabel.textContent = phase ? `MOON ${phase.toUpperCase()}` : ''
}
const startChapter = (chapter) => {
  const [spawnX, spawnY] = chapter.spawn ?? [SPAWN_X, SPAWN_Y]
  state.chapter = chapter
  state.frameCollected = false
  state.lensBoxRevealed = false
  state.lensCollected = false
  state.playing = true
  state.ending = false
  state.revealing = false
  state.moonViewing = false
  checkpoint.setSpawn(spawnX, spawnY)
  // Selene opens with its telescope frame but no moon lens.
  if (chapter.id === 'selene') telescope.carryFrame()
  else telescope.resetPower()
  aim.lower()
  followCamera.cancelReveal()
  followCamera.clearFocus()
  loader.load(chapter)
  resetPlayer()
  hideLockboxHint()
  document.querySelector('#chapter-name').textContent = `${chapter.number} / ${chapter.title.toUpperCase()}`
  hud.dataset.chapter = chapter.id
  document.querySelector('#fragments').hidden = false
  updateFragmentHud()
  updatePhaseHud()
  showSeleneIntro()
  show('')
}
const transitionToSelene = () => {
  state.playing = false
  chapterFade.classList.add('visible')
  setTimeout(() => {
    startChapter(selene)
    requestAnimationFrame(() => chapterFade.classList.remove('visible'))
  }, 650)
}
const finishChapter = () => {
  state.playing = false
  if (state.chapter.id === 'helios') {
    state.unlocked = true
    save('helios-complete')
    updateChapterCards()
    transitionToSelene()
    return
  }
  state.ending = true
  show('ending')
}
const toggleMoonView = () => {
  if (!state.playing || state.chapter?.id !== 'selene' || !loader.objects.moon?.group.visible) return false
  state.moonViewing = !state.moonViewing
  if (state.moonViewing) followCamera.focusObject(loader.objects.moon.position)
  else followCamera.clearFocus()
  refreshLocateMoon()
  return true
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('button')
  if (!target) return
  if (target.dataset.locateMoon !== undefined && toggleMoonView()) {
    return
  }
  if (target.dataset.locateExit !== undefined && !state.revealing && exitLocatable()) {
    beginReveal(loader.objects.exit.position)
    return
  }
  if (target.dataset.restart !== undefined) { restartDialog.showModal(); return }
  if (target.dataset.confirmRestart !== undefined) { restartDialog.close(); restartGame(); return }
  if (target.dataset.continue !== undefined) { startChapter(selene); return }
  if (target.dataset.show !== undefined) { state.playing = false; show(target.dataset.show); return }
  if (target.dataset.chapter) startChapter(chapters.find((chapter) => chapter.id === target.dataset.chapter))
  if (target.dataset.viverse) document.querySelector('#notice').textContent = viverseSession[target.dataset.viverse === 'avatar' ? 'useAvatar' : target.dataset.viverse === 'records' ? 'records' : 'submitRun']().message
  if (target.dataset.resume !== undefined) show('')
  if (target.dataset.replay !== undefined) { state.ending = false; updateChapterCards(); show('chapters') }
})
const held = new Set()
const beginReveal = (position) => {
  state.revealing = true
  state.moonViewing = false
  telescope.setRaised(false)
  aim.lower()
  held.clear()
  followCamera.clearFocus()
  followCamera.revealObject(position)
}
addEventListener('keydown', (event) => {
  held.add(event.code)
  if (state.playing && (event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'ArrowUp' || event.code === 'ArrowDown')) event.preventDefault()
  if (event.code === 'Space' && !event.repeat && toggleMoonView()) {
    event.preventDefault()
    return
  }
  if (event.code === 'KeyR' && !event.repeat && state.playing && !state.revealing && telescope.aimUnlocked) {
    telescope.setRaised(!telescope.raised)
    if (telescope.raised) aim.raise(camera, player.position)
    else aim.lower()
  }
  if (event.code === 'KeyE' && !event.repeat && state.playing && !state.revealing) {
    const box = loader.nearestLockbox(player.position)
    const result = box?.interact(player.position)
    if (result?.opened && box === loader.objects.lockbox) {
      loader.objects.mirrors.forEach((mirror) => mirror.reveal())
      if (state.chapter.id === 'selene') {
        loader.objects.moon?.reveal()
        refreshLocateMoon()
      }
    }
    if (result?.opened && box === loader.objects.lensBox) loader.objects.triangulation.revealLens()
  }
  if (event.code === 'KeyQ' && !event.repeat && state.playing && !state.revealing) loader.nearestLockbox(player.position)?.selectNext(player.position)
  // The poem belongs to the lockbox, not to the chapter: openable anywhere it stopped reading as
  // something the player found. Always allow closing it, so it can never be stranded on screen.
  if (event.code === 'KeyH' && !event.repeat && state.playing && !state.revealing) {
    const box = loader.nearestLockbox(player.position)
    if (lockboxHint.classList.contains('visible')) hideLockboxHint()
    else if (box) showLockboxHint(box)
  }
  if ((event.code === 'KeyW' || event.code === 'ArrowUp') && state.playing && !state.revealing) {
    event.preventDefault()
    player.jump()
  }
  if (event.code === 'Escape' && state.playing) show(document.querySelector('#pause').classList.contains('visible') ? '' : 'pause')
})
addEventListener('keyup', (event) => held.delete(event.code))
addEventListener('pointermove', (event) => aim.move(event.clientX / innerWidth, event.clientY / innerHeight))
addEventListener('pointerdown', (event) => {
  if (!state.playing || state.revealing || !telescope.raised || event.button !== 0) return
  event.preventDefault()
  aim.beginFocus()
})
addEventListener('pointerup', () => aim.cancelFocus())

const groundedPlatform = () => (player.body.grounded
  ? loader.standingOn(player.position.x, player.body.y - player.body.hh)
  : null)

// --- Helios: route sunlight, then confirm with the scope ---------------------------------------

function heliosTargets(objects) {
  // The optical layer needs the telescope frame to be seen at all, and the Helios lens to burn --
  // so the back half of the chapter stays mechanically unsolvable until the lens is collected.
  const targets = [...objects.mirrors]
  if (state.lensCollected && objects.meltBridge && !objects.meltBridge.melted) targets.push(objects.meltBridge)
  if (state.lensCollected && objects.meltBridge?.melted && !objects.exitBridge?.revealed) targets.push(objects.exitBridge)
  return targets
}

function heliosResolve(objects, focusedTarget) {
  if (objects.meltBridge && focusedTarget === objects.meltBridge && meltWall(objects.meltBridge)) {
    objects.exit?.reveal()
    loader.revealExitBridgeMarker()
    refreshLocateExit()
  }
  if (focusedTarget === objects.exitBridge) loader.revealExitBridge()
  if (!state.lensBoxRevealed && loader.receiversLatched(loader.lensReceiverIds) && objects.lensBox?.reveal()) {
    state.lensBoxRevealed = true
    beginReveal(objects.lensBox.group.position)
  }
  if (objects.exit && objects.meltBridge?.melted) objects.exit.setPulledCloser(telescope.raised)
  if (telescope.raised && objects.exit?.reached(player.position)) { finishChapter(); return true }
  return false
}

// --- Selene: turn the moon, and the crater rearranges -------------------------------------------

function seleneTargets(objects) {
  const targets = []
  if (telescope.power === 'selene') {
    // The moon is only ever a target when it is on screen, which TelescopeAim.hovers() decides --
    // that is the moonline, and it is the whole reason the crater has a bottom half.
    if (objects.moon) targets.push(objects.moon)
    // A hold receiver is focusable exactly while the pool chain is actually delivering light to it.
    objects.receivers.forEach((receiver) => { if (receiver.hold && receiver.held) targets.push(receiver) })
    if (objects.ladderWall?.active) targets.push(objects.ladderWall)
  }
  return targets
}

function advancePhase(objects) {
  const standing = groundedPlatform()
  objects.moon.advance()
  loader.setPhase(objects.moon.phase, standing)
  updatePhaseHud()
}

function seleneResolve(objects, focusedTarget) {
  const isDial = focusedTarget?.hold && objects.receivers.includes(focusedTarget)
  if (objects.moon && (focusedTarget === objects.moon || isDial)) advancePhase(objects)
  if (focusedTarget === objects.ladderWall) {
    objects.ladderWall.active = false
    objects.ladderWall.activate()
  }
  objects.exit?.setPulledCloser(telescope.raised)
  if (telescope.raised && objects.exit?.reached(player.position)) { finishChapter(); return true }
  return false
}

// --- Prompts ------------------------------------------------------------------------------------

function onboardingLine() {
  if (state.chapter.id === 'selene') return telescope.power ? '' : 'FIND THE TELESCOPE MOON LENS'
  return telescope.aimUnlocked ? '' : 'FIND A MAGNIFIER PART'
}

function focusLine(objects) {
  if (!telescope.raised) return ''
  if (state.chapter.id !== 'selene') {
    return loader.nearestMirror(player.position) ? 'HOLD LEFT MOUSE / FOCUS ON MIRROR' : 'HOLD LEFT MOUSE / FOCUS'
  }
  if (objects.exit?.group.visible) return 'RAISE TELESCOPE / DRAW THE DOOR TO THE LEFT LEDGE'
  if (objects.moon && telescope.power === 'selene' && aim.hovers(objects.moon.position, camera)) return 'HOLD LEFT MOUSE / TURN THE MOON'
  if (objects.ladderWall?.active && aim.hovers(objects.ladderWall.position, camera)) return 'HOLD LEFT MOUSE / UNFOLD THE LADDER'
  if (telescope.power === 'selene' && objects.receivers.some((receiver) => receiver.held && aim.hovers(receiver.position, camera))) return 'HOLD LEFT MOUSE / TURN THE DIAL'
  return 'HOLD LEFT MOUSE / FOCUS'
}

// --- Frame --------------------------------------------------------------------------------------

function update(delta) {
  if (!state.playing || document.querySelector('#pause').classList.contains('visible')) return
  const objects = loader.objects
  if (state.revealing) {
    loader.updateGlow(clock.elapsedTime, player.position)
    if (followCamera.update(delta, player)) state.revealing = false
    return
  }
  const isSelene = state.chapter.id === 'selene'
  // Turning a mirror is Helios's core verb and Selene's one borrowed one. The player commits by
  // *walking* to a mirror rather than by locking the camera, which is why movement stays free while
  // the scope is up.
  const mirror = loader.nearestMirror(player.position)
  mirror?.rotate(delta, held.has('KeyE'), player.position)
  const spotlightOnMirror = telescope.raised
    && objects.mirrors.some((entry) => entry.group.visible && aim.hovers(entry.position, camera))

  const focusedTarget = aim.updateFocus(delta, camera, isSelene ? seleneTargets(objects) : heliosTargets(objects))
  const focusedMirror = objects.mirrors.includes(focusedTarget) ? focusedTarget : null
  // Both resolvers report whether they ended the chapter, so the rest of the frame does not keep
  // simulating a room the player has already walked out of.
  if (isSelene ? seleneResolve(objects, focusedTarget) : heliosResolve(objects, focusedTarget)) return

  loader.updateBeams({
    visible: telescope.aimUnlocked,
    // Selene has no confirm step for its mirrors, so the sight-lines are always drawn once the
    // optical layer is on -- they are the only feedback the pool chain gives.
    showDirections: isSelene ? telescope.power === 'selene' : spotlightOnMirror,
    focusedMirror,
  })

  const lockboxPrompt = loader.nearestLockbox(player.position)?.prompt(player.position)
  const mirrorPrompt = mirror?.prompt(player.position)
  const instrument = isSelene ? 'TELESCOPE' : 'MAGNIFIER'
  const telescopePrompt = telescope.raised
    ? `R / LOWER ${instrument}`
    : telescope.aimUnlocked ? `R / RAISE ${instrument}` : ''
  // The authored onboarding string used to be blanked on the very first frame, so the player's only
  // starting instruction never appeared. It is the fallback now, not the initial value.
  document.querySelector('#scope-label').textContent = lockboxPrompt
    || [telescopePrompt, focusLine(objects), mirrorPrompt].filter(Boolean).join('\n')
    || onboardingLine()

  loader.updatePhaseVisuals(telescope.raised, clock.elapsedTime)
  loader.updateGlow(clock.elapsedTime, player.position)
  objects.exit?.update(clock.elapsedTime, delta)
  loader.updateGrade(loader.gradeInput(player.position), delta)

  const right = held.has('KeyD') || held.has('ArrowRight')
  const left = held.has('KeyA') || held.has('ArrowLeft')
  const axis = (right ? 1 : 0) - (left ? 1 : 0)
  player.update(delta, axis, loader.getColliders())

  const standing = groundedPlatform()
  // A held phase surface stays solid only while it is still underfoot.
  loader.releaseHeld(standing)

  if (isSelene && standing?.id === 'full-landing' && !state.lensBoxRevealed && objects.lensBox?.reveal()) {
    state.lensBoxRevealed = true
  }

  const activeSpring = player.body.grounded ? loader.springUnder(player.body) : null
  if (activeSpring) {
    if (!isSelene && activeSpring.id === 'spring') loader.revealSpring('upperSpring')
    player.launchFromSpring()
  }
  if (player.body.grounded) {
    const platform = loader.platformAt(player.position.x, player.body.y - player.body.hh)
    if (platform) checkpoint.update(platform, loader.standingHeight(platform))
    // Safety net for Helios's pit. The lower platform is wider than the hub, so walking off either
    // hub edge drops the player in -- and before the lens exists there is no spring and no
    // telescope, so there is no way back up, while the deathY respawn never fires because the pit
    // floor is above it.
    if (!isSelene && platform === loader.lowerPlatform && !state.lensCollected && !objects.triangulation?.lens.visible) loader.revealSpring('spring')
  }
  if (player.position.y < loader.deathY) resetPlayer()
  followCamera.update(delta, player)

  if (objects.lockbox?.collectFrame(player.position) && !state.frameCollected) {
    state.frameCollected = true
    if (isSelene) {
      // The moon lens is Selene's power, not just its optics -- it is what makes the phase turn.
      telescope.unlock('selene')
    } else {
      telescope.unlockAim()
      // Pan to the heliostat: the frame is what makes light visible, so this is the moment the
      // chapter's whole optical layer switches on.
      beginReveal(objects.mirrors.find((entry) => entry.id === 'heliostat').position)
    }
    updateFragmentHud()
  }
  if (objects.triangulation?.collectLens(player.position) && !state.lensCollected) {
    state.lensCollected = true
    if (isSelene) {
      objects.exitTrigger.marker.visible = true
      objects.exitTrigger.active = true
    } else {
      telescope.unlock('helios')
      // The spring is simply the reward for reaching the lens. It used to be another point-and-hold
      // target, which was the same non-verb this whole pass exists to remove.
      loader.revealSpring('spring')
    }
    updateFragmentHud()
  }
  if (isSelene && objects.exitTrigger?.active && !objects.exitTrigger.used
    && player.position.distanceTo(objects.exitTrigger.position) < 1) {
    objects.exitTrigger.used = true
    objects.exitTrigger.active = false
    objects.exitTrigger.marker.visible = false
    objects.exit?.reveal()
    refreshLocateExit()
    beginReveal(objects.exit.position)
  }
}
function frame() { const delta = Math.min(clock.getDelta(), .05); update(delta); renderer.render(scene, camera); requestAnimationFrame(frame) }
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) }
addEventListener('resize', resize)
resize(); updateChapterCards(); frame()
