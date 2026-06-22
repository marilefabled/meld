// Dialogue box UI — self-contained HTML/CSS overlay for the branching dialogue
// system. Attach it to a DialogueRunner; it handles display, typewriter animation,
// keyboard shortcuts, and choice buttons automatically.
//
//   const runner = createDialogueRunner()
//   const box    = createDialogueBox(runner, { typewriterSpeed: 40 })
//
//   runner.start(conversation, ctx)   // box appears automatically
//   // Space / Enter → advance auto-node (or skip typewriter first)
//   // 1-9 / click   → select choice

import type { DialogueRunner, ActiveNode } from './branchDialogue.js';
import type { PortraitStore } from './portraitStore.js';

export interface DialogueBoxOpts {
  /** Characters per second; 0 = instant. Default 40. */
  typewriterSpeed?: number
  /** Where to mount the box. Default: document.body. */
  container?: Element
  /** Vertical position of the box. Default 'bottom'. */
  position?: 'top' | 'center' | 'bottom'
  /** CSS max-width of the dialogue panel. Default '680px'. */
  width?: string
  /**
   * Optional portrait store. When provided the box auto-resolves speaker names
   * to portrait images — no need to set `node.portrait` on every node.
   */
  portraits?: PortraitStore
}

export interface DialogueBox {
  /** Show the box (called automatically by the runner 'node' event). */
  show(): void
  /** Hide the box (called automatically on 'end'). */
  hide(): void
  /** Skip typewriter — reveal full text immediately. */
  complete(): void
  readonly visible: boolean
  on(event: 'open' | 'close', fn: () => void): () => void
  dispose(): void
}

// ── Implementation ─────────────────────────────────────────────────────────

const STYLE_ID = 'engine-dialogue-box-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    .db-overlay {
      position: fixed; inset: 0; display: flex; align-items: flex-end;
      justify-content: center; padding: 24px; z-index: 9000;
      pointer-events: none; opacity: 0; transition: opacity 0.18s ease;
    }
    .db-overlay.db-visible { opacity: 1; pointer-events: auto; }
    .db-overlay.db-top    { align-items: flex-start; }
    .db-overlay.db-center { align-items: center; }

    .db-box {
      background: rgba(0,0,0,0.88); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px; max-width: var(--db-width, 680px); width: 100%;
      padding: 0; font-family: inherit; color: #e8e8e8;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      transform: translateY(8px); transition: transform 0.18s ease;
    }
    .db-overlay.db-visible .db-box { transform: translateY(0); }

    .db-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px 0;
    }
    .db-portrait {
      width: 40px; height: 40px; border-radius: 50%;
      object-fit: cover; border: 2px solid rgba(255,255,255,0.2);
      display: none;
    }
    .db-portrait.db-has-portrait { display: block; }
    .db-speaker {
      font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(255,255,255,0.5);
    }
    .db-speaker.db-has-speaker { color: #7ecfff; }

    .db-text {
      padding: 10px 16px 14px; font-size: 15px; line-height: 1.6;
      min-height: 3.5em;
    }

    .db-choices { display: flex; flex-direction: column; gap: 2px; padding: 0 10px 10px; }

    .db-choice {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px; color: #e8e8e8; font-size: 13px; font-family: inherit;
      padding: 8px 12px; text-align: left; cursor: pointer;
      transition: background 0.12s, border-color 0.12s;
      display: flex; align-items: center; gap: 10px;
    }
    .db-choice:hover, .db-choice.db-focused {
      background: rgba(126,207,255,0.15); border-color: rgba(126,207,255,0.4);
    }
    .db-choice-key {
      width: 18px; height: 18px; border-radius: 3px; flex-shrink: 0;
      background: rgba(255,255,255,0.12); font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; color: #aaa;
    }

    .db-prompt {
      padding: 6px 16px 12px; font-size: 11px; letter-spacing: 0.06em;
      color: rgba(255,255,255,0.3); text-align: right;
    }
  `
  document.head.appendChild(s)
}

export function createDialogueBox(
  runner: DialogueRunner<any>,
  opts:   DialogueBoxOpts = {},
): DialogueBox {
  injectStyles()

  const speed     = opts.typewriterSpeed ?? 40
  const container = opts.container ?? document.body
  const position  = opts.position  ?? 'bottom'
  const width     = opts.width     ?? '680px'
  const portraits = opts.portraits

  // ── DOM ────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div')
  overlay.className = `db-overlay db-${position}`
  overlay.style.setProperty('--db-width', width)

  overlay.innerHTML = `
    <div class="db-box">
      <div class="db-header">
        <img  class="db-portrait" alt="" />
        <span class="db-speaker"></span>
      </div>
      <div class="db-text"></div>
      <div class="db-choices"></div>
      <div class="db-prompt">SPACE to continue</div>
    </div>
  `
  container.appendChild(overlay)

  const portraitEl = overlay.querySelector('.db-portrait') as HTMLImageElement
  const speakerEl  = overlay.querySelector('.db-speaker')  as HTMLElement
  const textEl     = overlay.querySelector('.db-text')     as HTMLElement
  const choicesEl  = overlay.querySelector('.db-choices')  as HTMLElement
  const promptEl   = overlay.querySelector('.db-prompt')   as HTMLElement

  // ── State ──────────────────────────────────────────────────────────────
  let _visible     = false
  let _typing      = false
  let _currentNode: ActiveNode<any> | null = null
  let _timer: ReturnType<typeof setTimeout> | null = null
  const boxHandlers = new Map<string, Set<() => void>>()

  function fireBox(event: string) {
    boxHandlers.get(event)?.forEach(fn => { try { fn() } catch(e) { console.error('[DialogueBox]', e) } })
  }

  // ── Typewriter ─────────────────────────────────────────────────────────
  function stopTimer() {
    if (_timer) { clearTimeout(_timer); _timer = null }
  }

  function typewrite(text: string, onDone: () => void) {
    stopTimer()
    textEl.textContent = ''
    _typing = true
    if (!speed) { textEl.textContent = text; _typing = false; onDone(); return }
    let i = 0
    const ms = 1000 / speed
    const step = () => {
      if (i >= text.length) { _typing = false; onDone(); return }
      textEl.textContent = text.slice(0, ++i)
      _timer = setTimeout(step, ms)
    }
    _timer = setTimeout(step, ms)
  }

  function completeTypewriter() {
    if (!_typing || !_currentNode) return
    stopTimer()
    textEl.textContent = _currentNode.text
    _typing = false
    if (_currentNode.isAuto) promptEl.style.display = ''
    else renderChoices(_currentNode)
  }

  // ── Choices ────────────────────────────────────────────────────────────
  function renderChoices(node: ActiveNode<any>) {
    choicesEl.innerHTML = ''
    promptEl.style.display = 'none'
    node.choices.forEach((ch, ci) => {
      const btn = document.createElement('button')
      btn.className = 'db-choice'
      btn.innerHTML = `<span class="db-choice-key">${ci + 1}</span><span>${ch.label}</span>`
      btn.addEventListener('click', () => runner.advance(ci))
      choicesEl.appendChild(btn)
    })
  }

  // ── Node handler ───────────────────────────────────────────────────────
  function onNode(node: ActiveNode<any>) {
    _currentNode = node
    // Speaker
    if (node.speaker) {
      speakerEl.textContent = node.speaker
      speakerEl.className   = 'db-speaker db-has-speaker'
    } else {
      speakerEl.textContent = ''
      speakerEl.className   = 'db-speaker'
    }
    // Portrait — explicit node.portrait wins; fall back to portrait store by speaker name
    const portraitSrc = node.portrait ?? (node.speaker ? portraits?.get(node.speaker) : undefined)
    if (portraitSrc) {
      portraitEl.src       = portraitSrc
      portraitEl.className = 'db-portrait db-has-portrait'
    } else {
      portraitEl.src       = ''
      portraitEl.className = 'db-portrait'
    }
    // Text + typewriter
    choicesEl.innerHTML       = ''
    promptEl.style.display    = 'none'
    if (!_visible) box.show()

    typewrite(node.text, () => {
      if (node.isAuto) {
        promptEl.style.display = ''
      } else {
        renderChoices(node)
      }
    })
  }

  // ── Keyboard ──────────────────────────────────────────────────────────
  function onKey(e: KeyboardEvent) {
    if (!_visible) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (_typing) { completeTypewriter(); return }
      if (_currentNode?.isAuto) runner.advance()
    }
    if (e.key === 'Escape') {
      if (_typing) completeTypewriter()
    }
    const digit = parseInt(e.key)
    if (!isNaN(digit) && digit >= 1 && digit <= 9) {
      if (!_typing) runner.advance(digit - 1)
    }
  }
  document.addEventListener('keydown', onKey)

  // ── Runner event subscriptions ─────────────────────────────────────────
  const offNode = runner.on('node', onNode)
  const offEnd  = runner.on('end',  () => box.hide())

  // ── Public API ─────────────────────────────────────────────────────────
  const box: DialogueBox = {
    show() {
      if (_visible) return
      _visible = true
      overlay.classList.add('db-visible')
      fireBox('open')
    },

    hide() {
      if (!_visible) return
      stopTimer()
      _visible     = false
      _currentNode = null
      overlay.classList.remove('db-visible')
      fireBox('close')
    },

    complete() { completeTypewriter() },

    get visible() { return _visible },

    on(event, fn) {
      if (!boxHandlers.has(event)) boxHandlers.set(event, new Set())
      boxHandlers.get(event)!.add(fn)
      return () => boxHandlers.get(event)?.delete(fn)
    },

    dispose() {
      offNode(); offEnd()
      document.removeEventListener('keydown', onKey)
      overlay.remove()
    },
  }

  return box
}
