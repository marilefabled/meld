import { describe, expect, it } from 'vitest'
import { CARD_DATA } from './cards.js'
import { CLASS_CONFIGS, type PlayerClass } from './classes.js'

const CLASSES: PlayerClass[] = ['warrior', 'mage', 'rogue']

describe('CLASS_CONFIGS metadata', () => {
  it('defines a signature card and scripted tutorial pair for every class', () => {
    for (const cls of CLASSES) {
      const cfg = CLASS_CONFIGS[cls]
      expect(CARD_DATA[cfg.signatureCard]).toBeDefined()
      expect(CARD_DATA[cfg.techniqueCard]).toBeDefined()
      expect(cfg.tutorialHand.filter(id => id === cfg.signatureCard)).toHaveLength(2)
      expect(cfg.deck.filter(id => id === cfg.signatureCard).length).toBeGreaterThanOrEqual(2)
      expect(cfg.deck.filter(id => id === 'overload')).toHaveLength(2)
      expect(cfg.deck).not.toContain(cfg.techniqueCard)
      expect(cfg.displayName.length).toBeGreaterThan(0)
      expect(cfg.role.length).toBeGreaterThan(0)
      expect(cfg.flavor.length).toBeGreaterThan(0)
      expect(cfg.deckPreview.length).toBeGreaterThan(0)
    }
  })
})
