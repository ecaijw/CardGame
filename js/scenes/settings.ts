import {
  loadMusicEnabled,
  loadSoundEnabled,
  loadStats,
  setMusicEnabled,
  setSoundEnabled,
} from '../settings'
import {
  Color,
  Menu,
  drawMenuBackground,
  drawToggle,
  fillRound,
  hit,
  menuButton,
  menuTitle,
  text,
  type Rect,
} from '../ui'

type Hit = { rect: Rect; action: 'back' | 'sound' | 'music' }

export class SettingsScene {
  private hits: Hit[] = []
  private sound = loadSoundEnabled()
  private music = loadMusicEnabled()

  tap(x: number, y: number): 'back' | '' {
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (!found) {
      return ''
    }
    if (found.action === 'sound') {
      this.sound = !this.sound
      setSoundEnabled(this.sound)
      return ''
    }
    if (found.action === 'music') {
      this.music = !this.music
      setMusicEnabled(this.music)
      return ''
    }
    return 'back'
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.hits = []
    drawMenuBackground(ctx, width, height)
    let titleY = 52
    try {
      const cap = wx.getMenuButtonBoundingClientRect()
      if (cap && cap.bottom) {
        titleY = cap.bottom + 20
      }
    } catch {
      // ignore
    }
    menuTitle(ctx, '设置', width / 2, titleY, 28)
    const stats = loadStats()
    const card = { x: 24, y: titleY + 36, w: width - 48, h: 188 }
    fillRound(ctx, card, Menu.paper, 16, true)
    text(ctx, '对局统计', card.x + 20, card.y + 28, 15, Menu.subtitle, 'left', '600')
    text(ctx, `连胜 ${stats.streak}`, card.x + card.w - 20, card.y + 28, 15, Menu.title, 'right', '700')
    const colW = (card.w - 40) / 3
    drawStat(ctx, card.x + 20, card.y + 58, colW, '总数', stats.deals, '#7DB8A8', 'list')
    drawStat(ctx, card.x + 20 + colW, card.y + 58, colW, '成功', stats.wins, '#8FCB6D', 'ok')
    drawStat(ctx, card.x + 20 + colW * 2, card.y + 58, colW, '失败', stats.losses, Color.coral, 'no')

    const audio = { x: 24, y: card.y + card.h + 16, w: width - 48, h: 132 }
    fillRound(ctx, audio, Menu.paper, 16, true)
    const soundRow = { x: audio.x + 20, y: audio.y + 18, w: audio.w - 40, h: 48 }
    const musicRow = { x: audio.x + 20, y: audio.y + 70, w: audio.w - 40, h: 48 }
    text(ctx, '音效', soundRow.x, soundRow.y + 24, 16, Menu.buttonInk, 'left', '600')
    text(ctx, '音乐', musicRow.x, musicRow.y + 24, 16, Menu.buttonInk, 'left', '600')
    const soundToggle = { x: soundRow.x + soundRow.w - 52, y: soundRow.y + 10, w: 52, h: 28 }
    const musicToggle = { x: musicRow.x + musicRow.w - 52, y: musicRow.y + 10, w: 52, h: 28 }
    drawToggle(ctx, soundToggle, this.sound)
    drawToggle(ctx, musicToggle, this.music)
    this.hits.push({ rect: soundRow, action: 'sound' }, { rect: musicRow, action: 'music' })

    const back = { x: 40, y: audio.y + audio.h + 24, w: width - 80, h: 50 }
    menuButton(ctx, back, '返回', 'ghost')
    this.hits.push({ rect: back, action: 'back' })
  }
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  value: number,
  color: string,
  icon: 'list' | 'ok' | 'no',
) {
  const cx = x + w / 2
  drawStatIcon(ctx, cx, y + 18, color, icon)
  text(ctx, String(value), cx, y + 52, 22, Menu.buttonInk, 'center', '700')
  text(ctx, label, cx, y + 78, 13, Menu.subtitle, 'center', '500')
}

function drawStatIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  icon: 'list' | 'ok' | 'no',
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (icon === 'list') {
    ctx.strokeRect(cx - 9, cy - 8, 18, 16)
    ctx.beginPath()
    ctx.moveTo(cx - 5, cy - 3)
    ctx.lineTo(cx + 5, cy - 3)
    ctx.moveTo(cx - 5, cy + 2)
    ctx.lineTo(cx + 5, cy + 2)
    ctx.moveTo(cx - 5, cy + 7)
    ctx.lineTo(cx + 2, cy + 7)
    ctx.stroke()
  } else if (icon === 'ok') {
    ctx.beginPath()
    ctx.arc(cx, cy, 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 4, cy)
    ctx.lineTo(cx - 1, cy + 4)
    ctx.lineTo(cx + 5, cy - 4)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(cx, cy, 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 3.5, cy - 3.5)
    ctx.lineTo(cx + 3.5, cy + 3.5)
    ctx.moveTo(cx + 3.5, cy - 3.5)
    ctx.lineTo(cx - 3.5, cy + 3.5)
    ctx.stroke()
  }
  ctx.restore()
}
