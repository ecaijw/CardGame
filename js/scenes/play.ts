import { formatFraction, type Op } from '../game/fraction'
import {
  merge,
  outcome,
  startGame,
  type GameState,
} from '../game/merge'
import { pickPuzzle, type DealFilter, type Puzzle } from '../game/puzzles'
import { addPlayedId, loadPlayedIds } from '../played'
import { applyDealOutcome, loadStats, recordDeal } from '../settings'
import {
  Color,
  button,
  drawSettingsHit,
  fillRound,
  hit,
  strokeRound,
  text,
  type Rect,
} from '../ui'

const OPS: Op[] = ['+', '−', '×', '÷']

const FILTERS: Array<{ label: string; filter: DealFilter }> = [
  { label: '简单', filter: 'easy' },
  { label: '中等', filter: 'medium' },
  { label: '困难', filter: 'hard' },
  { label: '全部', filter: 'all' },
]

type Hit =
  | { kind: 'card'; id: number }
  | { kind: 'op'; op: Op }
  | { kind: 'restart' }
  | { kind: 'next' }
  | { kind: 'answer' }
  | { kind: 'difficulty' }
  | { kind: 'set-filter'; filter: DealFilter }
  | { kind: 'dialog-restart' }
  | { kind: 'dialog-next' }
  | { kind: 'settings' }

export class PlayScene {
  puzzle: Puzzle
  filter: DealFilter
  private state: GameState
  private selectedId = 0
  private selectedOp: Op | '' = ''
  private result: 'success' | 'fail' | '' = ''
  private showAnswer = false
  private showDifficulty = false
  private lastOutcome: 'success' | 'fail' | '' = ''
  private streakAtDealStart = 0
  private hits: Array<{ rect: Rect; hit: Hit }> = []
  onSettings?: () => void

  constructor(puzzle: Puzzle, filter: DealFilter = 'easy') {
    this.puzzle = puzzle
    this.filter = filter
    this.state = startGame(puzzle.nums)
    this.beginDealtRound()
  }

  static deal(excludeId?: string, filter: DealFilter = 'easy'): PlayScene {
    return new PlayScene(dealPuzzle(excludeId, filter), filter)
  }

  reset() {
    this.state = startGame(this.puzzle.nums)
    this.selectedId = 0
    this.selectedOp = ''
    this.result = ''
    this.showAnswer = false
    this.showDifficulty = false
  }

  nextPuzzle() {
    this.puzzle = dealPuzzle(this.puzzle.id, this.filter)
    this.beginDealtRound()
    this.reset()
  }

  private beginDealtRound() {
    this.lastOutcome = ''
    this.streakAtDealStart = loadStats().streak
  }

  tap(x: number, y: number) {
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (this.showDifficulty && (!found || (found.hit.kind !== 'set-filter' && found.hit.kind !== 'difficulty'))) {
      this.showDifficulty = false
      if (!found) {
        return
      }
    }
    if (!found) {
      return
    }
    const action = found.hit
    if (this.result) {
      if (action.kind === 'dialog-restart') {
        this.reset()
      }
      if (action.kind === 'dialog-next') {
        this.nextPuzzle()
      }
      return
    }
    if (action.kind === 'card') {
      this.onCard(action.id)
      return
    }
    if (action.kind === 'op') {
      this.onOp(action.op)
      return
    }
    if (action.kind === 'restart') {
      this.reset()
      return
    }
    if (action.kind === 'next') {
      this.nextPuzzle()
      return
    }
    if (action.kind === 'answer') {
      this.showAnswer = !this.showAnswer
      return
    }
    if (action.kind === 'difficulty') {
      this.showDifficulty = !this.showDifficulty
      return
    }
    if (action.kind === 'set-filter') {
      this.showDifficulty = false
      if (action.filter === this.filter) {
        return
      }
      this.filter = action.filter
      this.puzzle = dealPuzzle(this.puzzle.id, this.filter)
      this.beginDealtRound()
      this.reset()
      return
    }
    if (action.kind === 'settings') {
      this.onSettings?.()
    }
  }

  private onCard(id: number) {
    if (!this.selectedId) {
      this.selectedId = id
      return
    }
    if (id === this.selectedId) {
      this.selectedId = 0
      return
    }
    if (!this.selectedOp) {
      this.selectedId = id
      return
    }
    const merged = merge(this.state, this.selectedId, this.selectedOp, id)
    if (!merged.ok) {
      wx.showToast({
        title: merged.reason === 'div0' ? '不能除以 0' : '请选择两张不同的牌',
        icon: 'none',
      })
      return
    }
    this.state = merged.state
    this.selectedOp = ''
    const end = outcome(this.state)
    if (end === 'success' || end === 'fail') {
      applyDealOutcome(end, this.lastOutcome, this.streakAtDealStart)
      this.lastOutcome = end
    }
    this.result = end === 'playing' ? '' : end
    this.selectedId = end === 'playing' ? merged.state.cards[merged.state.cards.length - 1].id : 0
  }

  private onOp(op: Op) {
    if (this.selectedOp === op) {
      this.selectedOp = ''
      return
    }
    if (!this.selectedId) {
      wx.showToast({ title: '请先点选一张牌', icon: 'none' })
      return
    }
    this.selectedOp = op
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.hits = []
    ctx.fillStyle = Color.bg
    ctx.fillRect(0, 0, width, height)

    text(ctx, `题目 ${this.puzzle.id}`, width / 2, 36, 14, Color.muted)

    const topY = 72
    const gap = 16
    const cardW = Math.min(120, (width - 48 - gap) / 2)
    const cardH = cardW * (88 / 63)
    const fontSize = cardW > 90 ? 32 : 26
    const slots = slotRects(width, topY, cardW, cardH, gap)
    this.state.cards.forEach((card) => {
      const rect = slots[card.slot]
      fillRound(ctx, rect, Color.paper, 14, true)
      if (card.id === this.selectedId) {
        strokeRound(ctx, rect, Color.gold, 14, 4)
      }
      text(ctx, formatFraction(card.value), rect.x + rect.w / 2, rect.y + rect.h / 2, fontSize, Color.coral)
      this.hits.push({ rect, hit: { kind: 'card', id: card.id } })
    })

    const opY = slots[2].y + slots[2].h + 36
    const opGap = 10
    const opW = (width - 32 - opGap * 3) / 4
    OPS.forEach((op, index) => {
      const rect = { x: 16 + index * (opW + opGap), y: opY, w: opW, h: 52 }
      fillRound(ctx, rect, this.selectedOp === op ? '#FFF4C4' : Color.paper, 12, true)
      if (this.selectedOp === op) {
        strokeRound(ctx, rect, Color.gold, 12, 3)
      }
      text(ctx, op, rect.x + rect.w / 2, rect.y + rect.h / 2, 24, Color.ink)
      this.hits.push({ rect, hit: { kind: 'op', op } })
    })

    const actionY = opY + 72
    const actionW = (width - 32 - 8) / 2
    const actions: Array<{ label: string; kind: Hit['kind'] }> = [
      { label: '重开本局', kind: 'restart' },
      { label: '下一局', kind: 'next' },
    ]
    actions.forEach((action, index) => {
      const rect = { x: 16 + index * (actionW + 8), y: actionY, w: actionW, h: 44 }
      button(ctx, rect, action.label, 'plain')
      this.hits.push({ rect, hit: { kind: action.kind } as Hit })
    })

    const barY = height - 68
    const answer = { x: 16, y: barY, w: 100, h: 44 }
    button(ctx, answer, '查看答案', this.showAnswer ? 'ghost' : 'plain')
    this.hits.push({ rect: answer, hit: { kind: 'answer' } })
    if (this.showAnswer) {
      text(ctx, this.puzzle.expression, 16, answer.y - 22, 16, Color.ink, 'left')
    }

    const current = FILTERS.find((item) => item.filter === this.filter)
    const difficulty = { x: (width - 100) / 2, y: barY, w: 100, h: 44 }
    button(ctx, difficulty, current ? current.label : '难度', this.showDifficulty ? 'ghost' : 'plain')
    this.hits.push({ rect: difficulty, hit: { kind: 'difficulty' } })
    if (this.showDifficulty) {
      const menuHits: Array<{ rect: Rect; hit: Hit }> = []
      const rowH = 40
      const gap = 4
      FILTERS.forEach((item, index) => {
        const fromBottom = FILTERS.length - index
        const rect = {
          x: difficulty.x,
          y: difficulty.y - fromBottom * (rowH + gap),
          w: difficulty.w,
          h: rowH,
        }
        button(ctx, rect, item.label, item.filter === this.filter ? 'ghost' : 'plain')
        menuHits.push({ rect, hit: { kind: 'set-filter', filter: item.filter } })
      })
      this.hits = [...menuHits, ...this.hits]
    }

    const settings = { x: width - 16 - 88, y: barY, w: 88, h: 44 }
    fillRound(ctx, settings, Color.paper, 12, true)
    drawSettingsHit(ctx, settings, Color.ink)
    this.hits.push({ rect: settings, hit: { kind: 'settings' } })

    if (!this.result) {
      return
    }
    this.hits = []
    ctx.fillStyle = Color.mask
    ctx.fillRect(0, 0, width, height)
    const dialog = { x: 32, y: height / 2 - 120, w: width - 64, h: 240 }
    fillRound(ctx, dialog, Color.paper, 20, true)
    text(ctx, this.result === 'success' ? '成功' : '差一点', width / 2, dialog.y + 48, 26, Color.coral)
    text(
      ctx,
      this.result === 'success' ? '正好 24' : '最后一张不是 24',
      width / 2,
      dialog.y + 84,
      14,
      Color.muted,
    )
    if (this.result === 'fail') {
      const restart = { x: dialog.x + 24, y: dialog.y + 124, w: dialog.w - 48, h: 44 }
      button(ctx, restart, '重开本局', 'ghost')
      this.hits.push({ rect: restart, hit: { kind: 'dialog-restart' } })
    }
    const next = {
      x: dialog.x + 24,
      y: dialog.y + (this.result === 'fail' ? 180 : 140),
      w: dialog.w - 48,
      h: 44,
    }
    button(ctx, next, '下一局', 'primary')
    this.hits.push({ rect: next, hit: { kind: 'dialog-next' } })
  }
}

function dealPuzzle(excludeId?: string, filter: DealFilter = 'easy'): Puzzle {
  const puzzle = pickPuzzle(loadPlayedIds(), excludeId, Math.random, filter)
  addPlayedId(puzzle.id)
  recordDeal()
  return puzzle
}

function slotRects(
  width: number,
  topY: number,
  cardW: number,
  cardH: number,
  gap: number,
): Rect[] {
  const startX = (width - (2 * cardW + gap)) / 2
  return [0, 1, 2, 3].map((slot) => ({
    x: startX + (slot % 2) * (cardW + gap),
    y: topY + Math.floor(slot / 2) * (cardH + gap),
    w: cardW,
    h: cardH,
  }))
}
