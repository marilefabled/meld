import { showTitle } from './title.js'
import { initPauseMenu } from './screens/pauseMenu.js'
import { emptyStory } from './data/campaign.js'
import { showRewardScreen } from './screens/rewardScreen.js'
import { showEvolutionScreen } from './screens/evolutionScreen.js'

function showCaptureScreen(kind: string): boolean {
  if (kind === 'reward') {
    void showRewardScreen({
      encIdx: 0,
      build: {},
      playerClass: 'warrior',
      enemyName: 'First Scar',
      enemyTraits: [{ kind: 'immune', statuses: ['poison', 'vulnerable', 'weak'] }],
    })
    return true
  }

  if (kind === 'evolution') {
    void showEvolutionScreen({
      runNumber: 1,
      baseClass: 'warrior',
      deck: [],
      build: {},
      classesIn: ['warrior'],
      powerLevel: 1,
      story: emptyStory(),
    })
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
