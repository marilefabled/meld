import type { FruitVisual } from './visuals.js'

export type PlayerClass = 'warrior' | 'mage' | 'rogue'

export interface ClassConfig {
  displayName: string
  hp: number
  deck: string[]
  role: string
  flavor: string
  signatureCard: string
  techniqueCard: string
  tutorialHand: string[]
  deckPreview: string
  visual: FruitVisual
  bodyColor: number
  accentColor: number
}

export const CLASS_CONFIGS: Record<PlayerClass, ClassConfig> = {
  warrior: {
    displayName: 'Cherry Brick',
    hp: 70,
    role: 'DENSE',
    flavor: 'Pressed red fruit. It remembers impact.',
    signatureCard: 'strike',
    techniqueCard: 'counter',
    tutorialHand: ['strike', 'strike', 'block', 'ward'],
    deckPreview: 'Cherry Pull pairs. Rind and Stillness buy time.',
    visual: 'cherry-brick',
    bodyColor: 0xdc2626,
    accentColor: 0xfbbf24,
    deck: [
      'strike', 'strike', 'strike', 'strike',
      'slash', 'slash',
      'overload', 'overload',
      'block', 'block', 'block',
      'ward', 'ward',
    ],
  },
  mage: {
    displayName: 'Citrus Burst',
    hp: 55,
    role: 'POP',
    flavor: 'A bright pocket of pressure with nowhere safe to go.',
    signatureCard: 'fireball',
    techniqueCard: 'fuse',
    tutorialHand: ['fireball', 'fireball', 'block', 'ward'],
    deckPreview: 'Citrus Pop floods. Burst before the refill.',
    visual: 'citrus-burst',
    bodyColor: 0xf97316,
    accentColor: 0xfde047,
    deck: [
      'fireball', 'fireball', 'fireball', 'fireball', 'fireball', 'fireball',
      'overload', 'overload',
      'block', 'block',
      'ward', 'ward', 'ward',
    ],
  },
  rogue: {
    displayName: 'Sour Ribbon',
    hp: 60,
    role: 'ZING',
    flavor: 'A thin sour seam that stays under the seal.',
    signatureCard: 'slash',
    techniqueCard: 'leech',
    tutorialHand: ['slash', 'slash', 'block', 'ward'],
    deckPreview: 'Sour Thread pairs. Zing slips through rind.',
    visual: 'sour-ribbon',
    bodyColor: 0x84cc16,
    accentColor: 0xf0abfc,
    deck: [
      'slash', 'slash', 'slash', 'slash', 'slash', 'slash',
      'overload', 'overload',
      'block', 'block', 'block',
      'ward', 'ward',
    ],
  },
}
