import { showTitle } from './title.js'
import { initPauseMenu } from './screens/pauseMenu.js'
import { showRewardScreen } from './screens/rewardScreen.js'
import { showEvolutionScreen } from './screens/evolutionScreen.js'
import { courtLetterForRun } from './data/courtLetters.js'
import { showCourtLetter } from './screens/courtLetterScreen.js'
import { showUnitLab } from './view/unitLab.js'
import { ENCOUNTERS } from './data/encounters.js'

function showCaptureScreen(kind: string): boolean {
  if (kind === 'units') {
    showUnitLab()
    return true
  }

  if (kind === 'press' || kind === 'syrup') {
    const encounter = kind === 'press' ? ENCOUNTERS[1] : ENCOUNTERS[2]
    const playerClass = kind === 'press' ? 'rogue' : 'mage'
    initPauseMenu()
    void import('./battle.js').then(({ startBattle }) => {
      document.body.classList.add('game-active')
      startBattle({ playerClass, encounters: [encounter], isFirstRun: false })
    })
    return true
  }

  if (kind === 'reward') {
    void showRewardScreen({
      encIdx: 0,
      build: {},
      playerClass: 'warrior',
      enemyName: 'The Crimp',
      enemyTraits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }],
      rivalLine: 'Keep the word fruit. We will keep the factories.',
    })
    return true
  }

  if (kind === 'evolution') {
    void showEvolutionScreen({
      runNumber: 1,
      baseClass: 'warrior',
      deck: [],
      build: {},
      techniqueCard: 'overload',
      classesIn: ['warrior'],
      powerLevel: 1,
    })
    return true
  }

  if (kind === 'letter') {
    void showCourtLetter(courtLetterForRun(0))
    return true
  }

  return false
}

function boot() {
  const captureKind = new URLSearchParams(location.search).get('capture')
  if (!showCaptureScreen(captureKind ?? '')) {
    initPauseMenu()
    showTitle()
  }
}

boot()
