import { describe, expect, it } from 'vitest'
import { dialoguePromptForNode } from './dialogueBox.js'

describe('dialoguePromptForNode', () => {
  it('uses advance prompt for auto nodes', () => {
    expect(dialoguePromptForNode({ isAuto: true })).toBe('CLICK or SPACE to continue')
  })

  it('uses choice prompt for choice nodes', () => {
    expect(dialoguePromptForNode({ isAuto: false })).toBe('CHOOSE with click or 1-9')
  })
})
