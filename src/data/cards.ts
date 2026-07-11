import { buildIcon, type IconShape } from '../engine/icons.js'

export type StatusKind = 'vulnerable' | 'poison' | 'weak'

export interface StatusEffect {
  kind:   StatusKind
  stacks: number
  target: 'enemy' | 'self'
}

export interface TierVariant {
  id:          string
  name:        string
  value:       number
  desc(val: number): string
  status?:     StatusEffect
  selfDamage?: number   // bypass-absorb self damage
  heal?:       number   // HP restoration (defend cards, T2+)
}

export interface CardDef {
  name:     string
  icon:     string
  shape:    IconShape   // identity symbol — drives the glyph and the card-art motif
  type:     'attack' | 'defend'
  cost:     number
  color:    number
  variants: [TierVariant[], TierVariant[], TierVariant[]]
}

// build[cardId] = [t1VariantIdx, t2VariantIdx, t3VariantIdx]
export type CardBuild = Record<string, [number, number, number]>
export const DEFAULT_BUILD: CardBuild = {}

export function getVariant(def: CardDef, tier: number, build: CardBuild, cardId: string): TierVariant {
  const idx  = build[cardId]?.[tier - 1] ?? 0
  const list = def.variants[tier - 1]
  return list[Math.min(idx, list.length - 1)]
}

// ── Card data ─────────────────────────────────────────────────────────────────
export const CARD_DATA: Record<string, CardDef> = {

  strike: {
    name: 'Oathcut', icon: buildIcon('strike', 0xef4444), shape: 'strike', type: 'attack', cost: 1, color: 0xef4444,
    variants: [
      [ // T1
        { id: 'strike_t1_jab',      name: 'Mark',      value: 6,  desc: v => `${v} dmg` },
        { id: 'strike_t1_puncture', name: 'Open',      value: 4,  desc: v => `${v} dmg · vuln 1`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } },
      ],
      [ // T2
        { id: 'strike_t2_heavy', name: 'Graven', value: 13, desc: v => `${v} dmg` },
        { id: 'strike_t2_rend',  name: 'Split',  value: 9,  desc: v => `${v} dmg · vuln 2`,
          status: { kind: 'vulnerable', stacks: 2, target: 'enemy' } },
      ],
      [ // T3
        { id: 'strike_t3_cleave',   name: 'Oathfall', value: 27, desc: v => `${v} dmg` },
        { id: 'strike_t3_shatter',  name: 'Sunder',   value: 18, desc: v => `${v} dmg · vuln 3`,
          status: { kind: 'vulnerable', stacks: 3, target: 'enemy' } },
      ],
    ],
  },

  slash: {
    name: 'Needle', icon: buildIcon('slash', 0xa855f7), shape: 'slash', type: 'attack', cost: 1, color: 0xa855f7,
    variants: [
      [ // T1
        { id: 'slash_t1_slash', name: 'Needle', value: 4, desc: v => `${v} dmg` },
        { id: 'slash_t1_nick',  name: 'Thorn',  value: 3, desc: v => `${v} dmg · poison 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } },
      ],
      [ // T2
        { id: 'slash_t2_gash',      name: 'Redline',     value: 9, desc: v => `${v} dmg` },
        { id: 'slash_t2_lacerate',  name: 'Blackthread', value: 6, desc: v => `${v} dmg · poison 2`,
          status: { kind: 'poison', stacks: 2, target: 'enemy' } },
      ],
      [ // T3
        { id: 'slash_t3_bleed',   name: 'Unstitch', value: 18, desc: v => `${v} dmg · vuln 2`,
          status: { kind: 'vulnerable', stacks: 2, target: 'enemy' } },
        { id: 'slash_t3_envenom', name: 'Last Venom', value: 12, desc: v => `${v} dmg · poison 4`,
          status: { kind: 'poison', stacks: 4, target: 'enemy' } },
      ],
    ],
  },

  fireball: {
    name: 'Cinder', icon: buildIcon('fireball', 0xf97316), shape: 'fireball', type: 'attack', cost: 2, color: 0xf97316,
    variants: [
      [ // T1
        { id: 'fireball_t1_fireball', name: 'Cinder',   value: 9,  desc: v => `${v} dmg` },
        { id: 'fireball_t1_ember',    name: 'Ashbite',  value: 6,  desc: v => `${v} dmg · ignite 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } },
      ],
      [ // T2
        { id: 'fireball_t2_inferno', name: 'Kiln', value: 20, desc: v => `${v} dmg` },
        { id: 'fireball_t2_scorch',  name: 'Char', value: 14, desc: v => `${v} dmg · ignite 2`,
          status: { kind: 'poison', stacks: 2, target: 'enemy' } },
      ],
      [ // T3
        { id: 'fireball_t3_conflagration', name: 'Pyre',    value: 40, desc: v => `${v} dmg · ignite 3`,
          status: { kind: 'poison', stacks: 3, target: 'enemy' } },
        { id: 'fireball_t3_ignition',      name: 'Ashwake', value: 26, desc: v => `${v} dmg · ignite 6`,
          status: { kind: 'poison', stacks: 6, target: 'enemy' } },
      ],
    ],
  },

  overload: {
    name: 'Rupture', icon: buildIcon('overload', 0xe11d48), shape: 'overload', type: 'attack', cost: 1, color: 0xe11d48,
    variants: [
      [ // T1 — default is the risky build; Pulse is the safe fallback alt.
        { id: 'overload_t1_surge',    name: 'Rift',  value: 8,  desc: v => `${v} dmg · 2 self`, selfDamage: 2 },
        { id: 'overload_t1_overload', name: 'Pulse', value: 5,  desc: v => `${v} dmg` },
      ],
      [ // T2
        { id: 'overload_t2_discharge', name: 'Backlash', value: 11, desc: v => `${v} dmg · 3 self`, selfDamage: 3 },
        { id: 'overload_t2_spark',     name: 'Livewire', value: 9,  desc: v => `${v} dmg · vuln 1`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } },
      ],
      [ // T3 — default is the glass cannon; Crown is the safe alt.
        { id: 'overload_t3_meltdown',   name: 'Breakform', value: 30, desc: v => `${v} dmg · 5 self`, selfDamage: 5 },
        { id: 'overload_t3_overcharge', name: 'Crown',     value: 25, desc: v => `${v} dmg` },
      ],
    ],
  },

  block: {
    name: 'Shell', icon: buildIcon('absorb', 0x818cf8), shape: 'absorb', type: 'defend', cost: 1, color: 0x818cf8,
    variants: [
      [ // T1
        { id: 'block_t1_guard', name: 'Shell', value: 2, desc: v => `+${v} absorb` },
        { id: 'block_t1_brace', name: 'Set',   value: 3, desc: v => `+${v} absorb` },
      ],
      [ // T2
        { id: 'block_t2_reinforce', name: 'Thicken', value: 4, heal: 4, desc: v => `+${v} absorb · +${v} HP` },
        { id: 'block_t2_fortress',  name: 'Keep',    value: 7,          desc: v => `+${v} absorb` },
      ],
      [ // T3
        { id: 'block_t3_bastion', name: 'Vault', value: 9,  heal: 9,  desc: v => `+${v} absorb · +${v} HP` },
        { id: 'block_t3_aegis',   name: 'Halo',  value: 15,            desc: v => `+${v} absorb` },
      ],
    ],
  },

  ward: {
    name: 'Hush', icon: buildIcon('ward', 0x7c3aed), shape: 'ward', type: 'defend', cost: 1, color: 0x7c3aed,
    variants: [
      [ // T1 — pure debuff; Muffle gives 2 stacks (straight upgrade alt)
        { id: 'ward_t1_wither', name: 'Dim', value: 0,
          desc: _ => 'weak 1', status: { kind: 'weak', stacks: 1, target: 'enemy' } },
        { id: 'ward_t1_veil',   name: 'Muffle', value: 0,
          desc: _ => 'weak 2', status: { kind: 'weak', stacks: 2, target: 'enemy' } },
      ],
      [ // T2 — heal vs more stacks (mirrors Shell's Thicken/Keep trade-off)
        { id: 'ward_t2_wane',   name: 'Douse', value: 0, heal: 4,
          desc: _ => 'weak 2 · +4 HP', status: { kind: 'weak', stacks: 2, target: 'enemy' } },
        { id: 'ward_t2_dampen', name: 'Still', value: 0,
          desc: _ => 'weak 3',          status: { kind: 'weak', stacks: 3, target: 'enemy' } },
      ],
      [ // T3
        { id: 'ward_t3_suppress', name: 'Quietus', value: 0, heal: 8,
          desc: _ => 'weak 3 · +8 HP',  status: { kind: 'weak', stacks: 3, target: 'enemy' } },
        { id: 'ward_t3_eclipse',  name: 'Blackout', value: 0,
          desc: _ => 'weak 4',           status: { kind: 'weak', stacks: 4, target: 'enemy' } },
      ],
    ],
  },

  // ── Carried cards — adapted off-form tools granted by ABSORB (see campaign.ts).
  //    Cheaper and weaker than the source class's signature: breadth & tempo, not raw
  //    power. One variant per tier (no unlock alternates), still meldable up the ladder.
  borrowed_strike: {
    name: 'Carried Oath', icon: buildIcon('strike', 0xef4444), shape: 'strike', type: 'attack', cost: 1, color: 0xef4444,
    variants: [
      [ { id: 'bstrike_t1_edge',   name: 'Small Oath', value: 4,  desc: v => `${v} dmg` } ],
      [ { id: 'bstrike_t2_hack',   name: 'Hard Oath',  value: 9,  desc: v => `${v} dmg` } ],
      [ { id: 'bstrike_t3_sunder', name: 'Red Oath',   value: 18, desc: v => `${v} dmg` } ],
    ],
  },

  borrowed_fireball: {
    name: 'Carried Cinder', icon: buildIcon('fireball', 0xf97316), shape: 'fireball', type: 'attack', cost: 1, color: 0xf97316,
    variants: [
      [ { id: 'bfire_t1_spark', name: 'Pilot Light', value: 6,  desc: v => `${v} dmg` } ],
      [ { id: 'bfire_t2_blaze', name: 'Kiln Coal',   value: 13, desc: v => `${v} dmg` } ],
      [ { id: 'bfire_t3_pyre',  name: 'Pocket Pyre', value: 26, desc: v => `${v} dmg · ignite 3`,
          status: { kind: 'poison', stacks: 3, target: 'enemy' } } ],
    ],
  },

  borrowed_slash: {
    name: 'Carried Needle', icon: buildIcon('slash', 0xa855f7), shape: 'slash', type: 'attack', cost: 1, color: 0xa855f7,
    variants: [
      [ { id: 'bslash_t1_thorn', name: 'Thorn', value: 2, desc: v => `${v} dmg · poison 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } } ],
      [ { id: 'bslash_t2_barb',  name: 'Barb',  value: 4, desc: v => `${v} dmg · poison 2`,
          status: { kind: 'poison', stacks: 2, target: 'enemy' } } ],
      [ { id: 'bslash_t3_sting', name: 'Sting', value: 8, desc: v => `${v} dmg · poison 4`,
          status: { kind: 'poison', stacks: 4, target: 'enemy' } } ],
    ],
  },

}

export const TIER_ROMAN = ['', 'I', 'II', 'III'] as const
export const MAX_TIER   = 3

export interface GameCard { id: string; cardId: string; tier: number }

let _uid = 0
export function makeCard(cardId: string, tier = 1): GameCard {
  return { id: `${cardId}_${tier}_${_uid++}`, cardId, tier }
}
