export interface TutorialCardSpec {
  cardId: string
  tier: number
}

export interface BattleTutorialConfig {
  enabled: boolean
  signatureCard: string
  openingHand: string[]
}

export function buildTutorialOpeningDeck(deck: TutorialCardSpec[], openingHand: string[]): TutorialCardSpec[] {
  const remaining = deck.map(c => ({ ...c }))
  const hand = openingHand.map(cardId => {
    const idx = remaining.findIndex(c => c.cardId === cardId && c.tier === 1)
    if (idx === -1) return { cardId, tier: 1 }
    const [card] = remaining.splice(idx, 1)
    return card
  })

  // createDeck draws from the end of the draw pile, so reverse the scripted hand.
  return [...remaining, ...hand.reverse()]
}
