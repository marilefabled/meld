import * as THREE from 'three'
import { createTimers } from './engine/timer.js'
import { createShake } from './engine/shake.js'
import { createDeck } from './engine/deck.js'
import { createStatBlock, type StatBlock } from './engine/stats.js'
import { createGameState } from './engine/gameState.js'
import { createParticles } from './engine/particles.js'
import { createDebugOverlay } from './engine/debugOverlay.js'
import { createRegistry } from './engine/registry.js'

// ── Card data ─────────────────────────────────────────────────────────────
interface CardDef {
  name: string; icon: string; type: 'attack' | 'defend' | 'heal'
  value: number; cost: number; desc(val: number): string; color: number
}

const CARD_DATA: Record<string, CardDef> = {
  strike:   { name: 'Strike',   icon: '⚔️',  type: 'attack', value: 6,  cost: 1, desc: v => `Deal ${v} dmg`,              color: 0xef4444 },
  fireball: { name: 'Fireball', icon: '🔥',  type: 'attack', value: 9,  cost: 2, desc: v => `Deal ${v} dmg`,              color: 0xf97316 },
  slash:    { name: 'Slash',    icon: '🗡️',  type: 'attack', value: 4,  cost: 1, desc: v => `Deal ${v} dmg`,              color: 0xa855f7 },
  block:    { name: 'Absorb',   icon: '🔮',  type: 'defend', value: 2,  cost: 1, desc: v => `+${v} absorb · +${v} HP`,    color: 0x818cf8 },
  barrier:  { name: 'Shell',    icon: '💠',  type: 'defend', value: 4,  cost: 2, desc: v => `+${v} absorb · +${v} HP`,    color: 0x6366f1 },
  heal:     { name: 'Heal',     icon: '💚',  type: 'heal',   value: 7,  cost: 1, desc: v => `Restore ${v} HP`,            color: 0x22c55e },
}

const cards = createRegistry<CardDef>('cards')
cards.loadAll(CARD_DATA)

const TIER_ROMAN = ['', 'I', 'II', 'III'] as const
const MAX_TIER = 3

interface GameCard { id: string; cardId: string; tier: number }
let uidCounter = 0
function makeCard(cardId: string, tier = 1): GameCard {
  return { id: `${cardId}_${tier}_${uidCounter++}`, cardId, tier }
}

function scaledValue(def: CardDef, tier: number): number {
  const mult = [1, 1, 2.2, 4.5][tier] ?? 1
  return Math.round(def.value * mult)
}

// ── Build a unit mesh ─────────────────────────────────────────────────────
function buildUnit(color: number, accent: number) {
  const group = new THREE.Group()

  const bodyGeo = new THREE.BoxGeometry(0.75, 1.0, 0.52)
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 1.05
  body.castShadow = true
  group.add(body)

  const headGeo = new THREE.BoxGeometry(0.55, 0.5, 0.5)
  const headMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.4 })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 1.87
  head.castShadow = true
  group.add(head)

  const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.06)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8 })
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
  eyeL.position.set(-0.13, 1.91, 0.26)
  group.add(eyeL)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.13
  group.add(eyeR)

  const armGeo  = new THREE.BoxGeometry(0.22, 0.62, 0.26)
  const fistGeo = new THREE.BoxGeometry(0.28, 0.22, 0.3)

  const armL = new THREE.Group()
  armL.position.set(-0.52, 1.52, 0)
  const armLMesh = new THREE.Mesh(armGeo, bodyMat)
  armLMesh.position.y = -0.33; armLMesh.castShadow = true
  armL.add(armLMesh)
  const fistLMesh = new THREE.Mesh(fistGeo, bodyMat)
  fistLMesh.position.y = -0.68
  armL.add(fistLMesh)
  group.add(armL)

  const armR = new THREE.Group()
  armR.position.set(0.52, 1.52, 0)
  const armRMesh = new THREE.Mesh(armGeo, bodyMat)
  armRMesh.position.y = -0.33; armRMesh.castShadow = true
  armR.add(armRMesh)
  const fistRMesh = new THREE.Mesh(fistGeo, bodyMat)
  fistRMesh.position.y = -0.68
  armR.add(fistRMesh)
  group.add(armR)

  const legGeo = new THREE.BoxGeometry(0.27, 0.56, 0.3)
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 })

  const legL = new THREE.Group()
  legL.position.set(-0.18, 0.55, 0)
  const legLMesh = new THREE.Mesh(legGeo, legMat)
  legLMesh.position.y = -0.28; legLMesh.castShadow = true
  legL.add(legLMesh)
  group.add(legL)

  const legR = new THREE.Group()
  legR.position.set(0.18, 0.55, 0)
  const legRMesh = legLMesh.clone()
  legRMesh.position.y = -0.28
  legR.add(legRMesh)
  group.add(legR)

  return { group, body, head, armL, armR, legL, legR }
}
type Unit = ReturnType<typeof buildUnit>

// ── Encounter roster ─────────────────────────────────────────────────────
interface EnemyMove { name: string; type: 'attack' | 'defend' | 'heal'; value: number; color: number; label: string }
interface EnemyDef  { name: string; bodyColor: number; accentColor: number; hp: number; moves: EnemyMove[] }

const ENCOUNTERS: EnemyDef[] = [
  {
    name: 'Whelp', bodyColor: 0xb45309, accentColor: 0xd97706, hp: 35,
    moves: [
      { name: 'Scratch', type: 'attack', value: 4, color: 0xef4444, label: '🐾 Scratch · 4 dmg' },
      { name: 'Claw',    type: 'attack', value: 6, color: 0xdc2626, label: '⚔️ Claw · 6 dmg' },
    ],
  },
  {
    name: 'Brute', bodyColor: 0x7f1d1d, accentColor: 0xb91c1c, hp: 70,
    moves: [
      { name: 'Slam',  type: 'attack', value: 8,  color: 0xef4444, label: '💥 Slam · 8 dmg' },
      { name: 'Bite',  type: 'attack', value: 11, color: 0xdc2626, label: '🦷 Bite · 11 dmg' },
      { name: 'Guard', type: 'defend', value: 3,  color: 0x6366f1, label: '🔮 Guard · +3 absorb' },
    ],
  },
  {
    name: 'CORE', bodyColor: 0x1e1b4b, accentColor: 0x4338ca, hp: 120,
    moves: [
      { name: 'Crush',    type: 'attack', value: 10, color: 0xef4444, label: '⚡ Crush · 10 dmg' },
      { name: 'Surge',    type: 'attack', value: 15, color: 0xdc2626, label: '💀 Surge · 15 dmg' },
      { name: 'Fortify',  type: 'defend', value: 5,  color: 0x6366f1, label: '🔮 Fortify · +5 absorb' },
      { name: 'Recharge', type: 'heal',   value: 8,  color: 0x22c55e, label: '💚 Recharge · +8 HP' },
    ],
  },
]

// ── Game entry ────────────────────────────────────────────────────────────
export function startBattle() {
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
  scene.background = new THREE.Color(0x0a0a18)
  scene.fog = new THREE.FogExp2(0x0a0a18, 0.04)

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100)
  camera.position.set(0, 5.5, 8)
  camera.lookAt(0, 0.5, 0)

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
  })

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x4466aa, 0.6)
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
  const floorGeo = new THREE.PlaneGeometry(14, 10)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141428, roughness: 0.85, metalness: 0.1 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const gridPts: THREE.Vector3[] = []
  for (let i = -7; i <= 7; i++)
    gridPts.push(new THREE.Vector3(i, 0.01, -5), new THREE.Vector3(i, 0.01, 5))
  for (let i = -5; i <= 5; i++)
    gridPts.push(new THREE.Vector3(-7, 0.01, i), new THREE.Vector3(7, 0.01, i))
  scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(gridPts),
    new THREE.LineBasicMaterial({ color: 0x2a2a4e, transparent: true, opacity: 0.4 }),
  ))

  const ringGeo = new THREE.RingGeometry(0.6, 0.85, 48)
  const playerRingMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  const enemyRingMat  = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  const playerRing = new THREE.Mesh(ringGeo, playerRingMat)
  playerRing.rotation.x = -Math.PI / 2; playerRing.position.set(-2.5, 0.015, 0)
  scene.add(playerRing)
  const enemyRing = new THREE.Mesh(ringGeo, enemyRingMat)
  enemyRing.rotation.x = -Math.PI / 2; enemyRing.position.set(2.5, 0.015, 0)
  scene.add(enemyRing)

  const playerFloorLight = new THREE.PointLight(0x3b82f6, 0.7, 3.5)
  playerFloorLight.position.set(-2.5, 0.1, 0)
  scene.add(playerFloorLight)
  const enemyFloorLight = new THREE.PointLight(0xef4444, 0.7, 3.5)
  enemyFloorLight.position.set(2.5, 0.1, 0)
  scene.add(enemyFloorLight)

  // ── Units ───────────────────────────────────────────────────────────────
  const player = buildUnit(0x3b82f6, 0x60a5fa)
  player.group.position.set(-2.5, 0, 0)
  player.group.rotation.y = 0.4
  scene.add(player.group)

  const enemy = buildUnit(0xef4444, 0xfca5a5)
  enemy.group.position.set(2.5, 0, 0)
  enemy.group.rotation.y = -0.4
  scene.add(enemy.group)

  // ── Engine systems ──────────────────────────────────────────────────────
  const timer = createTimers()
  const shake = createShake(camera, { maxOffset: 0.15, maxRoll: 0.04, traumaDecay: 1.6 })
  const gameState = createGameState('player_turn')
  const debug = createDebugOverlay(renderer)
  const vfx = createParticles(scene, { max: 400, gravity: new THREE.Vector3(0, -3, 0), drag: 0.4 })

  // ── Stats ────────────────────────────────────────────────────────────────
  const playerStats = createStatBlock({ hp: { base: 60, max: 60 }, absorb: { base: 0, max: 99 } })
  const enemyStats  = createStatBlock({ hp: { base: 50, max: 50 }, absorb: { base: 0, max: 99 } })

  const MAX_ENERGY = 3
  let energy = MAX_ENERGY
  let turnCount = 0

  // ── Deck ─────────────────────────────────────────────────────────────────
  const startingDeck = [
    'strike', 'strike', 'strike', 'strike',
    'slash', 'slash',
    'fireball', 'fireball',
    'block', 'block',
    'barrier',
    'heal', 'heal',
  ]

  const deck = createDeck<GameCard>(startingDeck.map(id => makeCard(id)))
  deck.shuffle()

  const MAX_HOLDS = 1
  const heldIds = new Set<string>()
  let bonusDraw = 0

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const $hand        = document.getElementById('hand')!
  const $energy      = document.getElementById('energy')!
  const $energyPips  = Array.from($energy.querySelectorAll<HTMLDivElement>('.energy-pip'))
  const $apBonus     = document.getElementById('ap-bonus')!
  const $banner      = document.getElementById('banner')!
  const $endTurn     = document.getElementById('end-turn')!
  const $deckInfo    = document.getElementById('deck-info')!
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

  // ── Encounter state ──────────────────────────────────────────────────────
  let ENEMY_MOVES: EnemyMove[] = []
  let encounterIdx = 0
  let enemyNextMove: EnemyMove = ENCOUNTERS[0].moves[0]

  // ── Animation state ──────────────────────────────────────────────────────
  let _animating = false
  const _wp = new THREE.Vector3()
  let _prevPhp = -1, _prevEhp = -1
  let _flashHandle: { cancel(): void } | null = null

  // ── Functions ─────────────────────────────────────────────────────────────

  function worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
    _wp.copy(pos).project(camera)
    return { x: (_wp.x + 1) / 2 * innerWidth, y: (-_wp.y + 1) / 2 * innerHeight }
  }

  function showFloatingNumber(worldPos: THREE.Vector3, text: string, color: string) {
    const { x, y } = worldToScreen(worldPos)
    const el = document.createElement('div')
    el.className = 'dmg-float'
    el.textContent = text
    el.style.color = color
    el.style.left = `${x - 20}px`
    el.style.top  = `${y - 40}px`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 950)
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

    $deckInfo.innerHTML =
      `<span>DRAW</span> ${deck.drawPile.length} &nbsp; <span>DISC</span> ${deck.discardPile.length}`

    $turnCounter.textContent = `TURN ${turnCount}`
  }

  function flash(text: string, duration = 0.8) {
    _flashHandle?.cancel()
    $banner.textContent = text
    $banner.classList.add('show')
    _flashHandle = timer.after(duration, () => { $banner.classList.remove('show'); _flashHandle = null })
  }

  function setAnimating(v: boolean) {
    _animating = v
    $endTurn.classList.toggle('disabled', v || !gameState.is('player_turn'))
  }

  // ── Merge ──────────────────────────────────────────────────────────────

  function findMergeTarget(card: GameCard): GameCard | undefined {
    return deck.hand.find(c => c !== card && c.cardId === card.cardId && c.tier === card.tier)
  }

  function doMerge(card: GameCard) {
    if (_animating || !gameState.is('player_turn')) return
    const target = findMergeTarget(card)
    if (!target || card.tier >= MAX_TIER) return

    const def = cards.require(card.cardId)
    const oldVal = scaledValue(def, card.tier)
    const newTier = card.tier + 1
    const newVal  = scaledValue(def, newTier)

    heldIds.delete(card.id)
    heldIds.delete(target.id)

    deck.play(card.id, false)
    deck.play(target.id, false)
    deck.shelve(makeCard(card.cardId, newTier))

    const pos = player.group.position.clone()
    pos.y += 2.4
    vfx.burst(pos, 24, { speed: 2.0, spread: 0.9, up: 1.4, life: 0.7, size: 0.15, color: 0xf59e0b })
    pos.y += 0.4
    showFloatingNumber(pos, `${def.name} ${TIER_ROMAN[newTier]}  ${oldVal}→${newVal}  ↓ DISC`, '#fcd34d')

    renderHand(true)
  }

  function toggleHold(card: GameCard) {
    if (heldIds.has(card.id)) heldIds.delete(card.id)
    else if (heldIds.size < MAX_HOLDS) heldIds.add(card.id)
    else return
    renderHand()
  }

  // ── Render hand ────────────────────────────────────────────────────────

  function renderHand(deal = false) {
    $hand.innerHTML = ''
    const isPlayerTurn = gameState.is('player_turn')
    const canHoldMore = heldIds.size < MAX_HOLDS

    let dealIdx = 0
    for (const card of deck.hand) {
      const def   = cards.require(card.cardId)
      const val   = scaledValue(def, card.tier)
      const isHeld    = heldIds.has(card.id)
      const hasMerge  = card.tier < MAX_TIER && !!findMergeTarget(card)
      const tierClass = card.tier > 1 ? ` tier-${card.tier}` : ''
      const mergeClass = hasMerge ? ' mergeable' : ''
      const heldClass  = isHeld ? ' held' : ''
      const disabled   = !isPlayerTurn || energy < def.cost || _animating

      const el = document.createElement('div')
      el.className = 'card' + tierClass + mergeClass + heldClass + (disabled ? ' disabled' : '')
      if (deal) {
        el.style.animation = `cardDeal 0.22s ease-out ${dealIdx * 0.06}s both`
        dealIdx++
      }

      el.innerHTML = `
        ${isHeld ? '<span class="hold-badge">HELD</span>' : ''}
        <span class="tier-badge t${card.tier}">${TIER_ROMAN[card.tier]}</span>
        <div class="icon">${def.icon}</div>
        <div class="name">${def.name}</div>
        <div class="desc">${def.desc(val)}</div>
        <div class="cost">⚡ ${def.cost}</div>
      `

      if (isPlayerTurn && !_animating) {
        if (hasMerge) {
          const btn = document.createElement('button')
          btn.className = 'merge-btn'
          btn.textContent = '⬆ MELD'
          btn.addEventListener('click', e => { e.stopPropagation(); doMerge(card) })
          el.appendChild(btn)
        }
        if (isHeld || canHoldMore) {
          const hbtn = document.createElement('button')
          hbtn.className = 'hold-btn'
          hbtn.textContent = isHeld ? '📌 RELEASE' : '📌 HOLD'
          hbtn.addEventListener('click', e => { e.stopPropagation(); toggleHold(card) })
          el.appendChild(hbtn)
        }
      }

      el.addEventListener('click', () => { if (!disabled) playCard(card) })
      $hand.appendChild(el)
    }

    if (isPlayerTurn && energy > 0) {
      $apBonus.textContent = `⚡${energy} left → +${energy} card${energy > 1 ? 's' : ''} next turn`
      $apBonus.classList.add('show')
    } else {
      $apBonus.classList.remove('show')
    }

    updateHUD()
  }

  // ── Animations ──────────────────────────────────────────────────────────

  function animStrike(unit: Unit, targetPos: THREE.Vector3, onHit: () => void) {
    const startX = unit.group.position.x
    const dir = Math.sign(targetPos.x - startX)
    timer.tween(0.09, p => {
      unit.group.position.x = startX - dir * 0.28 * p
      unit.armR.rotation.x = 1.5 * p
      unit.body.rotation.z = -dir * 0.1 * p
    }, {
      onComplete: () => {
        timer.tween(0.12, p => {
          unit.group.position.x = startX - dir * 0.28 + dir * 1.72 * p
          unit.armR.rotation.x = 1.5 - 3.1 * p
          unit.body.rotation.z = -dir * 0.1 * (1 - p)
        }, {
          onComplete: () => {
            onHit()
            const peakX = startX + dir * 1.44
            timer.tween(0.22, p => {
              unit.group.position.x = peakX + (startX - peakX) * p
              unit.armR.rotation.x = -1.6 * (1 - p)
            })
          }
        })
      }
    })
  }

  function animFireball(unit: Unit, targetPos: THREE.Vector3, onHit: () => void) {
    const dir = Math.sign(targetPos.x - unit.group.position.x)
    timer.tween(0.18, p => {
      unit.armL.rotation.x = -p * 2.2
      unit.armR.rotation.x = -p * 2.2
      unit.body.position.y = 1.05 + p * 0.18
      unit.body.rotation.z = -dir * p * 0.1
    }, {
      onComplete: () => {
        const origin = unit.group.position.clone(); origin.y += 1.6
        const proj = origin.clone()
        const travelTime = targetPos.distanceTo(origin) / 20
        timer.tween(travelTime, p => {
          proj.lerpVectors(origin, targetPos, p)
          vfx.burst(proj, 3, { speed: 0.4, spread: 0.3, up: 0.1, life: 0.25, size: 0.12, color: 0xf97316 })
        }, {
          onComplete: () => {
            onHit()
            vfx.burst(targetPos, 25, { speed: 2.5, spread: 1.2, up: 0.8, life: 0.45, size: 0.18, color: 0xf97316 })
          }
        })
        timer.tween(0.14, p => {
          unit.armL.rotation.x = -2.2 * (1 - p)
          unit.armR.rotation.x = -2.2 * (1 - p)
          unit.body.position.y = 1.23 - p * 0.18
          unit.body.rotation.z = -dir * 0.1 * (1 - p)
        })
      }
    })
  }

  function animBlock(unit: Unit, onDone: () => void) {
    timer.tween(0.12, p => {
      unit.group.position.y = -p * 0.3
      unit.armL.rotation.x = -p * 1.5; unit.armR.rotation.x = -p * 1.5
      unit.armL.rotation.z =  p * 0.6; unit.armR.rotation.z = -p * 0.6
    }, {
      onComplete: () => {
        const pos = unit.group.position.clone(); pos.y += 1.2
        vfx.burst(pos, 18, { speed: 1.5, spread: 1.0, up: 0.6, life: 0.5, size: 0.13, color: 0x818cf8 })
        onDone()
        timer.tween(0.18, p => {
          unit.group.position.y   = -0.3 * (1 - p)
          unit.armL.rotation.x = -1.5 * (1 - p); unit.armR.rotation.x = -1.5 * (1 - p)
          unit.armL.rotation.z =  0.6 * (1 - p); unit.armR.rotation.z = -0.6 * (1 - p)
        })
      }
    })
  }

  function animHeal(unit: Unit, onDone: () => void) {
    const base = unit.group.position.clone()
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
    timer.tween(0.32, p => {
      unit.body.position.y = 1.05 + Math.sin(p * Math.PI) * 0.2
      ;(unit.body.material as THREE.MeshStandardMaterial).emissive.setHex(0x22c55e)
      ;(unit.body.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(p * Math.PI) * 1.5
    }, {
      onComplete: () => {
        stream.cancel()
        ;(unit.body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0
        onDone()
      }
    })
  }

  function animHit(unit: Unit) {
    const mat = unit.body.material as THREE.MeshStandardMaterial
    mat.emissive.setHex(0xff2200); mat.emissiveIntensity = 2.5
    timer.tween(0.24, p => { mat.emissiveIntensity = 2.5 * (1 - p) }, {
      onComplete: () => { mat.emissiveIntensity = 0 }
    })
    const x0 = unit.group.position.x
    const dir = Math.sign(x0)
    timer.tween(0.07, p => {
      unit.group.position.x = x0 + dir * 0.32 * p
      unit.body.rotation.z   = dir * 0.18 * p
    }, {
      onComplete: () => {
        timer.tween(0.2, p => {
          unit.group.position.x = x0 + dir * 0.32 * (1 - p)
          unit.body.rotation.z   = dir * 0.18 * (1 - p)
        })
      }
    })
  }

  // ── Damage resolution ────────────────────────────────────────────────────

  function dealDamage(target: StatBlock, amount: number, worldPos?: THREE.Vector3): number {
    const ab = target.get('absorb')
    let absorbed = 0
    if (ab > 0) {
      absorbed = Math.min(ab, amount)
      target.modify('absorb', -absorbed)
      amount -= absorbed
    }
    if (absorbed > 0 && worldPos) {
      const bpos = worldPos.clone(); bpos.y += 0.4
      showFloatingNumber(bpos, `🛡 ${absorbed}`, '#818cf8')
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
    target.modify('hp', amount)
    if (worldPos) {
      showFloatingNumber(worldPos, `✦+${amount}`, '#a5b4fc')
      const healPos = worldPos.clone(); healPos.x += 0.4
      showFloatingNumber(healPos, `+${amount}`, '#4ade80')
    }
  }

  // ── Play a card ──────────────────────────────────────────────────────────

  function playCard(card: GameCard) {
    if (_animating || !gameState.is('player_turn')) return
    const def = cards.require(card.cardId)
    if (energy < def.cost) return

    const val = scaledValue(def, card.tier)
    energy -= def.cost
    deck.play(card.id, true)
    setAnimating(true)
    renderHand()

    const targetPos = enemy.group.position.clone()
    targetPos.y += 1

    function done() {
      setAnimating(false)
      renderHand()
      checkDeath()
    }

    const safety = timer.after(3.0, () => { if (_animating) done() })

    const enemyHeadPos = enemy.group.position.clone(); enemyHeadPos.y += 2.2
    const playerHeadPos = player.group.position.clone(); playerHeadPos.y += 2.2

    if (def.type === 'attack') {
      const anim = val >= 8 ? animFireball : animStrike
      anim(player, targetPos, () => {
        dealDamage(enemyStats, val, enemyHeadPos)
        shake.addTrauma(0.3)
        animHit(enemy)
        vfx.burst(targetPos, 12, { speed: 1.8, spread: 0.8, up: 0.3, life: 0.4, size: 0.12, color: def.color })
        updateHUD()
        timer.after(0.22, () => { safety.cancel(); done() })
      })
    } else if (def.type === 'defend') {
      animBlock(player, () => {
        dealAbsorb(playerStats, val, playerHeadPos)
        updateHUD()
        timer.after(0.12, () => { safety.cancel(); done() })
      })
    } else {
      animHeal(player, () => {
        dealHeal(playerStats, val, playerHeadPos)
        updateHUD()
        timer.after(0.12, () => { safety.cancel(); done() })
      })
    }
  }

  // ── Encounter ────────────────────────────────────────────────────────────

  function startEncounter(idx: number) {
    const def = ENCOUNTERS[idx]
    encounterIdx = idx
    ENEMY_MOVES = def.moves
    enemyNextMove = def.moves[0]

    enemyStats.setMax('hp', def.hp)
    enemyStats.set('hp', def.hp)
    enemyStats.set('absorb', 0)
    ;(enemy.body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0
    ;(enemy.body.material as THREE.MeshStandardMaterial).color.setHex(def.bodyColor)
    ;(enemy.head.material as THREE.MeshStandardMaterial).color.setHex(def.accentColor)
    enemyRingMat.color.setHex(def.bodyColor)
    enemyFloorLight.color.setHex(def.bodyColor)

    $enemyName.textContent = def.name
    $encounterInfo.textContent = `ENC ${idx + 1} / ${ENCOUNTERS.length}`

    updateHUD()
    startPlayerTurn()
  }

  function pickEnemyIntent() {
    enemyNextMove = ENEMY_MOVES[Math.floor(Math.random() * ENEMY_MOVES.length)]
    $intentText.textContent = enemyNextMove.label
  }

  // ── Enemy turn ───────────────────────────────────────────────────────────

  function enemyTurn() {
    gameState.set('enemy_turn')
    setAnimating(true)
    $energyPips.forEach(p => p.classList.add('spent'))
    $hand.classList.add('dimmed')
    $enemyIntent.classList.remove('show')
    flash('FOE\'S TURN')

    timer.after(0.4, () => {
      const move = enemyNextMove
      const targetPos = player.group.position.clone()
      targetPos.y += 1

      function done() {
        setAnimating(false)
        updateHUD()
        if (!checkDeath()) timer.after(0.3, startPlayerTurn)
      }

      const safety = timer.after(3.0, () => { if (_animating) done() })

      const playerHeadPos = player.group.position.clone(); playerHeadPos.y += 2.2
      const enemyHeadPos  = enemy.group.position.clone();  enemyHeadPos.y += 2.2

      if (move.type === 'attack') {
        const anim = move.value >= 7 ? animFireball : animStrike
        anim(enemy, targetPos, () => {
          dealDamage(playerStats, move.value, playerHeadPos)
          shake.addTrauma(0.2 + move.value / 28)
          animHit(player)
          $hitVignette.classList.remove('flash'); void $hitVignette.offsetWidth; $hitVignette.classList.add('flash')
          vfx.burst(targetPos, 10, { speed: 1.5, spread: 0.7, up: 0.3, life: 0.4, size: 0.11, color: move.color })
          flash(`${move.name}!`, 0.6)
          updateHUD()
          timer.after(0.28, () => { safety.cancel(); done() })
        })
      } else if (move.type === 'heal') {
        animHeal(enemy, () => {
          dealHeal(enemyStats, move.value, enemyHeadPos)
          flash(`${move.name}! ✦`, 0.5)
          updateHUD()
          timer.after(0.12, () => { safety.cancel(); done() })
        })
      } else {
        animBlock(enemy, () => {
          dealAbsorb(enemyStats, move.value, enemyHeadPos)
          flash(`${move.name}! ✦`, 0.5)
          updateHUD()
          timer.after(0.18, () => { safety.cancel(); done() })
        })
      }
    })
  }

  // ── Player turn ──────────────────────────────────────────────────────────

  function startPlayerTurn() {
    turnCount++
    energy = MAX_ENERGY
    playerStats.set('absorb', 0)
    enemyStats.set('absorb', 0)

    const handSnapshot = [...deck.hand]
    for (const c of handSnapshot) {
      if (!heldIds.has(c.id)) deck.discard(c.id)
    }
    const heldCount = deck.hand.length
    const slots = Math.max(0, 4 - heldCount + bonusDraw)
    bonusDraw = 0
    if (deck.drawPile.length < slots) deck.reshuffle()
    deck.draw(Math.min(slots, deck.drawPile.length))

    gameState.set('player_turn')
    setAnimating(false)
    $hand.classList.remove('dimmed')
    pickEnemyIntent()
    timer.after(0.45, () => $enemyIntent.classList.add('show'))
    flash(`TURN ${turnCount}`, 0.6)
    renderHand(true)
  }

  $endTurn.addEventListener('click', () => {
    if (!gameState.is('player_turn') || _animating) return
    $endTurn.classList.add('disabled')
    bonusDraw = Math.min(energy, 2)
    $hand.innerHTML = ''
    $apBonus.classList.remove('show')
    enemyTurn()
  })

  // ── Death check ──────────────────────────────────────────────────────────

  function checkDeath(): boolean {
    if (enemyStats.get('hp') <= 0) {
      gameState.set('resting')
      timer.after(0.65, () => {
        if (encounterIdx < ENCOUNTERS.length - 1) {
          const heal = Math.max(5, 25 - encounterIdx * 10)
          playerStats.modify('hp', heal)
          const healPos = player.group.position.clone(); healPos.y += 2.4
          showFloatingNumber(healPos, `+${heal} HP`, '#4ade80')
          flash(`ENC ${encounterIdx + 1} CLEARED! ⚡`, 1.3)
          updateHUD()
          timer.after(1.8, () => startEncounter(encounterIdx + 1))
        } else {
          gameState.set('game_over')
          $goTitle.textContent = 'VICTORY'
          $goTitle.style.color = '#22d3ee'
          $goSub.textContent = `All ${ENCOUNTERS.length} encounters cleared in ${turnCount} turns`
          $gameOver.classList.add('show')
        }
      })
      return true
    }
    if (playerStats.get('hp') <= 0) {
      gameState.set('resting')
      timer.after(0.65, () => {
        gameState.set('game_over')
        $goTitle.textContent = 'DEFEATED'
        $goTitle.style.color = '#ef4444'
        $goSub.textContent = `Fell in enc ${encounterIdx + 1} · turn ${turnCount}`
        $gameOver.classList.add('show')
      })
      return true
    }
    return false
  }

  // ── Restart ──────────────────────────────────────────────────────────────

  $goRestart.addEventListener('click', () => {
    $gameOver.classList.remove('show')
    playerStats.set('hp', playerStats.getMax('hp')!)
    energy = MAX_ENERGY
    turnCount = 0
    bonusDraw = 0
    heldIds.clear()
    $hand.classList.remove('dimmed')
    $enemyIntent.classList.remove('show')
    deck.reinit(startingDeck.map(id => makeCard(id)))
    deck.shuffle()
    startEncounter(0)
  })

  // ── Idle animations ──────────────────────────────────────────────────────

  function idleBob(unit: Unit, t: number, offset: number) {
    if (_animating) return
    const s  = Math.sin(t * 2 + offset)
    const sw = Math.sin(t * 1.6 + offset)
    unit.body.position.y = 1.05 + s * 0.04
    unit.head.position.y = 1.87 + s * 0.04
    unit.head.rotation.z = s * 0.03
    unit.armL.rotation.x =  sw * 0.14
    unit.armR.rotation.x = -sw * 0.14
    unit.legL.rotation.x = -sw * 0.13
    unit.legR.rotation.x =  sw * 0.13
  }

  // ── Render loop ──────────────────────────────────────────────────────────

  let prev = performance.now()

  function frame() {
    requestAnimationFrame(frame)
    const now = performance.now()
    const dt = Math.min((now - prev) / 1000, 0.1)
    prev = now

    const t = now / 1000

    timer.update(dt)
    vfx.update(dt)
    shake.update(dt)
    debug.update(dt)

    idleBob(player, t, 0)
    idleBob(enemy, t, 2)

    rim.intensity = 2 + Math.sin(t * 0.8) * 0.5

    const ringPulse = 0.18 + Math.sin(t * 1.4) * 0.07
    playerRingMat.opacity = ringPulse
    enemyRingMat.opacity  = ringPulse

    renderer.render(scene, camera)
  }

  requestAnimationFrame(frame)

  // ── Debug ────────────────────────────────────────────────────────────────

  ;(window as any).meld = {
    get animating() { return _animating },
    get state() { return gameState.get() },
    get energy() { return energy },
    deck, playerStats, enemyStats, gameState, cards, timer, vfx, shake,
    playCard, renderHand, updateHUD, doMerge, findMergeTarget, scaledValue,
    toggleHold, heldIds, bonusDraw: () => bonusDraw,
  }

  // ── Kick off ─────────────────────────────────────────────────────────────

  startEncounter(0)
}
