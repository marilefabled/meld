import { describe, expect, it } from 'vitest'
import { bountyFor } from './bounties.js'
import { ARCHETYPES, makeMirror, type EnemyDef } from './encounters.js'

const everyOpponent: EnemyDef[] = ARCHETYPES.flatMap(a => a.tiers.flat())

describe('Fruit Front bounty posters', () => {
  it('authors a poster for every opponent the gauntlet can field', () => {
    // The fallback exists for safety, not for shipping. If a new variant lands in
    // encounters.ts without copy in BOUNTIES, this fails instead of quietly
    // shipping "We have no file on this one."
    for (const def of everyOpponent) {
      const poster = bountyFor(def, { sealNo: 1, reward: 10 })
      expect(poster.note, `${def.name} falls back`).not.toContain('no file on this one')
      expect(poster.wantedFor).toHaveLength(2)
      expect(poster.alias).not.toBe('CANDY COURT')
    }
  })

  it('reads target, seal strength and hazards off the enemy it fights', () => {
    const gulp = everyOpponent.find(d => d.name === 'The Gulp')!
    const poster = bountyFor(gulp, { sealNo: 3, reward: 25 })
    expect(poster.target).toBe('The Gulp')
    expect(poster.sealStrength).toBe(gulp.hp)
    expect(poster.reward).toBe(25)
    // regen → REFILLING, quoting the actual per-turn heal
    expect(poster.hazards.map(h => h.label)).toEqual(['REFILLING'])
    expect(poster.hazards[0].detail).toContain('+10')
  })

  it('names both walls of a dual-trait apex', () => {
    const hardSeal = everyOpponent.find(d => d.name === 'Hard Seal')!
    const poster = bountyFor(hardSeal, { sealNo: 1, reward: 10 })
    expect(poster.hazards.map(h => h.label)).toEqual(['SEALED', 'HARD-SET'])
  })

  it('files the Original as a final bounty rather than a seal', () => {
    const poster = bountyFor(makeMirror('warrior', 1), { sealNo: null, reward: 25 })
    expect(poster.fileNo).toContain('FINAL')
    expect(poster.target).toBe('THE ORIGINAL')
    expect(poster.note).toContain('proof')
  })

  it('still files paper on an unknown candy', () => {
    const stranger: EnemyDef = {
      name: 'Nobody', visual: 'sachet', bodyColor: 0, accentColor: 0, hp: 10,
      traits: [{ kind: 'armored', absorb: 2 }], moves: [],
    }
    const poster = bountyFor(stranger, { sealNo: 2, reward: 10 })
    expect(poster.wantedFor).toHaveLength(2)
    expect(poster.hazards[0].label).toBe('HARD-SET')
  })
})
