import { PlayScene } from './scenes/play'
import {
  Color,
  Menu,
  drawMenuBackground,
  drawMenuFan,
  fillRound,
  hit,
  menuButton,
  menuTitle,
  text,
  type Rect,
} from './ui'

type Scene = 'home' | 'howto' | 'play'

type Hit = { rect: Rect; action: string }

class App {
  private canvas: ReturnType<typeof wx.createCanvas>
  private ctx: CanvasRenderingContext2D
  private width = 375
  private height = 667
  private scene: Scene = 'home'
  private play: PlayScene | null = null
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
    wx.onTouchEnd((event) => {
      const touch = event.changedTouches[0]
      if (!touch) {
        return
      }
      this.onTap(touch.clientX, touch.clientY)
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
    const found = this.hits.find((item) => hit(item.rect, x, y))
    if (!found) {
      return
    }
    if (found.action === 'start') {
      this.play = this.play ? new PlayScene(this.play.puzzle, this.play.filter) : PlayScene.deal()
      this.scene = 'play'
      return
    }
    if (found.action === 'howto') {
      this.scene = 'howto'
      return
    }
    if (found.action === 'back') {
      this.scene = 'home'
    }
  }

  private draw() {
    const { ctx, width, height } = this
    this.hits = []
    if (this.scene === 'home' || this.scene === 'howto') {
      drawMenuBackground(ctx, width, height)
    } else {
      ctx.fillStyle = Color.bg
      ctx.fillRect(0, 0, width, height)
    }
    if (this.scene === 'home') {
      this.drawHome()
      return
    }
    if (this.scene === 'howto') {
      this.drawHowTo()
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
    const top = this.capsuleBottom() + 16
    drawMenuFan(ctx, width, top)
    const titleSize = Math.min(50, width * 0.13)
    const titleY = height * 0.385
    menuTitle(ctx, '数字算一算', width / 2, titleY, titleSize)
    text(ctx, '四张数字卡片，算出 24', width / 2, height * 0.458, 14, Menu.subtitle, 'center', '400')
    text(ctx, '来挑战一下', width / 2, height * 0.488, 14, Menu.subtitle, 'center', '400')
    const btnW = Math.min(268, width - 80)
    const btnX = (width - btnW) / 2
    const start = { x: btnX, y: height * 0.558, w: btnW, h: 52 }
    const howto = { x: btnX, y: height * 0.648, w: btnW, h: 50 }
    menuButton(ctx, start, '开始游戏', 'primary')
    menuButton(ctx, howto, '玩法说明', 'ghost')
    this.hits.push({ rect: start, action: 'start' }, { rect: howto, action: 'howto' })
  }

  private drawHowTo() {
    const { ctx, width } = this
    const titleY = this.capsuleBottom() + 20
    menuTitle(ctx, '怎么玩', width / 2, titleY, 28)
    const card = { x: 24, y: titleY + 36, w: width - 48, h: 360 }
    fillRound(ctx, card, Color.paper, 16, true)
    const lines = [
      '每局 4 张牌，点数 1 到 13。每张牌必须用一次，也只能用一次。',
      '先点一张牌，再点 + − × ÷，再点另一张牌。两张牌会合成为一张结果牌。',
      '减法和除法：先点的是左边。例如先 3 后 4，再点减，得到 −1。',
      '可以出现分数、负数和 0，但不能除以 0。',
      '一直合并到场上只剩一张。这张牌精确等于 24 才算成功。中间某张已经是 24、但还剩别的牌，不算赢。',
    ]
    ctx.fillStyle = Menu.buttonInk
    ctx.font = '400 14px "PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let y = card.y + 20
    lines.forEach((line) => {
      y = wrapText(ctx, line, card.x + 18, y, card.w - 36, 22) + 14
    })
    const btnW = Math.min(248, width - 96)
    const back = { x: (width - btnW) / 2, y: card.y + card.h + 24, w: btnW, h: 50 }
    menuButton(ctx, back, '返回', 'ghost')
    this.hits.push({ rect: back, action: 'back' })
  }
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
