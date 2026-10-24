import {
  DUEL_ANSWER_DEFAULT_SEC,
  DUEL_ANSWER_STEP_SEC,
  clampAnswerSeconds,
  emptyDuelStats,
  stepAnswerSeconds,
  type DuelStats,
} from './game/duel'

const STATS_KEY = 'gameStats'
const SOUND_KEY = 'soundEnabled'
const MUSIC_KEY = 'musicEnabled'
const FILTER_KEY = 'dealFilter'
const INCLUDE_UNSOLVABLE_KEY = 'includeUnsolvable'
const DUEL_FILTER_KEY = 'duelDealFilter'
const DUEL_INCLUDE_UNSOLVABLE_KEY = 'duelIncludeUnsolvable'
const DUEL_ANSWER_SEC_KEY = 'duelAnswerSeconds'
const DUEL_STATS_KEY = 'duelStats'

const DEAL_FILTERS = ['easy', 'medium', 'hard', 'all'] as const

export type StoredDealFilter = (typeof DEAL_FILTERS)[number]
export type { DuelStats }

export type GameStats = {
  deals: number
  wins: number
  losses: number
  streak: number
}

export function loadStats(): GameStats {
  try {
    const raw = wx.getStorageSync(STATS_KEY)
    return {
      deals: readCount(raw?.deals),
      wins: readCount(raw?.wins),
      losses: readCount(raw?.losses),
      streak: readCount(raw?.streak),
    }
  } catch {
    return { deals: 0, wins: 0, losses: 0, streak: 0 }
  }
}

export function recordDeal(): void {
  const stats = loadStats()
  stats.deals += 1
  saveStats(stats)
}

export function applyDealOutcome(
  result: 'success' | 'fail',
  previous: 'success' | 'fail' | '',
  streakAtDealStart: number,
): void {
  if (previous === result) {
    return
  }
  const stats = loadStats()
  if (previous === 'fail') {
    stats.losses = Math.max(0, stats.losses - 1)
  }
  if (previous === 'success') {
    stats.wins = Math.max(0, stats.wins - 1)
  }
  if (result === 'fail') {
    stats.losses += 1
    stats.streak = 0
  } else if (previous === 'fail') {
    stats.wins += 1
    stats.streak = 1
  } else {
    stats.wins += 1
    stats.streak = streakAtDealStart + 1
  }
  saveStats(stats)
}

export function clearStreak(): void {
  const stats = loadStats()
  if (stats.streak === 0) {
    return
  }
  stats.streak = 0
  saveStats(stats)
}

export function loadSoundEnabled(): boolean {
  return loadFlag(SOUND_KEY, true)
}

export function loadMusicEnabled(): boolean {
  return loadFlag(MUSIC_KEY, true)
}

export function setSoundEnabled(on: boolean): void {
  wx.setStorageSync(SOUND_KEY, on)
}

export function setMusicEnabled(on: boolean): void {
  wx.setStorageSync(MUSIC_KEY, on)
}

export function loadDealFilter(): StoredDealFilter {
  return loadDealFilterKey(FILTER_KEY)
}

export function saveDealFilter(filter: StoredDealFilter): void {
  wx.setStorageSync(FILTER_KEY, filter)
}

export function loadIncludeUnsolvable(): boolean {
  return loadFlag(INCLUDE_UNSOLVABLE_KEY, false)
}

export function saveIncludeUnsolvable(on: boolean): void {
  wx.setStorageSync(INCLUDE_UNSOLVABLE_KEY, on)
}

export function loadDuelDealFilter(): StoredDealFilter {
  return loadDealFilterKey(DUEL_FILTER_KEY)
}

export function saveDuelDealFilter(filter: StoredDealFilter): void {
  wx.setStorageSync(DUEL_FILTER_KEY, filter)
}

export function loadDuelIncludeUnsolvable(): boolean {
  return loadFlag(DUEL_INCLUDE_UNSOLVABLE_KEY, false)
}

export function saveDuelIncludeUnsolvable(on: boolean): void {
  wx.setStorageSync(DUEL_INCLUDE_UNSOLVABLE_KEY, on)
}

export function loadDuelAnswerSeconds(): number {
  try {
    const raw = wx.getStorageSync(DUEL_ANSWER_SEC_KEY)
    if (typeof raw === 'number' || typeof raw === 'string') {
      return clampAnswerSeconds(Number(raw))
    }
  } catch {
    // ignore
  }
  return DUEL_ANSWER_DEFAULT_SEC
}

export function saveDuelAnswerSeconds(seconds: number): void {
  wx.setStorageSync(DUEL_ANSWER_SEC_KEY, clampAnswerSeconds(seconds))
}

export function bumpDuelAnswerSeconds(deltaSteps: number): number {
  const next = stepAnswerSeconds(
    loadDuelAnswerSeconds(),
    deltaSteps * DUEL_ANSWER_STEP_SEC,
  )
  saveDuelAnswerSeconds(next)
  return next
}

export function loadDuelStats(): DuelStats {
  try {
    const raw = wx.getStorageSync(DUEL_STATS_KEY)
    return {
      redRoundWins: readCount(raw?.redRoundWins),
      blueRoundWins: readCount(raw?.blueRoundWins),
      redMatchWins: readCount(raw?.redMatchWins),
      blueMatchWins: readCount(raw?.blueMatchWins),
    }
  } catch {
    return emptyDuelStats()
  }
}

export function saveDuelStats(stats: DuelStats): void {
  wx.setStorageSync(DUEL_STATS_KEY, stats)
}

function loadDealFilterKey(key: string): StoredDealFilter {
  try {
    const raw = wx.getStorageSync(key)
    if (typeof raw === 'string' && (DEAL_FILTERS as readonly string[]).includes(raw)) {
      return raw as StoredDealFilter
    }
  } catch {
    // ignore
  }
  return 'easy'
}

function readCount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function saveStats(stats: GameStats): void {
  wx.setStorageSync(STATS_KEY, stats)
}

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = wx.getStorageSync(key)
    if (raw === true || raw === false) {
      return raw
    }
  } catch {
    // ignore
  }
  return fallback
}
