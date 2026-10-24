import {
  playSfx,
  setMusicEnabled as applyMusicEnabled,
  setSfxEnabled,
} from '../audio/audio-manager'
import {
  DUEL_ANSWER_MAX_SEC,
  DUEL_ANSWER_MIN_SEC,
} from '../game/duel'
import {
  bumpDuelAnswerSeconds,
  loadDuelAnswerSeconds,
  loadDuelStats,
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

type Hit = { rect: Rect; action: 'back' | 'sound' | 'music' | 'answer-minus' | 'answer-plus' }

export class SettingsScene {
  private hits: Hit[] = []
  private sound = loadSoundEnabled()
  private music = loadMusicEnabled()
  private answerSeconds = loadDuelAnswerSeconds()

  tap(x: number, y: number): 'back' | '' {
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (!found) {
      return ''
    }
    if (found.action === 'sound') {
      this.sound = !this.sound
      setSoundEnabled(this.sound)
      setSfxEnabled(this.sound)
      playSfx('tap')
      return ''
    }
    if (found.action === 'music') {
      this.music = !this.music
      setMusicEnabled(this.music)
      applyMusicEnabled(this.music)
      playSfx('tap')
      return ''
    }
    if (found.action === 'answer-minus') {
      this.answerSeconds = bumpDuelAnswerSeconds(-1)
      playSfx('tap')
      return ''
    }
    if (found.action === 'answer-plus') {
      this.answerSeconds = bumpDuelAnswerSeconds(1)
      playSfx('tap')
      return ''
    }
    return 'back'
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.hits = []
    this.answerSeconds = loadDuelAnswerSeconds()
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
    const card = { x: 24, y: titleY + 36, w: width - 48, h: 168 }
    fillRound(ctx, card, Menu.paper, 16, true)
    text(ctx, '对局统计', card.x + 20, card.y + 24, 15, Menu.subtitle, 'left', '600')
    text(ctx, `连胜 ${stats.streak}`, card.x + card.w - 20, card.y + 24, 15, Menu.title, 'right', '700')
    const colW = (card.w - 40) / 3
    drawStat(ctx, card.x + 20, card.y + 48, colW, '总数', stats.deals, '#7DB8A8', 'list')
    drawStat(ctx, card.x + 20 + colW, card.y + 48, colW, '成功', stats.wins, '#8FCB6D', 'ok')
    drawStat(ctx, card.x + 20 + colW * 2, card.y + 48, colW, '失败', stats.losses, Color.coral, 'no')

    const duelStats = loadDuelStats()
    const duelCard = { x: 24, y: card.y + card.h + 12, w: width - 48, h: 118 }
    fillRound(ctx, duelCard, Menu.paper, 16, true)
    text(ctx, '双人对战', duelCard.x + 20, duelCard.y + 24, 15, Menu.subtitle, 'left', '600')
    text(ctx, '红方', duelCard.x + duelCard.w * 0.55, duelCard.y + 24, 13, Menu.subtitle, 'center', '600')
    text(ctx, '蓝方', duelCard.x + duelCard.w * 0.82, duelCard.y + 24, 13, Menu.subtitle, 'center', '600')
    text(ctx, '胜利局数', duelCard.x + 20, duelCard.y + 58, 14, Menu.buttonInk, 'left', '500')
    text(
      ctx,
      String(duelStats.redRoundWins),
      duelCard.x + duelCard.w * 0.55,
      duelCard.y + 58,
      18,
      Menu.buttonInk,
      'center',
      '700',
    )
    text(
      ctx,
      String(duelStats.blueRoundWins),
      duelCard.x + duelCard.w * 0.82,
      duelCard.y + 58,
      18,
      Menu.buttonInk,
      'center',
      '700',
    )
    text(ctx, '胜利场数', duelCard.x + 20, duelCard.y + 92, 14, Menu.buttonInk, 'left', '500')
    text(
      ctx,
      String(duelStats.redMatchWins),
      duelCard.x + duelCard.w * 0.55,
      duelCard.y + 92,
      18,
      Menu.buttonInk,
      'center',
      '700',
    )
    text(
      ctx,
      String(duelStats.blueMatchWins),
      duelCard.x + duelCard.w * 0.82,
      duelCard.y + 92,
      18,
      Menu.buttonInk,
      'center',
      '700',
    )

    const duration = { x: 24, y: duelCard.y + duelCard.h + 12, w: width - 48, h: 64 }
    fillRound(ctx, duration, Menu.paper, 16, true)
    text(ctx, '双人对战答题时长', duration.x + 20, duration.y + 32, 15, Menu.buttonInk, 'left', '600')
    const minus = { x: duration.x + duration.w - 148, y: duration.y + 16, w: 36, h: 32 }
    const plus = { x: duration.x + duration.w - 56, y: duration.y + 16, w: 36, h: 32 }
    const canMinus = this.answerSeconds > DUEL_ANSWER_MIN_SEC
    const canPlus = this.answerSeconds < DUEL_ANSWER_MAX_SEC
    fillRound(ctx, minus, canMinus ? '#E3F4EA' : '#EEF2F0', 10, true)
    fillRound(ctx, plus, canPlus ? '#E3F4EA' : '#EEF2F0', 10, true)
    text(ctx, '−', minus.x + minus.w / 2, minus.y + minus.h / 2, 20, canMinus ? Menu.buttonInk : Color.muted, 'center', '700')
    text(ctx, '+', plus.x + plus.w / 2, plus.y + plus.h / 2, 20, canPlus ? Menu.buttonInk : Color.muted, 'center', '700')
    text(
      ctx,
      `${this.answerSeconds}秒`,
      (minus.x + minus.w + plus.x) / 2,
      duration.y + 32,
      16,
      Menu.title,
      'center',
      '700',
    )
    if (canMinus) {
      this.hits.push({ rect: minus, action: 'answer-minus' })
    }
    if (canPlus) {
      this.hits.push({ rect: plus, action: 'answer-plus' })
    }

    const audio = { x: 24, y: duration.y + duration.h + 12, w: width - 48, h: 120 }
    fillRound(ctx, audio, Menu.paper, 16, true)
    const soundRow = { x: audio.x + 20, y: audio.y + 14, w: audio.w - 40, h: 44 }
    const musicRow = { x: audio.x + 20, y: audio.y + 64, w: audio.w - 40, h: 44 }
    text(ctx, '音效', soundRow.x, soundRow.y + 22, 16, Menu.buttonInk, 'left', '600')
    text(ctx, '音乐', musicRow.x, musicRow.y + 22, 16, Menu.buttonInk, 'left', '600')
    const soundToggle = { x: soundRow.x + soundRow.w - 52, y: soundRow.y + 8, w: 52, h: 28 }
    const musicToggle = { x: musicRow.x + musicRow.w - 52, y: musicRow.y + 8, w: 52, h: 28 }
    drawToggle(ctx, soundToggle, this.sound)
    drawToggle(ctx, musicToggle, this.music)
    this.hits.push({ rect: soundRow, action: 'sound' }, { rect: musicRow, action: 'music' })

    const back = { x: 40, y: Math.min(audio.y + audio.h + 16, height - 66), w: width - 80, h: 50 }
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
  drawStatIcon(ctx, cx, y + 14, color, icon)
  text(ctx, String(value), cx, y + 44, 20, Menu.buttonInk, 'center', '700')
  text(ctx, label, cx, y + 68, 13, Menu.subtitle, 'center', '500')
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
