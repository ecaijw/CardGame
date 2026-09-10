import {
  applyOp,
  formatFraction,
  frac,
  fromInt,
  isTwentyFour,
} from '../js/game/fraction'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { merge, outcome, startGame, undo } from '../js/game/merge'
import { FIXTURES, nextIndex } from '../js/game/puzzles.fixture'
import { classifyDifficulty, enumerateTuples, solve } from './solve'

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

function testMergeGuards() {
  const state = startGame([1, 2, 3, 8])
  const snapshot = JSON.stringify(state)
  const same = merge(state, 1, '+', 1)
  assert(!same.ok && same.reason === 'same', 'cannot merge a card with itself')
  assert(JSON.stringify(state) === snapshot, 'same-card merge does not mutate')

  const zero = startGame([3, 0, 1, 8])
  const before = JSON.stringify(zero)
  const div0 = merge(zero, 1, '÷', 2)
  assert(!div0.ok && div0.reason === 'div0', 'divide by 0 fails')
  assert(JSON.stringify(zero) === before, 'div0 does not mutate')
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

function testSolver() {
  assert(solve([1, 1, 1, 1]) === null, '1,1,1,1 is unsolvable')
  assert(enumerateTuples().length === 1820, '1-13 combinations with repetition')
  const solvable = [
    [1, 2, 3, 8],
    [3, 3, 8, 8],
    [1, 5, 5, 5],
    [1, 3, 4, 6],
  ]
  for (const nums of solvable) {
    const result = solve(nums)
    assert(!!result, `${nums.join(',')} should be solvable`)
    assert(result!.best.steps.length === 3, `${nums.join(',')} has three steps`)
    assert(result!.solutions >= 1, `${nums.join(',')} counts at least one expression`)
  }
  const eight = solve([1, 1, 1, 8])
  assert(!!eight, '1,1,1,8 should be solvable')
  assert(eight!.best.expression === '(1+(1+1))×8', 'strip outermost parens')
  assert(classifyDifficulty(solve([1, 1, 1, 8])) === 'easy', '1,1,1,8 easy')
  assert(classifyDifficulty(solve([1, 1, 6, 8])) === 'medium', '1,1,6,8 needs integer divide')
  assert(classifyDifficulty(solve([11, 11, 1, 3])) === 'easy', '11,11,1,3 easy')
  assert(classifyDifficulty(solve([12, 12, 12, 12])) === 'easy', '12,12,12,12 easy')
  assert(classifyDifficulty(solve([1, 3, 4, 6])) === 'hard', '1,3,4,6 hard')
  assert(classifyDifficulty(solve([3, 3, 8, 8])) === 'hard', '3,3,8,8 hard')
  assert(classifyDifficulty(solve([1, 5, 5, 5])) === 'hard', '1,5,5,5 hard')
}

function testCatalog() {
  const puzzles = JSON.parse(
    readFileSync(join(process.cwd(), 'js/game/puzzles.json'), 'utf8'),
  ) as Array<{ id: string; difficulty: string; steps: string[] }>
  assert(puzzles.length === 1820, 'catalog has every 1-13 tuple')
  const byLevel = { easy: 0, medium: 0, hard: 0, unsolvable: 0 }
  for (const puzzle of puzzles) {
    byLevel[puzzle.difficulty as keyof typeof byLevel] += 1
  }
  assert(byLevel.easy + byLevel.medium + byLevel.hard === 1362, '1362 solvable')
  assert(byLevel.unsolvable === 458, '458 unsolvable')
  const ids = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]))
  assert(ids.get('1,1,1,8')?.difficulty === 'easy', 'catalog 1,1,1,8 easy')
  assert(ids.get('1,1,6,8')?.difficulty === 'medium', 'catalog 1,1,6,8 medium')
  assert(ids.get('1,3,4,6')?.difficulty === 'hard', 'catalog 1,3,4,6 hard')
  assert(ids.get('3,3,8,8')?.difficulty === 'hard', 'catalog 3,3,8,8 hard')
  assert(ids.get('1,5,5,5')?.difficulty === 'hard', 'catalog 1,5,5,5 hard')
  for (const fixture of FIXTURES) {
    const found = ids.get(fixture.id)
    assert(!!found && found.difficulty !== 'unsolvable', `catalog contains solvable ${fixture.id}`)
  }
  const none = ids.get('1,1,1,1')
  assert(!!none && none.difficulty === 'unsolvable' && none.steps.length === 0, '1,1,1,1 is unsolvable')
}

testFractions()
testRulesExample()
testFixtures()
testResultReplacesSecondCardSlot()
testMergeGuards()
testFailAndUndo()
testSolver()
testCatalog()
console.log('game tests passed')
