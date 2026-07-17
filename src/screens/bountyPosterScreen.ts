import type { BountyPoster } from '../data/bounties.js'
import type { UnitVisual } from '../data/visuals.js'
import { createUnitPreview } from '../view/unitPreview.js'

const STYLE_ID = 'bounty-poster-screen-styles'

export interface BountyMugshot {
  visual:      UnitVisual
  bodyColor:   number
  accentColor: number
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .bounty-overlay {
      position: fixed; inset: 0; z-index: 9400; display: flex; align-items: center; justify-content: center;
      padding: 24px; opacity: 0; pointer-events: none; transition: opacity .24s ease;
      background: radial-gradient(ellipse 76% 70% at 50% 44%, rgba(56,32,10,.34), rgba(6,5,12,.97) 74%);
      backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
    }
    .bounty-overlay.visible { opacity: 1; pointer-events: auto; }

    /* Candy files letters. We nail up paper — so this one is a physical object. */
    .bounty {
      position: relative; width: min(94vw, 860px); max-height: min(90vh, 620px); overflow: auto;
      padding: 22px 26px 20px; color: #2a1c0f; transform: rotate(-.5deg);
      background:
        radial-gradient(ellipse 60% 50% at 22% 12%, rgba(255,255,255,.5), transparent 62%),
        linear-gradient(168deg, #efe3c6, #ddcaa4 62%, #cdb68b);
      box-shadow: 0 26px 84px rgba(0,0,0,.72), inset 0 0 60px rgba(120,72,26,.2);
      scrollbar-width: thin; scrollbar-color: rgba(90,54,20,.4) transparent;
    }
    .bounty::after {
      content: ''; position: absolute; inset: 7px; pointer-events: none;
      border: 1px solid rgba(84,48,16,.42);
    }

    .bn-head { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; }
    .bn-wanted {
      color: #9f1239; font: 900 34px/1 'Segoe UI', sans-serif; letter-spacing: .2em; text-transform: uppercase;
      text-shadow: 1px 1px 0 rgba(255,255,255,.34);
    }
    .bn-file { color: rgba(74,44,16,.72); font: 800 9px/1.3 'Segoe UI', sans-serif; letter-spacing: .13em; text-align: right; text-transform: uppercase; }
    .bn-order {
      margin: 3px 0 13px; padding-bottom: 11px; border-bottom: 2px solid rgba(84,48,16,.5);
      color: rgba(74,44,16,.9); font: 800 10px/1.3 'Segoe UI', sans-serif; letter-spacing: .16em; text-transform: uppercase;
    }

    .bn-main { display: grid; grid-template-columns: 190px 1fr; gap: 20px; align-items: start; }
    .bn-shot {
      position: relative; aspect-ratio: 1; border: 1px solid rgba(84,48,16,.5);
      background: radial-gradient(ellipse 70% 62% at 50% 44%, rgba(66,38,12,.34), rgba(24,12,4,.72));
      box-shadow: inset 0 0 30px rgba(0,0,0,.5);
    }
    .bn-shot canvas { display: block; width: 100% !important; height: 100% !important; }
    .bn-shot-tag {
      position: absolute; left: 0; right: 0; bottom: 0; padding: 3px 0;
      background: rgba(20,10,3,.68); color: rgba(240,226,198,.86);
      font: 800 8px/1.3 'Segoe UI', sans-serif; letter-spacing: .16em; text-align: center; text-transform: uppercase;
    }

    .bn-target { color: #2a1508; font: 900 clamp(26px, 3.4vw, 40px)/1 'Segoe UI', sans-serif; letter-spacing: .03em; text-transform: uppercase; }
    .bn-alias { margin-top: 5px; color: rgba(74,44,16,.78); font: italic 600 14px/1.3 Georgia, 'Times New Roman', serif; }
    .bn-label { margin: 15px 0 6px; color: rgba(74,44,16,.66); font: 800 9px/1 'Segoe UI', sans-serif; letter-spacing: .17em; text-transform: uppercase; }
    .bn-charges { display: grid; gap: 6px; }
    .bn-charges li { display: flex; gap: 8px; color: #33200f; font: 500 14px/1.5 Georgia, 'Times New Roman', serif; }
    .bn-charges li::before { content: '—'; color: rgba(84,48,16,.6); }

    .bn-hazards { display: grid; gap: 6px; margin-top: 13px; }
    .bn-hazard { display: flex; align-items: baseline; gap: 9px; padding: 7px 9px; background: rgba(159,18,57,.09); border-left: 3px solid #9f1239; }
    .bn-hz-label { flex: none; color: #9f1239; font: 900 9px/1.4 'Segoe UI', sans-serif; letter-spacing: .13em; }
    .bn-hz-detail { color: rgba(48,28,10,.9); font: 600 12px/1.45 'Segoe UI', sans-serif; }

    .bn-stats { display: flex; gap: 26px; margin-top: 15px; padding-top: 12px; border-top: 1px solid rgba(84,48,16,.34); }
    .bn-stat-label { color: rgba(74,44,16,.6); font: 800 8px/1 'Segoe UI', sans-serif; letter-spacing: .15em; text-transform: uppercase; }
    .bn-stat-value { margin-top: 4px; color: #2a1508; font: 900 19px/1 'Segoe UI', sans-serif; }
    .bn-stat-value.reward { color: #9f1239; }

    .bn-note {
      margin-top: 14px; padding: 11px 13px; background: rgba(120,72,26,.11); border-left: 3px solid rgba(84,48,16,.42);
      color: rgba(48,28,10,.92); font: italic 500 14px/1.55 Georgia, 'Times New Roman', serif;
    }
    .bn-action {
      display: block; width: 100%; margin-top: 16px; padding: 13px 16px; cursor: pointer;
      border: 1px solid rgba(84,48,16,.6); background: rgba(159,18,57,.12); color: #7f1d3a;
      font: 900 11px/1 'Segoe UI', sans-serif; letter-spacing: .16em; text-transform: uppercase;
    }
    .bn-action:hover { background: rgba(159,18,57,.22); border-color: #9f1239; color: #9f1239; }

    @media (max-width: 720px) {
      .bounty-overlay { padding: 12px; }
      .bounty { width: 100%; max-height: 92vh; padding: 16px 15px 14px; }
      .bn-wanted { font-size: 25px; letter-spacing: .14em; }
      .bn-main { grid-template-columns: 116px 1fr; gap: 13px; }
      .bn-charges li { font-size: 12.5px; line-height: 1.45; }
      .bn-note { font-size: 12.5px; }
      .bn-stats { gap: 18px; }
    }
  `
  document.head.appendChild(style)
}

export function showBountyPoster(poster: BountyPoster, mugshot: BountyMugshot): Promise<void> {
  return new Promise(resolve => {
    injectStyles()
    const overlay = document.createElement('div')
    overlay.className = 'bounty-overlay'
    const isFinal = poster.fileNo.startsWith('FINAL')
    overlay.innerHTML = `
      <article class="bounty" role="document" aria-label="Fruit Front bounty poster">
        <div class="bn-head">
          <div class="bn-wanted">Wanted</div>
          <div class="bn-file">${poster.fileNo}</div>
        </div>
        <div class="bn-order">By order of the Fruit Front · posted in the aisle it was taken from</div>
        <div class="bn-main">
          <div>
            <div class="bn-shot"><div class="bn-shot-tag">As last seen</div></div>
          </div>
          <div>
            <h2 class="bn-target">${poster.target}</h2>
            <div class="bn-alias">${poster.alias}</div>
            <div class="bn-label">Wanted for</div>
            <ul class="bn-charges">${poster.wantedFor.map(charge => `<li>${charge}</li>`).join('')}</ul>
            <div class="bn-hazards">
              ${poster.hazards.map(hazard => `
                <div class="bn-hazard">
                  <span class="bn-hz-label">${hazard.label}</span>
                  <span class="bn-hz-detail">${hazard.detail}</span>
                </div>
              `).join('')}
            </div>
            <div class="bn-stats">
              <div>
                <div class="bn-stat-label">Seal strength</div>
                <div class="bn-stat-value">${poster.sealStrength}</div>
              </div>
              <div>
                <div class="bn-stat-label">Reward</div>
                <div class="bn-stat-value reward">⬡ ${poster.reward}</div>
              </div>
            </div>
          </div>
        </div>
        <p class="bn-note">${poster.note}</p>
        <button class="bn-action">${isFinal ? 'Answer it' : 'Break the seal'}</button>
      </article>
    `
    document.body.appendChild(overlay)

    // Live mugshot. The handle MUST be disposed on close — a poster goes up before
    // every fight, and leaked WebGL contexts hit the browser cap within one run.
    let preview: { dispose(): void } | null = null
    try {
      preview = createUnitPreview(overlay.querySelector<HTMLElement>('.bn-shot')!, {
        visual:      mugshot.visual,
        bodyColor:   mugshot.bodyColor,
        accentColor: mugshot.accentColor,
        scale:       1.15,
      })
    } catch { /* no WebGL — the poster still reads without a portrait */ }

    requestAnimationFrame(() => overlay.classList.add('visible'))

    const close = () => {
      overlay.classList.remove('visible')
      overlay.addEventListener('transitionend', () => {
        preview?.dispose()
        overlay.remove()
        resolve()
      }, { once: true })
    }
    overlay.querySelector<HTMLButtonElement>('.bn-action')!.addEventListener('click', close)
  })
}
