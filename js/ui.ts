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

const MENU_FONT = '"PingFang SC","PingFangSC-Semibold","Hiragino Sans GB","Heiti SC",sans-serif'

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
  ctx.font = `${weight} ${size}px ${MENU_FONT}`
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

export const Menu = {
  title: '#F25542',
  titleFill: '#FFF6E4',
  titleShadow: 'rgba(242, 85, 66, 0.2)',
  subtitle: '#4A5C56',
  primary: '#F25542',
  paper: '#FFFEFB',
  accent: '#F5C542',
  buttonInk: '#24352F',
}

export function drawMenuBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#F4FBF6')
  gradient.addColorStop(0.42, '#DFF3E7')
  gradient.addColorStop(1, '#C5E6D3')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  drawMenuHills(ctx, width, height)
}

function drawMenuHills(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.fillStyle = '#B6E0C5'
  ctx.beginPath()
  ctx.moveTo(0, height)
  ctx.lineTo(0, height * 0.72)
  ctx.bezierCurveTo(width * 0.16, height * 0.6, width * 0.4, height * 0.66, width * 0.58, height * 0.74)
  ctx.bezierCurveTo(width * 0.78, height * 0.84, width * 0.9, height * 0.68, width, height * 0.7)
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#94C9A9'
  ctx.beginPath()
  ctx.moveTo(0, height)
  ctx.lineTo(0, height * 0.88)
  ctx.bezierCurveTo(width * 0.24, height * 0.76, width * 0.5, height * 0.86, width * 0.74, height * 0.9)
  ctx.bezierCurveTo(width * 0.88, height * 0.94, width, height * 0.84, width, height * 0.86)
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fill()
  drawLeaf(ctx, width * 0.1, height * 0.8, 22, -0.6)
  drawLeaf(ctx, width * 0.9, height * 0.82, 24, 0.55)
  ctx.restore()
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tilt: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.fillStyle = '#5FA97A'
  ctx.beginPath()
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(size * 0.18, -size * 0.42, size * 0.28, size * 0.48, -0.35, 0, Math.PI * 2)
    ctx.ellipse(-size * 0.12, -size * 0.32, size * 0.22, size * 0.4, 0.4, 0, Math.PI * 2)
  } else {
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(size * 0.7, -size * 0.2, 0, -size)
    ctx.quadraticCurveTo(-size * 0.55, -size * 0.15, 0, 0)
  }
  ctx.fill()
  ctx.restore()
}

export function menuButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  kind: 'primary' | 'ghost',
) {
  ctx.save()
  ctx.shadowColor = kind === 'primary' ? 'rgba(242, 85, 66, 0.18)' : 'rgba(36, 53, 47, 0.08)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  if (kind === 'primary') {
    const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h)
    fill.addColorStop(0, '#FF6D57')
    fill.addColorStop(1, '#F25542')
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2)
    ctx.fillStyle = fill
    ctx.fill()
  } else {
    fillRound(ctx, rect, Menu.paper, rect.h / 2)
  }
  ctx.restore()
  text(
    ctx,
    label,
    rect.x + rect.w / 2,
    rect.y + rect.h / 2,
    kind === 'primary' ? 18 : 16,
    kind === 'primary' ? Color.paper : Menu.buttonInk,
    'center',
    '600',
  )
}

export function drawMenuFan(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  nums: [number, number, number, number] = [1, 2, 3, 8],
): number {
  const gap = 8
  const cardW = Math.min(62, (width - 72 - gap * 3) / 4)
  const cardH = cardW * 1.18
  const total = cardW * 4 + gap * 3
  const left = (width - total) / 2
  const lifts = [14, 2, 2, 14]
  const angles = [-0.24, -0.08, 0.08, 0.24]
  nums.forEach((n, index) => {
    const x = left + index * (cardW + gap)
    const y = top + lifts[index]
    ctx.save()
    ctx.translate(x + cardW / 2, y + cardH / 2)
    ctx.rotate(angles[index])
    ctx.shadowColor = 'rgba(36, 53, 47, 0.12)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    const rect = { x: -cardW / 2, y: -cardH / 2, w: cardW, h: cardH }
    fillRound(ctx, rect, Menu.paper, 14)
    ctx.shadowColor = 'transparent'
    strokeRound(ctx, rect, '#E8F2EC', 14, 1.5)
    ctx.restore()
    ctx.save()
    ctx.translate(x + cardW / 2, y + cardH / 2)
    ctx.rotate(angles[index])
    text(ctx, String(n), 0, 0, cardW > 52 ? 26 : 22, Menu.title, 'center', '800')
    ctx.restore()
  })
  return top + cardH + Math.max(...lifts)
}

export function menuTitle(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  size: number,
) {
  if (label === '数字算一算') {
    drawHomeTitle(ctx, x, y, size)
    return
  }
  drawTitleWord(ctx, label, x, y, size)
}

function drawHomeTitle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${MENU_FONT}`
  const label = '数字算一算'
  const width = ctx.measureText(label).width
  drawTitleWord(ctx, label, x, y, size)
  text(ctx, '+', x - width / 2 - 26, y + 2, 20, Menu.accent, 'center', '700')
  text(ctx, '×', x + width / 2 + 26, y + 6, 20, Menu.accent, 'center', '700')
  text(ctx, '+', x - width * 0.22, y - size * 0.62, 14, Menu.accent, 'center', '700')
}

function drawTitleWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  size: number,
) {
  ctx.save()
  ctx.font = `800 ${size}px ${MENU_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(6, size * 0.14)
  ctx.shadowColor = Menu.titleShadow
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 3
  ctx.strokeStyle = Menu.title
  ctx.fillStyle = Menu.titleFill
  ctx.strokeText(word, x, y)
  ctx.shadowColor = 'transparent'
  ctx.fillText(word, x, y)
  ctx.restore()
}
