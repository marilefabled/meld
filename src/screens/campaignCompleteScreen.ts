export function showCampaignComplete(): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'campaign-complete-overlay'
    overlay.innerHTML = `
      <div class="cc-eyebrow">ALL MARKS RETURNED</div>
      <div class="cc-title">RETURNED<br>TO THE MELD</div>
      <div class="cc-body">
        Three splinters. Three returns.<br>
        Your bounty is paid.
      </div>
      <div class="cc-pause">
        You remember — dimly — what it felt like before you had a form.<br>
        Before you had a name.<br>
        The Meld opens.
      </div>
      <button class="cc-dissolve">DISSOLVE INTO THE MELD</button>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelector<HTMLButtonElement>('.cc-dissolve')!.addEventListener('click', () => {
      overlay.classList.remove('visible')
      overlay.addEventListener('transitionend', () => resolve(), { once: true })
    })
  })
}
