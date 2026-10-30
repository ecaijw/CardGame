# 第 2.5 期交接

日期：2026-10-29 立项。第 2.4 期结束总结见 [phase-2.4-handoff.md](phase-2.4-handoff.md)（已冻结）。

**本文进行中**（第 2.5 期工作记录）。结束并沉淀后再冻结。不要把广告、支付写进来。第 61、62 条留在 [test.md](test.md)，不在本期做。

## 定义

只做 [test.md](test.md) 第 60 条：玩家使用小游戏时，可以从右上角菜单把「数字算一算」转发给好友或群聊。点开分享卡片后进入首页，不带题目、不带对局参数。

做：

- 启动时 `wx.showShareMenu`，菜单只有 `shareAppMessage`（发送给朋友，含群聊）
- `wx.onShareAppMessage` 返回固定标题「经典24点，单人挑战，双人抢答」，图片用微信后台已上传的分享图地址
- 图片地址已接入。2026-10-30 审核通过，`imageUrlId` 为 `RAamo2LPQaOI1RW8De/zKQ==`。转发优先用这个编号，图片地址留作兜底

不做：

- 第 61 条：双人「3、2、1」倒数
- 第 62 条：成功 / 失败弹窗趣味化
- 游戏内「转发」按钮、分享到朋友圈、启动 `query`
- 第 4 期带题目 id 的分享
- 广告、支付、云、多语言

版本 `1.0.0.28102804` 的审核和发布仍记在 [phase-2.1-handoff.md](phase-2.1-handoff.md)，不冻结。本次不写 [CHANGELOG.md](../CHANGELOG.md)。

## 已接入

- 第 60 条：`js/share.ts` 在启动时打开右上角「发送给朋友」。标题「经典24点，单人挑战，双人抢答」。图片地址 `https://mmocgame.qpic.cn/wechatgame/DaCfOt8icEw9qGxyVEYzS3pMpiaufnezn2W54HTgaFldbY9yEIq10OPGdc3IZAYe7W/0`。2026-10-30 审核通过，`SHARE_IMAGE_URL_ID` 为 `RAamo2LPQaOI1RW8De/zKQ==`，转发优先用这个编号。不带 `query`。提交号等沉淀再补。

## 结束时

跑 `npm test`，对齐 [roadmap.md](roadmap.md) / [prd.md](prd.md) / [tech.md](tech.md)，把本文改成结束总结并冻结。此时给第 60 条补上短提交号和 GitHub 链接。
