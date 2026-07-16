import { describe, expect, it } from 'vitest'
import { courtFinalMemorandum, courtLetterForRun } from './courtLetters.js'

describe('Candy Court correspondence', () => {
  it('gives each campaign bag a distinct authored field file', () => {
    const files = [0, 1, 2].map(run => courtLetterForRun(run))
    expect(new Set(files.map(letter => letter.fileNo)).size).toBe(3)
    expect(files.every(letter => letter.paragraphs.length === 3)).toBe(true)
  })

  it('keeps the Original memorandum separate from field correspondence', () => {
    const finale = courtFinalMemorandum()
    expect(finale.fileNo).toContain('FINAL')
    expect(finale.recipient).toContain('Candy')
  })
})
