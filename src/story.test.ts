import { describe, expect, it } from 'vitest'
import { INTRO } from './intro.js'
import { getBeat, getDefeatBeat } from './story.js'

const MARKS = [
  'First Scar', 'Iron Knuckle', 'Counting Heart',
  'Warden', 'Rampart', 'Wellspring',
  'Sentinel', 'Bastion', 'Maw',
  'Wisp', 'Husk', 'Bloom',
  'Zealot', 'Phalanx', 'Thicket',
  'Nullity', 'Colossus', 'Leviathan',
] as const

const CHOICE_BEATS = new Set([
  'First Scar', 'Iron Knuckle', 'Warden', 'Maw',
  'Wisp', 'Leviathan', 'YOUR ECHO',
])

describe('narrative budget', () => {
  it('keeps the first-run prologue to two lines', () => {
    expect(INTRO.nodes).toHaveLength(2)
  })

  it('keeps ordinary marks to one dialogue node', () => {
    for (const name of MARKS) {
      expect(getBeat(name)?.conv.nodes, name).toHaveLength(1)
    }
    expect(getBeat('YOUR ECHO')?.conv.nodes).toHaveLength(2)
  })

  it('offers choices only when the answer persists', () => {
    for (const name of [...MARKS, 'YOUR ECHO']) {
      const hasChoice = getBeat(name)!.conv.nodes.some(node => (node.choices?.length ?? 0) > 0)
      expect(hasChoice, name).toBe(CHOICE_BEATS.has(name))
    }
  })

  it('keeps defeat to one line', () => {
    expect(getDefeatBeat().conv.nodes).toHaveLength(1)
  })
})
