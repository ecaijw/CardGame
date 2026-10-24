import { getIcon } from '../art'
import { playSfx } from '../audio/audio-manager'
import { formatFraction, type Op } from '../game/fraction'
import {
  MERGE_MS,
  SETTLE_MS,
  cardLook,
  dealDuration,
  drawCopyCard,
  drawDealFade,
  drawMergeFlight,
  drawOp,
  drawPlayCard,
  drawSuccessBurst,
  easeOut,
  playFrame,
  slotRects,
  type Face,
  type Motion,
} from './board'
import {
  buzz,
  createMatch,
  failAttempt,
  nextRound,
  rematch,
  remainingAnswerSeconds,
  remainingHandoffSeconds,
  resign,
  revealAnswer,
  startSecond,
  succeed,
  tickHandoff,
  timeout,
  type DuelMatch,
  type DuelStatsEvent,
  DUEL_TARGET,
  applyDuelStats,
} from '../game/duel'
import type { GameState } from '../game/merge'
import { pickPuzzle, type DealFilter, type Puzzle } from '../game/puzzles'
import { DIFFICULTY_FILTERS, drawDifficultyMenu } from './difficulty-menu'
import { PressFeedback } from './press'
import {
  createSession,
  restartSession,
  selectCard,
  selectOp,
  type SessionState,
} from '../game/session'
import {
  addDuelPlayedId,
  loadDuelPlayedIds,
} from '../played'
import {
  loadDuelAnswerSeconds,
  loadDuelDealFilter,
  loadDuelIncludeUnsolvable,
  loadDuelStats,
  saveDuelDealFilter,
  saveDuelIncludeUnsolvable,
  saveDuelStats,
  type DuelStats,
} from '../settings'
import {
  Color,
  bottomBarPad,
  capsuleBottom,
  drawDialogTitle,
  drawHouseButton,
  drawMenuBackground,
  drawSegmentBar,
  houseButtonRect,
  fillRound,
  hit,
  iconLabelButton,
  menuButton,
  menuInk,
  paintMenuChrome,
  text,
  withButtonScale,
  type Rect,
} from '../ui'

const OPS: Op[] = ['+', '−', '×', '÷']

const DIALOG_IN_MS = 220
const HINT_MS = 1800
const HEARTBEAT_MS = 150

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
  | { kind: 'buzz-red' }
  | { kind: 'buzz-blue' }
  | { kind: 'home' }
  | { kind: 'settings' }
  | { kind: 'dialog-start-second' }
  | { kind: 'dialog-next' }
  | { kind: 'dialog-rematch' }
  | { kind: 'dialog-close-answer' }

export class DuelScene {
  puzzle: Puzzle
  filter: DealFilter
  private session: SessionState
  private match: DuelMatch
  private includeUnsolvable = false
  private showDifficulty = false
  private hits: Array<{ rect: Rect; hit: Hit }> = []
  private motion: Motion = { kind: 'idle' }
  private dialogAt = 0
  private selectAt = 0
  private opPulseAt = 0
  private opShake: { op: Op; at: number } | null = null
  private press = new PressFeedback()
  private queuedMerge: { op: Op; destId: number; actedAt: number } | null = null
  private hint = ''
  private hintAt = 0
  private roundEndReason: '' | 'success' | 'fail' = ''
  private stats: DuelStats = loadDuelStats()
  private heartbeatAt = 0
  onHome?: () => void
  onSettings?: () => void

  constructor(puzzle: Puzzle, filter: DealFilter, includeUnsolvable: boolean, answerSeconds: number) {
    this.puzzle = puzzle
    this.filter = filter
    this.includeUnsolvable = includeUnsolvable
    this.session = createSession(puzzle.nums)
    this.match = createMatch(answerSeconds)
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

  static deal(): DuelScene {
    const filter = loadDuelDealFilter()
    const includeUnsolvable = loadDuelIncludeUnsolvable()
    const answerSeconds = loadDuelAnswerSeconds()
    const puzzle = dealPuzzle(undefined, filter, includeUnsolvable)
    return new DuelScene(puzzle, filter, includeUnsolvable, answerSeconds)
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
    return (
      !this.dialogOpen() &&
      this.match.phase === 'answering' &&
      (this.motion.kind === 'idle' || this.motion.kind === 'merging')
    )
  }

  private dialogOpen() {
    return (
      (this.match.phase === 'handoff' ||
        this.match.phase === 'roundEnd' ||
        this.match.phase === 'matchEnd' ||
        this.match.phase === 'revealed') &&
      this.dialogAt > 0 &&
      this.motion.kind === 'idle'
    )
  }

  pressDown(x: number, y: number) {
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (!found || found.hit.kind === 'op' || found.hit.kind === 'card') {
      return
    }
    this.press.down(pressKey(found.hit), now())
  }

  pressUp() {
    this.press.up(now())
  }

  tap(x: number, y: number) {
    const t = now()
    this.checkTimeout(t)
    this.tick(t)
    const found = this.hits.find((item) => hit(item.rect, x, y))
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
      if (action.kind === 'dialog-start-second') {
        playSfx('next')
        const next = startSecond(this.match, t)
        if (next) {
          this.match = next
          this.resetPuzzle()
          this.dialogAt = 0
        }
      }
      if (action.kind === 'dialog-next') {
        playSfx('next')
        this.nextPuzzle()
      }
      if (action.kind === 'dialog-rematch') {
        playSfx('next')
        this.rematchPuzzle()
      }
      if (action.kind === 'dialog-close-answer') {
        playSfx('tap')
        this.match = nextRound(this.match)
        this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
        this.resetPuzzle()
        this.dialogAt = 0
      }
      return
    }
    if (this.busy()) {
      if (this.canInputNext()) {
        if (action.kind === 'op') {
          this.onOp(action.op)
        }
        if (action.kind === 'card') {
          this.queueOrSelectCard(action.id, t)
        }
      }
      return
    }
    if (this.match.phase === 'thinking') {
      if (action.kind === 'buzz-red') {
        playSfx('select')
        const next = buzz(this.match, 'red', t)
        if (next) {
          this.match = next
          this.heartbeatAt = t
        }
        return
      }
      if (action.kind === 'buzz-blue') {
        playSfx('select')
        const next = buzz(this.match, 'blue', t)
        if (next) {
          this.match = next
          this.heartbeatAt = t
        }
        return
      }
      if (action.kind === 'card' || action.kind === 'op') {
        this.showHint('请先抢答')
        return
      }
      if (action.kind === 'answer') {
        playSfx('tap')
        const next = revealAnswer(this.match)
        if (next) {
          this.match = next
          this.dialogAt = t
        }
        return
      }
      if (action.kind === 'next') {
        playSfx('next')
        this.nextPuzzle()
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
        saveDuelDealFilter(this.filter)
        this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
        this.resetPuzzle()
        return
      }
      if (action.kind === 'toggle-unsolvable') {
        playSfx('tap')
        this.showDifficulty = false
        this.includeUnsolvable = !this.includeUnsolvable
        saveDuelIncludeUnsolvable(this.includeUnsolvable)
        this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
        this.resetPuzzle()
        return
      }
      if (action.kind === 'home') {
        playSfx('tap')
        this.onHome?.()
        return
      }
      if (action.kind === 'settings') {
        playSfx('tap')
        this.onSettings?.()
        return
      }
      return
    }
    if (this.match.phase === 'answering') {
      if (action.kind === 'card') {
        this.onCard(action.id, t)
        return
      }
      if (action.kind === 'op') {
        this.onOp(action.op)
        return
      }
      if (action.kind === 'restart') {
        playSfx('next')
        this.resetPuzzle()
        return
      }
      if (action.kind === 'declare-unsolvable') {
        this.declareUnsolvable(t)
        return
      }
      if (action.kind === 'buzz-red' || action.kind === 'buzz-blue') {
        playSfx('tap')
        const next = resign(this.match, t)
        if (next) {
          this.match = next
          this.roundEndReason = next.phase === 'roundEnd' ? 'fail' : ''
          this.queuedMerge = null
          this.selectedId = 0
          this.selectedOp = ''
          this.motion = { kind: 'idle' }
          this.dialogAt = t
        }
        return
      }
    }
  }

  private onCard(id: number, actedAt: number) {
    this.checkTimeout(actedAt)
    if (this.match.phase !== 'answering') {
      return
    }
    const t = actedAt
    const before = this.session
    const source = before.game.cards.find((card) => card.id === before.selectedId)
    const dest = before.game.cards.find((card) => card.id === id)
    const { state, effect } = selectCard(before, id)
    this.session = state
    if (effect.kind === 'select') {
      this.selectAt = t
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
    if (effect.end === 'success') {
      const result = succeed(this.match)
      if (result) {
        this.match = result.match
        this.roundEndReason = 'success'
        this.applyEvents(result.events)
        playSfx('success')
        this.selectAt = t
        this.queuedMerge = null
        const resultCard = this.state.cards.find((card) => card.id === effect.resultId)
        this.motion = {
          kind: 'merging',
          at: t,
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
      return
    }
    if (effect.end === 'fail') {
      const next = failAttempt(this.match, t)
      this.match = next
      this.roundEndReason = next.phase === 'roundEnd' ? 'fail' : ''
      this.queuedMerge = null
      this.selectedId = 0
      this.selectedOp = ''
      this.motion = { kind: 'idle' }
      this.dialogAt = t
      playSfx('invalid')
      return
    }
    playSfx('merge')
    this.selectAt = t
    const resultCard = this.state.cards.find((card) => card.id === effect.resultId)
    this.motion = {
      kind: 'merging',
      at: t,
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

  private queueOrSelectCard(id: number, actedAt: number) {
    if (!this.selectedOp || id === this.selectedId) {
      this.onCard(id, actedAt)
      this.queuedMerge = null
      return
    }
    this.queuedMerge = { op: this.selectedOp, destId: id, actedAt }
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

  private declareUnsolvable(t: number) {
    const correct = this.puzzle.difficulty === 'unsolvable'
    if (correct) {
      const result = succeed(this.match)
      if (result) {
        this.match = result.match
        this.roundEndReason = 'success'
        this.applyEvents(result.events)
        this.selectedId = 0
        this.selectedOp = ''
        this.queuedMerge = null
        this.motion = { kind: 'idle' }
        this.dialogAt = t
        playSfx('success')
      }
    } else {
      const next = failAttempt(this.match, t)
      this.match = next
      this.roundEndReason = next.phase === 'roundEnd' ? 'fail' : ''
      this.queuedMerge = null
      this.selectedId = 0
      this.selectedOp = ''
      this.motion = { kind: 'idle' }
      this.dialogAt = t
      playSfx('invalid')
    }
  }

  private showHint(message: string) {
    this.hint = message
    this.hintAt = now()
  }

  private applyEvents(events: DuelStatsEvent[]) {
    for (const event of events) {
      this.stats = applyDuelStats(this.stats, event)
    }
    saveDuelStats(this.stats)
  }

  private resetPuzzle() {
    const fadeFrom = this.state.cards.map((card) => ({
      slot: card.slot,
      value: { n: card.value.n, d: card.value.d },
    }))
    this.session = restartSession(this.puzzle.nums)
    this.queuedMerge = null
    this.hint = ''
    this.showDifficulty = false
    this.startDeal(fadeFrom)
  }

  private nextPuzzle() {
    this.match = nextRound(this.match)
    this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
    this.resetPuzzle()
    this.dialogAt = 0
    this.roundEndReason = ''
  }

  private rematchPuzzle() {
    this.match = rematch(this.match)
    this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
    this.resetPuzzle()
    this.dialogAt = 0
    this.roundEndReason = ''
  }

  private checkTimeout(t: number) {
    if (this.match.phase === 'answering') {
      const waitingForQueuedClick =
        this.queuedMerge !== null &&
        this.match.answerDeadline !== null &&
        this.queuedMerge.actedAt < this.match.answerDeadline
      const next = waitingForQueuedClick ? null : timeout(this.match, t)
      if (next) {
        this.match = next
        this.roundEndReason = next.phase === 'roundEnd' ? 'fail' : ''
        this.queuedMerge = null
        this.selectedId = 0
        this.selectedOp = ''
        this.motion = { kind: 'idle' }
        this.dialogAt = t
      }
    }
    if (this.match.phase === 'handoff') {
      const next = tickHandoff(this.match, t)
      if (next) {
        this.match = next
        this.resetPuzzle()
        this.dialogAt = 0
        this.heartbeatAt = t
      }
    }
  }

  private tick(t: number) {
    const motion = this.motion
    if (motion.kind === 'dealing' && t - motion.at >= dealDuration(motion.fadeFrom)) {
      this.motion = { kind: 'idle' }
      return
    }
    if (motion.kind === 'merging' && t - motion.at >= MERGE_MS) {
      if (this.roundEndReason === 'success') {
        this.queuedMerge = null
        const last = this.state.cards[0]
        this.motion = {
          kind: 'settling',
          at: t,
          end: 'success',
          slot: last ? last.slot : motion.dest.slot,
        }
        return
      }
      const queued = this.queuedMerge
      this.queuedMerge = null
      this.motion = { kind: 'idle' }
      if (queued) {
        this.selectedOp = queued.op
        this.onCard(queued.destId, queued.actedAt)
      }
      return
    }
    if (motion.kind === 'settling' && t - motion.at >= SETTLE_MS) {
      this.motion = { kind: 'idle' }
      this.dialogAt = t
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const t = now()
    this.checkTimeout(t)
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
    const buzzH = 48
    const tipH = 24
    const buzzTotalH = buzzH + tipH
    const belowCards = 28
    const stackH = cardH * 2 + gap + belowCards + opH + buzzTotalH
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

    const buzzY = opY + opH + 8
    this.drawBuzzRow(ctx, frame.play, buzzY, buzzH, t)

    const current = DIFFICULTY_FILTERS.find((item) => item.filter === this.filter)
    const barH = 52
    const barY = frame.side ? buzzY + buzzTotalH + 8 : height - bottomBarPad() - barH
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
      const show =
        action.kind === 'restart'
          ? this.match.phase === 'answering' && !this.busy()
          : this.match.phase === 'thinking' && !this.busy()
      if (show) {
        withButtonScale(ctx, rect, this.press.scale(action.kind, t), () => {
          iconLabelButton(ctx, rect, action.label, 'ghost', action.icon)
        })
        if (!this.dialogOpen()) {
          this.hits.push({ rect, hit: { kind: action.kind } as Hit })
        }
      }
    })
    if (this.includeUnsolvable && this.match.phase === 'answering') {
      const noSolution = { x: difficulty.x, y: actionY, w: cellW, h: actionH }
      withButtonScale(ctx, noSolution, this.press.scale('declare-unsolvable', t), () => {
        menuButton(ctx, noSolution, '本题无解', 'ghost')
      })
      if (!this.busy() && !this.dialogOpen()) {
        this.hits.push({ rect: noSolution, hit: { kind: 'declare-unsolvable' } })
      }
    }

    const showAnswer = this.match.phase === 'thinking'
    const showDifficulty = this.match.phase === 'thinking'
    drawSegmentBar(ctx, bar, [
      { label: '显示答案', icon: 'answer', active: false, scale: this.press.scale('answer', t) },
      {
        label: current ? current.label : '难度',
        icon: 'difficulty',
        active: showDifficulty && this.showDifficulty,
        scale: this.press.scale('difficulty', t),
      },
      { label: '设置', icon: 'settings', scale: this.press.scale('settings', t) },
    ])
    if (!this.busy() && !this.dialogOpen()) {
      if (showAnswer) {
        this.hits.push({ rect: answer, hit: { kind: 'answer' } })
      }
      if (showDifficulty) {
        this.hits.push({ rect: difficulty, hit: { kind: 'difficulty' } })
      }
      const showSettings = this.match.phase === 'thinking'
      if (showSettings) {
        this.hits.push({ rect: settings, hit: { kind: 'settings' } })
      }
    }

    const hintOn = Boolean(this.hint) && t - this.hintAt < HINT_MS
    const statsRect = frame.side
      ? { x: frame.side.x, y: topY + 8, w: frame.side.w, h: actionY - topY - 16 }
      : { x: 24, y: opY + opH + buzzTotalH + 20, w: width - 48, h: actionY - (opY + opH + buzzTotalH + 28) }
    if (hintOn) {
      drawCopyCard(ctx, statsRect, this.hint, [])
    }

    if (this.showDifficulty && this.match.phase === 'thinking') {
      this.hits = [
        ...drawDifficultyMenu(ctx, difficulty, this.filter, this.includeUnsolvable, true, (key) =>
          this.press.scale(key, t),
        ),
        ...this.hits,
      ]
    }

    const showHome = this.match.phase === 'thinking' && !this.dialogOpen()
    if (showHome) {
      const homeRect = houseButtonRect()
      drawHouseButton(ctx, homeRect, this.press.scale('home', t))
      this.hits.push({ rect: homeRect, hit: { kind: 'home' } })
    }

    if (this.dialogOpen()) {
      this.drawDialog(ctx, width, height, t, slots, fontSize)
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
      settle:
        this.roundEndReason === 'success'
          ? {
              result: 'success',
              dialogOpen: this.dialogOpen(),
              cardCount: this.state.cards.length,
              last: last ? { id: last.id, slot: last.slot } : undefined,
            }
          : undefined,
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

  private drawBuzzRow(
    ctx: CanvasRenderingContext2D,
    play: { x: number; w: number },
    y: number,
    h: number,
    t: number,
  ) {
    const redColor = '#E23B32'
    const blueColor = '#2F6FED'
    const gap = 12
    const sideW = (play.w - 32 - gap * 2) / 3
    const redRect = { x: play.x + 16, y, w: sideW, h }
    const blueRect = { x: play.x + 16 + sideW * 2 + gap * 2, y, w: sideW, h }
    const scoreRect = { x: play.x + 16 + sideW + gap, y, w: sideW, h }
    const tipY = y + h + 4

    const showRedBuzz = this.match.phase === 'thinking'
    const showBlueBuzz = this.match.phase === 'thinking'
    const showRedCountdown = this.match.phase === 'answering' && this.match.answering === 'red'
    const showBlueCountdown = this.match.phase === 'answering' && this.match.answering === 'blue'

    if (showRedBuzz || showRedCountdown) {
      if (showRedCountdown) {
        const remaining = remainingAnswerSeconds(this.match, t)
        const buzzScale = this.getBuzzHeartbeatScale(t)
        withButtonScale(ctx, redRect, this.press.scale('buzz-red', t) * buzzScale, () => {
          paintMenuChrome(ctx, redRect, 'ghost', 10)
          ctx.fillStyle = redColor
          ctx.fillRect(redRect.x + 4, redRect.y + 4, redRect.w - 8, redRect.h - 8)
          text(ctx, String(remaining), redRect.x + redRect.w / 2, redRect.y + redRect.h / 2, 24, '#FFFFFF', 'center', '700')
        })
        text(ctx, '点击认输', redRect.x + redRect.w / 2, tipY + 12, 13, Color.muted, 'center', '500')
        this.hits.push({ rect: redRect, hit: { kind: 'buzz-red' } })
      } else {
        withButtonScale(ctx, redRect, this.press.scale('buzz-red', t), () => {
          paintMenuChrome(ctx, redRect, 'ghost', 10)
          ctx.fillStyle = redColor
          ctx.fillRect(redRect.x + 4, redRect.y + 4, redRect.w - 8, redRect.h - 8)
          text(ctx, '红方抢答', redRect.x + redRect.w / 2, redRect.y + redRect.h / 2, 15, '#FFFFFF', 'center', '600')
        })
        if (!this.dialogOpen()) {
          this.hits.push({ rect: redRect, hit: { kind: 'buzz-red' } })
        }
      }
    }

    if (showBlueBuzz || showBlueCountdown) {
      if (showBlueCountdown) {
        const remaining = remainingAnswerSeconds(this.match, t)
        const buzzScale = this.getBuzzHeartbeatScale(t)
        withButtonScale(ctx, blueRect, this.press.scale('buzz-blue', t) * buzzScale, () => {
          paintMenuChrome(ctx, blueRect, 'ghost', 10)
          ctx.fillStyle = blueColor
          ctx.fillRect(blueRect.x + 4, blueRect.y + 4, blueRect.w - 8, blueRect.h - 8)
          text(ctx, String(remaining), blueRect.x + blueRect.w / 2, blueRect.y + blueRect.h / 2, 24, '#FFFFFF', 'center', '700')
        })
        text(ctx, '点击认输', blueRect.x + blueRect.w / 2, tipY + 12, 13, Color.muted, 'center', '500')
        this.hits.push({ rect: blueRect, hit: { kind: 'buzz-blue' } })
      } else {
        withButtonScale(ctx, blueRect, this.press.scale('buzz-blue', t), () => {
          paintMenuChrome(ctx, blueRect, 'ghost', 10)
          ctx.fillStyle = blueColor
          ctx.fillRect(blueRect.x + 4, blueRect.y + 4, blueRect.w - 8, blueRect.h - 8)
          text(ctx, '蓝方抢答', blueRect.x + blueRect.w / 2, blueRect.y + blueRect.h / 2, 15, '#FFFFFF', 'center', '600')
        })
        if (!this.dialogOpen()) {
          this.hits.push({ rect: blueRect, hit: { kind: 'buzz-blue' } })
        }
      }
    }

    paintMenuChrome(ctx, scoreRect, 'ghost', 10)
    const scoreText = `${this.match.scoreRed} : ${this.match.scoreBlue}`
    text(ctx, scoreText, scoreRect.x + scoreRect.w / 2, scoreRect.y + scoreRect.h / 2, 20, Color.ink, 'center', '700')
  }

  private getBuzzHeartbeatScale(t: number): number {
    const remaining = remainingAnswerSeconds(this.match, t)
    if (remaining <= 0) {
      return 1
    }
    const elapsed = t - this.heartbeatAt
    const interval = 1000
    const beatNumber = Math.floor(elapsed / interval)
    const lastBeat = this.heartbeatAt + beatNumber * interval
    if (t - lastBeat < HEARTBEAT_MS) {
      const p = (t - lastBeat) / HEARTBEAT_MS
      return 0.8 + 0.2 * easeOut(p)
    }
    if (t - lastBeat >= interval - HEARTBEAT_MS) {
      this.heartbeatAt = lastBeat + interval
    }
    return 1
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
    const cardAnchor = this.paintSuccessCard(ctx, slots, fontSize, t)

    const p = easeOut((t - this.dialogAt) / DIALOG_IN_MS)
    const scale = 0.97 + 0.03 * p
    const dialogW = Math.min(400, width - 48)

    if (this.match.phase === 'handoff') {
      const dialogH = 240
      const dialog = {
        x: (width - dialogW) / 2,
        y: Math.max(24, (height - dialogH) / 2),
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
      text(ctx, '很遗憾,本次作答没有成功。', dialogCx, dialog.y + 64, 15, Color.muted, 'center', '500')
      const remaining = remainingHandoffSeconds(this.match, t)
      const line2 = remaining > 0 ? `${remaining}秒后由对手继续答题。` : '由对手继续答题。'
      text(ctx, line2, dialogCx, dialog.y + 92, 15, Color.muted, 'center', '500')
      const start = { x: dialog.x + 24, y: dialog.y + 136, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, start, this.press.scale('dialog-start-second', t), () => {
        menuButton(ctx, start, '开始答题', 'ghost')
      })
      this.hits.push({ rect: start, hit: { kind: 'dialog-start-second' } })
      ctx.restore()
      return
    }

    if (this.match.phase === 'roundEnd' && this.roundEndReason !== 'success') {
      const dialogH = 240
      const dialog = {
        x: (width - dialogW) / 2,
        y: Math.max(24, (height - dialogH) / 2),
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
      text(ctx, '很遗憾,本次作答没有成功。', dialogCx, dialog.y + 64, 15, Color.muted, 'center', '500')
      text(ctx, '本局结束。', dialogCx, dialog.y + 92, 15, Color.muted, 'center', '500')
      const next = { x: dialog.x + 24, y: dialog.y + 136, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, next, this.press.scale('dialog-next', t), () => {
        menuButton(ctx, next, '下一局', 'ghost')
      })
      this.hits.push({ rect: next, hit: { kind: 'dialog-next' } })
      ctx.restore()
      return
    }

    if (this.match.phase === 'matchEnd') {
      const dialogH = 280
      const dialog = {
        x: (width - dialogW) / 2,
        y: this.dialogY(height, dialogH, cardAnchor),
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
      const winner = this.match.winner
      drawDialogTitle(
        ctx,
        '成功',
        dialogCx,
        dialog.y + 48,
        26,
        Color.pine,
        getIcon('crown'),
      )
      text(ctx, '太棒了，本场获胜！', dialogCx, dialog.y + 84, 14, Color.muted)
      const winnerText = winner === 'red' ? '红方' : '蓝方'
      text(ctx, `${winnerText}先到${DUEL_TARGET}分`, dialogCx, dialog.y + 106, 14, Color.muted)
      const rematch = { x: dialog.x + 24, y: dialog.y + 180, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, rematch, this.press.scale('dialog-rematch', t), () => {
        menuButton(ctx, rematch, '再来一场', 'ghost')
      })
      this.hits.push({ rect: rematch, hit: { kind: 'dialog-rematch' } })
      ctx.restore()
      return
    }

    if (this.match.phase === 'revealed') {
      const isUnsolvable = this.puzzle.difficulty === 'unsolvable'
      const dialogH = isUnsolvable ? 240 : 280
      const dialog = {
        x: (width - dialogW) / 2,
        y: Math.max(24, (height - dialogH) / 2),
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
      text(ctx, '答案', dialogCx, dialog.y + 48, 26, Color.coral, 'center', '700')
      if (isUnsolvable) {
        text(ctx, '本题无解，无法算出24', dialogCx, dialog.y + 96, 16, Color.ink, 'center', '600')
      } else {
        text(ctx, this.puzzle.expression, dialogCx, dialog.y + 92, 18, Color.coral, 'center', '700')
        this.puzzle.steps.forEach((step, index) => {
          text(ctx, step, dialogCx, dialog.y + 122 + index * 22, 14, Color.muted, 'center', '500')
        })
      }
      const closeY = isUnsolvable ? 136 : 206
      const close = { x: dialog.x + 24, y: dialog.y + closeY, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, close, this.press.scale('dialog-close-answer', t), () => {
        menuButton(ctx, close, '下一局', 'ghost')
      })
      this.hits.push({ rect: close, hit: { kind: 'dialog-close-answer' } })
      ctx.restore()
      return
    }

    if (this.match.phase === 'roundEnd' && this.roundEndReason === 'success') {
      const dialogH = 240
      const dialog = {
        x: (width - dialogW) / 2,
        y: this.dialogY(height, dialogH, cardAnchor),
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
        '成功',
        dialogCx,
        dialog.y + 48,
        26,
        Color.pine,
        getIcon('crown'),
      )
      text(ctx, '太棒了，本局获胜！', dialogCx, dialog.y + 84, 14, Color.muted)
      const next = { x: dialog.x + 24, y: dialog.y + 136, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, next, this.press.scale('dialog-next', t), () => {
        menuButton(ctx, next, '下一局', 'ghost')
      })
      this.hits.push({ rect: next, hit: { kind: 'dialog-next' } })
      ctx.restore()
    }
  }

  private paintSuccessCard(
    ctx: CanvasRenderingContext2D,
    slots: Rect[],
    fontSize: number,
    t: number,
  ): number | null {
    if (this.roundEndReason !== 'success' || this.state.cards.length !== 1) {
      return null
    }
    const last = this.state.cards[0]
    const look = this.look(last.id, last.slot, slots, t)
    if (!look) {
      return null
    }
    drawPlayCard(ctx, {
      rect: slots[last.slot],
      label: formatFraction(last.value),
      fontSize,
      ...look,
    })
    return slots[last.slot].y + slots[last.slot].h + (look.dy ?? 0)
  }

  private dialogY(height: number, dialogH: number, cardAnchor: number | null) {
    if (cardAnchor === null) {
      return Math.max(24, (height - dialogH) / 2)
    }
    const maxY = Math.max(24, height - 24 - dialogH)
    return Math.min(Math.max(cardAnchor + 24, 24), maxY)
  }

}

function pressKey(action: Hit) {
  if (action.kind === 'set-filter') {
    return `filter-${action.filter}`
  }
  return action.kind
}

function dealPuzzle(excludeId?: string, filter: DealFilter = 'easy', includeUnsolvable = false): Puzzle {
  const puzzle = pickPuzzle(loadDuelPlayedIds(), excludeId, Math.random, filter, includeUnsolvable)
  addDuelPlayedId(puzzle.id)
  return puzzle
}

function now() {
  return Date.now()
}
