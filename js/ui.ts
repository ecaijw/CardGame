export type Rect = { x: number; y: number; w: number; h: number }

export const Color = {
  bg: '#7DB8A8',
  paper: '#FFFFFF',
  ink: '#2C2C2C',
  muted: '#4A6670',
  coral: '#E85A4F',
  pine: '#2F6B4F',
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

export type MenuKind = 'primary' | 'ghost' | 'mint' | 'blush'

export function menuInk(kind: MenuKind) {
  if (kind === 'primary') {
    return Color.paper
  }
  if (kind === 'blush') {
    return Menu.title
  }
  return Menu.buttonInk
}

export function menuSurface(kind: MenuKind) {
  if (kind === 'blush') {
    return '#FFD4C8'
  }
  if (kind === 'mint') {
    return '#E3F4EA'
  }
  return Menu.paper
}

export function paintMenuChrome(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  kind: MenuKind,
  radius = rect.h / 2,
) {
  ctx.save()
  ctx.shadowColor = kind === 'primary' ? 'rgba(242, 85, 66, 0.22)' : 'rgba(36, 53, 47, 0.08)'
  ctx.shadowBlur = kind === 'primary' ? 12 : 8
  ctx.shadowOffsetY = 3
  if (kind === 'primary') {
    const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h)
    fill.addColorStop(0, '#FF6D57')
    fill.addColorStop(1, '#F25542')
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius)
    ctx.fillStyle = fill
    ctx.fill()
  } else {
    fillRound(ctx, rect, menuSurface(kind), radius)
  }
  ctx.restore()
  if (kind === 'ghost') {
    strokeRound(ctx, rect, '#D7EEE4', radius, 1.25)
  }
}

export function button(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  kind: 'primary' | 'ghost' | 'plain' | 'disabled' = 'plain',
) {
  const menuKind: MenuKind = kind === 'primary' ? 'primary' : 'ghost'
  menuButton(ctx, rect, label, menuKind)
}

export const Menu = {
  title: '#F25542',
  titleStroke: '#FFF1D8',
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
  drawMenuGlow(ctx, width, height)
  drawMenuHills(ctx, width, height)
}

function drawMenuGlow(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.fillStyle = 'rgba(209, 239, 221, 0.42)'
  ctx.beginPath()
  ctx.arc(-width * 0.06, height * 0.02, width * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.beginPath()
  ctx.arc(width * 1.06, height * 0.44, width * 0.32, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawMenuHills(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.fillStyle = '#C5E9D2'
  ctx.beginPath()
  ctx.moveTo(0, height)
  ctx.lineTo(0, height * 0.76)
  ctx.bezierCurveTo(width * 0.16, height * 0.69, width * 0.38, height * 0.72, width * 0.58, height * 0.8)
  ctx.bezierCurveTo(width * 0.78, height * 0.88, width * 0.9, height * 0.76, width, height * 0.75)
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#AFDCBE'
  ctx.beginPath()
  ctx.moveTo(0, height)
  ctx.lineTo(0, height * 0.88)
  ctx.bezierCurveTo(width * 0.2, height * 0.82, width * 0.4, height * 0.84, width * 0.62, height * 0.91)
  ctx.bezierCurveTo(width * 0.8, height * 0.97, width * 0.92, height * 0.87, width, height * 0.85)
  ctx.lineTo(width, height)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#8FC9A7'
  ctx.beginPath()
  ctx.moveTo(0, height)
  ctx.lineTo(0, height * 0.94)
  ctx.bezierCurveTo(width * 0.24, height * 0.86, width * 0.52, height * 0.94, width * 0.72, height)
  ctx.closePath()
  ctx.fill()
  drawSprig(ctx, width * 0.17, height * 0.82, 15, -0.08, '#69B487')
  drawSprig(ctx, width * 0.84, height * 0.82, 17, 0.08, '#69B487')
  drawPlant(ctx, -4, height + 8, 55, -0.08)
  drawPlant(ctx, width + 5, height + 8, 58, 0.08)
  ctx.restore()
}

function drawSprig(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tilt: number,
  color: string,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, 2)
  ctx.quadraticCurveTo(0, -size * 0.45, 0, -size)
  ctx.stroke()
  ctx.fillStyle = color
  drawLeafShape(ctx, -size * 0.18, -size * 0.62, size * 0.28, size * 0.48, -0.65)
  drawLeafShape(ctx, size * 0.18, -size * 0.78, size * 0.27, size * 0.48, 0.7)
  ctx.restore()
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tilt: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.fillStyle = '#65AE83'
  drawLeafShape(ctx, size * 0.28, -size * 0.65, size * 0.22, size * 0.72, 0.58)
  drawLeafShape(ctx, size * 0.54, -size * 0.42, size * 0.2, size * 0.65, 0.95)
  drawLeafShape(ctx, size * 0.12, -size * 0.35, size * 0.2, size * 0.58, 0.25)
  ctx.restore()
}

function drawLeafShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.beginPath()
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  } else {
    ctx.moveTo(0, -ry)
    ctx.quadraticCurveTo(rx, 0, 0, ry)
    ctx.quadraticCurveTo(-rx, 0, 0, -ry)
  }
  ctx.fill()
  ctx.restore()
}

export function menuButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  kind: MenuKind,
) {
  paintMenuChrome(ctx, rect, kind)
  text(
    ctx,
    label,
    rect.x + rect.w / 2,
    rect.y + rect.h / 2,
    kind === 'primary' ? 18 : 16,
    menuInk(kind),
    'center',
    '600',
  )
}

export type ActionIcon = 'restart' | 'next' | 'answer' | 'difficulty' | 'settings'

export function iconButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  kind: MenuKind,
  icon: ActionIcon,
) {
  paintMenuChrome(ctx, rect, kind)
  const cx = rect.x + rect.w / 2
  const ink = menuInk(kind)
  const iconSize = Math.min(rect.w * 0.34, 20)
  drawActionIcon(ctx, cx, rect.y + 16, iconSize, icon, ink, kind)
  text(ctx, label, cx, rect.y + rect.h - 12, 11, ink, 'center', '600')
}

export function iconLabelButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  kind: MenuKind,
  icon: ActionIcon,
) {
  paintMenuChrome(ctx, rect, kind)
  const ink = menuInk(kind)
  const cy = rect.y + rect.h / 2
  const iconSize = 16
  const gap = 6
  ctx.save()
  ctx.font = `600 13px "PingFang SC","PingFangSC-Semibold","Hiragino Sans GB","Heiti SC",sans-serif`
  const textW = ctx.measureText(label).width
  ctx.restore()
  const total = iconSize + gap + textW
  const start = rect.x + (rect.w - total) / 2
  drawActionIcon(ctx, start + iconSize / 2, cy, iconSize, icon, ink, kind)
  text(ctx, label, start + iconSize + gap, cy, 13, ink, 'left', '600')
}

export function withButtonScale(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  scale: number,
  draw: () => void,
) {
  if (Math.abs(scale - 1) < 0.002) {
    draw()
    return
  }
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  draw()
  ctx.restore()
}

export function drawSegmentBar(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  items: Array<{ label: string; icon: ActionIcon; active?: boolean; scale?: number }>,
) {
  paintMenuChrome(ctx, rect, 'ghost')
  const cellW = rect.w / items.length
  items.forEach((item, index) => {
    const cell = { x: rect.x + index * cellW, y: rect.y + 3, w: cellW, h: rect.h - 6 }
    const kind: MenuKind = item.active ? 'blush' : 'ghost'
    withButtonScale(ctx, cell, item.scale ?? 1, () => {
      if (item.active) {
        const inset = { x: cell.x + 6, y: cell.y, w: cell.w - 12, h: cell.h }
        fillRound(ctx, inset, menuSurface('blush'), inset.h / 2)
      }
      const cx = cell.x + cell.w / 2
      const ink = menuInk(kind)
      drawActionIcon(ctx, cx, cell.y + 11, 14, item.icon, ink, kind)
      text(ctx, item.label, cx, cell.y + cell.h - 10, 13, ink, 'center', '600')
    })
    if (index > 0 && !item.active && !items[index - 1]?.active) {
      ctx.beginPath()
      ctx.strokeStyle = '#D7EEE4'
      ctx.lineWidth = 1
      const x = cell.x
      ctx.moveTo(x, rect.y + 14)
      ctx.lineTo(x, rect.y + rect.h - 14)
      ctx.stroke()
    }
  })
}

export function drawActionIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  icon: ActionIcon,
  color: string,
  kind: MenuKind = 'ghost',
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(2.2, size * 0.1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (icon === 'restart') {
    const r = size * 0.36
    ctx.beginPath()
    ctx.arc(cx, cy + 1, r, Math.PI * 0.2, Math.PI * 1.75)
    ctx.stroke()
    const a = Math.PI * 0.2
    const x = cx + Math.cos(a) * r
    const y = cy + 1 + Math.sin(a) * r
    ctx.beginPath()
    ctx.moveTo(x - size * 0.16, y - size * 0.02)
    ctx.lineTo(x + size * 0.02, y + size * 0.18)
    ctx.lineTo(x + size * 0.18, y - size * 0.08)
    ctx.stroke()
  } else if (icon === 'next') {
    ctx.beginPath()
    ctx.moveTo(cx - size * 0.22, cy - size * 0.28)
    ctx.lineTo(cx + size * 0.16, cy)
    ctx.lineTo(cx - size * 0.22, cy + size * 0.28)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + size * 0.3, cy - size * 0.28)
    ctx.lineTo(cx + size * 0.3, cy + size * 0.28)
    ctx.stroke()
  } else if (icon === 'answer') {
    ctx.beginPath()
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy, size * 0.42, size * 0.26, 0, 0, Math.PI * 2)
    } else {
      ctx.moveTo(cx - size * 0.42, cy)
      ctx.quadraticCurveTo(cx, cy - size * 0.32, cx + size * 0.42, cy)
      ctx.quadraticCurveTo(cx, cy + size * 0.32, cx - size * 0.42, cy)
    }
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.12, 0, Math.PI * 2)
    ctx.fill()
  } else if (icon === 'difficulty') {
    const barW = size * 0.16
    const gap = size * 0.1
    const hs = [0.28, 0.42, 0.58]
    hs.forEach((h, i) => {
      const x = cx - size * 0.3 + i * (barW + gap)
      const y = cy + size * 0.28 - size * h
      roundRect(ctx, x, y, barW, size * h, 2)
      ctx.fill()
    })
  } else {
    drawGear(ctx, cx, cy, size * 0.42, color, kind === 'primary' ? '#F25542' : menuSurface(kind))
  }
  ctx.restore()
}

export function drawMenuFan(
  ctx: CanvasRenderingContext2D,
  width: number,
  top: number,
  nums: [number, number, number, number] = [1, 2, 3, 8],
): number {
  const gap = 11
  const cardW = Math.min(78, (width - 30 - gap * 3) / 4)
  const cardH = cardW * 1.25
  const total = cardW * 4 + gap * 3
  const left = (width - total) / 2
  const lifts = [10, 0, 0, 10]
  const angles = [-0.12, -0.04, 0.04, 0.12]
  text(ctx, '+', left - 7, top + 7, 16, Menu.accent, 'center', '700')
  drawSprig(ctx, left + total + 4, top + 8, 13, 0.2, '#69B487')
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
    strokeRound(ctx, rect, '#D7EEE4', 14, 1.25)
    ctx.restore()
    ctx.save()
    ctx.translate(x + cardW / 2, y + cardH / 2)
    ctx.rotate(angles[index])
    text(ctx, String(n), 0, 0, cardW > 64 ? 32 : 27, Menu.title, 'center', '800')
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
  const naturalWidth = ctx.measureText(label).width
  const scaleX = 1.08
  const width = naturalWidth * scaleX
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scaleX, 1)
  drawTitleWord(ctx, label, 0, 0, size)
  ctx.restore()
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
  ctx.lineWidth = Math.max(6, size * 0.13)
  ctx.shadowColor = Menu.titleShadow
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 3
  ctx.strokeStyle = Menu.titleStroke
  ctx.fillStyle = Menu.title
  ctx.strokeText(word, x, y)
  ctx.shadowColor = 'transparent'
  ctx.fillText(word, x, y)
  ctx.restore()
}

export function drawGear(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  holeFill = Color.paper,
) {
  const teeth = 8
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.66
    const a = (i * Math.PI) / teeth - Math.PI / (teeth * 2)
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = holeFill
  ctx.fill()
  ctx.restore()
}

export function drawSettingsHit(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  color: string,
) {
  const cy = rect.y + rect.h / 2
  drawGear(ctx, rect.x + 16, cy, 8, color)
  text(ctx, '设置', rect.x + 30, cy, 13, color, 'left', '600')
}

export function drawToggle(ctx: CanvasRenderingContext2D, rect: Rect, on: boolean) {
  const fill = on ? '#7DB8A8' : '#D5E0DC'
  fillRound(ctx, rect, fill, rect.h / 2)
  const pad = 3
  const r = rect.h / 2 - pad
  const cx = on ? rect.x + rect.w - pad - r : rect.x + pad + r
  ctx.beginPath()
  ctx.arc(cx, rect.y + rect.h / 2, r, 0, Math.PI * 2)
  ctx.fillStyle = Color.paper
  ctx.fill()
}
