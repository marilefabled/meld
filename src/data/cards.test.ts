import { describe, it, expect } from 'vitest'
import { getVariant, CARD_DATA, MAX_TIER, makeCard, DEFAULT_BUILD } from './cards.js'

describe('getVariant', () => {
  it('returns default (index 0) when build is empty', () => {
    const def = CARD_DATA.strike
    const v = getVariant(def, 1, DEFAULT_BUILD, 'strike')
    expect(v.value).toBe(6)
    expect(v.name).toBe('Tug')
  })
  it('returns alt variant when build selects index 1', () => {
    const def = CARD_DATA.strike
    const v = getVariant(def, 1, { strike: [1, 0, 0] }, 'strike')
    expect(v.name).toBe('Split')
    expect(v.value).toBe(4)
    expect(v.status?.kind).toBe('vulnerable')
  })
  it('T2 default strike is 13 dmg', () => {
    const v = getVariant(CARD_DATA.strike, 2, DEFAULT_BUILD, 'strike')
    expect(v.value).toBe(13)
  })
  it('T3 default fireball is 40 dmg with ignite status', () => {
    const v = getVariant(CARD_DATA.fireball, 3, DEFAULT_BUILD, 'fireball')
    expect(v.value).toBe(40)
    expect(v.status?.kind).toBe('poison')
    expect(v.status?.stacks).toBe(3)
  })
  it('T2 default block heals equal to absorb', () => {
    const v = getVariant(CARD_DATA.block, 2, DEFAULT_BUILD, 'block')
    expect(v.value).toBe(4)
    expect(v.heal).toBe(4)
  })
  it('T2 fortress variant has no heal but more absorb', () => {
    const v = getVariant(CARD_DATA.block, 2, { block: [0, 1, 0] }, 'block')
    expect(v.name).toBe('Keep')
    expect(v.value).toBe(7)
    expect(v.heal).toBeUndefined()
  })
  it('overload T2 discharge has selfDamage', () => {
    const v = getVariant(CARD_DATA.overload, 2, DEFAULT_BUILD, 'overload')
    expect(v.selfDamage).toBe(3)
  })
  it('clamps out-of-range index to last variant', () => {
    const v = getVariant(CARD_DATA.strike, 1, { strike: [99, 0, 0] }, 'strike')
    expect(v).toBeDefined()
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

describe('technique cards', () => {
  it('Counter guards while exposing the enemy', () => {
    const card = CARD_DATA.counter
    expect(card.type).toBe('defend')
    expect(card.shape).toBe('counter')
    expect(card.variants.map(tier => tier[0].value)).toEqual([0, 1, 2])
    expect(card.variants.map(tier => tier[0].retaliate)).toEqual([4, 9, 18])
    expect(card.variants.map(tier => tier[0].selfDamage)).toEqual([1, 2, 3])
    expect(card.variants.map(tier => tier[0].status?.kind)).toEqual(['vulnerable', 'vulnerable', 'vulnerable'])
  })

  it('Fuse deals setup damage and scales its opening', () => {
    const card = CARD_DATA.fuse
    expect(card.type).toBe('attack')
    expect(card.shape).toBe('fuse')
    expect(card.variants.map(tier => tier[0].value)).toEqual([1, 2, 5])
    expect(card.variants.map(tier => tier[0].status?.stacks)).toEqual([1, 1, 1])
  })

  it('Leech trades immediate force for healing and poison', () => {
    const card = CARD_DATA.leech
    expect(card.type).toBe('attack')
    expect(card.shape).toBe('leech')
    expect(card.variants.map(tier => tier[0].value)).toEqual([5, 12, 24])
    expect(card.variants.map(tier => tier[0].heal)).toEqual([1, 1, 1])
    expect(card.variants.map(tier => tier[0].status?.stacks)).toEqual([1, 1, 1])
  })
})
