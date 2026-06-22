// Fade-to-black (or any colour) scene transitions. Owns a fullscreen CSS overlay
// that fades in, fires a swap callback at the midpoint, then fades out.
//
//   const trans = createSceneTransition()
//   trans.go(() => scenes.go('level2'))                // fade out → swap → fade in
//   trans.go(() => scenes.go('menu'), { color: '#000', duration: 0.6 })

export function createSceneTransition(opts: {
  color?: string
  duration?: number
  zIndex?: number
} = {}) {
  const {
    color: defaultColor = '#000',
    duration: defaultDuration = 0.45,
    zIndex = 9999,
  } = opts

  const el = document.createElement('div')
  el.style.cssText = `
    position:fixed;inset:0;pointer-events:none;z-index:${zIndex};
    background:${defaultColor};opacity:0;transition:opacity 0s;
  `
  document.body.appendChild(el)

  let _busy = false

  function go(
    swapFn: () => void,
    { color = defaultColor, duration = defaultDuration } = {},
  ): Promise<void> {
    if (_busy) return Promise.resolve()
    _busy = true
    el.style.background = color
    const half = duration / 2
    return new Promise<void>(resolve => {
      el.style.transition = `opacity ${half}s ease-in`
      el.style.opacity = '1'
      el.style.pointerEvents = 'all'
      setTimeout(() => {
        try { swapFn() } catch (e) { console.error('[sceneTransition] swap:', e) }
        el.style.transition = `opacity ${half}s ease-out`
        el.style.opacity = '0'
        setTimeout(() => {
          el.style.pointerEvents = 'none'
          _busy = false
          resolve()
        }, half * 1000 + 50)
      }, half * 1000 + 50)
    })
  }

  function dispose() { el.remove() }

  return { go, dispose, get busy() { return _busy } }
}
