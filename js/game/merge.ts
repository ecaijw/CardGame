import {
  applyOp,
  fromInt,
  isTwentyFour,
  type Fraction,
  type Op,
} from './fraction'

export type Card = {
  id: number
  value: Fraction
}

export type GameState = {
  cards: Card[]
  nextId: number
  history: Card[][]
}

export type MergeFail = 'div0' | 'same' | 'missing'

export type MergeResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: MergeFail }

export type Outcome = 'playing' | 'success' | 'fail'

function cloneCards(cards: Card[]): Card[] {
  return cards.map((card) => ({
    id: card.id,
    value: { n: card.value.n, d: card.value.d },
  }))
}

export function startGame(nums: number[]): GameState {
  const cards = nums.map((value, index) => ({
    id: index + 1,
    value: fromInt(value),
  }))
  return {
    cards,
    nextId: nums.length + 1,
    history: [],
  }
}

export function merge(
  state: GameState,
  leftId: number,
  op: Op,
  rightId: number,
): MergeResult {
  if (leftId === rightId) {
    return { ok: false, reason: 'same' }
  }
  const left = state.cards.find((card) => card.id === leftId)
  const right = state.cards.find((card) => card.id === rightId)
  if (!left || !right) {
    return { ok: false, reason: 'missing' }
  }
  const value = applyOp(left.value, op, right.value)
  if (value === null) {
    return { ok: false, reason: 'div0' }
  }
  const remaining = state.cards.filter((card) => card.id !== leftId && card.id !== rightId)
  const next: Card = { id: state.nextId, value }
  return {
    ok: true,
    state: {
      cards: [...remaining, next],
      nextId: state.nextId + 1,
      history: [...state.history, cloneCards(state.cards)],
    },
  }
}

export function undo(state: GameState): GameState {
  if (state.history.length === 0) {
    return state
  }
  const history = state.history.slice(0, -1)
  const cards = cloneCards(state.history[state.history.length - 1])
  return {
    cards,
    nextId: state.nextId,
    history,
  }
}

export function outcome(state: GameState): Outcome {
  if (state.cards.length !== 1) {
    return 'playing'
  }
  return isTwentyFour(state.cards[0].value) ? 'success' : 'fail'
}
