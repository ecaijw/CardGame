import { formatFraction, type Fraction, type Op } from '../game/fraction'
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

const SELECT_MS = 180
const SOURCE_FADE_MS = 280
const OP_FLASH_MS = 180
const DEAL_CARD_MS = 320
const MERGE_MS = DEAL_CARD_MS
const RESULT_POP_MS = MERGE_MS
const FADE_OUT_MS = 160
const SETTLE_MOVE_MS = 560
const SETTLE_MS = 780
const DIALOG_IN_MS = 220
const OP_PULSE_MS = 160
const OP_SHAKE_MS = 360

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

type Face = { slot: number; value: Fraction }

type Motion =
  | { kind: 'idle' }
  | { kind: 'dealing'; at: number; fadeFrom?: Face[] }
  | {
      kind: 'merging'
      at: number
      op: Op
      source: Face
      dest: Face
      resultId: number
    }
  | { kind: 'settling'; at: number; end: 'success' | 'fail'; slot: number }

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
  private motion: Motion = { kind: 'idle' }
  private dialogAt = 0
  private selectAt = 0
  private opPulseAt = 0
  private opShake: { op: Op; at: number } | null = null
  onSettings?: () => void

  constructor(puzzle: Puzzle, filter: DealFilter = 'easy') {
    this.puzzle = puzzle
    this.filter = filter
    this.state = startGame(puzzle.nums)
    this.beginDealtRound()
    this.startDeal()
  }

  static deal(excludeId?: string, filter: DealFilter = 'easy'): PlayScene {
    return new PlayScene(dealPuzzle(excludeId, filter), filter)
  }

  reset() {
    const fromDialog = Boolean(this.result)
    const fadeFrom = fromDialog
      ? undefined
      : this.state.cards.map((card) => ({
          slot: card.slot,
          value: { n: card.value.n, d: card.value.d },
        }))
    this.state = startGame(this.puzzle.nums)
    this.selectedId = 0
    this.selectedOp = ''
    this.result = ''
    this.showAnswer = false
    this.showDifficulty = false
    this.dialogAt = 0
    this.startDeal(fadeFrom)
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

  private startDeal(fadeFrom?: Face[]) {
    this.motion = {
      kind: 'dealing',
      at: now(),
      fadeFrom: fadeFrom && fadeFrom.length ? fadeFrom : undefined,
    }
  }

  private busy() {
    return this.motion.kind !== 'idle'
  }

  private dialogOpen() {
    return Boolean(this.result) && this.dialogAt > 0 && this.motion.kind === 'idle'
  }

  tap(x: number, y: number) {
    this.tick(now())
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
    if (this.dialogOpen()) {
      if (action.kind === 'dialog-restart') {
        this.reset()
      }
      if (action.kind === 'dialog-next') {
        this.nextPuzzle()
      }
      return
    }
    if (this.busy()) {
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
      this.selectAt = now()
      return
    }
    if (id === this.selectedId) {
      this.selectedId = 0
      return
    }
    if (!this.selectedOp) {
      this.selectedId = id
      this.selectAt = now()
      return
    }
    const source = this.state.cards.find((card) => card.id === this.selectedId)
    const dest = this.state.cards.find((card) => card.id === id)
    const op = this.selectedOp
    const merged = merge(this.state, this.selectedId, op, id)
    if (!merged.ok) {
      wx.showToast({
        title: merged.reason === 'div0' ? '不能除以 0' : '请选择两张不同的牌',
        icon: 'none',
      })
      return
    }
    const resultCard = merged.state.cards[merged.state.cards.length - 1]
    this.state = merged.state
    this.selectedOp = ''
    const end = outcome(this.state)
    if (end === 'success' || end === 'fail') {
      applyDealOutcome(end, this.lastOutcome, this.streakAtDealStart)
      this.lastOutcome = end
    }
    this.result = end === 'playing' ? '' : end
    if (this.result) {
      this.showDifficulty = false
    }
    this.selectedId = end === 'playing' ? resultCard.id : 0
    this.selectAt = now()
    this.motion = {
      kind: 'merging',
      at: now(),
      op,
      source: source
        ? { slot: source.slot, value: { n: source.value.n, d: source.value.d } }
        : { slot: 0, value: { n: 0, d: 1 } },
      dest: dest
        ? { slot: dest.slot, value: { n: dest.value.n, d: dest.value.d } }
        : { slot: resultCard.slot, value: { n: 0, d: 1 } },
      resultId: resultCard.id,
    }
  }

  private onOp(op: Op) {
    if (this.selectedOp === op) {
      this.selectedOp = ''
      return
    }
    if (!this.selectedId) {
      this.opShake = { op, at: now() }
      wx.showToast({ title: '请先点选一张牌', icon: 'none' })
      return
    }
    this.selectedOp = op
    this.opPulseAt = now()
  }

  private tick(t: number) {
    const motion = this.motion
    if (motion.kind === 'dealing' && t - motion.at >= dealDuration(motion.fadeFrom)) {
      this.motion = { kind: 'idle' }
      return
    }
    if (motion.kind === 'merging' && t - motion.at >= MERGE_MS) {
      if (this.result === 'success' || this.result === 'fail') {
        const last = this.state.cards[0]
        this.motion = {
          kind: 'settling',
          at: t,
          end: this.result,
          slot: last ? last.slot : motion.dest.slot,
        }
        return
      }
      this.motion = { kind: 'idle' }
      return
    }
    if (motion.kind === 'settling') {
      const wait = motion.end === 'fail' ? SETTLE_MOVE_MS : SETTLE_MS
      if (t - motion.at >= wait) {
        this.motion = { kind: 'idle' }
        this.dialogAt = t
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const t = now()
    this.tick(t)
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
    this.drawBoard(ctx, slots, fontSize, t)

    const opY = slots[2].y + slots[2].h + 36
    const opGap = 10
    const opW = (width - 32 - opGap * 3) / 4
    OPS.forEach((op, index) => {
      const rect = { x: 16 + index * (opW + opGap), y: opY, w: opW, h: 52 }
      this.drawOp(ctx, rect, op, t)
      if (!this.busy() && !this.dialogOpen()) {
        this.hits.push({ rect, hit: { kind: 'op', op } })
      }
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
      if (!this.busy() && !this.dialogOpen()) {
        this.hits.push({ rect, hit: { kind: action.kind } as Hit })
      }
    })

    const barY = height - 68
    const answer = { x: 16, y: barY, w: 100, h: 44 }
    button(ctx, answer, '查看答案', this.showAnswer ? 'ghost' : 'plain')
    if (!this.busy() && !this.dialogOpen()) {
      this.hits.push({ rect: answer, hit: { kind: 'answer' } })
    }
    if (this.showAnswer) {
      text(ctx, this.puzzle.expression, 16, answer.y - 22, 16, Color.ink, 'left')
    }

    const current = FILTERS.find((item) => item.filter === this.filter)
    const difficulty = { x: (width - 100) / 2, y: barY, w: 100, h: 44 }
    button(ctx, difficulty, current ? current.label : '难度', this.showDifficulty ? 'ghost' : 'plain')
    if (!this.busy() && !this.dialogOpen()) {
      this.hits.push({ rect: difficulty, hit: { kind: 'difficulty' } })
    }
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
    if (!this.busy() && !this.dialogOpen()) {
      this.hits.push({ rect: settings, hit: { kind: 'settings' } })
    }

    if (this.dialogOpen()) {
      this.drawDialog(ctx, width, height, t, opY, slots, fontSize)
    }
  }

  private drawBoard(ctx: CanvasRenderingContext2D, slots: Rect[], fontSize: number, t: number) {
    const motion = this.motion
    if (motion.kind === 'dealing' && motion.fadeFrom) {
      const p = clamp01((t - motion.at) / FADE_OUT_MS)
      if (p < 1) {
        motion.fadeFrom.forEach((face) => {
          drawPlayCard(ctx, {
            rect: slots[face.slot],
            label: formatFraction(face.value),
            fontSize,
            scale: 1 - 0.06 * p,
          })
        })
      }
    }

    this.state.cards.forEach((card) => {
      if (this.dialogOpen()) {
        return
      }
      const rect = slots[card.slot]
      const look = this.cardLook(card.id, card.slot, slots, t)
      if (!look) {
        return
      }
      drawPlayCard(ctx, {
        rect,
        label: formatFraction(card.value),
        fontSize,
        ...look,
      })
      if (!this.busy()) {
        this.hits.push({ rect, hit: { kind: 'card', id: card.id } })
      }
    })

    if (motion.kind === 'merging') {
      const elapsed = t - motion.at
      if (elapsed < SOURCE_FADE_MS) {
        const p = easeIn(elapsed / SOURCE_FADE_MS)
        drawPlayCard(ctx, {
          rect: slots[motion.source.slot],
          label: formatFraction(motion.source.value),
          fontSize,
          scale: 1 - 0.12 * p,
        })
      }
      if (elapsed < OP_FLASH_MS) {
        const src = slots[motion.source.slot]
        const dst = slots[motion.dest.slot]
        text(
          ctx,
          motion.op,
          (src.x + src.w / 2 + dst.x + dst.w / 2) / 2,
          (src.y + src.h / 2 + dst.y + dst.h / 2) / 2,
          34,
          Color.gold,
        )
      }
    }

    if (motion.kind === 'settling' && motion.end === 'success') {
      const look = this.cardLook(this.state.cards[0]?.id ?? 0, motion.slot, slots, t)
      const rect = slots[motion.slot]
      drawSuccessBurst(
        ctx,
        rect.x + rect.w / 2 + (look?.dx ?? 0),
        rect.y + rect.h / 2 + (look?.dy ?? 0),
        rect,
        (t - motion.at) / SETTLE_MS,
      )
    }
  }

  private cardLook(
    id: number,
    slot: number,
    slots: Rect[],
    t: number,
  ): {
    scale?: number
    alpha?: number
    dx?: number
    dy?: number
    selected?: boolean
    glow?: number
    numberScale?: number
  } | null {
    const motion = this.motion
    if (motion.kind === 'dealing') {
      const local = (t - motion.at - (motion.fadeFrom ? FADE_OUT_MS : 0)) / DEAL_CARD_MS
      if (local < 0) {
        return null
      }
      const expand = dealExpand(local)
      return { scale: expand.scale }
    }
    if (motion.kind === 'merging') {
      const elapsed = t - motion.at
      if (id === motion.resultId) {
        const selected = id === this.selectedId
        const cardEnd = selected ? 1.04 : 1
        const p = elapsed / RESULT_POP_MS
        return {
          scale: popScale(p, cardEnd),
          numberScale: 0.8 + 0.2 * easeOut(p),
          selected,
        }
      }
    }
    const last = this.state.cards[0]
    const showLastCentered =
      Boolean(this.result) && last && last.slot === slot && last.id === id && this.state.cards.length === 1
    if (showLastCentered && (motion.kind === 'settling' || this.dialogOpen())) {
      const delta = centerDelta(slots, slot)
      const p = motion.kind === 'settling' ? easeOut((t - motion.at) / SETTLE_MOVE_MS) : 1
      const success = this.result === 'success'
      return {
        dx: delta.dx * p,
        dy: delta.dy * p,
        selected: success,
        glow: success ? 0.45 : 0,
      }
    }
    if (id === this.selectedId) {
      const p = easeOut((t - this.selectAt) / SELECT_MS)
      return { scale: 1 + 0.04 * p, selected: true, numberScale: 1 }
    }
    return {}
  }

  private drawOp(ctx: CanvasRenderingContext2D, rect: Rect, op: Op, t: number) {
    let dx = 0
    let scale = 1
    if (this.opShake && this.opShake.op === op) {
      const p = clamp01((t - this.opShake.at) / OP_SHAKE_MS)
      dx = Math.sin(p * Math.PI * 4) * 3 * (1 - p)
      if (p >= 1) {
        this.opShake = null
      }
    }
    if (this.selectedOp === op) {
      const p = easeOut((t - this.opPulseAt) / OP_PULSE_MS)
      scale = 0.98 + 0.02 * p
    }
    ctx.save()
    ctx.translate(rect.x + rect.w / 2 + dx, rect.y + rect.h / 2)
    ctx.scale(scale, scale)
    const local = { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h }
    fillRound(ctx, local, this.selectedOp === op ? '#FFF4C4' : Color.paper, 12, true)
    if (this.selectedOp === op) {
      strokeRound(ctx, local, Color.gold, 12, 3)
    }
    text(ctx, op, 0, 0, 24, Color.ink)
    ctx.restore()
  }

  private drawDialog(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
    opY: number,
    slots: Rect[],
    fontSize: number,
  ) {
    this.hits = []
    ctx.fillStyle = Color.mask
    ctx.fillRect(0, 0, width, height)
    const last = this.state.cards[0]
    if (last) {
      const look = this.cardLook(last.id, last.slot, slots, t)
      if (look) {
        drawPlayCard(ctx, {
          rect: slots[last.slot],
          label: formatFraction(last.value),
          fontSize,
          ...look,
        })
      }
    }
    const p = easeOut((t - this.dialogAt) / DIALOG_IN_MS)
    const scale = 0.97 + 0.03 * p
    const dialog = { x: 32, y: opY, w: width - 64, h: 240 }
    ctx.save()
    ctx.translate(width / 2, dialog.y + dialog.h / 2)
    ctx.scale(scale, scale)
    ctx.translate(-width / 2, -(dialog.y + dialog.h / 2))
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
    ctx.restore()
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

function dealDuration(fadeFrom?: Face[]) {
  return (fadeFrom ? FADE_OUT_MS : 0) + DEAL_CARD_MS
}

function now() {
  return Date.now()
}

function clamp01(value: number) {
  if (value <= 0) {
    return 0
  }
  if (value >= 1) {
    return 1
  }
  return value
}

function easeOut(value: number) {
  const t = clamp01(value)
  return 1 - (1 - t) * (1 - t) * (1 - t)
}

function easeIn(value: number) {
  const t = clamp01(value)
  return t * t
}

function easeInOut(value: number) {
  const t = clamp01(value)
  return 0.5 - 0.5 * Math.cos(Math.PI * t)
}

function centerDelta(slots: Rect[], slot: number): { dx: number; dy: number } {
  const rect = slots[slot]
  const left = slots[0].x
  const top = slots[0].y
  const right = slots[1].x + slots[1].w
  const bottom = slots[2].y + slots[2].h
  return {
    dx: (left + right) / 2 - (rect.x + rect.w / 2),
    dy: (top + bottom) / 2 - (rect.y + rect.h / 2),
  }
}

function dealExpand(progress: number): { scale: number } {
  return { scale: 0.96 + 0.04 * easeOut(progress) }
}

function popScale(progress: number, end = 1) {
  return 0.94 + (end - 0.94) * easeInOut(progress)
}

function drawPlayCard(
  ctx: CanvasRenderingContext2D,
  look: {
    rect: Rect
    label: string
    fontSize: number
    scale?: number
    alpha?: number
    dx?: number
    dy?: number
    selected?: boolean
    glow?: number
    numberScale?: number
  },
) {
  const alpha = look.alpha ?? 1
  if (alpha <= 0.02) {
    return
  }
  const scale = look.scale ?? 1
  const rect = look.rect
  const cx = rect.x + rect.w / 2 + (look.dx ?? 0)
  const cy = rect.y + rect.h / 2 + (look.dy ?? 0)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  const local = { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h }
  fillRound(ctx, local, Color.paper, 14, true)
  const glow = look.glow ?? 0
  if (look.selected || glow > 0) {
    strokeRound(ctx, local, Color.gold, 14, 4 + glow * 4)
  }
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = alpha
  const numberScale = look.numberScale ?? 1 + (scale - 1) * 3
  text(ctx, look.label, cx, cy, look.fontSize * numberScale, Color.coral)
  ctx.restore()
}

function drawSuccessBurst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rect: Rect,
  progress: number,
) {
  const p = clamp01(progress)
  const fade = p < 0.22 ? p / 0.22 : 1 - (p - 0.22) / 0.78
  const reach = Math.max(rect.w, rect.h) * 0.78
  ctx.save()
  ctx.globalAlpha = 0.5 * clamp01(fade)
  ctx.strokeStyle = Color.gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, reach * (0.28 + 0.72 * easeOut(p)), 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3
    const dist = reach * easeOut(p)
    const r = 5.5 * (1 - p * 0.35)
    ctx.globalAlpha = 0.9 * clamp01(fade)
    ctx.fillStyle = Color.gold
    ctx.beginPath()
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
