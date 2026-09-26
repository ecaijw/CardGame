# 第 2 期交接

日期：2026-09-26。玩法见 [rules.md](rules.md)。第 0 期见 [phase-0-handoff.md](phase-0-handoff.md)（已冻结）。第 1 期见 [phase-1-handoff.md](phase-1-handoff.md)（已冻结）。

**本文已冻结**（第 2 期结束总结）。不要把第 3 期及之后的功能写回来。后续进展见 [roadmap.md](roadmap.md)、[prd.md](prd.md)、[tech.md](tech.md)，或新建 `docs/phase-N-handoff.md`。

**开新的一期或新对话之前：** 先沉淀当前进展（跑 `npm test`、对齐文档、写或更新**当期** handoff），再扩功能。

## 第 2 期沉淀（2026-09-26）

`npm test` 通过。未改玩法（[rules.md](rules.md)）。

路线图第 2 期原四项：设置统计、音效 / 音乐、数字或扑克、基础牌面动画。「数字 / 扑克」已改列入后续计划，不挡本期结束。其余三项已接入。

## 第 2 期已实现

- 设置页（首页 / 对局右下角进入）：总数（`recordDeal` 在发牌时 +1，重开不加）、成功 / 失败以本局最后一次结算为准（`applyDealOutcome`）、连胜
- 音效 / 音乐开关，默认开，key 仍是 `soundEnabled` / `musicEnabled`
- 播放：[`js/audio/audio-manager.ts`](../js/audio/audio-manager.ts)；BGM 首次点「开始游戏」后循环；音效跟对局操作走。方案见 [audio.md](audio.md)，授权见 [audio-assets.md](audio-assets.md)
- 音源：Kenney Interface Sounds（CC0）+ OpenGameArt BGM / kalimba（CC0）。`select` / `merge` 用同一条 kalimba 的两音，避免同音叠在一起。播新音效会先停掉上一声
- 基础牌面动画：发牌轻微放大、先点牌飞到后点牌下方再弹出结果、成功闪金 / 失败轻移后出弹窗。规则仍走 `merge.ts`，见 [animation.md](animation.md)
- 合并动画中可点运算符和第 2 张；第 2 张先排队，等当前飞牌 / 弹出结束再合并（[test.md](test.md) 第 13 条）
- 牌面下沿避开微信胶囊（第 14 条）；对局两排底栏和首页设置用 `bottomBarPad`（第 16 条）
- 非法操作提示画在运算符下方，与答案同一位置，约 1.8s（第 17 条）；不再用 `wx.showToast` 挡牌
- 结算文案：成功「太棒了，继续挑战吧！」深绿标题 + 皇冠图；失败「成功条件：最后结果是24。」+ 拳头图

相对路线图原稿「显示：数字或扑克」：本期不做，已写入后续计划。产品细节见 [test.md](test.md) 第 12 条。

## 当前项目结构

```
game.js / game.json
audio/                  进包：bgm + 6 个音效
icons/                  结算标题图标
js/
  main.ts               场景；首次开始游戏才抽题并 unlock BGM
  ui.ts                 Canvas；capsuleBottom / bottomBarPad
  played.ts             已玩 id
  settings.ts           统计与音效 / 音乐开关
  audio/audio-manager.ts  播放单例
  art.ts                结算图标
  scenes/play.ts        对局、动画、hint
  scenes/settings.ts    设置页
  game/                 分数、合并、题库（不引用 wx）
docs/                   不进包
```

`assets/` 仍 pack ignore。进包图标在 `icons/`。

## 核心规则与技术决策

- 客户端：微信原生小游戏 + TypeScript + Canvas。AppID `wx7ef5e16ec6f6fd5f`。第 0–3 期无云。
- `js/game/` 不引用 `wx`。音频模块可以调 `wx`。
- 成功：只剩一张且 `isTwentyFour`（交叉相乘）。中间结果不约分。
- 合成牌占后点格子；固定 2×2。对局 UI 无撤销。
- 第 0–4 期对局只发有解题。求解器只在 `scripts/`。

## 测试与运行

```bash
npm install
npm test
```

微信开发者工具：导入选 **Mini Game**，目录选仓库根。不用云。

模拟器启动时可能出现 `getSystemInfo` / `jsbridge not ready`；首页能出来则忽略。音频以真机为准。

## 已知问题（不挡本期结束）

见 [test.md](test.md)：

- 第 9 条：hard 约 16 道，open；后续可从 medium 改标。
- 第 10 条：重开 / 看答案 / 回首页是否断连胜，待确认。当前：只有弹出失败清零，弹出成功 +1。
- 第 11 条：统计清零是否做设置页按钮，待确认。当前只能清缓存。
- 第 12 条：数字 / 扑克，已改后续。
- 第 15 条：折叠屏牌和运算符挤，待讨论。

第 13、14、16、17 条已 close。

## 第 3 期：未做 / 开始时注意

**未做：** 广告、激励视频、去广告内购。

**开始时注意：**

- 已结束的 `docs/phase-0-handoff.md`、`docs/phase-1-handoff.md` 与本文冻结，不要把第 3 期写回来。
- 第 3 期开工前：企业主体、流量主、类目；收费档通常还要企业主体。版号看是否开通虚拟支付。
- 已定为小游戏，不是小程序。
- 连胜与统计清零（第 10、11 条）若要改，写本期之后的代码，不要改已冻结交接。
- 扑克显示走后续，不要在第 3 期广告里顺手做。

## 文档与代码

- 第 2 期产品范围已按「扑克改后续」对齐 [prd.md](prd.md) / [tech.md](tech.md) / [roadmap.md](roadmap.md)。
- 规则条文未改 [rules.md](rules.md)。
