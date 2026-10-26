import type { Rect } from '../ui'
import { fitTable, playFrame, slotRects, tableOccupies } from './board'

const TABLE_W = 400
const OP_GAP = 12
const BUZZ_W = 176
const UTIL_H = 52
const UTIL_GAP_X = 16
const UTIL_MARGIN = 48
const STATS_MARGIN = 64
const MIN_UTIL_W = 84
const STATS_H = 96

export type DuelWideLayout = {
  slots: Rect[]
  ops: Rect[]
  fontSize: number
  utility: {
    answer: Rect
    restart: Rect
    difficulty: Rect
    unsolvable: Rect
    settings: Rect
    next: Rect
  }
  stats: { rounds: Rect; matches: Rect }
  battle: { redBuzz: Rect; score: Rect; blueBuzz: Rect }
  hint: { x: number; y: number; maxWidth: number }
}

export function duelWideLayout(
  width: number,
  height: number,
  minTop: number,
  bottomPad: number,
): DuelWideLayout | null {
  if (!playFrame(width).side) {
    return null
  }
  const available = height - minTop - bottomPad
  const fitted = fitTable(TABLE_W, available, 'wide')
  if (!fitted.fits || tableOccupies(fitted.fit, 'wide') > available + 0.5) {
    return null
  }
  const { fit } = fitted
  const tableX = (width - TABLE_W) / 2
  const cardW = fit.cardW
  const cardH = fit.cardH
  const fontSize = fit.fontSize
  const opW = (TABLE_W - 32 - OP_GAP * 3) / 4
  const plusX = tableX + 16
  const utilW = (plusX - UTIL_MARGIN * 2 - UTIL_GAP_X) / 2
  const divideRight = tableX + 16 + 3 * (opW + OP_GAP) + opW
  const statsSpan = width - divideRight
  const statsW = statsSpan - STATS_MARGIN * 2
  const cardAreaW = cardW * 2 + fit.cardGap
  if (utilW < MIN_UTIL_W || statsW < 140) {
    return null
  }
  const utilMargin = (plusX - (utilW * 2 + UTIL_GAP_X)) / 2
  const statsMargin = (statsSpan - statsW) / 2
  const statsLeft = divideRight + statsMargin

  const buzzBottom = height - bottomPad - fit.concedeH
  const buzzTop = buzzBottom - fit.buzzH
  const buzzCenter = (buzzTop + buzzBottom) / 2
  const utilCenter = utilMargin + (utilW * 2 + UTIL_GAP_X) / 2
  const statsCenter = statsLeft + statsW / 2
  const redBuzz = {
    x: utilCenter - BUZZ_W / 2,
    y: buzzTop,
    w: BUZZ_W,
    h: fit.buzzH,
  }
  const blueBuzz = {
    x: statsCenter - BUZZ_W / 2,
    y: buzzTop,
    w: BUZZ_W,
    h: fit.buzzH,
  }
  const score = {
    x: (width - cardAreaW) / 2,
    y: buzzCenter - fit.scoreH / 2,
    w: cardAreaW,
    h: fit.scoreH,
  }

  const topY = minTop
  const slots = slotRects(tableX, TABLE_W, topY, cardW, cardH, fit.cardGap)
  const opY = slots[2].y + slots[2].h + fit.gapCardOp
  const ops = [0, 1, 2, 3].map((index) => ({
    x: tableX + 16 + index * (opW + OP_GAP),
    y: opY,
    w: opW,
    h: fit.opH,
  }))
  const battleTop = Math.min(score.y, redBuzz.y)
  if (opY + fit.opH + fit.gapAfterOp > battleTop + 0.5) {
    return null
  }

  const rounds = statsCard(statsLeft, statsW, slots[0])
  const matches = statsCard(statsLeft, statsW, slots[2])
  const blockTop = rounds.y
  const blockH = matches.y + matches.h - rounds.y
  const utilGapY = (blockH - UTIL_H * 3) / 2
  if (utilGapY < -0.5) {
    return null
  }
  const colX = [utilMargin, utilMargin + utilW + UTIL_GAP_X]
  const slot = (col: 0 | 1, row: 0 | 1 | 2): Rect => ({
    x: colX[col],
    y: blockTop + row * (UTIL_H + utilGapY),
    w: utilW,
    h: UTIL_H,
  })
  const utility = {
    answer: slot(0, 0),
    restart: slot(1, 0),
    difficulty: slot(0, 1),
    unsolvable: slot(1, 1),
    settings: slot(0, 2),
    next: slot(1, 2),
  }
  const layout: DuelWideLayout = {
    slots,
    ops,
    fontSize,
    utility,
    stats: { rounds, matches },
    battle: { redBuzz, score, blueBuzz },
    hint: {
      x: redBuzz.x,
      y: opY + fit.opH / 2,
      maxWidth: Math.max(0, ops[0].x - redBuzz.x - 12),
    },
  }
  const rects = [
    ...slots,
    ...ops,
    utility.answer,
    utility.restart,
    utility.difficulty,
    utility.unsolvable,
    utility.settings,
    utility.next,
    rounds,
    matches,
    redBuzz,
    blueBuzz,
    score,
  ]
  const floor = height - bottomPad
  for (const rect of rects) {
    if (rect.y < minTop - 0.5 || rect.y + rect.h > floor + 0.5 || rect.x < -0.5 || rect.x + rect.w > width + 0.5) {
      return null
    }
  }
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      if (rectsOverlap(rects[i], rects[j])) {
        return null
      }
    }
  }
  return layout
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function statsCard(x: number, w: number, row: Rect): Rect {
  const cy = row.y + row.h / 2
  return { x, y: cy - STATS_H / 2, w, h: STATS_H }
}
