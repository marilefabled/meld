import { describe, expect, it } from 'vitest'
import { candyRivalFor } from './rivals.js'
import { ENCOUNTERS, makeMirror } from './encounters.js'

describe('candyRivalFor', () => {
  it('gives the first Candy seal an authored Court voice', () => {
    const rival = candyRivalFor(ENCOUNTERS[0])
    expect(rival.speaker).toContain('THE CRIMP')
    expect(rival.opening).toContain('Fruit')
    expect(rival.defeat).toBeTruthy()
  })

  it('gives the Original a distinct finale voice', () => {
    const rival = candyRivalFor(makeMirror('warrior', 1))
    expect(rival.speaker).toContain('THE ORIGINAL')
    expect(rival.opening).toContain('proof')
  })

  it('falls back to a trait-aware Court voice for future encounters', () => {
    const rival = candyRivalFor({
      name: 'Fresh Batch', visual: 'hard-set', bodyColor: 0, accentColor: 0, hp: 1, moves: [],
      traits: [{ kind: 'armored', absorb: 1 }],
    })
    expect(rival.speaker).toContain('FRESH BATCH')
    expect(rival.opening).toContain('soft')
  })
})
