import { describe, expect, it } from 'vitest'
import {
  TRACKS, STINGERS, battleContextForRun, mirrorContext, opponentSlug, bagThemeOrder,
  type MusicContext,
} from './soundtrack.js'
import { ARCHETYPES, makeMirror } from '../data/encounters.js'

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

  it('gives all 18 opponents a unique, file-safe theme slug', () => {
    const names = ARCHETYPES.flatMap(a => a.tiers.flat()).map(d => d.name)
    expect(names).toHaveLength(18)
    const slugs = names.map(opponentSlug)
    // A collision would make two bosses share one theme file.
    expect(new Set(slugs).size, 'opponent slugs collide').toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^boss-[a-z0-9-]+$/)
    expect(opponentSlug('The Last Drop')).toBe('boss-the-last-drop')
    // The Mirror is upper-case and still has to normalise cleanly.
    expect(opponentSlug(makeMirror('warrior', 1).name)).toBe('boss-the-original')
  })

  it('tries the current opponent first, then bag-mates in order', () => {
    const bag = ['Sachet', 'Brick Bite', 'Refill']
    // A themeless fight still leads with itself, so its own theme wins if present…
    expect(bagThemeOrder(bag, 'Brick Bite')).toEqual(['Brick Bite', 'Sachet', 'Refill'])
    // …then borrows a bag-mate. First in the bag with a file wins in the engine.
    expect(bagThemeOrder(bag, 'Sachet')).toEqual(['Sachet', 'Brick Bite', 'Refill'])
    // No duplicate of the current opponent even though it's in the bag list.
    expect(bagThemeOrder(bag, 'Refill').filter(n => n === 'Refill')).toHaveLength(1)
  })

  it('resolves every context the helpers can return', () => {
    const reachable: MusicContext[] = [
      battleContextForRun(0), battleContextForRun(1), battleContextForRun(2),
      mirrorContext(0), mirrorContext(1),
    ]
    for (const ctx of reachable) expect(TRACKS[ctx], ctx).toBeDefined()
  })
})
