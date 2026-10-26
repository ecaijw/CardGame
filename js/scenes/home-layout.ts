import type { Rect } from '../ui'

const CHALLENGE_OFFSET = 82
const CHALLENGE_SIZE = 15
const TARGET_CLEARANCE = 48
const MIN_CLEARANCE = 40
const MIN_SPLIT = 32
const SECONDARY_H = 56

export function homeTitleAnchor(width: number, height: number, fanBottom: number) {
  const titleSize = Math.min(52, width * 0.14)
  const titleY = Math.max(height * 0.32, fanBottom + 36)
  return { titleSize, titleY }
}

export type HomeLayout = {
  titleY: number
  challengeY: number
  start: Rect
  duel: Rect
  howto: Rect
  settings: Rect
  split: number
  gapGame: number
  gapUtility: number
  primaryH: number
}

export function homeLayout(input: {
  width: number
  height: number
  titleY: number
  titleSize: number
  fanBottom: number
  bottomPad: number
}): HomeLayout {
  const { width, height, titleSize, fanBottom, bottomPad } = input
  let titleY = input.titleY
  let clearance = TARGET_CLEARANCE
  let primaryH = 64
  let gapGame = 28
  let gapUtility = 20

  const splitOf = (next: {
    titleY: number
    clearance: number
    primaryH: number
    gapGame: number
    gapUtility: number
  }) => {
    const settingsY = height - bottomPad - SECONDARY_H
    const howtoY = settingsY - next.gapUtility - SECONDARY_H
    const startY = next.titleY + CHALLENGE_OFFSET + CHALLENGE_SIZE / 2 + next.clearance
    const duelBottom = startY + next.primaryH + next.gapGame + next.primaryH
    return howtoY - duelBottom
  }

  const tighten = (start: number, end: number, apply: (value: number) => number) => {
    if (apply(start) >= MIN_SPLIT) {
      return start
    }
    if (apply(end) < MIN_SPLIT) {
      return end
    }
    let lo = end
    let hi = start
    for (let step = 0; step < 24; step += 1) {
      const mid = (lo + hi) / 2
      if (apply(mid) >= MIN_SPLIT) {
        lo = mid
      } else {
        hi = mid
      }
    }
    return lo
  }

  const current = () => splitOf({ titleY, clearance, primaryH, gapGame, gapUtility })
  if (current() < MIN_SPLIT) {
    primaryH = tighten(primaryH, 56, (value) => splitOf({ titleY, clearance, primaryH: value, gapGame, gapUtility }))
  }
  if (current() < MIN_SPLIT) {
    gapGame = tighten(gapGame, 20, (value) => splitOf({ titleY, clearance, primaryH, gapGame: value, gapUtility }))
  }
  if (current() < MIN_SPLIT) {
    gapUtility = tighten(gapUtility, 16, (value) => splitOf({ titleY, clearance, primaryH, gapGame, gapUtility: value }))
  }
  if (current() < MIN_SPLIT) {
    clearance = tighten(clearance, MIN_CLEARANCE, (value) =>
      splitOf({ titleY, clearance: value, primaryH, gapGame, gapUtility }),
    )
  }
  const minTitleY = fanBottom + titleSize / 2
  if (current() < MIN_SPLIT && minTitleY < titleY) {
    titleY = tighten(titleY, minTitleY, (value) => splitOf({ titleY: value, clearance, primaryH, gapGame, gapUtility }))
  }

  const btnW = Math.min(280, width - 48)
  const btnX = (width - btnW) / 2
  const settingsY = height - bottomPad - SECONDARY_H
  const howtoY = settingsY - gapUtility - SECONDARY_H
  const startY = titleY + CHALLENGE_OFFSET + CHALLENGE_SIZE / 2 + clearance
  const duelY = startY + primaryH + gapGame
  const split = howtoY - (duelY + primaryH)
  return {
    titleY,
    challengeY: titleY + CHALLENGE_OFFSET,
    start: { x: btnX, y: startY, w: btnW, h: primaryH },
    duel: { x: btnX, y: duelY, w: btnW, h: primaryH },
    howto: { x: btnX, y: howtoY, w: btnW, h: SECONDARY_H },
    settings: { x: btnX, y: settingsY, w: btnW, h: SECONDARY_H },
    split,
    gapGame,
    gapUtility,
    primaryH,
  }
}
