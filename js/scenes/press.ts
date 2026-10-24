import { easeOut } from './board'

const PRESS_MS = 90
const PRESS_SCALE = 0.85

export class PressFeedback {
  private press: { key: string; down: boolean; at: number } | null = null

  down(key: string, at: number) {
    this.press = { key, down: true, at }
  }

  up(at: number) {
    if (this.press?.down) {
      this.press = { key: this.press.key, down: false, at }
    }
  }

  scale(key: string, at: number) {
    if (!this.press || this.press.key !== key) {
      return 1
    }
    const progress = easeOut((at - this.press.at) / PRESS_MS)
    if (this.press.down) {
      return 1 - (1 - PRESS_SCALE) * progress
    }
    return PRESS_SCALE + (1 - PRESS_SCALE) * progress
  }
}
