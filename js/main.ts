import { init as initAudio, playSfx, unlockAndStartBgm } from './audio/audio-manager'
import { preloadIcons } from './art'
import { DuelScene } from './scenes/duel'
import { PlayScene } from './scenes/play'
import { SettingsScene } from './scenes/settings'
import {
  Color,
  Menu,
  bottomBarPad,
  drawMenuBackground,
  drawMenuFan,
  fillRound,
  hit,
  iconLabelButton,
  menuButton,
  menuTitle,
  text,
  type Rect,
} from './ui'

type Scene = 'home' | 'howto' | 'play' | 'duel' | 'settings'

type Hit = { rect: Rect; action: string }

class App {
  private canvas: ReturnType<typeof wx.createCanvas>
  private ctx: CanvasRenderingContext2D
  private width = 375
  private height = 667
  private scene: Scene = 'home'
  private play: PlayScene | null = null
  private duel: DuelScene | null = null
  private settings = new SettingsScene()
  private settingsBack: 'home' | 'play' | 'duel' = 'home'
  private hits: Hit[] = []

  constructor() {
    this.canvas = wx.createCanvas()
    const info = wx.getSystemInfoSync()
    const dpr = info.pixelRatio || 1
    this.width = info.windowWidth
    this.height = info.windowHeight
    this.canvas.width = this.width * dpr
    this.canvas.height = this.height * dpr
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.ctx.scale(dpr, dpr)
    preloadIcons()
    initAudio()
    wx.onTouchStart((event) => {
      const touch = event.changedTouches[0] || event.touches[0]
      if (!touch) {
        return
      }
      if (this.scene === 'play' && this.play) {
        this.play.pressDown(touch.clientX, touch.clientY)
        return
      }
      if (this.scene === 'duel' && this.duel) {
        this.duel.pressDown(touch.clientX, touch.clientY)
      }
    })
    wx.onTouchEnd((event) => {
      const touch = event.changedTouches[0]
      if (!touch) {
        return
      }
      if (this.scene === 'play' && this.play) {
        this.play.pressUp()
      }
      if (this.scene === 'duel' && this.duel) {
        this.duel.pressUp()
      }
      this.onTap(touch.clientX, touch.clientY)
    })
    wx.onTouchCancel(() => {
      this.play?.pressUp()
      this.duel?.pressUp()
    })
    const raf =
      typeof this.canvas.requestAnimationFrame === 'function'
        ? this.canvas.requestAnimationFrame.bind(this.canvas)
        : (cb: () => void) => setTimeout(cb, 16)
    const loop = () => {
      this.draw()
      raf(loop)
    }
    loop()
  }

  private onTap(x: number, y: number) {
    if (this.scene === 'play' && this.play) {
      this.play.tap(x, y)
      return
    }
    if (this.scene === 'duel' && this.duel) {
      this.duel.tap(x, y)
      return
    }
    if (this.scene === 'settings') {
      if (this.settings.tap(x, y) === 'back') {
        playSfx('tap')
        this.scene = this.settingsBack
      }
      return
    }
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (!found) {
      return
    }
    if (found.action === 'start') {
      playSfx('tap')
      unlockAndStartBgm()
      this.duel = null
      if (this.play) {
        this.play.clearStreakIfUnsettled()
        this.play.reset()
      } else {
        this.play = PlayScene.deal()
      }
      this.bindPlaySettings()
      this.scene = 'play'
      return
    }
    if (found.action === 'duel') {
      playSfx('tap')
      unlockAndStartBgm()
      this.duel = DuelScene.deal()
      this.bindDuelCallbacks()
      this.scene = 'duel'
      return
    }
    if (found.action === 'howto') {
      playSfx('tap')
      this.scene = 'howto'
      return
    }
    if (found.action === 'settings') {
      playSfx('tap')
      this.openSettings('home')
      return
    }
    if (found.action === 'back') {
      playSfx('tap')
      this.scene = 'home'
    }
  }

  private bindPlaySettings() {
    if (!this.play) {
      return
    }
    this.play.onSettings = () => this.openSettings('play')
  }

  private bindDuelCallbacks() {
    if (!this.duel) {
      return
    }
    this.duel.onSettings = () => this.openSettings('duel')
    this.duel.onHome = () => {
      this.duel = null
      this.scene = 'home'
    }
  }

  private openSettings(from: 'home' | 'play' | 'duel') {
    this.settingsBack = from
    this.scene = 'settings'
  }

  private draw() {
    const { ctx, width, height } = this
    this.hits = []
    drawMenuBackground(ctx, width, height)
    if (this.scene === 'home') {
      this.drawHome()
      return
    }
    if (this.scene === 'howto') {
      this.drawHowTo()
      return
    }
    if (this.scene === 'settings') {
      this.settings.draw(ctx, width, height)
      return
    }
    if (this.scene === 'duel' && this.duel) {
      this.duel.draw(ctx, width, height)
      return
    }
    this.play?.draw(ctx, width, height)
  }

  private capsuleBottom() {
    try {
      const cap = wx.getMenuButtonBoundingClientRect()
      if (cap && typeof cap.bottom === 'number' && cap.bottom > 0) {
        return cap.bottom
      }
    } catch {
      // simulator may not have the capsule
    }
    return 48
  }

  private drawHome() {
    const { ctx, width, height } = this
    const top = this.capsuleBottom() + 28
    const fanBottom = drawMenuFan(ctx, width, top)
    const titleSize = Math.min(52, width * 0.14)
    const titleY = Math.max(height * 0.32, fanBottom + 36)
    menuTitle(ctx, '数字算一算', width / 2, titleY, titleSize)
    text(ctx, '四张数字卡片，算出 24', width / 2, titleY + 56, 15, Menu.subtitle, 'center', '400')
    text(ctx, '来挑战一下', width / 2, titleY + 82, 15, Menu.subtitle, 'center', '400')
    const btnW = Math.min(220, width - 72)
    const btnX = (width - btnW) / 2
    const gap = 12
    const btnH = 52
    const settingsH = 52
    const settingsY = height - bottomBarPad() - settingsH
    const howtoY = settingsY - gap - btnH
    const startY = Math.min(height * 0.52, howtoY - gap * 2 - btnH * 2)
    const duelY = startY + btnH + gap
    const start = { x: btnX, y: startY, w: btnW, h: btnH }
    const duel = { x: btnX, y: duelY, w: btnW, h: btnH }
    const howto = { x: btnX, y: howtoY, w: btnW, h: btnH }
    const settings = { x: btnX, y: settingsY, w: btnW, h: settingsH }
    menuButton(ctx, start, '单人游戏', 'primary')
    fillRound(ctx, duel, '#2F6FED', duel.h / 2, true)
    text(ctx, '双人对战', duel.x + duel.w / 2, duel.y + duel.h / 2, 18, Color.paper, 'center', '600')
    menuButton(ctx, howto, '游戏说明', 'ghost')
    iconLabelButton(ctx, settings, '设置', 'ghost', 'settings', 16)
    this.hits.push(
      { rect: start, action: 'start' },
      { rect: duel, action: 'duel' },
      { rect: howto, action: 'howto' },
      { rect: settings, action: 'settings' },
    )
  }

  private drawHowTo() {
    const { ctx, width } = this
    const titleY = this.capsuleBottom() + 20
    menuTitle(ctx, '游戏说明', width / 2, titleY, 28)
    const sections: Array<{ title: string; lines: string[] }> = [
      {
        title: '游戏目标',
        lines: ['使用 + − × ÷，把 4 张数字牌最终算成 24。每张牌必须使用，而且只能使用一次。'],
      },
      {
        title: '操作方法',
        lines: ['点一张牌 → 选运算符 → 再点另一张牌。两张牌会合成为结果牌，继续计算，直到只剩一张牌。'],
      },
      {
        title: '双人对战',
        lines: ['双方先抢答，抢到的人在限定秒数内算出 24。第一位失败后换对方。先到 5 分获胜。'],
      },
      {
        title: '注意',
        lines: [
          '计算中可以出现分数、负数和 0，但不能除以 0。',
          '中途得到 24 但仍有其他牌，不算成功。',
          '「含无解题」模式下，如果你判断无法算出 24，请点击「本题无解」。判断正确算成功，判断错误算失败。',
        ],
      },
    ]
    const cardX = 24
    const cardW = width - 48
    const textX = cardX + 18
    const textW = cardW - 36
    const headFont = '600 15px "PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif'
    const bodyFont = '400 14px "PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif'
    const headLine = 22
    const bodyLine = 22
    const afterHead = 8
    const afterPara = 10
    const afterSection = 16
    const padY = 20
    ctx.font = bodyFont
    let contentH = padY
    sections.forEach((section, index) => {
      contentH += headLine + afterHead
      section.lines.forEach((line, lineIndex) => {
        contentH += textBlockHeight(ctx, line, textW, bodyLine)
        if (lineIndex < section.lines.length - 1) {
          contentH += afterPara
        }
      })
      if (index < sections.length - 1) {
        contentH += afterSection
      }
    })
    contentH += padY
    const card = { x: cardX, y: titleY + 36, w: cardW, h: contentH }
    fillRound(ctx, card, Color.paper, 16, true)
    ctx.fillStyle = Menu.buttonInk
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let y = card.y + padY
    sections.forEach((section, index) => {
      ctx.font = headFont
      ctx.fillText(section.title, textX, y)
      y += headLine + afterHead
      ctx.font = bodyFont
      section.lines.forEach((line, lineIndex) => {
        y = wrapText(ctx, line, textX, y, textW, bodyLine)
        if (lineIndex < section.lines.length - 1) {
          y += afterPara
        }
      })
      if (index < sections.length - 1) {
        y += afterSection
      }
    })
    const btnW = Math.min(248, width - 96)
    const back = { x: (width - btnW) / 2, y: card.y + card.h + 24, w: btnW, h: 50 }
    menuButton(ctx, back, '返回', 'ghost')
    this.hits.push({ rect: back, action: 'back' })
  }
}

function textBlockHeight(
  ctx: CanvasRenderingContext2D,
  content: string,
  maxWidth: number,
  lineHeight: number,
) {
  let line = ''
  let height = 0
  for (const ch of content) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      line = ch
      height += lineHeight
    } else {
      line = test
    }
  }
  if (line) {
    height += lineHeight
  }
  return height
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  content: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let line = ''
  for (const ch of content) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = ch
      y += lineHeight
    } else {
      line = test
    }
  }
  if (line) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

new App()
