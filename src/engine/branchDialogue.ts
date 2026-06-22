// vendored from threej@f973704 — src/engine/branchDialogue.ts
// Branching dialogue — data-driven conversation trees with conditions, flags,
// effects, and non-linear flow. Separate from the Ink-based linear dialogue
// (engine/dialogue.ts); use this for NPC interactions, interrogations, shops,
// tutorials — anywhere choices branch, gate content on game state, or loop back.
//
//   const conv = {
//     id: 'guard-01', start: 'hello',
//     nodes: [
//       { id: 'hello', speaker: 'Guard', text: 'Halt! Who goes there?',
//         choices: [
//           { label: 'Just passing through.', next: 'ok'   },
//           { label: 'None of your business!', next: 'rude', setFlag: 'was-rude' },
//         ] },
//       { id: 'ok',   speaker: 'Guard', text: 'Move along then.',                    next: undefined },
//       { id: 'rude', speaker: 'Guard',
//         text: (_, f) => f.has('apologised') ? 'Fine, whatever.' : 'Watch it!',
//         choices: [
//           { label: 'Sorry, sorry.',  next: undefined, setFlag: 'apologised', once: true },
//           { label: 'Whatever.',      next: undefined },
//         ]},
//     ],
//   }
//
//   const runner = createDialogueRunner()
//   runner.on('node', n => ui.show(n))
//   runner.on('end',  () => ui.hide())
//   runner.start(conv, {})

// ── Types ──────────────────────────────────────────────────────────────────

export interface DialogueNode<C = any> {
  id:        string
  speaker?:  string           // display name, e.g. 'Guard' / 'player' / 'narrator'
  text:      string | ((ctx: C, flags: ReadonlySet<string>) => string)
  portrait?: string           // asset key or URL — passed through to the UI layer

  /** Skip this node (auto-advance to next) when condition returns false. */
  condition?: (ctx: C, flags: ReadonlySet<string>) => boolean
  /** Side-effects fired when entering — give items, update state, play SFX, etc. */
  onEnter?:   (ctx: C, flags: Set<string>) => void
  /** Shorthand: add one or more flags to the runner's flag store on enter. */
  setFlag?:   string | string[]

  /** If undefined or empty, the node auto-advances to `next` on the next advance() call. */
  choices?: DialogueChoice<C>[]
  /** Default successor node id. undefined = end conversation. */
  next?:    string
}

export interface DialogueChoice<C = any> {
  label: string | ((ctx: C, flags: ReadonlySet<string>) => string)

  /** Custom visibility guard — hide this choice if returns false. */
  condition?:   (ctx: C, flags: ReadonlySet<string>) => boolean
  /** Shorthand: only visible when ALL listed flags are set. */
  requireFlag?: string | string[]
  /** Shorthand: hidden when ANY listed flag is set. */
  blockFlag?:   string | string[]

  /** Target node id. undefined = end conversation. */
  next?:     string
  /** Side-effects when the player selects this choice. */
  onSelect?: (ctx: C, flags: Set<string>) => void
  /** Shorthand: add one or more flags to the runner's flag store on selection. */
  setFlag?:  string | string[]
  /** Hide this choice after it has been selected once (tracked per-conversation). */
  once?:     boolean
}

export interface DialogueConversation<C = any> {
  id:    string
  start: string                 // id of the first node to visit
  nodes: DialogueNode<C>[]
}

/** A choice as presented to the UI layer — filtered, evaluated, index-stable. */
export interface ActiveChoice {
  index: number    // index into the original node.choices array
  label: string
  once:  boolean
}

/** A node as presented to the UI layer — text and choices pre-evaluated. */
export interface ActiveNode<C = any> {
  node:      DialogueNode<C>
  text:      string
  speaker?:  string
  portrait?: string
  choices:   ActiveChoice[]
  /** True when there are no visible choices — UI should auto-advance on acknowledgement. */
  isAuto:    boolean
}

// ── Runner interface ────────────────────────────────────────────────────────

export interface DialogueSnapshot {
  flags:  string[]
  picked: string[]
}

export interface DialogueRunner<C = any> {
  // ── Lifecycle ──────────────────────────────────────────────────────────
  start(conv: DialogueConversation<C>, ctx: C): void
  /**
   * Advance an auto node, or select choice at `choiceIndex` within active.choices.
   * For auto nodes pass no argument (or 0).
   */
  advance(choiceIndex?: number): void
  goto(nodeId: string): void
  end(): void

  // ── Flag store — persists across restarts within the same runner instance ──
  setFlag(name: string): void
  clearFlag(name: string): void
  hasFlag(name: string): boolean
  /** Bulk-replace the flag store (e.g. when restoring a save). */
  setFlags(flags: Iterable<string>): void
  readonly flags: ReadonlySet<string>

  // ── Save / restore ─────────────────────────────────────────────────────
  /** Snapshot flags + once-choices for save-game persistence. */
  snapshot(): DialogueSnapshot
  /** Restore a previously captured snapshot without starting a conversation. */
  restore(snap: DialogueSnapshot): void
  /** Clear all flags and once-choice history (fresh start). Ends any running conversation. */
  reset(): void

  // ── Read-only state ───────────────────────────────────────────────────
  readonly active:       ActiveNode<C> | null
  readonly running:      boolean
  readonly conversation: DialogueConversation<C> | null
  /** All nodes visited (in order) since the last reset(). */
  readonly journal: readonly ActiveNode<C>[]

  // ── Events ────────────────────────────────────────────────────────────
  on(event: 'node', fn: (node: ActiveNode<C>) => void): () => void
  on(event: 'end',  fn: () => void): () => void
}

// ── Implementation ─────────────────────────────────────────────────────────

export function createDialogueRunner<C = any>(): DialogueRunner<C> {
  const _flags   = new Set<string>()
  const _picked  = new Set<string>()  // "convId:nodeId:choiceIdx" for once-choices
  const _journal: ActiveNode<C>[] = []
  const handlers = new Map<string, Set<(...args: any[]) => void>>()

  let _conv:    DialogueConversation<C> | null = null
  let _ctx:     C | null = null
  let _nodeMap  = new Map<string, DialogueNode<C>>()
  let _active:  ActiveNode<C> | null = null
  let _running  = false

  function fire(event: string, ...args: any[]) {
    handlers.get(event)?.forEach(fn => { try { fn(...args) } catch(e) { console.error('[Dialogue]', e) } })
  }

  function evalText(t: string | ((c: C, f: ReadonlySet<string>) => string)): string {
    return typeof t === 'function' ? t(_ctx!, _flags) : t
  }

  function evalChoices(node: DialogueNode<C>): ActiveChoice[] {
    if (!node.choices?.length) return []
    const result: ActiveChoice[] = []
    for (let i = 0; i < node.choices.length; i++) {
      const ch = node.choices[i]
      const key = `${_conv!.id}:${node.id}:${i}`
      // once-choice already picked
      if (ch.once && _picked.has(key)) continue
      // requireFlag shorthand
      if (ch.requireFlag) {
        const required = Array.isArray(ch.requireFlag) ? ch.requireFlag : [ch.requireFlag]
        if (!required.every(f => _flags.has(f))) continue
      }
      // blockFlag shorthand
      if (ch.blockFlag) {
        const blocked = Array.isArray(ch.blockFlag) ? ch.blockFlag : [ch.blockFlag]
        if (blocked.some(f => _flags.has(f))) continue
      }
      // custom condition
      if (ch.condition && !ch.condition(_ctx!, _flags)) continue
      result.push({ index: i, label: evalText(ch.label), once: !!ch.once })
    }
    return result
  }

  function _enterNode(id: string) {
    const node = _nodeMap.get(id)
    if (!node) {
      console.warn(`[Dialogue] Node "${id}" not found in "${_conv?.id}"`)
      _doEnd(); return
    }
    // Condition check — skip node if guard fails
    if (node.condition && !node.condition(_ctx!, _flags)) {
      if (node.next) _enterNode(node.next); else _doEnd()
      return
    }
    // setFlag shorthand on entry
    if (node.setFlag) {
      const flags = Array.isArray(node.setFlag) ? node.setFlag : [node.setFlag]
      flags.forEach(f => _flags.add(f))
    }
    node.onEnter?.(_ctx!, _flags)

    const choices = evalChoices(node)
    _active = { node, choices, text: evalText(node.text),
                speaker: node.speaker, portrait: node.portrait,
                isAuto: choices.length === 0 }
    _journal.push(_active)
    fire('node', _active)
  }

  function _doEnd() { _running = false; _active = null; fire('end') }

  const runner: DialogueRunner<C> = {
    start(conv, ctx) {
      _conv    = conv
      _ctx     = ctx
      _nodeMap = new Map(conv.nodes.map(n => [n.id, n]))
      _running = true
      _enterNode(conv.start)
    },

    advance(choiceIndex) {
      if (!_running || !_active) return
      const { node } = _active

      if (_active.isAuto || choiceIndex == null) {
        if (node.next) _enterNode(node.next); else _doEnd()
        return
      }

      const active = _active.choices[choiceIndex]
      if (!active) return
      const ch = node.choices![active.index]

      if (ch.once) _picked.add(`${_conv!.id}:${node.id}:${active.index}`)
      if (ch.setFlag) {
        const flags = Array.isArray(ch.setFlag) ? ch.setFlag : [ch.setFlag]
        flags.forEach(f => _flags.add(f))
      }
      ch.onSelect?.(_ctx!, _flags)

      if (ch.next !== undefined) _enterNode(ch.next); else _doEnd()
    },

    goto(nodeId) { if (_running) _enterNode(nodeId) },
    end()        { _doEnd() },

    setFlag(name)   { _flags.add(name) },
    clearFlag(name) { _flags.delete(name) },
    hasFlag(name)   { return _flags.has(name) },
    setFlags(flags) { _flags.clear(); for (const f of flags) _flags.add(f) },
    get flags()     { return _flags as ReadonlySet<string> },

    snapshot() { return { flags: [..._flags], picked: [..._picked] } },
    restore(snap) {
      _flags.clear();  for (const f of snap.flags)  _flags.add(f)
      _picked.clear(); for (const p of snap.picked) _picked.add(p)
    },
    reset() {
      _flags.clear(); _picked.clear(); _journal.length = 0
      _doEnd()
    },

    get active()       { return _active },
    get running()      { return _running },
    get conversation() { return _conv },
    get journal()      { return _journal as readonly ActiveNode<C>[] },

    on(event: any, fn: any) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(fn)
      return () => handlers.get(event)?.delete(fn)
    },
  }

  return runner
}
