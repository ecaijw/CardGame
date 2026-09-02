import {
  applyOp,
  formatFraction,
  frac,
  fromInt,
  isTwentyFour,
} from '../js/game/fraction'
import { merge, outcome, startGame, undo } from '../js/game/merge'
import { FIXTURES, nextIndex } from '../js/game/puzzles.fixture'

function assert(cond: boolean, message: string) {
  if (!cond) {
    throw new Error(message)
  }
}

function cardByLabel(state: ReturnType<typeof startGame>, label: string) {
  const card = state.cards.find((item) => formatFraction(item.value) === label)
  if (!card) {
    throw new Error(`missing card ${label} in ${state.cards.map((item) => formatFraction(item.value)).join(',')}`)
  }
  return card
}

function play(
  state: ReturnType<typeof startGame>,
  leftLabel: string,
  op: Parameters<typeof applyOp>[1],
  rightLabel: string,
) {
  const left = cardByLabel(state, leftLabel)
  const right = cardByLabel(state, rightLabel)
  const result = merge(state, left.id, op, right.id)
  assert(result.ok, `merge failed: ${leftLabel} ${op} ${rightLabel}`)
  return result.state
}

function testFractions() {
  assert(formatFraction(fromInt(24)) === '24', 'int display')
  assert(formatFraction(frac(8, 3)) === '8/3', 'improper fraction')
  assert(formatFraction(frac(-3, 4)) === '−3/4', 'negative fraction')
  assert(formatFraction(frac(48, 2)) === '24', '48/2 shows as integer')
  assert(isTwentyFour(frac(48, 2)), '48/2 is 24')
  assert(formatFraction(applyOp(fromInt(2), '÷', fromInt(8))!) === '2/8', '2/8 unreduced')
  assert(formatFraction(applyOp(fromInt(8), '÷', fromInt(2))!) === '4', '8/2 shows as 4')
  assert(applyOp(fromInt(3), '−', fromInt(4))!.n === -1, '3-4=-1')
  assert(formatFraction(applyOp(fromInt(3), '÷', fromInt(4))!) === '3/4', '3/4')
  assert(applyOp(fromInt(3), '÷', fromInt(0)) === null, 'div0')
}

function testRulesExample() {
  let state = startGame([1, 3, 4, 6])
  state = play(state, '3', '÷', '4')
  assert(formatFraction(cardByLabel(state, '3/4').value) === '3/4', 'step1')
  assert(outcome(state) === 'playing', 'not done after first merge')
  state = play(state, '1', '−', '3/4')
  state = play(state, '6', '÷', '1/4')
  assert(outcome(state) === 'success', '1,3,4,6 should succeed')
}

function testFixtures() {
  let a = startGame(FIXTURES[0].nums)
  a = play(a, '2', '−', '1')
  a = play(a, '8', '×', '3')
  a = play(a, '24', '×', '1')
  assert(outcome(a) === 'success', '1,2,3,8')

  let b = startGame(FIXTURES[1].nums)
  b = play(b, '8', '÷', '3')
  b = play(b, '3', '−', '8/3')
  b = play(b, '8', '÷', '1/3')
  assert(outcome(b) === 'success', '3,3,8,8')

  let c = startGame(FIXTURES[2].nums)
  c = play(c, '1', '÷', '5')
  c = play(c, '5', '−', '1/5')
  c = play(c, '5', '×', '24/5')
  assert(outcome(c) === 'success', '1,5,5,5')
}

function testResultReplacesSecondCardSlot() {
  const start = startGame([1, 2, 3, 8])
  assert(
    start.cards.map((card) => card.slot).join(',') === '0,1,2,3',
    'initial slots',
  )
  const after = play(start, '2', '−', '1')
  const result = after.cards.find((card) => formatFraction(card.value) === '1')
  assert(!!result && result.slot === 0, 'result takes second-clicked slot')
  assert(
    !after.cards.some((card) => card.slot === 1),
    'first-clicked slot is empty',
  )
}

function testFailAndUndo() {
  let state = startGame([1, 2, 3, 8])
  state = play(state, '1', '+', '2')
  state = play(state, '3', '+', '8')
  state = play(state, '3', '+', '11')
  assert(outcome(state) === 'fail', '1+2+3+8 is 14')

  const mid = startGame([1, 2, 3, 8])
  const after = play(mid, '8', '×', '3')
  assert(outcome(after) === 'playing', '24 with leftover cards is not success')
  const back = undo(after)
  assert(back.cards.length === 4, 'undo restores four cards')
  assert(nextIndex(2) === 0, 'fixtures cycle')
}

testFractions()
testRulesExample()
testFixtures()
testResultReplacesSecondCardSlot()
testFailAndUndo()
console.log('game tests passed')
