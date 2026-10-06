import { getIcon } from '../art'
import { playSfx } from '../audio/audio-manager'
import { formatFraction, type Fraction, type Op } from '../game/fraction'
import {
  merge,
  outcome,
  startGame,
  type GameState,
} from '../game/merge'
import { pickPuzzle, type DealFilter, type Puzzle } from '../game/puzzles'
import { addPlayedId, loadPlayedIds } from '../played'
import { applyDealOutcome, loadDealFilter, loadIncludeUnsolvable, loadStats, recordDeal, saveDealFilter, saveIncludeUnsolvable, type GameStats } from '../settings'
import {
  Color,
  Menu,
  capsuleBottom,
  bottomBarPad,
  drawDialogTitle,
  drawMenuBackground,
  fillRound,
  hit,
  drawSegmentBar,
  iconLabelButton,
  menuButton,
  menuInk,
  paintMenuChrome,
  withButtonScale,
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
const FLY_MS = 220
const DEAL_CARD_MS = 320
const RESULT_POP_MS = DEAL_CARD_MS
const MERGE_MS = FLY_MS + RESULT_POP_MS
const FADE_OUT_MS = 160
const SETTLE_MOVE_MS = 560
const SETTLE_MS = 780
const DIALOG_IN_MS = 220
const OP_PULSE_MS = 160
const OP_SHAKE_MS = 360
const PRESS_MS = 90
const PRESS_SCALE = 0.85
const HINT_MS = 1800

type Hit =
  | { kind: 'card'; id: number }
  | { kind: 'op'; op: Op }
  | { kind: 'restart' }
  | { kind: 'next' }
  | { kind: 'answer' }
  | { kind: 'difficulty' }
  | { kind: 'set-filter'; filter: DealFilter }
  | { kind: 'toggle-unsolvable' }
  | { kind: 'declare-unsolvable' }
  | { kind: 'notice-close' }
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
  private includeUnsolvable = false
  private unsolvableNotice = false
  private noticeAt = 0
  private wrongUnsolvableCall = false
  private lastOutcome: 'success' | 'fail' | '' = ''
  private stats: GameStats = loadStats()
  private streakAtDealStart = 0
  private hits: Array<{ rect: Rect; hit: Hit }> = []
  private motion: Motion = { kind: 'idle' }
  private dialogAt = 0
  private selectAt = 0
  private opPulseAt = 0
  private opShake: { op: Op; at: number } | null = null
  private press: { key: string; down: boolean; at: number } | null = null
  private queuedMerge: { op: Op; destId: number } | null = null
  private hint = ''
  private hintAt = 0
  onSettings?: () => void

  constructor(puzzle: Puzzle, filter: DealFilter = 'easy', includeUnsolvable = false) {
    this.puzzle = puzzle
    this.filter = filter
    this.includeUnsolvable = includeUnsolvable
    this.state = startGame(puzzle.nums)
    this.beginDealtRound()
    this.startDeal()
  }

  static deal(excludeId?: string): PlayScene {
    const filter = loadDealFilter()
    const includeUnsolvable = loadIncludeUnsolvable()
    return new PlayScene(dealPuzzle(excludeId, filter, includeUnsolvable), filter, includeUnsolvable)
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
    this.queuedMerge = null
    this.result = ''
    this.showAnswer = false
    this.showDifficulty = false
    this.unsolvableNotice = false
    this.wrongUnsolvableCall = false
    this.hint = ''
    this.dialogAt = 0
    this.startDeal(fadeFrom)
  }

  nextPuzzle() {
    this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
    this.beginDealtRound()
    this.reset()
  }

  private beginDealtRound() {
    this.lastOutcome = ''
    this.stats = loadStats()
    this.streakAtDealStart = this.stats.streak
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

  private canInputNext() {
    return !this.dialogOpen() && !this.result && (this.motion.kind === 'idle' || this.motion.kind === 'merging')
  }

  private dialogOpen() {
    return Boolean(this.result) && this.dialogAt > 0 && this.motion.kind === 'idle'
  }

  pressDown(x: number, y: number) {
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (!found || found.hit.kind === 'op' || found.hit.kind === 'card') {
      return
    }
    this.press = { key: pressKey(found.hit), down: true, at: now() }
  }

  pressUp() {
    if (this.press && this.press.down) {
      this.press = { key: this.press.key, down: false, at: now() }
    }
  }

  private pressScale(key: string, t: number) {
    if (!this.press || this.press.key !== key) {
      return 1
    }
    const p = easeOut((t - this.press.at) / PRESS_MS)
    if (this.press.down) {
      return 1 - (1 - PRESS_SCALE) * p
    }
    return PRESS_SCALE + (1 - PRESS_SCALE) * p
  }

  tap(x: number, y: number) {
    this.tick(now())
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (this.unsolvableNotice) {
      if (found?.hit.kind === 'notice-close') {
        playSfx('tap')
        this.unsolvableNotice = false
      }
      return
    }
    if (this.showDifficulty && (!found || (found.hit.kind !== 'set-filter' && found.hit.kind !== 'difficulty' && found.hit.kind !== 'toggle-unsolvable'))) {
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
        playSfx('next')
        this.reset()
      }
      if (action.kind === 'dialog-next') {
        playSfx('next')
        this.nextPuzzle()
      }
      return
    }
    if (this.busy()) {
      if (this.canInputNext()) {
        if (action.kind === 'op') {
          this.onOp(action.op)
        }
        if (action.kind === 'card') {
          this.queueOrSelectCard(action.id)
        }
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
      playSfx('next')
      this.reset()
      return
    }
    if (action.kind === 'next') {
      playSfx('next')
      this.nextPuzzle()
      return
    }
    if (action.kind === 'answer') {
      playSfx('tap')
      this.showAnswer = !this.showAnswer
      return
    }
    if (action.kind === 'difficulty') {
      playSfx('tap')
      this.showDifficulty = !this.showDifficulty
      return
    }
    if (action.kind === 'set-filter') {
      playSfx('tap')
      this.showDifficulty = false
      if (action.filter === this.filter) {
        return
      }
      this.filter = action.filter
      saveDealFilter(this.filter)
      this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
      this.beginDealtRound()
      this.reset()
      return
    }
    if (action.kind === 'toggle-unsolvable') {
      playSfx('tap')
      this.showDifficulty = false
      this.includeUnsolvable = !this.includeUnsolvable
      saveIncludeUnsolvable(this.includeUnsolvable)
      if (this.includeUnsolvable) {
        this.unsolvableNotice = true
        this.noticeAt = now()
      }
      return
    }
    if (action.kind === 'declare-unsolvable') {
      this.declareUnsolvable()
      return
    }
    if (action.kind === 'settings') {
      playSfx('tap')
      this.onSettings?.()
    }
  }

  private onCard(id: number) {
    if (!this.selectedId) {
      this.selectedId = id
      this.selectAt = now()
      playSfx('select')
      return
    }
    if (id === this.selectedId) {
      this.selectedId = 0
      playSfx('select')
      return
    }
    if (!this.selectedOp) {
      this.selectedId = id
      this.selectAt = now()
      playSfx('select')
      return
    }
    const source = this.state.cards.find((card) => card.id === this.selectedId)
    const dest = this.state.cards.find((card) => card.id === id)
    const op = this.selectedOp
    const merged = merge(this.state, this.selectedId, op, id)
    if (!merged.ok) {
      playSfx('invalid')
      this.showHint(merged.reason === 'div0' ? '不能除以 0' : '请选择两张不同的牌')
      return
    }
    const resultCard = merged.state.cards[merged.state.cards.length - 1]
    this.state = merged.state
    this.selectedOp = ''
    const end = outcome(this.state)
    if (end === 'success' || end === 'fail') {
      applyDealOutcome(end, this.lastOutcome, this.streakAtDealStart)
      this.lastOutcome = end
      this.stats = loadStats()
    }
    this.result = end === 'playing' ? '' : end
    playSfx(end === 'success' ? 'success' : end === 'fail' ? 'invalid' : 'merge')
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

  private queueOrSelectCard(id: number) {
    if (!this.selectedOp || id === this.selectedId) {
      this.onCard(id)
      this.queuedMerge = null
      return
    }
    this.queuedMerge = { op: this.selectedOp, destId: id }
  }

  private declareUnsolvable() {
    const correct = this.puzzle.difficulty === 'unsolvable'
    const end = correct ? 'success' : 'fail'
    applyDealOutcome(end, this.lastOutcome, this.streakAtDealStart)
    this.lastOutcome = end
    this.stats = loadStats()
    this.result = end
    this.wrongUnsolvableCall = !correct
    this.showDifficulty = false
    this.showAnswer = false
    this.unsolvableNotice = false
    this.selectedId = 0
    this.selectedOp = ''
    this.queuedMerge = null
    this.motion = { kind: 'idle' }
    this.dialogAt = now()
    playSfx(correct ? 'success' : 'invalid')
  }

  private showHint(message: string) {
    this.hint = message
    this.hintAt = now()
  }

  private onOp(op: Op) {
    if (this.selectedOp === op) {
      this.selectedOp = ''
      this.queuedMerge = null
      playSfx('select')
      return
    }
    if (!this.selectedId) {
      this.opShake = { op, at: now() }
      playSfx('invalid')
      this.showHint('请先点选一张牌')
      return
    }
    this.selectedOp = op
    this.opPulseAt = now()
    playSfx('select')
  }

  private tick(t: number) {
    const motion = this.motion
    if (motion.kind === 'dealing' && t - motion.at >= dealDuration(motion.fadeFrom)) {
      this.motion = { kind: 'idle' }
      return
    }
    if (motion.kind === 'merging' && t - motion.at >= MERGE_MS) {
      if (this.result === 'success' || this.result === 'fail') {
        this.queuedMerge = null
        const last = this.state.cards[0]
        this.motion = {
          kind: 'settling',
          at: t,
          end: this.result,
          slot: last ? last.slot : motion.dest.slot,
        }
        return
      }
      const queued = this.queuedMerge
      this.queuedMerge = null
      this.motion = { kind: 'idle' }
      if (queued) {
        this.selectedOp = queued.op
        this.onCard(queued.destId)
      }
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
    drawMenuBackground(ctx, width, height)

    const frame = playFrame(width)
    const minTop = Math.max(72, capsuleBottom() + 16)
    const gap = 16
    const cardW = Math.min(120, (frame.play.w - 48 - gap) / 2)
    const cardH = cardW * (88 / 63)
    const fontSize = cardW > 90 ? 32 : 26
    const opH = 56
    const belowCards = 28
    const stackH = cardH * 2 + gap + belowCards + opH
    const floorTop = height - bottomBarPad() - stackH
    const topY = frame.side ? minTop + Math.max(0, floorTop - minTop) * 0.42 : minTop
    const slots = slotRects(frame.play.x, frame.play.w, topY, cardW, cardH, gap)
    this.drawBoard(ctx, slots, fontSize, t)

    const opGap = 12
    const opW = (frame.play.w - 32 - opGap * 3) / 4
    const opY = slots[2].y + slots[2].h + belowCards
    OPS.forEach((op, index) => {
      const rect = { x: frame.play.x + 16 + index * (opW + opGap), y: opY, w: opW, h: opH }
      this.drawOp(ctx, rect, op, t)
      if (this.canInputNext()) {
        this.hits.push({ rect, hit: { kind: 'op', op } })
      }
    })

    const current = FILTERS.find((item) => item.filter === this.filter)
    const barH = 52
    const barY = frame.side ? opY : height - bottomBarPad() - barH
    const bar = frame.side
      ? { x: frame.side.x, y: barY, w: frame.side.w, h: barH }
      : { x: 20, y: barY, w: width - 40, h: barH }
    const cellW = bar.w / 3
    const answer = { x: bar.x, y: bar.y, w: cellW, h: bar.h }
    const difficulty = { x: bar.x + cellW, y: bar.y, w: cellW, h: bar.h }
    const settings = { x: bar.x + cellW * 2, y: bar.y, w: cellW, h: bar.h }
    const actionH = 44
    const actionY = barY - 12 - actionH
    const dealActions: Array<{
      label: string
      kind: Hit['kind']
      icon: 'restart' | 'next'
      x: number
    }> = [
      { label: '重试', kind: 'restart', icon: 'restart', x: answer.x },
      { label: '下一局', kind: 'next', icon: 'next', x: settings.x },
    ]
    dealActions.forEach((action) => {
      const rect = { x: action.x, y: actionY, w: cellW, h: actionH }
      withButtonScale(ctx, rect, this.pressScale(action.kind, t), () => {
        iconLabelButton(ctx, rect, action.label, 'ghost', action.icon)
      })
      if (!this.busy() && !this.dialogOpen() && !this.unsolvableNotice) {
        this.hits.push({ rect, hit: { kind: action.kind } as Hit })
      }
    })
    if (this.includeUnsolvable) {
      const noSolution = { x: difficulty.x, y: actionY, w: cellW, h: actionH }
      withButtonScale(ctx, noSolution, this.pressScale('declare-unsolvable', t), () => {
        menuButton(ctx, noSolution, '本题无解', 'ghost')
      })
      if (!this.busy() && !this.dialogOpen() && !this.unsolvableNotice) {
        this.hits.push({ rect: noSolution, hit: { kind: 'declare-unsolvable' } })
      }
    }

    drawSegmentBar(ctx, bar, [
      { label: '答案', icon: 'answer', active: this.showAnswer, scale: this.pressScale('answer', t) },
      {
        label: current ? current.label : '难度',
        icon: 'difficulty',
        active: this.showDifficulty,
        scale: this.pressScale('difficulty', t),
      },
      { label: '设置', icon: 'settings', scale: this.pressScale('settings', t) },
    ])
    if (!this.busy() && !this.dialogOpen() && !this.unsolvableNotice) {
      this.hits.push(
        { rect: answer, hit: { kind: 'answer' } },
        { rect: difficulty, hit: { kind: 'difficulty' } },
        { rect: settings, hit: { kind: 'settings' } },
      )
    }
    const hintOn = Boolean(this.hint) && t - this.hintAt < HINT_MS
    const statsRect = frame.side
      ? { x: frame.side.x, y: topY + 8, w: frame.side.w, h: actionY - topY - 16 }
      : { x: 24, y: opY + opH + 12, w: width - 48, h: actionY - (opY + opH + 20) }
    if (hintOn) {
      drawCopyCard(ctx, statsRect, this.hint, [])
    } else if (this.showAnswer) {
      if (this.puzzle.difficulty === 'unsolvable') {
        drawCopyCard(ctx, statsRect, '本题无解，无法算出24', [])
      } else {
        drawCopyCard(ctx, statsRect, this.puzzle.expression, this.puzzle.steps)
      }
    } else if (frame.side) {
      drawDealStats(ctx, statsRect, this.stats)
    }
    if (this.showDifficulty) {
      const menuHits: Array<{ rect: Rect; hit: Hit }> = []
      const rowH = 40
      const menuGap = 6
      FILTERS.forEach((item, index) => {
        const fromBottom = FILTERS.length - index
        const rect = {
          x: difficulty.x + 8,
          y: difficulty.y - fromBottom * (rowH + menuGap),
          w: difficulty.w - 16,
          h: rowH,
        }
        withButtonScale(ctx, rect, this.pressScale(`filter-${item.filter}`, t), () => {
          menuButton(ctx, rect, item.label, item.filter === this.filter ? 'blush' : 'ghost')
        })
        menuHits.push({ rect, hit: { kind: 'set-filter', filter: item.filter } })
      })
      this.hits = [...menuHits, ...this.hits]
    }
    this.drawUnsolvableToggle(ctx, difficulty, t)

    if (this.dialogOpen()) {
      this.drawDialog(ctx, width, height, t, slots, fontSize)
    }
    if (this.unsolvableNotice) {
      this.drawUnsolvableNotice(ctx, width, height, t)
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
      if (this.canInputNext()) {
        this.hits.push({ rect, hit: { kind: 'card', id: card.id } })
      }
      if (!look) {
        return
      }
      drawPlayCard(ctx, {
        rect,
        label: formatFraction(card.value),
        fontSize,
        ...look,
      })
    })

    if (motion.kind === 'merging') {
      const elapsed = t - motion.at
      if (elapsed < FLY_MS) {
        const src = slots[motion.source.slot]
        const dst = slots[motion.dest.slot]
        const p = easeOut(elapsed / FLY_MS)
        drawPlayCard(ctx, {
          rect: src,
          label: formatFraction(motion.source.value),
          fontSize,
          dx: (dst.x + dst.w / 2 - (src.x + src.w / 2)) * p,
          dy: (dst.y + dst.h / 2 - (src.y + src.h / 2)) * p,
        })
        drawPlayCard(ctx, {
          rect: dst,
          label: formatFraction(motion.dest.value),
          fontSize,
        })
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
        if (elapsed < FLY_MS) {
          return null
        }
        const selected = id === this.selectedId
        const cardEnd = selected ? 1.04 : 1
        const p = (elapsed - FLY_MS) / RESULT_POP_MS
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
    const kind = this.selectedOp === op ? 'blush' : 'ghost'
    ctx.save()
    ctx.translate(dx, 0)
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2)
    ctx.scale(scale, scale)
    ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2))
    paintMenuChrome(ctx, rect, kind, 10)
    text(ctx, op, rect.x + rect.w / 2, rect.y + rect.h / 2, 24, menuInk(kind), 'center', '700')
    ctx.restore()
  }

  private drawDialog(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
    slots: Rect[],
    fontSize: number,
  ) {
    this.hits = []
    ctx.fillStyle = Color.mask
    ctx.fillRect(0, 0, width, height)
    const keepBoard = this.state.cards.length > 1
    let anchorBottom = slots[2].y + slots[2].h
    if (keepBoard) {
      this.state.cards.forEach((card) => {
        const look = this.cardLook(card.id, card.slot, slots, t)
        if (!look) {
          return
        }
        drawPlayCard(ctx, {
          rect: slots[card.slot],
          label: formatFraction(card.value),
          fontSize,
          ...look,
        })
        anchorBottom = Math.max(anchorBottom, slots[card.slot].y + slots[card.slot].h)
      })
    } else {
      const last = this.state.cards[0]
      const look = last ? this.cardLook(last.id, last.slot, slots, t) : null
      if (last && look) {
        drawPlayCard(ctx, {
          rect: slots[last.slot],
          label: formatFraction(last.value),
          fontSize,
          ...look,
        })
        anchorBottom = slots[last.slot].y + slots[last.slot].h + (look.dy ?? 0)
      }
    }
    const p = easeOut((t - this.dialogAt) / DIALOG_IN_MS)
    const scale = 0.97 + 0.03 * p
    const fail = this.result === 'fail'
    const longFail = fail && !this.wrongUnsolvableCall && this.includeUnsolvable
    const dialogH = fail ? (longFail ? 304 : 280) : 240
    const dialogW = Math.min(400, width - 48)
    const minY = 24
    const maxY = Math.max(minY, height - 24 - dialogH)
    const belowCard = anchorBottom + 24
    let dialogY = belowCard + dialogH <= height - 24 ? belowCard : (height - dialogH) / 2
    if (keepBoard && belowCard + dialogH > height - 24) {
      dialogY = maxY
    }
    dialogY = Math.min(Math.max(dialogY, minY), maxY)
    const dialog = {
      x: (width - dialogW) / 2,
      y: dialogY,
      w: dialogW,
      h: dialogH,
    }
    const dialogCx = dialog.x + dialog.w / 2
    const dialogCy = dialog.y + dialog.h / 2
    ctx.save()
    ctx.translate(dialogCx, dialogCy)
    ctx.scale(scale, scale)
    ctx.translate(-dialogCx, -dialogCy)
    fillRound(ctx, dialog, Color.paper, 20, true)
    drawDialogTitle(
      ctx,
      this.result === 'success' ? '成功' : '失败',
      dialogCx,
      dialog.y + 48,
      26,
      this.result === 'success' ? Color.pine : Color.coral,
      getIcon(this.result === 'success' ? 'crown' : 'fist'),
    )
    if (this.result === 'success') {
      text(ctx, '太棒了，继续挑战吧！', dialogCx, dialog.y + 84, 14, Color.muted)
    } else if (this.wrongUnsolvableCall) {
      text(ctx, '太遗憾了，这个题目可以算出24。', dialogCx, dialog.y + 80, 14, Color.muted)
      text(ctx, '加油再试一试吧！', dialogCx, dialog.y + 102, 14, Color.muted)
    } else if (longFail) {
      const copySize = dialog.w < 360 ? 13 : 14
      text(ctx, '成功条件：如果有解，最后结果需要算出24。', dialogCx, dialog.y + 76, copySize, Color.muted)
      text(ctx, '如果无解，点击「本题无解」按钮。', dialogCx, dialog.y + 98, copySize, Color.muted)
      text(ctx, '加油再试一试吧！', dialogCx, dialog.y + 120, copySize, Color.muted)
    } else {
      text(ctx, '成功条件：最后结果是24。', dialogCx, dialog.y + 80, 14, Color.muted)
      text(ctx, '加油再试一试吧！', dialogCx, dialog.y + 102, 14, Color.muted)
    }
    const buttonShift = longFail ? 24 : 0
    if (fail) {
      const restart = { x: dialog.x + 24, y: dialog.y + 128 + buttonShift, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, restart, this.pressScale('dialog-restart', t), () => {
        menuButton(ctx, restart, '重开本局', 'ghost')
      })
      this.hits.push({ rect: restart, hit: { kind: 'dialog-restart' } })
    }
    const next = {
      x: dialog.x + 24,
      y: dialog.y + (fail ? 206 + buttonShift : 136),
      w: dialog.w - 48,
      h: 50,
    }
    withButtonScale(ctx, next, this.pressScale('dialog-next', t), () => {
      menuButton(ctx, next, '下一局', 'ghost')
    })
    this.hits.push({ rect: next, hit: { kind: 'dialog-next' } })
    ctx.restore()
  }

  private drawUnsolvableToggle(ctx: CanvasRenderingContext2D, difficulty: Rect, t: number) {
    if (!this.showDifficulty) {
      return
    }
    const rowH = 40
    const menuGap = 6
    const rect = {
      x: difficulty.x + 8,
      y: difficulty.y - (FILTERS.length + 1) * (rowH + menuGap),
      w: difficulty.w - 16,
      h: rowH,
    }
    withButtonScale(ctx, rect, this.pressScale('toggle-unsolvable', t), () => {
      paintMenuChrome(ctx, rect, 'ghost')
      const label = '含无解题'
      const fontSize = rect.w < 100 ? 13 : 15
      const midY = rect.y + rect.h / 2
      const cx = rect.x + rect.w / 2
      ctx.save()
      ctx.font = `600 ${fontSize}px "PingFang SC","PingFangSC-Semibold","Hiragino Sans GB","Heiti SC",sans-serif`
      const textW = ctx.measureText(label).width
      ctx.restore()
      if (this.includeUnsolvable) {
        const mark = 12
        const gap = 6
        const start = cx - (mark + gap + textW) / 2
        drawGreenCheck(ctx, start + mark / 2, midY)
        text(ctx, label, start + mark + gap, midY, fontSize, menuInk('ghost'), 'left', '600')
      } else {
        text(ctx, label, cx, midY, fontSize, menuInk('ghost'), 'center', '600')
      }
    })
    this.hits.unshift({ rect, hit: { kind: 'toggle-unsolvable' } })
  }

  private drawUnsolvableNotice(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
  ) {
    this.hits = []
    ctx.fillStyle = Color.mask
    ctx.fillRect(0, 0, width, height)
    const dialogW = Math.min(400, width - 48)
    const dialogH = 268
    const dialog = {
      x: (width - dialogW) / 2,
      y: Math.max(24, (height - dialogH) / 2),
      w: dialogW,
      h: dialogH,
    }
    const p = easeOut((t - this.noticeAt) / DIALOG_IN_MS)
    const scale = 0.97 + 0.03 * p
    const cx = dialog.x + dialog.w / 2
    const cy = dialog.y + dialog.h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    fillRound(ctx, dialog, Color.paper, 20, true)
    text(ctx, '已开启「含无解题」模式', cx, dialog.y + 48, dialogW < 340 ? 16 : 20, Color.ink, 'center', '600')
    const lines = [
      '接下来的题目中会随机出现无解题。',
      '如果你判断无法算出 24，',
      '请点击「本题无解」。',
    ]
    lines.forEach((line, index) => {
      text(ctx, line, cx, dialog.y + 96 + index * 26, 14, Color.muted)
    })
    const close = { x: dialog.x + 24, y: dialog.y + dialog.h - 74, w: dialog.w - 48, h: 50 }
    withButtonScale(ctx, close, this.pressScale('notice-close', t), () => {
      menuButton(ctx, close, '关闭', 'ghost')
    })
    this.hits.push({ rect: close, hit: { kind: 'notice-close' } })
    ctx.restore()
  }
}

function drawGreenCheck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.strokeStyle = Color.lime
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x - 5, y)
  ctx.lineTo(x - 1, y + 4)
  ctx.lineTo(x + 6, y - 4)
  ctx.stroke()
  ctx.restore()
}

function pressKey(action: Hit) {
  if (action.kind === 'set-filter') {
    return `filter-${action.filter}`
  }
  return action.kind
}

function dealPuzzle(
  excludeId?: string,
  filter: DealFilter = 'easy',
  includeUnsolvable = false,
): Puzzle {
  const puzzle = pickPuzzle(loadPlayedIds(), excludeId, Math.random, filter, includeUnsolvable)
  addPlayedId(puzzle.id)
  recordDeal()
  return puzzle
}

function drawDealStats(ctx: CanvasRenderingContext2D, rect: Rect, stats: GameStats) {
  const card = panelCard(rect)
  if (!card) {
    return
  }
  if (rect.h < 130) {
    const cx = card.x + card.w / 2
    const cy = card.y + card.h / 2
    fillRound(ctx, card, Menu.paper, 16, true)
    if (rect.h >= 52) {
      text(ctx, `连胜 ${stats.streak}`, cx, cy - 14, 16, Menu.title, 'center', '700')
      text(
        ctx,
        `总数 ${stats.deals}    成功 ${stats.wins}    失败 ${stats.losses}`,
        cx,
        cy + 16,
        14,
        Color.muted,
        'center',
        '500',
      )
      return
    }
    text(
      ctx,
      `连胜 ${stats.streak}   总数 ${stats.deals}   成功 ${stats.wins}   失败 ${stats.losses}`,
      cx,
      cy,
      14,
      Color.muted,
      'center',
      '500',
    )
    return
  }
  fillRound(ctx, card, Menu.paper, 16, true)
  text(ctx, '对局统计', card.x + 20, card.y + 28, 15, Menu.subtitle, 'left', '600')
  text(ctx, `连胜 ${stats.streak}`, card.x + card.w - 20, card.y + 28, 15, Menu.title, 'right', '700')
  const colW = (card.w - 40) / 3
  const rowY = card.y + 78
  const cols: Array<[string, number, string]> = [
    ['总数', stats.deals, '#7DB8A8'],
    ['成功', stats.wins, '#8FCB6D'],
    ['失败', stats.losses, Color.coral],
  ]
  cols.forEach(([label, value, color], index) => {
    const colX = card.x + 20 + colW * index + colW / 2
    text(ctx, String(value), colX, rowY, 26, color, 'center', '700')
    text(ctx, label, colX, rowY + 28, 13, Menu.subtitle, 'center', '500')
  })
}

function drawCopyCard(ctx: CanvasRenderingContext2D, rect: Rect, expression: string, steps: string[]) {
  const card = panelCard(rect)
  const cx = card ? card.x + card.w / 2 : rect.x + rect.w / 2
  const block = steps.length === 0 ? 0 : 28 + 22 * (steps.length - 1)
  const expressionY = card ? card.y + card.h / 2 - block / 2 : rect.y + rect.h / 2
  if (card) {
    fillRound(ctx, card, Menu.paper, 16, true)
  }
  text(ctx, expression, cx, expressionY, 22, Color.coral, 'center', '700')
  steps.forEach((step, index) => {
    text(ctx, step, cx, expressionY + 28 + index * 22, 15, Color.muted, 'center', '500')
  })
}

function panelCard(rect: Rect): Rect | null {
  if (rect.h < 72 || rect.w < 140) {
    return null
  }
  if (rect.h < 130) {
    return rect
  }
  const cardH = Math.min(160, rect.h)
  const cardW = Math.min(rect.w, 420)
  return {
    x: rect.x + (rect.w - cardW) / 2,
    y: rect.y + (rect.h - cardH) / 2,
    w: cardW,
    h: cardH,
  }
}

function playFrame(width: number): {
  play: { x: number; w: number }
  side: { x: number; w: number } | null
} {
  const playW = 400
  const sideMin = 280
  const edge = 20
  const colGap = 28
  if (width < edge + playW + colGap + sideMin + edge) {
    return { play: { x: 0, w: width }, side: null }
  }
  const play = { x: edge, w: playW }
  const sideX = play.x + play.w + colGap
  return { play, side: { x: sideX, w: width - sideX - edge } }
}

function slotRects(
  originX: number,
  columnW: number,
  topY: number,
  cardW: number,
  cardH: number,
  gap: number,
): Rect[] {
  const startX = originX + (columnW - (2 * cardW + gap)) / 2
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
