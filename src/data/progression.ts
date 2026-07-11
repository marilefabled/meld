import { CARD_DATA } from './cards.js'
import type { PlayerClass } from './classes.js'

// A trophy ring earned by winning a full campaign, keyed to HOW you won:
// `${baseClass}-${path}` where path is 'absorb' (you took off-class essences) or
// 'deepen' (you strengthened your own form). e.g. 'warrior-deepen', 'mage-absorb'.
export type RingPath = 'absorb' | 'deepen'

export interface ProgressionState {
  fragments:         number
  unlockedVariants:  string[]   // variant .id strings
  runsCompleted:     number
  encountersCleared: number     // lifetime total
  cycles:            number     // full games completed (Mirror beaten) — gates memory dialogue
  earnedRings:       string[]   // persistent trophy rings, `${class}-${path}` (see RingPath)
}

const KEY = 'meld_v1'

function starterUnlocks(): string[] {
  const ids: string[] = []
  for (const def of Object.values(CARD_DATA)) {
    def.variants[0].forEach(v => ids.push(v.id))         // all T1 variants
    if (def.variants[1][0]) ids.push(def.variants[1][0].id)  // T2 default only
    if (def.variants[2][0]) ids.push(def.variants[2][0].id)  // T3 default only
    // T2 alts and T3 alts must be earned
  }
  return ids
}

function load(): ProgressionState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ProgressionState
      // Ensure all T1 variants stay unlocked regardless of save state
      const starter = starterUnlocks()
      for (const id of starter) {
        if (!parsed.unlockedVariants.includes(id)) parsed.unlockedVariants.push(id)
      }
      if (parsed.cycles == null) parsed.cycles = 0
      if (parsed.earnedRings == null) parsed.earnedRings = []
      return parsed
    }
  } catch { /* fresh start */ }
  return { fragments: 0, unlockedVariants: starterUnlocks(), runsCompleted: 0, encountersCleared: 0, cycles: 0, earnedRings: [] }
}

function persist(s: ProgressionState) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

let _s = load()

export const progression = {
  get state() { return _s },

  isUnlocked(variantId: string): boolean {
    return _s.unlockedVariants.includes(variantId)
  },

  unlock(variantId: string) {
    if (!_s.unlockedVariants.includes(variantId)) {
      _s.unlockedVariants.push(variantId)
      persist(_s)
    }
  },

  addFragments(n: number) {
    _s.fragments += n
    persist(_s)
  },

  spendFragments(n: number): boolean {
    if (_s.fragments < n) return false
    _s.fragments -= n
    persist(_s)
    return true
  },

  recordRunEnd(won: boolean, encsCleared: number) {
    _s.runsCompleted++
    _s.encountersCleared += encsCleared
    // Milestone: first ever Counting Heart clear unlocks all T3 alts
    if (won && _s.runsCompleted === 1) {
      for (const def of Object.values(CARD_DATA)) {
        const alt = def.variants[2][1]
        if (alt) this.unlock(alt.id)
      }
    }
    // Milestone: first ever Iron Knuckle clear unlocks all T2 alts
    if (_s.encountersCleared >= 2 && !_s.unlockedVariants.includes('first_brute')) {
      _s.unlockedVariants.push('first_brute')  // sentinel
      for (const def of Object.values(CARD_DATA)) {
        const alt = def.variants[1][1]
        if (alt) this.unlock(alt.id)
      }
    }
    persist(_s)
  },

  // The Mirror is beaten → one full game (cycle) complete. Gates memory dialogue.
  recordCycle() {
    _s.cycles++
    persist(_s)
  },

  // Win a full campaign → keep a trophy ring for the path you took. Permanent and
  // deduped, so each (class, path) combination is collected once.
  earnRing(baseClass: PlayerClass, path: RingPath) {
    const id = `${baseClass}-${path}`
    if (!_s.earnedRings.includes(id)) {
      _s.earnedRings.push(id)
      persist(_s)
    }
  },

  reset() {
    _s = { fragments: 0, unlockedVariants: starterUnlocks(), runsCompleted: 0, encountersCleared: 0, cycles: 0, earnedRings: [] }
    persist(_s)
  },
}
