export interface StatusEffect {
  kind: 'vulnerable' | 'poison' | 'weak'
  stacks: number
  target: 'enemy' | 'self'
}

export interface CardDef {
  name: string; icon: string; type: 'attack' | 'defend' | 'heal'
  value: number; cost: number; desc(val: number, tier?: number): string; color: number
  tierIIIStatus?: StatusEffect
  tierIISelfDamage?: number
}

export const CARD_DATA: Record<string, CardDef> = {
  strike: {
    name: 'Strike', icon: '⚔️', type: 'attack', value: 6, cost: 1,
    desc: v => `Deal ${v} dmg`,
    color: 0xef4444,
  },
  fireball: {
    name: 'Fireball', icon: '🔥', type: 'attack', value: 9, cost: 2,
    desc: (v, t) => t === 3 ? `Deal ${v} dmg · ignite 3` : `Deal ${v} dmg`,
    color: 0xf97316,
    tierIIIStatus: { kind: 'poison', stacks: 3, target: 'enemy' },
  },
  slash: {
    name: 'Slash', icon: '🗡️', type: 'attack', value: 4, cost: 1,
    desc: (v, t) => t === 3 ? `Deal ${v} dmg · bleed 2` : `Deal ${v} dmg`,
    color: 0xa855f7,
    tierIIIStatus: { kind: 'vulnerable', stacks: 2, target: 'enemy' },
  },
  overload: {
    name: 'Overload', icon: '💥', type: 'attack', value: 5, cost: 1,
    desc: (v, t) => t === 2 ? `Deal ${v} dmg · 3 self` : `Deal ${v} dmg`,
    color: 0xe11d48,
    tierIISelfDamage: 3,
  },
  block: {
    name: 'Absorb', icon: '🔮', type: 'defend', value: 2, cost: 1,
    desc: (v, t) => t && t >= 2 ? `+${v} absorb · +${v} HP` : `+${v} absorb`,
    color: 0x818cf8,
  },
  barrier: {
    name: 'Shell', icon: '💠', type: 'defend', value: 4, cost: 2,
    desc: (v, t) => t && t >= 2 ? `+${v} absorb · +${v} HP` : `+${v} absorb`,
    color: 0x6366f1,
  },
}

export const TIER_ROMAN = ['', 'I', 'II', 'III'] as const
export const MAX_TIER = 3

export interface GameCard { id: string; cardId: string; tier: number }

let _uid = 0
export function makeCard(cardId: string, tier = 1): GameCard {
  return { id: `${cardId}_${tier}_${_uid++}`, cardId, tier }
}

export function scaledValue(def: CardDef, tier: number): number {
  const mult = [1, 1, 2.2, 4.5][tier] ?? 1
  return Math.round(def.value * mult)
}
