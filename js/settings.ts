const STATS_KEY = 'gameStats'
const SOUND_KEY = 'soundEnabled'
const MUSIC_KEY = 'musicEnabled'

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
