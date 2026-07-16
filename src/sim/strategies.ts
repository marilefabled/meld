import { CARD_DATA, DEFAULT_BUILD, getVariant } from '../data/cards.js'
import { findPairs, type SimCtx, type Strategy } from './battleSim.js'

function cardHasStatus(cardId: string, tier: number, kind: 'weak' | 'vulnerable' | 'poison'): boolean {
  const def = CARD_DATA[cardId]
  if (!def) return false
  const variant = getVariant(def, tier, DEFAULT_BUILD, cardId)
  return variant.status?.kind === kind && variant.status.target === 'enemy'
}

function enemyIsImmuneTo(ctx: SimCtx, kind: 'weak' | 'vulnerable' | 'poison'): boolean {
  return ctx.enemyTraits.some(t => t.kind === 'immune' && t.statuses.includes(kind))
}

function playable(ctx: SimCtx, type: 'attack' | 'defend') {
  return ctx.hand.filter(card => {
    const def = CARD_DATA[card.cardId]
    return def?.type === type && def.cost <= ctx.energy
  })
}

function strongest(cards: SimCtx['hand']) {
  return [...cards].sort((a, b) => {
    const da = CARD_DATA[a.cardId]
    const db = CARD_DATA[b.cardId]
    const va = da ? getVariant(da, a.tier, DEFAULT_BUILD, a.cardId).value : 0
    const vb = db ? getVariant(db, b.tier, DEFAULT_BUILD, b.cardId).value : 0
    return vb - va
  })
}

export function greedyStrategy(ctx: SimCtx): ReturnType<Strategy> {
  const attacks = strongest(playable(ctx, 'attack'))
  if (attacks.length > 0) return { type: 'play', card: attacks[0] }

  const defends = playable(ctx, 'defend').sort((a, b) => b.tier - a.tier)
  if (defends.length > 0) return { type: 'play', card: defends[0] }

  return { type: 'end' }
}

export function meldEagerStrategy(ctx: SimCtx): ReturnType<Strategy> {
  for (const [a, b] of findPairs(ctx.hand)) {
    const cost = Math.min((CARD_DATA[a.cardId]?.cost ?? 1) * 2, 3)
    if (ctx.energy >= cost) return { type: 'meld', a, b }
  }
  return greedyStrategy(ctx)
}

export function balancedStrategy(ctx: SimCtx): ReturnType<Strategy> {
  if (ctx.playerHp > ctx.playerMaxHp * 0.7) {
    for (const [a, b] of findPairs(ctx.hand)) {
      const cost = Math.min((CARD_DATA[a.cardId]?.cost ?? 1) * 2, 3)
      if (ctx.energy >= cost) return { type: 'meld', a, b }
    }
  }

  const lowHp = ctx.playerHp < ctx.playerMaxHp * 0.4
  const defends = playable(ctx, 'defend')
    .filter(card => !(enemyIsImmuneTo(ctx, 'weak') && cardHasStatus(card.cardId, card.tier, 'weak')))
    .sort((a, b) => b.tier - a.tier)
  const attacks = strongest(playable(ctx, 'attack'))

  if (lowHp && defends.length > 0) return { type: 'play', card: defends[0] }
  if (attacks.length > 0) return { type: 'play', card: attacks[0] }
  if (defends.length > 0) return { type: 'play', card: defends[0] }
  return { type: 'end' }
}

export function techniqueStrategy(ctx: SimCtx): ReturnType<Strategy> {
  const attacks = playable(ctx, 'attack')
  const followUp = attacks.some(card => card.cardId !== 'fuse' && CARD_DATA[card.cardId].cost <= ctx.energy - 1)

  const fuse = ctx.hand.find(card => card.cardId === 'fuse' && CARD_DATA.fuse.cost <= ctx.energy)
  if (fuse && followUp && ctx.enemyVulnerable === 0 && !enemyIsImmuneTo(ctx, 'vulnerable')) {
    return { type: 'play', card: fuse }
  }

  const counter = ctx.hand.find(card => card.cardId === 'counter' && card.tier > 1 && CARD_DATA.counter.cost <= ctx.energy)
  const counterFollowUp = attacks.some(card => CARD_DATA[card.cardId].cost <= ctx.energy - CARD_DATA.counter.cost)
  if (counter && counterFollowUp && ctx.enemyVulnerable === 0 && !enemyIsImmuneTo(ctx, 'vulnerable')) {
    return { type: 'play', card: counter }
  }

  const leech = ctx.hand.find(card => card.cardId === 'leech' && card.tier > 1 && CARD_DATA.leech.cost <= ctx.energy)
  const enemyIsArmored = ctx.enemyTraits.some(t => t.kind === 'armored')
  if (leech && !enemyIsImmuneTo(ctx, 'poison') && (enemyIsArmored || ctx.playerHp < ctx.playerMaxHp * 0.75)) {
    return { type: 'play', card: leech }
  }

  const fallback = balancedStrategy(ctx)
  if (fallback.type === 'play' && fallback.card.cardId === 'overload') {
    const variant = getVariant(CARD_DATA.overload, fallback.card.tier, DEFAULT_BUILD, 'overload')
    const unsafe = variant.selfDamage && ctx.playerHp <= ctx.playerMaxHp * 0.45 && ctx.enemyHp > variant.value
    if (unsafe) {
      return balancedStrategy({ ...ctx, hand: ctx.hand.filter(card => card.cardId !== 'overload') })
    }
  }
  if (fallback.type === 'play'
    && (fallback.card.cardId === 'counter' || fallback.card.cardId === 'leech')
    && fallback.card.tier === 1
    && ctx.playerHp >= ctx.playerMaxHp * 0.25) {
    return { type: 'end' }
  }
  return fallback
}
