import type { DealFilter } from '../game/puzzles'
import { drawGreenCheck } from './board'
import {
  fillRound,
  menuButton,
  menuInk,
  paintMenuChrome,
  strokeRound,
  text,
  withButtonScale,
  type Rect,
} from '../ui'

export const DIFFICULTY_FILTERS: Array<{ label: string; filter: DealFilter }> = [
  { label: '简单', filter: 'easy' },
  { label: '中等', filter: 'medium' },
  { label: '困难', filter: 'hard' },
  { label: '全部', filter: 'all' },
]

const ROW_H = 40
const ROW_GAP = 6
const PAD = 8
const ANCHOR_GAP = 8
const EDGE = 8
const CARD_FILL = '#EDF8F3'
const CARD_STROKE = '#B9E1D0'

export type DifficultyMenuPlace = 'up' | 'right'

export type DifficultyMenuView = {
  width: number
  height: number
  top?: number
  bottom?: number
}

export type DifficultyMenuLayout = {
  card: Rect
  filters: Array<{ filter: DealFilter; rect: Rect }>
  unsolvable: Rect | null
}

export type DifficultyMenuHit =
  | { rect: Rect; hit: { kind: 'toggle-unsolvable' } }
  | { rect: Rect; hit: { kind: 'set-filter'; filter: DealFilter } }
  | { rect: Rect; hit: { kind: 'difficulty-menu' } }

export function isDifficultyMenuHit(kind: string) {
  return (
    kind === 'set-filter' ||
    kind === 'difficulty' ||
    kind === 'toggle-unsolvable' ||
    kind === 'difficulty-menu'
  )
}

export function difficultyMenuLayout(
  anchor: Rect,
  view: DifficultyMenuView,
  place: DifficultyMenuPlace,
  showUnsolvable: boolean,
): DifficultyMenuLayout {
  const count = DIFFICULTY_FILTERS.length + (showUnsolvable ? 1 : 0)
  const innerH = count * ROW_H + Math.max(0, count - 1) * ROW_GAP
  const cardW = anchor.w
  const cardH = PAD + innerH + PAD
  const minX = EDGE
  const maxX = view.width - EDGE - cardW
  const minY = view.top ?? EDGE
  const maxY = view.height - (view.bottom ?? EDGE) - cardH
  let x = place === 'right' ? anchor.x + anchor.w + ANCHOR_GAP : anchor.x
  let y = place === 'right' ? anchor.y + (anchor.h - cardH) / 2 : anchor.y - ANCHOR_GAP - cardH
  x = Math.min(Math.max(x, minX), Math.max(minX, maxX))
  y = Math.min(Math.max(y, minY), Math.max(minY, maxY))
  const card = { x, y, w: cardW, h: cardH }
  const rows = Array.from({ length: count }, (_, index) => ({
    x: card.x + PAD,
    y: card.y + PAD + index * (ROW_H + ROW_GAP),
    w: card.w - PAD * 2,
    h: ROW_H,
  }))
  const unsolvable = showUnsolvable ? rows[0] : null
  const filterRows = showUnsolvable ? rows.slice(1) : rows
  return {
    card,
    filters: DIFFICULTY_FILTERS.map((item, index) => ({ filter: item.filter, rect: filterRows[index] })),
    unsolvable,
  }
}

export function drawDifficultyMenu(
  ctx: CanvasRenderingContext2D,
  anchor: Rect,
  selected: DealFilter,
  includeUnsolvable: boolean,
  showUnsolvable: boolean,
  pressScale: (key: string) => number,
  view: DifficultyMenuView,
  place: DifficultyMenuPlace,
): DifficultyMenuHit[] {
  const layout = difficultyMenuLayout(anchor, view, place, showUnsolvable)
  ctx.save()
  ctx.shadowColor = 'rgba(47, 107, 79, 0.06)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 1
  fillRound(ctx, layout.card, CARD_FILL, 16)
  ctx.restore()
  strokeRound(ctx, layout.card, CARD_STROKE, 16, 1.5)
  const hits: DifficultyMenuHit[] = []
  if (layout.unsolvable) {
    const unsolvable = layout.unsolvable
    withButtonScale(ctx, unsolvable, pressScale('toggle-unsolvable'), () => {
      paintMenuChrome(ctx, unsolvable, 'ghost')
      const label = '含无解题'
      const fontSize = unsolvable.w < 100 ? 13 : 15
      const midY = unsolvable.y + unsolvable.h / 2
      const cx = unsolvable.x + unsolvable.w / 2
      ctx.save()
      ctx.font = `600 ${fontSize}px "PingFang SC","PingFangSC-Semibold","Hiragino Sans GB","Heiti SC",sans-serif`
      const textW = ctx.measureText(label).width
      ctx.restore()
      if (includeUnsolvable) {
        const mark = 12
        const gap = 6
        const start = cx - (mark + gap + textW) / 2
        drawGreenCheck(ctx, start + mark / 2, midY)
        text(ctx, label, start + mark + gap, midY, fontSize, menuInk('ghost'), 'left', '600')
      } else {
        text(ctx, label, cx, midY, fontSize, menuInk('ghost'), 'center', '600')
      }
    })
    hits.push({ rect: unsolvable, hit: { kind: 'toggle-unsolvable' } })
  }
  layout.filters.forEach((item) => {
    withButtonScale(ctx, item.rect, pressScale(`filter-${item.filter}`), () => {
      menuButton(ctx, item.rect, filterLabel(item.filter), item.filter === selected ? 'blush' : 'ghost')
    })
    hits.push({ rect: item.rect, hit: { kind: 'set-filter', filter: item.filter } })
  })
  hits.push({ rect: layout.card, hit: { kind: 'difficulty-menu' } })
  return hits
}

function filterLabel(filter: DealFilter) {
  const found = DIFFICULTY_FILTERS.find((item) => item.filter === filter)
  return found ? found.label : filter
}
