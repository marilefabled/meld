export interface HoldActionState {
  isAnimating: boolean
  isHeld: boolean
  isPlayerTurn: boolean
  isTutorialLocked: boolean
  heldCount: number
  maxHolds: number
}

export function canToggleHold(state: HoldActionState): boolean {
  return state.isPlayerTurn
    && !state.isAnimating
    && !state.isTutorialLocked
    && (state.isHeld || state.heldCount < state.maxHolds)
}
