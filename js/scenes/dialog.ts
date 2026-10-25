import { easeOut } from './board'
import {
  Color,
  fillRound,
  menuButton,
  withButtonScale,
  type Rect,
} from '../ui'

export const DIALOG_IN_MS = 220
export const MASK_IN_MS = 360

export type DialogTight = 'center' | 'bottom' | 'clamp-below'

export function dialogMotion(elapsed: number) {
  return {
    scale: 0.97 + 0.03 * easeOut(elapsed / DIALOG_IN_MS),
    mask: easeOut(elapsed / MASK_IN_MS),
  }
}

export function dialogRect(
  width: number,
  height: number,
  dialogH: number,
  anchorBottom?: number | null,
  whenTight: DialogTight = 'center',
): Rect {
  const dialogW = Math.min(400, width - 48)
  const minY = 24
  const maxY = Math.max(minY, height - 24 - dialogH)
  const centered = Math.min(Math.max(minY, (height - dialogH) / 2), maxY)
  let dialogY = centered
  if (anchorBottom != null) {
    const below = anchorBottom + 24
    if (below + dialogH <= height - 24) {
      dialogY = below
    } else if (whenTight === 'bottom' || whenTight === 'clamp-below') {
      dialogY = maxY
    }
  }
  return {
    x: (width - dialogW) / 2,
    y: Math.min(Math.max(dialogY, minY), maxY),
    w: dialogW,
    h: dialogH,
  }
}

export function dialogButtonRect(dialog: Rect, y: number): Rect {
  return { x: dialog.x + 24, y: dialog.y + y, w: dialog.w - 48, h: 50 }
}

export function openDialog(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  scale: number,
  draw: (rect: Rect) => void,
) {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  fillRound(ctx, rect, Color.paper, 20, true)
  draw(rect)
  ctx.restore()
}

export function paintDialogButton(
  ctx: CanvasRenderingContext2D,
  dialog: Rect,
  y: number,
  label: string,
  scale: number,
): Rect {
  const rect = dialogButtonRect(dialog, y)
  withButtonScale(ctx, rect, scale, () => {
    menuButton(ctx, rect, label, 'ghost')
  })
  return rect
}
