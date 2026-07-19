import { describe, expect, it } from 'vitest'
import {
  TRACKS, STINGERS, battleContextForRun, mirrorContext,
  type MusicContext,
} from './soundtrack.js'

describe('soundtrack manifest', () => {
  it('maps every cue to a unique file and a real MTH id', () => {
    const defs = [...Object.values(TRACKS), ...Object.values(STINGERS)]
    const slugs = defs.map(d => d.slug)
    expect(new Set(slugs).size, 'slugs collide → files overwrite each other').toBe(slugs.length)
    for (const d of defs) {
      expect(d.cue, `${d.slug} cue`).toMatch(/^MTH-\d{2}$/)
      expect(d.slug).toMatch(/^[a-z0-9-]+$/)   // safe as a file basename
    }
  })

  it('routes each run to its own combat bed and clamps out of range', () => {
    expect(battleContextForRun(0)).toBe('battle-1')
    expect(battleContextForRun(1)).toBe('battle-2')
    expect(battleContextForRun(2)).toBe('battle-3')
    expect(battleContextForRun(9)).toBe('battle-3')   // clamp high
    expect(battleContextForRun(-1)).toBe('battle-1')  // clamp low
  })

  it('swaps the Mirror for its remembered variant after a loop', () => {
    expect(mirrorContext(0)).toBe('mirror')
    expect(mirrorContext(1)).toBe('mirror-remembered')
    expect(mirrorContext(4)).toBe('mirror-remembered')
  })

  it('resolves every context the helpers can return', () => {
    const reachable: MusicContext[] = [
      battleContextForRun(0), battleContextForRun(1), battleContextForRun(2),
      mirrorContext(0), mirrorContext(1),
    ]
    for (const ctx of reachable) expect(TRACKS[ctx], ctx).toBeDefined()
  })
})
