// vendored from threej@f973704 — src/engine/registry.ts
// Data-driven content registry. Load enemies, items, levels, etc. from JSON
// instead of hardcoding them in TypeScript. Like LÖVE tables but validated.
//
//   const enemies = createRegistry<EnemyDef>('enemies')
//   await enemies.loadJSON('/data/enemies.json')   // or enemies.loadAll(jsonObject)
//   const goblin = enemies.get('goblin')            // typed EnemyDef
//   enemies.forEach((id, def) => spawnEnemy(def))
//
// Supports hot-reload (call loadJSON again), id enumeration, and optional
// validate callback that throws on bad data before it enters the store.

export interface RegistryOpts<T> {
  validate?: (id: string, raw: unknown) => T
}

export function createRegistry<T>(name: string, opts: RegistryOpts<T> = {}) {
  const store = new Map<string, T>()
  const { validate } = opts

  function set(id: string, def: T) {
    store.set(id, def)
  }

  function get(id: string): T | undefined {
    return store.get(id)
  }

  function require(id: string): T {
    const v = store.get(id)
    if (v === undefined) throw new Error(`[registry:${name}] unknown id "${id}"`)
    return v
  }

  function has(id: string): boolean {
    return store.has(id)
  }

  function remove(id: string) {
    store.delete(id)
  }

  function ids(): string[] {
    return [...store.keys()]
  }

  function forEach(fn: (id: string, def: T) => void) {
    store.forEach((v, k) => fn(k, v))
  }

  function loadAll(data: Record<string, unknown>) {
    for (const [id, raw] of Object.entries(data)) {
      const def = validate ? validate(id, raw) : raw as T
      store.set(id, def)
    }
  }

  async function loadJSON(url: string) {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`[registry:${name}] fetch failed: ${resp.status} ${url}`)
    const data = await resp.json()
    loadAll(data)
  }

  function toJSON(): Record<string, T> {
    const out: Record<string, T> = {}
    store.forEach((v, k) => { out[k] = v })
    return out
  }

  function clear() {
    store.clear()
  }

  return { set, get, require, has, remove, ids, forEach, loadAll, loadJSON, toJSON, clear, get size() { return store.size } }
}
