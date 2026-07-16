import { CARD_DATA, MAX_TIER, makeCard, getVariant, DEFAULT_BUILD, type CardBuild, type GameCard } from '../data/cards.js'
import { ENCOUNTERS } from '../data/encounters.js'
import { CLASS_CONFIGS, type PlayerClass } from '../data/classes.js'
import type { EnemyMove, EnemyTrait } from '../data/encounters.js'

// ── Constants (must mirror battle.ts) ────────────────────────────────────────
const MAX_ENERGY = 3
const HAND_SIZE  = 4
const MAX_HOLDS  = 2

// ── RNG ──────────────────────────────────────────────────────────────────────
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── State ────────────────────────────────────────────────────────────────────
export interface SimCtx {
  playerHp:         number
  playerMaxHp:      number
  playerAbsorb:     number
  playerPoison:     number
  playerVulnerable: number
  playerWeak:       number
  enemyHp:          number
  enemyMaxHp:       number
  enemyAbsorb:      number
  enemyPoison:      number
  enemyVulnerable:  number
  enemyWeak:        number
  enemyTraits:      EnemyTrait[]
  hand:    GameCard[]
  energy:  number
  encIdx:  number
}

export type SimAction =
  | { type: 'play'; card: GameCard }
  | { type: 'meld'; a: GameCard; b: GameCard }
  | { type: 'end' }

export type Strategy = (ctx: SimCtx) => SimAction

// ── Results ──────────────────────────────────────────────────────────────────
export interface SimResult {
  won:       boolean
  turns:     number
  finalHp:   number
  meldCount: number
  deathEnc:  number  // -1 = won, 0/1/2 = encounter where player died
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isImmuneTo(traits: EnemyTrait[], status: string): boolean {
  return traits.some(t => t.kind === 'immune' && t.statuses.includes(status as never))
}

function dealDamage(
  amount: number, absorb: number, vulnerable: boolean, weak: boolean,
): { hpDmg: number; absorbLeft: number } {
  if (weak)       amount = Math.floor(amount * 0.75)
  if (vulnerable) amount = Math.ceil(amount * 1.5)
  const absorbed = Math.min(absorb, amount)
  return { hpDmg: amount - absorbed, absorbLeft: absorb - absorbed }
}

function meldCost(cardId: string): number {
  const def = CARD_DATA[cardId]
  return Math.min((def?.cost ?? 1) * 2, MAX_ENERGY)
}

function chooseHolds(
  hand: GameCard[],
  drawPile: GameCard[],
  discard: GameCard[],
  build: CardBuild,
): Set<string> {
  const future = [...drawPile, ...discard]
  const scored = hand.map(card => {
    const def = CARD_DATA[card.cardId]
    const variant = def ? getVariant(def, card.tier, build, card.cardId) : null
    const sameInHand = hand.filter(other => other !== card && other.cardId === card.cardId && other.tier === card.tier).length
    const futureMates = future.filter(other => other.cardId === card.cardId && other.tier === card.tier).length
    const canMeld = card.tier < MAX_TIER
    const effectValue = variant
      ? variant.value + (variant.heal ?? 0) + (variant.status?.stacks ?? 0) * 2
      : 0
    const score = (canMeld && sameInHand > 0 ? 100 : 0)
      + (canMeld && futureMates > 0 ? 45 : 0)
      + card.tier * 6
      + effectValue
    return { card, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return new Set(scored.slice(0, MAX_HOLDS).map(entry => entry.card.id))
}

function pickEnemyMove(
  moves: EnemyMove[],
  hp: number,
  maxHp: number,
  lastPlayerDamage: number,
  lastMoveName: string,
  rand: () => number,
): EnemyMove {
  const hpFrac = hp / Math.max(1, maxHp)
  const weighted = moves.map(move => {
    let weight = move.weight ?? 1
    if (move.type === 'heal') {
      if (hpFrac > 0.7) weight = 0
      else if (hpFrac > 0.45) weight *= 0.6
      else weight *= 2.4
    }
    if (move.type === 'defend') {
      weight *= lastPlayerDamage >= maxHp * 0.18 ? 2.2 : 0.7
    }
    if (move.name === lastMoveName) weight *= 0.35
    return { move, weight: Math.max(0, weight) }
  })
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  if (total <= 0) return moves[Math.floor(rand() * moves.length)]

  let roll = rand() * total
  for (const entry of weighted) {
    roll -= entry.weight
    if (roll <= 0) return entry.move
  }
  return weighted[weighted.length - 1].move
}

export function findPairs(hand: GameCard[]): [GameCard, GameCard][] {
  const seen = new Map<string, GameCard>()
  const pairs: [GameCard, GameCard][] = []
  for (const card of hand) {
    if (card.tier >= MAX_TIER) continue
    const key  = `${card.cardId}:${card.tier}`
    const mate = seen.get(key)
    if (mate) { pairs.push([mate, card]); seen.delete(key) }
    else seen.set(key, card)
  }
  return pairs
}

// ── Sim core ─────────────────────────────────────────────────────────────────
export function runSim(
  playerClass: PlayerClass,
  startFrom:   number,
  strategy:    Strategy,
  rand:        () => number,
  build:       CardBuild = DEFAULT_BUILD,
  deckIds:     string[] = CLASS_CONFIGS[playerClass].deck,
): SimResult {
  const cfg   = CLASS_CONFIGS[playerClass]
  let playerHp         = cfg.hp
  const playerMaxHp    = cfg.hp
  let playerAbsorb     = 0
  let playerPoison     = 0, playerVulnerable = 0, playerWeak = 0

  let drawPile: GameCard[] = shuffle(deckIds.map(id => makeCard(id)), rand)
  let hand:     GameCard[] = []
  let discard:  GameCard[] = []
  let heldIds = new Set<string>()
  let bonusDraw = 0

  let turns     = 0
  let meldCount = 0

  function drawN(n: number) {
    for (let i = 0; i < n; i++) {
      if (drawPile.length === 0) {
        if (discard.length === 0) break
        drawPile = shuffle([...discard], rand); discard = []
      }
      hand.push(drawPile.pop()!)
    }
  }

  function removeFromHand(card: GameCard) {
    const i = hand.indexOf(card)
    if (i !== -1) hand.splice(i, 1)
    heldIds.delete(card.id)
  }

  for (let encIdx = startFrom; encIdx < ENCOUNTERS.length; encIdx++) {
    const enc = ENCOUNTERS[encIdx]
    let enemyHp      = enc.hp
    const enemyMaxHp = enc.hp
    let enemyAbsorb  = 0
    let enemyPoison  = 0, enemyVulnerable = 0, enemyWeak = 0
    const enemyTraits: EnemyTrait[] = enc.traits ?? []

    heldIds.clear()
    bonusDraw = 0

    playerAbsorb = 0
    playerPoison = 0; playerVulnerable = 0; playerWeak = 0

    let lastMoveName = ''
    let lastPlayerDamage = 0
    let encMove = pickEnemyMove(enc.moves, enemyHp, enemyMaxHp, lastPlayerDamage, lastMoveName, rand)
    lastMoveName = encMove.name

    while (playerHp > 0 && enemyHp > 0) {
      turns++

      playerAbsorb = 0

      if (playerPoison > 0) {
        const poisonDamage = playerVulnerable > 0 ? Math.ceil(playerPoison * 1.5) : playerPoison
        playerHp -= poisonDamage; playerPoison--
        if (playerHp <= 0) break
      }
      if (enemyPoison > 0) {
        const poisonDamage = enemyVulnerable > 0 ? Math.ceil(enemyPoison * 1.5) : enemyPoison
        enemyHp -= poisonDamage; enemyPoison--
        if (enemyHp <= 0) break
      }
      if (playerVulnerable > 0) playerVulnerable--
      if (playerWeak       > 0) playerWeak--
      if (enemyVulnerable  > 0) enemyVulnerable--
      if (enemyWeak        > 0) enemyWeak--

      const held = hand.filter(card => heldIds.has(card.id))
      discard.push(...hand.filter(card => !heldIds.has(card.id)))
      hand = held
      drawN(Math.max(0, HAND_SIZE - hand.length + bonusDraw))
      bonusDraw = 0

      const enemyHpBeforeActions = enemyHp

      let energy    = MAX_ENERGY
      let safetyLimit = 50
      while (energy > 0 && safetyLimit-- > 0) {
        const ctx: SimCtx = {
          playerHp, playerMaxHp, playerAbsorb, playerPoison, playerVulnerable, playerWeak,
          enemyHp, enemyMaxHp, enemyAbsorb, enemyPoison, enemyVulnerable, enemyWeak,
          enemyTraits,
          hand, energy, encIdx,
        }
        const action = strategy(ctx)

        if (action.type === 'end') { bonusDraw = energy; break }

        if (action.type === 'meld') {
          const { a, b } = action
          const cost = meldCost(a.cardId)
          if (energy < cost) { bonusDraw = energy; break }
          removeFromHand(a); removeFromHand(b)
          discard.push(makeCard(a.cardId, a.tier + 1))
          drawN(1)
          energy -= cost
          meldCount++
          continue
        }

        if (action.type === 'play') {
          const card = action.card
          const def  = CARD_DATA[card.cardId]
          if (!def || energy < def.cost) { bonusDraw = energy; break }
          removeFromHand(card)
          discard.push(card)
          energy -= def.cost

          const variant = getVariant(def, card.tier, build, card.cardId)
          const val     = variant.value

          if (def.type === 'attack') {
            let dmg = val
            if (playerWeak > 0) dmg = Math.floor(dmg * 0.75)
            const r = dealDamage(dmg, enemyAbsorb, enemyVulnerable > 0, false)
            enemyHp -= r.hpDmg; enemyAbsorb = r.absorbLeft

            if (variant.status?.target === 'enemy') {
              const { kind, stacks } = variant.status
              if (!isImmuneTo(enemyTraits, kind)) {
                if (kind === 'poison')     enemyPoison     += stacks
                if (kind === 'vulnerable') enemyVulnerable += stacks
                if (kind === 'weak')       enemyWeak       += stacks
              }
            }
            if (variant.heal) playerHp = Math.min(playerHp + variant.heal, playerMaxHp)

          } else if (def.type === 'defend') {
            if (val > 0) playerAbsorb += val
            if (variant.heal) playerHp = Math.min(playerHp + variant.heal, playerMaxHp)
            if (variant.retaliate) {
              const r = dealDamage(variant.retaliate, enemyAbsorb, enemyVulnerable > 0, false)
              enemyHp -= r.hpDmg; enemyAbsorb = r.absorbLeft
            }
            if (variant.status?.target === 'enemy') {
              const { kind, stacks } = variant.status
              if (!isImmuneTo(enemyTraits, kind)) {
                if (kind === 'weak')        enemyWeak        += stacks
                if (kind === 'vulnerable')  enemyVulnerable  += stacks
                if (kind === 'poison')      enemyPoison      += stacks
              }
            }
          }
          if (variant.selfDamage) playerHp -= variant.selfDamage
          if (enemyHp <= 0) break
        }
      }

      heldIds = chooseHolds(hand, drawPile, discard, build)

      if (enemyHp <= 0) break

      lastPlayerDamage = Math.max(0, enemyHpBeforeActions - enemyHp)

      for (const trait of enemyTraits) {
        if (trait.kind === 'armored') enemyAbsorb += trait.absorb
        if (trait.kind === 'regen') enemyHp = Math.min(enemyHp + trait.hp, enemyMaxHp)
      }

      if (encMove.type === 'attack') {
        const r = dealDamage(encMove.value, playerAbsorb, playerVulnerable > 0, enemyWeak > 0)
        playerHp -= r.hpDmg; playerAbsorb = r.absorbLeft
        if (encMove.status?.target === 'player') {
          const { kind, stacks } = encMove.status
          if (kind === 'poison')     playerPoison     += stacks
          if (kind === 'vulnerable') playerVulnerable += stacks
          if (kind === 'weak')       playerWeak       += stacks
        }
      } else if (encMove.type === 'defend') {
        enemyAbsorb += encMove.value
      } else if (encMove.type === 'heal') {
        enemyHp = Math.min(enemyHp + encMove.value, enemyMaxHp)
      }

      if (playerHp <= 0) break

      encMove = pickEnemyMove(enc.moves, enemyHp, enemyMaxHp, lastPlayerDamage, lastMoveName, rand)
      lastMoveName = encMove.name
    }

    if (playerHp <= 0) {
      return { won: false, turns, finalHp: playerHp, meldCount, deathEnc: encIdx }
    }

    if (encIdx < ENCOUNTERS.length - 1) {
      const heal = Math.max(5, 25 - encIdx * 10)
      playerHp = Math.min(playerHp + heal, playerMaxHp)
    }
  }

  return { won: true, turns, finalHp: playerHp, meldCount, deathEnc: -1 }
}
