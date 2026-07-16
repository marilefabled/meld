import type { CourtLetter } from '../data/courtLetters.js'

const STYLE_ID = 'court-letter-screen-styles'

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .court-letter-overlay {
      position: fixed; inset: 0; z-index: 9400; display: flex; align-items: center; justify-content: center;
      padding: 28px; opacity: 0; pointer-events: none; transition: opacity .22s ease;
      background: radial-gradient(ellipse 74% 68% at 50% 42%, rgba(65,31,55,.32), rgba(5,5,14,.97) 74%);
      backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
    }
    .court-letter-overlay.visible { opacity: 1; pointer-events: auto; }
    .court-letter {
      width: min(92vw, 690px); max-height: min(86vh, 700px); overflow: auto;
      padding: 30px 38px 26px; color: #f8e7e8; border: 1px solid rgba(251,146,160,.36);
      background: linear-gradient(150deg, rgba(40,16,31,.985), rgba(17,13,30,.99));
      box-shadow: 0 28px 92px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.12);
      scrollbar-width: thin; scrollbar-color: rgba(251,146,160,.42) transparent;
    }
    .cl-topline { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 15px; border-bottom: 1px solid rgba(251,146,160,.24); }
    .cl-mark, .cl-file, .cl-meta-label { font: 800 10px/1.25 'Segoe UI', sans-serif; letter-spacing: .14em; text-transform: uppercase; }
    .cl-mark { color: #fda4af; }
    .cl-file { color: rgba(254,205,211,.58); text-align: right; }
    .cl-address { display: grid; grid-template-columns: 68px 1fr; gap: 5px 14px; margin: 22px 0 20px; }
    .cl-meta-label { color: rgba(254,205,211,.42); }
    .cl-meta-value { color: rgba(255,241,242,.83); font: 600 12px/1.25 'Segoe UI', sans-serif; }
    .cl-subject { margin: 0 0 19px; padding: 13px 0; border-top: 1px solid rgba(251,146,160,.18); border-bottom: 1px solid rgba(251,146,160,.18); color: #fcd34d; font: 800 16px/1.2 'Segoe UI', sans-serif; letter-spacing: .04em; }
    .cl-body { display: grid; gap: 14px; }
    .cl-body p { color: rgba(255,241,242,.88); font: 500 15px/1.62 Georgia, 'Times New Roman', serif; }
    .cl-signoff { margin-top: 22px; color: rgba(254,205,211,.72); font: italic 15px/1.4 Georgia, 'Times New Roman', serif; }
    .cl-action { display: block; width: 100%; margin-top: 26px; padding: 12px 16px; border: 1px solid rgba(251,146,160,.38); background: rgba(251,113,133,.09); color: #ffe4e6; cursor: pointer; font: 800 11px/1 'Segoe UI', sans-serif; letter-spacing: .14em; text-transform: uppercase; }
    .cl-action:hover { background: rgba(251,113,133,.18); border-color: rgba(254,205,211,.72); box-shadow: 0 0 24px rgba(251,113,133,.14); }
    @media (max-width: 640px) {
      .court-letter-overlay { padding: 14px; }
      .court-letter { width: 100%; max-height: 90vh; padding: 24px 20px 20px; }
      .cl-topline { gap: 10px; }
      .cl-mark, .cl-file { font-size: 9px; }
      .cl-address { grid-template-columns: 58px 1fr; gap: 5px 10px; margin: 18px 0; }
      .cl-meta-value { font-size: 11px; }
      .cl-subject { font-size: 14px; }
      .cl-body { gap: 12px; }
      .cl-body p { font-size: 14px; line-height: 1.55; }
    }
  `
  document.head.appendChild(style)
}

export function showCourtLetter(letter: CourtLetter): Promise<void> {
  return new Promise(resolve => {
    injectStyles()
    const overlay = document.createElement('div')
    overlay.className = 'court-letter-overlay'
    overlay.innerHTML = `
      <article class="court-letter" role="document" aria-label="Candy Court field correspondence">
        <div class="cl-topline">
          <div class="cl-mark">Candy Court / Field Correspondence</div>
          <div class="cl-file">${letter.fileNo}<br>${letter.date}</div>
        </div>
        <div class="cl-address">
          <div class="cl-meta-label">FROM</div><div class="cl-meta-value">${letter.sender}</div>
          <div class="cl-meta-label">TO</div><div class="cl-meta-value">${letter.recipient}</div>
        </div>
        <div class="cl-subject">RE: ${letter.subject}</div>
        <div class="cl-body">${letter.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}</div>
        <div class="cl-signoff">${letter.signoff}</div>
        <button class="cl-action">FILE THE REPORT</button>
      </article>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelector<HTMLButtonElement>('.cl-action')!.addEventListener('click', () => {
      overlay.classList.remove('visible')
      overlay.addEventListener('transitionend', () => {
        overlay.remove()
        resolve()
      }, { once: true })
    })
  })
}
