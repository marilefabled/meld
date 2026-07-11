import { describe, expect, it } from 'vitest'
import { buildTutorialOpeningDeck } from './tutorial.js'

describe('buildTutorialOpeningDeck', () => {
  it('places the scripted hand at the top of the draw pile in draw order', () => {
    const deck = [
      { cardId: 'strike', tier: 1 },
      { cardId: 'strike', tier: 1 },
      { cardId: 'slash', tier: 1 },
      { cardId: 'block', tier: 1 },
      { cardId: 'ward', tier: 1 },
    ]
    const arranged = buildTutorialOpeningDeck(deck, ['strike', 'strike', 'block', 'ward'])
    const drawn = [...arranged].reverse().slice(0, 4).map(c => c.cardId)

    expect(drawn).toEqual(['strike', 'strike', 'block', 'ward'])
    expect(arranged).toHaveLength(deck.length)
  })

  it('creates fallback tier-one cards when a scripted card is missing', () => {
    const arranged = buildTutorialOpeningDeck([{ cardId: 'ward', tier: 1 }], ['fireball', 'fireball'])
    const drawn = [...arranged].reverse().slice(0, 2)

    expect(drawn).toEqual([{ cardId: 'fireball', tier: 1 }, { cardId: 'fireball', tier: 1 }])
  })
})
