import { init as initAudio, playSfx, unlockAndStartBgm } from './audio/audio-manager'
import { preloadIcons } from './art'
import { DuelScene } from './scenes/duel'
import { CHALLENGE_SIZE, homeLayout, homeTitleAnchor } from './scenes/home-layout'
import { PlayScene } from './scenes/play'
import { PressFeedback } from './scenes/press'
import { SettingsScene } from './scenes/settings'
import {
  Color,
  Menu,
  bottomBarPad,
  drawHomeMenuButton,
  drawMenuBackground,
  drawMenuFan,
  fillRound,
  hit,
  menuButton,
  menuTitle,
  paintScrollbar,
  text,
  VerticalScroll,
  withButtonScale,
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
  private homePress = new PressFeedback(100, 0.97)
  private backPress = new PressFeedback(100, 0.97)
  private howtoScroll = new VerticalScroll()
  private trackingScroll = false

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
      if (this.scene === 'home') {
        this.pressHome(touch.clientX, touch.clientY)
      }
      if (this.scene === 'howto') {
        this.trackingScroll = true
        this.howtoScroll.start(touch.clientX, touch.clientY)
        this.pressBack(touch.clientX, touch.clientY)
      }
      if (this.scene === 'settings') {
        this.trackingScroll = true
        this.settings.onPointerDown(touch.clientX, touch.clientY)
      }
    })
    wx.onTouchMove((event) => {
      if (!this.trackingScroll) {
        return
      }
      const touch = event.touches[0] || event.changedTouches[0]
      if (!touch) {
        return
      }
      if (this.scene === 'howto') {
        this.howtoScroll.move(touch.clientY)
      }
      if (this.scene === 'settings') {
        this.settings.onPointerMove(touch.clientY)
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
      if (this.scene === 'home') {
        this.homePress.up(Date.now())
      }
      if (this.scene === 'howto') {
        this.backPress.up(Date.now())
      }
      if (this.scene === 'settings') {
        this.settings.pressUp()
      }
      const scrolled =
        (this.scene === 'howto' && this.howtoScroll.consumed()) ||
        (this.scene === 'settings' && this.settings.pointerScrolled())
      this.trackingScroll = false
      if (!scrolled) {
        this.onTap(touch.clientX, touch.clientY)
      }
    })
    wx.onTouchCancel(() => {
      this.trackingScroll = false
      this.play?.pressUp()
      this.duel?.pressUp()
      this.homePress.up(Date.now())
      this.backPress.up(Date.now())
      this.settings.pressUp()
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
      this.howtoScroll.reset()
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
    this.play.onHome = () => {
      this.scene = 'home'
    }
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
    this.settings.resetScroll()
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

  private pressHome(x: number, y: number) {
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (found) {
      this.homePress.down(found.action, Date.now())
    }
  }

  private pressBack(x: number, y: number) {
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (found?.action === 'back') {
      this.backPress.down('back', Date.now())
    }
  }

  private drawHome() {
    const { ctx, width, height } = this
    const top = this.capsuleBottom() + 28
    const fanBottom = drawMenuFan(ctx, width, top)
    const anchor = homeTitleAnchor(width, height, fanBottom)
    const layout = homeLayout({
      width,
      height,
      titleY: anchor.titleY,
      titleSize: anchor.titleSize,
      fanBottom,
      bottomPad: bottomBarPad(),
    })
    const { titleY } = layout
    menuTitle(ctx, '数字算一算', width / 2, titleY, anchor.titleSize)
    text(ctx, '四张数字卡片，算出 24', width / 2, titleY + 56, CHALLENGE_SIZE, Menu.subtitle, 'center', '400')
    text(ctx, '来挑战一下！', width / 2, layout.challengeY, CHALLENGE_SIZE, Menu.subtitle, 'center', '400')
    const { start, duel, howto, settings } = layout
    const now = Date.now()
    withButtonScale(ctx, start, this.homePress.scale('start', now), () => {
      drawHomeMenuButton(ctx, start, '单人游戏', 'solo', {
        fill: ['#FF8E7D', '#FF7464'],
        stroke: '#E85A4F',
        ink: '#FFFFFF',
        iconInk: '#FFFFFF',
      })
    })
    withButtonScale(ctx, duel, this.homePress.scale('duel', now), () => {
      drawHomeMenuButton(ctx, duel, '双人对战', 'duo', {
        fill: ['#FF7464', '#769FED'],
        stroke: '#5F85D8',
        ink: '#FFFFFF',
        iconInk: ['#F25542', '#4F83E8'],
      })
    })
    withButtonScale(ctx, howto, this.homePress.scale('howto', now), () => {
      drawHomeMenuButton(ctx, howto, '游戏说明', 'book', {
        fill: '#FFFEFB',
        stroke: '#68B58D',
        ink: '#24352F',
        iconInk: '#2F6B4F',
      })
    })
    withButtonScale(ctx, settings, this.homePress.scale('settings', now), () => {
      drawHomeMenuButton(ctx, settings, '设置', 'settings', {
        fill: '#FFFEFB',
        stroke: '#68B58D',
        ink: '#24352F',
        iconInk: '#2F6B4F',
      })
    })
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
        lines: ['使用 + − × ÷，把 4 张数字牌最终算成 24。',
                '每张牌必须使用，而且只能使用一次。',
              ],
      },
      {
        title: '操作方法',
        lines: ['点一张牌 → 选运算符 → 再点另一张牌，两张牌会计算成为结果牌。',
                '继续计算，直到只剩一张牌。',
              ],
      },
      {
        title: '双人对战',
        lines: ['双方先抢答，抢到的人在限定秒数内需要算出 24。第一位失败后换对方回答。',
                '先拿到 5 分获胜。',
              ],
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
    const headFont = '600 17px "PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif'
    const bodyFont = '400 16px "PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif'
    const headLine = 24
    const bodyLine = 24
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
    const cardTop = titleY + 36
    const backGap = 24
    const backH = 50
    const backY = Math.min(cardTop + contentH + backGap, this.height - bottomBarPad() - backH)
    const viewH = Math.max(0, backY - backGap - cardTop)
    const view = { x: cardX, y: cardTop, w: cardW, h: viewH }
    this.howtoScroll.note(contentH, viewH, view)
    const offset = this.howtoScroll.offset
    const overflow = contentH > viewH + 1
    if (overflow) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(view.x, view.y, view.w, view.h)
      ctx.clip()
      ctx.translate(0, -offset)
    }
    const card = { x: cardX, y: cardTop, w: cardW, h: contentH }
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
    if (overflow) {
      ctx.restore()
      paintScrollbar(ctx, view, contentH, offset)
    }
    const btnW = Math.min(248, width - 96)
    const back = { x: (width - btnW) / 2, y: backY, w: btnW, h: backH }
    withButtonScale(ctx, back, this.backPress.scale('back', Date.now()), () => {
      menuButton(ctx, back, '返回', 'ghost')
    })
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
