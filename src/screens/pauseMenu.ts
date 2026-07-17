import { clearCampaign } from '../data/campaign.js'
import { settings } from '../settings.js'
import { music } from '../music.js'

function pct(v: number) { return `${Math.round(v * 100)}%` }

function initSlider(
  inputId: string, valId: string,
  get: () => number,
  set: (v: number) => void,
) {
  const input = document.getElementById(inputId) as HTMLInputElement
  const val   = document.getElementById(valId)!
  const sync  = () => {
    const v = get()
    input.value = String(v)
    input.style.setProperty('--pm-pct', `${v * 100}%`)
    val.textContent = pct(v)
  }
  sync()
  input.addEventListener('input', () => {
    set(Number(input.value))
    input.style.setProperty('--pm-pct', `${Number(input.value) * 100}%`)
    val.textContent = pct(Number(input.value))
  })
  return sync
}

export function initPauseMenu() {
  const btn     = document.getElementById('pause-btn')!
  const overlay = document.getElementById('pause-overlay')!
  const resume  = document.getElementById('pm-resume')!
  const toTitle = document.getElementById('pm-title')!

  const syncSfx   = initSlider('pm-sfx',   'pm-sfx-val',
    () => settings.sfxVolume,   v => { settings.sfxVolume   = v })
  const syncMusic = initSlider('pm-music', 'pm-music-val',
    () => settings.musicVolume, v => { settings.musicVolume = v; music.setVolume(v) })

  function open() {
    syncSfx()
    syncMusic()
    overlay.inert = false
    overlay.setAttribute('aria-hidden', 'false')
    overlay.classList.add('visible')
    btn.setAttribute('aria-expanded', 'true')
    requestAnimationFrame(() => resume.focus())
  }
  function close(restoreFocus = true) {
    overlay.classList.remove('visible')
    overlay.setAttribute('aria-hidden', 'true')
    overlay.inert = true
    btn.setAttribute('aria-expanded', 'false')
    if (restoreFocus && inGame()) btn.focus()
  }

  const inGame = () => document.body.classList.contains('game-active')

  btn.addEventListener('click', () => {
    if (!inGame()) return
    overlay.classList.contains('visible') ? close() : open()
  })

  resume.addEventListener('click', () => close())

  toTitle.addEventListener('click', () => {
    clearCampaign()
    location.reload()
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && inGame()) overlay.classList.contains('visible') ? close() : open()
  })
}
