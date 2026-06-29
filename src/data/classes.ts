export type PlayerClass = 'warrior' | 'mage' | 'rogue'

export const CLASS_CONFIGS: Record<PlayerClass, { hp: number; deck: string[] }> = {
  warrior: {
    hp: 70,
    deck: [
      'strike', 'strike', 'strike', 'strike',
      'slash', 'slash',
      'overload', 'overload',
      'block', 'block', 'block',
      'ward', 'ward',
    ],
  },
  mage: {
    hp: 55,
    deck: [
      'fireball', 'fireball', 'fireball', 'fireball', 'fireball', 'fireball',
      'overload', 'overload',
      'block', 'block',
      'ward', 'ward', 'ward',
    ],
  },
  rogue: {
    hp: 60,
    deck: [
      'slash', 'slash', 'slash', 'slash', 'slash', 'slash',
      'overload', 'overload',
      'block', 'block', 'block',
      'ward', 'ward',
    ],
  },
}
