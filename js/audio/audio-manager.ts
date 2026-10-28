import { loadMusicEnabled, loadSoundEnabled } from '../settings'

export type SfxName = 'tap' | 'select' | 'merge' | 'invalid' | 'success' | 'next'

const BGM_SRC = 'audio/bgm.mp3'
const BGM_VOLUME = 0.10
const SFX_VOLUME: Record<SfxName, number> = {
  tap: 0.45,
  select: 0.45,
  merge: 0.5,
  invalid: 0.45,
  success: 0.58,
  next: 0.45,
}
const SFX_NAMES = Object.keys(SFX_VOLUME) as SfxName[]

type AudioCtx = WechatMiniprogram.InnerAudioContext

let ready = false
let unlocked = false
let hidden = false
let musicOn = true
let sfxOn = true
let bgmPlaying = false
let bgmPending = false
let bgmFromAutoplay = false
let bgm: AudioCtx | null = null
const sfx: Partial<Record<SfxName, AudioCtx>> = {}

export function init(): void {
  if (ready) {
    return
  }
  ready = true
  musicOn = loadMusicEnabled()
  sfxOn = loadSoundEnabled()
  bgm = makeCtx(BGM_SRC, BGM_VOLUME, true)
  bgm.onPlay(() => {
    bgmPending = false
    bgmFromAutoplay = false
    if (!musicOn || hidden) {
      bgmPlaying = false
      try {
        bgm?.pause()
      } catch {
        // ignore
      }
      return
    }
    bgmPlaying = true
  })
  bgm.onPause(() => {
    clearBgmWait()
  })
  bgm.onStop(() => {
    clearBgmWait()
  })
  bgm.onError(() => {
    clearBgmWait()
  })
  SFX_NAMES.forEach((name) => {
    sfx[name] = makeCtx(`audio/${name}.mp3`, SFX_VOLUME[name], false)
  })
  onForeground(false, () => {
    hidden = true
    pauseBgm()
  })
  onForeground(true, () => {
    hidden = false
    if (unlocked && musicOn) {
      playBgm()
    }
  })
  if (musicOn) {
    unlocked = true
    playBgm()
  }
}

export function unlockAndStartBgm(): void {
  unlocked = true
  startBgm(true)
}

export function playBgm(): void {
  startBgm(false)
}

export function pauseBgm(): void {
  clearBgmWait()
  if (!bgm) {
    return
  }
  try {
    bgm.pause()
  } catch {
    // ignore
  }
}

export function playSfx(name: SfxName): void {
  if (!sfxOn) {
    return
  }
  const ctx = sfx[name]
  if (!ctx) {
    return
  }
  SFX_NAMES.forEach((other) => {
    if (other !== name) {
      silenceCtx(sfx[other])
    }
  })
  silenceCtx(ctx)
  try {
    ctx.volume = SFX_VOLUME[name]
    ctx.play()
  } catch {
    // ignore
  }
}

export function setMusicEnabled(on: boolean): void {
  musicOn = on
  if (on) {
    unlocked = true
    playBgm()
  } else {
    pauseBgm()
  }
}

export function setSfxEnabled(on: boolean): void {
  sfxOn = on
}

export function dispose(): void {
  pauseBgm()
  bgm?.destroy()
  bgm = null
  SFX_NAMES.forEach((name) => {
    sfx[name]?.destroy()
    delete sfx[name]
  })
  ready = false
  unlocked = false
  hidden = false
  clearBgmWait()
}

function startBgm(fromGesture: boolean): void {
  if (!bgm || !unlocked || !musicOn || hidden || bgmPlaying) {
    return
  }
  if (bgmPending && !(fromGesture && bgmFromAutoplay)) {
    return
  }
  try {
    bgmPending = true
    bgmFromAutoplay = !fromGesture
    bgm.volume = BGM_VOLUME
    bgm.play()
  } catch {
    clearBgmWait()
  }
}

function clearBgmWait(): void {
  bgmPlaying = false
  bgmPending = false
  bgmFromAutoplay = false
}

function silenceCtx(ctx: AudioCtx | undefined): void {
  if (!ctx) {
    return
  }
  try {
    ctx.volume = 0
    ctx.pause()
    ctx.stop()
    ctx.seek(0)
  } catch {
    // ignore
  }
}

function makeCtx(src: string, volume: number, loop: boolean): AudioCtx {
  const ctx = wx.createInnerAudioContext({ useWebAudioImplement: !loop })
  ctx.src = src
  ctx.volume = volume
  ctx.loop = loop
  ctx.onError(() => {
    // ignore
  })
  return ctx
}

function onForeground(show: boolean, listener: () => void) {
  const api = wx as WechatMiniprogram.Wx & {
    onShow?: (fn: () => void) => void
    onHide?: (fn: () => void) => void
  }
  if (show) {
    if (typeof api.onShow === 'function') {
      api.onShow(listener)
    } else {
      wx.onAppShow(listener)
    }
    return
  }
  if (typeof api.onHide === 'function') {
    api.onHide(listener)
  } else {
    wx.onAppHide(listener)
  }
}
