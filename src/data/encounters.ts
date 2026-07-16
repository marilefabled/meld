import type { StatusEffect, StatusKind } from './cards.js'
import type { PlayerClass } from './classes.js'
import type { IconShape } from '../engine/icons.js'

export interface EnemyMove {
  name: string; type: 'attack' | 'defend' | 'heal'
  value: number; color: number; label: string
  shape?: IconShape   // visual identity — same vocabulary as player cards (see moveShape)
  status?: Omit<StatusEffect, 'target'> & { target: 'player' | 'enemy' }
  weight?: number   // base intent preference (default 1); higher = chosen more often
}

// An enemy move speaks the same visual language as a player card. Most read off
// type/flavor; signature moves (fire, the Mirror's class echoes) set `shape`
// explicitly. This drives BOTH the telegraphed intent glyph and the cast animation.
export function moveShape(m: EnemyMove): IconShape {
  if (m.shape) return m.shape
  if (m.type === 'heal')   return 'hp'
  if (m.type === 'defend') return 'absorb'
  if (m.status?.kind === 'poison') return 'slash'    // bleed / venom identity
  if (m.value >= 18)               return 'overload' // apex spikes crackle
  return 'strike'                                    // default melee lunge
}

// Passive identity mechanics — each one taxes a player class and is answered by
// another, forming a soft triangle (see README → Damage & resistance):
//   armored → bounces Citrus Burst, answered by poison (ignores armor)
//   regen   → outpaces Cherry Brick/Sour Ribbon, answered by Citrus Burst
//   immune  → negates Sour Ribbon status, answered by direct damage
export type EnemyTrait =
  | { kind: 'armored'; absorb: number }          // +absorb at the start of each of its turns
  | { kind: 'regen';   hp: number }              // heals at the start of each of its turns
  | { kind: 'immune';  statuses: StatusKind[] }  // ignores these player-applied statuses

export interface EnemyDef {
  name: string; bodyColor: number; accentColor: number; hp: number; moves: EnemyMove[]
  traits?: EnemyTrait[]
}

// ── Enemies as a system: archetype × tier × variant ─────────────────────────
// The mirror of the card system. A card is type → tier → variant (Cherry Pull → T1/T2/T3 →
// Tug/Split). An enemy is archetype → tier → variant:
//
//   archetype  ≈ card type     — the 3 walls of the triangle (immune / armored / regen)
//   tier       ≈ card tier      — escalating threat, one per run (T1=run1 … T3=run3)
//   variant    ≈ card variant   — same role, different feel (The Crimp vs Crimp)
//
// The 9 gauntlet opponents ARE the 3×3 grid; makeMirror is the 10th. A run is the
// tier-r form of every archetype, so each run is one immune, one armored, one regen —
// the columns stay stable archetypes while the rows escalate. encountersForRun rotates
// each cell's variant by cycle, so the first time through is the tuned set and each
// loop branches.

export type EnemySlot = EnemyDef[]   // stable variants for one (archetype, tier) cell; [0] = tuned default

export interface EnemyArchetype {
  key:   'immune' | 'armored' | 'regen'
  label: string                              // the wall's name, for docs / grouping
  tiers: [EnemySlot, EnemySlot, EnemySlot]   // T1 / T2 / T3 — each a slot of variants
}

// ── Run-1 alternate variants — same wall-role as the default, different feel ──
const WISP: EnemyDef = {
  // Immune alt — turtles behind a shield instead of rushing. Still checks Sour Ribbon.
  name: 'Crimp', bodyColor: 0x6d28d9, accentColor: 0xc4b5fd, hp: 30,
  traits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }],
  moves: [
    { name: 'Crinkle', type: 'attack', value: 5, color: 0xef4444, label: '🌀 Crinkle · 5 dmg', weight: 1.2 },
    { name: 'Reseal',  type: 'defend', value: 4, color: 0x6366f1, label: '🛡 Reseal · +4 absorb', weight: 0.9 },
  ],
}
const HUSK: EnemyDef = {
  // Armored alt — glassier: thinner shield, heavier swings.
  name: 'Hard Chew', bodyColor: 0x78350f, accentColor: 0xf59e0b, hp: 66,
  traits: [{ kind: 'armored', absorb: 2 }],
  moves: [
    { name: 'Knock', type: 'attack', value: 10, color: 0xef4444, label: '💥 Knock · 10 dmg', weight: 1 },
    { name: 'Whip', type: 'attack', value: 14, color: 0xdc2626, label: '🌀 Whip · 14 dmg', weight: 1.2 },
  ],
}
const BLOOM: EnemyDef = {
  // Regen alt — leans on poison pressure rather than raw heals.
  name: 'Juice Bloom', bodyColor: 0x064e3b, accentColor: 0x34d399, hp: 114,
  traits: [{ kind: 'regen', hp: 7 }],
  moves: [
    { name: 'Drip',     type: 'attack', value: 8,  color: 0xef4444, label: '⚡ Drip · 8 dmg', weight: 1 },
    { name: 'Sour Leak', type: 'attack', value: 10, color: 0xdc2626, label: '💀 Sour Leak · 10 dmg + poison',
      status: { kind: 'poison', stacks: 3, target: 'player' }, weight: 1.3 },
    { name: 'Refill', type: 'heal',   value: 9,  color: 0x22c55e, label: '💚 Refill · +9 HP', weight: 1 },
  ],
}

export const ARCHETYPES: EnemyArchetype[] = [
  // ── SEALED · immune — taxes Sour Ribbon (status whiffs); answer with direct damage ──
  {
    key: 'immune', label: 'Sealed',
    tiers: [
      [
        {
          // T1 default — taught cheaply so the player meets immunity before it can kill.
          name: 'The Crimp', bodyColor: 0xb45309, accentColor: 0xd97706, hp: 35,
          traits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }],
          moves: [
            { name: 'Pinch', type: 'attack', value: 4, color: 0xef4444, label: '🌀 Pinch · 4 dmg',  weight: 1 },
            { name: 'Crimp', type: 'attack', value: 6, color: 0xdc2626, label: '⚡ Crimp · 6 dmg', weight: 1.1 },
          ],
        },
        WISP,
      ],
      [{
        // T2 — immunity that also defends. Sour Ribbon must lean on direct damage.
        name: 'Sachet', bodyColor: 0x065f46, accentColor: 0x10b981, hp: 60,
        traits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }],
        moves: [
          { name: 'Trim',   type: 'attack', value: 9,  color: 0xef4444, label: '🌀 Trim · 9 dmg',         weight: 1.2 },
          { name: 'Wipe',   type: 'attack', value: 13, color: 0xdc2626, label: '⚡ Wipe · 13 dmg',        weight: 1 },
          { name: 'Seal',   type: 'defend', value: 5,  color: 0x6366f1, label: '🛡 Seal · +5 absorb',      weight: 0.9 },
        ],
      }, {
        // T2 alt — immune glass cannon: no shield, all pressure. Race it down.
        name: 'Flash Seal', bodyColor: 0x047857, accentColor: 0x6ee7b7, hp: 54,
        traits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }],
        moves: [
          { name: 'Glare', type: 'attack', value: 11, color: 0xef4444, label: '🌀 Glare · 11 dmg', weight: 1 },
          { name: 'Heat Flash', type: 'attack', value: 15, color: 0xf97316, label: '🔥 Heat Flash · 15 dmg', shape: 'fireball', weight: 1.2 },
        ],
      }],
      [{
        // T3 apex — immune AND armored. Burst bounces, status whiffs: pure direct grind.
        name: 'Hard Seal', bodyColor: 0x1e3a8a, accentColor: 0x60a5fa, hp: 170,
        traits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }, { kind: 'armored', absorb: 4 }],
        moves: [
          { name: 'Edge Tear', type: 'attack', value: 15, color: 0xef4444, label: '⚡ Edge Tear · 15 dmg',     weight: 1.1 },
          { name: 'Stamp',   type: 'attack', value: 21, color: 0xdc2626, label: '💀 Stamp · 21 dmg',       weight: 1 },
          { name: 'Harden', type: 'defend', value: 8,  color: 0x6366f1, label: '🛡 Harden · +8 absorb',  weight: 1 },
        ],
      }, {
        // T3 apex alt — immune AND regen. Status whiffs and it heals: only burst answers.
        name: 'Blank Pack', bodyColor: 0x155e75, accentColor: 0x67e8f9, hp: 175,
        traits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }, { kind: 'regen', hp: 7 }],
        moves: [
          { name: 'Blank',  type: 'attack', value: 16, color: 0xef4444, label: '💥 Blank · 16 dmg',  weight: 1 },
          { name: 'Flatten', type: 'attack', value: 22, color: 0xdc2626, label: '💀 Flatten · 22 dmg', weight: 1.2 },
          { name: 'Refill',   type: 'heal',   value: 10, color: 0x22c55e, label: '💚 Refill · +10 HP',   weight: 0.9 },
        ],
      }],
    ],
  },

  // ── HARD-SET · armored — taxes Citrus Burst; answer with poison (ignores armor) ──
  {
    key: 'armored', label: 'Hard-Set',
    tiers: [
      [
        {
          // T1 default — hardens every turn.
          name: 'Hard Set', bodyColor: 0x7f1d1d, accentColor: 0xb91c1c, hp: 70,
          traits: [{ kind: 'armored', absorb: 3 }],
          moves: [
            { name: 'Thump',    type: 'attack', value: 8,  color: 0xef4444, label: '💥 Thump · 8 dmg',       weight: 1 },
            { name: 'Press',     type: 'attack', value: 11, color: 0xdc2626, label: '🌀 Press · 11 dmg',       weight: 1.3 },
            { name: 'Set Hard',  type: 'defend', value: 3,  color: 0x6366f1, label: '🛡 Set Hard · +3 absorb', weight: 1 },
          ],
        },
        HUSK,
      ],
      [{
        // T2 — heavier armor, harder hits. Burst bounces even more.
        name: 'Brick Bite', bodyColor: 0x713f12, accentColor: 0xd97706, hp: 100,
        traits: [{ kind: 'armored', absorb: 4 }],
        moves: [
          { name: 'Press',    type: 'attack', value: 11, color: 0xef4444, label: '💥 Press · 11 dmg',        weight: 1 },
          { name: 'Pound',    type: 'attack', value: 16, color: 0xdc2626, label: '🌀 Pound · 16 dmg',        weight: 1.3 },
          { name: 'Set',  type: 'defend', value: 6,  color: 0x6366f1, label: '🛡 Set · +6 absorb',   weight: 1 },
        ],
      }, {
        // T2 alt — turtle: stacks shields hard. Poison-through-armor is the only real progress.
        name: 'Rind Wall', bodyColor: 0x854d0e, accentColor: 0xfacc15, hp: 105,
        traits: [{ kind: 'armored', absorb: 5 }],
        moves: [
          { name: 'Knock',   type: 'attack', value: 10, color: 0xef4444, label: '💥 Knock · 10 dmg',   weight: 0.9 },
          { name: 'Mash', type: 'attack', value: 15, color: 0xdc2626, label: '🌀 Mash · 15 dmg', weight: 1 },
          { name: 'Rind Up',   type: 'defend', value: 9,  color: 0x6366f1, label: '🛡 Rind Up · +9 absorb', weight: 1.3 },
        ],
      }],
      [{
        // T3 apex — armored AND regen. Only sustained poison-through-armor cracks it.
        name: 'Gummy Vault', bodyColor: 0x4c1d95, accentColor: 0x8b5cf6, hp: 140,
        traits: [{ kind: 'armored', absorb: 4 }, { kind: 'regen', hp: 7 }],
        moves: [
          { name: 'Crack',  type: 'attack', value: 14, color: 0xef4444, label: '💥 Crack · 14 dmg',      weight: 1 },
          { name: 'Compress',   type: 'attack', value: 19, color: 0xdc2626, label: '🌀 Compress · 19 dmg',       weight: 1.2 },
          { name: 'Reseal',    type: 'defend', value: 7,  color: 0x6366f1, label: '🛡 Reseal · +7 absorb',     weight: 1 },
        ],
      }, {
        // T3 apex alt — armored AND immune. Burst bounces, status whiffs: grind it raw.
        name: 'The Block', bodyColor: 0x1e293b, accentColor: 0x94a3b8, hp: 150,
        traits: [{ kind: 'armored', absorb: 5 }, { kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }],
        moves: [
          { name: 'Mash',   type: 'attack', value: 16, color: 0xef4444, label: '💥 Mash · 16 dmg',     weight: 1 },
          { name: 'Shake',   type: 'attack', value: 23, color: 0xdc2626, label: '🌀 Shake · 23 dmg',     weight: 1.2 },
          { name: 'Harden', type: 'defend', value: 9,  color: 0x6366f1, label: '🛡 Harden · +9 absorb', weight: 1 },
        ],
      }],
    ],
  },

  // ── REFILLING · regen — taxes attrition; answer with Citrus Burst ──────────
  {
    key: 'regen', label: 'Refilling',
    tiers: [
      [
        {
          // T1 default — regenerates every turn.
          name: 'The Last Drop', bodyColor: 0x1e1b4b, accentColor: 0x4338ca, hp: 120,
          traits: [{ kind: 'regen', hp: 6 }],
          moves: [
            { name: 'Drip', type: 'attack', value: 10, color: 0xef4444, label: '⚡ Drip · 10 dmg', weight: 1 },
            { name: 'Sour Burst',     type: 'attack', value: 15, color: 0xdc2626, label: '💀 Sour Burst · 15 dmg + poison',
              status: { kind: 'poison', stacks: 2, target: 'player' }, weight: 1.3 },
            { name: 'Glaze', type: 'defend', value: 5,  color: 0x6366f1, label: '🛡 Glaze · +5 absorb', weight: 0.8 },
            { name: 'Refill',    type: 'heal',   value: 8,  color: 0x22c55e, label: '💚 Refill · +8 HP',        weight: 1 },
          ],
        },
        BLOOM,
      ],
      [{
        // T2 — fast regen, poisons back. Attrition loses outright; bring burst.
        name: 'Refill', bodyColor: 0x134e4a, accentColor: 0x2dd4bf, hp: 160,
        traits: [{ kind: 'regen', hp: 9 }],
        moves: [
          { name: 'Juice Rise',   type: 'attack', value: 13, color: 0xef4444, label: '⚡ Juice Rise · 13 dmg',      weight: 1 },
          { name: 'Sour Spill',  type: 'attack', value: 12, color: 0xdc2626, label: '💀 Sour Spill · 12 dmg + poison',
            status: { kind: 'poison', stacks: 3, target: 'player' }, weight: 1.2 },
          { name: 'Refill',    type: 'heal',   value: 12, color: 0x22c55e, label: '💚 Refill · +12 HP',       weight: 1.1 },
        ],
      }, {
        // T2 alt — regen behind heavy poison. Outpace its heals with burst; mind the stacks.
        name: 'Tangle', bodyColor: 0x3f6212, accentColor: 0xa3e635, hp: 155,
        traits: [{ kind: 'regen', hp: 8 }],
        moves: [
          { name: 'Tangler',   type: 'attack', value: 12, color: 0xef4444, label: '⚡ Tangler · 12 dmg',      weight: 1 },
          { name: 'Stale Sour', type: 'attack', value: 10, color: 0xdc2626, label: '💀 Stale Sour · 10 dmg + poison',
            status: { kind: 'poison', stacks: 4, target: 'player' }, weight: 1.3 },
          { name: 'Drink Deep',   type: 'heal',   value: 13, color: 0x22c55e, label: '💚 Drink Deep · +13 HP',      weight: 1.1 },
        ],
      }],
      [{
        // T3 apex — the final wall before the mirror. Heavy regen, big poison hits.
        name: 'The Gulp', bodyColor: 0x500724, accentColor: 0xec4899, hp: 200,
        traits: [{ kind: 'regen', hp: 10 }],
        moves: [
          { name: 'Gulp',  type: 'attack', value: 18, color: 0xef4444, label: '💥 Gulp · 18 dmg',      weight: 1 },
          { name: 'Pop', type: 'attack', value: 22, color: 0xdc2626, label: '💀 Pop · 22 dmg + poison',
            status: { kind: 'poison', stacks: 4, target: 'player' }, weight: 1.2 },
          { name: 'Refill',   type: 'heal',   value: 16, color: 0x22c55e, label: '💚 Refill · +16 HP',       weight: 1.1 },
        ],
      }, {
        // T3 apex alt — regen AND armored. Heals through chip, shields the spikes: hit hard in windows.
        name: 'The Flood', bodyColor: 0x0c4a6e, accentColor: 0x38bdf8, hp: 200,
        traits: [{ kind: 'regen', hp: 9 }, { kind: 'armored', absorb: 3 }],
        moves: [
          { name: 'Flood',     type: 'attack', value: 19, color: 0xef4444, label: '💥 Flood · 19 dmg',     weight: 1 },
          { name: 'Shake', type: 'attack', value: 24, color: 0xdc2626, label: '💀 Shake · 24 dmg', weight: 1.2 },
          { name: 'Refill',     type: 'heal',   value: 15, color: 0x22c55e, label: '💚 Refill · +15 HP',     weight: 1.1 },
        ],
      }],
    ],
  },
]

// A run is the tier-r form of every archetype (run index === tier index) — so each run
// is one immune, one armored, one regen, escalating as the runs go.
export const RUNS: EnemySlot[][] = [0, 1, 2].map(tier => ARCHETYPES.map(a => a.tiers[tier]))

// Back-compat alias for free-mode / debug enemy select — the tuned default lineup.
export const ENCOUNTERS: EnemyDef[] = RUNS[0].map(slot => slot[0])

/** The gauntlet for a run, choosing one stable variant per (archetype, tier) cell.
 *  Rotates by cycle, so cycle 0 is the tuned default set and each loop branches. */
export function encountersForRun(runNumber: number, cycle = 0): EnemyDef[] {
  const run = RUNS[Math.max(0, Math.min(runNumber, RUNS.length - 1))]
  return run.map(slot => slot[cycle % slot.length])
}

// ── The 10th — the Mirror finale ────────────────────────────────────────────
// "Basically your character." A reflection of the player's own form: it fights with
// your class's signature kit, scaled to the power you've accumulated. The true test
// of the build you became, not a wall you route around.

const MIRROR_COLOR = { bodyColor: 0x111827, accentColor: 0xa78bfa }   // pale violet — the Wrapper

export function makeMirror(cls: PlayerClass, powerLevel: number): EnemyDef {
  const p = Math.max(1, powerLevel)
  const s = (n: number) => Math.round(n * p)

  if (cls === 'mage') {
    return {
      name: 'THE ORIGINAL', ...MIRROR_COLOR, hp: s(150),
      moves: [
        { name: 'Original Citrus',  type: 'attack', value: s(16), color: 0xf97316, label: `🔥 Original Citrus · ${s(16)} dmg`, shape: 'fireball', weight: 1.2 },
        { name: 'Original Burst',    type: 'attack', value: s(24), color: 0xea580c, label: `💥 Original Burst · ${s(24)} dmg`,   shape: 'fireball', weight: 1 },
        { name: 'Original Spill', type: 'attack', value: s(12), color: 0xdc2626, label: `💀 Original Spill · ${s(12)} dmg + ignite`,
          status: { kind: 'poison', stacks: 4, target: 'player' }, shape: 'fireball', weight: 1 },
      ],
    }
  }
  if (cls === 'rogue') {
    return {
      name: 'THE ORIGINAL', ...MIRROR_COLOR, hp: s(160),
      traits: [{ kind: 'regen', hp: s(5) }],
      moves: [
        { name: 'Original Thread', type: 'attack', value: s(11), color: 0xa855f7, label: `🗡️ Original Thread · ${s(11)} dmg`, shape: 'slash', weight: 1.1 },
        { name: 'Original Zing',type: 'attack', value: s(13), color: 0xdc2626, label: `💔 Original Zing · ${s(13)} dmg + vuln`,
          status: { kind: 'vulnerable', stacks: 2, target: 'player' }, shape: 'slash', weight: 1.2 },
        { name: 'Original Sour',  type: 'attack', value: s(8),  color: 0x16a34a, label: `💀 Original Sour · ${s(8)} dmg + poison`,
          status: { kind: 'poison', stacks: 4, target: 'player' }, shape: 'slash', weight: 1 },
      ],
    }
  }
  // warrior
  return {
    name: 'THE ORIGINAL', ...MIRROR_COLOR, hp: s(180),
    traits: [{ kind: 'armored', absorb: s(3) }],
    moves: [
      { name: 'Original Cherry', type: 'attack', value: s(13), color: 0xef4444, label: `⚔️ Original Cherry · ${s(13)} dmg`, shape: 'strike', weight: 1.2 },
      { name: 'Original Pull',type: 'attack', value: s(20), color: 0xdc2626, label: `💥 Original Pull · ${s(20)} dmg`, shape: 'strike', weight: 1 },
      { name: 'Original Rind',   type: 'defend', value: s(6),  color: 0x6366f1, label: `🛡 Original Rind · +${s(6)} absorb`, shape: 'absorb', weight: 0.9 },
    ],
  }
}
