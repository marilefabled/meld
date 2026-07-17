import * as THREE from 'three'
import { createTimers } from './engine/timer.js'
import { createShake } from './engine/shake.js'
import { createDeck } from './engine/deck.js'
import { createStatBlock, type StatBlock } from './engine/stats.js'
import { createGameState } from './engine/gameState.js'
import { createParticles } from './engine/particles.js'
import { createDebugOverlay } from './engine/debugOverlay.js'
import { createRegistry } from './engine/registry.js'
import { CARD_DATA, TIER_ROMAN, MAX_TIER, makeCard, getVariant, DEFAULT_BUILD, type CardBuild, type CardDef, type GameCard } from './data/cards.js'
import { ENCOUNTERS, moveShape, type EnemyMove, type EnemyTrait, type EnemyDef } from './data/encounters.js'
import { CLASS_CONFIGS, type PlayerClass } from './data/classes.js'
import { buildUnit, setForm, setPlayerForm, setUnitIdentity, setUnitRegalia, updateUnitIdentity, updateUnitRegalia, applyMarks, applyTrophies, parseTrophies, updateEye, eyeNarrow, eyeWiden, isAuthoredUnit, poseUnit, resetUnitPose, CLASS_FORM, TRAIT_FORM, CORE_Y, GLOW, type Unit } from './view/unit.js'
import { arenaForEncounter, createArenaDressing } from './view/arena.js'
import { sfx } from './sfx.js'
import type { Modifier } from './data/modifiers.js'
import { buildIcon, buildStatusIcon, cardArt, type IconShape } from './engine/icons.js'
import { canToggleHold } from './engine/hold.js'
import { bigCardHTML, showCardPreview, hideCardPreview } from './view/cardPreview.js'
import { showRewardScreen, type Reward } from './screens/rewardScreen.js'
import { showRivalOpening } from './screens/rivalDialogue.js'
import { progression } from './data/progression.js'
import { saveCheckpoint, clearCheckpoint } from './data/campaign.js'
import { buildTutorialOpeningDeck, type BattleTutorialConfig } from './data/tutorial.js'
import { candyRivalFor } from './data/rivals.js'

const cards = createRegistry<CardDef>('cards')
cards.loadAll(CARD_DATA)

// ── Game entry ────────────────────────────────────────────────────────────
export type { PlayerClass }
export type { BattleTutorialConfig }

export function startBattle({ playerClass = 'warrior' as PlayerClass, startFrom = 0, startPlayerHP, startRunFragments = 0, build = DEFAULT_BUILD, modifier = null, customDeck, encounters = ENCOUNTERS, isFinale = false, onVictory, onDefeat, isFirstRun = false, tutorial = null, powerLevel = 1, classesIn = [] as PlayerClass[], runNumber = 0 }: { playerClass?: PlayerClass; startFrom?: number; startPlayerHP?: number; startRunFragments?: number; build?: CardBuild; modifier?: Modifier | null; customDeck?: { cardId: string; tier: number }[]; encounters?: EnemyDef[]; isFinale?: boolean; onVictory?: () => void; onDefeat?: () => void; isFirstRun?: boolean; tutorial?: BattleTutorialConfig | null; powerLevel?: number; classesIn?: PlayerClass[]; runNumber?: number } = {}): { dispose: () => void } {
  const classConfig = CLASS_CONFIGS[playerClass]
  // What the player has become: which off-class essences they've absorbed, and how
  // deeply they've strengthened. Drives the visual "marks" grafted onto the form.
  const absorbedForms = classesIn.filter((c, i) => i > 0 && c !== playerClass)
  const playerDepth   = Math.max(0, Math.round((powerLevel - 1) / 0.35))
  // Rings are earned, not free: none on the first run, growing as runs are cleared.
  const campaignRings = Math.min(runNumber, 2)
  const trophyRings   = parseTrophies(progression.state.earnedRings)
  // ── Renderer + scene ───────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  document.body.prepend(renderer.domElement)

  const scene = new THREE.Scene()

  // ── Per-run backdrops — each loop of three has its own mood, and the Mirror
  // (finale) its own. Drives sky, fog, dust, ambient light and the floor rings,
  // so the three runs feel like descending deeper into yourself. ────────────────
  type Backdrop = {
    zenith: [number, number, number]; horizon: [number, number, number]
    fog: number; fogDensity: number; dust: number; ambient: number
    ring1: number; ring2: number; bg: number
  }
  const RUN_THEMES: Backdrop[] = [
    { // Run 1 — the surface: cool indigo twilight, calm and open
      zenith: [0.015, 0.010, 0.060], horizon: [0.075, 0.055, 0.200],
      fog: 0x0e0a22, fogDensity: 0.040, dust: 0x8a9ce0, ambient: 0x4466aa,
      ring1: 0x3b3a96, ring2: 0x5b50c9, bg: 0x02010a },
    { // Run 2 — the deep: warmer plum and amber, turbulent and denser
      zenith: [0.045, 0.014, 0.048], horizon: [0.185, 0.075, 0.110],
      fog: 0x1a0a16, fogDensity: 0.050, dust: 0xd6a86a, ambient: 0x8a5a44,
      ring1: 0x7a2d6d, ring2: 0xb1452f, bg: 0x0a0306 },
    { // Run 3 — the depths: oppressive crimson-violet, hot and close
      zenith: [0.034, 0.005, 0.022], horizon: [0.205, 0.035, 0.120],
      fog: 0x180512, fogDensity: 0.058, dust: 0xff6a8a, ambient: 0x7a3050,
      ring1: 0x8a1d3d, ring2: 0xb01030, bg: 0x08020a },
  ]
  const MIRROR_THEME: Backdrop = { // the Meld — pale luminous violet, the whole self
    zenith: [0.020, 0.012, 0.055], horizon: [0.150, 0.105, 0.270],
    fog: 0x140a26, fogDensity: 0.044, dust: 0xc4b5fd, ambient: 0x6a55b0,
    ring1: 0xa78bfa, ring2: 0x7c3aed, bg: 0x05030f }
  const theme: Backdrop = isFinale ? MIRROR_THEME : (RUN_THEMES[Math.min(Math.max(runNumber, 0), 2)] ?? RUN_THEMES[0])

  scene.background = new THREE.Color(theme.bg)
  scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity)

  // ── Sky dome — themed gradient + a slow drifting nebula (alive, not static) ──
  const skyUniforms = {
    uZenith:  { value: new THREE.Vector3(...theme.zenith) },
    uHorizon: { value: new THREE.Vector3(...theme.horizon) },
    uTime:    { value: 0 },
  }
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(55, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x),
                     mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
        }
        void main() {
          vec3 dir = normalize(vPos);
          float t = clamp(dir.y * 1.3 + 0.12, 0.0, 1.0);
          vec3 base = mix(uHorizon, uZenith, t * t);
          // two layers of slow-drifting noise → a faint living nebula
          vec2 uv = dir.xz / (abs(dir.y) * 0.6 + 0.75);
          float n = noise(uv * 2.0 + vec2(uTime * 0.012, uTime * 0.008))
                  + 0.5 * noise(uv * 4.0 - vec2(uTime * 0.010, uTime * 0.015));
          n = smoothstep(0.75, 1.45, n);
          vec3 col = base + base * n * 1.6 * (0.35 + 0.65 * t);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  )
  skyDome.frustumCulled = false
  scene.add(skyDome)

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100)
  camera.position.set(-0.8, 5.2, 8.5)

  // Camera composition: tweens drive _camBase; each frame the live camera is
  // _camBase + a slow idle drift, then shake on top. Keeps the framing breathing.
  const _camBase = camera.position.clone()
  // Tracked lookAt target — lerped each frame so all tweens go through one path
  const _camLook = new THREE.Vector3(-0.3, 0.8, 0)
  const _lookFinal = _camLook.clone()
  camera.lookAt(_camLook)

  // Camera presets  [pos x,y,z]           [look x,y,z]
  const CP = {
    pIdle: [-0.8,  5.2, 8.5] as const,   pLook: [-0.3, 0.8, 0] as const,
    pAtk:  [-0.2,  4.0, 7.0] as const,   aLook: [ 2.2, 1.5, 0] as const,
    pDef:  [-1.4,  4.8, 7.2] as const,   dLook: [-1.0, 1.2, 0] as const,
    eIdle: [ 0.8,  5.2, 8.5] as const,   eLook: [ 0.3, 0.8, 0] as const,
    eAtk:  [ 0.2,  4.0, 7.0] as const,   hLook: [-2.2, 1.5, 0] as const,
    meld:  [-0.4,  6.4, 9.6] as const,   mLook: [-0.5, 1.2, 0] as const,
  }

  function tweenCam(
    toPos: readonly [number, number, number],
    toLook: readonly [number, number, number],
    dur = 0.45,
  ) {
    const p0 = _camBase.clone()
    const l0 = _camLook.clone()
    const p1 = new THREE.Vector3(...toPos)
    const l1 = new THREE.Vector3(...toLook)
    timer.tween(dur, t => {
      const e = 1 - Math.pow(1 - t, 3)   // ease-out cubic
      _camBase.lerpVectors(p0, p1, e)
      _camLook.lerpVectors(l0, l1, e)
    })
  }

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
  })

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(theme.ambient, 0.6)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xffeedd, 1.8)
  sun.position.set(4, 8, 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 20
  sun.shadow.camera.left = -6; sun.shadow.camera.right = 6
  sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6
  scene.add(sun)

  const rim = new THREE.PointLight(0x6366f1, 2, 15)
  rim.position.set(-3, 4, -2)
  scene.add(rim)

  const warmRim = new THREE.PointLight(0xf97316, 1.2, 12)
  warmRim.position.set(3, 3, 2)
  scene.add(warmRim)

  // ── Arena floor ─────────────────────────────────────────────────────────
  const floorGeo = new THREE.PlaneGeometry(20, 16)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0b16, roughness: 0.97, metalness: 0.0 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const gridPts: THREE.Vector3[] = []
  for (let i = -7; i <= 7; i++)
    gridPts.push(new THREE.Vector3(i, 0.01, -5), new THREE.Vector3(i, 0.01, 5))
  for (let i = -5; i <= 5; i++)
    gridPts.push(new THREE.Vector3(-7, 0.01, i), new THREE.Vector3(7, 0.01, i))
  const gridMat = new THREE.LineBasicMaterial({ color: 0x2a2a4e, transparent: true, opacity: 0.4 })
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPts), gridMat))

  const ringGeo = new THREE.RingGeometry(0.6, 0.85, 48)
  const playerRingMat = new THREE.MeshBasicMaterial({ color: classConfig.accentColor, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  const enemyRingMat  = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  const playerRing = new THREE.Mesh(ringGeo, playerRingMat)
  playerRing.rotation.x = -Math.PI / 2; playerRing.position.set(-2.5, 0.015, 0)
  scene.add(playerRing)
  const enemyRing = new THREE.Mesh(ringGeo, enemyRingMat)
  enemyRing.rotation.x = -Math.PI / 2; enemyRing.position.set(2.5, 0.015, 0)
  scene.add(enemyRing)

  const playerFloorLight = new THREE.PointLight(classConfig.bodyColor, 0.7, 3.5)
  playerFloorLight.position.set(-2.5, 0.1, 0)
  scene.add(playerFloorLight)
  const enemyFloorLight = new THREE.PointLight(0xef4444, 0.7, 3.5)
  enemyFloorLight.position.set(2.5, 0.1, 0)
  scene.add(enemyFloorLight)

  // ── Rocks ───────────────────────────────────────────────────────────────
  const rockMatA = new THREE.MeshStandardMaterial({ color: 0x1c1428, roughness: 0.93, metalness: 0.04 })
  const rockMatB = new THREE.MeshStandardMaterial({ color: 0x271840, roughness: 0.88, metalness: 0.08 })
  const rocks: { mesh: THREE.Mesh; baseY: number; phase: number; bob: number; spin: number }[] = []
  function mkRock(x: number, z: number, s: number, ry: number, mat: THREE.MeshStandardMaterial) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat)
    const baseY = s * 0.5
    m.position.set(x, baseY, z)
    m.rotation.set(0.3, ry, 0.1)
    m.castShadow = true; m.receiveShadow = true
    scene.add(m)
    // dreamlike drift — each shard breathes and tumbles at its own slow pace
    rocks.push({ mesh: m, baseY, phase: ry + x, bob: 0.06 + s * 0.08, spin: (0.04 + s * 0.05) * (x < 0 ? -1 : 1) })
  }
  // back row
  mkRock(-4.8, -4.4, 0.90, 0.3,  rockMatA)
  mkRock(-2.2, -5.0, 0.50, 1.1,  rockMatB)
  mkRock( 0.4, -5.2, 0.70, 0.7,  rockMatA)
  mkRock( 3.2, -4.6, 1.00, 2.1,  rockMatB)
  mkRock( 5.0, -3.9, 0.55, 0.9,  rockMatA)
  // left side
  mkRock(-6.0, -1.5, 0.65, 1.5,  rockMatB)
  mkRock(-5.6,  1.0, 0.40, 0.4,  rockMatA)
  mkRock(-6.3,  2.8, 0.80, 2.3,  rockMatB)
  // right side
  mkRock( 5.8, -1.0, 0.55, 1.2,  rockMatA)
  mkRock( 6.1,  1.5, 0.70, 0.6,  rockMatB)
  mkRock( 5.5,  2.8, 0.42, 1.8,  rockMatA)

  // ── Pillars ─────────────────────────────────────────────────────────────
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x17102a, roughness: 0.92 })
  const pillarLights: THREE.PointLight[] = []
  function mkPillar(x: number, z: number, h: number) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, h, 6), pillarMat)
    shaft.position.set(x, h / 2, z); shaft.castShadow = true
    scene.add(shaft)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.20, 0.40), pillarMat)
    cap.position.set(x, h + 0.10, z)
    scene.add(cap)
    // Each cap is a soft lightpost — run-themed glow that breathes in the frame loop.
    const pl = new THREE.PointLight(theme.ring1, 0.65, 5.5)
    pl.position.set(x, h + 0.4, z)
    scene.add(pl); pillarLights.push(pl)
  }
  mkPillar(-6.0, -5.0, 4.6)
  mkPillar(-3.4, -5.8, 3.9)
  mkPillar( 3.4, -5.8, 3.9)
  mkPillar( 6.0, -5.0, 4.6)

  // ── Arena floor markings ─────────────────────────────────────────────────
  function arenaRing(r1: number, r2: number, opacity: number, color: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide })
    const m = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 72), mat)
    m.rotation.x = -Math.PI / 2; m.position.y = 0.012
    scene.add(m)
    return { mesh: m, mat }
  }
  const aRing1 = arenaRing(4.2, 4.35, 0.30, theme.ring1)
  const aRing2 = arenaRing(1.3, 1.45, 0.22, theme.ring2)

  // ── Ambient drift — slow motes give the void breath. The arena is a mindscape,
  // not a room: a faint, ever-rising field of dust keeps the space alive. ───────
  const DUST_N = 190
  const DBX = 9, DBY0 = 0.2, DBY1 = 7.6, DBZ0 = -6, DBZ1 = 4
  const dustPos   = new Float32Array(DUST_N * 3)
  const dustVel   = new Float32Array(DUST_N * 3)
  const dustPhase = new Float32Array(DUST_N)
  for (let i = 0; i < DUST_N; i++) {
    dustPos[i * 3]     = (Math.random() * 2 - 1) * DBX
    dustPos[i * 3 + 1] = DBY0 + Math.random() * (DBY1 - DBY0)
    dustPos[i * 3 + 2] = DBZ0 + Math.random() * (DBZ1 - DBZ0)
    dustVel[i * 3]     = (Math.random() - 0.5) * 0.1
    dustVel[i * 3 + 1] = 0.07 + Math.random() * 0.16     // slow rise
    dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.07
    dustPhase[i]       = Math.random() * Math.PI * 2
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage))
  const dustMat = new THREE.PointsMaterial({ color: theme.dust, size: 0.05, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false
  scene.add(dust)

  // ── Ground mist — slow wispy haze hugging the floor, themed and drifting. ────
  const mistLayers: { mat: THREE.ShaderMaterial; mesh: THREE.Mesh; spin: number }[] = []
  function makeMist(y: number, size: number, opacity: number, spin: number) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime:    { value: 0 },
        uColor:   { value: new THREE.Color(theme.dust) },
        uOpacity: { value: opacity },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
        void main(){
          float r = distance(vUv, vec2(0.5));
          float fall = smoothstep(0.5, 0.12, r);                       // fade at the rim
          float n = noise(vUv*4.0 + vec2(uTime*0.03, uTime*0.02))
                  + 0.5*noise(vUv*8.0 - vec2(uTime*0.022, uTime*0.028));
          n = smoothstep(0.65, 1.35, n);
          gl_FragColor = vec4(uColor, fall * n * uOpacity);
        }`,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat)
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = y
    mesh.frustumCulled = false
    scene.add(mesh)
    mistLayers.push({ mat, mesh, spin })
  }
  makeMist(0.35, 30, 0.13, 0.012)
  makeMist(0.75, 26, 0.09, -0.008)

  const arenaDressing = createArenaDressing(scene)

  function regaliaForEnemy(def: EnemyDef) {
    const trait = def.traits?.[0]?.kind
    if (trait === 'immune') return 'sealed' as const
    if (trait === 'armored') return 'hard-set' as const
    return 'refilling' as const
  }

  function applyArena(def: EnemyDef) {
    const profile = arenaForEncounter(def, isFinale)
    floorMat.color.setHex(profile.floor)
    gridMat.color.setHex(profile.grid)
    rockMatA.color.setHex(profile.fog)
    rockMatB.color.setHex(profile.grid)
    pillarMat.color.setHex(profile.fog)
    aRing1.mat.color.setHex(profile.ring)
    aRing2.mat.color.setHex(profile.light)
    dustMat.color.setHex(profile.dust)
    for (const mist of mistLayers) mist.mat.uniforms.uColor.value.setHex(profile.dust)
    ;(scene.fog as THREE.FogExp2).color.setHex(profile.fog)
    for (const light of pillarLights) light.color.setHex(profile.light)
    rim.color.setHex(profile.ring)
    warmRim.color.setHex(profile.light)
    arenaDressing.set(profile)
    return profile
  }

  // ── Units ───────────────────────────────────────────────────────────────
  const player = buildUnit(classConfig.bodyColor, classConfig.accentColor)
  setPlayerForm(player, playerClass, absorbedForms, playerDepth, campaignRings, trophyRings)
  setUnitIdentity(player, classConfig.visual)
  setUnitRegalia(player, 'fruit-front', classConfig.accentColor)
  if (isAuthoredUnit(player)) applyMarks(player, absorbedForms, playerDepth)
  player.group.position.set(-2.5, 0, 0)
  player.group.rotation.y = isAuthoredUnit(player) ? 0.62 : Math.PI / 2 - 0.28
  player._eyePhase = 0.2
  scene.add(player.group)

  const enemy = buildUnit(0xef4444, 0xfca5a5)
  enemy.group.position.set(2.5, 0, 0)
  enemy.group.rotation.y = -Math.PI / 2 + 0.28   // faces player (-X), slight 3/4 to camera
  enemy._eyePhase = 0.65
  scene.add(enemy.group)

  // ── Engine systems ──────────────────────────────────────────────────────
  const timer = createTimers()
  const shake = createShake(camera, { maxOffset: 0.15, maxRoll: 0.04, traumaDecay: 1.6 })
  const gameState = createGameState('player_turn')
  const debug = createDebugOverlay(renderer)
  const vfx = createParticles(scene, { max: 400, gravity: new THREE.Vector3(0, -3, 0), drag: 0.4 })

  // ── Stats ────────────────────────────────────────────────────────────────
  const baseHp = classConfig.hp + (modifier?.startingHpBonus ?? 0)
  const playerStats = createStatBlock({
    hp:         { base: baseHp, max: baseHp },
    absorb:     { base: 0, max: 99 },
    vulnerable: { base: 0, max: 10 },
    poison:     { base: 0, max: 20 },
    weak:       { base: 0, max: 10 },
  })
  const enemyStats = createStatBlock({
    hp:         { base: 50, max: 50 },
    absorb:     { base: 0, max: 99 },
    vulnerable: { base: 0, max: 10 },
    poison:     { base: 0, max: 20 },
    weak:       { base: 0, max: 10 },
  })

  const MAX_ENERGY = 3
  let energy = MAX_ENERGY
  let turnCount = 0

  // ── Deck ─────────────────────────────────────────────────────────────────
  const startingDeck = classConfig.deck

  const baseStartingCards = customDeck ?? startingDeck.map(id => ({ cardId: id, tier: 1 }))
  const tutorialActive = !!tutorial?.enabled && startFrom === 0 && !isFinale
  const startingCards = tutorialActive
    ? buildTutorialOpeningDeck(baseStartingCards, tutorial.openingHand)
    : baseStartingCards
  const deck = createDeck<GameCard>(startingCards.map(c => makeCard(c.cardId, c.tier)))
  if (!tutorialActive) deck.shuffle()
  if (modifier?.startWithT2) deck.shelve(makeCard(modifier.startWithT2, 2))

  let runFragments = startRunFragments
  if (startPlayerHP != null && startPlayerHP > 0) playerStats.set('hp', Math.min(startPlayerHP, playerStats.getMax('hp')!))

  const MAX_HOLDS = 2
  const heldIds = new Set<string>()
  let bonusDraw = 0
  let _holdGhosts: HTMLElement[] = []
  let tutorialMeldComplete = !tutorialActive

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const $hand        = document.getElementById('hand')!
  const $energy      = document.getElementById('energy')!
  const $energyPips  = Array.from($energy.querySelectorAll<HTMLDivElement>('.energy-pip'))
  const $apBonus     = document.getElementById('ap-bonus')!
  const $banner      = document.getElementById('banner')!
  const $endTurn     = document.getElementById('end-turn')!
  const $deckInfo    = document.getElementById('deck-info')!
  $deckInfo.innerHTML = '<span>DRAW</span> <span id="deck-draw">0</span> &nbsp; <span>DISC</span> <span id="deck-disc">0</span>'
  const $deckDraw    = document.getElementById('deck-draw')!
  const $deckDisc    = document.getElementById('deck-disc')!
  const $turnCounter = document.getElementById('turn-counter')!
  const $enemyIntent = document.getElementById('enemy-intent')!
  const $intentText  = document.getElementById('intent-text')!
  const $hpPlayer    = document.getElementById('hp-player') as HTMLDivElement
  const $hpPlayerBg  = $hpPlayer.parentElement as HTMLDivElement
  const $hpPlayerText= document.getElementById('hp-player-text')!
  const $hitVignette = document.getElementById('hit-vignette')!
  const $hpEnemy     = document.getElementById('hp-enemy') as HTMLDivElement
  const $hpEnemyText = document.getElementById('hp-enemy-text')!
  const $blockPlayer = document.getElementById('block-player')!
  const $blockEnemy  = document.getElementById('block-enemy')!
  const $gameOver    = document.getElementById('game-over')!
  const $goTitle     = document.getElementById('go-title')!
  const $goSub       = document.getElementById('go-sub')!
  const $goRestart   = document.getElementById('go-restart')!
  const $enemyName     = document.getElementById('enemy-name')!
  const $encounterInfo = document.getElementById('encounter-info')!
  const $statusPlayer  = document.getElementById('status-player')!
  const $statusEnemy   = document.getElementById('status-enemy')!
  const $holdSlots     = document.createElement('div')
  $holdSlots.id = 'hold-slots'
  $holdSlots.setAttribute('aria-label', 'Held card memory slots')
  document.body.appendChild($holdSlots)

  // ── Encounter state ──────────────────────────────────────────────────────
  let ENEMY_MOVES: EnemyMove[] = []
  let encounterIdx = 0
  let enemyNextMove: EnemyMove = encounters[0].moves[0]
  let enemyTraits: EnemyTrait[] = []
  let _firstEncounter = true   // skip the scene-transition fade on the very first encounter
  // ── Intent state ───────────────────────────────────────────────────────────
  let lastMoveName     = ''   // anti-repeat: discourage picking the same move twice
  let enemyHpRef       = 0    // enemy HP at the start of the player's turn
  let lastPlayerDamage = 0    // damage the player dealt during their last turn

  // ── Animation state ──────────────────────────────────────────────────────
  let _animating = false
  const _wp = new THREE.Vector3()
  let _prevPhp = -1, _prevEhp = -1
  let _flashHandle: { cancel(): void } | null = null
  let _tensionZ = 0   // lerps to 0.45 when player HP < 25%, easing the camera forward

  // ── Functions ─────────────────────────────────────────────────────────────

  function worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
    _wp.copy(pos).project(camera)
    return { x: (_wp.x + 1) / 2 * innerWidth, y: (-_wp.y + 1) / 2 * innerHeight }
  }

  function showFloatingNumber(worldPos: THREE.Vector3, text: string, color: string) {
    const { x, y } = worldToScreen(worldPos)
    const val = parseInt(text.replace(/[^0-9]/g, '')) || 0
    const mag = val >= 16 ? 'big' : val >= 8 ? 'medium' : ''
    // Outer wrapper holds the position (centred); inner element runs the pop/float
    // animation, so the two transforms never fight.
    const wrap = document.createElement('div')
    wrap.className = 'dmg-wrap'
    wrap.style.left = `${x + (Math.random() - 0.5) * 26}px`
    wrap.style.top  = `${y - 34}px`
    const el = document.createElement('div')
    el.className = mag ? `dmg-float dmg-float-${mag}` : 'dmg-float'
    el.textContent = text
    el.style.color = color
    wrap.appendChild(el)
    document.body.appendChild(wrap)
    setTimeout(() => wrap.remove(), 1550)
  }

  function updateHUD() {
    const php = playerStats.get('hp'), phMax = playerStats.getMax('hp')!
    const ehp = enemyStats.get('hp'),  ehMax = enemyStats.getMax('hp')!

    if (_prevPhp >= 0 && php < _prevPhp) {
      $hpPlayer.classList.remove('damaged'); void $hpPlayer.offsetWidth; $hpPlayer.classList.add('damaged')
    }
    if (_prevEhp >= 0 && ehp < _prevEhp) {
      $hpEnemy.classList.remove('damaged'); void $hpEnemy.offsetWidth; $hpEnemy.classList.add('damaged')
    }
    _prevPhp = php; _prevEhp = ehp
    $hpPlayerBg.classList.toggle('low-hp', php / phMax < 0.25)

    $hpPlayer.style.width = `${(php / phMax) * 100}%`
    $hpPlayerText.textContent = `${Math.ceil(php)} / ${phMax}`
    $hpEnemy.style.width = `${(ehp / ehMax) * 100}%`
    $hpEnemyText.textContent = `${Math.ceil(ehp)} / ${ehMax}`

    const pb = playerStats.get('absorb'), eb = enemyStats.get('absorb')
    $blockPlayer.textContent = `✦ ${pb}`
    $blockPlayer.classList.toggle('show', pb > 0)
    $blockEnemy.textContent = `✦ ${eb}`
    $blockEnemy.classList.toggle('show', eb > 0)

    for (let i = 0; i < MAX_ENERGY; i++) {
      $energyPips[i].classList.toggle('spent', i >= energy)
    }
    // Out of energy on your turn → nudge the player to end it.
    $endTurn.classList.toggle('ready', energy <= 0 && gameState.is('player_turn') && !_animating)

    $deckDraw.textContent = `${deck.drawPile.length}`
    $deckDisc.textContent = `${deck.discardPile.length}`

    $turnCounter.textContent = `TURN ${turnCount}`

    renderStatuses($statusPlayer, playerStats)
    renderStatuses($statusEnemy, enemyStats)
    renderTraitPills($statusEnemy)
  }

  function renderStatuses(el: HTMLElement, stats: StatBlock) {
    el.innerHTML = ''
    const defs = [
      { key: 'vulnerable', cls: 'vulnerable', icon: buildStatusIcon('vulnerable', 0xdc2626), label: 'VULN' },
      { key: 'poison',     cls: 'poison',     icon: buildStatusIcon('poison',     0x7c3aed), label: 'POIS' },
      { key: 'weak',       cls: 'weak',       icon: buildStatusIcon('weak',       0xca8a04), label: 'WEAK' },
    ]
    for (const d of defs) {
      const n = stats.get(d.key)
      if (n <= 0) continue
      const pill = document.createElement('span')
      pill.className = `status-pill ${d.cls}`
      pill.innerHTML = `${d.icon}${d.label} ${n}`
      el.appendChild(pill)
    }
  }

  function renderTraitPills(el: HTMLElement) {
    const defs: Record<EnemyTrait['kind'], { label: string; cls: string }> = {
      immune:  { label: 'IMMUNE',  cls: 'immune' },
      armored: { label: 'ARMORED', cls: 'armored' },
      regen:   { label: 'REGEN',   cls: 'regen' },
    }
    for (const t of enemyTraits) {
      const d = defs[t.kind]
      const pill = document.createElement('span')
      pill.className = `trait-pill ${d.cls}`
      pill.textContent = d.label
      el.appendChild(pill)
    }
  }

  function flash(text: string, duration = 0.8) {
    _flashHandle?.cancel()
    $banner.textContent = text
    $banner.classList.add('show')
    _flashHandle = timer.after(duration, () => { $banner.classList.remove('show'); _flashHandle = null })
  }

  function setAnimating(v: boolean) {
    _animating = v
    updateEndTurnButton()
  }

  function setGameOverVisible(visible: boolean) {
    $gameOver.classList.toggle('show', visible)
    $gameOver.setAttribute('aria-hidden', String(!visible))
    $gameOver.inert = !visible
    if (visible) requestAnimationFrame(() => $goRestart.focus())
  }

  function isTutorialMeldGate(): boolean {
    return tutorialActive && !tutorialMeldComplete && encounterIdx === 0 && turnCount === 1 && gameState.is('player_turn')
  }

  function endTurnVoice(tutorialGate = isTutorialMeldGate()): string {
    if (tutorialGate) return 'FUSE FIRST'
    if (!gameState.is('player_turn')) return 'SEAL TIGHTENS'
    if (energy > 0) return `BANK ${energy} DRAW${energy > 1 ? 'S' : ''}`
    return 'LET IT ANSWER'
  }

  function updateEndTurnButton(tutorialGate = isTutorialMeldGate()) {
    $endTurn.textContent = endTurnVoice(tutorialGate)
    $endTurn.classList.toggle('disabled', tutorialGate || _animating || !gameState.is('player_turn'))
  }

  function updateHoldSlots(pulse = false) {
    const heldCards = deck.hand.filter(c => heldIds.has(c.id))
    $holdSlots.innerHTML = Array.from({ length: MAX_HOLDS }, (_, i) => {
      const c = heldCards[i]
      if (!c) return `<div class="hold-slot${pulse ? ' pulse' : ''}"><span>EMPTY</span></div>`
      const def = cards.require(c.cardId)
      return `<div class="hold-slot filled${pulse ? ' pulse' : ''}" style="--hc:#${def.color.toString(16).padStart(6, '0')}"><span>${def.name} ${TIER_ROMAN[c.tier]}</span></div>`
    }).join('')
  }

  function traitTell(t: EnemyTrait): { label: string; hint: string; color: number } {
    if (t.kind === 'immune') return { label: 'CANDIED', hint: 'status fails; raw damage sticks', color: 0xc4b5fd }
    if (t.kind === 'armored') return { label: 'HARD-SET', hint: `gains ${t.absorb} rind each turn`, color: 0xfbbf24 }
    return { label: 'REFILLING', hint: `draws ${t.hp} juice each turn`, color: 0x4ade80 }
  }

  function showTraitTell() {
    const t = enemyTraits[0]
    if (!t) return
    const tell = traitTell(t)
    flash(`${tell.label}: ${tell.hint}`, 1.65)
    const pos = enemy.group.position.clone(); pos.y += CORE_Y
    ringFx(pos, tell.color, 0.18, 2.0, 0.8, 0.65, 0.08)
  }

  function intentHint(m: EnemyMove): string {
    const trait = enemyTraits[0]?.kind
    if (trait === 'immune') return 'Candy glaze rejects status. Hit it clean.'
    if (trait === 'armored') return 'Its rind resets before it acts. Poison slips through.'
    if (trait === 'regen') return 'It refills every turn. Burst the seal.'
    if (m.type === 'attack' && m.status?.target === 'player') return `Adds ${m.status.kind}. Block or end it fast.`
    if (m.type === 'attack') return 'Incoming damage. Hold only what you can afford.'
    if (m.type === 'defend') return 'Shield is coming. Set up a bigger meld.'
    return 'It will heal. Punish before the pulse lands.'
  }

  // ── Merge ──────────────────────────────────────────────────────────────

  function findMergeTarget(card: GameCard): GameCard | undefined {
    return deck.hand.find(c => c !== card && c.cardId === card.cardId && c.tier === card.tier)
  }

  function playMeldAnimation(
    el1: HTMLElement, el2: HTMLElement,
    rect1: DOMRect, rect2: DOMRect,
    def: CardDef, toTier: number, cardId: string,
    onDone: () => void,
  ) {
    const cx = (rect1.left + rect2.left) / 2 + rect1.width  / 2
    const cy = (rect1.top  + rect2.top)  / 2 + rect1.height / 2
    const W  = rect1.width

    function ghostOf(src: HTMLElement, rect: DOMRect): HTMLElement {
      const g = src.cloneNode(true) as HTMLElement
      g.querySelectorAll('button').forEach(b => b.remove())
      Object.assign(g.style, {
        position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${W}px`, margin: '0', zIndex: '150',
        pointerEvents: 'none', cursor: 'default', transform: 'none',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.18s',
      })
      document.body.appendChild(g)
      return g
    }

    const g1 = ghostOf(el1, rect1)
    const g2 = ghostOf(el2, rect2)
    const toX1 = cx - (rect1.left + W / 2), toY1 = cy - (rect1.top  + rect1.height / 2)
    const toX2 = cx - (rect2.left + W / 2), toY2 = cy - (rect2.top  + rect2.height / 2)

    // Phase 1 — slam together
    requestAnimationFrame(() => {
      g1.style.transform = `translate(${toX1}px,${toY1}px) scale(0.85)`
      g2.style.transform = `translate(${toX2}px,${toY2}px) scale(0.85)`
    })

    // Phase 2 — impact: overshoot then collapse
    setTimeout(() => {
      g1.style.transition = g2.style.transition = 'transform 0.06s, opacity 0.06s'
      g1.style.transform = `translate(${toX1}px,${toY1}px) scale(1.1)`
      g2.style.transform = `translate(${toX2}px,${toY2}px) scale(1.1)`
      shake.addTrauma(0.32)   // forge slam — felt in the arena behind the cards
      hitStop(0.11)
      const pos = player.group.position.clone(); pos.y += CORE_Y
      impactRing(pos, def.color, 1.35)

      setTimeout(() => {
        // Screen flash
        const flash = document.createElement('div')
        flash.className = 'meld-flash'
        document.body.appendChild(flash)
        setTimeout(() => flash.remove(), 350)

        // Collapse source ghosts
        g1.style.transition = g2.style.transition = 'transform 0.1s, opacity 0.1s'
        g1.style.opacity = g2.style.opacity = '0'
        g1.style.transform = `translate(${toX1}px,${toY1}px) scale(0)`
        g2.style.transform = `translate(${toX2}px,${toY2}px) scale(0)`

        // Build merged card at collision centre — same illustrated layout as the hand.
        const variant   = getVariant(def, toTier, build, cardId)
        const tierClass = toTier > 1 ? ` tier-${toTier}` : ''
        const merged = document.createElement('div')
        merged.className = `card forged${tierClass}`
        merged.style.setProperty('--cc', '#' + def.color.toString(16).padStart(6, '0'))
        merged.innerHTML = `
          <span class="tier-badge t${toTier}">${TIER_ROMAN[toTier]}</span>
          <span class="card-gem">⚡${def.cost}</span>
          <div class="card-art">
            ${cardArt(def.shape, def.color, def.type)}
            <div class="card-glyph">${def.icon}</div>
          </div>
          <div class="name">${variant.name}</div>
          <div class="desc">${variant.desc(variant.value)}</div>
        `
        Object.assign(merged.style, {
          position: 'fixed', left: `${cx - W / 2}px`, top: `${cy - rect1.height / 2}px`,
          width: `${W}px`, margin: '0', zIndex: '151',
          pointerEvents: 'none', cursor: 'default',
          transform: 'scale(0) rotate(-8deg)', opacity: '0', transition: 'none',
        })
        document.body.appendChild(merged)

        // Bounce emerge
        requestAnimationFrame(() => requestAnimationFrame(() => {
          merged.style.transition = 'transform 0.38s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.18s'
          merged.style.transform  = 'scale(1) rotate(0deg)'
          merged.style.opacity    = '1'
        }))

        // Phase 3 — merged card arcs into the deck counter (bottom-left)
        setTimeout(() => {
          const dr  = $deckInfo.getBoundingClientRect()
          const tx  = (dr.left + dr.width  / 2) - cx
          const ty  = (dr.top  + dr.height / 2) - cy
          // Perpendicular offset for the arc: bows upward relative to the flight path
          const len = Math.sqrt(tx * tx + ty * ty) || 1
          const mx  = tx * 0.38 + (-ty / len) * 70
          const my  = ty * 0.38 + ( tx / len) * 70

          merged.style.transition = 'none'
          merged.style.setProperty('--tx', `${tx}px`)
          merged.style.setProperty('--ty', `${ty}px`)
          merged.style.setProperty('--mx', `${mx}px`)
          merged.style.setProperty('--my', `${my}px`)
          merged.style.animation  = 'meldFlyArc 0.52s cubic-bezier(0.4,0,0.6,1) forwards'

          // Pulse the deck counter as the card lands (~80% through the arc)
          setTimeout(() => {
            $deckInfo.classList.remove('ap-pulse')
            void $deckInfo.offsetWidth
            $deckInfo.classList.add('ap-pulse')
          }, 415)

          setTimeout(() => {
            g1.remove(); g2.remove(); merged.remove()
            onDone()
          }, 560)
        }, 430)
      }, 65)
    }, 220)
  }

  function doMerge(card: GameCard) {
    if (_animating || !gameState.is('player_turn')) return
    if (isTutorialMeldGate() && card.cardId !== tutorial?.signatureCard) return
    const target = findMergeTarget(card)
    if (!target || card.tier >= MAX_TIER) return

    const def = cards.require(card.cardId)
    const meldCost = Math.max(0, Math.min(def.cost * 2, MAX_ENERGY) + (modifier?.meldCostDelta ?? 0))
    if (energy < meldCost) return

    // Snapshot card positions before the DOM changes
    const el1   = $hand.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`)
    const el2   = $hand.querySelector<HTMLElement>(`[data-card-id="${target.id}"]`)
    const rect1 = el1?.getBoundingClientRect() ?? null
    const rect2 = el2?.getBoundingClientRect() ?? null

    const newTier = card.tier + 1
    const completedTutorialMeld = isTutorialMeldGate()
    if (completedTutorialMeld) tutorialMeldComplete = true

    energy -= meldCost
    heldIds.delete(card.id)
    heldIds.delete(target.id)
    deck.play(card.id, false)
    deck.play(target.id, false)
    deck.shelve(makeCard(card.cardId, newTier))

    sfx.meld()
    tweenCam(CP.meld, CP.mLook, 0.35)
    timer.after(0.9, () => tweenCam(CP.pIdle, CP.pLook, 0.5))
    const pos = player.group.position.clone()
    pos.y += 2.4
    vfx.burst(pos, 24, { speed: 2.0, spread: 0.9, up: 1.4, life: 0.7, size: 0.15, color: 0xf59e0b })

    runFragments += 5
    progression.addFragments(5)
    if (deck.drawPile.length === 0) { animateReshuffle(); deck.reshuffle() }
    const meldDraw = 1 + (modifier?.meldDrawBonus ?? 0)
    deck.draw(Math.min(meldDraw, deck.drawPile.length))

    if (el1 && el2 && rect1 && rect2) {
      setAnimating(true)
      $hand.innerHTML = ''
      playMeldAnimation(el1, el2, rect1, rect2, def, newTier, card.cardId, () => {
        setAnimating(false)
        renderHand(true)
        timer.after(0.15, () => flash(
          completedTutorialMeld
            ? `${def.name.toUpperCase()} ${TIER_ROMAN[newTier]} MADE · BIGGER CARD, SAME WOUND`
            : `${def.name.toUpperCase()} ${TIER_ROMAN[newTier]} MADE`,
          completedTutorialMeld ? 2.0 : 1.0,
        ))
      })
    } else {
      renderHand(true)
      flash(`${def.name.toUpperCase()} ${TIER_ROMAN[newTier]} MADE`, 1.0)
    }
  }

  function toggleHold(card: GameCard) {
    if (!canToggleHold({
      isAnimating: _animating,
      isHeld: heldIds.has(card.id),
      isPlayerTurn: gameState.is('player_turn'),
      isTutorialLocked: isTutorialMeldGate(),
      heldCount: heldIds.size,
      maxHolds: MAX_HOLDS,
    })) return

    let held = false
    if (heldIds.has(card.id)) heldIds.delete(card.id)
    else if (heldIds.size < MAX_HOLDS) { heldIds.add(card.id); held = true }
    else return
    const def = cards.require(card.cardId)
    flash(held ? `${def.name.toUpperCase()} HELD IN MEMORY` : `${def.name.toUpperCase()} RELEASED`, 0.8)
    renderHand()
    updateHoldSlots(true)
  }

  // ── Hold animations ────────────────────────────────────────────────────

  function clearHoldGhosts() {
    _holdGhosts.forEach(g => g.remove())
    _holdGhosts = []
  }

  // Called just before $hand is cleared on end-turn.
  // Held card ghosts float up and stay visible during the enemy turn.
  // Non-held card ghosts fly off downward.
  function animateHoldEndTurn() {
    const cards = [...$hand.querySelectorAll<HTMLElement>('.card')]
    if (cards.length === 0) return

    for (const el of cards) {
      const isHeld = heldIds.has(el.dataset.cardId ?? '')
      const rect   = el.getBoundingClientRect()

      const ghost = el.cloneNode(true) as HTMLElement
      ghost.querySelectorAll('button').forEach(b => b.remove())
      Object.assign(ghost.style, {
        position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, margin: '0',
        pointerEvents: 'none', cursor: 'default', zIndex: '50',
        transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1), opacity 0.22s',
      })
      document.body.appendChild(ghost)

      if (isHeld) {
        _holdGhosts.push(ghost)
        requestAnimationFrame(() => {
          ghost.style.transform = 'translateY(-90px)'
          ghost.style.boxShadow = '0 0 22px rgba(167,139,250,.75), 0 0 6px rgba(167,139,250,.4)'
        })
      } else {
        requestAnimationFrame(() => {
          ghost.style.transform = 'translateY(52px)'
          ghost.style.opacity   = '0'
        })
        setTimeout(() => ghost.remove(), 300)
      }
    }
  }

  // Called at start of new player turn.
  // Held ghosts drift back down to their original position and fade out
  // just as renderHand(true) brings the real cards in underneath.
  function animateHoldReturn(onDone: () => void) {
    if (_holdGhosts.length === 0) { onDone(); return }

    for (const g of _holdGhosts) {
      // drift back in 280ms; fade starts at 220ms so the card is nearly home before disappearing
      g.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.15s 0.22s'
      g.style.transform  = 'translateY(0px)'
      g.style.opacity    = '0'
    }
    setTimeout(() => {
      clearHoldGhosts()
      onDone()
    }, 400)
  }

  // When END TURN fires with unused AP: each unspent pip spawns a ⚡ that
  // flies to the deck-info area, teaching AP → bonus draw conversion.
  function animateApDraw(unusedEnergy: number) {
    const deckRect = $deckInfo.getBoundingClientRect()
    const landX = deckRect.left + 14
    const landY = deckRect.top  + deckRect.height / 2

    for (let i = 0; i < unusedEnergy; i++) {
      const pip = $energyPips[i]
      if (!pip) continue
      const pr    = pip.getBoundingClientRect()
      const delay = i * 65

      const el = document.createElement('div')
      el.textContent = '⚡'
      Object.assign(el.style, {
        position:    'fixed',
        left:        `${pr.left + pr.width  / 2 - 6}px`,
        top:         `${pr.top  + pr.height / 2 - 6}px`,
        width:       '12px', height: '12px',
        fontSize:    '10px', color: '#6ee7b7',
        lineHeight:  '12px', textAlign: 'center',
        fontWeight:  'bold',
        pointerEvents: 'none', zIndex: '60',
        transition: `left 0.3s ease-in ${delay}ms, top 0.3s ease-in ${delay}ms, opacity 0.1s ${delay + 250}ms`,
      })
      document.body.appendChild(el)

      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.left    = `${landX}px`
        el.style.top     = `${landY}px`
        el.style.opacity = '0'
      }))

      if (i === unusedEnergy - 1) {
        setTimeout(() => {
          $deckInfo.classList.remove('ap-pulse')
          void $deckInfo.offsetWidth
          $deckInfo.classList.add('ap-pulse')
        }, delay + 320)
      }

      setTimeout(() => el.remove(), delay + 500)
    }
  }

  // A ↺ sweeps from DISC count to DRAW count; DRAW flashes purple on arrival.
  function animateReshuffle() {
    const discRect = $deckDisc.getBoundingClientRect()
    const drawRect = $deckDraw.getBoundingClientRect()

    const el = document.createElement('div')
    el.textContent = '↺'
    Object.assign(el.style, {
      position: 'fixed',
      left:    `${discRect.left + discRect.width  / 2 - 7}px`,
      top:     `${discRect.top  + discRect.height / 2 - 8}px`,
      fontSize: '13px', color: '#a78bfa',
      pointerEvents: 'none', zIndex: '60',
      transform: 'rotate(0deg)',
      transition: 'left 0.3s ease-out, top 0.3s ease-out, transform 0.3s ease-out, opacity 0.12s 0.26s',
    })
    document.body.appendChild(el)

    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.left      = `${drawRect.left + drawRect.width  / 2 - 7}px`
      el.style.top       = `${drawRect.top  + drawRect.height / 2 - 8}px`
      el.style.transform = 'rotate(-360deg)'
      el.style.opacity   = '0'
    }))

    setTimeout(() => {
      $deckDraw.style.transition = 'color 0.1s'
      $deckDraw.style.color = '#a78bfa'
      setTimeout(() => { $deckDraw.style.color = ''; $deckDraw.style.transition = '' }, 380)
      el.remove()
    }, 390)
  }

  // ── Render hand ────────────────────────────────────────────────────────

  function renderHand(deal = false) {
    hideCardPreview()
    $hand.innerHTML = ''
    const isPlayerTurn = gameState.is('player_turn')
    const tutorialGate = isTutorialMeldGate()

    let dealIdx = 0
    for (const card of deck.hand) {
      const def     = cards.require(card.cardId)
      const variant = getVariant(def, card.tier, build, card.cardId)
      const val     = Math.round(variant.value * powerLevel)
      const isHeld    = heldIds.has(card.id)
      const hasMerge  = card.tier < MAX_TIER && !!findMergeTarget(card)
      const tutorialTarget = tutorialGate && card.cardId === tutorial?.signatureCard && hasMerge
      const canToggleThisHold = canToggleHold({
        isAnimating: _animating,
        isHeld,
        isPlayerTurn,
        isTutorialLocked: tutorialGate,
        heldCount: heldIds.size,
        maxHolds: MAX_HOLDS,
      })
      const tierClass = card.tier > 1 ? ` tier-${card.tier}` : ''
      const mergeClass = hasMerge ? ' mergeable' : ''
      const heldClass  = isHeld ? ' held' : ''
      const tutorialClass = tutorialGate ? (tutorialTarget ? ' tutorial-target' : ' tutorial-locked') : ''
      const baseDisabled = !isPlayerTurn || energy < def.cost || _animating
      const playDisabled = baseDisabled || tutorialGate
      const visualDisabled = baseDisabled || (tutorialGate && !tutorialTarget)

      const el = document.createElement('div')
      el.className = 'card' + tierClass + mergeClass + heldClass + tutorialClass
        + (visualDisabled ? ' disabled' : '')
        + (canToggleThisHold ? ' hold-ready' : '')
      el.dataset.cardId = card.id
      el.style.setProperty('--cc', '#' + def.color.toString(16).padStart(6, '0'))
      if (deal) {
        el.style.animation = `cardDeal 0.22s ease-out ${dealIdx * 0.06}s both`
        dealIdx++
      }

      el.innerHTML = `
        ${isHeld ? '<span class="hold-badge">HELD</span>' : ''}
        <span class="tier-badge t${card.tier}">${TIER_ROMAN[card.tier]}</span>
        <span class="card-gem">⚡${def.cost}</span>
        <div class="card-art">
          ${cardArt(def.shape, def.color, def.type)}
          <div class="card-glyph">${def.icon}</div>
        </div>
        <div class="name">${variant.name}</div>
        <div class="desc">${variant.desc(val)}</div>
      `

      if (isPlayerTurn && !_animating) {
        if (hasMerge) {
          const meldCost = Math.max(0, Math.min(def.cost * 2, MAX_ENERGY) + (modifier?.meldCostDelta ?? 0))
          const canAfford = energy >= meldCost && (!tutorialGate || tutorialTarget)
          const btn = document.createElement('button')
          btn.className = 'merge-btn'
          btn.textContent = tutorialTarget ? `FUSE FIRST (${meldCost}⚡)` : `⬆ MELD (${meldCost}⚡)`
          btn.disabled = !canAfford
          btn.addEventListener('click', e => { e.stopPropagation(); doMerge(card) })
          el.appendChild(btn)
        }
        if (canToggleThisHold) {
          const hbtn = document.createElement('button')
          hbtn.className = 'hold-btn'
          hbtn.textContent = isHeld ? '📌 RELEASE' : '📌 HOLD'
          hbtn.addEventListener('click', e => { e.stopPropagation(); toggleHold(card) })
          el.appendChild(hbtn)
        }
      }

      el.addEventListener('click', () => { if (!playDisabled) playCard(card) })
      el.addEventListener('mouseenter', () => showCardPreview(bigCardHTML(def, variant.name, variant.desc(val), TIER_ROMAN[card.tier]), el.getBoundingClientRect()))
      el.addEventListener('mouseleave', hideCardPreview)
      $hand.appendChild(el)
    }

    if (isPlayerTurn && energy > 0) {
      $apBonus.textContent = tutorialGate
        ? 'First, meld the matching pair. The rest can wait.'
        : `⚡${energy} left → +${energy} card${energy > 1 ? 's' : ''} next turn`
      $apBonus.classList.add('show')
    } else {
      $apBonus.classList.remove('show')
    }

    updateHUD()
    updateHoldSlots()
    updateEndTurnButton(tutorialGate)
  }

  // ── Animations ──────────────────────────────────────────────────────────

  // ── Impact juice — a brief hit-stop freeze + an expanding additive shock ring ─
  let _hitStop = 0
  function hitStop(sec: number) { _hitStop = Math.max(_hitStop, sec) }

  const _ringGeo  = new THREE.RingGeometry(0.46, 0.62, 36)
  const _flashGeo = new THREE.SphereGeometry(0.5, 12, 10)
  function impactRing(pos: THREE.Vector3, color: number, scale = 1) {
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const ring = new THREE.Mesh(_ringGeo, ringMat)
    ring.position.copy(pos); ring.lookAt(camera.position); ring.scale.setScalar(0.35 * scale)
    scene.add(ring)
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    const flash = new THREE.Mesh(_flashGeo, flashMat)
    flash.position.copy(pos); flash.scale.setScalar(0.55 * scale)
    scene.add(flash)
    timer.tween(0.32, p => {
      ring.scale.setScalar((0.35 + p * 2.5) * scale); ringMat.opacity = 0.9 * (1 - p)
      flashMat.opacity = 0.85 * Math.max(0, 1 - p * 3); flash.scale.setScalar((0.55 + p * 0.5) * scale)
    }, { onComplete: () => { scene.remove(ring); scene.remove(flash); ringMat.dispose(); flashMat.dispose() } })
  }

  // A flat billboarded ring that scales from→to while fading — shield snaps inward,
  // heal blooms outward, etc.
  function ringFx(pos: THREE.Vector3, color: number, from: number, to: number, dur: number, opacity = 0.8, rise = 0) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const ring = new THREE.Mesh(_ringGeo, mat)
    ring.position.copy(pos); ring.lookAt(camera.position); ring.scale.setScalar(from)
    scene.add(ring)
    timer.tween(dur, p => {
      ring.scale.setScalar(from + (to - from) * p)
      ring.position.y = pos.y + rise * p
      mat.opacity = opacity * (1 - p)
    }, { onComplete: () => { scene.remove(ring); mat.dispose() } })
  }

  // ── Reclaim — a beaten fragment doesn't scatter; it streams back INTO you. ────
  // The form cracks bright and implodes; its essence spirals across the arena and
  // is pulled into the player core, which flares in the fragment's own colour.
  // (Makes the premise legible without a word: you just pulled a piece of yourself
  //  back in.) Bespoke — the shared particle pool flies straight, can't home.
  function reclaimDeath(from: Unit, color: number) {
    const src = from.group.position.clone();   src.y += CORE_Y
    const dst = player.group.position.clone(); dst.y += CORE_Y
    const TAU = Math.PI * 2

    // 1) Streaming essence — one spiralling Points cloud, fragment → you.
    const N = 84
    const pos = new Float32Array(N * 3)
    const r0 = new Float32Array(N), a0 = new Float32Array(N), h0 = new Float32Array(N)
    const sp = new Float32Array(N), ph = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      r0[i] = 0.25 + Math.random() * 0.9
      a0[i] = Math.random() * TAU
      h0[i] = (Math.random() - 0.5) * 1.5
      sp[i] = (1.4 + Math.random() * 2.4) * (Math.random() < 0.5 ? -1 : 1)
      ph[i] = Math.random()   // staggered departure, so the stream has a tail
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    const mat = new THREE.PointsMaterial({ color, size: 0.17, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
    timer.tween(0.6, p => {
      for (let i = 0; i < N; i++) {
        let q = (p - ph[i] * 0.34) / (1 - ph[i] * 0.34)
        q = q < 0 ? 0 : q > 1 ? 1 : q
        const e   = q * q                          // accelerate inward
        const ax  = src.x + (dst.x - src.x) * e
        const ay  = src.y + (dst.y - src.y) * e
        const az  = src.z + (dst.z - src.z) * e
        const rad = r0[i] * (1 - q)                // collapse onto the travelling anchor
        const ang = a0[i] + sp[i] * q * TAU
        pos[i * 3]     = ax + Math.cos(ang) * rad
        pos[i * 3 + 1] = ay + h0[i] * (1 - q)
        pos[i * 3 + 2] = az + Math.sin(ang) * rad
      }
      geo.attributes.position.needsUpdate = true
      mat.opacity = 0.95 * (1 - p * p * 0.35)
    }, { onComplete: () => { scene.remove(pts); geo.dispose(); mat.dispose() } })

    // 2) The fragment cracks white, then implodes (accelerating collapse + spin).
    const fmat = from.bodyMat
    const baseScale = from.group.scale.x
    const baseRotY  = from.group.rotation.y
    fmat.emissive.setHex(0xffffff); fmat.emissiveIntensity = 2.6
    vfx.burst(src, 18, { speed: 0.7, spread: 0.5, up: 0.25, life: 0.3, size: 0.12, color: 0xffffff })
    timer.tween(0.44, p => {
      const e = p * p
      from.group.scale.setScalar(baseScale * (1 - e))
      from.group.rotation.y = baseRotY + e * 3.2
      fmat.emissiveIntensity = 2.6 * (1 - p) + GLOW
    }, { onComplete: () => { from.group.scale.setScalar(0); from.group.rotation.y = baseRotY } })

    // 3) Arrival — the player core drinks it in: flare in the fragment's colour,
    //    an absorb shock ring, a small pop, a kick of shake, the eye flying wide.
    timer.after(0.4, () => {
      const pmat = player.bodyMat
      const baseG = player.group.scale.x
      eyeWiden(player)
      shake.addTrauma(0.34)
      ringFx(dst, color, 0.3, 2.1, 0.42, 0.85)
      vfx.burst(dst, 24, { speed: 1.7, spread: 0.95, up: 0.5, life: 0.45, size: 0.13, color })
      vfx.burst(dst, 10, { speed: 2.3, spread: 0.4, up: 0.3, life: 0.26, size: 0.1, color: 0xffffff })
      pmat.emissive.setHex(color)
      timer.tween(0.52, p => {
        pmat.emissiveIntensity = 2.0 * (1 - p) + GLOW
        player.group.scale.setScalar(baseG * (1 + Math.sin(Math.min(1, p * 1.4) * Math.PI) * 0.1))
      }, { onComplete: () => { pmat.emissive.setHex(pmat.color.getHex()); pmat.emissiveIntensity = GLOW; player.group.scale.setScalar(baseG) } })
    })
  }

  function animStrike(unit: Unit, targetPos: THREE.Vector3, color: number, onHit: () => void) {
    const startX = unit.group.position.x
    const dir = Math.sign(targetPos.x - startX)
    eyeNarrow(unit)   // focused glare on the lunge
    const mat = unit.body.material
    // Ring B expands on windup, the core charges in the card's colour, then lunges
    timer.tween(0.09, p => {
      poseUnit(unit, 'windup', p, dir)
      unit.group.position.x = startX - dir * 0.28 * p
      unit.armR.scale.setScalar(1 + p * 0.45)
      unit.body.rotation.z = -dir * 0.12 * p
      mat.emissive.setHex(color); mat.emissiveIntensity = GLOW + p * 1.3
    }, {
      onComplete: () => {
        const cpos = unit.group.position.clone(); cpos.y += CORE_Y
        vfx.burst(cpos, 8, { speed: 1.8, spread: 0.5, up: 0.4, life: 0.3, size: 0.1, color })   // cast spark
        timer.tween(0.12, p => {
          poseUnit(unit, 'attack', p, dir)
          unit.group.position.x = startX - dir * 0.28 + dir * 1.72 * p
          unit.armR.scale.setScalar(1.45 - p * 0.45)
          unit.body.rotation.z = -dir * 0.12 * (1 - p)
        }, {
          onComplete: () => {
            onHit()
            const peakX = startX + dir * 1.44
            timer.tween(0.22, p => {
              poseUnit(unit, 'recover', p, dir)
              unit.group.position.x = peakX + (startX - peakX) * p
              mat.emissiveIntensity = (GLOW + 1.3) * (1 - p) + GLOW * p
            }, { onComplete: () => { resetUnitPose(unit); mat.emissive.setHex(mat.color.getHex()); mat.emissiveIntensity = GLOW } })
          }
        })
      }
    })
  }

  function animFireball(unit: Unit, targetPos: THREE.Vector3, color: number, onHit: () => void) {
    const dir = Math.sign(targetPos.x - unit.group.position.x)
    eyeNarrow(unit)   // focused glare while charging
    const mat = unit.body.material
    // Both rings flare outward, the core gathers energy in the card's colour
    timer.tween(0.18, p => {
      poseUnit(unit, 'cast', p, dir)
      unit.armL.scale.setScalar(1 + p * 0.5)
      unit.armR.scale.setScalar(1 + p * 0.5)
      unit.body.position.y = CORE_Y + p * 0.18
      unit.body.rotation.z = -dir * p * 0.1
      mat.emissive.setHex(color); mat.emissiveIntensity = GLOW + p * 2.0
    }, {
      onComplete: () => {
        const origin = unit.group.position.clone(); origin.y += 1.6
        const proj = origin.clone()
        const travelTime = targetPos.distanceTo(origin) / 20
        timer.tween(travelTime, p => {
          proj.lerpVectors(origin, targetPos, p)
          proj.y += Math.sin(p * Math.PI) * 1.5   // arcs up then down
          vfx.burst(proj, 5, { speed: 0.55, spread: 0.4, up: 0.15, life: 0.34, size: 0.16, color })   // themed comet trail
        }, { onComplete: () => { onHit() } })
        timer.tween(0.14, p => {
          poseUnit(unit, 'recover', p, dir)
          unit.armL.scale.setScalar(1.5 - p * 0.5)
          unit.armR.scale.setScalar(1.5 - p * 0.5)
          unit.body.position.y = CORE_Y + 0.18 - p * 0.18
          unit.body.rotation.z = -dir * 0.1 * (1 - p)
          mat.emissiveIntensity = (GLOW + 2.0) * (1 - p) + GLOW * p
        }, { onComplete: () => { resetUnitPose(unit); mat.emissive.setHex(mat.color.getHex()); mat.emissiveIntensity = GLOW } })
      }
    })
  }

  // Rupture — sharp charge, then an instant jagged lightning bolt with a fork.
  function animOverload(unit: Unit, targetPos: THREE.Vector3, color: number, onHit: () => void) {
    eyeNarrow(unit)
    const mat = unit.body.material
    const origin = unit.group.position.clone(); origin.y += 1.5
    timer.tween(0.12, p => {
      poseUnit(unit, 'cast', p, Math.sign(targetPos.x - unit.group.position.x))
      mat.emissive.setHex(color); mat.emissiveIntensity = GLOW + p * 2.6
      unit.armL.scale.setScalar(1 + p * 0.3); unit.armR.scale.setScalar(1 + p * 0.3)
    }, {
      onComplete: () => {
        const seg = 8, jag = new THREE.Vector3()
        for (let i = 1; i <= seg; i++) {
          const t = i / seg
          jag.lerpVectors(origin, targetPos, t)
          jag.x += (Math.random() - 0.5) * 0.6; jag.y += (Math.random() - 0.5) * 0.8; jag.z += (Math.random() - 0.5) * 0.4
          const at = jag.clone()
          timer.after(i * 0.01, () => vfx.burst(at, 5, { speed: 0.7, spread: 0.3, up: 0.1, life: 0.26, size: 0.13, color }))
        }
        const fork = origin.clone().lerp(targetPos, 0.55); fork.y += 0.7
        timer.after(0.05, () => vfx.burst(fork, 6, { speed: 1.5, spread: 0.5, up: 0.6, life: 0.3, size: 0.1, color }))
        timer.after(0.1, onHit)
        timer.tween(0.18, p => {
          poseUnit(unit, 'recover', p)
          mat.emissiveIntensity = (GLOW + 2.6) * (1 - p) + GLOW * p
          unit.armL.scale.setScalar(1.3 - p * 0.3); unit.armR.scale.setScalar(1.3 - p * 0.3)
        }, { onComplete: () => { resetUnitPose(unit); mat.emissive.setHex(mat.color.getHex()); mat.emissiveIntensity = GLOW } })
      }
    })
  }

  // Needle — a fast forward dash with a whirling ring, then a crescent of sparks.
  function animSlash(unit: Unit, targetPos: THREE.Vector3, color: number, onHit: () => void) {
    const startX = unit.group.position.x
    const dir = Math.sign(targetPos.x - startX)
    eyeNarrow(unit)
    const mat = unit.body.material
    timer.tween(0.14, p => {
      poseUnit(unit, 'attack', p, dir)
      unit.group.position.x = startX + dir * 1.7 * p
      unit.armR.rotation.z = p * 7
      mat.emissive.setHex(color); mat.emissiveIntensity = GLOW + Math.sin(p * Math.PI) * 1.5
    }, {
      onComplete: () => {
        onHit()
        const n = 14
        for (let i = 0; i < n; i++) {
          const a = -1.0 + (i / (n - 1)) * 2.0
          const off = new THREE.Vector3(Math.cos(a) * 0.25 * dir, Math.sin(a) * 1.0, 0)
          vfx.burst(targetPos.clone().add(off), 2, { speed: 0.8, spread: 0.15, up: 0.1, life: 0.3, size: 0.12, color })
        }
        const peakX = startX + dir * 1.7
        timer.tween(0.22, p => {
          poseUnit(unit, 'recover', p, dir)
          unit.group.position.x = peakX + (startX - peakX) * p
          mat.emissiveIntensity = (GLOW + 1.5) * (1 - p) + GLOW * p
        }, { onComplete: () => { resetUnitPose(unit); unit.armR.rotation.z = 0; mat.emissive.setHex(mat.color.getHex()); mat.emissiveIntensity = GLOW } })
      }
    })
  }

  function animBlock(unit: Unit, color: number, onDone: () => void) {
    const mat = unit.body.material
    // Rings contract inward (held aspects pulled close = defensive)
    timer.tween(0.12, p => {
      poseUnit(unit, 'block', p)
      unit.group.position.y = -p * 0.3
      unit.armL.scale.setScalar(1 - p * 0.35)
      unit.armR.scale.setScalar(1 - p * 0.35)
      mat.emissive.setHex(color); mat.emissiveIntensity = GLOW + p * 0.8
    }, {
      onComplete: () => {
        const pos = unit.group.position.clone(); pos.y += 1.2
        // shield snaps into place — a ring contracts onto the form + a sealing pulse
        ringFx(pos, color, 2.3, 0.95, 0.26, 0.9)
        ringFx(pos, color, 0.9, 1.5, 0.34, 0.5)
        vfx.burst(pos, 22, { speed: 1.6, spread: 1.2, up: 0.4, life: 0.5, size: 0.13, color })
        shake.addTrauma(0.12)
        onDone()
        timer.tween(0.18, p => {
          poseUnit(unit, 'recover', p)
          unit.group.position.y = -0.3 * (1 - p)
          unit.armL.scale.setScalar(0.65 + p * 0.35)
          unit.armR.scale.setScalar(0.65 + p * 0.35)
          mat.emissiveIntensity = (GLOW + 0.8) * (1 - p) + GLOW * p
        }, { onComplete: () => { resetUnitPose(unit); mat.emissive.setHex(mat.color.getHex()); mat.emissiveIntensity = GLOW } })
      }
    })
  }

  function animHeal(unit: Unit, onDone: () => void) {
    const base = unit.group.position.clone()
    // soft bloom rings rising from the feet
    const feet = base.clone(); feet.y += 0.2
    ringFx(feet, 0x22c55e, 0.4, 2.6, 0.6, 0.55, 0.9)
    timer.after(0.14, () => ringFx(feet, 0x4ade80, 0.4, 2.0, 0.55, 0.45, 1.0))
    const _sp = new THREE.Vector3()
    let elapsed = 0
    const stream = timer.every(0.04, () => {
      elapsed += 0.04
      _sp.copy(base)
      _sp.y += 0.5 + elapsed * 1.5
      _sp.x += (Math.random() - 0.5) * 0.8
      _sp.z += (Math.random() - 0.5) * 0.8
      vfx.burst(_sp, 2, { speed: 0.3, spread: 0.2, up: 1.5, life: 0.45, size: 0.1, color: 0x22c55e })
    })
    // Rings spread wide, core pulses green
    timer.tween(0.32, p => {
      poseUnit(unit, 'heal', p)
      unit.body.position.y = CORE_Y + Math.sin(p * Math.PI) * 0.2
      unit.body.material.emissive.setHex(0x22c55e)
      unit.body.material.emissiveIntensity = Math.sin(p * Math.PI) * 1.5
      unit.armL.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.45)
      unit.armR.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.35)
    }, {
      onComplete: () => {
        resetUnitPose(unit)
        stream.cancel()
        unit.body.material.emissive.setHex(unit.bodyMat.color.getHex())
        unit.body.material.emissiveIntensity = GLOW
        unit.armL.scale.setScalar(1)
        unit.armR.scale.setScalar(1)
        onDone()
      }
    })
  }

  function animHit(unit: Unit) {
    const mat = unit.body.material
    eyeWiden(unit)   // shock — eye flies open on impact
    // Core squashes on impact (elastic collision feel), flashes red
    mat.emissive.setHex(0xff2200); mat.emissiveIntensity = 2.5
    // Core squashes relative to the form's resting stretch (so the wisp/blade
    // keep their elongated shape after a hit instead of snapping to a sphere)
    const b = unit._bodyScale
    unit.body.scale.set(b.x * 1.38, b.y * 0.62, b.z * 1.38)
    // Rings scatter outward on impact
    unit.armL.scale.setScalar(1.5)
    unit.armR.scale.setScalar(1.4)
    timer.tween(0.28, p => {
      poseUnit(unit, 'hit', p)
      mat.emissiveIntensity = 2.5 * (1 - p) + GLOW * p
      const s = 1 - p   // eases from squash back to normal
      unit.body.scale.set(b.x * (1 + s * 0.38), b.y * (1 - s * 0.38), b.z * (1 + s * 0.38))
      unit.armL.scale.setScalar(1.5 - p * 0.5)
      unit.armR.scale.setScalar(1.4 - p * 0.4)
    }, {
      onComplete: () => {
        resetUnitPose(unit)
        mat.emissiveIntensity = GLOW; unit.body.scale.copy(b)
        unit.armL.scale.setScalar(1); unit.armR.scale.setScalar(1)
      }
    })
    const x0 = unit.group.position.x
    const dir = Math.sign(x0)
    timer.tween(0.07, p => {
      unit.group.position.x = x0 + dir * 0.32 * p
      unit.body.rotation.z  = dir * 0.18 * p
    }, {
      onComplete: () => {
        timer.tween(0.2, p => {
          unit.group.position.x = x0 + dir * 0.32 * (1 - p)
          unit.body.rotation.z  = dir * 0.18 * (1 - p)
        })
      }
    })
  }

  // ── Damage resolution ────────────────────────────────────────────────────

  function dealDamage(target: StatBlock, amount: number, worldPos?: THREE.Vector3, opts?: { ignoreAbsorb?: boolean }): number {
    if (target.get('vulnerable') > 0) amount = Math.ceil(amount * 1.5)
    const ab = opts?.ignoreAbsorb ? 0 : target.get('absorb')
    let absorbed = 0
    if (ab > 0) {
      absorbed = Math.min(ab, amount)
      target.modify('absorb', -absorbed)
      amount -= absorbed
    }
    if (absorbed > 0 && worldPos) {
      const bpos = worldPos.clone(); bpos.y += 0.4
      showFloatingNumber(bpos, `✦+${absorbed}`, '#818cf8')
      const $shield = target === playerStats ? $blockPlayer : $blockEnemy
      $shield.classList.remove('absorb-hit')
      void $shield.offsetWidth
      $shield.classList.add('absorb-hit')
      setTimeout(() => $shield.classList.remove('absorb-hit'), 450)
    }
    if (amount > 0) {
      target.modify('hp', -amount)
      if (worldPos) showFloatingNumber(worldPos, `-${amount}`, '#f87171')
    }
    return amount
  }

  function dealHeal(target: StatBlock, amount: number, worldPos?: THREE.Vector3) {
    target.modify('hp', amount)
    if (worldPos) showFloatingNumber(worldPos, `+${amount}`, '#4ade80')
  }

  function dealAbsorb(target: StatBlock, amount: number, worldPos?: THREE.Vector3) {
    target.modify('absorb', amount)
    if (worldPos) showFloatingNumber(worldPos, `✦+${amount}`, '#a5b4fc')
  }

  // ── Action resolver ──────────────────────────────────────────────────────

  function executeAction(
    actor:       Unit,
    actorStats:  StatBlock,
    target:      Unit,
    targetStats: StatBlock,
    type:   'attack' | 'defend' | 'heal',
    value:  number,
    color:  number,
    done:   () => void,
    opts: {
      safety:      { cancel(): void }
      trauma?:     number
      postDelay?:  number
      onLand?:     () => void
      healAmount?: number
      skill?:      IconShape   // card identity → per-skill attack signature
    },
  ) {
    const { safety, trauma = 0.25, postDelay = 0.22, onLand, skill } = opts
    const commit = () => { safety.cancel(); done() }
    const targetPos   = target.group.position.clone(); targetPos.y += 1
    const actorHdPos  = actor.group.position.clone();  actorHdPos.y += 2.2
    const targetHdPos = target.group.position.clone(); targetHdPos.y += 2.2

    const isPlayer = actor === player
    if (type === 'attack') {
      tweenCam(isPlayer ? CP.pAtk : CP.eAtk, isPlayer ? CP.aLook : CP.hLook, 0.35)
    } else if (type === 'defend' && isPlayer) {
      tweenCam(CP.pDef, CP.dLook, 0.3)
    }

    let dmgValue = type === 'attack' && actorStats.get('weak') > 0
      ? Math.floor(value * 0.75) : value
    if (type === 'attack' && actor === player && modifier?.damageMultiplier) {
      dmgValue = Math.floor(dmgValue * modifier.damageMultiplier)
    }

    if (type === 'attack') {
      const attackAnim =
        skill === 'fireball' ? animFireball
        : skill === 'overload' ? animOverload
        : skill === 'fuse'     ? animOverload
        : skill === 'leech'    ? animSlash
        : skill === 'slash'    ? animSlash
        : skill === 'strike'   ? animStrike
        : (value >= 8 ? animFireball : animStrike)   // enemy moves have no skill → by size
      attackAnim(actor, targetPos, color, () => {
        dealDamage(targetStats, dmgValue, targetHdPos)
        const healAmt = opts.healAmount ?? 0
        if (healAmt > 0) dealHeal(actorStats, healAmt, actorHdPos)
        const k = Math.min(1, dmgValue / 26)   // 0..1 impact intensity by damage
        shake.addTrauma(trauma + k * 0.4)
        hitStop(0.05 + k * 0.06)               // brief freeze for weight
        animHit(target)
        impactRing(targetPos, color, 0.8 + k * 0.9)
        vfx.burst(targetPos, 11 + Math.round(dmgValue * 0.9), { speed: 2.4, spread: 1.05, up: 0.5, life: 0.5, size: 0.15, color })
        vfx.burst(targetPos, 7, { speed: 3.4, spread: 0.5, up: 0.2, life: 0.26, size: 0.1, color: 0xffffff })
        onLand?.()
        updateHUD()
        timer.after(postDelay, commit)
      })
    } else if (type === 'defend') {
      animBlock(actor, color, () => {
        if (value > 0) dealAbsorb(actorStats, value, actorHdPos)
        const healAmt = opts.healAmount ?? 0
        if (healAmt > 0) {
          const healPos = actorHdPos.clone(); healPos.x += 0.45
          dealHeal(actorStats, healAmt, healPos)
        }
        onLand?.()
        updateHUD()
        timer.after(0.13, commit)
      })
    } else {
      animHeal(actor, () => {
        dealHeal(actorStats, value, actorHdPos)
        onLand?.()
        updateHUD()
        timer.after(0.13, commit)
      })
    }
  }

  // ── Play a card ──────────────────────────────────────────────────────────

  function playCard(card: GameCard) {
    if (_animating || !gameState.is('player_turn')) return
    const def = cards.require(card.cardId)
    const effectiveCost = Math.max(1, def.cost + (modifier?.cardCostDelta ?? 0))
    if (energy < effectiveCost) return

    const variant = getVariant(def, card.tier, build, card.cardId)
    const val     = Math.round(variant.value * powerLevel)

    // Snapshot card position before DOM changes
    const cardEl   = $hand.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`)
    const cardRect = cardEl?.getBoundingClientRect() ?? null

    energy -= effectiveCost
    deck.play(card.id, true)
    setAnimating(true)
    renderHand()
    sfx.cardPlay()

    // Arc ghost from hand position up toward scene center
    if (cardEl && cardRect) {
      const ghost = cardEl.cloneNode(true) as HTMLElement
      ghost.querySelectorAll('button').forEach(b => b.remove())
      const cx  = window.innerWidth / 2
      const cy  = window.innerHeight * 0.38
      const tx  = cx - (cardRect.left + cardRect.width  / 2)
      const ty  = cy - (cardRect.top  + cardRect.height / 2)
      const len = Math.sqrt(tx * tx + ty * ty) || 1
      const mx  = tx * 0.35 + (-ty / len) * 55
      const my  = ty * 0.35 + ( tx / len) * 55
      Object.assign(ghost.style, {
        position: 'fixed', left: `${cardRect.left}px`, top: `${cardRect.top}px`,
        width: `${cardRect.width}px`, margin: '0', zIndex: '140',
        pointerEvents: 'none', cursor: 'default',
      })
      ghost.style.setProperty('--tx', `${tx}px`)
      ghost.style.setProperty('--ty', `${ty}px`)
      ghost.style.setProperty('--mx', `${mx}px`)
      ghost.style.setProperty('--my', `${my}px`)
      ghost.style.animation = 'cardPlayArc 0.3s cubic-bezier(0.4,0,0.6,1) forwards'
      document.body.appendChild(ghost)
      setTimeout(() => ghost.remove(), 320)
    }

    function done() {
      tweenCam(CP.pIdle, CP.pLook, 0.5)
      setAnimating(false); renderHand(); checkDeath()
    }
    const safety = timer.after(3.0, () => { if (_animating) done() })

    executeAction(player, playerStats, enemy, enemyStats, def.type, val, def.color, done, {
      safety,
      trauma:     0.3,
      postDelay:  0.22,
      healAmount: Math.round((variant.heal ?? 0) * powerLevel),
      skill:      def.shape,
      onLand: () => {
        if (def.type === 'attack') sfx.hit()
        else if (def.type === 'defend') sfx.shield()
        else sfx.heal()
        if (variant.retaliate) {
          const returned = Math.round(variant.retaliate * powerLevel)
          const pos = enemy.group.position.clone(); pos.y += 2.2
          dealDamage(enemyStats, returned, pos)
          impactRing(pos, def.color, 0.72)
          vfx.burst(pos, 9, { speed: 2.1, spread: 0.7, up: 0.35, life: 0.38, size: 0.11, color: def.color })
          sfx.hit()
        }
        if (variant.status) {
          const st      = variant.status
          const toEnemy = st.target === 'enemy'
          const immune  = toEnemy && enemyTraits.some(t => t.kind === 'immune' && t.statuses.includes(st.kind))
          if (immune) {
            flash('IMMUNE', 0.7)
          } else {
            const tgt = toEnemy ? enemyStats : playerStats
            tgt.modify(st.kind, st.stacks)
            const label = st.kind === 'poison'     ? 'POISONED'
                        : st.kind === 'vulnerable' ? 'EXPOSED'
                        : 'WEAKENED'
            flash(label, 0.7)
          }
        }
        if (variant.selfDamage) {
          playerStats.modify('hp', -variant.selfDamage)
          const pos = player.group.position.clone(); pos.y += 2.4
          showFloatingNumber(pos, `-${variant.selfDamage}`, '#f87171')
          updateHUD()
        }
      },
    })
  }

  // ── Encounter ────────────────────────────────────────────────────────────

  // Brief black-veil fade between encounters — covers the 3D swap so the new enemy
  // materialises instead of just teleporting in. Resolves after the fade-out ends.
  function sceneTransition(fn: () => void): Promise<void> {
    return new Promise(resolve => {
      const veil = document.createElement('div')
      veil.style.cssText = 'position:fixed;inset:0;z-index:140;background:#000;opacity:0;transition:opacity 0.32s ease;pointer-events:none'
      document.body.appendChild(veil)
      requestAnimationFrame(() => { veil.style.opacity = '1' })
      setTimeout(() => {
        fn()
        // Two frames so the new scene renders before we unveil it.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          veil.style.opacity = '0'
          veil.addEventListener('transitionend', () => { veil.remove(); resolve() }, { once: true })
        }))
      }, 380)
    })
  }

  async function enterEncounter(idx: number) {
    if (_firstEncounter) {
      _firstEncounter = false
      startEncounter(idx)
    } else {
      await sceneTransition(() => startEncounter(idx))
    }
  }

  function startEncounter(idx: number) {
    clearHoldGhosts()
    heldIds.clear()
    updateHoldSlots()
    const def = encounters[idx]
    encounterIdx = idx
    ENEMY_MOVES = def.moves
    enemyTraits = def.traits ?? []
    lastMoveName = ''
    lastPlayerDamage = 0

    enemyStats.setMax('hp', def.hp)
    enemyStats.set('hp', def.hp)
    enemyStats.set('absorb', 0)
    for (const s of ['vulnerable', 'poison', 'weak'] as const) {
      playerStats.set(s, 0)
      enemyStats.set(s, 0)
    }
    enemy.bodyMat.color.setHex(def.bodyColor)
    enemy.bodyMat.emissive.setHex(def.bodyColor)
    enemy.bodyMat.emissiveIntensity = GLOW
    enemy.accentMat.color.setHex(def.accentColor)
    enemy.visorMat.color.setHex(def.accentColor)
    enemy.visorMat.emissive.setHex(def.accentColor)
    enemyRingMat.color.setHex(def.bodyColor)
    enemyFloorLight.color.setHex(def.bodyColor)
    const arenaProfile = applyArena(def)

    // Silhouette by archetype: the enemy's primary trait drives its form
    // (immune→crystal, armored→block, regen→bloom); the Mirror gets 'meld'.
    const enemyForm = isFinale ? 'meld' : (TRAIT_FORM[def.traits?.[0]?.kind ?? ''] ?? 'orb')
    if (enemy.form !== enemyForm) setForm(enemy, enemyForm)
    setUnitIdentity(enemy, isFinale ? 'original' : def.visual)
    setUnitRegalia(enemy, isFinale ? 'original' : regaliaForEnemy(def), def.accentColor)
    const scale = isFinale ? 1.45 : isAuthoredUnit(enemy) ? 1 : ([0.82, 1.15, 1.32][idx] ?? 1)
    enemy.group.scale.setScalar(!isFinale && isAuthoredUnit(enemy) ? 0.001 : scale)
    enemy.group.rotation.y = isAuthoredUnit(enemy) ? -0.62 : -Math.PI / 2 + 0.28
    // The Mirror is "basically your character" — reflect the marks you've accrued
    // and the trophy rings you've won. Your reflection wears your own regalia.
    if (isFinale) {
      applyMarks(enemy, absorbedForms, playerDepth)
      applyTrophies(enemy, trophyRings)
    }

    $enemyName.textContent = def.name
    $encounterInfo.textContent = isFinale
      ? arenaProfile.label
      : `CANDY SEAL ${idx + 1} / ${encounters.length}  ·  ${arenaProfile.label}`

    pickEnemyIntent()
    updateHUD()
    const releaseBattle = () => {
      if (idx > 0) {
        flash(`CANDY SEAL ${idx + 1}  ·  ${def.name.toUpperCase()}`, 1.0)
        timer.after(0.9, showTraitTell)
        timer.after(1.45, startPlayerTurn)
      } else {
        timer.after(0.25, showTraitTell)
        timer.after(0.85, startPlayerTurn)
      }
    }
    const beginBattle = () => {
      if (isFinale) {
        mirrorEntrance(scale, startPlayerTurn)
      } else if (isAuthoredUnit(enemy)) {
        authoredEnemyEntrance(scale, releaseBattle)
      } else {
        releaseBattle()
      }
    }
    void showRivalOpening(candyRivalFor(def)).then(beginBattle)
  }

  // The authored candy units enter according to how they are manufactured.
  // This is short enough to preserve turn cadence, but gives each doctrine weight
  // before the HUD hands control back to the player.
  function authoredEnemyEntrance(finalScale: number, then: () => void) {
    setAnimating(true)
    resetUnitPose(enemy)
    const identity = enemy.identity
    const finalX = 2.5
    const finalY = 0
    const finalRot = -0.62
    const core = new THREE.Vector3(finalX, CORE_Y, 0)

    enemy.group.rotation.y = finalRot

    if (identity === 'crimped-wrapper') {
      enemy.group.position.set(4.65, finalY, 0)
      enemy.group.scale.setScalar(finalScale * 0.58)
      vfx.burst(new THREE.Vector3(4.2, CORE_Y, 0), 18, { speed: 1.1, spread: 0.55, up: 0.25, life: 0.48, size: 0.1, color: 0xfacc15 })
      timer.tween(0.62, p => {
        const e = 1 - Math.pow(1 - p, 3)
        enemy.group.position.x = 4.65 + (finalX - 4.65) * e
        enemy.group.scale.setScalar(finalScale * (0.58 + e * 0.42))
        poseUnit(enemy, 'windup', Math.sin(p * Math.PI), -1)
      }, { onComplete: () => {
        resetUnitPose(enemy)
        ringFx(core, 0xfacc15, 0.25, 1.5, 0.3, 0.72)
        vfx.burst(core, 14, { speed: 1.7, spread: 0.55, up: 0.35, life: 0.34, size: 0.09, color: 0xffffff })
        finish()
      } })
      return
    }

    if (identity === 'hard-set') {
      enemy.group.position.set(finalX, 3.45, 0)
      enemy.group.scale.setScalar(finalScale * 0.74)
      timer.tween(0.58, p => {
        const e = 1 - Math.pow(1 - p, 3)
        enemy.group.position.y = finalY + (1 - e) * 3.45 + Math.sin(p * Math.PI) * 0.08
        enemy.group.scale.setScalar(finalScale * (0.74 + e * 0.26))
        poseUnit(enemy, 'attack', Math.min(1, p * 1.35), -1)
      }, { onComplete: () => {
        resetUnitPose(enemy)
        impactRing(core, 0xff3b30, 1.2)
        ringFx(core, 0xffd166, 0.45, 2.15, 0.42, 0.72)
        vfx.burst(core, 24, { speed: 2.0, spread: 0.9, up: 0.32, life: 0.48, size: 0.12, color: 0xffd166 })
        shake.addTrauma(0.42)
        finish()
      } })
      return
    }

    if (identity === 'last-drop') {
      enemy.group.position.set(finalX, -0.3, 0)
      enemy.group.scale.set(finalScale * 0.48, 0.001, finalScale * 0.48)
      ringFx(new THREE.Vector3(finalX, 0.05, 0), 0x38bdf8, 1.4, 0.28, 0.7, 0.68, 0.25)
      timer.tween(0.72, p => {
        const e = 1 - Math.pow(1 - p, 2)
        enemy.group.position.y = -0.3 + e * 0.3
        enemy.group.scale.set(
          finalScale * (0.48 + e * 0.52),
          Math.max(0.001, finalScale * e),
          finalScale * (0.48 + e * 0.52),
        )
        poseUnit(enemy, 'heal', e, -1)
      }, { onComplete: () => {
        resetUnitPose(enemy)
        ringFx(core, 0xf472b6, 0.35, 1.8, 0.48, 0.76, 0.18)
        vfx.burst(core, 26, { speed: 1.45, spread: 0.75, up: 1.2, life: 0.62, size: 0.13, color: 0x38bdf8 })
        vfx.burst(core, 12, { speed: 1.7, spread: 0.45, up: 0.6, life: 0.42, size: 0.09, color: 0xf472b6 })
        finish()
      } })
      return
    }

    enemy.group.position.set(finalX, finalY, 0)
    timer.tween(0.48, p => {
      const e = 1 - Math.pow(1 - p, 3)
      enemy.group.scale.setScalar(Math.max(0.001, finalScale * e))
    }, { onComplete: finish })

    function finish() {
      enemy.group.position.set(finalX, finalY, 0)
      enemy.group.scale.setScalar(finalScale)
      enemy.group.rotation.y = finalRot
      resetUnitPose(enemy)
      setAnimating(false)
      then()
    }
  }

  // ── Mirror finale staging — the one fight that should feel like a finale. ─────
  // A slow camera push-in while the Echo materialises out of the Meld in a swell of
  // violet essence, a held beat, then the title settles and control returns.
  function mirrorEntrance(finalScale: number, then: () => void) {
    setAnimating(true)
    const emat = enemy.bodyMat
    const core = enemy.group.position.clone(); core.y += CORE_Y

    // Drama: start high and pushed back looking at the Echo, then settle to the meld two-shot.
    _camBase.set(-0.4, 9.2, 13.8)
    _camLook.set(0.6, 1.5, 0)
    tweenCam(CP.meld, CP.mLook, 2.6)

    // Vignette — edge-darken the world as the Echo forms; the void narrows.
    const vig = document.createElement('div')
    vig.style.cssText = 'position:fixed;inset:0;z-index:125;pointer-events:none;background:radial-gradient(ellipse at 50% 48%,transparent 28%,rgba(0,0,0,0.92) 100%);opacity:0;transition:opacity 1.6s ease'
    document.body.appendChild(vig)
    requestAnimationFrame(() => { vig.style.opacity = '1' })

    // Drop ambient and sun — the arena dims for the arrival.
    const origAmbI = ambient.intensity
    const origSunI = sun.intensity
    timer.tween(1.8, p => {
      ambient.intensity = origAmbI * (1 - p * 0.6)
      sun.intensity     = origSunI * (1 - p * 0.45)
    })

    // The Echo forms from nothing — scale up with an emissive flare.
    enemy.group.scale.setScalar(0.001)
    timer.tween(1.7, p => {
      const e = 1 - Math.pow(1 - p, 2)
      enemy.group.scale.setScalar(Math.max(0.001, finalScale * e))
      emat.emissiveIntensity = GLOW + (1 - p) * 1.6
    }, { onComplete: () => { emat.emissiveIntensity = GLOW } })

    // A swell of essence as it coalesces, and a second bloom as it lands.
    timer.after(0.35, () => vfx.burst(core, 46, { speed: 1.7, spread: 1.3, up: 0.8, life: 1.05, size: 0.14, color: 0xc4b5fd }))
    timer.after(1.5,  () => { vfx.burst(core, 26, { speed: 2.2, spread: 0.7, up: 0.4, life: 0.5, size: 0.12, color: 0xe9deff }); shake.addTrauma(0.3) })

    // Held beat, the title settles, then control returns with lights restored.
    timer.after(2.4, () => flash('THE ORIGINAL', 1.6))
    timer.after(3.7, () => {
      vig.style.transition = 'opacity 0.9s ease'
      vig.style.opacity = '0'
      vig.addEventListener('transitionend', () => vig.remove(), { once: true })
      timer.tween(0.9, p => {
        ambient.intensity = origAmbI * (0.4 + 0.6 * p)
        sun.intensity     = origSunI * (0.55 + 0.45 * p)
      }, { onComplete: () => { ambient.intensity = origAmbI; sun.intensity = origSunI } })
      setAnimating(false); then()
    })
  }

  // Weighted, state-aware intent. Base weights express the enemy's identity; the
  // modifiers below make it feel deliberate — heal only when hurt, guard after being
  // spiked, and avoid robotically repeating the same move.
  function intentWeight(m: EnemyMove, hpFrac: number): number {
    let w = m.weight ?? 1

    if (m.type === 'heal') {
      // Don't waste heals at high HP; prioritise them when low.
      if      (hpFrac > 0.70) w = 0
      else if (hpFrac > 0.45) w *= 0.6
      else                    w *= 2.4
    }

    if (m.type === 'defend') {
      // Guard harder right after the player landed a big hit.
      const maxHp  = enemyStats.getMax('hp') ?? 1
      const spiked = lastPlayerDamage >= 0.18 * maxHp
      w *= spiked ? 2.2 : 0.7
    }

    // Anti-repeat: strongly discourage immediately repeating the same move.
    if (m.name === lastMoveName) w *= 0.35

    return w
  }

  function pickEnemyIntent() {
    const hpFrac   = enemyStats.get('hp') / (enemyStats.getMax('hp') ?? 1)
    const weighted = ENEMY_MOVES.map(m => ({ m, w: Math.max(0, intentWeight(m, hpFrac)) }))
    const total    = weighted.reduce((s, x) => s + x.w, 0)

    if (total <= 0) {
      // Degenerate case (e.g. only a heal move, already at full HP) — pick uniformly.
      enemyNextMove = ENEMY_MOVES[Math.floor(Math.random() * ENEMY_MOVES.length)]
    } else {
      let r = Math.random() * total
      enemyNextMove = weighted[weighted.length - 1].m
      for (const x of weighted) { r -= x.w; if (r <= 0) { enemyNextMove = x.m; break } }
    }

    lastMoveName = enemyNextMove.name
    const m  = enemyNextMove
    const cc = '#' + m.color.toString(16).padStart(6, '0')
    const detail = m.label.replace(/^\S+\s+/, '')   // drop the leading emoji — the glyph carries it now
    $intentText.innerHTML = `<span class="intent-stack" style="--ic:${cc}">`
      + `<span class="intent-chip">`
      + `<span class="intent-glyph">${buildIcon(moveShape(m), m.color)}</span>`
      + `<span class="intent-name">${detail}</span></span>`
      + `<span class="intent-hint">${intentHint(m)}</span></span>`
  }

  // ── Enemy turn ───────────────────────────────────────────────────────────

  function enemyTurn() {
    gameState.set('enemy_turn')
    setAnimating(true)
    // How much the player dealt this turn — drives the next defend-intent decision.
    lastPlayerDamage = Math.max(0, enemyHpRef - enemyStats.get('hp'))
    tweenCam(CP.eIdle, CP.eLook, 0.5)
    $energyPips.forEach(p => p.classList.add('spent'))
    $hand.classList.add('dimmed')
    $enemyIntent.classList.remove('show')
    updateEndTurnButton(false)

    // Passive traits resolve before the enemy acts.
    for (const t of enemyTraits) {
      const hpos = enemy.group.position.clone(); hpos.y += 2.2
      if (t.kind === 'armored') {
        dealAbsorb(enemyStats, t.absorb, hpos)
      } else if (t.kind === 'regen') {
        const before = enemyStats.get('hp')
        enemyStats.modify('hp', t.hp)
        const healed = enemyStats.get('hp') - before
        if (healed > 0) showFloatingNumber(hpos, `+${healed}`, '#4ade80')
      }
    }
    updateHUD()
    updateEndTurnButton()

    flash('CANDY TIGHTENS THE SEAL')

    timer.after(0.4, () => {
      const move = enemyNextMove

      function done() {
        pickEnemyIntent()
        setAnimating(false)
        updateHUD()
        if (!checkDeath()) timer.after(0.3, startPlayerTurn)
      }

      const safety = timer.after(3.0, () => { if (_animating) done() })

      const onLand = move.type === 'attack'
        ? () => {
            sfx.enemyHit()
            $hitVignette.classList.remove('flash')
            void $hitVignette.offsetWidth
            $hitVignette.classList.add('flash')
            flash(`${move.name}!`, 0.6)
            if (move.status) {
              const statusStats = move.status.target === 'player' ? playerStats : enemyStats
              statusStats.modify(move.status.kind, move.status.stacks)
            }
          }
        : () => {
            move.type === 'heal' ? sfx.heal() : sfx.shield()
            flash(`${move.name}! ✦`, 0.5)
          }

      const inDmg = move.type === 'attack' && modifier?.incomingMultiplier
        ? Math.ceil(move.value * modifier.incomingMultiplier)
        : move.value
      executeAction(enemy, enemyStats, player, playerStats, move.type, inDmg, move.color, done, {
        safety,
        trauma:    0.2 + move.value / 28,
        postDelay: 0.28,
        skill:     moveShape(move),
        onLand,
      })
    })
  }

  // ── Player turn ──────────────────────────────────────────────────────────

  function startPlayerTurn() {
    turnCount++
    energy = MAX_ENERGY
    playerStats.set('absorb', 0)
    // enemy absorb persists until damaged through

    // ── Status ticks ────────────────────────────────────────────
    // Poison ignores armor — it's the answer to the armored Bulwark.
    const playerPoison = playerStats.get('poison')
    if (playerPoison > 0) {
      const pos = player.group.position.clone(); pos.y += 2.2
      dealDamage(playerStats, playerPoison, pos, { ignoreAbsorb: true })
      playerStats.modify('poison', -1)
      animHit(player)
    }
    const enemyPoison = enemyStats.get('poison')
    if (enemyPoison > 0) {
      const pos = enemy.group.position.clone(); pos.y += 2.2
      dealDamage(enemyStats, enemyPoison, pos, { ignoreAbsorb: true })
      enemyStats.modify('poison', -1)
      animHit(enemy)
    }
    if (playerStats.get('vulnerable') > 0) playerStats.modify('vulnerable', -1)
    if (enemyStats.get('vulnerable') > 0) enemyStats.modify('vulnerable', -1)
    if (playerStats.get('weak') > 0) playerStats.modify('weak', -1)
    if (enemyStats.get('weak') > 0) enemyStats.modify('weak', -1)

    updateHUD()
    if (checkDeath()) return
    // ────────────────────────────────────────────────────────────

    // Snapshot enemy HP so the next intent can react to how hard the player hits.
    enemyHpRef = enemyStats.get('hp')

    const handSnapshot = [...deck.hand]
    for (const c of handSnapshot) {
      if (!heldIds.has(c.id)) deck.discard(c.id)
    }
    const heldCount = deck.hand.length
    const slots = Math.max(0, 4 - heldCount + bonusDraw)
    bonusDraw = 0
    if (deck.drawPile.length < slots) { animateReshuffle(); deck.reshuffle() }
    deck.draw(Math.min(slots, deck.drawPile.length))

    gameState.set('player_turn')
    tweenCam(CP.pIdle, CP.pLook, 0.5)
    $hand.classList.remove('dimmed')
    timer.after(0.45, () => $enemyIntent.classList.add('show'))
    flash(`TURN ${turnCount}`, 0.6)
    if (isTutorialMeldGate()) timer.after(0.75, () => flash('TWO MATCHING PIECES. FUSE THEM.', 2.4))
    else if (isFirstRun && turnCount === 1) timer.after(0.75, () => flash('HOLD pieces  ·  MELD pairs to fuse', 2.2))
    animateHoldReturn(() => {
      setAnimating(false)
      renderHand(true)
    })
  }

  $endTurn.addEventListener('click', () => {
    if (!gameState.is('player_turn') || _animating) return
    if (isTutorialMeldGate()) {
      flash('FUSE THE PAIR FIRST', 1.0)
      return
    }
    $endTurn.classList.add('disabled')
    updateEndTurnButton(false)
    bonusDraw = energy
    if (energy > 0) animateApDraw(energy)
    animateHoldEndTurn()
    $hand.innerHTML = ''
    $apBonus.classList.remove('show')
    enemyTurn()
  })

  // ── Reward application ───────────────────────────────────────────────────

  function applyReward(reward: Reward) {
    if (reward.type === 'card') {
      deck.shelve(reward.card)
      const def = CARD_DATA[reward.card.cardId]
      flash(def ? `${def.name} added to deck` : 'Card added', 1.0)
    } else if (reward.type === 'hp') {
      const maxHp = playerStats.getMax('hp')!
      const actual = Math.min(reward.amount, maxHp - playerStats.get('hp'))
      if (actual > 0) {
        playerStats.modify('hp', actual)
        const pos = player.group.position.clone(); pos.y += 2.4
        showFloatingNumber(pos, `+${actual}`, '#4ade80')
        updateHUD()
      }
    } else {
      if (!build[reward.cardId]) build[reward.cardId] = [0, 0, 0]
      build[reward.cardId][reward.tier - 1] = reward.variantIdx
      const def = CARD_DATA[reward.cardId]
      flash(def ? `${def.name} T${reward.tier} upgraded` : 'Variant updated', 1.0)
    }
  }

  // ── End-of-battle cinematics ─────────────────────────────────────────────

  // All marks cleared: camera reveals the empty arena; player surges; rings bloom.
  function victoryMoment(then: () => void) {
    const ppos = player.group.position.clone(); ppos.y += CORE_Y
    const center = new THREE.Vector3(0, 0.8, 0)
    const pmat = player.bodyMat
    const baseG = player.group.scale.x
    tweenCam([-0.4, 9.0, 13.2] as const, [0, 0.4, 0] as const, 1.4)
    pmat.emissive.setHex(0x22d3ee)
    timer.tween(0.6, p => {
      pmat.emissiveIntensity = GLOW + Math.sin(Math.min(1, p * 1.6) * Math.PI) * 3.8
      player.group.scale.setScalar(baseG * (1 + Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.2))
    }, { onComplete: () => { pmat.emissive.setHex(pmat.color.getHex()); pmat.emissiveIntensity = GLOW; player.group.scale.setScalar(baseG) } })
    vfx.burst(ppos, 60, { speed: 2.6, spread: 1.5, up: 1.3, life: 1.2, size: 0.17, color: 0x22d3ee })
    vfx.burst(ppos, 28, { speed: 3.8, spread: 0.7, up: 0.6, life: 0.65, size: 0.11, color: 0xffffff })
    timer.after(0.2, () => vfx.burst(ppos, 40, { speed: 2.0, spread: 1.7, up: 1.6, life: 1.0, size: 0.15, color: player.bodyMat.color.getHex() }))
    ringFx(center, 0x22d3ee, 0.2, 5.5, 1.2, 0.65)
    timer.after(0.2, () => ringFx(center, 0xffffff, 0.2, 4.0, 1.0, 0.4))
    timer.after(0.42, () => ringFx(center, 0x22d3ee, 0.2, 6.5, 1.4, 0.45))
    shake.addTrauma(0.28)
    timer.after(1.6, then)
  }

  // Player dies: form implodes and spins away; camera shifts to the victor.
  function defeatCollapse(then: () => void) {
    const src = player.group.position.clone(); src.y += CORE_Y
    const pmat = player.bodyMat
    const baseScale = player.group.scale.x
    const baseRotY  = player.group.rotation.y
    tweenCam(CP.eAtk, CP.hLook, 0.8)
    pmat.emissive.setHex(0xffffff); pmat.emissiveIntensity = 3.5
    shake.addTrauma(0.5)
    eyeWiden(player)
    vfx.burst(src, 20, { speed: 1.4, spread: 0.7, up: 0.3, life: 0.45, size: 0.13, color: 0xff2200 })
    vfx.burst(src, 8,  { speed: 2.4, spread: 0.4, up: 0.2, life: 0.22, size: 0.09, color: 0xffffff })
    timer.tween(0.62, p => {
      const e = p * p
      player.group.scale.setScalar(Math.max(0.001, baseScale * (1 - e)))
      player.group.rotation.y = baseRotY - e * 3.6
      pmat.emissiveIntensity = 3.5 * (1 - p * 0.65) + GLOW * p
    }, { onComplete: () => {
      player.group.scale.setScalar(0)
      player.group.rotation.y = baseRotY
      pmat.emissive.setHex(pmat.color.getHex()); pmat.emissiveIntensity = GLOW
    } })
    timer.after(0.7, then)
  }

  function authoredEnemyDefeat(from: Unit, color: number) {
    if (!isAuthoredUnit(from)) {
      reclaimDeath(from, color)
      return
    }

    const src = from.group.position.clone(); src.y += CORE_Y
    const identity = from.identity
    const accent = from.accentMat.color.getHex()
    const duration = identity === 'last-drop' ? 0.22 : 0.16
    setAnimating(true)
    eyeWiden(from)

    if (identity === 'crimped-wrapper') {
      ringFx(src, 0xfacc15, 1.25, 0.18, 0.22, 0.85)
      vfx.burst(src, 24, { speed: 2.2, spread: 0.7, up: 0.5, life: 0.38, size: 0.11, color: 0xfacc15 })
      vfx.burst(src, 10, { speed: 2.7, spread: 0.4, up: 0.25, life: 0.24, size: 0.08, color: 0xffffff })
    } else if (identity === 'hard-set') {
      impactRing(src, 0xff3b30, 1.35)
      ringFx(src, 0xffd166, 0.35, 2.45, 0.3, 0.78)
      vfx.burst(src, 28, { speed: 2.45, spread: 0.95, up: 0.22, life: 0.44, size: 0.12, color: 0xffd166 })
      shake.addTrauma(0.46)
    } else if (identity === 'last-drop') {
      ringFx(src, 0x38bdf8, 0.35, 2.2, 0.4, 0.78, -0.16)
      vfx.burst(src, 30, { speed: 1.7, spread: 0.9, up: 1.5, life: 0.62, size: 0.14, color: 0x38bdf8 })
      vfx.burst(src, 16, { speed: 1.9, spread: 0.55, up: 0.7, life: 0.46, size: 0.1, color: 0xf472b6 })
    } else {
      vfx.burst(src, 18, { speed: 1.9, spread: 0.7, up: 0.4, life: 0.36, size: 0.1, color: accent })
    }

    timer.tween(duration, p => {
      poseUnit(from, 'hit', p, -1)
      from.bodyMat.emissive.setHex(0xffffff)
      from.bodyMat.emissiveIntensity = GLOW + p * 2.8
    }, { onComplete: () => {
      resetUnitPose(from)
      from.bodyMat.emissive.setHex(color)
      from.bodyMat.emissiveIntensity = GLOW
      reclaimDeath(from, color)
    } })
  }

  // ── Death check ──────────────────────────────────────────────────────────

  function checkDeath(): boolean {
    if (enemyStats.get('hp') <= 0) {
      gameState.set('resting')
      // Reclaim choreography — the fragment implodes and streams back into you.
      authoredEnemyDefeat(enemy, enemy.bodyMat.color.getHex())
      timer.after(0.85, async () => {
        if (encounterIdx < encounters.length - 1) {
          runFragments += 10
          progression.addFragments(10)
          flash(`CANDY SEAL ${encounterIdx + 1} BROKEN  ⬡ +10`, 1.2)
          updateHUD()
          await new Promise<void>(r => timer.after(0.55, r))
          const rival = candyRivalFor(encounters[encounterIdx])
          const reward = await showRewardScreen({
            encIdx: encounterIdx,
            build,
            playerClass,
            enemyTraits,
            enemyName: encounters[encounterIdx].name,
            rivalLine: rival.defeat,
          })
          applyReward(reward)
          saveCheckpoint({ campaignRunNumber: runNumber, encounterIdx: encounterIdx + 1, playerHP: playerStats.get('hp'), runFragments })
          await enterEncounter(encounterIdx + 1)
        } else {
          runFragments += 25
          progression.addFragments(25)
          progression.recordRunEnd(true, encounters.length)
          clearCheckpoint()
          gameState.set('game_over')
          sfx.victory()
          victoryMoment(() => {
            $goTitle.textContent = isFinale ? 'THE BAG IS OPEN' : 'BAG OPENED'
            $goTitle.style.color = isFinale ? '#a78bfa' : '#22d3ee'
            $goSub.textContent = isFinale
              ? `The Original split · ${turnCount} turns · ⬡ +${runFragments}`
              : `Three Candy seals broken · ${turnCount} turns · ⬡ +${runFragments}`
            if (onVictory) { _endMode = 'victory'; $goRestart.textContent = isFinale ? 'OPEN ANOTHER BAG →' : 'RETURN TO THE BAG →' }
            setGameOverVisible(true)
          })
        }
      })
      return true
    }
    if (playerStats.get('hp') <= 0) {
      gameState.set('resting')
      timer.after(0.3, () => {
        sfx.defeat()
        defeatCollapse(() => {
          progression.recordRunEnd(false, encounterIdx)
          clearCheckpoint()
          gameState.set('game_over')
          $goTitle.textContent = 'BAG RESEALED'
          $goTitle.style.color = '#ef4444'
          $goSub.textContent = `Candy seal ${encounterIdx + 1} broken · ${turnCount} turns · ⬡ +${runFragments}`
          if (onDefeat) { _endMode = 'defeat'; $goRestart.textContent = 'SHAKE BACK →' }
          setGameOverVisible(true)
        })
      })
      return true
    }
    return false
  }

  // ── Restart ──────────────────────────────────────────────────────────────

  let _endMode: 'victory' | 'defeat' | null = null

  $goRestart.addEventListener('click', () => {
    if (_endMode === 'victory' && onVictory) { dispose(); onVictory(); return }
    if (_endMode === 'defeat'  && onDefeat)  { dispose(); onDefeat();  return }
    // standalone restart
    _endMode = null
    _firstEncounter = true
    setGameOverVisible(false)
    playerStats.set('hp', playerStats.getMax('hp')!)
    energy = MAX_ENERGY
    turnCount = 0
    runFragments = 0
    bonusDraw = 0
    clearHoldGhosts()
    heldIds.clear()
    $hand.classList.remove('dimmed')
    $enemyIntent.classList.remove('show')
    deck.reinit(startingCards.map(c => makeCard(c.cardId, c.tier)))
    deck.shuffle()
    void enterEncounter(0)
  })

  // ── Idle animations ──────────────────────────────────────────────────────

  function idleBob(unit: Unit, t: number, offset: number) {
    if (_animating) return
    const s = Math.sin(t * 2 + offset)
    unit.body.position.y = CORE_Y + s * 0.05
    unit.head.position.y = 1.62 + s * 0.04   // secondary orb bobs above
    unit.armL.rotation.y = t * 0.7 + offset   // ring A orbits
    unit.armR.rotation.y = -(t * 0.5 + offset) // ring B counter-orbits
    unit._trophyPivot.rotation.y = t * 0.32 + offset   // earned rings revolve, slower & statelier
    updateUnitIdentity(unit, t)
    updateUnitRegalia(unit, t)
  }

  // On-unit status tells — each affliction emits its own motes from the core, so
  // multiple stack visibly (purple bubbling up = poison, raw red flicker = vulnerable,
  // amber sinking = sapped/weak). Runs every frame, animations included.
  function emitStatusMotes(unit: Unit, stats: StatBlock, dt: number) {
    const poison = stats.get('poison'), vuln = stats.get('vulnerable'), weak = stats.get('weak')
    if (poison <= 0 && vuln <= 0 && weak <= 0) return
    const core = unit.group.position.clone(); core.y += CORE_Y
    if (poison > 0)
      vfx.stream(core, dt, 14, { speed: 0.55, spread: 0.5, up: 2.7, life: 0.72, lifeVar: 0.4, size: 0.11, sizeVar: 0.5, color: 0x9d6bff })   // bubbles rise
    if (vuln > 0)
      vfx.stream(core, dt, 10, { speed: 0.95, spread: 0.68, up: 0.4, life: 0.36, lifeVar: 0.5, size: 0.09, sizeVar: 0.5, color: 0xff5a4d })  // raw red flicker
    if (weak > 0)
      vfx.stream(core, dt, 7, { speed: 0.42, spread: 0.58, up: 0.06, life: 0.78, lifeVar: 0.4, size: 0.085, sizeVar: 0.4, color: 0xe0b860 }) // amber sinks (drained)
  }

  // ── Render loop ──────────────────────────────────────────────────────────

  // ── Dispose (campaign mode cleanup) ──────────────────────────────────────

  let _frameId = 0
  function dispose() {
    cancelAnimationFrame(_frameId)
    arenaDressing.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    $holdSlots.remove()
    document.body.classList.remove('game-active')
    setGameOverVisible(false)
  }

  let prev = performance.now()

  function frame() {
    _frameId = requestAnimationFrame(frame)
    const now = performance.now()
    const dt = Math.min((now - prev) / 1000, 0.1)
    prev = now

    const t = now / 1000

    if (_hitStop > 0) {
      _hitStop = Math.max(0, _hitStop - dt)   // freeze the action for a beat on impact
    } else {
      timer.update(dt)
      vfx.update(dt)
    }

    // Tension creep: camera eases forward when the player is in danger (< 25% HP).
    const _php = playerStats.get('hp'), _phMax = playerStats.getMax('hp') ?? 1
    _tensionZ += ((_php / _phMax < 0.25 ? 0.45 : 0) - _tensionZ) * Math.min(dt * 1.8, 1)

    // Idle camera drift — recompose from the tween-driven base + a slow breath, so
    // the framing never feels locked off. Shake then layers on top of this.
    camera.position.set(
      _camBase.x + Math.sin(t * 0.23) * 0.18 + Math.sin(t * 0.37) * 0.05,
      _camBase.y + Math.sin(t * 0.19 + 1.3) * 0.10,
      _camBase.z + Math.cos(t * 0.16) * 0.10 - _tensionZ,
    )
    shake.update(dt)
    debug.update(dt)

    idleBob(player, t, 0)
    idleBob(enemy, t, 2)

    // Status world indicators — slow emissive pulse matching active status effect
    if (!_animating) {
      const applyStatusGlow = (unit: Unit, stats: StatBlock) => {
        const mat    = unit.bodyMat
        const poison = stats.get('poison')
        const vuln   = stats.get('vulnerable')
        const weak   = stats.get('weak')
        let mood: 'none' | 'poison' | 'vulnerable' | 'weak' = 'none'
        if (poison > 0) {
          mat.emissive.setHex(0x7c3aed)
          mat.emissiveIntensity = GLOW + ((Math.sin(t * 9.4) + 1) * 0.5) * 0.45
          mood = 'poison'
        } else if (vuln > 0) {
          mat.emissive.setHex(0xdc2626)
          mat.emissiveIntensity = GLOW + ((Math.sin(t * 12.6) + 1) * 0.5) * 0.45
          mood = 'vulnerable'
        } else if (weak > 0) {
          // Weak reads as SAPPED — the form dims and dulls, not flares.
          mat.emissive.setHex(0xca8a04)
          mat.emissiveIntensity = GLOW * (0.35 + ((Math.sin(t * 4.2) + 1) * 0.5) * 0.18)
          mood = 'weak'
        } else {
          mat.emissive.setHex(mat.color.getHex())
          mat.emissiveIntensity = GLOW
        }
        updateEye(unit, t, mood)
      }
      applyStatusGlow(player, playerStats)
      applyStatusGlow(enemy, enemyStats)
    }

    // Status motes emit always (even mid-animation) so afflictions stay legible.
    emitStatusMotes(player, playerStats, dt)
    emitStatusMotes(enemy, enemyStats, dt)

    // Ambient drift — rise + gentle sway, wrapping back to the floor at the top.
    const dp = dustGeo.attributes.position.array as Float32Array
    for (let i = 0; i < DUST_N; i++) {
      dp[i * 3]     += (dustVel[i * 3]     + Math.sin(t * 0.3 + dustPhase[i]) * 0.045) * dt
      dp[i * 3 + 1] +=  dustVel[i * 3 + 1] * dt
      dp[i * 3 + 2] += (dustVel[i * 3 + 2] + Math.cos(t * 0.25 + dustPhase[i]) * 0.03) * dt
      if (dp[i * 3 + 1] > DBY1) {   // recycle: fade out the top, reseed at the floor
        dp[i * 3]     = (Math.random() * 2 - 1) * DBX
        dp[i * 3 + 1] = DBY0
        dp[i * 3 + 2] = DBZ0 + Math.random() * (DBZ1 - DBZ0)
      }
    }
    dustGeo.attributes.position.needsUpdate = true
    dustMat.opacity = 0.42 + Math.sin(t * 0.5) * 0.1   // the field breathes
    skyUniforms.uTime.value = t                         // drift the nebula
    arenaDressing.update(t)

    // Ground mist — drift the noise and rotate each layer slowly.
    for (const m of mistLayers) {
      m.mat.uniforms.uTime.value = t
      m.mesh.rotation.z += m.spin * dt
    }

    // Floating shards — the world tumbles slowly, dreamlike.
    for (const r of rocks) {
      r.mesh.position.y = r.baseY + Math.sin(t * 0.4 + r.phase) * r.bob
      r.mesh.rotation.y += r.spin * dt
      r.mesh.rotation.x = 0.3 + Math.sin(t * 0.33 + r.phase) * 0.06
    }

    rim.intensity = 2 + Math.sin(t * 0.8) * 0.5
    // Warm rim pulses harder during the enemy's turn — heightens threat without a UI cue.
    warmRim.intensity = gameState.is('enemy_turn')
      ? 1.6 + Math.sin(t * 3.2) * 0.65
      : 0.9 + Math.sin(t * 1.1) * 0.28

    // Floor grid breathes very faintly — just enough to feel alive.
    gridMat.opacity = 0.28 + Math.sin(t * 0.55 + 0.3) * 0.12

    // Pillar cap lights breathe on a slow offset cycle.
    const pillarGlow = 0.52 + Math.sin(t * 0.7 + 0.8) * 0.22
    for (const pl of pillarLights) pl.intensity = pillarGlow

    // Outer ring slow-rotates; inner ring counter-rotates. Both breathe opacity.
    aRing1.mesh.rotation.y += 0.006 * dt
    aRing2.mesh.rotation.y -= 0.010 * dt
    aRing1.mat.opacity = 0.20 + Math.sin(t * 0.8) * 0.10
    aRing2.mat.opacity = 0.14 + Math.sin(t * 1.3 + 1.1) * 0.07

    // Unit rings rotate slowly. Enemy ring intensifies as the foe weakens.
    playerRing.rotation.y += 0.018 * dt
    enemyRing.rotation.y  -= 0.024 * dt
    playerRingMat.opacity = 0.18 + Math.sin(t * 1.4) * 0.06
    const ehpFrac = enemyStats.get('hp') / (enemyStats.getMax('hp') ?? 1)
    enemyRingMat.opacity  = 0.15 + (1 - ehpFrac) * 0.38 + Math.sin(t * 1.8) * 0.07

    _lookFinal.set(
      _camLook.x + Math.sin(t * 0.21) * 0.05,
      _camLook.y + Math.sin(t * 0.17 + 0.7) * 0.04,
      _camLook.z,
    )
    camera.lookAt(_lookFinal)
    renderer.render(scene, camera)
  }

  _frameId = requestAnimationFrame(frame)

  // ── Debug ────────────────────────────────────────────────────────────────

  ;(window as any).meld = {
    get animating() { return _animating },
    get state() { return gameState.get() },
    get energy() { return energy },
    deck, playerStats, enemyStats, gameState, cards, timer, vfx, shake,
    playCard, renderHand, updateHUD, doMerge, findMergeTarget, getVariant, build,
    toggleHold, heldIds, bonusDraw: () => bonusDraw,
    player, enemy, setForm, setPlayerForm, applyMarks,   // debug: preview/tune silhouettes live
  }

  // ── Kick off ─────────────────────────────────────────────────────────────

  void enterEncounter(startFrom)
  return { dispose }
}
