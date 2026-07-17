export const FRUIT_VISUALS = ['cherry-brick', 'citrus-burst', 'sour-ribbon'] as const
export const CANDY_VISUALS = [
  'crimped-wrapper', 'violet-crinkle', 'sachet', 'flash-seal', 'hard-seal', 'blank-pack',
  'hard-set', 'hard-chew', 'brick-bite', 'rind-wall', 'gummy-vault', 'the-block',
  'last-drop', 'juice-bloom', 'refill-cartridge', 'licorice-tangle', 'the-gulp', 'the-flood',
] as const

export type FruitVisual = typeof FRUIT_VISUALS[number]
export type CandyVisual = typeof CANDY_VISUALS[number]
export type UnitVisual = FruitVisual | CandyVisual | 'original' | 'none'

export const UNIT_REGALIA = ['none', 'fruit-front', 'sealed', 'hard-set', 'refilling', 'original'] as const
export type UnitRegalia = typeof UNIT_REGALIA[number]
