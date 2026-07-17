import { describe, expect, it } from 'vitest'
import { ARCHETYPES } from './encounters.js'
import { CLASS_CONFIGS } from './classes.js'
import { CANDY_VISUALS, FRUIT_VISUALS } from './visuals.js'

describe('unit visual metadata', () => {
  it('gives every Fruit Front form its own approved visual identity', () => {
    for (const config of Object.values(CLASS_CONFIGS)) {
      expect(FRUIT_VISUALS).toContain(config.visual)
    }
  })

  it('gives every Candy combatant a specific approved visual identity', () => {
    for (const archetype of ARCHETYPES) {
      for (const tier of archetype.tiers) {
        for (const enemy of tier) expect(CANDY_VISUALS).toContain(enemy.visual)
      }
    }
  })
})
