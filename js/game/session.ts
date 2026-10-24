import { merge, outcome, startGame, type GameState, type Outcome } from './merge'
import type { Op } from './fraction'

export type SessionState = {
  game: GameState
  selectedId: number
  selectedOp: Op | ''
}

export type SessionEffect =
  | { kind: 'noop' }
  | { kind: 'select' }
  | { kind: 'invalid'; reason: 'div0' | 'needCard' | 'same' }
  | {
      kind: 'merge'
      op: Op
      sourceId: number
      destId: number
      resultId: number
      end: Outcome
    }

export function createSession(nums: number[]): SessionState {
  return {
    game: startGame(nums),
    selectedId: 0,
    selectedOp: '',
  }
}

export function restartSession(nums: number[]): SessionState {
  return createSession(nums)
}

export function selectCard(
  state: SessionState,
  id: number,
): { state: SessionState; effect: SessionEffect } {
  if (!state.selectedId) {
    return {
      state: { ...state, selectedId: id },
      effect: { kind: 'select' },
    }
  }
  if (id === state.selectedId) {
    return {
      state: { ...state, selectedId: 0 },
      effect: { kind: 'select' },
    }
  }
  if (!state.selectedOp) {
    return {
      state: { ...state, selectedId: id },
      effect: { kind: 'select' },
    }
  }
  const op = state.selectedOp
  const merged = merge(state.game, state.selectedId, op, id)
  if (!merged.ok) {
    return {
      state,
      effect: {
        kind: 'invalid',
        reason: merged.reason === 'div0' ? 'div0' : 'same',
      },
    }
  }
  const resultCard = merged.state.cards[merged.state.cards.length - 1]
  const end = outcome(merged.state)
  return {
    state: {
      game: merged.state,
      selectedId: end === 'playing' ? resultCard.id : 0,
      selectedOp: '',
    },
    effect: {
      kind: 'merge',
      op,
      sourceId: state.selectedId,
      destId: id,
      resultId: resultCard.id,
      end,
    },
  }
}

export function selectOp(
  state: SessionState,
  op: Op,
): { state: SessionState; effect: SessionEffect } {
  if (state.selectedOp === op) {
    return {
      state: { ...state, selectedOp: '' },
      effect: { kind: 'select' },
    }
  }
  if (!state.selectedId) {
    return {
      state,
      effect: { kind: 'invalid', reason: 'needCard' },
    }
  }
  return {
    state: { ...state, selectedOp: op },
    effect: { kind: 'select' },
  }
}
