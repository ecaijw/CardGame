import {
  DIALOG_IN_MS,
  MASK_IN_MS,
  dialogButtonRect,
  dialogMotion,
  dialogRect,
} from '../js/scenes/dialog'
import { copyContentH, copyDialogAllows, copyDialogHits, copyNeedsDialog, soloCopyMode, tableLayout } from '../js/scenes/board'
import { difficultyMenuLayout } from '../js/scenes/difficulty-menu'
import { selectDuelLayout } from '../js/scenes/duel-stacked'
import {
  LEAD_CROWN_ASPECT,
  LEAD_CROWN_GAP,
  LEAD_CROWN_SCALE,
  leadCrownRect,
  scoreCompact,
  scoreInk,
} from '../js/scenes/duel'
import { duelWideLayout } from '../js/scenes/duel-wide'
import { homeLayout, homeTitleAnchor } from '../js/scenes/home-layout'
import { houseButtonRect } from '../js/ui'
import { settingsLayout, type SettingsLayout } from '../js/scenes/settings'
import {
  applyOp,
  formatFraction,
  frac,
  fromInt,
  isTwentyFour,
} from '../js/game/fraction'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  applyDuelStats,
  buzz,
  createMatch,
  duelDialog,
  duelPageChrome,
  duelSettlesSuccess,
  duelShownBuzzPlayer,
  DUEL_ANSWER_DEFAULT_SEC,
  DUEL_HANDOFF_MS,
  DUEL_TARGET,
  failAttempt,
  judgeUnsolvable,
  nextRound,
  rematch,
  remainingAnswerSeconds,
  resign,
  revealAnswer,
  setAnswerSeconds,
  startSecond,
  stepAnswerSeconds,
  succeed,
  tickHandoff,
  timeout,
} from '../js/game/duel'
import { merge, outcome, startGame, undo } from '../js/game/merge'
import { candidatePuzzles, pickPuzzle, puzzlesFor, puzzlesForDeal, SOLVABLE } from '../js/game/puzzles'
import { createSession, selectCard, selectOp } from '../js/game/session'
import {
  applyDealOutcome,
  bumpDuelAnswerSeconds,
  clearStreak,
  loadDealFilter,
  loadDuelAnswerSeconds,
  loadDuelDealFilter,
  loadIncludeUnsolvable,
  loadStats,
  saveDealFilter,
  saveDuelDealFilter,
  saveIncludeUnsolvable,
} from '../js/settings'
import { classifyDifficulty, enumerateTuples, solve } from './solve'

const FIXTURES: Array<{ id: string; nums: [number, number, number, number] }> = [
  { id: '1,2,3,8', nums: [1, 2, 3, 8] },
  { id: '3,3,8,8', nums: [3, 3, 8, 8] },
  { id: '1,5,5,5', nums: [1, 5, 5, 5] },
]

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

function testKnownGames() {
  let a = startGame(FIXTURES[0].nums)
  a = play(a, '2', '−', '1')
  a = play(a, '8', '×', '3')
  a = play(a, '24', '×', '1')
  assert(outcome(a) === 'success', FIXTURES[0].id)

  let b = startGame(FIXTURES[1].nums)
  b = play(b, '8', '÷', '3')
  b = play(b, '3', '−', '8/3')
  b = play(b, '8', '÷', '1/3')
  assert(outcome(b) === 'success', FIXTURES[1].id)

  let c = startGame(FIXTURES[2].nums)
  c = play(c, '1', '÷', '5')
  c = play(c, '5', '−', '1/5')
  c = play(c, '5', '×', '24/5')
  assert(outcome(c) === 'success', FIXTURES[2].id)
}

function testResultReplacesSecondCardSlot() {
  const start = startGame(FIXTURES[0].nums)
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
  const state = startGame(FIXTURES[0].nums)
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
  let state = startGame(FIXTURES[0].nums)
  state = play(state, '1', '+', '2')
  state = play(state, '3', '+', '8')
  state = play(state, '3', '+', '11')
  assert(outcome(state) === 'fail', '1+2+3+8 is 14')

  const mid = startGame(FIXTURES[0].nums)
  const after = play(mid, '8', '×', '3')
  assert(outcome(after) === 'playing', '24 with leftover cards is not success')
  const back = undo(after)
  assert(back.cards.length === 4, 'undo restores four cards')
}

function testSolver() {
  assert(solve([1, 1, 1, 1]) === null, '1,1,1,1 is unsolvable')
  assert(enumerateTuples().length === 1820, '1-13 combinations with repetition')
  const solvable = [...FIXTURES.map((fixture) => fixture.nums), [1, 3, 4, 6] as [number, number, number, number]]
  for (const nums of solvable) {
    const result = solve(nums)
    assert(!!result, `${nums.join(',')} should be solvable`)
    assert(result!.best.steps.length === 3, `${nums.join(',')} has three steps`)
    assert(result!.solutions >= 1, `${nums.join(',')} counts at least one expression`)
  }
  const eight = solve([1, 1, 1, 8])
  assert(!!eight, '1,1,1,8 should be solvable')
  assert(eight!.best.expression === '8×(1+(1+1))', 'keep parens that change order')
  const twelve = solve([4, 12, 12, 12])
  assert(twelve?.best.expression === '4×12−12−12', 'drop redundant parens')
  assert(classifyDifficulty(solve([1, 1, 1, 8])) === 'easy', '1,1,1,8 easy')
  assert(classifyDifficulty(solve([1, 1, 6, 8])) === 'medium', '1,1,6,8 needs integer divide')
  assert(classifyDifficulty(solve([1, 3, 7, 9])) === 'medium', '1,3,7,9 direct divide stays medium')
  assert(classifyDifficulty(solve([1, 5, 5, 12])) === 'medium', '1,5,5,12 unit divide stays medium')
  assert(classifyDifficulty(solve([1, 2, 7, 7])) === 'hard', '1,2,7,7 constructed divide is hard')
  assert(classifyDifficulty(solve([11, 11, 1, 3])) === 'easy', '11,11,1,3 easy')
  assert(classifyDifficulty(solve([12, 12, 12, 12])) === 'easy', '12,12,12,12 easy')
  assert(classifyDifficulty(solve([1, 3, 4, 6])) === 'hard', '1,3,4,6 hard')
  assert(classifyDifficulty(solve([3, 3, 8, 8])) === 'hard', '3,3,8,8 hard')
  assert(classifyDifficulty(solve([1, 5, 5, 5])) === 'hard', '1,5,5,5 hard')
  const direct = solve([1, 3, 7, 9])
  assert(direct?.best.steps.includes('9÷3=3'), '1,3,7,9 shows direct divide')
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
  assert(ids.get('1,3,7,9')?.difficulty === 'medium', 'catalog 1,3,7,9 medium')
  assert(ids.get('1,2,7,7')?.difficulty === 'hard', 'catalog 1,2,7,7 hard')
  assert(ids.get('1,3,4,6')?.difficulty === 'hard', 'catalog 1,3,4,6 hard')
  assert(ids.get('3,3,8,8')?.difficulty === 'hard', 'catalog 3,3,8,8 hard')
  assert(ids.get('1,5,5,5')?.difficulty === 'hard', 'catalog 1,5,5,5 hard')
  for (const fixture of FIXTURES) {
    const found = ids.get(fixture.id)
    assert(!!found && found.difficulty !== 'unsolvable', `catalog contains solvable ${fixture.id}`)
  }
  const none = ids.get('1,1,1,1')
  assert(!!none && none.difficulty === 'unsolvable' && none.steps.length === 0, '1,1,1,1 is unsolvable')
  const bundled = require('../js/game/puzzles.catalog') as typeof puzzles
  assert(bundled.length === puzzles.length, 'catalog.js matches puzzles.json length')
  assert(bundled[0].id === puzzles[0].id, 'catalog.js first id matches json')
}

function testPick() {
  assert(SOLVABLE.length === 1362, 'deal pool has 1362 solvable')
  assert(
    SOLVABLE.every((puzzle) => puzzle.difficulty !== 'unsolvable'),
    'deal pool skips unsolvable',
  )
  assert(
    SOLVABLE.every((puzzle) => puzzle.expression.length > 0),
    'solvable puzzles have an answer expression',
  )

  const first = pickPuzzle(new Set(), undefined, () => 0)
  assert(first.difficulty !== 'unsolvable', 'pick never returns unsolvable')
  assert(first.id === SOLVABLE[0].id, 'random 0 takes first solvable')

  const played = new Set(SOLVABLE.slice(0, 10).map((puzzle) => puzzle.id))
  const unplayed = candidatePuzzles(SOLVABLE, played)
  assert(unplayed.length === 1352, 'unplayed excludes played')
  assert(
    unplayed.every((puzzle) => !played.has(puzzle.id)),
    'unplayed pool has no played ids',
  )
  const preferred = pickPuzzle(played, undefined, () => 0)
  assert(!played.has(preferred.id), 'prefers unplayed')

  const allPlayed = new Set(SOLVABLE.map((puzzle) => puzzle.id))
  const exclude = SOLVABLE[0].id
  const recycled = candidatePuzzles(SOLVABLE, allPlayed, exclude)
  assert(recycled.length === 1361, 'full played pool avoids current')
  assert(
    recycled.every((puzzle) => puzzle.id !== exclude),
    'recycled pool excludes current',
  )
  const again = pickPuzzle(allPlayed, exclude, () => 0)
  assert(again.id !== exclude, 'avoids current when recycling')
  assert(again.difficulty !== 'unsolvable', 'recycle still solvable')

  const tiny = SOLVABLE.slice(0, 1)
  const last = candidatePuzzles(tiny, new Set([tiny[0].id]), tiny[0].id)
  assert(last.length === 1 && last[0].id === tiny[0].id, 'single puzzle still deals')

  assert(puzzlesFor('all').length === 1362, 'all filter is solvable pool')
  assert(puzzlesFor('easy').length === 1163, 'easy pool')
  assert(puzzlesFor('medium').length === 137, 'medium pool')
  assert(puzzlesFor('hard').length === 62, 'hard pool')
  assert(
    puzzlesFor('easy').every((puzzle) => puzzle.difficulty === 'easy'),
    'easy filter only easy',
  )
  const easyPick = pickPuzzle(new Set(), undefined, () => 0, 'easy')
  assert(easyPick.difficulty === 'easy', 'pick easy stays easy')
  const hardPick = pickPuzzle(new Set(), undefined, () => 0, 'hard')
  assert(hardPick.difficulty === 'hard', 'pick hard stays hard')

  assert(puzzlesForDeal('easy').length === 1163, 'deal pool without unsolvable stays easy')
  const unsolvablePick = pickPuzzle(new Set(), undefined, () => 0.24, 'hard', true)
  assert(unsolvablePick.difficulty === 'unsolvable', 'a roll under 25% can deal an unsolvable puzzle')
  assert(
    pickPuzzle(new Set(), undefined, () => 0.25, 'hard', true).difficulty === 'hard',
    'a roll of 25% stays in the selected difficulty',
  )
  const playedEasy = new Set(puzzlesFor('easy').map((puzzle) => puzzle.id))
  assert(
    pickPuzzle(playedEasy, undefined, () => 0.5, 'easy', true).difficulty === 'easy',
    'a played solvable pool does not force an unsolvable deal',
  )
  assert(
    pickPuzzle(new Set(), undefined, () => 0.99, 'easy').difficulty !== 'unsolvable',
    'default pick still skips unsolvable',
  )
}

function testStreakAfterFail() {
  const store = new Map<string, unknown>()
  const previous = (globalThis as { wx?: unknown }).wx
  ;(globalThis as { wx?: unknown }).wx = {
    getStorageSync(key: string) {
      return store.get(key)
    },
    setStorageSync(key: string, value: unknown) {
      store.set(key, value)
    },
  }
  try {
    store.set('gameStats', { deals: 5, wins: 5, losses: 0, streak: 5 })
    applyDealOutcome('success', '', 5)
    assert(loadStats().streak === 6, 'a first success continues the streak')
    store.set('gameStats', { deals: 6, wins: 5, losses: 0, streak: 5 })
    applyDealOutcome('fail', '', 5)
    assert(loadStats().streak === 0, 'a fail clears the streak')
    applyDealOutcome('success', 'fail', 5)
    const stats = loadStats()
    assert(stats.streak === 1, 'success after a fail starts the streak at 1')
    assert(stats.wins === 6, 'replacing a fail counts one win')
    assert(stats.losses === 0, 'replacing a fail removes that loss')
    store.set('gameStats', { deals: 7, wins: 6, losses: 0, streak: 4 })
    clearStreak()
    assert(loadStats().streak === 0, 'clearStreak zeroes the streak')
    assert(loadStats().wins === 6, 'clearStreak does not change wins')
    assert(loadStats().losses === 0, 'clearStreak does not change losses')
  } finally {
    ;(globalThis as { wx?: unknown }).wx = previous
  }
}

function testDealSettings() {
  const store = new Map<string, unknown>()
  const previous = (globalThis as { wx?: unknown }).wx
  ;(globalThis as { wx?: unknown }).wx = {
    getStorageSync(key: string) {
      return store.get(key)
    },
    setStorageSync(key: string, value: unknown) {
      store.set(key, value)
    },
  }
  try {
    assert(loadDealFilter() === 'easy', 'missing difficulty defaults to easy')
    assert(loadIncludeUnsolvable() === false, 'missing unsolvable flag defaults to off')
    saveDealFilter('hard')
    saveIncludeUnsolvable(true)
    assert(loadDealFilter() === 'hard', 'saved difficulty is read back')
    assert(loadIncludeUnsolvable() === true, 'saved unsolvable flag is read back')
    store.set('dealFilter', 'nightmare')
    assert(loadDealFilter() === 'easy', 'an invalid difficulty falls back to easy')
  } finally {
    ;(globalThis as { wx?: unknown }).wx = previous
  }
}

function testSessionSelect() {
  let session = createSession([1, 3, 4, 6])
  const first = selectCard(session, session.game.cards[0].id)
  session = first.state
  assert(first.effect.kind === 'select', 'first card selects')
  const need = selectOp(session, '+')
  assert(need.effect.kind === 'select', 'op after card')
  session = need.state
  const empty = createSession([1, 2, 3, 8])
  const bad = selectOp(empty, '+')
  assert(bad.effect.kind === 'invalid' && bad.effect.reason === 'needCard', 'op needs a card')
}

function testDuelFlow() {
  let match = createMatch(20)
  assert(match.phase === 'thinking', 'starts thinking')
  const locked = buzz(match, 'red', 1000)
  assert(!!locked && locked.phase === 'answering' && locked.answering === 'red', 'red buzzes first')
  match = locked!
  assert(buzz(match, 'blue', 1001) === null, 'second buzz ignored')
  const beforeRetryDeadline = match.answerDeadline
  const resigned = resign(match, 1500)
  assert(!!resigned && resigned.phase === 'handoff', 'first fail goes to handoff')
  match = resigned!
  const second = startSecond(match, 2000)
  assert(!!second && second.answering === 'blue', 'blue answers second')
  assert(second!.answerDeadline === 2000 + second!.answerMs, 'second gets full timer')
  match = second!
  const miss = failAttempt(match, 2100)
  assert(miss.phase === 'roundEnd', 'second fail ends round')
  assert(miss.roundResult === 'fail', 'second fail records a failed round')
  assert(miss.scoreRed === 0 && miss.scoreBlue === 0, 'no score on both fail')
  assert(resigned.roundResult === null, 'first fail is not a round result')

  match = createMatch(20)
  match = buzz(match, 'red', 0)!
  const win = succeed(match)
  assert(!!win && win.match.scoreRed === 1 && win.match.roundResult === 'success', 'round score +1')
  assert(win!.match.phase === 'roundEnd', 'round win stays in roundEnd')
  assert(win!.events.some((e) => e.kind === 'round' && e.player === 'red'), 'round win event')
  let stats = applyDuelStats(
    { redRoundWins: 0, blueRoundWins: 0, redMatchWins: 0, blueMatchWins: 0 },
    win!.events[0],
  )
  assert(stats.redRoundWins === 1, 'round win counted')

  match = createMatch(10)
  match = { ...match, scoreRed: DUEL_TARGET - 1 }
  match = buzz(match, 'red', 0)!
  const matchWin = succeed(match)
  assert(!!matchWin && matchWin.match.phase === 'matchEnd' && matchWin.match.roundResult === 'success', 'fifth point ends match')
  assert(matchWin!.events.length === 2, 'round and match events')

  match = createMatch(20)
  const revealed = revealAnswer(match)
  assert(!!revealed && revealed.phase === 'revealed', 'reveal locks buzz')
  assert(buzz(revealed!, 'red', 1) === null, 'cannot buzz after reveal')

  match = createMatch(20)
  match = buzz(match, 'red', 0)!
  assert(timeout(match, match.answerDeadline! - 1) === null, 'not yet timed out')
  const timed = timeout(match, match.answerDeadline!)
  assert(!!timed && timed.phase === 'handoff', 'timeout fails first player')

  match = createMatch(20)
  match = buzz(match, 'red', 0)!
  match = resign(match, 10)!
  const auto = tickHandoff(match, match.handoffDeadline!)
  assert(!!auto && auto.phase === 'answering' && auto.answering === 'blue', 'handoff auto start')
  assert(DUEL_HANDOFF_MS === 3000, 'handoff is 3s')
  assert(remainingAnswerSeconds(auto!, auto!.answerDeadline! - 500) === 1, 'ceil remaining seconds')

  match = createMatch(20)
  match = setAnswerSeconds(match, 40)
  assert(match.answerMs === 40000, 'saved seconds replace the match duration')
  match = buzz(match, 'red', 0)!
  assert(match.answerDeadline === 40000, 'new buzz uses the updated seconds')
  const deadline = match.answerDeadline
  match = setAnswerSeconds(match, 15)
  assert(match.answerDeadline === deadline, 'updating seconds keeps the running deadline')

  match = nextRound({ ...createMatch(20), roundResult: 'success', scoreRed: 1 })
  assert(match.phase === 'thinking' && match.scoreRed === 1 && match.roundResult === null, 'nextRound clears the round result')
  assert(rematch({ ...match, roundResult: 'fail', scoreRed: 4 }).roundResult === null, 'rematch clears the round result')
  assert(stepAnswerSeconds(20, 5) === 25, '+5 seconds')
  assert(stepAnswerSeconds(12, -5) === 10, 'clamp to min')
  assert(stepAnswerSeconds(58, 5) === 60, 'clamp to max')
  assert(DUEL_ANSWER_DEFAULT_SEC === 20, 'default 20')
}

function answering(player: 'red' | 'blue', scoreRed = 0, scoreBlue = 0) {
  const match = buzz({ ...createMatch(20), scoreRed, scoreBlue }, player, 0)
  assert(!!match, `${player} can buzz`)
  return match!
}

function testDuelRoundViews() {
  const timingOut = answering('red')
  const firstFails = [
    resign(answering('red'), 10),
    timeout(timingOut, timingOut.answerDeadline!),
    failAttempt(answering('red'), 10),
    judgeUnsolvable(answering('red'), false, 10),
  ]
  for (const failed of firstFails) {
    const match = failed && 'match' in failed && failed.match.phase ? failed.match : failed
    assert(match !== null && !('kind' in match), 'first fail returns a match')
    const next = match as ReturnType<typeof answering>
    assert(next.phase === 'handoff' && next.roundResult === null, 'first fail hands off without a round result')
    assert(next.scoreRed === 0 && next.scoreBlue === 0, 'first fail keeps the score')
    assert(duelDialog(next) === 'handoff', 'first fail shows the handoff dialog')
    assert(duelPageChrome(next.phase) === 'answering', 'handoff keeps answering buttons')
    assert(duelShownBuzzPlayer(next, 'red') === 'red', 'handoff keeps the red button')
    assert(!duelSettlesSuccess(next), 'handoff does not play the success settle')
  }

  const handed = startSecond(resign(answering('red'), 10)!, 100)!
  assert(duelDialog(handed) === null && duelShownBuzzPlayer(handed, 'blue') === 'blue', 'second player answers with no dialog')
  const secondFails = [
    resign(handed, handed.answerDeadline! - 1),
    timeout(handed, handed.answerDeadline!),
    failAttempt(handed, 200),
    judgeUnsolvable(handed, false, 200),
  ]
  for (const failed of secondFails) {
    const next = failed && 'kind' in failed ? failed.match : failed!
    assert(next.phase === 'roundEnd' && next.roundResult === 'fail', 'second fail ends the round')
    assert(next.scoreRed === 0 && next.scoreBlue === 0, 'second fail does not score')
    assert(duelDialog(next) === 'round-fail', 'second fail shows the round-end dialog')
    assert(duelPageChrome(next.phase) === 'answering', 'round fail keeps answering buttons')
    assert(duelShownBuzzPlayer(next, 'blue') === 'blue', 'round fail keeps the blue button')
    const following = nextRound(next)
    assert(
      following.phase === 'thinking' && following.scoreRed === 0 && following.roundResult === null,
      'next round after a fail returns to buzz',
    )
    assert(duelDialog(following) === null && duelPageChrome(following.phase) === 'thinking', 'next round shows both buzz buttons')
  }

  const won = succeed(answering('red'))!
  assert(won.match.scoreRed === 1 && won.match.roundResult === 'success', 'round win scores and records success')
  assert(duelDialog(won.match) === 'round-success', 'round win shows the success dialog')
  assert(duelSettlesSuccess(won.match), 'round win settles the last card')
  assert(duelPageChrome(won.match.phase) === 'answering', 'round win keeps answering buttons')
  const afterWin = nextRound(won.match)
  assert(afterWin.scoreRed === 1 && afterWin.roundResult === null && duelDialog(afterWin) === null, 'next round keeps the score')

  const solved = judgeUnsolvable(answering('blue', 1, 2), true, 10)
  assert(solved?.kind === 'success' && solved.result.match.scoreBlue === 3, 'correct unsolvable scores like a win')
  assert(duelDialog(solved!.result.match) === 'round-success', 'correct unsolvable shows the success dialog')

  const matchWin = succeed(answering('blue', 0, DUEL_TARGET - 1))!
  assert(matchWin.match.phase === 'matchEnd' && matchWin.match.scoreBlue === DUEL_TARGET, 'fifth point ends the match')
  assert(duelDialog(matchWin.match) === 'match-end', 'match win shows the match dialog')
  assert(duelSettlesSuccess(matchWin.match), 'match win still settles the last card')
  const again = rematch(matchWin.match)
  assert(
    again.phase === 'thinking' && again.scoreRed === 0 && again.scoreBlue === 0 && again.roundResult === null,
    'rematch starts from 0:0',
  )
  assert(duelDialog(again) === null && duelShownBuzzPlayer(again, null) === null, 'rematch shows both buzz buttons')

  const revealed = revealAnswer(createMatch(20))!
  assert(duelDialog(revealed) === 'answer' && duelPageChrome(revealed.phase) === 'thinking', 'answer dialog keeps the waiting page')
}

function testDuelSettingsStorage() {
  const store = new Map<string, unknown>()
  const previous = (globalThis as { wx?: unknown }).wx
  ;(globalThis as { wx?: unknown }).wx = {
    getStorageSync(key: string) {
      return store.get(key)
    },
    setStorageSync(key: string, value: unknown) {
      store.set(key, value)
    },
  }
  try {
    assert(loadDuelDealFilter() === 'easy', 'duel difficulty defaults easy')
    assert(loadDealFilter() === 'easy', 'solo difficulty still easy')
    saveDuelDealFilter('hard')
    saveDealFilter('medium')
    assert(loadDuelDealFilter() === 'hard', 'duel filter separate')
    assert(loadDealFilter() === 'medium', 'solo filter separate')
    assert(loadDuelAnswerSeconds() === 20, 'answer seconds default 20')
    ;(globalThis as { wx?: unknown }).wx = {
      getStorageSync() {
        return ''
      },
      setStorageSync() {},
    }
    assert(loadDuelAnswerSeconds() === 20, 'a missing WeChat key is an empty string and stays at 20')
    ;(globalThis as { wx?: unknown }).wx = {
      getStorageSync(key: string) {
        return store.get(key)
      },
      setStorageSync(key: string, value: unknown) {
        store.set(key, value)
      },
    }
    assert(bumpDuelAnswerSeconds(1) === 25, 'bump +5')
    assert(bumpDuelAnswerSeconds(-1) === 20, 'bump -5')
  } finally {
    ;(globalThis as { wx?: unknown }).wx = previous
  }
}

function testDialogShell() {
  const start = dialogMotion(0)
  const mid = dialogMotion(DIALOG_IN_MS / 2)
  const popped = dialogMotion(DIALOG_IN_MS)
  const settled = dialogMotion(DIALOG_IN_MS + 400)
  assert(start.scale === 0.97 && start.mask === 0, 'dialog starts slightly small with a clear mask')
  assert(mid.scale > 0.97 && mid.scale < 1, 'dialog scale is still moving at halfway')
  assert(popped.scale === 1, 'dialog reaches full size at 220ms')
  assert(settled.scale === 1, 'dialog stays full size after the pop')
  const maskMid = dialogMotion(MASK_IN_MS / 2)
  const maskDone = dialogMotion(MASK_IN_MS)
  assert(maskMid.mask > 0 && maskMid.mask < 1, 'mask is still fading at halfway')
  assert(maskDone.mask === 1 && dialogMotion(MASK_IN_MS + 200).mask === 1, 'mask finishes at 360ms')

  const onScreen = (width: number, height: number, dialogH: number, anchor?: number, tight?: 'center' | 'bottom' | 'clamp-below') => {
    const rect = dialogRect(width, height, dialogH, anchor, tight)
    assert(rect.x >= 24 && rect.y >= 24, 'dialog stays inside the top and left margin')
    assert(rect.x + rect.w <= width - 24 && rect.y + rect.h <= height - 24, 'dialog stays inside the bottom and right margin')
    return rect
  }

  const success = onScreen(390, 844, 240, 520, 'center')
  assert(success.y === 544, 'solo success dialog sits under the last card')
  const crowded = onScreen(390, 700, 304, 500, 'bottom')
  assert(crowded.y === 700 - 24 - 304, 'several remaining cards pin the dialog to the bottom')
  const singleTight = onScreen(390, 700, 304, 500, 'center')
  assert(singleTight.y === (700 - 304) / 2, 'one card that does not fit centers the dialog')
  const duelWin = onScreen(390, 600, 280, 400, 'clamp-below')
  assert(duelWin.y === 600 - 24 - 280, 'duel success dialog clamps under the settled card')
  const centered = onScreen(390, 800, 240)
  assert(centered.y === (800 - 240) / 2, 'handoff and fail dialogs stay centered')

  const button = dialogButtonRect(success, 136)
  assert(button.x === success.x + 24 && button.y === success.y + 136, 'dialog button keeps the shared inset')
  assert(button.w === success.w - 48 && button.h === 50, 'dialog button keeps the shared size')
  assert(button.y + button.h < success.y + success.h, 'dialog button stays inside the card')
}

function testCopyDialogHits() {
  const dialog = dialogRect(390, 672, 220)
  const close = dialogButtonRect(dialog, dialog.h - 74)
  const hits = copyDialogHits(close)
  assert(hits.length === 1, 'copy dialog keeps one hit')
  assert(hits[0].hit.kind === 'copy-dismiss', 'copy dialog only registers close')
  assert(hits[0].rect.x === close.x && hits[0].rect.y === close.y, 'close uses the dialog button rect')
  const kinds = hits.map((item) => item.hit.kind)
  ;(['answer', 'home', 'difficulty', 'settings', 'restart', 'next', 'card', 'op'] as const).forEach((kind) => {
    assert(!kinds.includes(kind), `copy dialog does not keep ${kind}`)
    assert(!copyDialogAllows(kind), `copy dialog forbids ${kind}`)
  })
  assert(copyDialogAllows('copy-dismiss'), 'copy dialog allows close')

  const leaked = [
    { rect: close, hit: { kind: 'answer' as const } },
    { rect: close, hit: { kind: 'home' as const } },
    ...hits,
  ]
  const locked = leaked.filter((item) => copyDialogAllows(item.hit.kind))
  assert(locked.length === 1 && locked[0].hit.kind === 'copy-dismiss', 'leaked board hits are dropped')

  const short = tableLayout(460, 672, 72, 34)
  assert(soloCopyMode(short.copy.h, false, true, 2) === 'dialog', '460x672 answer still uses a dialog')
}

function testTableLayout() {
  const phone = tableLayout(390, 844, 72, 34)
  assert(phone.frame.side === null, 'phone keeps a single column')
  assert(phone.cardW === 120 && phone.fontSize === 32, 'phone cards use the full card size')
  assert(phone.slots.length === 4, 'cards stay in a 2x2 grid')
  assert(phone.slots[0].y === 72, 'phone cards start at the top clearance')
  assert(phone.slots[2].y === phone.slots[0].y + phone.cardH + 16, 'the second card row sits under the first')
  assert(phone.slots[1].x > phone.slots[0].x && phone.slots[3].y === phone.slots[2].y, 'the right column lines up')
  assert(phone.ops.length === 4 && phone.ops.every((op) => op.h === 56 && op.y === phone.opY), 'four operators share one row')
  assert(phone.opY === phone.slots[2].y + phone.slots[2].h + 28, 'operators sit 28 below the cards')

  const narrow = tableLayout(200, 700, 72, 34)
  assert(narrow.cardW < 90 && narrow.fontSize === 26, 'narrow screens shrink the cards and the number')

  const wide = tableLayout(900, 900, 80, 34)
  assert(wide.frame.side !== null && wide.cardW === 120, 'wide screens keep the phone card size in the left column')
  assert(wide.slots[0].y > 80, 'wide solo cards drop below the top clearance')
  const wideBottom = wide.opY + wide.opH
  const wideCenter = (wide.slots[0].y + wideBottom) / 2
  assert(Math.abs(wideCenter - (80 + (900 - 34)) / 2) < 0.5, 'wide solo block is centered in the safe band')
  assert(wide.opY === wide.slots[2].y + wide.slots[2].h + 28, 'wide solo operators sit 28 below the cards')

  const fitted = tableLayout(430, 707, 72, 34)
  assert(fitted.frame.side === null && fitted.cardW === 120, '430x707 keeps the standard card when it fits')
  assert(fitted.ops[0].y + fitted.ops[0].h <= fitted.actionY, '430x707 operators stay above the action row')
  assert(fitted.actionY + fitted.actionH <= fitted.barY, '430x707 actions stay above the bar')
  assert(fitted.barY + fitted.barH <= 707 - 34, '430x707 bar stays above the safe area')

  const short = tableLayout(460, 672, 72, 34)
  assert(copyNeedsDialog(short.copy.h, copyContentH(0)), '460x672 cannot fit a one-line hint')
  assert(short.copy.y + short.copy.h <= short.actionY + 0.05, '460x672 answer band stays above the action row')
  assert(soloCopyMode(short.copy.h, false, false, 2) === 'none', 'idle solo does not open a copy dialog')
  assert(!copyNeedsDialog(phone.copy.h, copyContentH(3)), '390x844 keeps a stepped answer on the page')
  const mid = tableLayout(430, 707, 72, 34)
  assert(!copyNeedsDialog(mid.copy.h, copyContentH(0)), '430x707 fits a one-line hint')
  assert(copyNeedsDialog(mid.copy.h, copyContentH(2)), '430x707 cannot fit an answer with two steps')
  assert(soloCopyMode(mid.copy.h, false, false, 2) === 'none', '430x707 stays idle until hint or answer is shown')
  assert(soloCopyMode(mid.copy.h, true, false, 0) === 'page', '430x707 keeps the hint on the page')
  assert(soloCopyMode(mid.copy.h, false, true, 2) === 'dialog', '430x707 opens a dialog for a two-step answer')
  const tightCopy = tableLayout(375, 667, 72, 34)
  assert(copyNeedsDialog(tightCopy.copy.h, copyContentH(0)), '375x667 cannot fit a one-line hint')
  assert(!copyNeedsDialog(wide.copy.h, copyContentH(3)), 'wide solo keeps a stepped answer on the page')
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function scoreColumns(
  rect: { x: number; w: number },
  compact: boolean,
  redRect?: { x: number; w: number },
  blueRect?: { x: number; w: number },
) {
  return {
    redX: compact || !redRect ? rect.x + rect.w * 0.28 : redRect.x + redRect.w / 2,
    blueX: compact || !blueRect ? rect.x + rect.w * 0.72 : blueRect.x + blueRect.w / 2,
  }
}

function scoreTextInside(
  rect: { x: number; y: number; w: number; h: number },
  compact: boolean,
  redRect?: { x: number; w: number },
  blueRect?: { x: number; w: number },
) {
  const ink = scoreInk(rect, compact)
  const { redX, blueX } = scoreColumns(rect, compact, redRect, blueRect)
  const labelTop = ink.labelY - ink.labelSize / 2
  const scoreBottom = ink.scoreY + ink.scoreSize / 2
  const centerY = rect.y + rect.h / 2
  const labelHalf = ink.labelSize
  const scoreHalf = ink.scoreSize * 0.6
  return (
    labelTop >= rect.y - 0.05 &&
    scoreBottom <= rect.y + rect.h + 0.05 &&
    centerY - ink.vsRadius >= rect.y - 0.05 &&
    centerY + ink.vsRadius <= rect.y + rect.h + 0.05 &&
    redX - labelHalf >= rect.x - 0.05 &&
    blueX + labelHalf <= rect.x + rect.w + 0.05 &&
    redX - scoreHalf >= rect.x - 0.05 &&
    blueX + scoreHalf <= rect.x + rect.w + 0.05
  )
}

function assertFullScore(
  rect: { x: number; y: number; w: number; h: number },
  compact: boolean,
  label: string,
  redRect?: { x: number; w: number },
  blueRect?: { x: number; w: number },
) {
  const ink = scoreInk(rect, compact)
  assert(rect.h === 58, `${label} scoreboard stays at 58`)
  if (compact) {
    assert(ink.labelSize === 10 && ink.scoreSize === 20 && ink.vsRadius === 18, `${label} keeps the compact type`)
    assert(ink.labelY === rect.y + 16 && ink.scoreY === rect.y + 40, `${label} keeps the compact rows`)
  } else {
    assert(ink.labelSize === 11 && ink.scoreSize === 29 && ink.vsRadius === 18, `${label} keeps the phone type`)
    assert(ink.labelY === rect.y + 14 && ink.scoreY === rect.y + 39, `${label} keeps the phone rows`)
  }
  assert(scoreTextInside(rect, compact, redRect, blueRect), `${label} text stays inside the pill`)
}

function testSettingsLayout() {
  const phone = settingsLayout(390, 844, 72)
  assert(!phone.wide && phone.audio !== null, 'phone settings stay in one column')
  assert(phone.solo.y < phone.duel.y && phone.duel.y < phone.duration.y, 'phone cards keep their order')
  assert(phone.audio !== null && phone.duration.y < phone.audio.y, 'phone audio card follows the timer')
  assert(phone.back.y === (phone.audio ? phone.audio.y + phone.audio.h + 16 : 0), 'phone back button follows the audio card')
  assert(phone.back.w === 390 - 80, 'phone back button keeps its width')

  const wide = settingsLayout(940, 665, 72)
  assert(wide.wide && wide.top !== null && wide.bottom !== null, 'wide settings use two cards')
  assert(wide.solo.y === wide.duel.y && wide.duel.x > wide.solo.x + wide.solo.w, 'solo and duel sit side by side')
  assert(wide.duration.y === wide.sound.y && wide.sound.y === wide.music.y, 'timer, sound, and music share one row')
  assert(wide.duration.x < wide.sound.x && wide.sound.x < wide.music.x, 'the settings row reads left to right')
  assert(wide.back.y >= (wide.bottom ? wide.bottom.y + wide.bottom.h : 0), 'back button sits under both cards')
  assert(wide.back.y + wide.back.h <= 665 - 24, 'back button stays on screen')
  assert(wide.back.w < (wide.top ? wide.top.w : 0) && wide.back.x === (940 - wide.back.w) / 2, 'back button is centered and narrower than the cards')
  assert(!overlaps(wide.back, wide.sound) && !overlaps(wide.back, wide.music), 'back button does not cover sound or music')
  assert(inside(wide.soundToggle, wide.sound) && inside(wide.minus, wide.duration), 'controls stay inside their columns')
  const cards = [wide.top, wide.bottom].filter((rect): rect is NonNullable<SettingsLayout['top']> => rect !== null)
  for (const card of cards) {
    assert(!overlaps(wide.back, card), 'back button does not cover a settings card')
  }
}

function testDuelWideLayout() {
  assert(duelWideLayout(390, 844, 72, 34) === null, 'phone keeps the existing duel layout')
  assertWideDuel(940, 665)
  assertWideDuel(1194, 834)
}

function assertWideDuel(width: number, height: number) {
  const layout = duelWideLayout(width, height, 72, 34)
  assert(layout !== null, `${width}x${height} uses the wide duel layout`)
  if (!layout) {
    return
  }
  const center = width / 2
  const cardsLeft = layout.slots[0].x
  const cardsRight = layout.slots[1].x + layout.slots[1].w
  assert(Math.abs((cardsLeft + cardsRight) / 2 - center) < 0.5, 'cards are centered on the screen')
  const { redBuzz, blueBuzz, score } = layout.battle
  assert(redBuzz.w === blueBuzz.w && redBuzz.h === blueBuzz.h, 'buzz buttons match in size')
  assert(Math.abs(redBuzz.y + redBuzz.h / 2 - (blueBuzz.y + blueBuzz.h / 2)) < 0.5, 'buzz buttons share a center line')
  assert(Math.abs(redBuzz.x - (width - (blueBuzz.x + blueBuzz.w))) < 0.5, 'buzz buttons share the side margin')
  assert(Math.abs(score.x + score.w / 2 - center) < 0.5, 'score is centered')
  const buttons = layout.utility
  const buttonSpanRight = buttons.restart.x + buttons.restart.w
  assert(Math.abs(buttons.answer.x - (layout.ops[0].x - buttonSpanRight)) < 0.5, 'utility buttons have equal side gaps')
  const statsRight = layout.stats.rounds.x + layout.stats.rounds.w
  const divideRight = layout.ops[3].x + layout.ops[3].w
  assert(Math.abs(layout.stats.rounds.x - divideRight - (width - statsRight)) < 0.5, 'stats cards have equal side gaps')
  const buttonCenter = (buttons.answer.x + buttonSpanRight) / 2
  assert(Math.abs(redBuzz.x + redBuzz.w / 2 - buttonCenter) < 0.5, 'the red buzz button centers on the utility buttons')
  assert(buttons.answer.y === buttons.restart.y, 'the first utility row lines up')
  assert(buttons.difficulty.y === buttons.unsolvable.y && buttons.settings.y === buttons.next.y, 'utility buttons stay in three rows')
  assert(Math.abs(buttons.answer.y - layout.stats.rounds.y) < 0.5, 'utility buttons start at the round-stats card')
  const buttonBottom = buttons.settings.y + buttons.settings.h
  assert(Math.abs(buttonBottom - (layout.stats.matches.y + layout.stats.matches.h)) < 0.5, 'utility buttons end at the match-stats card')
  const cardAreaCenter = (layout.slots[0].y + layout.slots[2].y + layout.slots[2].h) / 2
  const buttonCenterY = (buttons.answer.y + buttonBottom) / 2
  assert(Math.abs(buttonCenterY - cardAreaCenter) < 0.5, 'utility buttons center on the four cards')
  const rowGap = buttons.difficulty.y - (buttons.answer.y + buttons.answer.h)
  assert(Math.abs(buttons.settings.y - (buttons.difficulty.y + buttons.difficulty.h) - rowGap) < 0.5, 'utility rows share one gap')
  const rects = [
    buttons.answer,
    buttons.restart,
    buttons.difficulty,
    buttons.unsolvable,
    buttons.settings,
    buttons.next,
    layout.stats.rounds,
    layout.stats.matches,
    redBuzz,
    blueBuzz,
    score,
    ...layout.slots,
    ...layout.ops,
  ]
  for (const rect of rects) {
    assert(rect.x >= 0 && rect.y >= 16 && rect.x + rect.w <= width && rect.y + rect.h <= height - 34, 'wide rect stays on screen')
  }
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      assert(!overlaps(rects[i], rects[j]), 'wide rects do not overlap')
    }
  }
  const again = duelWideLayout(width, height, 72, 34)
  assert(
    again !== null && again.utility.restart.x === buttons.restart.x && again.battle.score.x === score.x && again.battle.blueBuzz.x === blueBuzz.x,
    'hidden buttons do not move the other slots or the score',
  )
  assert(
    Math.abs(layout.stats.rounds.y + layout.stats.rounds.h / 2 - (layout.slots[0].y + layout.slots[0].h / 2)) < 0.5,
    'round stats align with the first card row',
  )
  assert(
    Math.abs(layout.stats.matches.y + layout.stats.matches.h / 2 - (layout.slots[2].y + layout.slots[2].h / 2)) < 0.5,
    'match stats align with the second card row',
  )
  assert(layout.hint.x === redBuzz.x, 'hint starts at the red buzz button')
  assert(Math.abs(layout.hint.y - (layout.ops[0].y + layout.ops[0].h / 2)) < 0.5, 'hint aligns with the operators')
  assert(layout.ops[0].x - (buttons.restart.x + buttons.restart.w) >= 48, 'utility buttons stay clear of the plus operator')
  const cardAreaW = layout.slots[1].x + layout.slots[1].w - layout.slots[0].x
  assert(Math.abs(score.w - cardAreaW) < 0.5, 'the scoreboard matches the card area width')
}

function testDuelStackedLayout() {
  const sizes = [
    [346, 781],
    [375, 667],
    [390, 844],
    [430, 707],
    [1024, 1366],
  ] as const
  for (const [width, height] of sizes) {
    const page = selectDuelLayout(width, height, 72, 34)
    assert(page.kind === 'stacked', `${width}x${height} uses the stacked duel layout`)
    if (page.kind !== 'stacked') {
      continue
    }
    const layout = page.stacked
    assert(layout.columnW <= 430, `${width}x${height} content stays within 430`)
    assert(Math.abs(layout.columnX - (width - layout.columnW) / 2) < 0.5, `${width}x${height} column is centered`)
    const rects = [
      ...layout.slots,
      ...layout.ops,
      layout.score,
      layout.redBuzz,
      layout.blueBuzz,
      layout.concede,
      layout.restart,
      layout.unsolvable,
      layout.next,
      layout.answer,
      layout.difficulty,
      layout.settings,
    ]
    for (const rect of rects) {
      assert(rect.y >= 72 - 0.05 && rect.y + rect.h <= height - 34 + 0.05, `${width}x${height} rect stays in the safe band`)
      assert(rect.x >= layout.columnX - 0.05 && rect.x + rect.w <= layout.columnX + layout.columnW + 0.05, `${width}x${height} rect stays in the column`)
    }
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        assert(!overlaps(rects[i], rects[j]), `${width}x${height} rects do not overlap`)
      }
    }
  }

  const phone = selectDuelLayout(390, 844, 72, 34)
  assert(phone.kind === 'stacked' && phone.stacked.cardW === 120, '390x844 cards stay at 120')
  assert(phone.kind === 'stacked' && phone.stacked.slots[0].y === 72, '390x844 cards start at minTop')
  if (phone.kind === 'stacked') {
    const board = phone.stacked
    const opBottom = board.ops[0].y + board.ops[0].h
    const topGap = board.score.y - opBottom
    const scoreBuzz = board.redBuzz.y - (board.score.y + board.score.h)
    const concedeToNext = board.next.y - (board.concede.y + board.concede.h)
    assert(Math.abs(topGap - concedeToNext) < 0.5, '390x844 keeps the score block centered')
    assert(scoreBuzz > 16 && scoreBuzz < 16 + 20, '390x844 opens the score-to-buzz gap only a little')
  }

  const narrow = selectDuelLayout(346, 781, 72, 34)
  assert(narrow.kind === 'stacked', '346x781 uses the stacked duel layout')
  if (narrow.kind === 'stacked') {
    const board = narrow.stacked
    const opBottom = board.ops[0].y + board.ops[0].h
    const topGap = board.score.y - opBottom
    const scoreBuzz = board.redBuzz.y - (board.score.y + board.score.h)
    const concedeToNext = board.next.y - (board.concede.y + board.concede.h)
    const blockBottom = board.concede.y + board.concede.h
    assert(Math.abs(scoreBuzz - 8) < 0.5, '346x781 tightens the score-to-buzz gap to 8')
    assert(Math.abs(topGap - 12) < 0.5, '346x781 keeps about 12px under the operators')
    assert(Math.abs(concedeToNext - topGap) < 0.5, '346x781 keeps the score block centered')
    assert(board.score.y > opBottom && blockBottom <= board.next.y + 0.05, '346x781 score block stays between the operators and the next button')
  }

  const tight = selectDuelLayout(375, 667, 72, 34)
  assert(tight.kind === 'stacked' && tight.stacked.cardW === 92, '375x667 cards hit the floor')
  assert(tight.kind === 'stacked' && Math.abs(tight.stacked.gapCardOp - 8) < 0.05, '375x667 card gap reaches 8')
  assert(tight.kind === 'stacked' && Math.abs(tight.stacked.gapActionBar - 8) < 0.05, '375x667 action gap reaches 8')
  assert(tight.kind === 'stacked' && tight.stacked.score.h === 44 && tight.stacked.redBuzz.h === 44, '375x667 controls hit 44')

  const ipad = selectDuelLayout(834, 1112, 72, 34)
  assert(ipad.kind === 'stacked' && ipad.stacked.slots[0].y === 72, '834x1112 duel cards stay at minTop')
  if (ipad.kind === 'stacked') {
    const board = ipad.stacked
    const opBottom = board.ops[0].y + board.ops[0].h
    const blockTop = board.score.y
    const blockBottom = board.concede.y + board.concede.h
    const regionCenter = (opBottom + board.next.y) / 2
    const blockCenter = (blockTop + blockBottom) / 2
    assert(Math.abs(blockCenter - regionCenter) < 0.5, '834x1112 score and buzz sit in the middle of the open band')
    const scoreGap = board.redBuzz.y - (board.score.y + board.score.h)
    assert(Math.abs(scoreGap - (16 + 48)) < 0.05, '834x1112 opens the score-to-buzz gap by 48')
    assert(board.score.y > opBottom && blockBottom <= board.next.y + 0.05, '834x1112 score block stays between the operators and the next button')
  }

  assert(selectDuelLayout(1024, 1366, 72, 34).kind === 'stacked', 'portrait iPad does not use three columns')
  assert(duelWideLayout(1024, 1366, 72, 34) !== null, 'the wide function would fit a portrait iPad')
  const mid = selectDuelLayout(800, 600, 72, 34)
  assert(mid.kind === 'stacked' && mid.stacked.columnW <= 430, '748-927 landscape falls back to the centered column')
  assert(duelWideLayout(800, 600, 72, 34) === null, '800x600 cannot hold three columns')
}

function testScoreInk() {
  assert(!scoreCompact('stacked'), 'stacked uses the phone type')
  assert(scoreCompact('wide'), 'wide uses the compact type')

  const fold = selectDuelLayout(460, 672, 72, 34)
  assert(fold.kind === 'stacked' && fold.stacked.score.h <= 44.05, '460x672 scoreboard is at the short height')
  if (fold.kind === 'stacked') {
    const compact = scoreCompact('stacked')
    assert(
      scoreTextInside(fold.stacked.score, compact, fold.stacked.redBuzz, fold.stacked.blueBuzz),
      '460x672 scoreboard text stays inside the pill',
    )
  }

  const tight = selectDuelLayout(375, 667, 72, 34)
  assert(tight.kind === 'stacked' && tight.stacked.score.h === 44, '375x667 scoreboard is at the floor')
  if (tight.kind === 'stacked') {
    const compact = scoreCompact('stacked')
    assert(
      scoreTextInside(tight.stacked.score, compact, tight.stacked.redBuzz, tight.stacked.blueBuzz),
      '375x667 scoreboard text stays inside the pill',
    )
  }

  const phone = selectDuelLayout(390, 844, 72, 34)
  assert(phone.kind === 'stacked', '390x844 uses the stacked duel layout')
  if (phone.kind === 'stacked') {
    assertFullScore(phone.stacked.score, scoreCompact('stacked'), '390x844', phone.stacked.redBuzz, phone.stacked.blueBuzz)
  }

  const wide = selectDuelLayout(940, 665, 72, 34)
  assert(wide.kind === 'wide', '940x665 uses the three-column duel layout')
  if (wide.kind === 'wide') {
    assertFullScore(wide.wide.battle.score, scoreCompact('wide'), '940x665')
  }

  const fullScore = { x: 20, y: 400, w: 350, h: 58 }
  assertFullScore(fullScore, false, 'a stacked 58px scoreboard')
  assertFullScore(fullScore, true, 'a wide 58px scoreboard')
  const shortScore = { x: 20, y: 400, w: 350, h: 44 }
  assert(scoreTextInside(shortScore, true), 'compact type on a short scoreboard stays inside')
  assert(scoreTextInside(shortScore, false), 'phone type on a short scoreboard stays inside too')

  const board = fold.kind === 'stacked' ? fold.stacked.score : fullScore
  const redBuzz = fold.kind === 'stacked' ? fold.stacked.redBuzz : undefined
  const blueBuzz = fold.kind === 'stacked' ? fold.stacked.blueBuzz : undefined
  const compact = scoreCompact('stacked')
  const columns = scoreColumns(board, compact, redBuzz, blueBuzz)
  for (const pair of ['0:0', '4:3'] as const) {
    const again = scoreColumns(board, compact, redBuzz, blueBuzz)
    assert(again.redX === columns.redX && again.blueX === columns.blueX, `${pair} keeps the same score columns`)
    assert(scoreTextInside(board, compact, redBuzz, blueBuzz), `${pair} stays inside the scoreboard`)
  }

  assertLeadCrown(fullScore, false, 'a stacked 58px scoreboard')
  assertLeadCrown(fullScore, true, 'a wide 58px scoreboard')
  assertLeadCrown(shortScore, false, 'a short phone scoreboard')
  if (phone.kind === 'stacked') {
    assertLeadCrown(phone.stacked.score, false, '390x844', phone.stacked.redBuzz, phone.stacked.blueBuzz)
  }
  if (wide.kind === 'wide') {
    assertLeadCrown(wide.wide.battle.score, true, '940x665')
  }
}

function assertLeadCrown(
  board: { x: number; y: number; w: number; h: number },
  compact: boolean,
  label: string,
  redRect?: { x: number; w: number },
  blueRect?: { x: number; w: number },
) {
  const ink = scoreInk(board, compact)
  const { redX, blueX } = scoreColumns(board, compact, redRect, blueRect)
  const half = ink.scoreSize * 0.3
  const tie = leadCrownRect(0, 0, board, redX, blueX, half, half, ink.scoreY, ink.scoreSize)
  const even = leadCrownRect(2, 2, board, redX, blueX, half, half, ink.scoreY, ink.scoreSize)
  assert(tie === null && even === null, `${label} hides the crown on a tie`)
  const red = leadCrownRect(3, 1, board, redX, blueX, half, half, ink.scoreY, ink.scoreSize)
  const blue = leadCrownRect(1, 4, board, redX, blueX, half, half, ink.scoreY, ink.scoreSize)
  assert(red !== null && blue !== null, `${label} shows a crown for a lead`)
  if (!red || !blue) {
    return
  }
  const height = ink.scoreSize * LEAD_CROWN_SCALE
  assert(Math.abs(red.h - height) < 0.05 && Math.abs(blue.h - height) < 0.05, `${label} crown is 80% of the score`)
  assert(Math.abs(red.w - height * LEAD_CROWN_ASPECT) < 0.05, `${label} crown keeps the icon aspect`)
  assert(Math.abs(red.y + red.h / 2 - ink.scoreY) < 0.05, `${label} crown is centered on the score`)
  assert(Math.abs(blue.y + blue.h / 2 - ink.scoreY) < 0.05, `${label} blue crown is centered on the score`)
  assert(Math.abs(red.x - (redX + half + LEAD_CROWN_GAP)) < 0.05, `${label} red crown sits just right of the red score`)
  assert(Math.abs(blue.x + blue.w - (blueX - half - LEAD_CROWN_GAP)) < 0.05, `${label} blue crown sits just left of the blue score`)
  for (const crown of [red, blue]) {
    assert(
      crown.x >= board.x &&
        crown.y >= board.y &&
        crown.x + crown.w <= board.x + board.w &&
        crown.y + crown.h <= board.y + board.h,
      `${label} crown stays inside the scoreboard`,
    )
  }
}

function testHomeLayout() {
  const fanBottom = 183.5
  const shortAnchor = homeTitleAnchor(375, 667, fanBottom)
  const short = homeLayout({
    width: 375,
    height: 667,
    titleY: shortAnchor.titleY,
    titleSize: shortAnchor.titleSize,
    fanBottom,
    bottomPad: 34,
  })
  assert(short.start.y - (short.challengeY + 7.5) >= 40, 'short home keeps 40px under the challenge line')
  assert(short.split >= 32 - 0.05, 'short home keeps the duel-to-howto floor')
  assert(short.settings.y === 667 - 34 - 56, 'short home keeps settings on the bottom')
  assert(short.primaryH === 56 && short.gapGame === 20 && short.gapUtility === 16, 'short home compresses the button sizes before the title gap')
  assert(short.titleY <= shortAnchor.titleY, 'short home only lifts the title when the gaps are already tight')
  assert(short.start.y + short.start.h <= short.duel.y + 0.05, 'short home keeps solo above duel')

  const tallAnchor = homeTitleAnchor(390, 844, fanBottom)
  const tall = homeLayout({
    width: 390,
    height: 844,
    titleY: tallAnchor.titleY,
    titleSize: tallAnchor.titleSize,
    fanBottom,
    bottomPad: 34,
  })
  assert(Math.abs(tall.start.y - (tall.challengeY + 7.5 + 48)) < 0.05, 'tall home keeps 48px under the challenge line')
  assert(tall.gapGame === 28 && tall.gapUtility === 20, 'tall home keeps the standard button gaps')
  assert(tall.split > 90, 'tall home leaves the spare gap above the help and settings buttons')
  assert(tall.primaryH === 64 && tall.titleY === tallAnchor.titleY, 'tall home leaves the title and primary buttons alone')
  assert(tall.settings.y === 844 - 34 - 56, 'tall home keeps settings on the bottom')
  assert(tall.start.w === 280, 'home buttons stay 280 wide')

  const narrowAnchor = homeTitleAnchor(300, 844, fanBottom)
  const narrow = homeLayout({
    width: 300,
    height: 844,
    titleY: narrowAnchor.titleY,
    titleSize: narrowAnchor.titleSize,
    fanBottom,
    bottomPad: 34,
  })
  assert(narrow.start.w === 252, 'narrow home buttons shrink with the screen')
}

function testDifficultyMenuLayout() {
  const phoneTable = tableLayout(390, 844, 72, 34)
  const phoneBarW = 390 - 40
  const phoneDifficulty = { x: 20 + phoneBarW / 3, y: phoneTable.barY, w: phoneBarW / 3, h: phoneTable.barH }
  const phone = difficultyMenuLayout(phoneDifficulty, { width: 390, height: 844, top: 72, bottom: 34 }, 'up', true)
  assert(phone.card.y + phone.card.h <= phoneDifficulty.y + 0.05, 'phone menu sits above the difficulty button')
  assert(phone.card.y >= 72 - 0.05, 'phone menu stays under minTop')
  assert(phone.card.x + phone.card.w <= 390 - 8 + 0.05, 'phone menu stays on screen')
  assert(phone.unsolvable !== null && inside(phone.unsolvable, phone.card), 'unsolvable stays on the card')
  phone.filters.forEach((item) => {
    assert(inside(item.rect, phone.card), 'filter stays on the card')
  })

  const tightAnchor = { x: 136, y: 300, w: 116, h: 44 }
  const tight = difficultyMenuLayout(tightAnchor, { width: 390, height: 360, top: 72, bottom: 34 }, 'up', true)
  assert(tight.card.y === 72, 'a short screen pins the menu to minTop instead of drawing off the top')
  assert(tight.card.y + tight.card.h <= 360 - 34 + 0.05, 'a short screen keeps the menu above the bottom pad')

  const wideTable = tableLayout(748, 844, 72, 34)
  assert(wideTable.frame.side !== null, '748 uses the solo side column')
  if (!wideTable.frame.side) {
    return
  }
  const side = wideTable.frame.side
  const wideDifficulty = { x: side.x + side.w / 3, y: wideTable.barY, w: side.w / 3, h: wideTable.barH }
  const wide = difficultyMenuLayout(wideDifficulty, { width: 748, height: 844, top: 72, bottom: 34 }, 'up', true)
  assert(wide.card.y + wide.card.h <= wideDifficulty.y + 0.05, 'wide solo menu sits above the difficulty button')
  assert(wide.card.x + wide.card.w <= 748 - 8 + 0.05, 'wide solo menu stays on screen')
  assert(wide.card.y >= 72 - 0.05, 'wide solo menu stays under minTop')

  const stacked = selectDuelLayout(1024, 1366, 72, 34)
  assert(stacked.kind === 'stacked', 'portrait iPad keeps the stacked duel layout')
  if (stacked.kind === 'stacked') {
    const pad = difficultyMenuLayout(stacked.stacked.difficulty, { width: 1024, height: 1366, top: 72, bottom: 34 }, 'up', true)
    assert(pad.card.y + pad.card.h <= stacked.stacked.difficulty.y + 0.05, 'stacked duel menu stays above the button')
    assert(pad.card.y >= 72 - 0.05, 'stacked duel menu does not draw off the top')
  }

  const duelWide = duelWideLayout(940, 665, 72, 34)
  assert(duelWide !== null, '940x665 uses the wide duel layout')
  if (duelWide) {
    const menu = difficultyMenuLayout(duelWide.utility.difficulty, { width: 940, height: 665, top: 72, bottom: 34 }, 'right', true)
    assert(menu.card.x >= duelWide.utility.difficulty.x + duelWide.utility.difficulty.w, 'wide duel menu opens to the right')
    assert(menu.card.y >= 72 - 0.05, 'wide duel menu does not draw off the top')
    assert(menu.card.y + menu.card.h <= 665 - 34 + 0.05, 'wide duel menu stays above the bottom pad')
    assert(menu.card.x + menu.card.w <= 940 - 8 + 0.05, 'wide duel menu stays on screen')
  }

  const edge = difficultyMenuLayout({ x: 800, y: 200, w: 120, h: 44 }, { width: 940, height: 665, top: 72, bottom: 34 }, 'right', true)
  assert(edge.card.x + edge.card.w <= 940 - 8 + 0.05, 'a right-side menu that would overflow is shifted back onto the screen')
}

function testHouseButton() {
  const none = houseButtonRect({ safeLeft: 0, safeTop: 0, statusBarHeight: 0 }, 72)
  assert(none.x === 16 && none.y === 16 && none.w === 40 && none.h === 40, 'house stays at 16,16 without insets')

  const iphone = houseButtonRect({ safeLeft: 0, safeTop: 44, statusBarHeight: 44 }, 96)
  assert(iphone.x === 16 && iphone.y === 52, 'iPhone X drops the house below the notch and keeps it on the left')
  assert(iphone.y + iphone.h <= 96, 'iPhone X house stays above the cards')

  const clamped = houseButtonRect({ safeTop: 44, statusBarHeight: 44 }, 72)
  assert(clamped.x === 16 && clamped.y === 32, 'a top inset cannot push the house into the cards')

  const left = houseButtonRect({ safeLeft: 44 }, 72)
  assert(left.x === 52 && left.y === 16, 'a side inset shifts the house right')

  const sizes: Array<[number, number]> = [
    [375, 667],
    [390, 844],
    [834, 1112],
    [900, 900],
    [1080, 956],
  ]
  for (const [width, height] of sizes) {
    const label = `${width}x${height}`
    const card = tableLayout(width, height, 72, 34).slots[0]
    const duel = selectDuelLayout(width, height, 72, 34)
    const duelCard = duel.kind === 'stacked' ? duel.stacked.slots[0] : duel.wide.slots[0]
    const soloHouse = houseButtonRect({ safeTop: 44, statusBarHeight: 44 }, 72)
    const duelHouse = houseButtonRect({ safeTop: 44, statusBarHeight: 44 }, 72)
    const capsule = { x: width - 96, y: 4, w: 88, h: 32 }
    assert(soloHouse.x === duelHouse.x && soloHouse.y === duelHouse.y, `${label} solo and duel share the house position`)
    assert(soloHouse.y === 32, `${label} house does not follow a vertically centered table`)
    assert(!overlaps(soloHouse, card), `${label} house does not cover the first solo card`)
    assert(!overlaps(duelHouse, duelCard), `${label} house does not cover the first duel card`)
    assert(!overlaps(soloHouse, capsule), `${label} house does not enter the capsule`)
    assert(card.y >= 72 && duelCard.y >= 72, `${label} cards stay at minTop`)
  }
}

function inside(inner: { x: number; y: number; w: number; h: number }, outer: { x: number; y: number; w: number; h: number }) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

testFractions()
testRulesExample()
testKnownGames()
testResultReplacesSecondCardSlot()
testMergeGuards()
testFailAndUndo()
testSolver()
testCatalog()
testPick()
testStreakAfterFail()
testDealSettings()
testSessionSelect()
testDuelFlow()
testDuelRoundViews()
testDuelSettingsStorage()
testDialogShell()
testCopyDialogHits()
testTableLayout()
testSettingsLayout()
testDuelWideLayout()
testDuelStackedLayout()
testScoreInk()
testHomeLayout()
testDifficultyMenuLayout()
testHouseButton()
console.log('game tests passed')
