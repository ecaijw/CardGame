import type { Rect } from '../ui'
import { playFrame, slotRects } from './board'

const TABLE_W = 400
const CARD_GAP = 16
const OP_H = 56
const OP_GAP = 12
const BELOW_CARDS = 28
const BUZZ_H = 52
const BUZZ_W = 176
const SCORE_H = 58
const UTIL_H = 52
const UTIL_GAP_X = 16
const UTIL_MARGIN = 48
const STATS_MARGIN = 64
const MIN_UTIL_W = 84
const STATS_H = 96
const TIP_GAP = 16
const TIP_TEXT = 14

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
  const tableX = (width - TABLE_W) / 2
  const cardW = Math.min(120, (TABLE_W - 48 - CARD_GAP) / 2)
  const cardH = cardW * (88 / 63)
  const fontSize = cardW > 90 ? 32 : 26
  const opW = (TABLE_W - 32 - OP_GAP * 3) / 4
  const plusX = tableX + 16
  const utilW = (plusX - UTIL_MARGIN * 2 - UTIL_GAP_X) / 2
  const divideRight = tableX + 16 + 3 * (opW + OP_GAP) + opW
  const statsSpan = width - divideRight
  const statsW = statsSpan - STATS_MARGIN * 2
  const cardAreaW = cardW * 2 + CARD_GAP
  if (utilW < MIN_UTIL_W || statsW < 140) {
    return null
  }
  const utilMargin = (plusX - (utilW * 2 + UTIL_GAP_X)) / 2
  const statsMargin = (statsSpan - statsW) / 2
  const statsLeft = divideRight + statsMargin

  const battleCenter =
    height - bottomPad - TIP_GAP - TIP_TEXT / 2 - BUZZ_H / 2
  const utilCenter = utilMargin + (utilW * 2 + UTIL_GAP_X) / 2
  const statsCenter = statsLeft + statsW / 2
  const redBuzz = {
    x: utilCenter - BUZZ_W / 2,
    y: battleCenter - BUZZ_H / 2,
    w: BUZZ_W,
    h: BUZZ_H,
  }
  const blueBuzz = {
    x: statsCenter - BUZZ_W / 2,
    y: redBuzz.y,
    w: BUZZ_W,
    h: BUZZ_H,
  }
  const score = {
    x: (width - cardAreaW) / 2,
    y: battleCenter - SCORE_H / 2,
    w: cardAreaW,
    h: SCORE_H,
  }

  const stackH = cardH * 2 + CARD_GAP + BELOW_CARDS + OP_H
  const regionTop = minTop
  const regionBottom = redBuzz.y - 16
  const topY = regionTop + Math.max(0, (regionBottom - regionTop - stackH) / 2)
  const slots = slotRects(tableX, TABLE_W, topY, cardW, cardH, CARD_GAP)
  const opY = slots[2].y + slots[2].h + BELOW_CARDS
  const ops = [0, 1, 2, 3].map((index) => ({
    x: tableX + 16 + index * (opW + OP_GAP),
    y: opY,
    w: opW,
    h: OP_H,
  }))

  const rounds = statsCard(statsLeft, statsW, slots[0])
  const matches = statsCard(statsLeft, statsW, slots[2])
  const blockTop = rounds.y
  const blockH = matches.y + matches.h - rounds.y
  const utilGapY = (blockH - UTIL_H * 3) / 2
  const colX = [utilMargin, utilMargin + utilW + UTIL_GAP_X]
  const slot = (col: 0 | 1, row: 0 | 1 | 2): Rect => ({
    x: colX[col],
    y: blockTop + row * (UTIL_H + utilGapY),
    w: utilW,
    h: UTIL_H,
  })
  return {
    slots,
    ops,
    fontSize,
    utility: {
      answer: slot(0, 0),
      restart: slot(1, 0),
      difficulty: slot(0, 1),
      unsolvable: slot(1, 1),
      settings: slot(0, 2),
      next: slot(1, 2),
    },
    stats: { rounds, matches },
    battle: { redBuzz, score, blueBuzz },
    hint: {
      x: redBuzz.x,
      y: opY + OP_H / 2,
      maxWidth: Math.max(0, ops[0].x - redBuzz.x - 12),
    },
  }
}

function statsCard(x: number, w: number, row: Rect): Rect {
  const cy = row.y + row.h / 2
  return { x, y: cy - STATS_H / 2, w, h: STATS_H }
}
