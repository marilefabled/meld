export type PlayerClass = 'warrior' | 'mage' | 'rogue'

export interface ClassConfig {
  displayName: string
  hp: number
  deck: string[]
  role: string
  flavor: string
  signatureCard: string
  tutorialHand: string[]
  deckPreview: string
}

export const CLASS_CONFIGS: Record<PlayerClass, ClassConfig> = {
  warrior: {
    displayName: 'Vow-Bound',
    hp: 70,
    role: 'ANCHOR',
    flavor: 'A promise with teeth. One clean cut must matter.',
    signatureCard: 'strike',
    tutorialHand: ['strike', 'strike', 'block', 'ward'],
    deckPreview: 'Oathcut pairs. Shell and Hush blunt the answer.',
    deck: [
      'strike', 'strike', 'strike', 'strike',
      'slash', 'slash',
      'overload', 'overload',
      'block', 'block', 'block',
      'ward', 'ward',
    ],
  },
  mage: {
    displayName: 'Cinder-Seer',
    hp: 55,
    role: 'PYRE',
    flavor: 'Fragile body. Violent answer.',
    signatureCard: 'fireball',
    tutorialHand: ['fireball', 'fireball', 'block', 'ward'],
    deckPreview: 'Cinder floods. Enough heat to outrun healing.',
    deck: [
      'fireball', 'fireball', 'fireball', 'fireball', 'fireball', 'fireball',
      'overload', 'overload',
      'block', 'block',
      'ward', 'ward', 'ward',
    ],
  },
  rogue: {
    displayName: 'Needle-Saint',
    hp: 60,
    role: 'VENOM',
    flavor: 'Small cuts. Long consequence. Armor hates patience.',
    signatureCard: 'slash',
    tutorialHand: ['slash', 'slash', 'block', 'ward'],
    deckPreview: 'Needle pairs. Poison works through armor.',
    deck: [
      'slash', 'slash', 'slash', 'slash', 'slash', 'slash',
      'overload', 'overload',
      'block', 'block', 'block',
      'ward', 'ward',
    ],
  },
}
