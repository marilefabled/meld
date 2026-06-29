import { CARD_DATA, MAX_TIER, makeCard, getVariant, DEFAULT_BUILD, type CardBuild, type GameCard } from '../data/cards.js'
import { ENCOUNTERS } from '../data/encounters.js'
import { CLASS_CONFIGS, type PlayerClass } from '../data/classes.js'
import type { EnemyTrait } from '../data/encounters.js'

// ── Constants (must mirror battle.ts) ────────────────────────────────────────
const MAX_ENERGY = 3
const HAND_SIZE  = 4

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
): SimResult {
  const cfg   = CLASS_CONFIGS[playerClass]
  let playerHp         = cfg.hp
  const playerMaxHp    = cfg.hp
  let playerAbsorb     = 0
  let playerPoison     = 0, playerVulnerable = 0, playerWeak = 0

  let drawPile: GameCard[] = shuffle(cfg.deck.map(id => makeCard(id)), rand)
  let hand:     GameCard[] = []
  let discard:  GameCard[] = []

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
  }

  for (let encIdx = startFrom; encIdx < ENCOUNTERS.length; encIdx++) {
    const enc = ENCOUNTERS[encIdx]
    let enemyHp      = enc.hp
    const enemyMaxHp = enc.hp
    let enemyAbsorb  = 0
    let enemyPoison  = 0, enemyVulnerable = 0, enemyWeak = 0
    const enemyTraits: EnemyTrait[] = enc.traits ?? []

    playerAbsorb = 0
    playerPoison = 0; playerVulnerable = 0; playerWeak = 0

    let encMove = enc.moves[Math.floor(rand() * enc.moves.length)]

    while (playerHp > 0 && enemyHp > 0) {
      turns++

      playerAbsorb = 0

      if (playerPoison > 0) {
        const { hpDmg, absorbLeft } = dealDamage(playerPoison, playerAbsorb, playerVulnerable > 0, false)
        playerHp -= hpDmg; playerAbsorb = absorbLeft; playerPoison--
        if (playerHp <= 0) break
      }
      if (enemyPoison > 0) {
        const { hpDmg, absorbLeft } = dealDamage(enemyPoison, enemyAbsorb, enemyVulnerable > 0, false)
        enemyHp -= hpDmg; enemyAbsorb = absorbLeft; enemyPoison--
        if (enemyHp <= 0) break
      }
      if (playerVulnerable > 0) playerVulnerable--
      if (playerWeak       > 0) playerWeak--
      if (enemyVulnerable  > 0) enemyVulnerable--
      if (enemyWeak        > 0) enemyWeak--

      discard.push(...hand); hand = []
      drawN(HAND_SIZE)

      let energy    = MAX_ENERGY
      let bonusDraw = 0

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
              if (variant.status.kind === 'poison')     enemyPoison     += variant.status.stacks
              if (variant.status.kind === 'vulnerable') enemyVulnerable += variant.status.stacks
            }
            if (variant.selfDamage) playerHp -= variant.selfDamage

          } else if (def.type === 'defend') {
            if (val > 0) playerAbsorb += val
            if (variant.heal) playerHp = Math.min(playerHp + variant.heal, playerMaxHp)
            if (variant.status?.target === 'enemy') {
              const { kind, stacks } = variant.status
              if (!isImmuneTo(enemyTraits, kind)) {
                if (kind === 'weak')        enemyWeak        += stacks
                if (kind === 'vulnerable')  enemyVulnerable  += stacks
              }
            }
          }
        }
      }

      if (enemyHp <= 0) break

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

      drawN(bonusDraw)
      encMove = enc.moves[Math.floor(rand() * enc.moves.length)]
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
