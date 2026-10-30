/// <reference types="miniprogram-api-typings" />

declare namespace WechatMiniprogram {
  interface ShareMessageContent {
    title?: string
    imageUrl?: string
    imageUrlId?: string
    query?: string
  }

  interface Wx {
    onShareAppMessage(listener: () => ShareMessageContent): void
  }
}
