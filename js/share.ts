const SHARE_TITLE = '经典24点，单人挑战，双人抢答'
const SHARE_IMAGE =
  'https://mmocgame.qpic.cn/wechatgame/DaCfOt8icEw9qGxyVEYzS3pMpiaufnezn2W54HTgaFldbY9yEIq10OPGdc3IZAYe7W/0'

/** 微信后台审核通过的分享图编号。2026-10-30 已通过，转发优先用这个编号，图片地址留作兜底。 */
const SHARE_IMAGE_URL_ID: string = 'RAamo2LPQaOI1RW8De/zKQ=='

type ShareMessage = {
  title: string
  imageUrl: string
  imageUrlId?: string
}

export function shareMessage(): ShareMessage {
  const message: ShareMessage = {
    title: SHARE_TITLE,
    imageUrl: SHARE_IMAGE,
  }
  if (SHARE_IMAGE_URL_ID !== '') {
    message.imageUrlId = SHARE_IMAGE_URL_ID
  }
  return message
}

export function enableShare(): void {
  wx.showShareMenu({ menus: ['shareAppMessage'] })
  wx.onShareAppMessage(() => shareMessage())
}
