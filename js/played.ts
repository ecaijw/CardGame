const KEY = 'playedPuzzleIds'

export function loadPlayedIds(): Set<string> {
  try {
    const raw = wx.getStorageSync(KEY)
    if (!Array.isArray(raw)) {
      return new Set()
    }
    return new Set(raw.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export function addPlayedId(id: string): void {
  const played = loadPlayedIds()
  if (played.has(id)) {
    return
  }
  played.add(id)
  wx.setStorageSync(KEY, [...played])
}
