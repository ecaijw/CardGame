# 24 点 — 技术方案

玩法见 [rules.md](rules.md)，产品需求见 [prd.md](prd.md)，分期见 [roadmap.md](roadmap.md)。iOS / Android 的共享核心、移动端技术选型、海外命名和测试者招募见 [app-cross-platform.md](app-cross-platform.md)。

## 1. 选型

| 项 | 决定 | 原因 |
| --- | --- | --- |
| 客户端 | 微信原生**小游戏** + TypeScript + Canvas | 按游戏类目提审，避免被认定「小程序里做游戏」 |
| 跨端 | 第 0–4 期不上 Taro / uni-app | 网页 / App 放后续；核心规则保持纯 TS |
| 渲染 | Canvas 2D | 小游戏没有 WXML 页面 |
| 后端 | 第 0–3 期无服务端；第 4 期可加云开发 | 单机闭环先做完再上云 |

当前 AppID `wx7ef5e16ec6f6fd5f` 是小游戏号。上架走游戏类目、资质和备案。

第 2.1 期做这件事：按当前可玩版本准备并完成上线，过程中只修小问题、做优化。第 2.4 期把「上线当前版本」列为任务，步骤仍是类目、资质、备案、提审、发布；上线记录继续写在第 2.1 期交接，该文不冻结。不接广告、不接支付、不用云。广告走小游戏流量主、去广告走米大师，仍是第 3 期；收费档通常还要企业主体，版号看是否开通虚拟支付。

## 2. 目录（随分期增加）

第 0 期对局只用带 `*` 的部分。题库 JSON 已生成；小游戏运行时 `require` `puzzles.catalog.js`（不能直接 require JSON）。

```
game.js / game.json
audio/                  进包：bgm + 6 个音效（不要 ignore）
icons/                  结算标题图标（设计稿裁切）
docs/ux/                当前采用的设计稿（pack ignore）
js/
  main.ts           * 场景与触摸；首次开始游戏才抽题
  ui.ts             * Canvas 绘制
  played.ts             已玩 id（wx 存储）
  settings.ts           对局统计、音效 / 音乐开关（wx 存储）
  audio/audio-manager.ts  播放单例（wx；见 [audio.md](audio.md)）
  scenes/play.ts    * 单人对局
  scenes/duel.ts        同机双人对局（第 2.2 期）
  scenes/duel-stacked.ts 双人居中单列（第 2.3 期）
  scenes/duel-wide.ts    双人横屏三栏（第 2.3 期）
  scenes/difficulty-menu.ts 难度菜单卡片
  scenes/home-layout.ts 首页按钮位置
  scenes/settings.ts    设置页
  game/
    fraction.ts     * 分数与是否等于 24
    merge.ts        * 合并一步；undo 函数保留，UI 已去掉
    session.ts          选牌 / 选运算符纯会话（单人与双人共用）
    duel.ts             双人抢答状态机与胜利统计变换
    puzzles.ts          加载题库、有解池、抽题
    puzzles.catalog.js      运行时题库（小游戏可 require）
    puzzles.json            题库正本（pack ignore，生成用）
scripts/
  generate-puzzles.ts
  solve.ts              仅生成用，不进小游戏包
  test-game.ts
project.config.json     compileType: game；pack ignore：docs、scripts、puzzles.json、tmp-ref-frames、node_modules、assets、miniprogram
```

`js/game/` 内模块**不引用 `wx`**，便于用 Node 跑单测和生成脚本。

## 3. 核心算法

### 3.1 分数（第 0 期）

所有中间结果用整数分子 / 分母存储，不做约分。允许 0 与负数。显示规则见 [rules.md](rules.md) 第 2 节。

- 加、减、乘按常规分数运算
- 除：除数为 0 则该步失败，不改场上牌
- 成功：`分子 === 24 × 分母`（未约分也可以，如 `48/2`）
- 显示：能整除则显示整数，否则不约分

禁止用 `number` 直接 `=== 24` 作为终局判定。

### 3.2 合并（第 0 期）

场上是一张牌的列表。每张牌含：

- `id`：本局内唯一（合并新牌用新 id）
- `value`：分数
- `slot`：0–3，对应固定 2×2 格子

一次合法合并：选 `a`、运算符、`b` → 删除 `a` 与 `b`，结果牌占用 `b` 的格子（后点的那张）。

`merge.ts` 仍保存合并前快照并导出 `undo`。对局 UI 已去掉撤销；重开本局 = 恢复本局初始 4 个数。

### 3.3 第 0 期题库（已删除）

第 0 期对局曾写死三组循环：`1,2,3,8` / `3,3,8,8` / `1,5,5,5`。对局模块已删除。第 1 期起对局读 `puzzles.catalog.js`；单测在 [`scripts/test-game.ts`](../scripts/test-game.ts) 用 `FIXTURES` 保留这三组。

### 3.4 全量题库（第 1 期）

电脑上跑 `scripts/generate-puzzles.ts`：

- 枚举 1–13 的四元组（可重复、与顺序无关，1820 种全部写入）
- 用分数穷举逐步合并；有解写入代表解，无解 `difficulty` 为 `unsolvable`
- 写出 `js/game/puzzles.json`（正本）和 `js/game/puzzles.catalog.js`（小游戏 `require`），提交进仓库
- 运行时只读 catalog，设备上不再穷举；默认只发有解题，打开「含无解题」后每次发牌有 25% 的机会抽无解题
- `puzzles.json` 已 pack ignore；小游戏不能 `require` JSON（会去找 `.json.js`）

条目形状：

```ts
{
  id: string
  nums: [number, number, number, number]
  difficulty: "easy" | "medium" | "hard" | "unsolvable"
  steps: string[]       // 与合并 UI 一致，如 ["8÷2=4", "3×4=12", "1×12=24"]；无解为空
  expression: string    // 给「看完整解法」；无解为空字符串
}
```

难度在生成时写入，规则见 [puzzles-preview.md](puzzles-preview.md)。简单：存在全程正整数且不用除法的解法。困难：所有解都要非整数分数，或去掉加法、乘法交换后正整数模式不超过 2 种且不能用两张原始牌直接整除。其余有解题为中等。简单先判定。`expression` 按乘除优先于加减、同级从左到右去掉多余括号，不改变运算顺序。运行时只读字段。

提示：对局左下角「查看答案」显示该题 `expression`，不现场穷举。无解题没有算式，答案区显示「本题无解，无法算出24」。难度：右下角筛选 `easy` / `medium` / `hard` / `all`，默认简单。难度和「含无解题」写入本地存储，清缓存才恢复默认。`pickPuzzle` 默认只在对应有解池里抽，优先未玩。打开「含无解题」后，随机数小于 0.25 时从全部无解题里抽，否则仍从当前难度的有解题里抽。两个池子各自优先未玩，玩完后在本池循环并避开当前题。打开时不重发当前这题。场景层用 `wx.setStorage` 存已玩 id，发出该题时写入。

已玩记录：**不要**写进 JSON。用 `wx.setStorage` 存题目 id 集合（key：`playedPuzzleIds`）。清缓存即重置优先未玩。

体积预期：千余条加解法字符串，约几十到一两百 KB，可打进小程序包。

## 4. 存储

| 期 | 存什么 | 方式 |
| --- | --- | --- |
| 0 | 无 | — |
| 1 | 已玩题目 id | `wx.setStorage` |
| 2 | 总数 / 成功 / 失败 / 连胜、音效、音乐 | 同上 |
| 2.1 | 难度 `dealFilter`、含无解题 `includeUnsolvable` | 同上 |
| 2.2 | 双人难度 / 含无解题 / 已玩 id、答题秒数、`duelStats`（红蓝胜利局数与场数） | 同上；与单人 key 分开。答题秒数未写入时微信返回空字符串，按 20 秒读，不抬到 10 |
| 3 | 免广告到期时间、终身标记；订单用于恢复 | 本地 + 虚拟支付订单 |
| 4 | 战绩、排行 | 云开发；本地作缓存 |

连胜存在 `gameStats`。本局还没失败过时，成功是开局连胜加 1。先失败再成功则从 1 开始。失败写成 0。本局尚未结算时点下一局、换难度、打开答案或回首页，只调用 `clearStreak`，不加失败；同时把本局的 `streakAtDealStart` 置 0，避免稍后成功又加回旧连胜。

## 5. UI 与资源

- 单位：逻辑像素（`windowWidth`），竖屏
- 第 0 期：Canvas 长方形 + 数字，比例接近扑克（约 63:88）
- 动画：第 2 期已接入对局场景时间轴（发牌 / 合并 / 结算），规则仍走 `merge.ts`，见 [animation.md](animation.md)
- 音频：第 2 期已接入；BGM 首次点「单人游戏」或「双人对战」后循环，音效跟对局操作走，见 [audio.md](audio.md)
- 同机双人：独立 `DuelScene` + `js/game/duel.ts`，方案见 [phase-2.2-duel.md](phase-2.2-duel.md)。第 2.2 期已完成
- 单人和设置页宽屏只看宽度。`playFrame` 在宽度达到 748（左栏 400、栏间距 28、右栏至少 280、两侧各 20）时分出左右栏。牌的大小再按该栏扣掉底栏、操作行和安全区之后的高度缩小；标准尺寸放得下时卡牌宽 120。窄屏顶边贴 `minTop`、底栏贴底。宽屏整块在 `minTop` 和底部安全区之间垂直居中，小房子不随牌桌下移。小房子 x 为 `max(16, safeArea.left + 8)`，y 为 `max(16, safeArea.top + 8, statusBarHeight + 8)`，并且不超过 `minTop - 40`，避免压住牌。竖屏刘海往下让，横屏刘海往右让；单人和双人共用这一位置。双人不用这条宽度分档：竖屏走居中单列 `duelStackedLayout()`，内容宽不超过 430，记分牌和抢答在运算符与操作行之间垂直居中；横屏先试三栏，左边按钮仍至少宽 84、右边统计仍至少宽 140，收到下限后仍重叠或越界就退回同一套居中单列。三栏几何见 [ux/issue-46-wide-duel-layout.md](ux/issue-46-wide-duel-layout.md)，进入条件见 [ux/issue-49-responsive-layout.md](ux/issue-49-responsive-layout.md)
- 难度菜单：`difficultyMenuLayout()` 把选项放进带描边的卡片。双人三栏从按钮右侧展开，单人和双人居中单列仍在按钮上方。卡片夹在 `minTop` 和底部安全区之间，不画出屏幕。
- 后续：若上线后要做数字 / 扑克切换，自绘 4 花色 × 13 点，避免版权图。[test.md](test.md) 第 12 条已 `won't fix`

## 6. 广告与支付（第 3 期，第 0 期不实现）

- 广告：`wx.createRewardedVideoAd`、`wx.createInterstitialAd`，需开通流量主
- 免费用户每 20 局一次广告；进中等 / 困难时激励视频一次（已购去广告则跳过）
- 去广告 SKU：0.99 一天、9.90 终身。终身清缓存后须能凭订单恢复
- 不做用户自填金额

第 3 期走小游戏流量主与米大师；收费档需企业主体，是否要版号以当时开通虚拟支付的规则为准。

## 7. 云开发（第 4 期）

每日一题仍可用日期种子本地选题，不必上云。排行榜、战绩同步、好友挑战再用云函数和数据库。分享用 `onShareAppMessage` 带题目 id。
