import { describe, expect, it } from 'vitest'
import { buildRewardOptions } from './rewardScreen.js'

describe('buildRewardOptions', () => {
  it('keeps first-run rewards contextual to the defeated trait', () => {
    const options = buildRewardOptions({
      encIdx: 1,
      build: {},
      playerClass: 'rogue',
      enemyTraits: [{ kind: 'armored', absorb: 3 }],
    })

    expect(options).toHaveLength(3)
    expect(options[0].label).toBe('Keep Sour Thread')
    expect(options[0].sub).toContain('armored')
    expect(options[2].label).toContain('Sour Thread')
  })

  it('falls back to class signature card when the trait lesson is off-class', () => {
    const options = buildRewardOptions({
      encIdx: 0,
      build: {},
      playerClass: 'mage',
      enemyTraits: [{ kind: 'immune', statuses: ['poison', 'weak', 'vulnerable'] }],
    })

    expect(options[0].label).toBe('Keep Citrus Pop')
    expect(options[2].label).toContain('Cherry Pull')
  })
})
