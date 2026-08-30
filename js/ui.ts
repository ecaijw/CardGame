export type Rect = { x: number; y: number; w: number; h: number }

export const Color = {
  bg: '#7DB8A8',
  paper: '#FFFFFF',
  ink: '#2C2C2C',
  muted: '#4A6670',
  coral: '#E85A4F',
  gold: '#F5C542',
  lime: '#8FCB6D',
  shadow: 'rgba(30, 50, 48, 0.16)',
  mask: 'rgba(30, 40, 38, 0.45)',
}

export function hit(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function fillRound(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  fill: string,
  radius: number,
  shadow = false,
) {
  ctx.save()
  if (shadow) {
    ctx.shadowColor = Color.shadow
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
  }
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()
}

export function strokeRound(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  stroke: string,
  radius: number,
  width = 3,
) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
}

export function text(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'center',
  weight = '600',
) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y)
}

export function button(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  kind: 'primary' | 'ghost' | 'plain' | 'disabled' = 'plain',
) {
  const fill =
    kind === 'primary' ? Color.coral : kind === 'disabled' ? '#D7E6E1' : Color.paper
  const ink = kind === 'primary' ? Color.paper : kind === 'disabled' ? '#8AA39C' : Color.ink
  fillRound(ctx, rect, fill, rect.h / 2, kind !== 'disabled')
  if (kind === 'ghost') {
    strokeRound(ctx, rect, Color.ink, rect.h / 2, 2)
  }
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, 16, ink)
}
