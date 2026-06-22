// vendored from threej@f973704 — src/engine/debugOverlay.ts
// Lightweight debug overlay: FPS, draw calls, triangles, and custom counters.
// Toggle with backtick (`) or `overlay.visible = true`. Updates every 0.25 s.
//
//   const debug = createDebugOverlay(renderer)
//   loop.onFrame(() => debug.update())
//   debug.set('entities', world.entities.length)   // custom gauge
//
// Reads renderer.info.render (drawCalls, triangles) automatically.

export function createDebugOverlay(renderer: any) {
  const el = document.createElement('pre')
  el.style.cssText = `
    position:fixed;top:4px;left:4px;z-index:10000;
    font:11px/1.35 monospace;color:#0f0;background:rgba(0,0,0,.65);
    padding:4px 8px;border-radius:4px;pointer-events:none;margin:0;
  `
  el.hidden = true
  document.body.appendChild(el)

  const custom = new Map<string, string | number>()
  let frames = 0, elapsed = 0, fps = 0
  let _visible = false

  function update(dt?: number) {
    frames++
    elapsed += dt ?? (1 / 60)
    if (elapsed >= 0.25) {
      fps = Math.round(frames / elapsed)
      frames = 0
      elapsed = 0
      if (_visible) render()
    }
  }

  function render() {
    const info = renderer.info?.render
    const draws = info?.calls ?? '?'
    const tris = info?.triangles ?? '?'
    let text = `FPS: ${fps}  draws: ${draws}  tris: ${tris}`
    custom.forEach((v, k) => { text += `\n${k}: ${v}` })
    el.textContent = text
  }

  function set(key: string, value: string | number) {
    custom.set(key, value)
  }

  function remove(key: string) {
    custom.delete(key)
  }

  function dispose() { el.remove() }

  document.addEventListener('keydown', e => {
    if (e.code === 'Backquote') { _visible = !_visible; el.hidden = !_visible }
  })

  return {
    update, set, remove, dispose,
    get visible() { return _visible },
    set visible(v: boolean) { _visible = v; el.hidden = !v },
    el,
  }
}
