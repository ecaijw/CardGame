import { getIcon } from '../art'
import { playSfx } from '../audio/audio-manager'
import { formatFraction, type Op } from '../game/fraction'
import {
  MERGE_MS,
  SETTLE_MS,
  cardLook,
  dealDuration,
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
  duelDialog,
  duelPageChrome,
  duelSettlesSuccess,
  duelShownBuzzPlayer,
  failAttempt,
  judgeUnsolvable,
  nextRound,
  rematch,
  remainingAnswerSeconds,
  remainingHandoffSeconds,
  resign,
  revealAnswer,
  setAnswerSeconds,
  startSecond,
  succeed,
  tickHandoff,
  timeout,
  type DuelMatch,
  type DuelPlayer,
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
  paintMenuChrome,
  iconLabelButton,
  menuButton,
  paintDialogMask,
  paintHomePill,
  roundRect,
  text,
  withButtonScale,
  type Rect,
} from '../ui'

const OPS: Op[] = ['+', '−', '×', '÷']

const DIALOG_IN_MS = 220
const MASK_IN_MS = 360
const HINT_MS = 1800
const HEARTBEAT_MS = 150
const SCORE_H = 58
const BUZZ_H = 52
const BUZZ_GAP = 16
const BUZZ_TIP_H = 24
const BUZZ_BLOCK_H = SCORE_H + BUZZ_GAP + BUZZ_H + BUZZ_TIP_H
const FINGER_PERIOD_MS = 3000
const FINGER_SHOW_MS = 1200

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
  private buzzSide: DuelPlayer | null = null
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
    return this.keepsPage() && this.dialogAt > 0 && this.motion.kind === 'idle'
  }

  private keepsPage() {
    return (
      this.match.phase === 'handoff' ||
      this.match.phase === 'roundEnd' ||
      this.match.phase === 'matchEnd' ||
      this.match.phase === 'revealed'
    )
  }

  private rememberBuzzSide(match: DuelMatch) {
    if (match.answering) {
      this.buzzSide = match.answering
    }
  }

  private pageChrome(): 'thinking' | 'answering' {
    return duelPageChrome(this.match.phase)
  }

  private shownBuzzPlayer(): DuelPlayer | null {
    return duelShownBuzzPlayer(this.match, this.buzzSide)
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
          this.rememberBuzzSide(next)
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
          this.rememberBuzzSide(next)
          this.heartbeatAt = t
        }
        return
      }
      if (action.kind === 'buzz-blue') {
        playSfx('select')
        const next = buzz(this.match, 'blue', t)
        if (next) {
          this.match = next
          this.rememberBuzzSide(next)
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
    const judged = judgeUnsolvable(this.match, this.puzzle.difficulty === 'unsolvable', t)
    if (!judged) {
      return
    }
    if (judged.kind === 'success') {
      this.match = judged.result.match
      this.applyEvents(judged.result.events)
      this.selectedId = 0
      this.selectedOp = ''
      this.queuedMerge = null
      this.motion = { kind: 'idle' }
      this.dialogAt = t
      playSfx('success')
      return
    }
    this.match = judged.match
    this.queuedMerge = null
    this.selectedId = 0
    this.selectedOp = ''
    this.motion = { kind: 'idle' }
    this.dialogAt = t
    playSfx('invalid')
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
    this.buzzSide = null
  }

  private rematchPuzzle() {
    this.match = rematch(this.match)
    this.puzzle = dealPuzzle(this.puzzle.id, this.filter, this.includeUnsolvable)
    this.resetPuzzle()
    this.dialogAt = 0
    this.buzzSide = null
  }

  private refreshAnswerSeconds() {
    if (this.match.phase === 'answering') {
      return
    }
    this.match = setAnswerSeconds(this.match, loadDuelAnswerSeconds())
  }

  private checkTimeout(t: number) {
    this.refreshAnswerSeconds()
    if (this.match.phase === 'answering') {
      const waitingForQueuedClick =
        this.queuedMerge !== null &&
        this.match.answerDeadline !== null &&
        this.queuedMerge.actedAt < this.match.answerDeadline
      const next = waitingForQueuedClick ? null : timeout(this.match, t)
      if (next) {
        this.match = next
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
        this.rememberBuzzSide(next)
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
      if (duelSettlesSuccess(this.match)) {
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
    const buzzTotalH = BUZZ_BLOCK_H
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

    const current = DIFFICULTY_FILTERS.find((item) => item.filter === this.filter)
    const barH = 52
    const actionH = 44
    const phoneBarY = height - bottomBarPad() - barH
    const phoneActionY = phoneBarY - 12 - actionH
    const opBottom = opY + opH
    const regionBottom = frame.side ? opBottom + buzzTotalH + 16 : phoneActionY
    const visibleH = SCORE_H + BUZZ_GAP + BUZZ_H
    const buzzY = opBottom + Math.max(8, (regionBottom - opBottom - visibleH) / 2)
    this.drawBuzzRow(ctx, frame.play, buzzY, t)

    const barY = frame.side ? buzzY + buzzTotalH + 8 : phoneBarY
    const bar = frame.side
      ? { x: frame.side.x, y: barY, w: frame.side.w, h: barH }
      : { x: 20, y: barY, w: width - 40, h: barH }
    const cellW = bar.w / 3
    const answer = { x: bar.x, y: bar.y, w: cellW, h: bar.h }
    const difficulty = { x: bar.x + cellW, y: bar.y, w: cellW, h: bar.h }
    const settings = { x: bar.x + cellW * 2, y: bar.y, w: cellW, h: bar.h }
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
          ? this.pageChrome() === 'answering'
          : this.pageChrome() === 'thinking'
      if (show) {
        withButtonScale(ctx, rect, this.press.scale(action.kind, t), () => {
          iconLabelButton(ctx, rect, action.label, 'ghost', action.icon)
        })
        const canHit =
          !this.busy() &&
          !this.dialogOpen() &&
          ((action.kind === 'restart' && this.match.phase === 'answering') ||
            (action.kind === 'next' && this.match.phase === 'thinking'))
        if (canHit) {
          this.hits.push({ rect, hit: { kind: action.kind } as Hit })
        }
      }
    })
    if (this.includeUnsolvable && this.pageChrome() === 'answering') {
      const noSolution = { x: difficulty.x, y: actionY, w: cellW, h: actionH }
      withButtonScale(ctx, noSolution, this.press.scale('declare-unsolvable', t), () => {
        menuButton(ctx, noSolution, '本题无解', 'ghost')
      })
      if (this.match.phase === 'answering' && !this.busy() && !this.dialogOpen()) {
        this.hits.push({ rect: noSolution, hit: { kind: 'declare-unsolvable' } })
      }
    }

    if (this.pageChrome() === 'thinking') {
      const showBarActions = this.match.phase === 'thinking' && !this.busy() && !this.dialogOpen()
      drawSegmentBar(ctx, bar, [
        { label: '显示答案', icon: 'answer', active: false, scale: this.press.scale('answer', t) },
        {
          label: current ? current.label : '难度',
          icon: 'difficulty',
          active: showBarActions && this.showDifficulty,
          scale: this.press.scale('difficulty', t),
        },
        { label: '设置', icon: 'settings', scale: this.press.scale('settings', t) },
      ])
      if (showBarActions) {
        this.hits.push({ rect: answer, hit: { kind: 'answer' } })
        this.hits.push({ rect: difficulty, hit: { kind: 'difficulty' } })
        this.hits.push({ rect: settings, hit: { kind: 'settings' } })
      }
    }

    const hintOn = Boolean(this.hint) && t - this.hintAt < HINT_MS
    if (hintOn) {
      paintMenuChrome(ctx, bar, 'ghost')
      text(ctx, this.hint, bar.x + bar.w / 2, bar.y + bar.h / 2, 16, Color.coral, 'center', '600')
    }

    if (this.showDifficulty && this.match.phase === 'thinking') {
      this.hits = [
        ...drawDifficultyMenu(ctx, difficulty, this.filter, this.includeUnsolvable, true, (key) =>
          this.press.scale(key, t),
        ),
        ...this.hits,
      ]
    }

    if (this.dialogOpen()) {
      this.drawDialog(ctx, width, height, t, slots, fontSize)
    }

    const showHome = this.pageChrome() === 'thinking'
    if (showHome) {
      const homeRect = houseButtonRect()
      drawHouseButton(ctx, homeRect, this.press.scale('home', t))
      if (this.match.phase === 'thinking' && !this.busy() && !this.dialogOpen()) {
        this.hits.push({ rect: homeRect, hit: { kind: 'home' } })
      }
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
        duelSettlesSuccess(this.match)
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
    t: number,
  ) {
    const scoreH = SCORE_H
    const buzzBtnH = BUZZ_H
    const buzzGap = BUZZ_GAP
    const gap = 16
    const inset = 16
    const rowW = play.w - inset * 2
    const rowX = play.x + inset
    const sideW = (rowW - gap) / 2
    const buttonY = y + scoreH + buzzGap
    const redRect = { x: rowX, y: buttonY, w: sideW, h: buzzBtnH }
    const blueRect = { x: rowX + sideW + gap, y: buttonY, w: sideW, h: buzzBtnH }
    const scoreRect = { x: rowX, y, w: rowW, h: scoreH }
    const tipY = buttonY + buzzBtnH + 16
    const redPaint = { fill: ['#FF8E7D', '#FF7464'] as const, stroke: '#E85A4F' }
    const bluePaint = { fill: ['#8CAEF0', '#769FED'] as const, stroke: '#5F85D8' }

    const only = this.shownBuzzPlayer()
    const showRedBuzz = only === null || only === 'red'
    const showBlueBuzz = only === null || only === 'blue'
    const showRedCountdown = this.match.phase === 'answering' && only === 'red'
    const showBlueCountdown = this.match.phase === 'answering' && only === 'blue'
    const canBuzz = this.match.phase === 'thinking' && !this.busy()

    const finger = canBuzz ? this.fingerPress(t) : null
    const paintBuzz = (
      rect: Rect,
      scale: number,
      paint: { fill: readonly [string, string]; stroke: string },
      label: string,
      fontSize: number,
      cue: number | null,
      cueSide: 'left' | 'right' = 'left',
    ) => {
      withButtonScale(ctx, rect, scale, () => {
        paintHomePill(ctx, rect, paint.fill, paint.stroke)
        const cy = rect.y + rect.h / 2
        const cx = rect.x + rect.w / 2
        text(ctx, label, cx, cy, fontSize, '#FFFFFF', 'center', '600')
        if (cue === null) {
          return
        }
        const icon = 23
        const iconGap = 9
        ctx.save()
        ctx.font = `600 ${fontSize}px "PingFang SC","PingFangSC-Semibold","Hiragino Sans GB","Heiti SC",sans-serif`
        const textW = ctx.measureText(label).width
        ctx.restore()
        const fingerX = cueSide === 'left'
          ? cx - textW / 2 - iconGap - icon / 2
          : cx + textW / 2 + iconGap + icon / 2
        this.drawPressFinger(ctx, fingerX, cy, icon, cue)
      })
    }

    if (showRedBuzz || showRedCountdown) {
      if (showRedCountdown) {
        const remaining = remainingAnswerSeconds(this.match, t)
        paintBuzz(
          redRect,
          this.press.scale('buzz-red', t) * this.getBuzzHeartbeatScale(t),
          redPaint,
          String(remaining),
          22,
          null,
        )
        text(ctx, '点击认输', redRect.x + redRect.w / 2, tipY, 13, Color.muted, 'center', '500')
        this.hits.push({ rect: redRect, hit: { kind: 'buzz-red' } })
      } else {
        paintBuzz(redRect, this.press.scale('buzz-red', t), redPaint, '抢答', 20, finger, 'left')
        if (canBuzz) {
          this.hits.push({ rect: redRect, hit: { kind: 'buzz-red' } })
        }
      }
    }

    if (showBlueBuzz || showBlueCountdown) {
      if (showBlueCountdown) {
        const remaining = remainingAnswerSeconds(this.match, t)
        paintBuzz(
          blueRect,
          this.press.scale('buzz-blue', t) * this.getBuzzHeartbeatScale(t),
          bluePaint,
          String(remaining),
          22,
          null,
        )
        text(ctx, '点击认输', blueRect.x + blueRect.w / 2, tipY, 13, Color.muted, 'center', '500')
        this.hits.push({ rect: blueRect, hit: { kind: 'buzz-blue' } })
      } else {
        paintBuzz(blueRect, this.press.scale('buzz-blue', t), bluePaint, '抢答', 20, finger, 'right')
        if (canBuzz) {
          this.hits.push({ rect: blueRect, hit: { kind: 'buzz-blue' } })
        }
      }
    }

    this.drawScore(ctx, scoreRect, redRect, blueRect)
  }

  private fingerPress(t: number) {
    const phase = t % FINGER_PERIOD_MS
    if (phase >= FINGER_SHOW_MS) {
      return null
    }
    return phase / FINGER_SHOW_MS
  }

  private drawPressFinger(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    progress: number,
  ) {
    const fade = progress < 0.18 ? easeOut(progress / 0.18) : progress > 0.82 ? (1 - progress) / 0.18 : 1
    const pressProgress = Math.min(1, Math.max(0, (progress - 0.24) / 0.34))
    const releaseProgress = Math.min(1, Math.max(0, (progress - 0.58) / 0.24))
    const press = easeOut(pressProgress) * (1 - easeOut(releaseProgress))
    const unit = size / 24
    ctx.save()
    ctx.globalAlpha = fade
    ctx.translate(x, y + press * unit * 1.8)
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(1.4, 1.7 * unit)

    // One continuous outline keeps the cue looking like the same icon while it moves.
    ctx.beginPath()
    ctx.moveTo(-1.8 * unit, 9.8 * unit)
    ctx.bezierCurveTo(-4.7 * unit, 8.8 * unit, -6.7 * unit, 6.4 * unit, -7.8 * unit, 3.5 * unit)
    ctx.lineTo(-9.5 * unit, -0.4 * unit)
    ctx.bezierCurveTo(-10.1 * unit, -1.8 * unit, -9.5 * unit, -3.2 * unit, -8.2 * unit, -3.7 * unit)
    ctx.bezierCurveTo(-7.2 * unit, -4.1 * unit, -6.1 * unit, -3.7 * unit, -5.5 * unit, -2.8 * unit)
    ctx.lineTo(-3.2 * unit, 0.6 * unit)
    ctx.lineTo(-3.2 * unit, -7.3 * unit)
    ctx.bezierCurveTo(-3.2 * unit, -9.1 * unit, -2.0 * unit, -10.4 * unit, -0.4 * unit, -10.4 * unit)
    ctx.bezierCurveTo(1.2 * unit, -10.4 * unit, 2.4 * unit, -9.1 * unit, 2.4 * unit, -7.3 * unit)
    ctx.lineTo(2.4 * unit, -1.8 * unit)
    ctx.bezierCurveTo(2.6 * unit, -3.2 * unit, 3.6 * unit, -4.1 * unit, 4.9 * unit, -4.1 * unit)
    ctx.bezierCurveTo(6.4 * unit, -4.1 * unit, 7.4 * unit, -3.0 * unit, 7.4 * unit, -1.5 * unit)
    ctx.bezierCurveTo(8.0 * unit, -2.6 * unit, 9.2 * unit, -3.0 * unit, 10.3 * unit, -2.5 * unit)
    ctx.bezierCurveTo(11.4 * unit, -2.0 * unit, 12.0 * unit, -0.9 * unit, 12.0 * unit, 0.3 * unit)
    ctx.lineTo(12.0 * unit, 3.2 * unit)
    ctx.bezierCurveTo(12.0 * unit, 7.2 * unit, 9.1 * unit, 10.1 * unit, 5.2 * unit, 10.1 * unit)
    ctx.lineTo(0.8 * unit, 10.1 * unit)
    ctx.bezierCurveTo(-0.1 * unit, 10.1 * unit, -1.0 * unit, 10.0 * unit, -1.8 * unit, 9.8 * unit)
    ctx.closePath()
    ctx.stroke()

    // A restrained ripple at the fingertip reads as a tap without changing the hand.
    const rippleProgress = Math.min(1, Math.max(0, (progress - 0.34) / 0.36))
    if (rippleProgress > 0 && rippleProgress < 1) {
      ctx.save()
      ctx.globalAlpha *= 1 - rippleProgress
      ctx.lineWidth = Math.max(1, 1.25 * unit)
      ctx.beginPath()
      ctx.arc(-0.4 * unit, -12.6 * unit, (2.1 + rippleProgress * 3.2) * unit, Math.PI * 1.08, Math.PI * 1.92)
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  }

  private drawScore(ctx: CanvasRenderingContext2D, rect: Rect, redRect: Rect, blueRect: Rect) {
    const radius = 20
    const centerX = rect.x + rect.w / 2
    const centerY = rect.y + rect.h / 2
    const redX = redRect.x + redRect.w / 2
    const blueX = blueRect.x + blueRect.w / 2

    ctx.save()
    ctx.shadowColor = 'rgba(47, 107, 79, 0.14)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
    ctx.fillStyle = '#FFFEFB'
    ctx.fill()
    ctx.restore()

    ctx.save()
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
    ctx.clip()
    const redFill = ctx.createLinearGradient(rect.x, rect.y, centerX, rect.y)
    redFill.addColorStop(0, '#FFE9E4')
    redFill.addColorStop(1, '#FFF8F5')
    ctx.fillStyle = redFill
    ctx.fillRect(rect.x, rect.y, rect.w / 2, rect.h)
    const blueFill = ctx.createLinearGradient(centerX, rect.y, rect.x + rect.w, rect.y)
    blueFill.addColorStop(0, '#F8FAFF')
    blueFill.addColorStop(1, '#E8F0FF')
    ctx.fillStyle = blueFill
    ctx.fillRect(centerX, rect.y, rect.w / 2, rect.h)
    ctx.restore()

    ctx.save()
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
    ctx.strokeStyle = '#B9DEC9'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

    text(ctx, '红方', redX, rect.y + 14, 11, '#C85C51', 'center', '600')
    text(ctx, '蓝方', blueX, rect.y + 14, 11, '#5474BC', 'center', '600')
    text(ctx, String(this.match.scoreRed), redX, rect.y + 39, 29, '#F25A4B', 'center', '700')
    text(ctx, String(this.match.scoreBlue), blueX, rect.y + 39, 29, '#507ADB', 'center', '700')

    ctx.save()
    ctx.shadowColor = 'rgba(36, 53, 47, 0.18)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, 18, 0, Math.PI * 2)
    ctx.fillStyle = '#2F6B57'
    ctx.fill()
    ctx.restore()
    text(ctx, 'VS', centerX, centerY, 12, '#FFFFFF', 'center', '700')
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
    paintDialogMask(ctx, width, height, easeOut((t - this.dialogAt) / MASK_IN_MS))
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
    })
    const cardAnchor = this.paintSuccessCard(ctx, slots, fontSize, t)

    const p = easeOut((t - this.dialogAt) / DIALOG_IN_MS)
    const scale = 0.97 + 0.03 * p
    const dialogW = Math.min(400, width - 48)
    const dialogKind = duelDialog(this.match)

    if (dialogKind === 'handoff') {
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
      text(ctx, '很遗憾，本次作答没有成功。', dialogCx, dialog.y + 64, 15, Color.muted, 'center', '500')
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

    if (dialogKind === 'round-fail') {
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
      text(ctx, '很遗憾，本次作答没有成功。', dialogCx, dialog.y + 64, 15, Color.muted, 'center', '500')
      text(ctx, '本局结束。', dialogCx, dialog.y + 92, 15, Color.muted, 'center', '500')
      const next = { x: dialog.x + 24, y: dialog.y + 136, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, next, this.press.scale('dialog-next', t), () => {
        menuButton(ctx, next, '下一局', 'ghost')
      })
      this.hits.push({ rect: next, hit: { kind: 'dialog-next' } })
      ctx.restore()
      return
    }

    if (dialogKind === 'match-end') {
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
      text(ctx, `${winnerText}拿到了${DUEL_TARGET}分！`, dialogCx, dialog.y + 106, 14, Color.muted)
      const rematch = { x: dialog.x + 24, y: dialog.y + 180, w: dialog.w - 48, h: 50 }
      withButtonScale(ctx, rematch, this.press.scale('dialog-rematch', t), () => {
        menuButton(ctx, rematch, '再来一场', 'ghost')
      })
      this.hits.push({ rect: rematch, hit: { kind: 'dialog-rematch' } })
      ctx.restore()
      return
    }

    if (dialogKind === 'answer') {
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

    if (dialogKind === 'round-success') {
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
    if (!duelSettlesSuccess(this.match) || this.state.cards.length !== 1) {
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
