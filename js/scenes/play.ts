import { formatFraction, type Op } from '../game/fraction'
import {
  merge,
  outcome,
  startGame,
  undo,
  type GameState,
} from '../game/merge'
import { FIXTURES, nextIndex } from '../game/puzzles.fixture'
import {
  Color,
  button,
  fillRound,
  hit,
  strokeRound,
  text,
  type Rect,
} from '../ui'

const OPS: Op[] = ['+', '−', '×', '÷']

type Hit =
  | { kind: 'card'; id: number }
  | { kind: 'op'; op: Op }
  | { kind: 'undo' }
  | { kind: 'restart' }
  | { kind: 'next' }
  | { kind: 'dialog-restart' }
  | { kind: 'dialog-next' }

export class PlayScene {
  puzzleIndex: number
  private state: GameState
  private selectedId = 0
  private selectedOp: Op | '' = ''
  private result: 'success' | 'fail' | '' = ''
  private hits: Array<{ rect: Rect; hit: Hit }> = []

  constructor(puzzleIndex: number) {
    this.puzzleIndex = puzzleIndex
    this.state = startGame(FIXTURES[puzzleIndex].nums)
  }

  reset() {
    this.state = startGame(FIXTURES[this.puzzleIndex].nums)
    this.selectedId = 0
    this.selectedOp = ''
    this.result = ''
  }

  nextPuzzle() {
    this.puzzleIndex = nextIndex(this.puzzleIndex)
    this.reset()
  }

  tap(x: number, y: number) {
    const found = this.hits.find((item) => hit(item.rect, x, y))
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
    if (action.kind === 'undo') {
      if (this.state.history.length === 0) {
        return
      }
      this.state = undo(this.state)
      this.selectedId = 0
      this.selectedOp = ''
      return
    }
    if (action.kind === 'restart') {
      this.reset()
      return
    }
    if (action.kind === 'next') {
      this.nextPuzzle()
    }
  }

  private onCard(id: number) {
    if (!this.selectedId) {
      this.selectedId = id
      return
    }
    if (!this.selectedOp) {
      this.selectedId = id === this.selectedId ? 0 : id
      return
    }
    if (id === this.selectedId) {
      this.selectedId = 0
      this.selectedOp = ''
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
    this.selectedId = 0
    this.selectedOp = ''
    const end = outcome(this.state)
    this.result = end === 'playing' ? '' : end
  }

  private onOp(op: Op) {
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

    text(ctx, `题目 ${FIXTURES[this.puzzleIndex].id}`, width / 2, 36, 14, Color.muted)

    const count = this.state.cards.length
    const cardW = Math.min(78, (width - 48) / Math.max(count, 1) - 10)
    const cardH = cardW * (88 / 63)
    const totalW = count * cardW + (count - 1) * 12
    let x = (width - totalW) / 2
    const y = 90
    this.state.cards.forEach((card) => {
      const rect = { x, y, w: cardW, h: cardH }
      fillRound(ctx, rect, Color.paper, 12, true)
      if (card.id === this.selectedId) {
        strokeRound(ctx, rect, Color.gold, 12, 4)
      }
      text(ctx, formatFraction(card.value), x + cardW / 2, y + cardH / 2, cardW > 60 ? 26 : 20, Color.coral)
      this.hits.push({ rect, hit: { kind: 'card', id: card.id } })
      x += cardW + 12
    })

    const opY = y + cardH + 48
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
    const actionW = (width - 32 - 16) / 3
    const canUndo = this.state.history.length > 0 && !this.result
    const actions: Array<{ label: string; kind: Hit['kind']; disabled?: boolean }> = [
      { label: '撤销', kind: 'undo', disabled: !canUndo },
      { label: '重开本局', kind: 'restart' },
      { label: '下一局', kind: 'next' },
    ]
    actions.forEach((action, index) => {
      const rect = { x: 16 + index * (actionW + 8), y: actionY, w: actionW, h: 44 }
      button(ctx, rect, action.label, action.disabled ? 'disabled' : 'plain')
      if (!action.disabled) {
        this.hits.push({ rect, hit: { kind: action.kind } as Hit })
      }
    })

    if (!this.result) {
      return
    }
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
