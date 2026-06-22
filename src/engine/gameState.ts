// Game-loop state machine: PLAYING → PAUSED → GAME_OVER (or custom states).
// All frame callbacks registered via the loop should check `state.is('playing')`
// before ticking gameplay. The pause menu checks `state.is('paused')`.
//
//   const state = createGameState()
//   state.on('change', ({ from, to }) => console.log(from, '→', to))
//   state.pause()    // sets 'paused'
//   state.resume()   // back to 'playing'
//   state.set('game_over')
//   state.is('playing')  // false

type ChangeHandler = (e: { from: string; to: string }) => void

export function createGameState(initial = 'playing') {
  let current = initial
  const handlers = new Set<ChangeHandler>()

  function set(next: string) {
    if (next === current) return
    const from = current
    current = next
    for (const fn of [...handlers]) {
      try { fn({ from, to: next }) } catch (e) { console.error('[gameState]', e) }
    }
  }

  function get(): string { return current }
  function is(s: string): boolean { return current === s }

  function pause()  { if (current === 'playing') set('paused') }
  function resume() { if (current === 'paused') set('playing') }
  function toggle() { if (current === 'playing') pause(); else if (current === 'paused') resume() }

  function on(_event: 'change', fn: ChangeHandler) {
    handlers.add(fn)
    return () => { handlers.delete(fn) }
  }

  function reset() { set(initial) }

  return { set, get, is, pause, resume, toggle, on, reset }
}
