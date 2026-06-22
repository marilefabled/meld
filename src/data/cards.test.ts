import { describe, it, expect } from 'vitest'
import { scaledValue, CARD_DATA, MAX_TIER, makeCard } from './cards.js'

describe('scaledValue', () => {
  it('tier I is base value', () => {
    expect(scaledValue(CARD_DATA.strike, 1)).toBe(6)
  })
  it('tier II is 2.2× rounded', () => {
    expect(scaledValue(CARD_DATA.strike, 2)).toBe(Math.round(6 * 2.2))   // 13
  })
  it('tier III is 4.5× rounded', () => {
    expect(scaledValue(CARD_DATA.fireball, 3)).toBe(Math.round(9 * 4.5)) // 41
  })
  it('unknown tier falls back to ×1', () => {
    expect(scaledValue(CARD_DATA.heal, 99)).toBe(7)
  })
  it('MAX_TIER is 3', () => {
    expect(MAX_TIER).toBe(3)
  })
})

describe('makeCard', () => {
  it('assigns unique ids', () => {
    const a = makeCard('strike')
    const b = makeCard('strike')
    expect(a.id).not.toBe(b.id)
  })
  it('defaults to tier 1', () => {
    expect(makeCard('slash').tier).toBe(1)
  })
})
