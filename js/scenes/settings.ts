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
  type DuelStats,
  type GameStats,
} from '../settings'
import { playFrame } from './board'
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

export type SettingsLayout = {
  wide: boolean
  top: Rect | null
  bottom: Rect | null
  solo: Rect
  duel: Rect
  duration: Rect
  audio: Rect | null
  sound: Rect
  music: Rect
  back: Rect
  minus: Rect
  plus: Rect
  soundToggle: Rect
  musicToggle: Rect
}

export function settingsLayout(width: number, height: number, titleY: number): SettingsLayout {
  if (!playFrame(width).side) {
    const solo = { x: 24, y: titleY + 36, w: width - 48, h: 168 }
    const duel = { x: 24, y: solo.y + solo.h + 12, w: width - 48, h: 118 }
    const duration = { x: 24, y: duel.y + duel.h + 12, w: width - 48, h: 64 }
    const audio = { x: 24, y: duration.y + duration.h + 12, w: width - 48, h: 120 }
    const sound = { x: audio.x + 20, y: audio.y + 14, w: audio.w - 40, h: 44 }
    const music = { x: audio.x + 20, y: audio.y + 64, w: audio.w - 40, h: 44 }
    return {
      wide: false,
      top: null,
      bottom: null,
      solo,
      duel,
      duration,
      audio,
      sound,
      music,
      minus: { x: duration.x + duration.w - 148, y: duration.y + 16, w: 36, h: 32 },
      plus: { x: duration.x + duration.w - 56, y: duration.y + 16, w: 36, h: 32 },
      soundToggle: { x: sound.x + sound.w - 52, y: sound.y + 8, w: 52, h: 28 },
      musicToggle: { x: music.x + music.w - 52, y: music.y + 8, w: 52, h: 28 },
      back: { x: 40, y: Math.min(audio.y + audio.h + 16, height - 66), w: width - 80, h: 50 },
    }
  }

  const edge = 24
  const gap = 16
  const pad = 20
  const gutter = 24
  const top = { x: edge, y: titleY + 36, w: width - edge * 2, h: 188 }
  const colW = (top.w - pad * 2 - gutter) / 2
  const solo = { x: top.x + pad, y: top.y + 8, w: colW, h: top.h - 16 }
  const duel = { x: solo.x + colW + gutter, y: solo.y, w: colW, h: solo.h }
  const bottom = { x: edge, y: top.y + top.h + gap, w: top.w, h: 108 }
  const cellW = (bottom.w - pad * 2 - gutter * 2) / 3
  const duration = { x: bottom.x + pad, y: bottom.y, w: cellW, h: bottom.h }
  const sound = { x: duration.x + cellW + gutter, y: bottom.y, w: cellW, h: bottom.h }
  const music = { x: sound.x + cellW + gutter, y: bottom.y, w: cellW, h: bottom.h }
  const cluster = 36 + 16 + 64 + 16 + 36
  const minusX = duration.x + (duration.w - cluster) / 2
  const controlY = duration.y + 52
  const backW = Math.min(320, width - 80)
  const backH = 50
  const backY = Math.min(bottom.y + bottom.h + 20, height - 24 - backH)
  return {
    wide: true,
    top,
    bottom,
    solo,
    duel,
    duration,
    audio: null,
    sound,
    music,
    minus: { x: minusX, y: controlY, w: 36, h: 32 },
    plus: { x: minusX + 36 + 16 + 64 + 16, y: controlY, w: 36, h: 32 },
    soundToggle: { x: sound.x + (sound.w - 52) / 2, y: sound.y + 52, w: 52, h: 28 },
    musicToggle: { x: music.x + (music.w - 52) / 2, y: music.y + 52, w: 52, h: 28 },
    back: { x: (width - backW) / 2, y: backY, w: backW, h: backH },
  }
}

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
    const layout = settingsLayout(width, height, titleY)
    const stats = loadStats()
    const duelStats = loadDuelStats()
    if (layout.wide && layout.top && layout.bottom) {
      fillRound(ctx, layout.top, Menu.paper, 16, true)
      fillRound(ctx, layout.bottom, Menu.paper, 16, true)
      strokeDivider(ctx, layout.solo.x + layout.solo.w + 12, layout.top.y + 24, layout.top.h - 48)
      strokeDivider(ctx, layout.duration.x + layout.duration.w + 12, layout.bottom.y + 20, layout.bottom.h - 40)
      strokeDivider(ctx, layout.sound.x + layout.sound.w + 12, layout.bottom.y + 20, layout.bottom.h - 40)
    } else if (layout.audio) {
      fillRound(ctx, layout.solo, Menu.paper, 16, true)
      fillRound(ctx, layout.duel, Menu.paper, 16, true)
      fillRound(ctx, layout.duration, Menu.paper, 16, true)
      fillRound(ctx, layout.audio, Menu.paper, 16, true)
    }
    drawSoloStats(ctx, layout.solo, stats, layout.wide)
    drawDuelStats(ctx, layout.duel, duelStats, layout.wide)

    const { duration, minus, plus, sound, music, soundToggle, musicToggle, back } = layout
    if (layout.wide) {
      text(ctx, '双人对战答题时长', duration.x + duration.w / 2, duration.y + 28, 15, Menu.buttonInk, 'center', '600')
      text(ctx, '音效', sound.x + sound.w / 2, sound.y + 28, 16, Menu.buttonInk, 'center', '600')
      text(ctx, '音乐', music.x + music.w / 2, music.y + 28, 16, Menu.buttonInk, 'center', '600')
    } else {
      text(ctx, '双人对战答题时长', duration.x + 20, duration.y + 32, 15, Menu.buttonInk, 'left', '600')
      text(ctx, '音效', sound.x, sound.y + 22, 16, Menu.buttonInk, 'left', '600')
      text(ctx, '音乐', music.x, music.y + 22, 16, Menu.buttonInk, 'left', '600')
    }
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
      minus.y + minus.h / 2,
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
    drawToggle(ctx, soundToggle, this.sound)
    drawToggle(ctx, musicToggle, this.music)
    this.hits.push({ rect: sound, action: 'sound' }, { rect: music, action: 'music' })
    menuButton(ctx, back, '返回', 'ghost')
    this.hits.push({ rect: back, action: 'back' })
  }
}

function drawSoloStats(ctx: CanvasRenderingContext2D, card: Rect, stats: GameStats, wide: boolean) {
  text(ctx, '单人游戏', card.x + 20, card.y + 24, 15, Menu.subtitle, 'left', '600')
  text(ctx, `连胜 ${stats.streak}`, card.x + card.w - 20, card.y + 24, 15, Menu.title, 'right', '700')
  if (wide) {
    strokeRule(ctx, card, card.y + 44)
  }
  const statsY = wide ? 64 : 48
  const colW = (card.w - 40) / 3
  drawStat(ctx, card.x + 20, card.y + statsY, colW, '总数', stats.deals, '#7DB8A8', 'list')
  drawStat(ctx, card.x + 20 + colW, card.y + statsY, colW, '成功', stats.wins, '#8FCB6D', 'ok')
  drawStat(ctx, card.x + 20 + colW * 2, card.y + statsY, colW, '失败', stats.losses, Color.coral, 'no')
}

function drawDuelStats(ctx: CanvasRenderingContext2D, card: Rect, stats: DuelStats, wide: boolean) {
  text(ctx, '双人对战', card.x + 20, card.y + 24, 15, Menu.subtitle, 'left', '600')
  if (wide) {
    strokeRule(ctx, card, card.y + 44)
  }
  const headY = wide ? 72 : 24
  const roundY = wide ? 106 : 58
  const matchY = wide ? 140 : 92
  const nudge = wide ? 36 : 0
  const redX = card.x + card.w * 0.55 - nudge
  const blueX = card.x + card.w * 0.82 - nudge
  text(ctx, '红方', redX, card.y + headY, 13, '#FF7464', 'center', '600')
  text(ctx, '蓝方', blueX, card.y + headY, 13, '#769FED', 'center', '600')
  text(ctx, '胜利局数', card.x + 20, card.y + roundY, 14, Menu.buttonInk, 'left', '500')
  text(ctx, String(stats.redRoundWins), redX, card.y + roundY, 18, Menu.buttonInk, 'center', '700')
  text(ctx, String(stats.blueRoundWins), blueX, card.y + roundY, 18, Menu.buttonInk, 'center', '700')
  text(ctx, '胜利场数', card.x + 20, card.y + matchY, 14, Menu.buttonInk, 'left', '500')
  text(ctx, String(stats.redMatchWins), redX, card.y + matchY, 18, Menu.buttonInk, 'center', '700')
  text(ctx, String(stats.blueMatchWins), blueX, card.y + matchY, 18, Menu.buttonInk, 'center', '700')
}

function strokeRule(ctx: CanvasRenderingContext2D, card: Rect, y: number) {
  ctx.save()
  ctx.strokeStyle = '#E4E8E6'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(card.x + 16, y)
  ctx.lineTo(card.x + card.w - 16, y)
  ctx.stroke()
  ctx.restore()
}

function strokeDivider(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(36, 53, 47, 0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + h)
  ctx.stroke()
  ctx.restore()
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
