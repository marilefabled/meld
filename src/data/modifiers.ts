import { buildIcon } from '../engine/icons.js'

export interface Modifier {
  id:                    string
  name:                  string
  icon:                  string
  desc:                  string
  flavor:                string
  meldCostDelta?:        number   // melds cost this much less AP
  cardCostDelta?:        number   // all cards cost this much less AP
  damageMultiplier?:     number   // player attack multiplier
  incomingMultiplier?:   number   // damage player receives multiplier
  startingHpBonus?:      number
  startWithT2?:          string   // cardId added as T2 to starting deck
  meldDrawBonus?:        number   // extra cards drawn per meld
}

export const MODIFIERS: Modifier[] = [
  {
    id: 'momentum', name: 'Fresh Pull', icon: buildIcon('overload', 0x8b5cf6),
    desc: 'Melds cost 1 less AP',
    flavor: 'One fuse pulls the next closer.',
    meldCostDelta: -1,
  },
  {
    id: 'resilience', name: 'Extra Rind', icon: buildIcon('absorb', 0x22c55e),
    desc: '+15 max HP',
    flavor: 'The pouch left another layer.',
    startingHpBonus: 15,
  },
  {
    id: 'overdrive', name: 'Full Pressure', icon: buildIcon('overload', 0xe11d48),
    desc: 'Attacks deal ×1.3 · incoming ×1.2',
    flavor: 'Pop louder than the pouch can hold.',
    damageMultiplier: 1.3,
    incomingMultiplier: 1.2,
  },
  {
    id: 'cascade', name: 'Split Pouch', icon: buildIcon('cascade', 0x0ea5e9),
    desc: 'Melds draw 2 cards instead of 1',
    flavor: 'Pull once. The pouch opens.',
    meldDrawBonus: 1,
  },
  {
    id: 'headstart', name: 'First Chew', icon: buildIcon('strike', 0xf59e0b),
    desc: 'Start with a Tier II Cherry Pull in your deck',
    flavor: 'The first bite knows the way.',
    startWithT2: 'strike',
  },
  {
    id: 'efficiency', name: 'No Crumbs', icon: buildIcon('efficiency', 0x14b8a6),
    desc: 'All cards cost 1 less AP (min 1)',
    flavor: 'No waste. No loose ends.',
    cardCostDelta: -1,
  },
]
