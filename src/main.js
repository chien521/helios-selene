import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import './style.css'
import { helios } from './chapters/helios.js'
import { heliosTutorial } from './chapters/heliosTutorial.js'
import { selene } from './chapters/selene.js'
import { ChapterLoader } from './world/ChapterLoader.js'
import { Telescope } from './world/Telescope.js'
import { TelescopeAim } from './world/TelescopeAim.js'
import { viverseSession } from './viverse/ViverseSession.js'
import { Player } from './core/Player.js'
import { FollowCamera } from './core/Camera.js'
import { Checkpoint } from './core/Checkpoint.js'
import { meltWall } from './world/LensGates.js'
import { getLocale, setLocale, t } from './i18n.js'

const chapters = [helios, selene]
const saved = (key) => { try { return localStorage.getItem(key) === 'true' } catch { return false } }
const save = (key) => { try { localStorage.setItem(key, 'true') } catch {} }
const removeSaved = (key) => { try { localStorage.removeItem(key) } catch {} }
const SPAWN_X = -3
const SPAWN_Y = 1.1
// Each chapter assembles its own optic: Helios's magnifier uses a frame and fire lens, while
// Selene's telescope uses a moon lens and eyepiece. Shared flags keep the parts HUD generic.
const state = { chapter: null, frameCollected: false, lensBoxRevealed: false, lensCollected: false, unlocked: saved('helios-complete'), playing: false, ending: false, revealing: false, moonViewing: false, runSeconds: 0, runSubmitted: false, tutorial: null, viverseName: null }
const RECORDS_LEADERBOARD = import.meta.env.VITE_VIVERSE_LEADERBOARD_SPEEDRUN
const app = document.querySelector('#app')
app.innerHTML = `
  <svg width="0" height="0" aria-hidden="true" style="position:absolute">
    <filter id="end-duotone" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/>
      <!-- Contrast boost before the duotone table: the source is a photographed 15th-century page,
           so its "paper" isn't a flat white -- vignetting and aging leave it anywhere from cream to
           tan. Pushing midtones hard toward the two extremes collapses all of that into a clean
           navy field, so only the actual ink linework reads as the orange half of the duotone. -->
      <feComponentTransfer>
        <feFuncR type="linear" slope="2.2" intercept="-.75"/>
        <feFuncG type="linear" slope="2.2" intercept="-.75"/>
        <feFuncB type="linear" slope="2.2" intercept="-.75"/>
      </feComponentTransfer>
      <feComponentTransfer>
        <feFuncR type="table" tableValues="1 0.0353"/>
        <feFuncG type="table" tableValues="0.5490 0.0706"/>
        <feFuncB type="table" tableValues="0.1020 0.1333"/>
      </feComponentTransfer>
    </filter>
  </svg>
  <canvas id="world" data-i18n-aria="worldAriaLabel"></canvas>
  <div id="chapter-fade" aria-hidden="true"></div>
  <div id="aim-overlay" aria-hidden="true"><div id="aim-reticle"><span></span></div></div>
  <section id="landing" class="screen visible"><h1>helios <i>&</i> selene</h1><p class="pitch" id="landing-pitch"></p><button class="command" data-language-entry data-i18n="enterObservatory"></button></section>
  <section id="start" class="screen"><div id="start-content"><button class="command" data-show="chapters" data-i18n="play"></button><button class="command quiet" data-tutorial-start data-i18n="gameplayWalkthrough"></button><button class="command quiet" data-show="language" data-i18n="backToLanguageSelection"></button><p id="notice" aria-live="polite"></p></div><div id="start-utility-actions"><button class="command quiet" data-viverse="avatar" data-i18n="useViverseAvatar"></button><button class="command quiet" data-viverse="records" data-i18n="seeRecords"></button></div></section>
  <section id="chapters" class="screen"><p class="eyebrow" data-i18n="chapterSelectEyebrow"></p><div class="chapter-list"><button class="chapter-card helios" data-chapter="helios"><span>01</span><strong data-i18n="helios.title"></strong><small data-i18n="helios.subtitle"></small></button><button class="chapter-card selene" data-chapter="selene" disabled><span>02</span><strong data-i18n="selene.title"></strong><small data-lock></small></button></div><button class="command quiet" data-restart data-i18n="restartGame"></button><button class="back" data-show="start" data-i18n="back" data-i18n-aria="back"></button></section>
  <section id="records" class="screen"><h2 data-i18n="recordsTitle"></h2><div class="records-header"><span data-i18n="rankColumn"></span><span data-i18n="nameColumn"></span><span data-i18n="timeColumn"></span></div><ol id="records-list"></ol><p id="records-status" aria-live="polite"></p><button class="back" data-show="start" data-i18n="closeRecords"></button></section>
  <section id="guide" class="screen"><div class="guide-board"><p class="eyebrow" data-i18n="fieldNotesEyebrow"></p><h2 data-i18n="guideHeading"></h2><dl><div><dt data-i18n="dtMove"></dt><dd>W A S D</dd></div><div><dt data-i18n="dtJump"></dt><dd data-i18n="ddJump"></dd></div><div><dt data-i18n="dtInteract"></dt><dd>E</dd></div><div><dt data-i18n="dtDial"></dt><dd data-i18n="ddDial"></dd></div><div><dt data-i18n="dtInstrument"></dt><dd data-i18n="ddInstrument"></dd></div><div><dt data-i18n="dtFocus"></dt><dd data-i18n="ddFocus"></dd></div><div><dt data-i18n="dtMoonView"></dt><dd>Space</dd></div><div><dt data-i18n="dtPause"></dt><dd>Escape</dd></div></dl><p class="instrument-note" data-i18n="instrumentNoteHelios"></p><p class="instrument-note" data-i18n="instrumentNoteSelene"></p><p class="credits" id="credits-line"></p><button class="back" data-show="start" data-i18n="back"></button></div></section>
  <section id="language" class="screen"><h2 data-i18n="language"></h2><select id="language-select" data-i18n-aria="language"><option value="en">English</option><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option><option value="ja">日本語</option><option value="ru">Русский</option><option value="es">Espanol</option><option value="pt">Portugues</option><option value="pt-BR">Portugues (Brasil)</option><option value="fr">Francais</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="ko">한국어</option><option value="hi">हिन्दी</option><option value="ar">العربية</option><option value="th">ไทย</option></select><button class="command" data-language-confirm data-i18n="confirm"></button></section>
  <section id="hud"><p id="chapter-name"></p><div id="fragments" aria-label="Instrument parts: 0 of 2"><span id="fragment-count">PARTS 0 / 2</span><div class="fragment-slots" aria-hidden="true"><i></i><i></i></div></div><p id="moon-phase" hidden></p><p id="scope-label" data-i18n="findInstrumentPart"></p></section>
  <aside id="tutorial-task" aria-live="polite" aria-atomic="true" hidden><p id="tutorial-progress"></p><p id="tutorial-copy"></p><button type="button" data-tutorial-skip></button></aside>
  <aside id="selene-intro" aria-live="polite" data-i18n="seleneIntroText"></aside>
  <button id="locate-moon" data-locate-moon data-i18n="locateMoon"></button>
  <button id="locate-exit" data-locate-exit data-i18n="locateExit"></button>
  <aside id="lockbox-hint" aria-live="polite" aria-hidden="true"><div id="lockbox-hint-text"></div><p class="hint-close" data-i18n="hintClose"></p></aside>
  <section id="pause" class="screen"><p class="eyebrow" data-i18n="pausedEyebrow"></p><button class="command" data-resume data-i18n="pauseReturn"></button><button class="command quiet" data-show="chapters" data-i18n="chapterSelect"></button><button class="command quiet" data-show="language" data-i18n="language"></button><button class="command quiet" data-restart data-i18n="restartGame"></button></section>
  <section id="chapter-complete" class="screen"><p class="eyebrow" data-i18n="chapterCompleteEyebrow"></p><h2 data-i18n="chapterCompleteHeading"></h2><p data-i18n="chapterCompleteText"></p><button class="command" data-continue data-i18n="goOnToSelene"></button><button class="command quiet" data-show="chapters" data-i18n="chapterSelect"></button></section>
  <section id="tutorial-complete" class="screen"><div id="tutorial-complete-actions"><button class="command" data-tutorial-replay data-i18n="tutorialReplay"></button><button class="command quiet" data-tutorial-return data-i18n="chapterSelect"></button></div></section>
  <section id="ending" class="screen"><div class="end-image"><div class="end-art"></div><span></span></div><div class="myth"><p class="eyebrow" data-i18n="endingEyebrow"></p><h2 id="ending-heading"></h2><p data-i18n="myth1"></p><p data-i18n="myth2"></p><p data-i18n="myth3"></p><p data-i18n="myth4"></p><p data-i18n="myth5"></p><p data-i18n="mythCouplet1"></p><p data-i18n="mythCouplet2"></p><p class="complete" data-i18n="gameComplete"></p><button class="command" data-replay data-i18n="replayGame"></button><button class="command quiet" data-viverse="submit" data-i18n="submitMyRun"></button><p id="ending-notice" aria-live="polite"></p></div></section>
  <dialog id="restart-dialog" aria-labelledby="restart-title"><p id="restart-title" data-i18n="restartDialogTitle"></p><p data-i18n="restartDialogText"></p><form method="dialog"><button class="command quiet" value="cancel" data-i18n="cancel"></button><button class="command" value="confirm" data-confirm-restart data-i18n="restart"></button></form></dialog>`

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#world'), antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const composer = new EffectComposer(renderer)
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .35, .4, .92)
const scene = new THREE.Scene()
const followCamera = new FollowCamera()
const camera = followCamera.camera
composer.addPass(new RenderPass(scene, camera))
const ssaoPass = new SSAOPass(scene, camera, innerWidth, innerHeight)
ssaoPass.kernelRadius = .6
ssaoPass.minDistance = .002
ssaoPass.maxDistance = .12
composer.addPass(ssaoPass)
composer.addPass(bloomPass)
// VignetteShader mixes each pixel toward vec3(1 - darkness) weighted by squared distance from
// center. darkness must stay comfortably under 1 (mix target near black, subtle falloff) and never
// at/above 1 (target goes to zero or negative, crushing far more of the frame than just the
// corners). .8/.9 gives a barely-there darkening confined to the far corners -- two earlier tries
// were both wrong in opposite directions and worth not repeating: darkness 1.1 flattened the
// platforms' plaster texture to near-black across most of the view, and darkness .35 (an
// overcorrection) washed the whole frame toward flat gray instead. Verify any future change here
// against an actual screenshot, not the formula alone -- the falloff extends much further into the
// frame than "vignette" suggests.
const vignettePass = new ShaderPass(VignetteShader)
vignettePass.uniforms.offset.value = 0.9
vignettePass.uniforms.darkness.value = 0.8
composer.addPass(vignettePass)
composer.addPass(new OutputPass())
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
const notice = document.querySelector('#notice')
const endingNotice = document.querySelector('#ending-notice')
const avatarButton = document.querySelector('[data-viverse="avatar"]')
const submitButton = document.querySelector('[data-viverse="submit"]')
const recordsList = document.querySelector('#records-list')
const recordsStatus = document.querySelector('#records-status')
const tutorialTask = document.querySelector('#tutorial-task')
const tutorialProgress = document.querySelector('#tutorial-progress')
const tutorialCopy = document.querySelector('#tutorial-copy')
const tutorialSkip = document.querySelector('[data-tutorial-skip]')
const HELIOS_TUTORIAL_STEPS = [
  ['move', 'tutorialMove'], ['jump', 'tutorialJump'], ['lockbox', 'tutorialLockbox'],
  ['frame', 'tutorialFrame'], ['raise', 'tutorialRaise'], ['mirror', 'tutorialMirror'],
  ['focus', 'tutorialFocus'], ['dot', 'tutorialDot'], ['exit', 'tutorialExit'],
]
const refreshTutorial = () => {
  const tutorial = state.tutorial
  const visible = state.playing && tutorial?.chapterId === state.chapter?.id
  tutorialTask.hidden = !visible
  if (!visible) return
  const [, copyKey] = HELIOS_TUTORIAL_STEPS[tutorial.step]
  tutorialProgress.textContent = t('tutorialProgress', { current: tutorial.step + 1, total: HELIOS_TUTORIAL_STEPS.length })
  tutorialCopy.textContent = t(copyKey)
  tutorialSkip.textContent = t('tutorialSkip')
}
const advanceTutorial = (action) => {
  const tutorial = state.tutorial
  if (!tutorial || tutorial.chapterId !== state.chapter?.id) return
  if (HELIOS_TUTORIAL_STEPS[tutorial.step]?.[0] !== action) return
  tutorial.step += 1
  if (tutorial.step === HELIOS_TUTORIAL_STEPS.length) {
    state.tutorial = null
    save('helios-walkthrough-complete')
  }
  refreshTutorial()
}
const hideLockboxHint = () => { lockboxHint.classList.remove('visible'); lockboxHint.setAttribute('aria-hidden', 'true') }
const showSeleneIntro = () => {
  seleneIntro.classList.remove('visible')
  if (state.chapter?.id !== 'selene') return
  void seleneIntro.offsetWidth
  seleneIntro.classList.add('visible')
}
const showLockboxHint = (box) => {
  lockboxHintText.replaceChildren(...t(box.hintKey).map((line) => {
    const paragraph = document.createElement('p')
    const italic = document.createElement('i')
    italic.textContent = line
    paragraph.append(italic)
    return paragraph
  }))
  lockboxHint.classList.add('visible')
  lockboxHint.setAttribute('aria-hidden', 'false')
}
const exitLocatable = () => state.playing
const refreshLocateExit = () => {
  const paused = document.querySelector('#pause').classList.contains('visible')
  locateExit.classList.toggle('visible', exitLocatable() && !paused)
}
const refreshLocateMoon = () => {
  const paused = document.querySelector('#pause').classList.contains('visible')
  const moonAvailable = state.playing && state.chapter?.id === 'selene' && !!loader.objects.moon?.group.visible
  locateMoon.classList.toggle('visible', moonAvailable && !paused)
  locateMoon.textContent = state.moonViewing ? t('locateMoonBack') : t('locateMoon')
}
// --- Run timer: performance.now()-based, paused time subtracted separately so pausing mid-run
// doesn't help a speedrun time. Only (re)started when Helios begins fresh from chapter select --
// carrying on into Selene via "Go on to Selene" keeps the same clock running.
let runStartTime = null
let pauseStartedAt = null
let pausedDuration = 0
const elapsedRunSeconds = () => {
  if (runStartTime === null) return 0
  const now = performance.now()
  const pausedNow = pausedDuration + (pauseStartedAt === null ? 0 : now - pauseStartedAt)
  return Math.max(0, (now - runStartTime - pausedNow) / 1000)
}
const startRunTimer = () => { runStartTime = performance.now(); pauseStartedAt = null; pausedDuration = 0; state.runSubmitted = false }
const stopRunTimer = () => { runStartTime = null; pauseStartedAt = null; pausedDuration = 0 }
const pauseRunTimer = () => { if (runStartTime !== null && pauseStartedAt === null) pauseStartedAt = performance.now() }
const resumeRunTimer = () => { if (pauseStartedAt !== null) { pausedDuration += performance.now() - pauseStartedAt; pauseStartedAt = null } }
const formatTime = (seconds) => {
  const total = Math.max(0, seconds)
  const minutes = Math.floor(total / 60)
  const secs = total - minutes * 60
  return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`
}

// --- VIVERSE: avatar connect is real login only (confirms identity, shows a display name) -- this
// game has no VRM avatar-swap capability like the sibling puzzle_game, so raising the flag here
// never claims a visual change that doesn't happen. See CLAUDE.md's VIVERSE section.
const refreshAvatarButton = () => {
  avatarButton.textContent = viverseSession.isLoggedIn() && state.viverseName
    ? t('connectedAs', { name: state.viverseName })
    : t('useViverseAvatar')
}
async function connectViverse(reason) {
  avatarButton.disabled = true
  avatarButton.textContent = t('viverseConnecting')
  try {
    const auth = await viverseSession.ensureLogin({ reason })
    if (!auth) return null // page is redirecting to VIVERSE login
    const profile = await viverseSession.fetchProfile()
    state.viverseName = viverseSession.getDisplayName(profile)
    notice.textContent = t('connectedAs', { name: state.viverseName })
    return auth
  } catch (error) {
    console.warn('VIVERSE connection failed.', error)
    notice.textContent = t('viverseConnectFailed')
    return null
  } finally {
    avatarButton.disabled = false
    refreshAvatarButton()
  }
}
const rowDisplayName = (row) => row.displayName || row.display_name || row.name || row.nickname || row.userName || 'VIVERSE Player'
const rowValue = (row) => row.value ?? row.score ?? row.time ?? 0
const renderRecords = (rows) => {
  recordsList.replaceChildren(...rows.map((row) => {
    const item = document.createElement('li')
    item.className = 'records-row'
    const rank = document.createElement('span'); rank.textContent = `#${row.rank}`
    const name = document.createElement('span'); name.textContent = rowDisplayName(row)
    const time = document.createElement('span'); time.textContent = formatTime(rowValue(row))
    item.append(rank, name, time)
    return item
  }))
}
async function loadRecords() {
  recordsList.replaceChildren()
  recordsStatus.textContent = t('loadingRecords')
  // Guests can view without logging in; only fall back to the authenticated path if the guest
  // read comes back empty and the player already has a session.
  let rows = await viverseSession.fetchLeaderboardAsGuest(RECORDS_LEADERBOARD)
  if (rows.length === 0 && viverseSession.isLoggedIn()) rows = await viverseSession.fetchLeaderboard(RECORDS_LEADERBOARD)
  if (rows.length === 0) {
    recordsStatus.textContent = viverseSession.isLoggedIn() ? t('noTimes') : t('recordsUnavailable')
    return
  }
  recordsStatus.textContent = ''
  renderRecords(rows)
}
async function submitRun() {
  if (state.runSubmitted) return
  submitButton.disabled = true
  const auth = await viverseSession.ensureLogin({ reason: 'submit', runSeconds: state.runSeconds })
  if (!auth) return // page is redirecting to VIVERSE login; resumePending() picks this back up on return
  const ok = await viverseSession.submitScore(RECORDS_LEADERBOARD, Math.round(state.runSeconds))
  submitButton.disabled = false
  if (ok) {
    state.runSubmitted = true
    endingNotice.textContent = `${t('runSubmitted')} ${t('yourTime', { time: formatTime(state.runSeconds) })}`
  } else {
    endingNotice.textContent = t('submitFailed')
  }
}
// The language screen is reached from #start and #pause; remembering whichever one opened it is
// enough to send the player back where they came from once they confirm a choice.
let languageReturnScreen = 'start'
const show = (id, returnScreen = null) => {
  if (id === 'language') languageReturnScreen = returnScreen || screens.find((screen) => screen.classList.contains('visible'))?.id || 'start'
  const wasPaused = document.querySelector('#pause').classList.contains('visible')
  screens.forEach((screen) => screen.classList.toggle('visible', screen.id === id))
  document.querySelector('#landing').classList.toggle('dimmed', id !== 'landing')
  hud.classList.toggle('visible', state.playing && id !== 'pause')
  // The run timer must not count paused time toward a speedrun, regardless of which path opened
  // or closed the pause screen (Escape, the resume button, or navigating away to another menu).
  if (id === 'pause' && !wasPaused) pauseRunTimer()
  if (wasPaused && id !== 'pause') resumeRunTimer()
  refreshLocateExit()
  refreshLocateMoon()
}
const updateChapterCards = () => {
  const seleneCard = document.querySelector('[data-chapter="selene"]')
  seleneCard.disabled = !state.unlocked
  seleneCard.querySelector('[data-lock]').textContent = state.unlocked ? t('selene.subtitle') : t('selene.locked')
}
// Everything with a data-i18n/data-i18n-aria hook plus the handful of strings assembled with
// markup (a <br>, an inline link) that textContent can't carry. Called once at startup and again
// whenever the language changes.
const applyTranslations = () => {
  document.documentElement.lang = getLocale()
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n) })
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)) })
  document.querySelector('#landing-pitch').innerHTML = `${t('pitchLine1')}<br>${t('pitchLine2')}`
  document.querySelector('#ending-heading').innerHTML = `${t('endingHeadingLine1')}<br>${t('endingHeadingLine2')}`
  document.querySelector('#credits-line').innerHTML = t('creditsText', { link: '<a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>' })
  updateChapterCards()
  if (state.chapter) document.querySelector('#chapter-name').textContent = `${state.chapter.number} / ${t(`${state.chapter.id}.title`).toUpperCase()}`
  updateFragmentHud()
  updatePhaseHud()
  refreshLocateMoon()
  // Overrides the generic data-i18n pass above for this one button, which otherwise stomps a
  // "Connected as {name}" label back to the generic "Use my VIVERSE avatar" text on every
  // language change or startup.
  refreshAvatarButton()
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
  state.runSeconds = 0
  state.runSubmitted = false
  state.tutorial = null
  stopRunTimer()
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
  document.querySelector('#fragment-count').textContent = t('fragmentCount', { count: collected })
  document.querySelector('#fragments').setAttribute('aria-label', t('fragmentsAriaLabel', { count: collected }))
  fragmentSlots.forEach((slot, index) => slot.classList.toggle('filled', index < collected))
}
// Selene's phase is global state the player changed several screens ago and has to reason about
// before every drop, so it belongs on the HUD rather than only on the moon itself -- which is off
// screen exactly when the answer matters most.
const PHASE_KEYS = { new: 'phaseNew', full: 'phaseFull', waning: 'phaseWaning' }
const updatePhaseHud = () => {
  const phase = loader.moon?.phase
  moonPhaseLabel.hidden = !phase
  moonPhaseLabel.textContent = phase ? t('moonPhase', { phase: t(PHASE_KEYS[phase]) }) : ''
}
const startChapter = (chapter, tutorial = false) => {
  const [spawnX, spawnY] = chapter.spawn ?? [SPAWN_X, SPAWN_Y]
  state.chapter = chapter
  state.frameCollected = false
  state.lensBoxRevealed = false
  state.lensCollected = false
  state.playing = true
  state.ending = false
  state.revealing = false
  state.moonViewing = false
  state.tutorial = tutorial ? { chapterId: chapter.id, step: 0 } : null
  // A fresh Helios entry from chapter select is a new run; continuing on into Selene ("Go on to
  // Selene") keeps the same clock so pausing/backtracking between chapters doesn't reset it.
  if (chapter.id === 'helios') startRunTimer()
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
  document.querySelector('#chapter-name').textContent = `${chapter.number} / ${t(`${chapter.id}.title`).toUpperCase()}`
  hud.dataset.chapter = chapter.id
  document.querySelector('#fragments').hidden = false
  updateFragmentHud()
  updatePhaseHud()
  showSeleneIntro()
  show('')
  refreshTutorial()
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
  const completedTutorial = Boolean(state.tutorial)
  advanceTutorial('exit')
  state.playing = false
  if (completedTutorial) {
    show('tutorial-complete')
    document.querySelector('[data-tutorial-replay]').focus()
    return
  }
  if (state.chapter.id === 'helios') {
    state.unlocked = true
    save('helios-complete')
    updateChapterCards()
    transitionToSelene()
    return
  }
  state.ending = true
  state.runSeconds = elapsedRunSeconds()
  endingNotice.textContent = ''
  submitButton.disabled = false
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
  if (target.dataset.languageEntry !== undefined) { show('language', 'start'); return }
  if (target.dataset.tutorialStart !== undefined) { startChapter(heliosTutorial, true); return }
  if (target.dataset.tutorialSkip !== undefined) { state.tutorial = null; refreshTutorial(); return }
  if (target.dataset.tutorialReplay !== undefined) { startChapter(heliosTutorial, true); return }
  if (target.dataset.tutorialReturn !== undefined) { show('chapters'); return }
  if (target.dataset.continue !== undefined) { startChapter(selene); return }
  // Reachable from #start (menu) and #pause (mid-game); unlike every other data-show target this
  // one must not end the run, so it skips the state.playing reset below.
  if (target.dataset.show === 'language') { show('language'); return }
  if (target.dataset.languageConfirm !== undefined) { show(languageReturnScreen); return }
  if (target.dataset.show !== undefined) { state.playing = false; show(target.dataset.show); return }
  if (target.dataset.chapter) startChapter(chapters.find((chapter) => chapter.id === target.dataset.chapter))
  if (target.dataset.viverse === 'avatar') { connectViverse('avatar'); return }
  if (target.dataset.viverse === 'records') { show('records'); loadRecords(); return }
  if (target.dataset.viverse === 'submit') { submitRun(); return }
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
    if (telescope.raised) advanceTutorial('raise')
  }
  if (event.code === 'KeyE' && !event.repeat && state.playing && !state.revealing) {
    const box = loader.nearestLockbox(player.position)
    const result = box?.interact(player.position)
    if (box) advanceTutorial('lockbox')
    if (result?.opened && box === loader.objects.lockbox) {
      loader.objects.mirrors.forEach((mirror) => mirror.reveal())
      loader.objects.receivers.forEach((receiver) => { receiver.group.visible = true })
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
    advanceTutorial('jump')
  }
  if (event.code === 'Escape' && state.playing) show(document.querySelector('#pause').classList.contains('visible') ? '' : 'pause')
})
addEventListener('keyup', (event) => held.delete(event.code))
addEventListener('pointermove', (event) => aim.move(event.clientX / innerWidth, event.clientY / innerHeight))
addEventListener('pointerdown', (event) => {
  if (!state.playing || state.revealing || !telescope.raised || event.button !== 0) return
  event.preventDefault()
  aim.beginFocus()
  advanceTutorial('focus')
})
addEventListener('pointerup', () => aim.cancelFocus())

const groundedPlatform = () => (player.body.grounded
  ? loader.standingOn(player.position.x, player.body.y - player.body.hh)
  : null)

// --- Helios: route sunlight, then confirm with the scope ---------------------------------------

function heliosTargets(objects) {
  if (state.tutorial) return [...objects.mirrors]
  const targets = [...objects.mirrors]
  if (state.lensCollected && objects.meltBridge && !objects.meltBridge.melted) targets.push(objects.meltBridge)
  if (state.lensCollected && objects.meltBridge?.melted && !objects.exitBridge?.revealed) targets.push(objects.exitBridge)
  return targets
}

function heliosResolve(objects, focusedTarget) {
  if (!state.tutorial) {
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
  }
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
  if (state.chapter.id === 'selene') return telescope.power ? '' : t('onboardingTelescope')
  return telescope.aimUnlocked ? '' : t('onboardingMagnifier')
}

function focusLine(objects) {
  if (!telescope.raised) return ''
  if (state.chapter.id !== 'selene') {
    return loader.nearestMirror(player.position) ? t('focusOnMirror') : t('focusGeneric')
  }
  if (objects.exit?.group.visible) return t('drawDoor')
  if (objects.moon && telescope.power === 'selene' && aim.hovers(objects.moon.position, camera)) return t('turnMoon')
  if (objects.ladderWall?.active && aim.hovers(objects.ladderWall.position, camera)) return t('unfoldLadder')
  if (telescope.power === 'selene' && objects.receivers.some((receiver) => receiver.held && aim.hovers(receiver.position, camera))) return t('turnDial')
  return t('focusGeneric')
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
  if (mirror?.rotate(delta, held.has('KeyE'), player.position)) advanceTutorial('mirror')
  const spotlightOnMirror = telescope.raised
    && objects.mirrors.some((entry) => entry.group.visible && aim.hovers(entry.position, camera))

  const focusedTarget = aim.updateFocus(delta, camera, isSelene ? seleneTargets(objects) : heliosTargets(objects))
  const focusedMirror = objects.mirrors.includes(focusedTarget) ? focusedTarget : null
  // Both resolvers report whether they ended the chapter, so the rest of the frame does not keep
  // simulating a room the player has already walked out of.
  if (isSelene ? seleneResolve(objects, focusedTarget) : heliosResolve(objects, focusedTarget)) return

  const beamResult = loader.updateBeams({
    visible: telescope.aimUnlocked,
    // Selene has no confirm step for its mirrors, so the sight-lines are always drawn once the
    // optical layer is on -- they are the only feedback the pool chain gives.
    showDirections: isSelene ? telescope.power === 'selene' : spotlightOnMirror,
    focusedMirror,
  })
  if (!isSelene && state.tutorial && loader.receiversLatched(['doorway-dot'])) {
    if (objects.exit?.reveal()) {
      refreshLocateExit()
      beginReveal(objects.exit.position)
      advanceTutorial('dot')
    }
  }

  const lockboxPrompt = loader.nearestLockbox(player.position)?.prompt(player.position)
  const mirrorPrompt = mirror?.prompt(player.position)
  const instrument = t(isSelene ? 'telescopeName' : 'magnifierName')
  const telescopePrompt = telescope.raised
    ? t('lowerInstrument', { instrument })
    : telescope.aimUnlocked ? t('raiseInstrument', { instrument }) : ''
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
  if (axis) advanceTutorial('move')
  player.update(delta, axis, loader.getColliders())

  const standing = groundedPlatform()
  // A held phase surface stays solid only while it is still underfoot.
  loader.releaseHeld(standing)

  if (isSelene && standing?.id === 'full-landing' && !state.lensBoxRevealed && objects.lensBox?.reveal()) {
    state.lensBoxRevealed = true
  }

  const activeSpring = player.body.grounded ? loader.springUnder(player.body) : null
  if (activeSpring) player.launchFromSpring()
  if (player.body.grounded) {
    const platform = loader.platformAt(player.position.x, player.body.y - player.body.hh)
    if (platform) checkpoint.update(platform, loader.standingHeight(platform))
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
    advanceTutorial('frame')
  }
  if (objects.triangulation?.collectLens(player.position) && !state.lensCollected) {
    state.lensCollected = true
    if (isSelene) {
      objects.exitTrigger.marker.visible = true
      objects.exitTrigger.active = true
    } else {
      telescope.unlock('helios')
    }
    updateFragmentHud()
    advanceTutorial('lens')
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
function frame() { const delta = Math.min(clock.getDelta(), .05); update(delta); composer.render(); requestAnimationFrame(frame) }
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight) }
addEventListener('resize', resize)
const languageSelect = document.querySelector('#language-select')
languageSelect.value = getLocale()
languageSelect.addEventListener('change', () => { setLocale(languageSelect.value); applyTranslations() })
applyTranslations()
resize(); updateChapterCards(); frame()
// Resumes an avatar-connect or leaderboard-submit that redirected to VIVERSE login and came back.
// Login itself is never triggered on boot -- only an actual pending action left behind by one of
// the two explicit buttons above resumes here.
viverseSession.resumePending().then(async (pending) => {
  if (!pending) return
  if (pending.reason === 'avatar') {
    const profile = await viverseSession.fetchProfile()
    state.viverseName = viverseSession.getDisplayName(profile)
    refreshAvatarButton()
    notice.textContent = t('connectedAs', { name: state.viverseName })
  } else if (pending.reason === 'submit' && typeof pending.runSeconds === 'number') {
    // The ending screen's own state doesn't survive a full-page login redirect, so this submits
    // the score the pending payload carried and reports the outcome on the start screen instead.
    const ok = await viverseSession.submitScore(RECORDS_LEADERBOARD, Math.round(pending.runSeconds))
    notice.textContent = ok ? t('runSubmitted') : t('submitFailed')
  }
}).catch((error) => console.warn('Failed to resume VIVERSE session.', error))
