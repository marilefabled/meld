export function showCampaignComplete(): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'campaign-complete-overlay'
    overlay.innerHTML = `
      <div class="cc-eyebrow">ALL MARKS HELD</div>
      <div class="cc-title">MELD TO<br>ALL HELD</div>
      <div class="cc-body">
        For one breath, you remember the name.
      </div>
      <div class="cc-pause">
        Then the Meld opens again.
      </div>
      <button class="cc-dissolve">ENTER AGAIN</button>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelector<HTMLButtonElement>('.cc-dissolve')!.addEventListener('click', () => {
      overlay.classList.remove('visible')
      overlay.addEventListener('transitionend', () => resolve(), { once: true })
    })
  })
}
