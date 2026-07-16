export function showCampaignComplete(): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'campaign-complete-overlay'
    overlay.innerHTML = `
      <div class="cc-eyebrow">REALISTIC FRUIT SNACK SIM</div>
      <div class="cc-title">MELD IN<br>YOUR HAND</div>
      <div class="cc-body">
        Somewhere, Candy calls it a draw.
      </div>
      <div class="cc-pause">
        The Fruit Front refuses the word.
      </div>
      <button class="cc-dissolve">HOLD THE LINE</button>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelector<HTMLButtonElement>('.cc-dissolve')!.addEventListener('click', () => {
      overlay.classList.remove('visible')
      overlay.addEventListener('transitionend', () => resolve(), { once: true })
    })
  })
}
