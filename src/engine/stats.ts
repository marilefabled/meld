// vendored from threej@f973704 — src/engine/stats.ts
// Stat block — named numeric attributes for game entities (HP, MP, attack, etc.).
// Each stat has a base value, optional min/max clamp, optional regen, and named
// additive modifiers (buffs/debuffs). Effective value = clamp(base + Σmods, min, max).
//
//   const stats = createStatBlock({
//     hp:  { base: 100, max: 100, regen: 2 },   // 2 HP/sec
//     mp:  { base: 50,  max: 50,  regen: 5 },
//     atk: { base: 15 },
//     def: { base: 5  },
//   })
//
//   stats.modify('hp', -20)                    // take damage
//   stats.buff('atk', 'power-up', 10)         // +10 attack (named so it can be removed)
//   stats.on('depleted', 'hp', () => die())
//   loop.onFrame((_, dt) => stats.update(dt)) // regen ticks

export interface StatDef {
  base:   number
  min?:   number    // floor (default 0)
  max?:   number    // ceiling; omit for uncapped-upward stats like XP
  regen?: number    // units per second (positive = heal, negative = drain)
}

export type StatEvent = 'change' | 'depleted' | 'recovered'

export interface StatBlock<K extends string = string> {
  // ── Read ──────────────────────────────────────────────────────────────────
  get(key: K): number                   // current effective value
  getBase(key: K): number               // base before modifiers
  getMax(key: K): number | undefined    // cap (undefined if uncapped)
  /** 0–1 fraction of current / max. Returns 1 if the stat has no cap. */
  pct(key: K): number

  // ── Write ─────────────────────────────────────────────────────────────────
  /** Set current value (also updates the base so modifiers still make sense). */
  set(key: K, value: number): void
  /** Add delta to base (positive = heal/buff, negative = damage/drain). */
  modify(key: K, delta: number): void
  /** Reset to max. No-op if the stat has no cap. */
  restore(key: K): void
  /** Update the ceiling for a stat (useful for scaling HP between encounters). */
  setMax(key: K, value: number): void

  // ── Modifiers ─────────────────────────────────────────────────────────────
  /** Add a named additive modifier — re-using the same id replaces the old one. */
  buff(key: K, id: string, delta: number): void
  /** Convenience wrapper: calls buff() with -Math.abs(delta). */
  debuff(key: K, id: string, delta: number): void
  clearBuff(key: K, id: string): void
  clearAllBuffs(key?: K): void

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /** Tick regen for all stats that have it. Call from loop.onFrame. */
  update(dt: number): void
  /** Snapshot of current effective values (useful for save/serialisation). */
  snapshot(): Record<K, number>

  // ── Events ────────────────────────────────────────────────────────────────
  on(event: StatEvent, key: K, fn: (current: number, prev: number) => void): () => void
}

// ── Implementation ─────────────────────────────────────────────────────────

type _Internal = {
  base:  number
  min:   number
  max:   number | undefined
  regen: number
  mods:  Map<string, number>  // id → delta
  curr:  number               // cached effective value
}

export function createStatBlock<K extends string = string>(
  defs: Record<K, StatDef>,
): StatBlock<K> {
  const stats    = new Map<string, _Internal>()
  const handlers = new Map<string, Set<(c: number, p: number) => void>>()

  for (const [key, def] of Object.entries(defs) as [K, StatDef][]) {
    const min  = def.min ?? 0
    const max  = def.max
    const base = clampStat(def.base, min, max)
    stats.set(key, { base, min, max, regen: def.regen ?? 0, mods: new Map(), curr: base })
  }

  function clampStat(v: number, min: number, max: number | undefined): number {
    return Math.max(min, max !== undefined ? Math.min(max, v) : v)
  }

  function effective(s: _Internal): number {
    let v = s.base
    for (const d of s.mods.values()) v += d
    return clampStat(v, s.min, s.max)
  }

  function commit(key: string, s: _Internal) {
    const prev = s.curr
    const next = effective(s)
    if (next === prev) return
    s.curr = next
    handlers.get(`change:${key}`)?.forEach(fn => fn(next, prev))
    if (next <= s.min && prev > s.min)
      handlers.get(`depleted:${key}`)?.forEach(fn => fn(next, prev))
    if (next > s.min && prev <= s.min)
      handlers.get(`recovered:${key}`)?.forEach(fn => fn(next, prev))
  }

  const block: StatBlock<K> = {
    get(key)     { return stats.get(key)?.curr ?? 0 },
    getBase(key) { return stats.get(key)?.base ?? 0 },
    getMax(key)  { return stats.get(key)?.max },
    pct(key) {
      const s = stats.get(key)
      return (s?.max != null) ? s.curr / s.max : 1
    },

    set(key, value) {
      const s = stats.get(key); if (!s) return
      s.base = clampStat(value, s.min, s.max)
      commit(key, s)
    },

    modify(key, delta) {
      const s = stats.get(key); if (!s) return
      s.base = clampStat(s.base + delta, s.min, s.max)
      commit(key, s)
    },

    restore(key) {
      const s = stats.get(key); if (!s || s.max === undefined) return
      s.base = s.max; commit(key, s)
    },

    setMax(key, value) {
      const s = stats.get(key); if (!s) return
      s.max = value
      if (s.base > value) { s.base = value; commit(key, s) }
    },

    buff(key, id, delta) {
      const s = stats.get(key); if (!s) return
      s.mods.set(id, delta); commit(key, s)
    },

    debuff(key, id, delta) { block.buff(key, id, -Math.abs(delta)) },

    clearBuff(key, id) {
      const s = stats.get(key); if (!s) return
      s.mods.delete(id); commit(key, s)
    },

    clearAllBuffs(key) {
      if (key) {
        const s = stats.get(key); if (s) { s.mods.clear(); commit(key, s) }
      } else {
        for (const [k, s] of stats) { s.mods.clear(); commit(k, s) }
      }
    },

    update(dt) {
      for (const [key, s] of stats) {
        if (s.regen === 0) continue
        const next = clampStat(s.base + s.regen * dt, s.min, s.max)
        if (next !== s.base) { s.base = next; commit(key, s) }
      }
    },

    snapshot() {
      const out: any = {}
      for (const [k, s] of stats) out[k] = s.curr
      return out as Record<K, number>
    },

    on(event, key, fn) {
      const k = `${event}:${key}`
      if (!handlers.has(k)) handlers.set(k, new Set())
      handlers.get(k)!.add(fn as any)
      return () => handlers.get(k)?.delete(fn as any)
    },
  }

  return block
}
