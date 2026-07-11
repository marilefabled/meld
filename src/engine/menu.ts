// vendored from threej@f973704 — src/engine/menu.ts
// Stack-based in-game menu system: main menu, pause overlay, options submenus —
// any nested structure. Self-contained (injects its own CSS once). Keyboard +
// mouse navigable. Matches the engine's dark blue-purple design language.
//
//   const menus = createMenuSystem({ sounds: { confirm: () => audio.play('blip') } })
//
//   const optionsMenu: MenuDef = {
//     title: 'Options',
//     items: [
//       { type: 'slider', label: 'Volume', get: () => 0.8, set: v => audio.setVolume(v) },
//       { type: 'select', label: 'Quality',
//           options: { Low: 'low', Medium: 'medium', High: 'high', Ultra: 'ultra' },
//           get: () => 'high', set: v => settings.set('graphicsQuality', v) },
//       { type: 'toggle', label: 'Minimap', get: () => true, set: v => minimap.enabled = v },
//       { type: 'separator' },
//       { type: 'back' },
//     ],
//   }
//
//   menus.push({ title: 'Main Menu', items: [
//     { type: 'button', label: 'Play',    action: () => { menus.close(); scenes.go('game') } },
//     { type: 'button', label: 'Options', action: () => menus.push(optionsMenu) },
//   ]})
//
//   // Pause on Escape (check each frame):
//   loop.onFrame(() => { if (input.consume('Escape') && !menus.active) menus.push(pauseMenu) })
//
//   // Block game input while open:
//   loop.onFrame((t, dt) => { if (menus.active) return; /* game logic */ })

// ── Types ──────────────────────────────────────────────────────────────────

export type MenuItemDef =
  | { type: 'button';    label: string; action: () => void; disabled?: () => boolean }
  | { type: 'slider';    label: string; get: () => number; set: (v: number) => void;
      min?: number; max?: number; step?: number; format?: (v: number) => string }
  | { type: 'toggle';    label: string; get: () => boolean; set: (v: boolean) => void }
  | { type: 'select';    label: string; get: () => string; set: (v: string) => void;
      options: string[] | Record<string, string> }
  | { type: 'header';    label: string }
  | { type: 'separator' }
  | { type: 'custom';    html: string; className?: string }   // raw HTML block (non-focusable)
  | { type: 'back';      label?: string }

export interface MenuDef {
  title?:     string
  items:      MenuItemDef[]
  /** How much to dim the scene behind the card. Default 'dim'. */
  backdrop?:  'none' | 'dim' | 'blur'
  /** Extra CSS class on the card element for project-level customisation. */
  className?: string
  /** If false, Escape cannot close this menu (use for root / title-screen menu). Default true. */
  closeable?: boolean
  onEnter?:   () => void
  onExit?:    () => void
}

export interface MenuSystemOpts {
  container?: HTMLElement
  sounds?: {
    navigate?: () => void
    confirm?:  () => void
    back?:     () => void
  }
  onOpen?:  () => void
  onClose?: () => void
}

// ── CSS (injected once into <head>) ─────────────────────────────────────────

const CSS = `
.ms-layer {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.ms-layer[hidden] { display: none !important; }
.ms-layer--dim  { background: rgba(0,0,0,0.65); }
.ms-layer--blur { background: rgba(4,5,12,0.72); backdrop-filter: blur(7px); }

.ms-card {
  background: rgba(6,7,16,0.97);
  border: 1px solid rgba(140,170,255,0.22);
  border-radius: 10px;
  padding: 32px 40px 28px;
  width: min(88vw, 420px);
  box-shadow: 0 0 60px rgba(80,120,255,0.14), 0 24px 56px rgba(0,0,0,0.6);
  opacity: 0;
  transform: translateY(10px) scale(0.975);
  transition: opacity .18s ease, transform .22s cubic-bezier(0.34,1.2,0.64,1);
}
.ms-card.is-visible { opacity: 1; transform: translateY(0) scale(1); }

.ms-title {
  font-family:'Courier New',monospace; font-size:.78rem; font-weight:bold;
  letter-spacing:.42em; text-transform:uppercase;
  color:rgba(160,190,255,.55); text-align:center;
  margin:0 0 24px;
}

.ms-items { display:flex; flex-direction:column; gap:2px; }

/* Button */
.ms-btn {
  display:block; width:100%;
  padding:13px 20px;
  background:transparent;
  border:1px solid transparent; border-radius:6px;
  color:rgba(195,210,255,.7);
  font-family:'Courier New',monospace; font-size:.86rem;
  letter-spacing:.16em; text-transform:uppercase; text-align:center;
  cursor:pointer; user-select:none;
  transition:background .1s, border-color .1s, color .1s, box-shadow .1s;
}
.ms-btn:hover, .ms-btn.is-focused {
  background:rgba(100,140,255,.09);
  border-color:rgba(130,165,255,.38);
  color:#e0eaff;
}
.ms-btn.is-focused { box-shadow:0 0 0 1px rgba(120,155,255,.45); }
.ms-btn:active { background:rgba(100,140,255,.2); }
.ms-btn:disabled, .ms-btn.is-disabled { opacity:.28; cursor:default; pointer-events:none; }

/* Row (slider, toggle, select) */
.ms-row {
  display:flex; align-items:center; justify-content:space-between;
  padding:11px 20px; gap:18px;
  border:1px solid transparent; border-radius:6px;
  transition:background .1s, border-color .1s;
}
.ms-row.is-focused {
  background:rgba(100,140,255,.07);
  border-color:rgba(130,165,255,.3);
}
.ms-row__label {
  color:rgba(195,210,255,.72);
  font-family:'Courier New',monospace; font-size:.84rem;
  letter-spacing:.12em; text-transform:uppercase; flex-shrink:0;
}
.ms-row__ctrl { display:flex; align-items:center; gap:9px; flex-shrink:0; }

/* Slider */
.ms-range {
  -webkit-appearance:none; appearance:none;
  width:110px; height:3px; border-radius:2px; outline:none; cursor:pointer;
  background:linear-gradient(to right, #6ea3ff var(--ms-pct,0%), rgba(100,140,255,.2) var(--ms-pct,0%));
}
.ms-range::-webkit-slider-thumb {
  -webkit-appearance:none;
  width:13px; height:13px; border-radius:50%;
  background:#6ea3ff; cursor:pointer;
  box-shadow:0 0 8px rgba(110,163,255,.5);
  transition:transform .1s;
}
.ms-range::-webkit-slider-thumb:hover { transform:scale(1.18); }
.ms-range::-moz-range-thumb {
  width:13px; height:13px; border-radius:50%;
  background:#6ea3ff; border:none; cursor:pointer;
}
.ms-value {
  color:#6ea3ff; font-family:'Courier New',monospace; font-size:.78rem;
  letter-spacing:.06em; min-width:3.2ch; text-align:right;
  font-variant-numeric:tabular-nums;
}

/* Toggle */
.ms-toggle {
  width:34px; height:19px; border-radius:10px; position:relative;
  background:rgba(100,140,255,.14); border:1px solid rgba(120,160,255,.28);
  cursor:pointer; flex-shrink:0;
  transition:background .18s, border-color .18s;
}
.ms-toggle.is-on {
  background:rgba(80,140,255,.38);
  border-color:rgba(120,160,255,.75);
}
.ms-toggle__thumb {
  position:absolute; top:2px; left:2px;
  width:13px; height:13px; border-radius:50%;
  background:rgba(155,180,255,.5);
  transition:left .15s, background .15s, box-shadow .15s;
}
.ms-toggle.is-on .ms-toggle__thumb {
  left:17px; background:#6ea3ff;
  box-shadow:0 0 8px rgba(110,163,255,.55);
}

/* Select */
.ms-cycle-btn {
  background:transparent; border:none; padding:0 3px; line-height:1;
  color:rgba(130,160,255,.45); font-family:'Courier New',monospace;
  font-size:.95rem; cursor:pointer;
  transition:color .1s;
}
.ms-cycle-btn:hover { color:#6ea3ff; }
.ms-select-val {
  color:#6ea3ff; font-family:'Courier New',monospace; font-size:.78rem;
  letter-spacing:.08em; min-width:5.5em; text-align:center;
}

/* Header + separator */
.ms-hdr {
  padding:14px 20px 4px;
  font-family:'Courier New',monospace; font-size:.6rem;
  letter-spacing:.4em; text-transform:uppercase;
  color:rgba(120,155,255,.38);
}
.ms-sep {
  height:1px; background:rgba(120,155,255,.12);
  margin:7px 16px;
}
`

// ── Factory ──────────────────────────────────────────────────────────────────

interface StackEntry {
  def:        MenuDef
  el:         HTMLElement
  focusables: HTMLElement[]
  focusIdx:   number
}

export function createMenuSystem(opts: MenuSystemOpts = {}) {
  const { container = document.body, sounds = {}, onOpen, onClose } = opts

  if (!document.getElementById('__ms_css')) {
    const s = document.createElement('style')
    s.id = '__ms_css'
    s.textContent = CSS
    document.head.appendChild(s)
  }

  const layer = document.createElement('div')
  layer.className = 'ms-layer'
  layer.hidden = true
  layer.setAttribute('aria-hidden', 'true')
  layer.inert = true
  container.appendChild(layer)

  const stack: StackEntry[] = []

  // ── Card builder ──────────────────────────────────────────────────────────

  function _buildEntry(def: MenuDef): StackEntry {
    // Create entry first so closures can close over it
    const entry: StackEntry = { def, el: null!, focusables: [], focusIdx: 0 }

    const card = document.createElement('div')
    card.className = 'ms-card' + (def.className ? ` ${def.className}` : '')

    if (def.title) {
      const h = document.createElement('div')
      h.className = 'ms-title'
      h.textContent = def.title
      card.appendChild(h)
    }

    const list = document.createElement('div')
    list.className = 'ms-items'
    card.appendChild(list)

    for (const item of def.items) {
      switch (item.type) {

        case 'button':
        case 'back': {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'ms-btn'
          btn.textContent = item.type === 'back' ? (item.label ?? '← Back') : item.label
          if (item.type === 'button' && item.disabled?.()) btn.classList.add('is-disabled')
          btn.addEventListener('click', () => {
            if (item.type === 'back')   { sounds.back?.(); pop() }
            else                         { sounds.confirm?.(); item.action() }
          })
          btn.addEventListener('mouseenter', () => _focusEl(entry, btn))
          entry.focusables.push(btn)
          list.appendChild(btn)
          break
        }

        case 'slider': {
          const min  = item.min ?? 0
          const max  = item.max ?? 1
          const step = item.step ?? 0.05
          const fmt  = item.format ?? (step >= 1
            ? (v: number) => String(Math.round(v))
            : max <= 1.01
              ? (v: number) => `${Math.round(v * 100)}%`
              : (v: number) => v.toFixed(1))

          const row  = document.createElement('div')
          row.className = 'ms-row'

          const lbl  = document.createElement('span')
          lbl.className = 'ms-row__label'
          lbl.textContent = item.label

          const ctrl = document.createElement('div')
          ctrl.className = 'ms-row__ctrl'

          const range = document.createElement('input')
          range.type = 'range'; range.className = 'ms-range'
          range.min = String(min); range.max = String(max); range.step = String(step)
          range.tabIndex = -1   // keyboard nav handled by _onKey, not browser tab
          const setRangeVal = (v: number) => {
            range.value = String(v)
            range.style.setProperty('--ms-pct', `${((v - min) / (max - min)) * 100}%`)
          }
          setRangeVal(item.get())

          const valEl = document.createElement('span')
          valEl.className = 'ms-value'
          valEl.textContent = fmt(item.get())

          range.addEventListener('input', () => {
            const v = Number(range.value)
            item.set(v)
            valEl.textContent = fmt(v)
            range.style.setProperty('--ms-pct', `${((v - min) / (max - min)) * 100}%`)
          })
          row.addEventListener('mouseenter', () => _focusEl(entry, row))

          // Stored for keyboard adjust + external refresh
          ;(row as any).__adjust = (dir: number) => {
            const v = Math.min(max, Math.max(min, Number(range.value) + step * dir))
            item.set(v); setRangeVal(v); valEl.textContent = fmt(v)
          }
          ;(row as any).__refresh = () => { setRangeVal(item.get()); valEl.textContent = fmt(item.get()) }

          ctrl.appendChild(range); ctrl.appendChild(valEl)
          row.appendChild(lbl); row.appendChild(ctrl)
          entry.focusables.push(row); list.appendChild(row)
          break
        }

        case 'toggle': {
          const row = document.createElement('div')
          row.className = 'ms-row'

          const lbl = document.createElement('span')
          lbl.className = 'ms-row__label'
          lbl.textContent = item.label

          const tog = document.createElement('div')
          tog.className = 'ms-toggle'
          tog.setAttribute('role', 'switch')
          const thumb = document.createElement('div')
          thumb.className = 'ms-toggle__thumb'
          tog.appendChild(thumb)

          const syncToggle = () => {
            const on = item.get()
            tog.classList.toggle('is-on', on)
            tog.setAttribute('aria-checked', String(on))
          }
          syncToggle()

          const doToggle = () => { item.set(!item.get()); syncToggle(); sounds.confirm?.() }
          tog.addEventListener('click', doToggle)
          row.addEventListener('mouseenter', () => _focusEl(entry, row))

          ;(row as any).__activate = doToggle
          ;(row as any).__refresh  = syncToggle

          row.appendChild(lbl); row.appendChild(tog)
          entry.focusables.push(row); list.appendChild(row)
          break
        }

        case 'select': {
          const optsArr = Array.isArray(item.options)
            ? item.options.map(v => ({ label: v, value: v }))
            : Object.entries(item.options).map(([label, value]) => ({ label, value }))

          const row = document.createElement('div')
          row.className = 'ms-row'

          const lbl = document.createElement('span')
          lbl.className = 'ms-row__label'
          lbl.textContent = item.label

          const ctrl = document.createElement('div')
          ctrl.className = 'ms-row__ctrl'

          const prevBtn = document.createElement('button')
          prevBtn.type = 'button'; prevBtn.className = 'ms-cycle-btn'
          prevBtn.textContent = '◀'; prevBtn.tabIndex = -1

          const valEl = document.createElement('span')
          valEl.className = 'ms-select-val'

          const nextBtn = document.createElement('button')
          nextBtn.type = 'button'; nextBtn.className = 'ms-cycle-btn'
          nextBtn.textContent = '▶'; nextBtn.tabIndex = -1

          const getCurIdx = () => Math.max(0, optsArr.findIndex(o => o.value === item.get()))
          const syncDisplay = () => { valEl.textContent = optsArr[getCurIdx()].label }
          syncDisplay()

          const cycle = (dir: number) => {
            const i = (getCurIdx() + dir + optsArr.length) % optsArr.length
            item.set(optsArr[i].value); syncDisplay(); sounds.confirm?.()
          }
          prevBtn.addEventListener('click', () => cycle(-1))
          nextBtn.addEventListener('click', () => cycle(+1))
          row.addEventListener('mouseenter', () => _focusEl(entry, row))

          ;(row as any).__adjust  = cycle
          ;(row as any).__refresh = syncDisplay

          ctrl.appendChild(prevBtn); ctrl.appendChild(valEl); ctrl.appendChild(nextBtn)
          row.appendChild(lbl); row.appendChild(ctrl)
          entry.focusables.push(row); list.appendChild(row)
          break
        }

        case 'header': {
          const h = document.createElement('div')
          h.className = 'ms-hdr'; h.textContent = item.label
          list.appendChild(h); break
        }

        case 'separator': {
          const sep = document.createElement('div')
          sep.className = 'ms-sep'; list.appendChild(sep); break
        }

        case 'custom': {
          const d = document.createElement('div')
          d.className = 'ms-custom' + (item.className ? ` ${item.className}` : '')
          d.innerHTML = item.html
          list.appendChild(d); break
        }
      }
    }

    entry.el = card
    return entry
  }

  // ── Focus helpers ─────────────────────────────────────────────────────────

  function _focusEl(entry: StackEntry, el: HTMLElement) {
    const i = entry.focusables.indexOf(el)
    if (i < 0) return
    if (entry.focusIdx === i) return
    entry.focusIdx = i
    _syncFocus(entry)
  }

  function _syncFocus(entry: StackEntry) {
    entry.focusables.forEach((el, i) => el.classList.toggle('is-focused', i === entry.focusIdx))
  }

  function _move(entry: StackEntry, dir: number) {
    entry.focusIdx = (entry.focusIdx + dir + entry.focusables.length) % entry.focusables.length
    _syncFocus(entry)
    sounds.navigate?.()
    entry.focusables[entry.focusIdx]?.scrollIntoView({ block: 'nearest' })
  }

  function _activate(entry: StackEntry) {
    const el = entry.focusables[entry.focusIdx]
    if (!el) return
    if (el.tagName === 'BUTTON') { (el as HTMLButtonElement).click(); return }
    const act = (el as any).__activate
    const adj = (el as any).__adjust
    if (act) act()
    else if (adj) adj(1)  // select: cycle forward on Enter
  }

  function _adjust(entry: StackEntry, dir: number) {
    const el = entry.focusables[entry.focusIdx]
    if (!el) return
    ;(el as any).__adjust?.(dir)
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────

  function _onKey(e: KeyboardEvent) {
    if (!stack.length) return
    const top = stack[stack.length - 1]
    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); _move(top, -1);  break
      case 'ArrowDown':  e.preventDefault(); _move(top, +1);  break
      case 'ArrowLeft':  e.preventDefault(); _adjust(top, -1); break
      case 'ArrowRight': e.preventDefault(); _adjust(top, +1); break
      case 'Enter': case ' ': e.preventDefault(); _activate(top); break
      case 'Escape': {
        e.preventDefault()
        if (stack[stack.length - 1]?.def.closeable !== false) pop()
        break
      }
    }
  }

  // ── Backdrop ──────────────────────────────────────────────────────────────

  function _applyBackdrop(def: MenuDef) {
    layer.classList.remove('ms-layer--dim', 'ms-layer--blur')
    const bd = def.backdrop ?? 'dim'
    if (bd === 'dim')  layer.classList.add('ms-layer--dim')
    if (bd === 'blur') layer.classList.add('ms-layer--blur')
  }

  // ── Stack operations ──────────────────────────────────────────────────────

  function push(def: MenuDef) {
    const entry = _buildEntry(def)
    stack.push(entry)

    layer.innerHTML = ''
    layer.appendChild(entry.el)
    _applyBackdrop(def)

    if (stack.length === 1) {
      layer.hidden = false
      layer.inert = false
      layer.setAttribute('aria-hidden', 'false')
      document.addEventListener('keydown', _onKey)
      onOpen?.()
    }

    def.onEnter?.()
    _syncFocus(entry)
    requestAnimationFrame(() => entry.el.classList.add('is-visible'))
  }

  function pop() {
    if (!stack.length) return
    const out = stack.pop()!
    out.def.onExit?.()
    sounds.back?.()

    if (!stack.length) {
      _hide()
    } else {
      const prev = stack[stack.length - 1]
      layer.innerHTML = ''
      layer.appendChild(prev.el)
      _applyBackdrop(prev.def)
      _syncFocus(prev)
      requestAnimationFrame(() => prev.el.classList.add('is-visible'))
    }
  }

  function close() {
    while (stack.length) stack.pop()!.def.onExit?.()
    _hide()
  }

  function _hide() {
    layer.hidden = true
    layer.inert = true
    layer.setAttribute('aria-hidden', 'true')
    document.removeEventListener('keydown', _onKey)
    onClose?.()
  }

  // Re-read all current values into the top menu's controls (call if settings
  // changed externally while the menu is open).
  function refresh() {
    if (!stack.length) return
    for (const el of stack[stack.length - 1].focusables) {
      ;(el as any).__refresh?.()
    }
  }

  return {
    push,
    pop,
    close,
    refresh,
    /** Replace the top of the stack without an extra push animation. */
    replace(def: MenuDef) { if (stack.length) { stack.pop()!.def.onExit?.() } push(def) },
    get active()  { return stack.length > 0 },
    get current() { return stack[stack.length - 1]?.def ?? null },
    get depth()   { return stack.length },
    /** The raw DOM overlay — set CSS on it for project-level theming. */
    layer,
  }
}
