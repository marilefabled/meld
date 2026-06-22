import * as THREE from 'three'
import { createTimers } from './engine/timer.js'
import { createShake } from './engine/shake.js'
import { createDeck } from './engine/deck.js'
import { createStatBlock, type StatBlock } from './engine/stats.js'
import { createGameState } from './engine/gameState.js'
import { createParticles } from './engine/particles.js'
import { createDebugOverlay } from './engine/debugOverlay.js'
import { createRegistry } from './engine/registry.js'
import { CARD_DATA, TIER_ROMAN, MAX_TIER, makeCard, scaledValue, type CardDef, type GameCard } from './data/cards.js'
import { ENCOUNTERS, type EnemyMove } from './data/encounters.js'
import { buildUnit, type Unit } from './view/unit.js'
import { sfx } from './sfx.js'

const cards = createRegistry<CardDef>('cards')
cards.loadAll(CARD_DATA)

// ── Game entry ────────────────────────────────────────────────────────────
export type PlayerClass = 'warrior' | 'mage' | 'rogue'

const CLASS_CONFIGS: Record<PlayerClass, { hp: number; deck: string[] }> = {
  warrior: {
    hp: 70,
    deck: [
      'strike', 'strike', 'strike', 'strike',
      'slash', 'slash',
      'fireball',
      'block', 'block', 'block', 'block',
      'barrier', 'barrier',
    ],
  },
  mage: {
    hp: 50,
    deck: [
      'strike', 'strike',
      'slash',
      'fireball', 'fireball', 'fireball', 'fireball',
      'block', 'block',
      'barrier', 'barrier', 'barrier', 'barrier',
    ],
  },
  rogue: {
    hp: 60,
    deck: [
      'strike', 'strike',
      'slash', 'slash', 'slash', 'slash', 'slash',
      'fireball',
      'block', 'block', 'block',
      'barrier', 'barrier',
    ],
  },
}

export function startBattle({ playerClass = 'warrior' as PlayerClass, startFrom = 0 }: { playerClass?: PlayerClass; startFrom?: number } = {}) {
  const classConfig = CLASS_CONFIGS[playerClass]
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
  const playerStats = createStatBlock({
    hp:         { base: classConfig.hp, max: classConfig.hp },
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

  const deck = createDeck<GameCard>(startingDeck.map(id => makeCard(id)))
  deck.shuffle()

  const MAX_HOLDS = 2
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
  const $statusPlayer  = document.getElementById('status-player')!
  const $statusEnemy   = document.getElementById('status-enemy')!

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

    renderStatuses($statusPlayer, playerStats)
    renderStatuses($statusEnemy, enemyStats)
  }

  function renderStatuses(el: HTMLElement, stats: StatBlock) {
    el.innerHTML = ''
    const defs = [
      { key: 'vulnerable', cls: 'vulnerable', icon: '💔', label: 'VULN' },
      { key: 'poison',     cls: 'poison',     icon: '☠',  label: 'PSNS' },
      { key: 'weak',       cls: 'weak',        icon: '💀', label: 'WEAK' },
    ]
    for (const d of defs) {
      const n = stats.get(d.key)
      if (n <= 0) continue
      const pill = document.createElement('span')
      pill.className = `status-pill ${d.cls}`
      pill.textContent = `${d.icon} ${d.label} ${n}`
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
    const meldCost = Math.min(def.cost * 2, MAX_ENERGY)
    if (energy < meldCost) return

    const oldVal = scaledValue(def, card.tier)
    const newTier = card.tier + 1
    const newVal  = scaledValue(def, newTier)

    energy -= meldCost
    heldIds.delete(card.id)
    heldIds.delete(target.id)

    deck.play(card.id, false)
    deck.play(target.id, false)
    deck.shelve(makeCard(card.cardId, newTier))

    sfx.meld()
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
        <div class="desc">${def.desc(val, card.tier)}</div>
        <div class="cost">⚡ ${def.cost}</div>
      `

      if (isPlayerTurn && !_animating) {
        if (hasMerge) {
          const meldCost = Math.min(def.cost * 2, MAX_ENERGY)
          const canAfford = energy >= meldCost
          const btn = document.createElement('button')
          btn.className = 'merge-btn'
          btn.textContent = `⬆ MELD (${meldCost}⚡)`
          btn.disabled = !canAfford
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
      unit.body.material.emissive.setHex(0x22c55e)
      unit.body.material.emissiveIntensity = Math.sin(p * Math.PI) * 1.5
    }, {
      onComplete: () => {
        stream.cancel()
        unit.body.material.emissiveIntensity = 0
        onDone()
      }
    })
  }

  function animHit(unit: Unit) {
    const mat = unit.body.material
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
    if (target.get('vulnerable') > 0) amount = Math.ceil(amount * 1.5)
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
    },
  ) {
    const { safety, trauma = 0.25, postDelay = 0.22, onLand } = opts
    const commit = () => { safety.cancel(); done() }
    const targetPos  = target.group.position.clone(); targetPos.y += 1
    const actorHdPos = actor.group.position.clone();  actorHdPos.y += 2.2
    const targetHdPos = target.group.position.clone(); targetHdPos.y += 2.2

    const dmgValue = type === 'attack' && actorStats.get('weak') > 0
      ? Math.floor(value * 0.75) : value

    if (type === 'attack') {
      ;(value >= 8 ? animFireball : animStrike)(actor, targetPos, () => {
        dealDamage(targetStats, dmgValue, targetHdPos)
        shake.addTrauma(trauma)
        animHit(target)
        vfx.burst(targetPos, 12, { speed: 1.8, spread: 0.8, up: 0.3, life: 0.4, size: 0.12, color })
        onLand?.()
        updateHUD()
        timer.after(postDelay, commit)
      })
    } else if (type === 'defend') {
      animBlock(actor, () => {
        dealAbsorb(actorStats, value, actorHdPos)
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
    if (energy < def.cost) return

    const val = scaledValue(def, card.tier)
    energy -= def.cost
    deck.play(card.id, true)
    setAnimating(true)
    renderHand()
    sfx.cardPlay()

    function done() { setAnimating(false); renderHand(); checkDeath() }
    const safety = timer.after(3.0, () => { if (_animating) done() })

    const tierIIIStatus = card.tier === MAX_TIER ? def.tierIIIStatus : undefined

    executeAction(player, playerStats, enemy, enemyStats, def.type, val, def.color, done, {
      safety,
      trauma:     0.3,
      postDelay:  0.22,
      healAmount: def.type === 'defend' ? (card.tier >= 2 ? val : 0) : undefined,
      onLand: () => {
        if (def.type === 'attack') sfx.hit()
        else if (def.type === 'defend') sfx.shield()
        else sfx.heal()
        if (tierIIIStatus) {
          const statusStats = tierIIIStatus.target === 'enemy' ? enemyStats : playerStats
          statusStats.modify(tierIIIStatus.kind, tierIIIStatus.stacks)
          const label = tierIIIStatus.kind === 'poison'     ? '☠ IGNITE'
                      : tierIIIStatus.kind === 'vulnerable' ? '💔 BLEED'
                      : '💀 WEAKENED'
          flash(label, 0.7)
        }
      },
    })
  }

  // ── Encounter ────────────────────────────────────────────────────────────

  function startEncounter(idx: number) {
    const def = ENCOUNTERS[idx]
    encounterIdx = idx
    ENEMY_MOVES = def.moves

    enemyStats.setMax('hp', def.hp)
    enemyStats.set('hp', def.hp)
    enemyStats.set('absorb', 0)
    for (const s of ['vulnerable', 'poison', 'weak'] as const) {
      playerStats.set(s, 0)
      enemyStats.set(s, 0)
    }
    enemy.body.material.emissiveIntensity = 0
    enemy.body.material.color.setHex(def.bodyColor)
    enemy.head.material.color.setHex(def.accentColor)
    enemyRingMat.color.setHex(def.bodyColor)
    enemyFloorLight.color.setHex(def.bodyColor)

    $enemyName.textContent = def.name
    $encounterInfo.textContent = `ENC ${idx + 1} / ${ENCOUNTERS.length}`

    pickEnemyIntent()
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

      executeAction(enemy, enemyStats, player, playerStats, move.type, move.value, move.color, done, {
        safety,
        trauma:    0.2 + move.value / 28,
        postDelay: 0.28,
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
    const playerPoison = playerStats.get('poison')
    if (playerPoison > 0) {
      const pos = player.group.position.clone(); pos.y += 2.2
      dealDamage(playerStats, playerPoison, pos)
      playerStats.modify('poison', -1)
      animHit(player)
    }
    const enemyPoison = enemyStats.get('poison')
    if (enemyPoison > 0) {
      const pos = enemy.group.position.clone(); pos.y += 2.2
      dealDamage(enemyStats, enemyPoison, pos)
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
    timer.after(0.45, () => $enemyIntent.classList.add('show'))
    flash(`TURN ${turnCount}`, 0.6)
    renderHand(true)
  }

  $endTurn.addEventListener('click', () => {
    if (!gameState.is('player_turn') || _animating) return
    $endTurn.classList.add('disabled')
    bonusDraw = energy
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
          sfx.victory()
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
        sfx.defeat()
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

  startEncounter(startFrom)
}
