# 24 点 — iOS / Android 跨平台方案

状态：产品与技术预研结论，供后续 App 分期直接使用。当前第 2.1 期仍只负责微信小游戏上线；未经确认，不按本文提前扩功能。

相关文档：[玩法规则](rules.md)、[产品需求](prd.md)、[技术方案](tech.md)、[分期路线图](roadmap.md)。

## 1. 结论

1. 先完善微信**小游戏**版本，验证单人体验与一台设备双人抢答；不要把两台设备联网对战塞进首个 App 版本。
2. 不分别从零编写 Swift 和 Kotlin 版本。保留一套平台无关的 TypeScript 游戏核心，iOS 与 Android 共用一套移动端界面和平台适配代码。
3. 推荐结构是：微信小游戏继续使用 Canvas；移动端使用 HTML5 Canvas + Capacitor，同时生成 iOS 与 Android 工程。
4. `js/game/` 的规则、分数、合牌和题库逻辑继续保持纯 TypeScript，不引用 `wx`、DOM 或移动端 API。
5. 微信端、移动端只负责绘制、触摸、音频、存储、生命周期、分享、广告等平台能力。

最终形态：

```text
                       共享 TypeScript 游戏核心
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
          微信小游戏 Canvas                 Mobile HTML Canvas
                 │                                 │
          微信平台适配层                    Capacitor 适配层
                                                   │
                                         ┌─────────┴─────────┐
                                         │                   │
                                        iOS               Android
```

## 2. 为什么不分别重写 iOS 和 Android

| 方案 | 代码复用 | 首次开发成本 | 维护成本 | 适合本项目 |
| --- | ---: | ---: | ---: | --- |
| Swift + Kotlin 分别重写 | 低 | 高 | 高，三套实现容易偏离 | 否 |
| React Native + 共享核心 | 高 | 中 | 中 | 可选 |
| HTML5 Canvas + Capacitor | 最高 | 低 | 低 | **推荐** |
| Unity / Cocos | 中高 | 中高 | 中高 | 功能规模不足以抵消引擎成本 |

本项目以 2D 卡片、文字、按钮、简单动画和本地状态为主，没有复杂 3D、物理或高帧率场景。当前设计也已经采用 TypeScript + Canvas，因此 Capacitor 路线的迁移成本最低。

移动端虽然共用代码，发布仍是两个独立流程：Xcode / App Store Connect 负责 iOS，Android Studio / Play Console 负责 Android。

## 3. 共享边界

分数、合牌和抽题已经在 `js/game/`，不引用 `wx`。对局选牌、统计规则和已玩记录仍在微信场景与存储模块里。第 2.1 期不为此搬目录或拆包。下一次改难度或加同机双人时，再把对局会话收成纯函数。

### 3.1 必须共享

| 模块 | 内容 |
| --- | --- |
| 分数运算 | 整数分子 / 分母、四则运算、除零检查、`isTwentyFour` |
| 合牌规则 | 选两张牌和运算符后生成结果牌，保留固定 `slot` 规则 |
| 对局状态 | 卡牌、选中状态、操作步骤、胜负和结算 |
| 题库 | 四元组、难度、答案、题目 id |
| 抽题 | 难度过滤、跳过无解、优先未玩、随机抽取 |
| 难度规则 | easy / medium / hard / unsolvable 的既有定义 |
| 同机双人 | 抢答、答题权、倒计时、回合与 A/B 计分状态机 |
| 格式化 | 卡牌数值、表达式和逐步答案显示 |
| 存储模型 | 设置、统计、已玩题目和比赛记录的数据结构 |
| 自动化测试 | 核心规则、题库、抽题和双人状态机测试 |

共享核心必须满足：

```text
不引用 wx
不引用 window / document
不直接创建 Canvas
不直接播放音频
不直接读写平台存储
不引用广告、登录或分享 SDK
```

### 3.2 相对当前代码还缺的一层

`js/game/fraction.ts`、`js/game/merge.ts`、`js/game/puzzles.ts` 已经可测、可共用。`puzzles.ts` 目前用 `require('./puzzles.catalog')` 加载题库。打成共享包时改为由调用方传入题目数组。求解器仍只放 `scripts/`。

还在微信侧，收进 `js/game/` 之后三端才能共用：

- 选牌协议在 `js/scenes/play.ts` 的 `onCard` / `onOp`：先点牌，再点运算符，再点另一张牌；再点已选牌或已选运算符会取消；未选牌就点运算符为非法。
- 合并动画期间可以先选运算符和第 2 张，第 2 张先排队。这是界面时序。合牌结果在点击时已经写入 `merge()`。动画和坐标留在场景。
- 发牌计数、本局最后一次结算覆盖胜负、连胜在 `js/settings.ts`，函数内部直接调用 `wx` 存储。规则收成 `(stats, event) => stats` 之后，平台层只负责读写。
- 已玩题目在 `js/played.ts`，同样直接写微信存储。已玩 id 集合是数据，读写留在平台适配层。
- 绘制、触摸、胶囊安全区和音频在 `js/ui.ts`、`js/main.ts`、`js/audio/audio-manager.ts`。`ui.ts` 依赖微信窗口和胶囊，移动端另行绘制，并共用颜色、字号、间距、圆角和动画时长。

下一次改玩法时，场景把点击翻译成命令，再按返回状态绘制和播放。单人会话命令为 `selectCard`、`selectOp`、`restart`、`nextDeal`、`setFilter`。输入是状态和命令，输出是新状态，以及 `div0`、`needCard` 这类原因。

难度沿现有边界改：

- 运行时筛选使用已有 `DealFilter`（`easy` / `medium` / `hard` / `all`），抽题只走 `pickPuzzle`。
- 简单 / 中等 / 困难的分档由 `scripts/generate-puzzles.ts` 写入题库，运行时只读该字段。三端发布同一份 catalog。
- 若记住当前难度，只持久化一个 `DealFilter`。平台存储负责读写，难度判定留在抽题函数。

### 3.3 平台适配，不强行共享实现

| 能力 | 微信小游戏 | iOS / Android |
| --- | --- | --- |
| 画布 | `wx.createCanvas()` | HTML Canvas |
| 输入 | 微信触摸事件 | Pointer / Touch Events |
| 存储 | `wx.setStorage` | Capacitor Preferences |
| 音频 | `wx.createInnerAudioContext()` | Web Audio 或 Capacitor 插件 |
| 安全区域 | `wx.getWindowInfo()` | CSS `safe-area-inset-*` |
| 生命周期 | 微信前后台事件 | Capacitor App lifecycle |
| 分享 | 微信分享接口 | 系统 Share Sheet |
| 广告 | 微信流量主 | 移动广告 SDK，例如 AdMob |
| 登录 | 微信登录 | Apple / Google 登录（需要时再加） |

建议给平台能力定义接口：

```ts
interface PlatformServices {
  storage: StorageService
  audio: AudioService
  lifecycle: LifecycleService
  share?: ShareService
}
```

核心只调用接口，不判断当前平台。

## 4. 建议目录

微信小游戏没有打包步骤。`game.js` 只 `require('./js/main')`，开发者工具直接编译导入目录里的 TypeScript。本地包不会被微信编译器解析，所以共享源码必须位于微信工程内部，或由脚本拷进该工程。移动端可以引用仓库里的其他目录。

第 2.1 期保持今天的仓库根。下面两段从决定做移动端原型才开始。小游戏运行时继续 `require` `puzzles.catalog.js`，不直接加载 `puzzles.json`。求解器仍只放 `scripts/`。

### 4.1 第一阶段：加移动端，微信仍从仓库根导入

```text
CardGame/
  game.js
  game.json
  project.config.json
  js/
    game/                 共享规则，继续纯 TypeScript
    main.ts ui.ts art.ts  微信绘制与场景
    scenes/ audio/        微信触摸、音频
    played.ts settings.ts 微信存储
  audio/ icons/           微信进包资源
  apps/mobile/            Capacitor + HTML Canvas
  scripts/                求解器与题库生成，不进包
  docs/
```

- `js/game/fraction.ts`、`merge.ts`、`puzzles.ts` 留在原地。移动端用相对路径引用。
- `js/scenes/play.ts`、`ui.ts`、`main.ts`、`audio/audio-manager.ts`、`played.ts`、`settings.ts`、`art.ts` 留在微信侧。移动端重写画布、触摸和音频。
- `audio/`、`icons/` 仍在微信工程内。移动端使用自己的资源副本。
- `apps/mobile/ios` 与 `apps/mobile/android` 由 Capacitor 生成。手写代码放 `apps/mobile/src`。
- `project.config.json` 的 pack ignore 增加 `apps`。`docs`、`scripts`、`puzzles.json`、`assets` 继续忽略。

这一阶段的代码缝：`js/game/puzzles.ts` 里的 `require('./puzzles.catalog')` 改为由调用方传入题目数组。微信入口传入 catalog，移动端传入同一份数据。生成脚本仍写出 `js/game/puzzles.catalog.js`。

颜色和字号先留在 `ui.ts`。移动端开始对稿时，再抽一份双方都读的常量，放在 `js/game/` 旁或 `js/theme.ts`。

### 4.2 第二阶段：两边都在用同一套会话之后再搬

单人会话已经在 `js/game/`，并且移动端原型直接调用它之后，再收成：

```text
CardGame/
  packages/game-core/          原 js/game 的规则、会话、抽题
  packages/puzzle-catalog/     生成出的 puzzles.json 与 puzzles.catalog.js
  apps/wechat-game/            原仓库根的 game.js、js 场景、audio、icons、project.config.json
  apps/mobile/                 已有的 Capacitor 工程
  scripts/ docs/
```

开发者工具的导入目录从仓库根改为 `apps/wechat-game`。共享规则用生成或拷贝进入该目录，微信仍用相对路径 `require`。

`packages/puzzle-catalog` 是生成物。正本 JSON 不进小游戏包。`puzzles.catalog.js` 拷进 `apps/wechat-game` 供运行时 require。求解器留在根目录 `scripts/`。

## 5. 双人模式范围

### 5.1 首选：同一设备双人抢答

双方同时看一组四张牌，A、B 各有一个抢答按钮。推荐状态：

```ts
type DuelPhase = 'thinking' | 'answering' | 'result'

type DuelState = {
  round: number
  playerAScore: number
  playerBScore: number
  buzzedPlayer: 'A' | 'B' | null
  phase: DuelPhase
  answerDeadline?: number
}
```

建议流程：

1. 同时展示题目并开放 A/B 抢答。
2. 第一位按下按钮的玩家取得答题权。
3. 在限定时间内用现有合牌方式解题。
4. 正确则加 1 分；错误或超时的具体处罚在进入开发前写入 `rules.md`，不要由代码临时决定。
5. 多回合累计比分，达到局数或目标分结束比赛。

该模式完全可以本地运行，不需要账号、服务器或云开发。抢答、倒计时和 A/B 计分包住单人会话：取得答题权的一方在限时内发送 `selectCard` / `selectOp`。加分、超时和罚分先写入 [rules.md](rules.md)，再实现。单人 `GameStats` 与双人比分分开存放。

### 5.2 后续：两台设备联网对战

联网对战需要登录、房间、服务器权威计时、状态同步、断线重连、防作弊与隐私申报，复杂度远高于同机模式。先验证同机对战是否受欢迎，再单独立项；不要放进第一版 iOS / Android。

## 6. 实施顺序

### 阶段 A：微信小游戏验证

- 完成当前第 2.1 期上线，不提前扩 App。
- 后续分期验证单人留存、难度、动画、声音、设置与同机双人规则。
- 新逻辑继续保持 `js/game/` 无 `wx`。
- 改难度筛选、调整难度分档，或加入同机双人时，先把单人会话收成 `js/game/` 纯函数，场景只翻译点击。第 2.1 期上线不提前做这次抽取。
- 任何玩法变更先更新规则和验收标准，再写代码。

### 阶段 B：平台依赖审计

逐项列出 `wx.*`、Canvas 创建、触摸、音频、存储、安全区域、分享、广告和生命周期调用，确认没有混入游戏规则层。为这些能力建立平台接口。

### 阶段 C：移动端最小原型

按第 4.1 节加 `apps/mobile`，微信仍从仓库根导入。只实现首页、单人局、四张牌、四则运算、下一局、查看答案、本地设置与音频。原型直接调用 `js/game/`，题库由入口传入。pack ignore 加上 `apps`。

### 阶段 D：双平台发布

同一移动端工程生成 `ios/` 与 `android/`，分别完成签名、真机测试、商店素材、隐私申报和审核。Android 新个人账号要提前启动封闭测试，见第 9 节。

## 7. App 英文命名结论

### 7.1 推荐名称

首选品牌短名：

```text
Make 24
```

原因：英语自然、短、容易输入和记忆，直接表达玩法目标。`Make 24 Points` 不推荐，因为母语表达不自然；`Duel` 虽然正确，但不是所有休闲玩家都熟悉，也会让用户误以为产品只支持对战。

商店需要补充玩法关键词时，推荐：

```text
Make 24: Number Puzzle
```

备选：

```text
Make 24: Card Math Game
Make 24: Four Numbers
```

最终提交前必须分别检查 App Store、Google Play 的名称占用与潜在商标冲突。通用玩法词不能保证一定可注册，也不应模仿现有 App 的图标、描述和商店素材。

微信小游戏当前登记名仍是「数字算一算」，不要因为海外 App 命名而修改正在备案的名称。

### 7.2 推荐商店文案

英文短句：

```text
Make 24 with four numbers. Play solo or race a friend!
```

如果首版尚未包含双人模式，改用：

```text
Make 24 with four numbers. Solve quick puzzles at your own pace!
```

不要在双人功能上线前写 `race a friend`。

推荐副标题：

```text
Four Numbers, One Answer
```

Google Play short description 候选：

```text
Use four numbers and +, −, ×, ÷ to make 24. Play solo or race a friend.
```

中文一句话：

```text
用四个数字和加减乘除算出 24，独自挑战或与朋友同机抢答。
```

商店名称长度、描述长度和关键词规则以提交时后台为准；文案必须与当时已经上线的功能一致。

## 8. iOS / Android 发布边界

- 首版优先无登录、无云、无聊天、无用户内容、无内购；这样隐私和审核最简单。
- 加入广告、统计或崩溃 SDK 后，必须重新核对 Apple App Privacy 和 Google Play Data safety。
- Capacitor 只是技术外壳。App 必须功能完整、交互稳定、有离线游戏价值，不能只是一个指向网页的空壳。
- iOS 用 TestFlight 真机验证；Android 先 Internal testing，再进入 Closed testing。
- 共享核心的自动化测试通过，不等于平台合格；两端仍要覆盖安全区域、后台恢复、音频中断、不同屏幕和低端 Android 设备。

## 9. Google Play 新个人账号封闭测试

新个人开发者账号正式发布前，按当前规则需要至少 12 名测试者连续加入 Closed testing 14 天，之后申请 Production access。规则可能变化，执行时以 Play Console 和[官方说明](https://support.google.com/googleplay/android-developer/answer/14151465)为准。

实际执行不要只招 12 人，目标为 15–20 人：

| 来源 | 目标人数 | 说明 |
| --- | ---: | --- |
| 家人、朋友、同事 | 6–8 | 稳定打底，优先澳洲或能正常使用 Google Play 的 Android 用户 |
| Reddit 开发者互测 | 8–12 | 补足人数，必须预留中途退出的冗余 |

测试者应：

1. 使用同一个 Google 账号加入 Google Group 和测试计划。
2. 通过 Google Play 的测试链接安装，不用侧载 APK 代替。
3. 保持加入状态至少 14 天。
4. 实际打开并测试若干局，提供设备型号、问题或体验反馈。

内部记录至少包含加入日期、设备、Android 版本、测试功能、反馈和对应修复。申请 Production access 时如实说明招募方式、测试内容、反馈及改动。

## 10. Reddit 招募方案

优先社区：

- [r/AndroidClosedTesting](https://www.reddit.com/r/AndroidClosedTesting/)：最直接的封闭测试互助社区。
- [r/TestersCommunity](https://www.reddit.com/r/TestersCommunity/)：可作为补充，注意第三方服务推广。
- [r/alphaandbetausers](https://www.reddit.com/r/alphaandbetausers/)：更适合招募愿意提供真实反馈的用户。

不要依赖刚好 12 名陌生人。常见问题包括答应后未安装、几天后退出、只要求回测却不反馈，以及 Google Group / Play 链接配置错误。

最有效的方式是 `test for test`：先认真测试其他开发者的 App，提供截图或反馈，再请求对方回测。发帖前准备：

1. Google Group 加入链接；
2. Google Play opt-in 测试加入链接；
3. Google Play 安装链接；
4. 简短测试任务；
5. 自己愿意回测并保留 14 天的承诺。

不要让陌生人在公开评论中留下 Gmail。使用可自行加入的 Google Group，或通过 Reddit 私信交换邮箱。不要购买来源不明的批量账号或虚假测试。

### 10.1 Reddit 发帖模板

标题：

```text
Looking for Android closed testers for a simple Make 24 game — test for test
```

正文：

```text
Hi everyone!

I'm looking for Android testers for my first game, a simple Make 24 number
puzzle. I need help completing the Google Play closed testing period.

I will test your app in return and remain enrolled for at least 14 days.

How to join:

1. Join the Google Group:
[GROUP LINK]

2. Join the closed test:
[OPT-IN LINK]

3. Install the game from Google Play:
[INSTALL LINK]

Please use the same Google account for the Google Group and Google Play.
Keep the game installed and remain enrolled for at least 14 days.

If possible, please play a few rounds and let me know:
- whether the controls are clear;
- whether the text fits your screen;
- whether you encounter any crashes or freezes.

Comment "done" with your app links, and I will test yours in return.
Thank you!
```

### 10.2 给测试者的任务

1. 启动游戏并完成至少 5 道题。
2. 分别尝试可用的难度。
3. 使用查看答案、重开本局和下一局。
4. 关闭 App 后重新打开，检查设置和进度。
5. 如果有同机双人，完成一场比赛。
6. 回复手机型号、Android 版本和至少一条反馈。

## 11. 后续实现检查表

开始 App 分期前确认：

- [ ] 当前微信分期已跑测试、对齐文档并写完 handoff。
- [ ] 工作区没有混入未提交的其他功能。
- [ ] `js/game/` 没有 `wx` 或 UI 依赖。
- [ ] 移动端原型放在 `apps/mobile`，微信导入目录仍是仓库根；`puzzles.ts` 改为由调用方传入题库。
- [ ] 两边都调用同一套 `js/game/` 会话之后，再考虑 `packages/` 与 `apps/wechat-game`。
- [ ] 为存储、音频、生命周期定义平台接口。
- [ ] 单人会话（选牌、取消、合牌、结算原因）已在 `js/game/`，场景不再自带一套规则。
- [ ] 先完成移动端单人原型，再迁移双人。双人状态机调用该会话，比分与单人统计分开。
- [ ] App 名称经过商店占用和商标检查。
- [ ] 商店文案只描述已经实现的功能。
- [ ] 隐私政策与实际 SDK 数据行为一致。
- [ ] Android 已准备 15–20 名候选测试者。
- [ ] iOS 和 Android 均完成实体设备测试。

## 12. 明确不做的事

- 不因为计划发布 App，就在第 2.1 期重构现有微信上线版本。
- 不在移动端原型开工时把仓库改成 `packages/`，也不把微信工程挪进 `apps/wechat-game`。那一步等到两边都在调用 `js/game/` 之后。
- 不把选牌、取消、结算原因和同机双人只写在 `js/scenes/play.ts`。这些规则进 `js/game/` 的纯会话，场景只翻译点击。
- 不复制三份运算、题库或胜负代码。
- 不在首个移动版同时实现两台设备联网对战。
- 不在功能上线前写入商店描述。
- 不以虚假账号或无实际使用的付费批量测试替代真实测试。

