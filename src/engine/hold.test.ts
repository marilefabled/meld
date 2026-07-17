import { describe, expect, it } from 'vitest'
import { canToggleHold } from './hold.js'

const ready = {
  isAnimating: false,
  isHeld: false,
  isPlayerTurn: true,
  isTutorialLocked: false,
  heldCount: 0,
  maxHolds: 2,
}

describe('canToggleHold', () => {
  it('allows holding at zero AP because hold does not spend AP', () => {
    expect(canToggleHold(ready)).toBe(true)
  })

  it('allows releasing a held card when the pouch is full', () => {
    expect(canToggleHold({ ...ready, isHeld: true, heldCount: 2 })).toBe(true)
  })

  it('blocks hold outside an active non-tutorial player turn', () => {
    expect(canToggleHold({ ...ready, isPlayerTurn: false })).toBe(false)
    expect(canToggleHold({ ...ready, isAnimating: true })).toBe(false)
    expect(canToggleHold({ ...ready, isTutorialLocked: true })).toBe(false)
  })
})
