import type { DealFilter } from '../game/puzzles'
import { drawGreenCheck } from './board'
import { menuButton, menuInk, paintMenuChrome, text, withButtonScale, type Rect } from '../ui'

export const DIFFICULTY_FILTERS: Array<{ label: string; filter: DealFilter }> = [
  { label: '简单', filter: 'easy' },
  { label: '中等', filter: 'medium' },
  { label: '困难', filter: 'hard' },
  { label: '全部', filter: 'all' },
]

export type DifficultyMenuHit =
  | { rect: Rect; hit: { kind: 'toggle-unsolvable' } }
  | { rect: Rect; hit: { kind: 'set-filter'; filter: DealFilter } }

export function drawDifficultyMenu(
  ctx: CanvasRenderingContext2D,
  anchor: Rect,
  selected: DealFilter,
  includeUnsolvable: boolean,
  showUnsolvable: boolean,
  pressScale: (key: string) => number,
): DifficultyMenuHit[] {
  const rowH = 40
  const menuGap = 6
  const filters = DIFFICULTY_FILTERS.map((item, index) => {
    const fromBottom = DIFFICULTY_FILTERS.length - index
    const rect = {
      x: anchor.x + 8,
      y: anchor.y - fromBottom * (rowH + menuGap),
      w: anchor.w - 16,
      h: rowH,
    }
    withButtonScale(ctx, rect, pressScale(`filter-${item.filter}`), () => {
      menuButton(ctx, rect, item.label, item.filter === selected ? 'blush' : 'ghost')
    })
    return { filter: item.filter, rect }
  })
  const hits: DifficultyMenuHit[] = filters.map((item) => ({
    rect: item.rect,
    hit: { kind: 'set-filter', filter: item.filter },
  }))
  if (!showUnsolvable) {
    return hits
  }
  const unsolvable = {
    x: anchor.x + 8,
    y: anchor.y - (DIFFICULTY_FILTERS.length + 1) * (rowH + menuGap),
    w: anchor.w - 16,
    h: rowH,
  }
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
  hits.unshift({ rect: unsolvable, hit: { kind: 'toggle-unsolvable' } })
  return hits
}
