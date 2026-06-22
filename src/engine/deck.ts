// Deck / card system — shuffled draw pile, hand, and discard pile for card games,
// roguelike loot draws, random encounter tables, or any shuffled-pool mechanic.
// Also exports createLootTable for weighted-random selection.
//
//   // Card game
//   const deck = createDeck([
//     { id: 'fireball', name: 'Fireball', cost: 3 },
//     { id: 'shield',   name: 'Shield',   cost: 1 },
//     // ... 58 more cards
//   ])
//   deck.shuffle()
//   deck.draw(5)                    // draw opening hand
//   deck.play('fireball')           // play from hand (remove permanently)
//   deck.discard('shield')          // move to discard pile
//   deck.reshuffle()                // shuffle discard back into draw pile
//   deck.on('empty', () => alert('Out of cards!'))
//
//   // Roguelike loot table
//   const drops = createLootTable([
//     { item: 'gold',   weight: 60 },
//     { item: 'potion', weight: 30 },
//     { item: 'sword',  weight: 10 },
//   ])
//   const loot = drops.roll(3)   // draw 3 items by weight (with replacement)

// ── Types ──────────────────────────────────────────────────────────────────

export interface CardBase {
  id: string
  [key: string]: any
}

export type DeckEvent = 'draw' | 'play' | 'discard' | 'shuffle' | 'empty'

export interface Deck<T extends CardBase = CardBase> {
  /** Fisher-Yates shuffle of the current draw pile. */
  shuffle(): void
  /** Draw `n` cards from the top of the draw pile into the hand. Returns drawn cards. */
  draw(n?: number): T[]
  /**
   * Remove a card from the hand by id. Pass `toDiscard: true` to send it to the
   * discard pile instead of removing it entirely (default: remove permanently).
   */
  play(id: string, toDiscard?: boolean): T | undefined
  /** Move a hand card to the discard pile (leaves it in the game). */
  discard(id: string): T | undefined
  /** Shuffle the discard pile back into the draw pile. */
  reshuffle(): void
  /** Move ALL cards back to the draw pile and shuffle — full reset. */
  reset(): void
  /** Replace the deck's entire contents with a new set of cards (e.g. on game restart). */
  reinit(cards: T[]): void
  /** Push a card directly onto the top of the draw pile (e.g. after a merge). */
  inject(card: T): void
  /** Push a card directly into the discard pile so it cycles back naturally. */
  shelve(card: T): void

  readonly drawPile:    readonly T[]
  readonly hand:        readonly T[]
  readonly discardPile: readonly T[]
  readonly isEmpty:     boolean      // true when draw pile is empty

  on(event: DeckEvent, fn: (cards: T[]) => void): () => void
}

export interface LootEntry<T> {
  item:   T
  weight: number    // relative probability (e.g. 60, 30, 10)
}

export interface LootTable<T> {
  /** Draw `count` items using weighted-random selection. Defaults to with-replacement. */
  roll(count?: number, withReplacement?: boolean): T[]
  add(item: T, weight: number): void
  remove(item: T): void
  /** Total weight (sum of all entries). */
  readonly totalWeight: number
}

// ── Fisher-Yates shuffle (in-place) ───────────────────────────────────────

function fisherYates<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── createDeck ─────────────────────────────────────────────────────────────

export function createDeck<T extends CardBase>(cards: T[]): Deck<T> {
  const _draw:    T[] = [...cards]
  const _hand:    T[] = []
  const _discard: T[] = []

  const handlers = new Map<DeckEvent, Set<(cards: T[]) => void>>()

  function fire(event: DeckEvent, cards: T[]) {
    handlers.get(event)?.forEach(fn => { try { fn(cards) } catch(e) { console.error('[Deck]', e) } })
  }

  const deck: Deck<T> = {
    shuffle() {
      fisherYates(_draw)
      fire('shuffle', [..._draw])
    },

    draw(n = 1) {
      const drawn: T[] = []
      for (let i = 0; i < n; i++) {
        if (_draw.length === 0) { fire('empty', []); break }
        drawn.push(_draw.pop()!)
      }
      _hand.push(...drawn)
      if (drawn.length) fire('draw', drawn)
      return drawn
    },

    play(id, toDiscard = false) {
      const idx = _hand.findIndex(c => c.id === id)
      if (idx === -1) return undefined
      const [card] = _hand.splice(idx, 1)
      if (toDiscard) _discard.push(card)
      fire('play', [card])
      return card
    },

    discard(id) {
      const idx = _hand.findIndex(c => c.id === id)
      if (idx === -1) return undefined
      const [card] = _hand.splice(idx, 1)
      _discard.push(card)
      fire('discard', [card])
      return card
    },

    reshuffle() {
      _draw.push(..._discard.splice(0))
      fisherYates(_draw)
      fire('shuffle', [..._draw])
    },

    reset() {
      _draw.push(..._hand.splice(0), ..._discard.splice(0))
      fisherYates(_draw)
      fire('shuffle', [..._draw])
    },

    reinit(cards) {
      _draw.length = 0; _hand.length = 0; _discard.length = 0
      _draw.push(...cards)
    },

    inject(card) {
      _draw.push(card)
    },

    shelve(card) {
      _discard.push(card)
      fire('discard', [card])
    },

    get drawPile()    { return _draw    as readonly T[] },
    get hand()        { return _hand    as readonly T[] },
    get discardPile() { return _discard as readonly T[] },
    get isEmpty()     { return _draw.length === 0 },

    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(fn)
      return () => handlers.get(event)?.delete(fn)
    },
  }

  return deck
}

// ── createLootTable ────────────────────────────────────────────────────────

export function createLootTable<T>(entries: LootEntry<T>[]): LootTable<T> {
  const pool: LootEntry<T>[] = entries.map(e => ({ ...e }))

  function pick(): T {
    const total = pool.reduce((s, e) => s + e.weight, 0)
    let r = Math.random() * total
    for (const e of pool) { r -= e.weight; if (r < 0) return e.item }
    return pool[pool.length - 1].item  // floating-point safety
  }

  return {
    roll(count = 1, withReplacement = true) {
      if (pool.length === 0) return []
      if (withReplacement) return Array.from({ length: count }, pick)
      // Without replacement: shuffle a copy and take first `count`
      const copy = [...pool]
      fisherYates(copy)
      return copy.slice(0, count).map(e => e.item)
    },

    add(item, weight) { pool.push({ item, weight }) },

    remove(item) {
      const idx = pool.findIndex(e => e.item === item)
      if (idx !== -1) pool.splice(idx, 1)
    },

    get totalWeight() { return pool.reduce((s, e) => s + e.weight, 0) },
  }
}
