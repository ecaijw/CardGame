const KEY = 'playedPuzzleIds'
const DUEL_KEY = 'duelPlayedPuzzleIds'

export function loadPlayedIds(): Set<string> {
  return loadIds(KEY)
}

export function addPlayedId(id: string): void {
  addId(KEY, id)
}

export function loadDuelPlayedIds(): Set<string> {
  return loadIds(DUEL_KEY)
}

export function addDuelPlayedId(id: string): void {
  addId(DUEL_KEY, id)
}

function loadIds(key: string): Set<string> {
  try {
    const raw = wx.getStorageSync(key)
    if (!Array.isArray(raw)) {
      return new Set()
    }
    return new Set(raw.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function addId(key: string, id: string): void {
  const played = loadIds(key)
  if (played.has(id)) {
    return
  }
  played.add(id)
  wx.setStorageSync(key, [...played])
}
