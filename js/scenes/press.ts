import { easeOut } from './board'

export class PressFeedback {
  private press: { key: string; down: boolean; at: number } | null = null

  constructor(
    private readonly pressMs = 90,
    private readonly pressScale = 0.85,
  ) {}

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
    const progress = easeOut((at - this.press.at) / this.pressMs)
    if (this.press.down) {
      return 1 - (1 - this.pressScale) * progress
    }
    return this.pressScale + (1 - this.pressScale) * progress
  }
}
