# 第 2.2 期交接

日期：2026-10-20 开工，2026-10-25 结束。玩法见 [rules.md](rules.md) §4。产品与技术定稿见 [phase-2.2-duel.md](phase-2.2-duel.md)。

**本文已冻结**（第 2.2 期结束总结）。不要把第 2.3 期及之后的功能写回来。后续进展见 [roadmap.md](roadmap.md)、[prd.md](prd.md)、[tech.md](tech.md)，或 [phase-2.3-handoff.md](phase-2.3-handoff.md)。第 2.1 期上线交接仍见 [phase-2.1-handoff.md](phase-2.1-handoff.md)，不冻结。

## 第 2.2 期沉淀（2026-10-25）

`npm test` 通过。单人合牌规则未改（[rules.md](rules.md) 第 1–3 节）。

路线图第 2.2 期是同一台设备上的双人对战。[phase-2.2-duel.md](phase-2.2-duel.md) 第十四节的验收已经接上。切后台不暂停倒计时，定稿第十三节已写明本期不做。

真机上两人同时点抢答、以及切后台后再回来，这次沉淀没有重新手测。抢答锁定和按墙钟超时在 `scripts/test-game.ts` 里有覆盖。

## 第 2.2 期已实现

- 首页「单人游戏」「双人对战」。单人珊瑚渐变，双人珊瑚到蓝。提交：[af50018](https://github.com/ecaijw/CardGame/commit/af50018)、[5bf520d](https://github.com/ecaijw/CardGame/commit/5bf520d)
- `js/game/session.ts`、`js/game/duel.ts`。阶段为等待抢答、答题、交接、已看答案、本局结束、本场结束。先抢答再限时合牌，第一位失败后换对方，先到 5 分获胜
- 独立 `DuelScene`。本局结果写在 `DuelMatch` 上。提交：[8723637](https://github.com/ecaijw/CardGame/commit/8723637)
- 双人难度、含无解题、已玩 id、答题秒数、红蓝胜利局数和胜利场数与单人分开。时长默认 20 秒，每次 ±5，夹在 10～60。未开倒计时时改设置，下一次抢答用新时长。提交：[be785f3](https://github.com/ecaijw/CardGame/commit/be785f3)
- 倒计时心跳只缩放秒数。认输提示在倒计时和「重试」之间，3 秒后消失。提交：[ed160c2](https://github.com/ecaijw/CardGame/commit/ed160c2)、[565653a](https://github.com/ecaijw/CardGame/commit/565653a)
- 单人和双人弹窗共用外壳，双人五种弹窗也铺整页遮罩。提交：[3367d52](https://github.com/ecaijw/CardGame/commit/3367d52)、[631f732](https://github.com/ecaijw/CardGame/commit/631f732)
- 牌和运算符的位置抽到 `tableLayout`。宽屏只看宽度：单人和设置从 748 起左右分栏；双人三栏从 928 起，748–927 仍是左栏牌桌。提交：[35129b9](https://github.com/ecaijw/CardGame/commit/35129b9)、[8e2cd8c](https://github.com/ecaijw/CardGame/commit/8e2cd8c)、[04af822](https://github.com/ecaijw/CardGame/commit/04af822)
- 单人、双人左上角小房子，左边距等于上边距。提交：[7c9b2be](https://github.com/ecaijw/CardGame/commit/7c9b2be)

按问题编号的提交链接见 [test.md](test.md) 第 27–48 条。

## 不挡结束的开放项

见 [test.md](test.md)：

- 第 28 条：切后台是否暂停倒计时。本期按墙钟继续走。
- 第 41 条：「下一局」确认弹窗。未做。
- 第 42 条：领先一方的小皇冠。未做。
- 第 50 条：难度菜单卡片，以及宽屏时改到按钮右侧。未做。
- 第 49 条：响应式布局。改到第 2.3 期，不在本期实现。

第 11、12、18、19、26 条是更早的开放项，不属于本期范围。

## 第 2.3 期：未做 / 开始时注意

**未做：** 首页、单人、双人的响应式布局。方案见 [ux/issue-49-responsive-layout.md](ux/issue-49-responsive-layout.md)。

**开始时注意：**

- 本文已冻结。第 2.3 期写 [phase-2.3-handoff.md](phase-2.3-handoff.md)，不要把布局重构写回本文。
- 本期双人宽屏仍按宽度分三档。第 2.3 期才会改成竖屏居中单列、横屏先试三栏。
- 第 2.1 期上线仍进行中，不要把它和本期一起冻结。
- 不把广告、支付写进第 2.3 期。
