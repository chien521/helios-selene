import * as THREE from 'three'
import './style.css'
import { helios } from './chapters/helios.js'
import { selene } from './chapters/selene.js'
import { ChapterLoader } from './world/ChapterLoader.js'
import { Telescope } from './world/Telescope.js'
import { viverseSession } from './viverse/ViverseSession.js'

const chapters = [helios, selene]
const saved = (key) => { try { return localStorage.getItem(key) === 'true' } catch { return false } }
const save = (key) => { try { localStorage.setItem(key, 'true') } catch {} }
const state = { chapter: null, collected: new Set(), unlocked: saved('helios-complete'), playing: false, ending: false, jumpHeight: 0, jumpVelocity: 0 }
const app = document.querySelector('#app')
app.innerHTML = `
  <canvas id="world" aria-label="A quiet three dimensional puzzle landscape"></canvas>
  <section id="landing" class="screen visible"><p class="eyebrow">A WORDLESS PUZZLE PASSAGE</p><h1>HELIOS <i>&</i> SELENE</h1><p class="pitch">Two skies. One unfinished telescope. Look long enough to make a way through.</p><div class="chapter-stills"><figure class="still helios"><figcaption>01 / HELIOS</figcaption></figure><figure class="still selene"><figcaption>02 / SELENE</figcaption></figure></div><button class="command" data-show="start">Enter the observatory</button></section>
  <section id="start" class="screen"><p class="eyebrow">THE UNFINISHED INSTRUMENT</p><h2>Choose where to begin.</h2><button class="command" data-show="chapters">Play</button><button class="command quiet" data-show="guide">How to play</button><button class="command quiet" data-viverse="avatar">Use my VIVERSE avatar</button><button class="command quiet" data-viverse="records">See records</button><p id="notice" aria-live="polite"></p></section>
  <section id="chapters" class="screen"><p class="eyebrow">CHAPTER SELECT</p><div class="chapter-list"><button class="chapter-card helios" data-chapter="helios"><span>01</span><strong>Helios</strong><small>The day that would not soften.</small></button><button class="chapter-card selene" data-chapter="selene" disabled><span>02</span><strong>Selene</strong><small data-lock>Locked until Helios is complete.</small></button></div><button class="back" data-show="start" aria-label="Return">Back</button></section>
  <section id="guide" class="screen"><p class="eyebrow">FIELD NOTES</p><h2>Look. Commit. Move.</h2><dl><div><dt>Move</dt><dd>W A S D</dd></div><div><dt>Jump</dt><dd>Space</dd></div><div><dt>Telescope</dt><dd>R to raise or lower</dd></div><div><dt>Pause</dt><dd>Escape</dd></div></dl><p>The telescope holds you still. What it reveals must be carried in memory when you lower it.</p><p id="lens-guide">The Helios lens lets sustained focus melt a distant obstruction.</p><button class="back" data-show="start">Back</button></section>
  <section id="hud"><p id="chapter-name"></p><p id="objective"></p><div id="scope"><span></span></div><p id="scope-label">R / RAISE TELESCOPE</p></section>
  <section id="pause" class="screen"><p class="eyebrow">PAUSED</p><button class="command" data-resume>Return</button><button class="command quiet" data-show="chapters">Chapter select</button></section>
  <section id="ending" class="screen"><div class="end-image"><span></span></div><div class="myth"><p class="eyebrow">THE ONE NIGHT</p><h2>Helios crossed the day<br>and Selene kept the night.</h2><p>They loved across a sky that never held them both.</p><p>So one traveler made an eye from what the sun had changed and what the moon had kept.</p><p>For one looking, they were together.</p><p class="complete">Game is completed. Replay the game.</p><button class="command" data-replay>Replay the game</button><button class="command quiet" data-viverse="submit">Submit my run</button></div></section>`

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#world'), antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .1, 100)
camera.position.set(15, 10, 20)
camera.lookAt(2, 2, -4)
const loader = new ChapterLoader(scene)
const telescope = new Telescope()
const clock = new THREE.Clock()
const screens = [...document.querySelectorAll('.screen')]
const hud = document.querySelector('#hud')
const show = (id) => {
  screens.forEach((screen) => screen.classList.toggle('visible', screen.id === id))
  document.querySelector('#landing').classList.toggle('dimmed', id !== 'landing')
  hud.classList.toggle('visible', state.playing && id !== 'pause')
}
const updateChapterCards = () => {
  const seleneCard = document.querySelector('[data-chapter="selene"]')
  seleneCard.disabled = !state.unlocked
  seleneCard.querySelector('[data-lock]').textContent = state.unlocked ? 'The night that kept its shape.' : 'Locked until Helios is complete.'
}
const resetCamera = () => {
  state.jumpHeight = 0
  state.jumpVelocity = 0
  camera.position.set(15, 10, 20)
  camera.lookAt(2, 2, -4)
}
const startChapter = (chapter) => {
  state.chapter = chapter
  state.playing = true
  state.ending = false
  telescope.setRaised(false)
  loader.load(chapter)
  resetCamera()
  document.querySelector('#chapter-name').textContent = `${chapter.number} / ${chapter.title.toUpperCase()}`
  document.querySelector('#objective').textContent = chapter.objective
  show('')
}
const finishChapter = () => {
  if (state.chapter.id === 'helios') {
    state.unlocked = true
    save('helios-complete')
    updateChapterCards()
    state.playing = false
    show('chapters')
    return
  }
  state.playing = false
  state.ending = true
  show('ending')
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('button')
  if (!target) return
  if (target.dataset.show !== undefined) { state.playing = false; show(target.dataset.show); return }
  if (target.dataset.chapter) startChapter(chapters.find((chapter) => chapter.id === target.dataset.chapter))
  if (target.dataset.viverse) document.querySelector('#notice').textContent = viverseSession[target.dataset.viverse === 'avatar' ? 'useAvatar' : target.dataset.viverse === 'records' ? 'records' : 'submitRun']().message
  if (target.dataset.resume !== undefined) show('')
  if (target.dataset.replay !== undefined) { state.ending = false; updateChapterCards(); show('chapters') }
})
const held = new Set()
addEventListener('keydown', (event) => {
  held.add(event.code)
  if (event.code === 'KeyR' && !event.repeat && state.playing) telescope.setRaised(!telescope.raised)
  if (event.code === 'Space' && state.playing && !telescope.raised && state.jumpHeight === 0) {
    event.preventDefault()
    state.jumpVelocity = 10
  }
  if (event.code === 'Escape' && state.playing) show(document.querySelector('#pause').classList.contains('visible') ? '' : 'pause')
})
addEventListener('keyup', (event) => held.delete(event.code))
function update(delta) {
  if (!state.playing || document.querySelector('#pause').classList.contains('visible')) return
  const objects = loader.objects
  const activeTarget = state.chapter.id === 'helios' ? objects.gate : objects.bridge
  const distance = activeTarget ? camera.position.distanceTo(activeTarget.position) : 99
  const focused = telescope.raised && telescope.power === state.chapter.id && distance < 27
  const focus = telescope.update(focused, delta)
  document.querySelector('#scope').classList.toggle('raised', telescope.raised)
  document.querySelector('#scope span').style.transform = `scaleX(${focus})`
  document.querySelector('#scope-label').textContent = telescope.raised ? (focused ? state.chapter.gateHint : 'SEARCH THE HORIZON') : 'R / RAISE TELESCOPE'
  if (objects.bridge) {
    const stabilized = telescope.raised && telescope.power === 'selene'
    objects.bridge.material.opacity = stabilized ? .92 : .1
    objects.bridge.visible = stabilized
  }
  if (state.chapter.id === 'helios' && focus >= 1 && objects.gate.visible) { objects.gate.visible = false; document.querySelector('#objective').textContent = 'The way is open. Reach the summit.' }
  const atSummit = camera.position.distanceTo(objects.summit.position) < 5
  const canFinish = state.chapter.id === 'helios'
    ? telescope.power === 'helios' && !objects.gate.visible && atSummit
    : telescope.power === 'selene' && telescope.raised && atSummit
  if (canFinish) finishChapter()
  if (state.jumpHeight > 0 || state.jumpVelocity > 0) {
    state.jumpVelocity -= 26 * delta
    state.jumpHeight = Math.max(0, state.jumpHeight + state.jumpVelocity * delta)
    if (state.jumpHeight === 0) state.jumpVelocity = 0
    camera.position.y = 10 + state.jumpHeight
  }
  const speed = telescope.raised ? 0 : 8 * delta
  if (speed) {
    const direction = new THREE.Vector3((held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0), 0, (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0))
    camera.position.add(direction.multiplyScalar(speed))
    camera.lookAt(2, 2, -4)
  }
  if (objects.lens && !state.collected.has(state.chapter.id) && camera.position.distanceTo(objects.lens.position) < 4.5) {
    state.collected.add(state.chapter.id)
    telescope.unlock(state.chapter.id)
    objects.lens.visible = false
    document.querySelector('#objective').textContent = `${state.chapter.lensLabel} joined to the telescope. ${state.chapter.gateHint}`
  }
}
function frame() { const delta = Math.min(clock.getDelta(), .05); update(delta); renderer.render(scene, camera); requestAnimationFrame(frame) }
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) }
addEventListener('resize', resize)
resize(); updateChapterCards(); frame()