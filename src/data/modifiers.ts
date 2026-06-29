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
    id: 'momentum', name: 'Momentum', icon: buildIcon('overload', 0x8b5cf6),
    desc: 'Melds cost 1 less AP',
    flavor: 'When you meld, keep melding. Don\'t give the mark time to breathe.',
    meldCostDelta: -1,
  },
  {
    id: 'resilience', name: 'Resilience', icon: buildIcon('absorb', 0x22c55e),
    desc: '+15 max HP',
    flavor: 'Some marks fight back harder than expected. You\'ve planned for it.',
    startingHpBonus: 15,
  },
  {
    id: 'overdrive', name: 'Overdrive', icon: buildIcon('overload', 0xe11d48),
    desc: 'Attacks deal ×1.3 · incoming ×1.2',
    flavor: 'Glass cannon. You\'ve run this way before.',
    damageMultiplier: 1.3,
    incomingMultiplier: 1.2,
  },
  {
    id: 'cascade', name: 'Cascade', icon: buildIcon('cascade', 0x0ea5e9),
    desc: 'Melds draw 2 cards instead of 1',
    flavor: 'Each meld opens the next door. Chain them.',
    meldDrawBonus: 1,
  },
  {
    id: 'headstart', name: 'Head Start', icon: buildIcon('strike', 0xf59e0b),
    desc: 'Start with a Tier II Strike in your deck',
    flavor: 'You came prepared this time.',
    startWithT2: 'strike',
  },
  {
    id: 'efficiency', name: 'Efficiency', icon: buildIcon('efficiency', 0x14b8a6),
    desc: 'All cards cost 1 less AP (min 1)',
    flavor: 'Nothing goes to waste on this hunt.',
    cardCostDelta: -1,
  },
]
