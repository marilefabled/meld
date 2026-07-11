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
    id: 'momentum', name: 'Hot Hand', icon: buildIcon('overload', 0x8b5cf6),
    desc: 'Melds cost 1 less AP',
    flavor: 'One meld pulls the next closer.',
    meldCostDelta: -1,
  },
  {
    id: 'resilience', name: 'Second Skin', icon: buildIcon('absorb', 0x22c55e),
    desc: '+15 max HP',
    flavor: 'The dark left another layer.',
    startingHpBonus: 15,
  },
  {
    id: 'overdrive', name: 'Red Method', icon: buildIcon('overload', 0xe11d48),
    desc: 'Attacks deal ×1.3 · incoming ×1.2',
    flavor: 'Win louder than the body can hold.',
    damageMultiplier: 1.3,
    incomingMultiplier: 1.2,
  },
  {
    id: 'cascade', name: 'Open Nerve', icon: buildIcon('cascade', 0x0ea5e9),
    desc: 'Melds draw 2 cards instead of 1',
    flavor: 'Pull once. The hand opens.',
    meldDrawBonus: 1,
  },
  {
    id: 'headstart', name: 'First Mark', icon: buildIcon('strike', 0xf59e0b),
    desc: 'Start with a Tier II Oathcut in your deck',
    flavor: 'The first cut knows the way.',
    startWithT2: 'strike',
  },
  {
    id: 'efficiency', name: 'Clean Spend', icon: buildIcon('efficiency', 0x14b8a6),
    desc: 'All cards cost 1 less AP (min 1)',
    flavor: 'No waste. No loose ends.',
    cardCostDelta: -1,
  },
]
