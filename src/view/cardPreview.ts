// Big card preview — a floating, enlarged illustrated card shown on hover over
// small card UIs (loadout tiles, hand cards). One shared singleton element.

import { cardArt } from '../engine/icons.js'
import type { CardDef } from '../data/cards.js'

let _el: HTMLElement | null = null

function ensure(): HTMLElement {
  if (_el) return _el
  _el = document.createElement('div')
  _el.id = 'card-preview'
  document.body.appendChild(_el)
  return _el
}

const vw = () => window.innerWidth  || document.documentElement.clientWidth  || 1280
const vh = () => window.innerHeight || document.documentElement.clientHeight || 720

/** Big illustrated card markup for a card def + a chosen variant. */
export function bigCardHTML(def: CardDef, name: string, desc: string, tierRoman: string): string {
  const cc = '#' + def.color.toString(16).padStart(6, '0')
  return `<div class="bc" style="--cc:${cc}">
    <span class="bc-gem">⚡${def.cost}</span>
    <span class="bc-tier">${tierRoman}</span>
    <div class="bc-art">${cardArt(def.shape, def.color, def.type)}<div class="bc-glyph">${def.icon}</div></div>
    <div class="bc-name">${name}</div>
    <div class="bc-kind">${def.type === 'attack' ? 'ATTACK' : 'DEFEND'} · ${def.name}</div>
    <div class="bc-desc">${desc}</div>
  </div>`
}

/** Show the preview, positioned above the anchor (clamped to the viewport). */
export function showCardPreview(html: string, anchor: DOMRect): void {
  const el = ensure()
  el.innerHTML = html
  el.classList.add('show')
  const W = 224, gap = 16
  let left = anchor.left + anchor.width / 2 - W / 2
  left = Math.max(10, Math.min(left, vw() - W - 10))
  el.style.left = `${left}px`
  // prefer above the anchor; drop below if it would clip the top
  const h = el.offsetHeight || 300
  const above = anchor.top - gap - h
  el.style.top = above > 8 ? `${above}px` : `${Math.min(anchor.bottom + gap, vh() - h - 10)}px`
}

export function hideCardPreview(): void { _el?.classList.remove('show') }
