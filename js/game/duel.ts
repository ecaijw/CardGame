export const DUEL_TARGET = 5
export const DUEL_HANDOFF_MS = 3000
export const DUEL_ANSWER_DEFAULT_SEC = 20
export const DUEL_ANSWER_MIN_SEC = 10
export const DUEL_ANSWER_MAX_SEC = 60
export const DUEL_ANSWER_STEP_SEC = 5

export type DuelPlayer = 'red' | 'blue'

export type DuelPhase =
  | 'thinking'
  | 'answering'
  | 'handoff'
  | 'revealed'
  | 'roundEnd'
  | 'matchEnd'

export type DuelStats = {
  redRoundWins: number
  blueRoundWins: number
  redMatchWins: number
  blueMatchWins: number
}

export type RoundResult = 'success' | 'fail'

export type DuelMatch = {
  phase: DuelPhase
  scoreRed: number
  scoreBlue: number
  firstPlayer: DuelPlayer | null
  answering: DuelPlayer | null
  answerDeadline: number | null
  handoffDeadline: number | null
  answerMs: number
  winner: DuelPlayer | null
  roundResult: RoundResult | null
}

export type DuelStatsEvent =
  | { kind: 'round'; player: DuelPlayer }
  | { kind: 'match'; player: DuelPlayer }

export function emptyDuelStats(): DuelStats {
  return {
    redRoundWins: 0,
    blueRoundWins: 0,
    redMatchWins: 0,
    blueMatchWins: 0,
  }
}

export function applyDuelStats(stats: DuelStats, event: DuelStatsEvent): DuelStats {
  const next = { ...stats }
  if (event.kind === 'round') {
    if (event.player === 'red') {
      next.redRoundWins += 1
    } else {
      next.blueRoundWins += 1
    }
    return next
  }
  if (event.player === 'red') {
    next.redMatchWins += 1
  } else {
    next.blueMatchWins += 1
  }
  return next
}

export function clampAnswerSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return DUEL_ANSWER_DEFAULT_SEC
  }
  const n = Math.floor(value)
  if (n < DUEL_ANSWER_MIN_SEC) {
    return DUEL_ANSWER_MIN_SEC
  }
  if (n > DUEL_ANSWER_MAX_SEC) {
    return DUEL_ANSWER_MAX_SEC
  }
  return n
}

export function stepAnswerSeconds(current: number, delta: number): number {
  return clampAnswerSeconds(clampAnswerSeconds(current) + delta)
}

export function setAnswerSeconds(match: DuelMatch, answerSeconds: number): DuelMatch {
  const answerMs = clampAnswerSeconds(answerSeconds) * 1000
  if (answerMs === match.answerMs) {
    return match
  }
  return { ...match, answerMs }
}

export function createMatch(answerSeconds: number): DuelMatch {
  return {
    phase: 'thinking',
    scoreRed: 0,
    scoreBlue: 0,
    firstPlayer: null,
    answering: null,
    answerDeadline: null,
    handoffDeadline: null,
    answerMs: clampAnswerSeconds(answerSeconds) * 1000,
    winner: null,
    roundResult: null,
  }
}

export function rematch(match: DuelMatch): DuelMatch {
  return createMatch(match.answerMs / 1000)
}

export function nextRound(match: DuelMatch): DuelMatch {
  return {
    ...match,
    phase: 'thinking',
    firstPlayer: null,
    answering: null,
    answerDeadline: null,
    handoffDeadline: null,
    winner: null,
    roundResult: null,
  }
}

export function buzz(
  match: DuelMatch,
  player: DuelPlayer,
  now: number,
): DuelMatch | null {
  if (match.phase !== 'thinking') {
    return null
  }
  return {
    ...match,
    phase: 'answering',
    firstPlayer: player,
    answering: player,
    answerDeadline: now + match.answerMs,
    handoffDeadline: null,
  }
}

export function resign(match: DuelMatch, now: number): DuelMatch | null {
  if (match.phase !== 'answering' || !match.answering) {
    return null
  }
  return failAttempt(match, now)
}

export function timeout(match: DuelMatch, now: number): DuelMatch | null {
  if (match.phase !== 'answering' || match.answerDeadline === null) {
    return null
  }
  if (now < match.answerDeadline) {
    return null
  }
  return failAttempt(match, now)
}

export function failAttempt(match: DuelMatch, now: number): DuelMatch {
  if (match.phase !== 'answering' || !match.answering || !match.firstPlayer) {
    return match
  }
  if (match.answering === match.firstPlayer) {
    return {
      ...match,
      phase: 'handoff',
      answering: null,
      answerDeadline: null,
      handoffDeadline: now + DUEL_HANDOFF_MS,
      roundResult: null,
    }
  }
  return {
    ...match,
    phase: 'roundEnd',
    answering: null,
    answerDeadline: null,
    handoffDeadline: null,
    roundResult: 'fail',
  }
}

export function startSecond(match: DuelMatch, now: number): DuelMatch | null {
  if (match.phase !== 'handoff' || !match.firstPlayer) {
    return null
  }
  const second: DuelPlayer = match.firstPlayer === 'red' ? 'blue' : 'red'
  return {
    ...match,
    phase: 'answering',
    answering: second,
    answerDeadline: now + match.answerMs,
    handoffDeadline: null,
  }
}

export function tickHandoff(match: DuelMatch, now: number): DuelMatch | null {
  if (match.phase !== 'handoff' || match.handoffDeadline === null) {
    return null
  }
  if (now < match.handoffDeadline) {
    return null
  }
  return startSecond(match, now)
}

export type SucceedResult = {
  match: DuelMatch
  events: DuelStatsEvent[]
}

export function succeed(match: DuelMatch): SucceedResult | null {
  if (match.phase !== 'answering' || !match.answering) {
    return null
  }
  const player = match.answering
  const scoreRed = player === 'red' ? match.scoreRed + 1 : match.scoreRed
  const scoreBlue = player === 'blue' ? match.scoreBlue + 1 : match.scoreBlue
  const events: DuelStatsEvent[] = [{ kind: 'round', player }]
  const reached = (player === 'red' ? scoreRed : scoreBlue) >= DUEL_TARGET
  if (reached) {
    events.push({ kind: 'match', player })
  }
  return {
    match: {
      ...match,
      scoreRed,
      scoreBlue,
      phase: reached ? 'matchEnd' : 'roundEnd',
      answering: null,
      answerDeadline: null,
      handoffDeadline: null,
      winner: reached ? player : null,
      roundResult: 'success',
    },
    events,
  }
}

export function revealAnswer(match: DuelMatch): DuelMatch | null {
  if (match.phase !== 'thinking') {
    return null
  }
  return {
    ...match,
    phase: 'revealed',
    answering: null,
    answerDeadline: null,
    handoffDeadline: null,
  }
}

export function remainingAnswerSeconds(match: DuelMatch, now: number): number {
  if (match.phase !== 'answering' || match.answerDeadline === null) {
    return 0
  }
  const left = match.answerDeadline - now
  if (left <= 0) {
    return 0
  }
  return Math.ceil(left / 1000)
}

export function remainingHandoffSeconds(match: DuelMatch, now: number): number {
  if (match.phase !== 'handoff' || match.handoffDeadline === null) {
    return 0
  }
  const left = match.handoffDeadline - now
  if (left <= 0) {
    return 0
  }
  return Math.ceil(left / 1000)
}

export function otherPlayer(player: DuelPlayer): DuelPlayer {
  return player === 'red' ? 'blue' : 'red'
}

export type DuelDialogKind = 'handoff' | 'round-fail' | 'match-end' | 'answer' | 'round-success'

export function duelDialog(match: DuelMatch): DuelDialogKind | null {
  if (match.phase === 'handoff') {
    return 'handoff'
  }
  if (match.phase === 'roundEnd' && match.roundResult !== 'success') {
    return 'round-fail'
  }
  if (match.phase === 'matchEnd') {
    return 'match-end'
  }
  if (match.phase === 'revealed') {
    return 'answer'
  }
  if (match.phase === 'roundEnd' && match.roundResult === 'success') {
    return 'round-success'
  }
  return null
}

export function duelPageChrome(phase: DuelPhase): 'thinking' | 'answering' {
  if (phase === 'answering' || phase === 'handoff' || phase === 'roundEnd' || phase === 'matchEnd') {
    return 'answering'
  }
  return 'thinking'
}

export function duelShownBuzzPlayer(match: DuelMatch, remembered: DuelPlayer | null): DuelPlayer | null {
  if (match.phase === 'answering') {
    return match.answering
  }
  if (match.phase === 'handoff' || match.phase === 'roundEnd' || match.phase === 'matchEnd') {
    return remembered
  }
  return null
}

export function duelSettlesSuccess(match: DuelMatch): boolean {
  return match.roundResult === 'success'
}

export function judgeUnsolvable(
  match: DuelMatch,
  unsolvable: boolean,
  now: number,
): { kind: 'success'; result: SucceedResult } | { kind: 'fail'; match: DuelMatch } | null {
  if (unsolvable) {
    const result = succeed(match)
    return result ? { kind: 'success', result } : null
  }
  return { kind: 'fail', match: failAttempt(match, now) }
}
