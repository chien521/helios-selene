import * as THREE from 'three'
import './style.css'
import { helios } from './chapters/helios.js'
import { selene } from './chapters/selene.js'
import { ChapterLoader } from './world/ChapterLoader.js'
import { Telescope } from './world/Telescope.js'
import { TelescopeAim } from './world/TelescopeAim.js'
import { meltWall, updateBridge } from './world/LensGates.js'
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
const state = { chapter: null, collected: new Set(), frameCollected: false, lensBoxRevealed: false, lensCollected: false, unlocked: saved('helios-complete'), playing: false, ending: false, revealing: false }
const app = document.querySelector('#app')
app.innerHTML = `
  <canvas id="world" aria-label="A quiet three dimensional puzzle landscape"></canvas>
  <div id="aim-overlay" aria-hidden="true"><div id="aim-reticle"><span></span></div></div>
  <section id="landing" class="screen visible"><h1>helios <i>&</i> selene</h1><p class="pitch">Two skies. One unfinished telescope.<br>Look long enough to make a way through.</p><button class="command" data-show="start">Enter the observatory</button></section>
  <section id="start" class="screen"><h2>Choose where to begin.</h2><button class="command" data-show="chapters">Play</button><button class="command quiet" data-show="guide">How to play</button><button class="command quiet" data-viverse="avatar">Use my VIVERSE avatar</button><button class="command quiet" data-viverse="records">See records</button><p id="notice" aria-live="polite"></p></section>
  <section id="chapters" class="screen"><p class="eyebrow">CHAPTER SELECT</p><div class="chapter-list"><button class="chapter-card helios" data-chapter="helios"><span>01</span><strong>Helios</strong><small>The day that would not soften.</small></button><button class="chapter-card selene" data-chapter="selene" disabled><span>02</span><strong>Selene</strong><small data-lock>Locked until Helios is complete.</small></button></div><button class="command quiet" data-restart>Restart game</button><button class="back" data-show="start" aria-label="Return">Back</button></section>
  <section id="guide" class="screen"><p class="eyebrow">FIELD NOTES</p><h2>Look. Commit. Move.</h2><dl><div><dt>Move</dt><dd>W A S D</dd></div><div><dt>Jump</dt><dd>Space</dd></div><div><dt>Interact</dt><dd>E</dd></div><div><dt>Lockbox dial</dt><dd>Q to select, E to turn</dd></div><div><dt>Telescope</dt><dd>R to raise or lower</dd></div><div><dt>Focus</dt><dd>Hold left mouse while raised</dd></div><div><dt>Pause</dt><dd>Escape</dd></div></dl><p>Raise the telescope to look. What each lens shows you determines what you can do while it's raised.</p><p id="lens-guide">Helios: move freely while aiming. Turn the heliostat with E, then keep the glass on its mirror to send a reflection skyward. Selene: raising leaves you free to walk, but what it reveals only holds its shape while you keep looking — lower the telescope and the path fades.</p><button class="back" data-show="start">Back</button></section>
  <section id="hud"><p id="chapter-name"></p><div id="fragments" aria-label="Telescope parts: 0 of 2"><span id="fragment-count">PARTS 0 / 2</span><div class="fragment-slots" aria-hidden="true"><i></i><i></i></div></div><p id="scope-label">FIND A TELESCOPE PART</p></section>
  <button id="locate-exit" data-locate-exit>Where's the exit?</button>
  <aside id="lockbox-hint" aria-live="polite" aria-hidden="true"><div id="lockbox-hint-text"></div><p class="hint-close">H / CLOSE</p></aside>
  <section id="pause" class="screen"><p class="eyebrow">PAUSED</p><button class="command" data-resume>Return</button><button class="command quiet" data-show="chapters">Chapter select</button><button class="command quiet" data-restart>Restart game</button></section>
  <section id="ending" class="screen"><div class="end-image"><span></span></div><div class="myth"><p class="eyebrow">THE ONE NIGHT</p><h2>Helios crossed the day<br>and Selene kept the night.</h2><p>They loved across a sky that never held them both.</p><p>So one traveler made an eye from what the sun had changed and what the moon had kept.</p><p>For one looking, they were together.</p><p class="complete">Game is completed. Replay the game.</p><button class="command" data-replay>Replay the game</button><button class="command quiet" data-viverse="submit">Submit my run</button></div></section>
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
const hud = document.querySelector('#hud')
const fragmentSlots = [...document.querySelectorAll('.fragment-slots i')]
const restartDialog = document.querySelector('#restart-dialog')
const lockboxHint = document.querySelector('#lockbox-hint')
const lockboxHintText = document.querySelector('#lockbox-hint-text')
const locateExit = document.querySelector('#locate-exit')
const hideLockboxHint = () => { lockboxHint.classList.remove('visible'); lockboxHint.setAttribute('aria-hidden', 'true') }
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
const show = (id) => {
  screens.forEach((screen) => screen.classList.toggle('visible', screen.id === id))
  document.querySelector('#landing').classList.toggle('dimmed', id !== 'landing')
  hud.classList.toggle('visible', state.playing && id !== 'pause')
  locateExit.classList.toggle('visible', state.playing && state.chapter?.id === 'helios' && id !== 'pause')
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
  state.collected.clear()
  state.unlocked = false
  state.playing = false
  state.ending = false
  state.revealing = false
  checkpoint.reset()
  telescope.resetPower()
  aim.lower()
  followCamera.cancelReveal()
  loader.clear()
  resetPlayer()
  hideLockboxHint()
  hud.removeAttribute('data-chapter')
  updateChapterCards()
  show('landing')
}
const fragmentTotal = () => state.chapter.id === 'helios' ? 2 : state.chapter.fragments.length
const updateFragmentHud = () => {
  const collected = state.chapter.id === 'helios'
    ? Number(state.frameCollected) + Number(state.lensCollected)
    : state.collected.size
  document.querySelector('#fragment-count').textContent = `PARTS ${collected} / ${fragmentTotal()}`
  document.querySelector('#fragments').setAttribute('aria-label', `Telescope parts: ${collected} of ${fragmentTotal()}`)
  fragmentSlots.forEach((slot, index) => slot.classList.toggle('filled', index < collected))
}
const startChapter = (chapter) => {
  state.chapter = chapter
  state.collected.clear()
  state.frameCollected = false
  state.lensBoxRevealed = false
  state.lensCollected = false
  state.playing = true
  state.ending = false
  state.revealing = false
  checkpoint.reset()
  telescope.resetPower()
  aim.lower()
  followCamera.cancelReveal()
  loader.load(chapter)
  resetPlayer()
  hideLockboxHint()
  document.querySelector('#chapter-name').textContent = `${chapter.number} / ${chapter.title.toUpperCase()}`
  hud.dataset.chapter = chapter.id
  document.querySelector('#fragments').hidden = false
  updateFragmentHud()
  show('')
}
const finishChapter = () => {
  if (state.chapter.id === 'helios') {
    state.unlocked = true
    save('helios-complete')
    updateChapterCards()
    startChapter(selene)
    return
  }
  state.playing = false
  state.ending = true
  show('ending')
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('button')
  if (!target) return
  if (target.dataset.locateExit !== undefined && state.playing && !state.revealing && state.chapter.id === 'helios' && loader.objects.exit) {
    beginReveal(loader.objects.exit.position)
    return
  }
  if (target.dataset.restart !== undefined) { restartDialog.showModal(); return }
  if (target.dataset.confirmRestart !== undefined) { restartDialog.close(); restartGame(); return }
  if (target.dataset.show !== undefined) { state.playing = false; show(target.dataset.show); return }
  if (target.dataset.chapter) startChapter(chapters.find((chapter) => chapter.id === target.dataset.chapter))
  if (target.dataset.viverse) document.querySelector('#notice').textContent = viverseSession[target.dataset.viverse === 'avatar' ? 'useAvatar' : target.dataset.viverse === 'records' ? 'records' : 'submitRun']().message
  if (target.dataset.resume !== undefined) show('')
  if (target.dataset.replay !== undefined) { state.ending = false; updateChapterCards(); show('chapters') }
})
const held = new Set()
const beginReveal = (position) => {
  state.revealing = true
  telescope.setRaised(false)
  aim.lower()
  held.clear()
  followCamera.revealObject(position)
}
addEventListener('keydown', (event) => {
  held.add(event.code)
  if (state.playing && (event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'ArrowUp' || event.code === 'ArrowDown')) event.preventDefault()
  if (event.code === 'KeyR' && !event.repeat && state.playing && !state.revealing && telescope.aimUnlocked) {
    telescope.setRaised(!telescope.raised)
    if (telescope.raised) aim.raise(camera, player.position)
    else aim.lower()
  }
  if (event.code === 'KeyE' && !event.repeat && state.playing && !state.revealing) {
    const box = loader.nearestLockbox(player.position)
    const result = box?.interact(player.position)
    if (result?.opened && box === loader.objects.lockbox) loader.objects.mirrors.forEach((mirror) => mirror.reveal())
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
  if ((event.code === 'Space' || event.code === 'KeyW' || event.code === 'ArrowUp') && state.playing && !state.revealing) {
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
function update(delta) {
  if (!state.playing || document.querySelector('#pause').classList.contains('visible')) return
  const objects = loader.objects
  if (state.revealing) {
    loader.updateGlow(clock.elapsedTime, player.position)
    if (followCamera.update(delta, player)) state.revealing = false
    return
  }
  // Turning a mirror is the chapter's core verb. The player commits by *walking* to a mirror
  // rather than by locking the camera, which is why movement stays free while the scope is up.
  const mirror = loader.nearestMirror(player.position)
  mirror?.rotate(delta, held.has('KeyE'), player.position)
  const spotlightOnMirror = telescope.raised
    && objects.mirrors.some((entry) => entry.group.visible && aim.hovers(entry.position, camera))
  const focusTargets = [...objects.mirrors]
  if (state.lensCollected && objects.meltBridge && !objects.meltBridge.melted) focusTargets.push(objects.meltBridge)
  if (state.lensCollected && objects.meltBridge?.melted && !objects.exitBridge?.revealed) focusTargets.push(objects.exitBridge)
  const focusedTarget = aim.updateFocus(delta, camera, focusTargets)
  const focusedMirror = objects.mirrors.includes(focusedTarget) ? focusedTarget : null
  if (objects.meltBridge && focusedTarget === objects.meltBridge && meltWall(objects.meltBridge)) {
    objects.exit?.reveal()
    loader.revealExitBridgeMarker()
  }
  if (focusedTarget === objects.exitBridge) loader.revealExitBridge()

  // The optical layer needs the telescope frame to be seen at all, and the Helios lens to burn --
  // so the back half of the chapter stays mechanically unsolvable until the lens is collected.
  const beams = loader.updateBeams({
    visible: telescope.aimUnlocked,
    showDirections: spotlightOnMirror,
    focusedMirror,
  })
  if (!state.lensBoxRevealed && loader.receiversLatched(loader.lensReceiverIds) && objects.lensBox?.reveal()) {
    state.lensBoxRevealed = true
    beginReveal(objects.lensBox.group.position)
  }
  const routes = loader.updatePeriscopeRoutes()

  const interactionPrompt = loader.nearestLockbox(player.position)?.prompt(player.position) || mirror?.prompt(player.position)
  document.querySelector('#scope-label').textContent = telescope.raised
    ? 'R / LOWER TELESCOPE'
    : interactionPrompt || (telescope.aimUnlocked ? 'R / RAISE TELESCOPE' : '')
  if (objects.bridge) updateBridge(objects.bridge, telescope.raised && telescope.power === 'selene')
  loader.updateGlow(clock.elapsedTime, player.position)
  if (objects.exit && objects.meltBridge?.melted) objects.exit.setPulledCloser(telescope.raised)
  objects.exit?.update(clock.elapsedTime, delta)
  loader.updateGrade(player.position.x, delta)
  const right = held.has('KeyD') || held.has('ArrowRight')
  const left = held.has('KeyA') || held.has('ArrowLeft')
  const axis = (right ? 1 : 0) - (left ? 1 : 0)
  player.update(delta, axis, loader.getColliders())
  if (telescope.raised && objects.exit?.reached(player.position)) finishChapter()
  const activeSpring = player.body.grounded ? loader.springUnder(player.body) : null
  if (activeSpring) {
    if (activeSpring === objects.spring) loader.revealUpperSpring()
    player.launchFromSpring()
  }
  if (player.body.grounded) {
    const platform = loader.platformAt(player.position.x, player.body.y - player.body.hh)
    if (platform && checkpoint.update(platform, loader.standingHeight(platform))) finishChapter()
    // Safety net for the pit. The lower platform is wider than the hub, so walking off either hub
    // edge drops the player in -- and before the lens exists there is no spring and no telescope, so
    // there is no way back up, while the y < -15 respawn never fires because the pit floor is at -9.
    // Only fires when the lens has not even been revealed yet, i.e. the player has no business being
    // down here; the intended descent (lens visible, waiting to be collected) keeps its spring beat.
    if (platform === loader.lowerPlatform && !state.lensCollected && !objects.triangulation?.lens.visible) loader.revealSpring()
  }
  if (player.position.y < -15) resetPlayer()
  followCamera.update(delta, player)
  if (objects.lockbox?.collectFrame(player.position) && !state.frameCollected) {
    state.frameCollected = true
    telescope.unlockAim()
    // Pan to the heliostat: the frame is what makes light visible, so this is the moment the
    // chapter's whole optical layer switches on.
    beginReveal(objects.mirrors.find((entry) => entry.id === 'heliostat').position)
    updateFragmentHud()
  }
  if (objects.triangulation?.collectLens(player.position) && !state.lensCollected) {
    state.lensCollected = true
    telescope.unlock('helios')
    // The spring is simply the reward for reaching the lens. It used to be another point-and-hold
    // target, which was the same non-verb this whole pass exists to remove.
    loader.revealSpring()
    updateFragmentHud()
  }
  objects.collectibles.forEach((fragment) => {
    if (!fragment.mesh.visible || player.position.distanceTo(fragment.mesh.position) >= 1.8) return
    const wasEmpty = state.collected.size === 0
    state.collected.add(fragment.id)
    fragment.mesh.visible = false
    if (wasEmpty) telescope.unlock(state.chapter.id)
    updateFragmentHud()
  })
}
function frame() { const delta = Math.min(clock.getDelta(), .05); update(delta); renderer.render(scene, camera); requestAnimationFrame(frame) }
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) }
addEventListener('resize', resize)
resize(); updateChapterCards(); frame()