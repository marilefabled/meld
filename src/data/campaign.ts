import { CLASS_CONFIGS, type PlayerClass } from './classes.js'
import type { CardBuild } from './cards.js'
import { buildIcon } from '../engine/icons.js'

export interface CampaignCard { cardId: string; tier: number }

// Persistent narrative state — dialogue flags, once-choices, and named variables.
// Saved with the campaign so story beats branch on choices made many fights ago.
export interface StoryState {
  flags:  string[]                 // dialogue flags set across all beats
  picked: string[]                 // once-choices already taken (conv:node:idx)
  vars:   Record<string, number>   // named numeric variables (resolve, fury, …)
}

export const emptyStory = (): StoryState => ({ flags: [], picked: [], vars: {} })

export interface CampaignState {
  runNumber:  number          // completed runs (0 = haven't finished run 1 yet)
  baseClass:  PlayerClass
  deck:       CampaignCard[]  // evolves between runs
  build:      CardBuild       // persisted variant choices
  classesIn:  PlayerClass[]   // which essences you've absorbed
  powerLevel: number          // stat multiplier; 1.0 base, +0.35 per strengthen
  story:      StoryState      // persistent dialogue flags / variables
}

const KEY = 'meld_campaign_v1'

export function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as CampaignState
    if (s.powerLevel == null) s.powerLevel = 1
    if (s.story == null) s.story = emptyStory()
    return s
  } catch { return null }
}

export function saveCampaign(s: CampaignState) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearCampaign() {
  localStorage.removeItem(KEY)
}

export function newCampaign(baseClass: PlayerClass): CampaignState {
  const cfg = CLASS_CONFIGS[baseClass]
  const deck: CampaignCard[] = cfg.deck.map(cardId => ({ cardId, tier: 1 }))
  const state: CampaignState = { runNumber: 0, baseClass, deck, build: {}, classesIn: [baseClass], powerLevel: 1, story: emptyStory() }
  saveCampaign(state)
  return state
}

// Absorbing a class grants adapted "borrowed" cards — cheaper, weaker off-class tools
// (defined in cards.ts) that answer your anti-matchup. Breadth, not power.
export const ABSORB_KIT: Record<PlayerClass, string> = {
  warrior: 'borrowed_strike',    // cheap direct damage — cuts through status-immune foes
  mage:    'borrowed_fireball',  // cheap burst — overwhelms foes that heal
  rogue:   'borrowed_slash',     // cheap poison — damage that ignores armor
}

const ABSORB_COPIES = 3   // copies added per absorb (enough to draw & meld reliably)

const ABSORB_DESC: Record<PlayerClass, string> = {
  warrior: 'Cheap direct strikes — cut through status-immune foes',
  mage:    'Cheap burst — overwhelm foes that heal back',
  rogue:   'Cheap poison — damage that slips past armor',
}

const ABSORB_FLAVOR: Record<PlayerClass, string> = {
  warrior: 'Strike is direct. Efficient. Sometimes the simplest tool is the right one.',
  mage:    'Fire has a certain persuasiveness. Borrow it.',
  rogue:   'Patience is a weapon too. Now you carry both.',
}

const CLASS_LABEL: Record<PlayerClass, string> = {
  warrior: 'Warrior',
  mage:    'Mage',
  rogue:   'Rogue',
}

export type EvolutionKind =
  | { type: 'strengthen' }                       // same class deepens — all card values scale up
  | { type: 'absorb'; cls: PlayerClass }         // gain adapted off-class "borrowed" cards

export interface EvolutionOption {
  kind:   EvolutionKind
  label:  string
  icon:   string
  desc:   string
  flavor: string
}

const STRENGTHEN_FLAVOR: Record<PlayerClass, string> = {
  warrior: 'The iron was already there. Now it\'s denser.',
  mage:    'The flame didn\'t grow wider. It grew hotter.',
  rogue:   'Precision sharpened past what most could see.',
}

export function getEvolutionOptions(state: CampaignState): EvolutionOption[] {
  const { baseClass, classesIn } = state
  const options: EvolutionOption[] = []

  const otherClasses = (['warrior', 'mage', 'rogue'] as PlayerClass[]).filter(c => !classesIn.includes(c))
  const icon = baseClass === 'warrior' ? buildIcon('strike', 0xef4444)
             : baseClass === 'mage'    ? buildIcon('fireball', 0xf97316)
             :                          buildIcon('slash', 0xa855f7)

  // STRENGTHEN: same class deepens — stat multiplier increases
  options.push({
    kind:   { type: 'strengthen' },
    label:  'DEEPEN',
    icon,
    desc:   'Your identity intensifies. All cards hit harder.',
    flavor: STRENGTHEN_FLAVOR[baseClass],
  })

  // ABSORB: gain adapted "borrowed" cards from an unabsorbed class
  for (const cls of otherClasses) {
    options.push({
      kind:   { type: 'absorb', cls },
      label:  `ABSORB ${CLASS_LABEL[cls].toUpperCase()}`,
      icon:   cls === 'warrior' ? buildIcon('strike', 0xef4444) : cls === 'mage' ? buildIcon('fireball', 0xf97316) : buildIcon('slash', 0xa855f7),
      desc:   ABSORB_DESC[cls],
      flavor: ABSORB_FLAVOR[cls],
    })
  }

  return options
}

export function applyEvolution(state: CampaignState, kind: EvolutionKind): CampaignState {
  let deck       = [...state.deck]
  let classesIn  = [...state.classesIn]
  let powerLevel = state.powerLevel ?? 1

  if (kind.type === 'strengthen') {
    powerLevel = Math.round((powerLevel + 0.35) * 100) / 100
  } else if (kind.type === 'absorb') {
    const card = ABSORB_KIT[kind.cls]
    for (let i = 0; i < ABSORB_COPIES; i++) deck.push({ cardId: card, tier: 1 })
    classesIn = [...classesIn, kind.cls]
  }

  return { ...state, deck, classesIn, powerLevel }
}

export const TOTAL_RUNS = 3   // number of runs in a full campaign

// ── Mid-run checkpoint — saved after each encounter so you can resume ─────────

export interface RunCheckpoint {
  campaignRunNumber: number
  encounterIdx:      number   // next encounter to start at
  playerHP:          number
  runFragments:      number
}

const CHECKPOINT_KEY = 'meld_run_v1'

export function saveCheckpoint(cp: RunCheckpoint) {
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(cp))
}

export function loadCheckpoint(): RunCheckpoint | null {
  try { return JSON.parse(localStorage.getItem(CHECKPOINT_KEY) ?? 'null') } catch { return null }
}

export function clearCheckpoint() {
  localStorage.removeItem(CHECKPOINT_KEY)
}
