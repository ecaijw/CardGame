import {
  DIALOG_IN_MS,
  MASK_IN_MS,
  dialogButtonRect,
  dialogMotion,
  dialogRect,
} from '../js/scenes/dialog'
import { tableLayout } from '../js/scenes/board'
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

  const phoneDuel = tableLayout(390, 844, 72, 34, 150)
  assert(phoneDuel.slots[0].y === phone.slots[0].y && phoneDuel.opY === phone.opY, 'phone duel keeps the same card and operator rows')

  const wide = tableLayout(900, 900, 80, 34)
  const wideDuel = tableLayout(900, 900, 80, 34, 150)
  assert(wide.frame.side !== null && wide.cardW === 120, 'wide screens keep the phone card size in the left column')
  assert(wideDuel.slots[0].y < wide.slots[0].y && wideDuel.opY < wide.opY, 'wide duel lifts the cards to leave room for the buzz row')
  assert(wideDuel.opY === wideDuel.slots[2].y + wideDuel.slots[2].h + 28, 'duel operators still sit 28 below the cards')
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
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
testTableLayout()
testSettingsLayout()
console.log('game tests passed')
