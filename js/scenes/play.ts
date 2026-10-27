import { getIcon } from '../art'
import { playSfx } from '../audio/audio-manager'
import { formatFraction, type Op } from '../game/fraction'
import {
  MERGE_MS,
  SETTLE_MOVE_MS,
  SETTLE_MS,
  cardLook,
  dealDuration,
  drawCopyCard,
  drawDealFade,
  drawMergeFlight,
  drawOp,
  drawPlayCard,
  drawSuccessBurst,
  panelCard,
  tableLayout,
  soloCopyMode,
  type Face,
  type Motion,
} from './board'
import type { GameState } from '../game/merge'
import {
  createSession,
  restartSession,
  selectCard,
  selectOp,
  type SessionState,
} from '../game/session'
import { pickPuzzle, type DealFilter, type Puzzle } from '../game/puzzles'
import {
  dialogMotion,
  dialogRect,
  openDialog,
  paintDialogButton,
} from './dialog'
import { DIFFICULTY_FILTERS, drawDifficultyMenu, isDifficultyMenuHit } from './difficulty-menu'
import { PressFeedback } from './press'
import { addPlayedId, loadPlayedIds } from '../played'
import {
  applyDealOutcome,
  clearStreak,
  loadDealFilter,
  loadIncludeUnsolvable,
  loadStats,
  recordDeal,
  saveDealFilter,
  saveIncludeUnsolvable,
  type GameStats,
} from '../settings'
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
  drawHouseButton,
  houseButtonRect,
  iconLabelButton,
  menuButton,
  paintDialogMask,
  withButtonScale,
  text,
  type Rect,
} from '../ui'

const OPS: Op[] = ['+', '−', '×', '÷']

const HINT_MS = 1800

type Hit =
  | { kind: 'card'; id: number }
  | { kind: 'op'; op: Op }
  | { kind: 'restart' }
  | { kind: 'next' }
  | { kind: 'answer' }
  | { kind: 'difficulty' }
  | { kind: 'difficulty-menu' }
  | { kind: 'set-filter'; filter: DealFilter }
  | { kind: 'toggle-unsolvable' }
  | { kind: 'declare-unsolvable' }
  | { kind: 'notice-close' }
  | { kind: 'copy-dismiss' }
  | { kind: 'dialog-restart' }
  | { kind: 'dialog-next' }
  | { kind: 'settings' }
  | { kind: 'home' }

export class PlayScene {
  puzzle: Puzzle
  filter: DealFilter
  private session: SessionState
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
  private press = new PressFeedback()
  private queuedMerge: { op: Op; destId: number } | null = null
  private hint = ''
  private hintAt = 0
  private copyAt = 0
  onSettings?: () => void
  onHome?: () => void

  constructor(puzzle: Puzzle, filter: DealFilter = 'easy', includeUnsolvable = false) {
    this.puzzle = puzzle
    this.filter = filter
    this.includeUnsolvable = includeUnsolvable
    this.session = createSession(puzzle.nums)
    this.beginDealtRound()
    this.startDeal()
  }

  private get state(): GameState {
    return this.session.game
  }

  private get selectedId(): number {
    return this.session.selectedId
  }

  private set selectedId(id: number) {
    this.session = { ...this.session, selectedId: id }
  }

  private get selectedOp(): Op | '' {
    return this.session.selectedOp
  }

  private set selectedOp(op: Op | '') {
    this.session = { ...this.session, selectedOp: op }
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
    this.session = restartSession(this.puzzle.nums)
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
    this.clearStreakIfUnsettled()
    this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
    this.beginDealtRound()
    this.reset()
  }

  clearStreakIfUnsettled() {
    if (this.lastOutcome !== '') {
      return
    }
    clearStreak()
    this.streakAtDealStart = 0
    this.stats = loadStats()
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
    if (!found || found.hit.kind === 'op' || found.hit.kind === 'card' || found.hit.kind === 'difficulty-menu') {
      return
    }
    this.press.down(pressKey(found.hit), now())
  }

  pressUp() {
    this.press.up(now())
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
    if (found?.hit.kind === 'copy-dismiss') {
      playSfx('tap')
      this.hint = ''
      this.showAnswer = false
      return
    }
    if (this.showDifficulty && (!found || !isDifficultyMenuHit(found.hit.kind))) {
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
    if (action.kind === 'home') {
      playSfx('tap')
      this.clearStreakIfUnsettled()
      this.onHome?.()
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
      if (!this.showAnswer) {
        this.clearStreakIfUnsettled()
      }
      this.showAnswer = !this.showAnswer
      if (this.showAnswer) {
        this.copyAt = now()
      }
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
      this.clearStreakIfUnsettled()
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
    const before = this.session
    const source = before.game.cards.find((card) => card.id === before.selectedId)
    const dest = before.game.cards.find((card) => card.id === id)
    const { state, effect } = selectCard(before, id)
    this.session = state
    if (effect.kind === 'select') {
      this.selectAt = now()
      playSfx('select')
      return
    }
    if (effect.kind === 'invalid') {
      playSfx('invalid')
      this.showHint(effect.reason === 'div0' ? '不能除以 0' : '请选择两张不同的牌')
      return
    }
    if (effect.kind !== 'merge') {
      return
    }
    const end = effect.end
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
    this.selectAt = now()
    const resultCard = this.state.cards.find((card) => card.id === effect.resultId)
    this.motion = {
      kind: 'merging',
      at: now(),
      op: effect.op,
      source: source
        ? { slot: source.slot, value: { n: source.value.n, d: source.value.d } }
        : { slot: 0, value: { n: 0, d: 1 } },
      dest: dest
        ? { slot: dest.slot, value: { n: dest.value.n, d: dest.value.d } }
        : { slot: resultCard?.slot ?? 0, value: { n: 0, d: 1 } },
      resultId: effect.resultId,
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
    const { state, effect } = selectOp(this.session, op)
    this.session = state
    if (effect.kind === 'invalid') {
      this.opShake = { op, at: now() }
      playSfx('invalid')
      this.showHint('请先点选一张牌')
      return
    }
    this.queuedMerge = null
    if (effect.kind === 'select' && state.selectedOp) {
      this.opPulseAt = now()
    }
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

    const minTop = Math.max(72, capsuleBottom() + 16)
    const table = tableLayout(width, height, minTop, bottomBarPad())
    const { frame, fontSize, slots, actionY, actionH, barY, barH, copy } = table
    this.drawBoard(ctx, slots, fontSize, t)

    table.ops.forEach((rect, index) => {
      const op = OPS[index]
      this.drawOp(ctx, rect, op, t)
      if (this.canInputNext()) {
        this.hits.push({ rect, hit: { kind: 'op', op } })
      }
    })

    const current = DIFFICULTY_FILTERS.find((item) => item.filter === this.filter)
    const bar = frame.side
      ? { x: frame.side.x, y: barY, w: frame.side.w, h: barH }
      : { x: 20, y: barY, w: width - 40, h: barH }
    const cellW = bar.w / 3
    const answer = { x: bar.x, y: bar.y, w: cellW, h: bar.h }
    const difficulty = { x: bar.x + cellW, y: bar.y, w: cellW, h: bar.h }
    const settings = { x: bar.x + cellW * 2, y: bar.y, w: cellW, h: bar.h }
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
      withButtonScale(ctx, rect, this.press.scale(action.kind, t), () => {
        iconLabelButton(ctx, rect, action.label, 'ghost', action.icon)
      })
      if (!this.busy() && !this.dialogOpen() && !this.unsolvableNotice) {
        this.hits.push({ rect, hit: { kind: action.kind } as Hit })
      }
    })
    if (this.includeUnsolvable) {
      const noSolution = { x: difficulty.x, y: actionY, w: cellW, h: actionH }
      withButtonScale(ctx, noSolution, this.press.scale('declare-unsolvable', t), () => {
        menuButton(ctx, noSolution, '本题无解', 'ghost')
      })
      if (!this.busy() && !this.dialogOpen() && !this.unsolvableNotice) {
        this.hits.push({ rect: noSolution, hit: { kind: 'declare-unsolvable' } })
      }
    }

    drawSegmentBar(ctx, bar, [
      { label: '答案', icon: 'answer', active: this.showAnswer, scale: this.press.scale('answer', t) },
      {
        label: current ? current.label : '难度',
        icon: 'difficulty',
        active: this.showDifficulty,
        scale: this.press.scale('difficulty', t),
      },
      { label: '设置', icon: 'settings', scale: this.press.scale('settings', t) },
    ])
    if (!this.busy() && !this.dialogOpen() && !this.unsolvableNotice) {
      this.hits.push(
        { rect: answer, hit: { kind: 'answer' } },
        { rect: difficulty, hit: { kind: 'difficulty' } },
        { rect: settings, hit: { kind: 'settings' } },
      )
    }
    const hintOn = Boolean(this.hint) && t - this.hintAt < HINT_MS
    const copySteps =
      hintOn || this.puzzle.difficulty === 'unsolvable' || !this.puzzle.steps ? 0 : this.puzzle.steps.length
    const copyMode = soloCopyMode(copy.h, hintOn, this.showAnswer, copySteps)
    if (copyMode === 'page' && hintOn) {
      drawCopyCard(ctx, copy, this.hint, [])
    } else if (copyMode === 'page' && this.showAnswer) {
      if (this.puzzle.difficulty === 'unsolvable') {
        drawCopyCard(ctx, copy, '本题无解，无法算出24', [])
      } else {
        drawCopyCard(ctx, copy, this.puzzle.expression, this.puzzle.steps)
      }
    } else if (frame.side && !hintOn && !this.showAnswer) {
      drawDealStats(ctx, copy, this.stats)
    }
    if (this.showDifficulty) {
      this.hits = [
        ...drawDifficultyMenu(
          ctx,
          difficulty,
          this.filter,
          this.includeUnsolvable,
          true,
          (key) => this.press.scale(key, t),
          { width, height, top: minTop, bottom: bottomBarPad() },
          'up',
        ),
        ...this.hits,
      ]
    }

    if (this.dialogOpen()) {
      this.drawDialog(ctx, width, height, t, slots, fontSize)
    }
    if (this.unsolvableNotice) {
      this.drawUnsolvableNotice(ctx, width, height, t)
    }

    if (copyMode === 'dialog' && !this.dialogOpen() && !this.unsolvableNotice) {
      this.drawCopyDialog(ctx, width, height, t, hintOn)
      this.hits.push({ rect: answer, hit: { kind: 'answer' } })
    }
    const homeRect = houseButtonRect()
    drawHouseButton(ctx, homeRect, this.press.scale('home', t))
    if (!this.dialogOpen() && !this.unsolvableNotice) {
      this.hits.push({ rect: homeRect, hit: { kind: 'home' } })
    }
  }

  private look(id: number, slot: number, slots: Rect[], t: number) {
    const last = this.state.cards[0]
    return cardLook({
      id,
      slot,
      slots,
      t,
      motion: this.motion,
      selectedId: this.selectedId,
      selectAt: this.selectAt,
      settle: {
        result: this.result,
        dialogOpen: this.dialogOpen(),
        cardCount: this.state.cards.length,
        last: last ? { id: last.id, slot: last.slot } : undefined,
      },
    })
  }

  private drawBoard(ctx: CanvasRenderingContext2D, slots: Rect[], fontSize: number, t: number) {
    const motion = this.motion
    drawDealFade(ctx, slots, fontSize, t, motion)

    this.state.cards.forEach((card) => {
      if (this.dialogOpen()) {
        return
      }
      const rect = slots[card.slot]
      const look = this.look(card.id, card.slot, slots, t)
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

    drawMergeFlight(ctx, slots, fontSize, t, motion)

    if (motion.kind === 'settling' && motion.end === 'success') {
      const look = this.look(this.state.cards[0]?.id ?? 0, motion.slot, slots, t)
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

  private drawOp(ctx: CanvasRenderingContext2D, rect: Rect, op: Op, t: number) {
    const shaking = this.opShake?.op === op
    const drawn = drawOp(ctx, rect, op, t, {
      selected: this.selectedOp === op,
      shakeAt: shaking && this.opShake ? this.opShake.at : null,
      pulseAt: this.opPulseAt,
    })
    if (shaking && drawn.shakeDone) {
      this.opShake = null
    }
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
    const motion = dialogMotion(t - this.dialogAt)
    paintDialogMask(ctx, width, height, motion.mask)
    const keepBoard = this.state.cards.length > 1
    let anchorBottom = slots[2].y + slots[2].h
    if (keepBoard) {
      this.state.cards.forEach((card) => {
        const look = this.look(card.id, card.slot, slots, t)
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
      const look = last ? this.look(last.id, last.slot, slots, t) : null
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
    const fail = this.result === 'fail'
    const longFail = fail && !this.wrongUnsolvableCall && this.includeUnsolvable
    const dialogH = fail ? (longFail ? 304 : 280) : 240
    const frame = dialogRect(width, height, dialogH, anchorBottom, keepBoard ? 'bottom' : 'center')
    openDialog(ctx, frame, motion.scale, (dialog) => {
      const dialogCx = dialog.x + dialog.w / 2
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
        const restart = paintDialogButton(
          ctx,
          dialog,
          128 + buttonShift,
          '重开本局',
          this.press.scale('dialog-restart', t),
        )
        this.hits.push({ rect: restart, hit: { kind: 'dialog-restart' } })
      }
      const next = paintDialogButton(
        ctx,
        dialog,
        fail ? 206 + buttonShift : 136,
        '下一局',
        this.press.scale('dialog-next', t),
      )
      this.hits.push({ rect: next, hit: { kind: 'dialog-next' } })
    })
  }

  private drawCopyDialog(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
    hintOn: boolean,
  ) {
    this.hits = []
    const openedAt = hintOn ? this.hintAt : this.copyAt
    const motion = dialogMotion(t - openedAt)
    paintDialogMask(ctx, width, height, motion.mask)
    const unsolvable = !hintOn && this.puzzle.difficulty === 'unsolvable'
    const steps = hintOn || unsolvable || !this.puzzle.steps ? [] : this.puzzle.steps
    const dialogH = Math.min(360, 220 + (steps.length > 0 ? 28 + 22 * (steps.length - 1) : 0))
    const frame = dialogRect(width, height, dialogH)
    openDialog(ctx, frame, motion.scale, (dialog) => {
      const cx = dialog.x + dialog.w / 2
      text(ctx, hintOn ? '提示' : '答案', cx, dialog.y + 48, 26, Color.coral, 'center', '700')
      if (hintOn) {
        text(ctx, this.hint, cx, dialog.y + 96, 16, Color.ink, 'center', '600')
      } else if (unsolvable) {
        text(ctx, '本题无解，无法算出24', cx, dialog.y + 96, 16, Color.ink, 'center', '600')
      } else {
        text(ctx, this.puzzle.expression, cx, dialog.y + 92, 18, Color.coral, 'center', '700')
        steps.forEach((step, index) => {
          text(ctx, step, cx, dialog.y + 122 + index * 22, 14, Color.muted, 'center', '500')
        })
      }
      const close = paintDialogButton(ctx, dialog, dialog.h - 74, '关闭', this.press.scale('copy-dismiss', t))
      this.hits.push({ rect: close, hit: { kind: 'copy-dismiss' } })
    })
  }

  private drawUnsolvableNotice(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
  ) {
    this.hits = []
    const motion = dialogMotion(t - this.noticeAt)
    paintDialogMask(ctx, width, height, motion.mask)
    const frame = dialogRect(width, height, 268)
    openDialog(ctx, frame, motion.scale, (dialog) => {
      const cx = dialog.x + dialog.w / 2
      text(ctx, '已开启「含无解题」模式', cx, dialog.y + 48, dialog.w < 340 ? 16 : 20, Color.ink, 'center', '600')
      const lines = [
        '接下来的题目中会随机出现无解题。',
        '如果你判断无法算出 24，',
        '请点击「本题无解」。',
      ]
      lines.forEach((line, index) => {
        text(ctx, line, cx, dialog.y + 96 + index * 26, 14, Color.muted)
      })
      const close = paintDialogButton(
        ctx,
        dialog,
        dialog.h - 74,
        '关闭',
        this.press.scale('notice-close', t),
      )
      this.hits.push({ rect: close, hit: { kind: 'notice-close' } })
    })
  }
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

function now() {
  return Date.now()
}
