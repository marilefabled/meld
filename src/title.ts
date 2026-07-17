import { createMenuSystem } from './engine/menu.js'
import { createSceneTransition } from './engine/sceneTransition.js'
import { startTitleScene } from './view/titleScene.js'
import { settings } from './settings.js'
import { music } from './music.js'
import { ENCOUNTERS, encountersForRun, makeMirror } from './data/encounters.js'
import { CARD_DATA, getVariant, type CardBuild } from './data/cards.js'
import { cardArt } from './engine/icons.js'
import { bigCardHTML, showCardPreview, hideCardPreview } from './view/cardPreview.js'
import { CLASS_CONFIGS, type PlayerClass } from './data/classes.js'
import type { MenuDef } from './engine/menu.js'
import { progression } from './data/progression.js'
import { loadCampaign, saveCampaign, clearCampaign, newCampaign, applyEvolution, replaceTechniquePair, TOTAL_RUNS, loadCheckpoint, clearCheckpoint, markContinue, takeContinue, type CampaignState } from './data/campaign.js'
import { showClassSelect } from './screens/classSelectScreen.js'
import { showEvolutionScreen } from './screens/evolutionScreen.js'
import { showModifierScreen } from './screens/modifierScreen.js'
import { showShop } from './screens/shopScreen.js'
import { showCampaignComplete } from './screens/campaignCompleteScreen.js'
import { createUnitPreview } from './view/unitPreview.js'

// ── Loadout screen ────────────────────────────────────────────────────────────
interface LoadoutChoice {
  build: CardBuild
  techniqueCard: string
}

const TECHNIQUE_COPY: Record<string, string> = {
  overload: 'Build pressure. Pay in pulp.',
  counter:  'Catch pressure. Throw it back.',
  fuse:     'Prime the filling. Split the seal.',
  leech:    'Draw the juice. Leave the sour.',
}

function showLoadout(
  baseClass: PlayerClass,
  customCardIds?: string[],
  initialBuild?: CardBuild,
  initialTechnique = 'overload',
): Promise<LoadoutChoice> {
  return new Promise(resolve => {
    const classConfig = CLASS_CONFIGS[baseClass]
    const sourceCardIds = customCardIds ?? [...new Set(CLASS_CONFIGS[baseClass].deck)]
    const formTechnique = CLASS_CONFIGS[baseClass].techniqueCard
    let techniqueCard = initialTechnique === formTechnique ? formTechnique : 'overload'
    const techniqueIds = new Set(['overload', formTechnique])
    const visibleCardIds = () => {
      let inserted = false
      const ids: string[] = []
      for (const id of sourceCardIds) {
        if (techniqueIds.has(id)) {
          if (!inserted) ids.push(techniqueCard)
          inserted = true
        } else if (!ids.includes(id)) {
          ids.push(id)
        }
      }
      if (!inserted) ids.push(techniqueCard)
      return ids
    }
    const build: CardBuild = Object.fromEntries(
      [...new Set([...sourceCardIds, 'overload', formTechnique])]
        .map(id => [id, ((initialBuild ?? {})[id] ?? [0, 0, 0]) as [number, number, number]])
    )
    let cardIdx  = 0

    const overlay = document.createElement('div')
    overlay.className = 'loadout-overlay'
    const formPreview = document.createElement('aside')
    formPreview.className = 'lo-form-preview'
    formPreview.innerHTML = `
      <div class="lo-form-stage" aria-hidden="true"></div>
      <strong>${classConfig.displayName.toUpperCase()}</strong>
      <span>${classConfig.role} · ${classConfig.hp} HP</span>
    `

    const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

    function render() {
      const cardIds = visibleCardIds()
      cardIdx = Math.min(cardIdx, cardIds.length - 1)
      const selId  = cardIds[cardIdx]
      const selDef = CARD_DATA[selId]
      if (!selDef) return

      // ── Deck grid — every card as a colour-coded glowing tile ──────────────
      const tiles = cardIds.map((id, i) => {
        const d = CARD_DATA[id]
        if (!d) return ''
        const pips = ([1, 2, 3] as const).map(t => {
          const vs       = d.variants[t - 1]
          const s        = build[id]?.[t - 1] ?? 0
          const unlocked = vs.length > 1 && progression.isUnlocked(vs[1].id)
          return `<i class="lo-pip ${s > 0 ? 'alt' : unlocked ? 'open' : ''}"></i>`
        }).join('')
        return `<button class="lo-tile${i === cardIdx ? ' sel' : ''}" data-idx="${i}" style="--cc:${hex(d.color)}">
          <span class="lo-tile-cost">⚡${d.cost}</span>
          <span class="lo-tile-art">${cardArt(d.shape, d.color, d.type)}<span class="lo-tile-glyph">${d.icon}</span></span>
          <span class="lo-tile-name">${d.name}</span>
          <span class="lo-tile-pips">${pips}</span>
        </button>`
      }).join('')

      // ── Selected card — its three tiers as a horizontal mini-card strip ────
      const tcards = ([1, 2, 3] as const).map(tier => {
        const variants = selDef.variants[tier - 1]
        const sel      = build[selId]?.[tier - 1] ?? 0
        const selV     = variants[sel]
        const altV     = variants[1 - sel]
        const canLeft  = sel > 0
        const canRight = altV != null && progression.isUnlocked(altV.id) && sel === 0
        const showLock = altV != null && !progression.isUnlocked(altV.id) && sel === 0
        const swappable = canLeft || canRight
        return `<div class="lo-tcard${swappable ? ' swap' : ''}">
          <span class="lo-tcard-tier">TIER ${tier}</span>
          <span class="lo-tcard-name">${selV.name}</span>
          <span class="lo-tcard-desc">${selV.desc(selV.value)}</span>
          <div class="lo-tcard-nav">
            <button class="lo-tc-arrow" data-card="${selId}" data-tier="${tier}" data-dir="-1" ${canLeft ? '' : 'disabled'}>‹</button>
            ${showLock
              ? `<span class="lo-lock">🔒</span>`
              : `<button class="lo-tc-arrow" data-card="${selId}" data-tier="${tier}" data-dir="1" ${canRight ? '' : 'disabled'}>›</button>`}
          </div>
        </div>`
      }).join('')

      const techniqueOptions = ['overload', formTechnique].map(id => {
        const d = CARD_DATA[id]
        const selected = id === techniqueCard
        return `<button class="lo-tech-option${selected ? ' sel' : ''}" data-technique="${id}" style="--tc:${hex(d.color)}" aria-pressed="${selected}">
          <span class="lo-tech-icon">${d.icon}</span>
          <span class="lo-tech-copy"><b>${d.name}</b><small>${TECHNIQUE_COPY[id]}</small></span>
          <span class="lo-tech-count">x2</span>
        </button>`
      }).join('')

      overlay.innerHTML = `
        <div class="lo-head">
        <div class="lo-title">PACK THE POUCH</div>
          <div class="lo-subtitle">${CLASS_CONFIGS[baseClass].displayName.toUpperCase()} · ⬡ ${progression.state.fragments} FRAGS · ${cardIds.length} FAMILIES</div>
        </div>
        <div class="lo-technique" role="group" aria-label="Technique pair">
          <span class="lo-tech-label">TECHNIQUE PAIR</span>
          <div class="lo-tech-options">${techniqueOptions}</div>
        </div>
        <div class="lo-grid">${tiles}</div>
        <div class="lo-detail" style="--cc:${hex(selDef.color)}">
          <div class="lo-detail-head"><span class="lo-detail-icon">${selDef.icon}</span>${selDef.name}</div>
          <div class="lo-tcards">${tcards}</div>
        </div>
        <button class="lo-fight">BREAK THE SEAL →</button>
      `

      overlay.querySelectorAll<HTMLButtonElement>('.lo-tech-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const next = btn.dataset.technique!
          if (next === techniqueCard) return
          techniqueCard = next
          cardIdx = visibleCardIds().indexOf(next)
          render()
        })
      })

      overlay.querySelectorAll<HTMLButtonElement>('.lo-tile').forEach(t => {
        const id = cardIds[parseInt(t.dataset.idx!)]
        const d  = CARD_DATA[id]!
        t.addEventListener('click', () => { cardIdx = parseInt(t.dataset.idx!); render() })
        t.addEventListener('mouseenter', () => {
          const v0 = d.variants[0][build[id]?.[0] ?? 0]
          showCardPreview(bigCardHTML(d, v0.name, v0.desc(v0.value), 'I'), t.getBoundingClientRect())
        })
        t.addEventListener('mouseleave', hideCardPreview)
      })

      overlay.querySelectorAll<HTMLButtonElement>('.lo-tc-arrow:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
          const id     = btn.dataset.card!
          const tier   = (parseInt(btn.dataset.tier!) - 1) as 0 | 1 | 2
          const dir    = parseInt(btn.dataset.dir!)
          const maxIdx = (CARD_DATA[id]?.variants[tier].length ?? 1) - 1
          build[id][tier] = Math.max(0, Math.min(maxIdx, (build[id][tier] ?? 0) + dir))
          render()
        })
      })

      overlay.querySelector<HTMLButtonElement>('.lo-fight')!.addEventListener('click', () => {
        hideCardPreview()
        formPreviewHandle.dispose()
        formPreview.remove()
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve({ build, techniqueCard })
      })
    }

    document.body.appendChild(overlay)
    document.body.appendChild(formPreview)
    const formPreviewHandle = createUnitPreview(formPreview.querySelector<HTMLElement>('.lo-form-stage')!, {
      visual: classConfig.visual,
      bodyColor: classConfig.bodyColor,
      accentColor: classConfig.accentColor,
      scale: 1.3,
    })
    render()
    requestAnimationFrame(() => {
      overlay.classList.add('visible')
      formPreview.classList.add('visible')
    })
  })
}

// ── Enemy select (free mode / debug) ─────────────────────────────────────────
const ENEMY_FLAVOR = [
  { diff: '★☆☆', desc: 'Fast and ferocious. Don\'t underestimate the claws.' },
  { diff: '★★☆', desc: 'Hits hard and guards when you\'d least expect it.' },
  { diff: '★★★', desc: 'Ancient. Poisonous. Relentless. Your Tier IIIs must shine.' },
]

function showEnemySelect(): Promise<number> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'enemy-select'
    overlay.innerHTML = `
      <div class="es-title">CHOOSE YOUR OPPONENT</div>
      <div class="es-grid">
        ${ENCOUNTERS.map((e, i) => `
          <button class="es-card" data-idx="${i}" style="--ec: #${e.bodyColor.toString(16).padStart(6, '0')}">
            <div class="es-swatch"></div>
            <div class="es-name">${e.name}</div>
            <div class="es-hp">${e.hp} HP</div>
            <div class="es-diff">${ENEMY_FLAVOR[i].diff}</div>
            <div class="es-desc">${ENEMY_FLAVOR[i].desc}</div>
          </button>
        `).join('')}
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('visible'))

    overlay.querySelectorAll<HTMLButtonElement>('.es-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx!)
        overlay.classList.remove('visible')
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
        resolve(idx)
      })
    })
  })
}

// ── Title meld — the letters drift in from scattered 3D space and coalesce into
// the title. Runs once after the root menu mounts; the menu preserves the card el
// on back-navigation, so the assembled title persists without re-animating.
function meldInTitle() {
  const el = document.querySelector<HTMLElement>('.meld-title .ms-title')
  if (!el || el.dataset.melded) return
  el.dataset.melded = '1'

  const words = (el.textContent ?? 'MELD IN YOUR HAND').trim().split(/\s+/)
  const lines = words.length === 4
    ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')]
    : words
  el.textContent = ''
  el.classList.add('meld-3d')

  const letters: HTMLElement[] = []
  for (const word of lines) {
    const line = document.createElement('div')
    line.className = 'ms-line'
    for (const ch of word) {
      const span = document.createElement('span')
      span.className = 'ms-ltr'
      span.textContent = ch
      // Scattered start: flung apart in 3D, tumbled, faded.
      const rnd = (m: number) => (Math.random() * 2 - 1) * m
      span.style.transform = `translate3d(${rnd(440)}px, ${rnd(300)}px, ${rnd(620)}px)`
        + ` rotateX(${rnd(140)}deg) rotateY(${rnd(140)}deg) rotateZ(${rnd(90)}deg) scale(${0.2 + Math.random() * 0.5})`
      span.style.opacity = '0'
      span.style.transitionDelay = `${Math.random() * 0.55}s`
      line.appendChild(span)
      letters.push(span)
    }
    el.appendChild(line)
  }

  // Next frame → release every letter toward its assembled slot: the meld.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const span of letters) {
      span.style.transform = 'translate3d(0,0,0) rotate(0deg) scale(1)'
      span.style.opacity = '1'
    }
  }))

  // Once settled, the whole grid breathes together (synchronised, so the title
  // stays perfectly aligned — only its depth gently pulses).
  setTimeout(() => {
    for (const span of letters) {
      span.style.transition = 'none'
      span.style.transform = ''
      span.classList.add('settled')
    }
  }, 2900)
}

// ── Main entry ────────────────────────────────────────────────────────────────
export async function showTitle() {
  const battleModule = import('./battle.js')
  const trans        = createSceneTransition({ duration: 0.6 })

  const captureMode = new URLSearchParams(location.search).get('capture') === '1'
  if (captureMode) {
    clearCheckpoint()
    clearCampaign()
    progression.reset()
    history.replaceState(null, document.title, location.pathname + location.hash)
  }

  // ── Campaign run helper ─────────────────────────────────────────────────────
  async function startCampaignRun(campaign: CampaignState, resume?: { encounterIdx: number; playerHP: number; runFragments: number }) {
    const cardIds = [...new Set(campaign.deck.map(c => c.cardId))]
    const choice  = await showLoadout(campaign.baseClass, cardIds, campaign.build, campaign.techniqueCard)
    const { build, techniqueCard } = choice
    campaign.deck = replaceTechniquePair(campaign.deck, campaign.techniqueCard, techniqueCard)
    campaign.build = build
    campaign.techniqueCard = techniqueCard
    saveCampaign(campaign)

    const modifier = (campaign.runNumber === 0 || resume != null) ? null : await showModifierScreen()
    const { startBattle } = await battleModule

    trans.go(() => {
      document.body.classList.add('game-active')
      startBattle({
        playerClass:       campaign.baseClass,
        customDeck:        campaign.deck,
        build,
        modifier,
        encounters:        encountersForRun(campaign.runNumber, progression.state.cycles),
        startFrom:         resume?.encounterIdx ?? 0,
        startPlayerHP:     resume?.playerHP,
        startRunFragments: resume?.runFragments ?? 0,
        isFirstRun:        campaign.runNumber === 0 && resume == null,
        tutorial:          campaign.runNumber === 0 && resume == null
          ? { enabled: true, signatureCard: CLASS_CONFIGS[campaign.baseClass].signatureCard, openingHand: CLASS_CONFIGS[campaign.baseClass].tutorialHand }
          : null,
        powerLevel:        campaign.powerLevel ?? 1,
        classesIn:         campaign.classesIn,
        runNumber:         campaign.runNumber,
        onVictory: () => {
          campaign.runNumber++
          saveCampaign(campaign)
          markContinue()   // reload straight into the evolution step, not the title
          location.reload()
        },
        onDefeat: () => {
          clearCampaign()
          location.reload()
        },
      })
    })
  }

  // ── The 10th — Mirror finale ────────────────────────────────────────────────
  async function startMirrorBattle(campaign: CampaignState) {
    const cardIds = [...new Set(campaign.deck.map(c => c.cardId))]
    const choice  = await showLoadout(campaign.baseClass, cardIds, campaign.build, campaign.techniqueCard)
    const { build, techniqueCard } = choice
    campaign.deck = replaceTechniquePair(campaign.deck, campaign.techniqueCard, techniqueCard)
    campaign.build = build
    campaign.techniqueCard = techniqueCard
    saveCampaign(campaign)

    const { startBattle } = await battleModule
    const mirror = makeMirror(campaign.baseClass, campaign.powerLevel ?? 1)

    trans.go(() => {
      document.body.classList.add('game-active')
      startBattle({
        playerClass: campaign.baseClass,
        customDeck:  campaign.deck,
        build,
        modifier:    null,
        encounters:  [mirror],
        isFinale:    true,
        powerLevel:  campaign.powerLevel ?? 1,
        classesIn:   campaign.classesIn,
        runNumber:   campaign.runNumber,
        onVictory: () => {
          progression.recordCycle()   // full game complete — next time through, he remembers more
          // Keep a trophy ring for the path you took to victory (absorb and/or deepen)
          if (campaign.classesIn.length > 1)      progression.earnRing(campaign.baseClass, 'absorb')
          if ((campaign.powerLevel ?? 1) > 1.001) progression.earnRing(campaign.baseClass, 'deepen')
          clearCampaign()
          showCampaignComplete().then(() => location.reload())
        },
        onDefeat: () => {
          clearCampaign()
          location.reload()
        },
      })
    })
  }

  // ── Check for in-progress campaign ─────────────────────────────────────────
  const saved = loadCampaign()
  const cp    = loadCheckpoint()

  // Where a saved campaign picks back up.
  async function continueSaved(campaign: CampaignState) {
    // Mid-run checkpoint: resume at the saved encounter with saved HP
    if (cp && cp.campaignRunNumber === campaign.runNumber) {
      await startCampaignRun(campaign, { encounterIdx: cp.encounterIdx, playerHP: cp.playerHP, runFragments: cp.runFragments })
      return
    }
    if (campaign.runNumber >= TOTAL_RUNS) {
      // All 3 runs cleared — the 10th opponent, your Mirror, is the finale (no evolution).
      await startMirrorBattle(campaign)
      return
    }
    if (campaign.runNumber > 0) {
      // Between runs — evolve, then the next gauntlet.
      const choice  = await showEvolutionScreen(campaign)
      const evolved = applyEvolution(campaign, choice)
      saveCampaign(evolved)
      await startCampaignRun(evolved)
      return
    }
    await startCampaignRun(campaign)
  }

  // Only a mid-campaign reload resumes on its own; loading the game fresh always
  // stops at the title, where RETURN TO THE BAG picks the run back up.
  const continuing = takeContinue()
  if (saved && continuing) {
    await continueSaved(saved)
    return
  }

  // ── Music ──────────────────────────────────────────────────────────────────
  music.prime()
  // Start after first user gesture (any click on the title screen)
  document.addEventListener('click', () => music.start(), { once: true, passive: true })

  // ── Title menus ────────────────────────────────────────────────────────────
  const menus = createMenuSystem()

  const settingsMenu: MenuDef = {
    title: 'SETTINGS',
    items: [
      { type: 'slider', label: 'SFX Volume',
        get: () => settings.sfxVolume,
        set: v => { settings.sfxVolume = v },
      },
      { type: 'slider', label: 'Music Volume',
        get: () => settings.musicVolume,
        set: v => { settings.musicVolume = v; music.setVolume(v) },
      },
      { type: 'separator' },
      { type: 'back' },
    ],
  }

  const howToPlay: MenuDef = {
    title: 'HOW TO PLAY',
    className: 'meld-how-to',
    items: [
      { type: 'custom', html: `
        <div class="htp">
          <section class="htp-sec">
            <div class="htp-hd"><span class="htp-gem"></span>PIECES</div>
            <p>Play cards to <em>attack</em>, <em>defend</em>, or <em>heal</em>.</p>
            <p>Each costs <b>1–2&nbsp;AP</b>. You draw <b>3&nbsp;AP</b> of intent a turn.</p>
            <p>Spare AP becomes <b>bonus draws</b> next turn — never waste it.</p>
          </section>
          <section class="htp-sec">
            <div class="htp-hd"><span class="htp-gem"></span>FUSING</div>
            <p>Two matching pieces <span class="htp-arr">→</span> <span class="htp-meld">MELD</span> <span class="htp-arr">→</span> Tier&nbsp;II <span class="htp-x">2.2×</span></p>
            <p>Two Tier&nbsp;IIs <span class="htp-arr">→</span> Tier&nbsp;III <span class="htp-x">4.5×</span></p>
            <p>Melded cards discard, then cycle back to your hand.</p>
          </section>
          <section class="htp-sec">
            <div class="htp-hd"><span class="htp-gem"></span>THE FRONT</div>
            <p>Three bags. Three Candy seals each. Then <em>The Original</em>.</p>
            <p>Between bags: press your flavor deeper, or mix in another.</p>
            <p class="htp-goal">Candy calls you one of them. Do not give it the proof.</p>
          </section>
        </div>
      ` },
      { type: 'separator' },
      { type: 'back' },
    ],
  }

  menus.push({
    title: 'MELD IN YOUR HAND',
    backdrop: 'none',
    closeable: false,
    className: 'meld-title',
    items: [
      { type: 'header', label: 'REALISTIC FRUIT SNACK SIM' },
      { type: 'separator' },
      ...(saved ? [{ type: 'button' as const, label: 'RETURN TO THE BAG', action: () => {
        titleScene?.dispose(); menus.close()
        void continueSaved(saved)
      } }] : []),
      { type: 'button', label: saved ? 'OPEN ANOTHER BAG' : 'OPEN THE BAG', action: () => beginJourney() },
      { type: 'button', label: 'COLLECTION',     action: async () => { await showShop() } },
      { type: 'button', label: 'HOW TO PLAY',    action: () => menus.push(howToPlay) },
      { type: 'button', label: 'SETTINGS',       action: () => menus.push(settingsMenu) },
    ],
  })

  // Volumetric 3D title: hide the DOM title and let the WebGL scene render it;
  // fall back to the CSS meld if WebGL/font setup fails.
  let titleScene: { dispose(): void } | null = null
  const domTitle = document.querySelector<HTMLElement>('.meld-title .ms-title')
  try {
    if (domTitle) domTitle.style.visibility = 'hidden'
    titleScene = startTitleScene()
  } catch {
    if (domTitle) domTitle.style.visibility = ''
    meldInTitle()
  }

  async function beginJourney() {
    titleScene?.dispose()
    menus.close()
    clearCheckpoint()
    clearCampaign()
    const isReturning = progression.state.runsCompleted > 0
    const cls = await showClassSelect({ mode: isReturning ? 'returning' : 'first-run' })
    const campaign = newCampaign(cls)
    await startCampaignRun(campaign)
  }
}
