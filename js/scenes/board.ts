import { formatFraction, type Fraction, type Op } from '../game/fraction'
import {
  Color,
  Menu,
  fillRound,
  menuInk,
  paintMenuChrome,
  strokeRound,
  text,
  type Rect,
} from '../ui'

export const SELECT_MS = 180
export const FLY_MS = 220
export const DEAL_CARD_MS = 320
export const RESULT_POP_MS = DEAL_CARD_MS
export const MERGE_MS = FLY_MS + RESULT_POP_MS
export const FADE_OUT_MS = 160
export const SETTLE_MOVE_MS = 560
export const SETTLE_MS = 780
export const OP_PULSE_MS = 160
export const OP_SHAKE_MS = 360

export type Face = { slot: number; value: Fraction }

export type Motion =
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

export type CardLook = {
  scale?: number
  alpha?: number
  dx?: number
  dy?: number
  selected?: boolean
  glow?: number
  numberScale?: number
}

export type SettleLook = {
  result: 'success' | 'fail' | ''
  dialogOpen: boolean
  cardCount: number
  last?: { id: number; slot: number }
}

export function playFrame(width: number): {
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

export function tableLayout(
  width: number,
  height: number,
  minTop: number,
  bottomPad: number,
  extraBelow = 0,
) {
  const frame = playFrame(width)
  const gap = 16
  const cardW = Math.min(120, (frame.play.w - 48 - gap) / 2)
  const cardH = cardW * (88 / 63)
  const fontSize = cardW > 90 ? 32 : 26
  const opH = 56
  const belowCards = 28
  const stackH = cardH * 2 + gap + belowCards + opH + extraBelow
  const floorTop = height - bottomPad - stackH
  const topY = frame.side ? minTop + Math.max(0, floorTop - minTop) * 0.42 : minTop
  const slots = slotRects(frame.play.x, frame.play.w, topY, cardW, cardH, gap)
  const opGap = 12
  const opW = (frame.play.w - 32 - opGap * 3) / 4
  const opY = slots[2].y + slots[2].h + belowCards
  const ops = [0, 1, 2, 3].map((index) => ({
    x: frame.play.x + 16 + index * (opW + opGap),
    y: opY,
    w: opW,
    h: opH,
  }))
  return { frame, cardW, cardH, fontSize, slots, ops, opY, opH }
}

export function slotRects(
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

export function dealDuration(fadeFrom?: Face[]) {
  return (fadeFrom ? FADE_OUT_MS : 0) + DEAL_CARD_MS
}

export function clamp01(value: number) {
  if (value <= 0) {
    return 0
  }
  if (value >= 1) {
    return 1
  }
  return value
}

export function easeOut(value: number) {
  const t = clamp01(value)
  return 1 - (1 - t) * (1 - t) * (1 - t)
}

export function easeInOut(value: number) {
  const t = clamp01(value)
  return 0.5 - 0.5 * Math.cos(Math.PI * t)
}

export function centerDelta(slots: Rect[], slot: number): { dx: number; dy: number } {
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

export function dealExpand(progress: number): { scale: number } {
  return { scale: 0.96 + 0.04 * easeOut(progress) }
}

export function popScale(progress: number, end = 1) {
  return 0.94 + (end - 0.94) * easeInOut(progress)
}

export function cardLook(input: {
  id: number
  slot: number
  slots: Rect[]
  t: number
  motion: Motion
  selectedId: number
  selectAt: number
  settle?: SettleLook
}): CardLook | null {
  const { id, slot, slots, t, motion, selectedId, selectAt, settle } = input
  if (motion.kind === 'dealing') {
    const local = (t - motion.at - (motion.fadeFrom ? FADE_OUT_MS : 0)) / DEAL_CARD_MS
    if (local < 0) {
      return null
    }
    return { scale: dealExpand(local).scale }
  }
  if (motion.kind === 'merging') {
    const elapsed = t - motion.at
    if (id === motion.resultId) {
      if (elapsed < FLY_MS) {
        return null
      }
      const selected = id === selectedId
      const cardEnd = selected ? 1.04 : 1
      const p = (elapsed - FLY_MS) / RESULT_POP_MS
      return {
        scale: popScale(p, cardEnd),
        numberScale: 0.8 + 0.2 * easeOut(p),
        selected,
      }
    }
  }
  if (settle) {
    const last = settle.last
    const showLastCentered =
      Boolean(settle.result) &&
      last &&
      last.slot === slot &&
      last.id === id &&
      settle.cardCount === 1
    if (showLastCentered && (motion.kind === 'settling' || settle.dialogOpen)) {
      const delta = centerDelta(slots, slot)
      const p = motion.kind === 'settling' ? easeOut((t - motion.at) / SETTLE_MOVE_MS) : 1
      const success = settle.result === 'success'
      return {
        dx: delta.dx * p,
        dy: delta.dy * p,
        selected: success,
        glow: success ? 0.45 : 0,
      }
    }
  }
  if (id === selectedId) {
    const p = easeOut((t - selectAt) / SELECT_MS)
    return { scale: 1 + 0.04 * p, selected: true, numberScale: 1 }
  }
  return {}
}

export function drawDealFade(
  ctx: CanvasRenderingContext2D,
  slots: Rect[],
  fontSize: number,
  t: number,
  motion: Motion,
) {
  if (motion.kind !== 'dealing' || !motion.fadeFrom) {
    return
  }
  const p = clamp01((t - motion.at) / FADE_OUT_MS)
  if (p >= 1) {
    return
  }
  motion.fadeFrom.forEach((face) => {
    drawPlayCard(ctx, {
      rect: slots[face.slot],
      label: formatFraction(face.value),
      fontSize,
      scale: 1 - 0.06 * p,
    })
  })
}

export function drawMergeFlight(
  ctx: CanvasRenderingContext2D,
  slots: Rect[],
  fontSize: number,
  t: number,
  motion: Motion,
) {
  if (motion.kind !== 'merging') {
    return
  }
  const elapsed = t - motion.at
  if (elapsed >= FLY_MS) {
    return
  }
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

export function drawPlayCard(
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

export function drawSuccessBurst(
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

export function drawOp(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  op: Op,
  t: number,
  input: { selected: boolean; shakeAt: number | null; pulseAt: number },
): { shakeDone: boolean } {
  let dx = 0
  let scale = 1
  let shakeDone = false
  if (input.shakeAt !== null) {
    const p = clamp01((t - input.shakeAt) / OP_SHAKE_MS)
    dx = Math.sin(p * Math.PI * 4) * 3 * (1 - p)
    if (p >= 1) {
      shakeDone = true
    }
  }
  if (input.selected) {
    const p = easeOut((t - input.pulseAt) / OP_PULSE_MS)
    scale = 0.98 + 0.02 * p
  }
  const kind = input.selected ? 'blush' : 'ghost'
  ctx.save()
  ctx.translate(dx, 0)
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2)
  ctx.scale(scale, scale)
  ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2))
  paintMenuChrome(ctx, rect, kind, 10)
  text(ctx, op, rect.x + rect.w / 2, rect.y + rect.h / 2, 24, menuInk(kind), 'center', '700')
  ctx.restore()
  return { shakeDone }
}

export function panelCard(rect: Rect): Rect | null {
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

export function drawCopyCard(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  expression: string,
  steps: string[],
) {
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

export function drawGreenCheck(ctx: CanvasRenderingContext2D, x: number, y: number) {
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
