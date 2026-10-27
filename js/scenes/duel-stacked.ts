import type { Rect } from '../ui'
import { fitTable, slotRects } from './board'
import { duelWideLayout, type DuelWideLayout } from './duel-wide'

export const STACKED_MAX_W = 430
const SCORE_INNER_FLOOR = 8
const SCORE_OUTER_PAIR = 24

function scoreBuzzSpacing(
  region: number,
  fit: { scoreH: number; scoreBuzzGap: number; buzzH: number; concedeH: number },
) {
  const standard = fit.scoreBuzzGap
  const free = region - (fit.scoreH + fit.buzzH + fit.concedeH)
  if (free <= SCORE_INNER_FLOOR + SCORE_OUTER_PAIR) {
    return SCORE_INNER_FLOOR
  }
  if (free <= standard + SCORE_OUTER_PAIR) {
    return free - SCORE_OUTER_PAIR
  }
  return standard + Math.min(48, (free - standard - SCORE_OUTER_PAIR) / 3)
}

export type DuelStackedLayout = {
  columnX: number
  columnW: number
  cardW: number
  fontSize: number
  slots: Rect[]
  ops: Rect[]
  score: Rect
  redBuzz: Rect
  blueBuzz: Rect
  concede: Rect
  restart: Rect
  unsolvable: Rect
  next: Rect
  bar: Rect
  answer: Rect
  difficulty: Rect
  settings: Rect
  gapCardOp: number
  gapAfterOp: number
  gapActionBar: number
}

function splitRow(x: number, y: number, w: number, h: number, count: number): Rect[] {
  return Array.from({ length: count }, (_, index) => {
    const left = x + (w * index) / count
    const right = x + (w * (index + 1)) / count
    return { x: left, y, w: right - left, h }
  })
}

export function duelStackedLayout(
  width: number,
  height: number,
  minTop: number,
  bottomPad: number,
): DuelStackedLayout {
  const columnW = Math.min(STACKED_MAX_W, width)
  const columnX = (width - columnW) / 2
  const { fit } = fitTable(columnW, height - minTop - bottomPad, 'duel')
  const slots = slotRects(columnX, columnW, minTop, fit.cardW, fit.cardH, fit.cardGap)
  const opGap = 12
  const opW = (columnW - 32 - opGap * 3) / 4
  const opY = slots[2].y + slots[2].h + fit.gapCardOp
  const ops = [0, 1, 2, 3].map((index) => ({
    x: columnX + 16 + index * (opW + opGap),
    y: opY,
    w: opW,
    h: fit.opH,
  }))

  const barX = columnX + 20
  const barW = columnW - 40
  const barY = height - bottomPad - fit.barH
  const bar = { x: barX, y: barY, w: barW, h: fit.barH }
  const actionY = barY - fit.gapActionBar - fit.actionH
  const [answer, difficulty, settings] = splitRow(barX, barY, barW, fit.barH, 3)
  const [restart, unsolvable, next] = splitRow(barX, actionY, barW, fit.actionH, 3)
  const opBottom = opY + fit.opH
  const region = actionY - opBottom
  // Compact screens shrink score-to-buzz to 8 and split the rest 12/12.
  // More height restores the gap to 16, then grows it by the old extra rule.
  const scoreBuzzGap = scoreBuzzSpacing(region, fit)
  const block = fit.scoreH + scoreBuzzGap + fit.buzzH + fit.concedeH
  const leftover = region - block
  const scoreY = leftover >= 0 ? opBottom + leftover / 2 : actionY - block
  const buzzY = scoreY + fit.scoreH + scoreBuzzGap
  const concedeY = buzzY + fit.buzzH
  const rowX = columnX + 16
  const rowW = columnW - 32
  const sideGap = 16
  const sideW = (rowW - sideGap) / 2
  const score = { x: rowX, y: scoreY, w: rowW, h: fit.scoreH }
  const redBuzz = { x: rowX, y: buzzY, w: sideW, h: fit.buzzH }
  const blueBuzz = { x: rowX + sideW + sideGap, y: buzzY, w: sideW, h: fit.buzzH }
  const concede = { x: rowX, y: concedeY, w: rowW, h: fit.concedeH }
  return {
    columnX,
    columnW,
    cardW: fit.cardW,
    fontSize: fit.fontSize,
    slots,
    ops,
    score,
    redBuzz,
    blueBuzz,
    concede,
    restart,
    unsolvable,
    next,
    bar,
    answer,
    difficulty,
    settings,
    gapCardOp: fit.gapCardOp,
    gapAfterOp: scoreY - (opY + fit.opH),
    gapActionBar: fit.gapActionBar,
  }
}

export type DuelPageLayout =
  | { kind: 'wide'; wide: DuelWideLayout }
  | { kind: 'stacked'; stacked: DuelStackedLayout }

export function selectDuelLayout(
  width: number,
  height: number,
  minTop: number,
  bottomPad: number,
): DuelPageLayout {
  if (width > height) {
    const wide = duelWideLayout(width, height, minTop, bottomPad)
    if (wide) {
      return { kind: 'wide', wide }
    }
  }
  return { kind: 'stacked', stacked: duelStackedLayout(width, height, minTop, bottomPad) }
}
