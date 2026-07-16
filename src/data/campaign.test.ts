import { describe, expect, it } from 'vitest'
import { replaceTechniquePair, type CampaignCard } from './campaign.js'

describe('replaceTechniquePair', () => {
  it('swaps exactly two package cards and preserves deck size', () => {
    const deck: CampaignCard[] = [
      { cardId: 'strike', tier: 2 },
      { cardId: 'overload', tier: 1 },
      { cardId: 'block', tier: 1 },
      { cardId: 'overload', tier: 3 },
      { cardId: 'borrowed_slash', tier: 1 },
    ]

    const next = replaceTechniquePair(deck, 'overload', 'counter')
    expect(next).toHaveLength(deck.length)
    expect(next.filter(card => card.cardId === 'counter')).toEqual([
      { cardId: 'counter', tier: 1 },
      { cardId: 'counter', tier: 1 },
    ])
    expect(next).toContainEqual({ cardId: 'strike', tier: 2 })
    expect(next).toContainEqual({ cardId: 'borrowed_slash', tier: 1 })
    expect(deck.filter(card => card.cardId === 'overload')).toHaveLength(2)
  })

  it('repairs an incomplete package without deleting unrelated cards', () => {
    const next = replaceTechniquePair([{ cardId: 'overload', tier: 2 }], 'overload', 'fuse')
    expect(next).toEqual([
      { cardId: 'fuse', tier: 1 },
      { cardId: 'fuse', tier: 1 },
    ])
  })
})
