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
  retaliate?:  number   // direct enemy damage dealt by a defend card
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
    name: 'Cherry Pull', icon: buildIcon('strike', 0xef4444), shape: 'strike', type: 'attack', cost: 1, color: 0xef4444,
    variants: [
      [ // T1
        { id: 'strike_t1_jab',      name: 'Tug',       value: 6,  desc: v => `${v} dmg` },
        { id: 'strike_t1_puncture', name: 'Split',     value: 4,  desc: v => `${v} dmg · vuln 1`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } },
      ],
      [ // T2
        { id: 'strike_t2_heavy', name: 'Stretch', value: 13, desc: v => `${v} dmg` },
        { id: 'strike_t2_rend',  name: 'Rip',     value: 9,  desc: v => `${v} dmg · vuln 2`,
          status: { kind: 'vulnerable', stacks: 2, target: 'enemy' } },
      ],
      [ // T3
        { id: 'strike_t3_cleave',   name: 'Full Pull', value: 27, desc: v => `${v} dmg` },
        { id: 'strike_t3_shatter',  name: 'Open Wide', value: 18, desc: v => `${v} dmg · vuln 3`,
          status: { kind: 'vulnerable', stacks: 3, target: 'enemy' } },
      ],
    ],
  },

  slash: {
    name: 'Sour Thread', icon: buildIcon('slash', 0xa855f7), shape: 'slash', type: 'attack', cost: 1, color: 0xa855f7,
    variants: [
      [ // T1
        { id: 'slash_t1_slash', name: 'Nick', value: 4, desc: v => `${v} dmg` },
        { id: 'slash_t1_nick',  name: 'Zing', value: 3, desc: v => `${v} dmg · poison 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } },
      ],
      [ // T2
        { id: 'slash_t2_gash',      name: 'Drawn Out', value: 9, desc: v => `${v} dmg` },
        { id: 'slash_t2_lacerate',  name: 'Sourline',  value: 6, desc: v => `${v} dmg · poison 2`,
          status: { kind: 'poison', stacks: 2, target: 'enemy' } },
      ],
      [ // T3
        { id: 'slash_t3_bleed',   name: 'Unspool', value: 18, desc: v => `${v} dmg · vuln 2`,
          status: { kind: 'vulnerable', stacks: 2, target: 'enemy' } },
        { id: 'slash_t3_envenom', name: 'Last Zing', value: 12, desc: v => `${v} dmg · poison 4`,
          status: { kind: 'poison', stacks: 4, target: 'enemy' } },
      ],
    ],
  },

  fireball: {
    name: 'Citrus Pop', icon: buildIcon('fireball', 0xf97316), shape: 'fireball', type: 'attack', cost: 2, color: 0xf97316,
    variants: [
      [ // T1
        { id: 'fireball_t1_fireball', name: 'Pop',      value: 9,  desc: v => `${v} dmg` },
        { id: 'fireball_t1_ember',    name: 'Spritz',   value: 6,  desc: v => `${v} dmg · ignite 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } },
      ],
      [ // T2
        { id: 'fireball_t2_inferno', name: 'Burst', value: 20, desc: v => `${v} dmg` },
        { id: 'fireball_t2_scorch',  name: 'Splash', value: 14, desc: v => `${v} dmg · ignite 2`,
          status: { kind: 'poison', stacks: 2, target: 'enemy' } },
      ],
      [ // T3
        { id: 'fireball_t3_conflagration', name: 'Sunburst', value: 40, desc: v => `${v} dmg · ignite 3`,
          status: { kind: 'poison', stacks: 3, target: 'enemy' } },
        { id: 'fireball_t3_ignition',      name: 'Juice Spill', value: 26, desc: v => `${v} dmg · ignite 6`,
          status: { kind: 'poison', stacks: 6, target: 'enemy' } },
      ],
    ],
  },

  overload: {
    name: 'Pressure Pop', icon: buildIcon('overload', 0xe11d48), shape: 'overload', type: 'attack', cost: 1, color: 0xe11d48,
    variants: [
      [ // T1 — default is the risky build; Pulse is the safe fallback alt.
        { id: 'overload_t1_surge',    name: 'Too Full', value: 8,  desc: v => `${v} dmg · 2 self`, selfDamage: 2 },
        { id: 'overload_t1_overload', name: 'Soft Pop', value: 5,  desc: v => `${v} dmg` },
      ],
      [ // T2
        { id: 'overload_t2_discharge', name: 'Blowout', value: 11, desc: v => `${v} dmg · 3 self`, selfDamage: 3 },
        { id: 'overload_t2_spark',     name: 'Crack', value: 9,  desc: v => `${v} dmg · vuln 1`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } },
      ],
      [ // T3 — default is the glass cannon; Crown is the safe alt.
        { id: 'overload_t3_meltdown',   name: 'Big Pop', value: 30, desc: v => `${v} dmg · 5 self`, selfDamage: 5 },
        { id: 'overload_t3_overcharge', name: 'Clean Pop', value: 25, desc: v => `${v} dmg` },
      ],
    ],
  },

  counter: {
    name: 'Bounceback', icon: buildIcon('counter', 0x22d3ee), shape: 'counter', type: 'defend', cost: 2, color: 0x22d3ee,
    variants: [
      [ { id: 'counter_t1_brace',  name: 'Catch',  value: 0, retaliate: 4, selfDamage: 1, desc: _ => '4 return · vuln 1 · 1 strain',
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } } ],
      [ { id: 'counter_t2_turn',   name: 'Turn',   value: 1, retaliate: 9, selfDamage: 2, desc: v => `+${v} absorb · 9 return · vuln 1 · 2 strain`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } } ],
      [ { id: 'counter_t3_return', name: 'Throw Back', value: 2, retaliate: 18, selfDamage: 3, desc: v => `+${v} absorb · 18 return · vuln 1 · 3 strain`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } } ],
    ],
  },

  fuse: {
    name: 'Juice Fuse', icon: buildIcon('fuse', 0xfacc15), shape: 'fuse', type: 'attack', cost: 1, color: 0xfacc15,
    variants: [
      [ { id: 'fuse_t1_prime',   name: 'Prime',   value: 1, desc: v => `${v} dmg · vuln 1`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } } ],
      [ { id: 'fuse_t2_flash',   name: 'Flash',   value: 2, desc: v => `${v} dmg · vuln 1`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } } ],
      [ { id: 'fuse_t3_trigger', name: 'Burst', value: 5, desc: v => `${v} dmg · vuln 1`,
          status: { kind: 'vulnerable', stacks: 1, target: 'enemy' } } ],
    ],
  },

  leech: {
    name: 'Siphon', icon: buildIcon('leech', 0x34d399), shape: 'leech', type: 'attack', cost: 2, color: 0x34d399,
    variants: [
      [ { id: 'leech_t1_sip',   name: 'Sip',   value: 5, heal: 1, desc: v => `${v} dmg · +1 HP · poison 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } } ],
      [ { id: 'leech_t2_draw',  name: 'Draw',  value: 12, heal: 1, desc: v => `${v} dmg · +1 HP · poison 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } } ],
      [ { id: 'leech_t3_drink', name: 'Drink', value: 24, heal: 1, desc: v => `${v} dmg · +1 HP · poison 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } } ],
    ],
  },

  block: {
    name: 'Rind', icon: buildIcon('absorb', 0x818cf8), shape: 'absorb', type: 'defend', cost: 1, color: 0x818cf8,
    variants: [
      [ // T1
        { id: 'block_t1_guard', name: 'Peel', value: 2, desc: v => `+${v} absorb` },
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
    name: 'Stillness', icon: buildIcon('ward', 0x7c3aed), shape: 'ward', type: 'defend', cost: 1, color: 0x7c3aed,
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
    name: 'Loose Cherry', icon: buildIcon('strike', 0xef4444), shape: 'strike', type: 'attack', cost: 1, color: 0xef4444,
    variants: [
      [ { id: 'bstrike_t1_edge',   name: 'Small Pull', value: 4,  desc: v => `${v} dmg` } ],
      [ { id: 'bstrike_t2_hack',   name: 'Hard Pull',  value: 9,  desc: v => `${v} dmg` } ],
      [ { id: 'bstrike_t3_sunder', name: 'Red Pull',   value: 18, desc: v => `${v} dmg` } ],
    ],
  },

  borrowed_fireball: {
    name: 'Loose Citrus', icon: buildIcon('fireball', 0xf97316), shape: 'fireball', type: 'attack', cost: 1, color: 0xf97316,
    variants: [
      [ { id: 'bfire_t1_spark', name: 'Little Pop', value: 6,  desc: v => `${v} dmg` } ],
      [ { id: 'bfire_t2_blaze', name: 'Pocket Burst',   value: 13, desc: v => `${v} dmg` } ],
      [ { id: 'bfire_t3_pyre',  name: 'Juice Pocket', value: 26, desc: v => `${v} dmg · ignite 3`,
          status: { kind: 'poison', stacks: 3, target: 'enemy' } } ],
    ],
  },

  borrowed_slash: {
    name: 'Loose Sour', icon: buildIcon('slash', 0xa855f7), shape: 'slash', type: 'attack', cost: 1, color: 0xa855f7,
    variants: [
      [ { id: 'bslash_t1_thorn', name: 'Pinch', value: 2, desc: v => `${v} dmg · poison 1`,
          status: { kind: 'poison', stacks: 1, target: 'enemy' } } ],
      [ { id: 'bslash_t2_barb',  name: 'Bite',  value: 4, desc: v => `${v} dmg · poison 2`,
          status: { kind: 'poison', stacks: 2, target: 'enemy' } } ],
      [ { id: 'bslash_t3_sting', name: 'Pucker', value: 8, desc: v => `${v} dmg · poison 4`,
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
