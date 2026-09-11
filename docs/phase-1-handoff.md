# 第 1 期交接

日期：2026-09-11。玩法见 [rules.md](rules.md)。第 0 期结束总结见 [phase-0-handoff.md](phase-0-handoff.md)（已冻结）。

**本文已冻结**（第 1 期结束总结）。不要把第 2 期及之后的功能写回来。后续进展见 [roadmap.md](roadmap.md)、[prd.md](prd.md)、[tech.md](tech.md)，或新建 `docs/phase-N-handoff.md`。

**开新的一期或新对话之前：** 先沉淀当前进展（跑 `npm test`、对齐文档、写或更新**当期** handoff），再扩功能。

## 第 1 期沉淀（2026-09-11）

`npm test` 通过。路线图第 1 期五项均已接入对局。未改玩法（[rules.md](rules.md)）。

## 第 1 期已实现

- 全量题库：1820 条四元组写入 `js/game/puzzles.json`；小游戏 `require` `puzzles.catalog.js`（不能直接 require JSON）
- 有解 1362；easy 1163 / medium 183 / hard 16 / unsolvable 458。难度规则见 [puzzles-preview.md](puzzles-preview.md)
- 对局只发有解题，跳过 `unsolvable`。抽题优先未玩；未玩空了再从当前筛选池里抽（避开当前题）
- 已玩 id 用 `wx.setStorage`（key：`playedPuzzleIds`），不写回 JSON。发出该题时写入。清缓存即重置优先未玩
- 左下角「查看答案」：点一下显示该题 `expression`，再点隐藏。重开 / 下一局清掉。不现场穷举
- 右下角难度：默认简单；列表为简单 / 中等 / 困难 / 全部。换档立刻抽该池一题。点列表以外收起。难度不写 storage（回首页再进仍记住本次对局的档）
- 第 0 期 `puzzles.fixture.ts` 已从包内删除；三组已知手在 `scripts/test-game.ts` 的 `FIXTURES` 里供单测

相对路线图原稿「提示：一步 → 完整解法」：按产品改为一次显示完整 `expression`，不做逐步提示。

## 当前项目结构

```
game.js                 小游戏入口（require js/main）
game.json / project.config.json   compileType: game
js/main.ts              场景 home / howto / play；首次开始游戏才抽题
js/ui.ts                Canvas 绘制
js/played.ts            已玩 id（wx 存储）
js/scenes/play.ts       对局：抽题、查看答案、难度筛选
js/game/fraction.ts     分数、显示、是否 24
js/game/merge.ts        合并、outcome；undo 保留未接 UI
js/game/puzzles.ts      加载 catalog、有解池、按难度抽题（不引用 wx）
js/game/puzzles.catalog.js  运行时题库
js/game/puzzles.json    题库正本（pack ignore）
scripts/solve.ts        离线求解（不进包）
scripts/generate-puzzles.ts
scripts/test-game.ts    含 FIXTURES 三组已知解
docs/                   说明与交接（不进包）
assets/icon.png         头像
```

## 核心规则与技术决策

- 客户端：微信原生小游戏 + TypeScript + Canvas。AppID `wx7ef5e16ec6f6fd5f`。
- 第 0–3 期无服务端、不用云。
- `js/game/` 不引用 `wx`。场景可以调用 `wx`。
- 成功：只剩一张且交叉相乘等于 24。编码约束见 [AGENTS.md](../AGENTS.md)。
- 生成题库后，`puzzles.json` 与 `puzzles.catalog.js` 须一起写出（`npm run generate:puzzles`）。只改 JSON 不会更新对局。

## 测试与运行

```bash
npm install
npm test
npm run generate:puzzles
```

微信开发者工具：导入选 **Mini Game**，目录选仓库根（含 `game.js`）。不用云。头像用 `assets/icon.png`。

开发者工具模拟器启动时可能出现 `getSystemInfo` / `jsbridge not ready` 红字；首页能出来则忽略，不是题库或对局逻辑错误。不要为此再改启动接口。

## 已知问题

见 [test.md](test.md)：

- 第 9 条：hard 太少（约 16 道），open；后续可从 medium 挑大约 30 题改标 hard。不阻塞第 1 期结束。

第 7 条看答案已 close。

## 第 2 期：未做 / 开始时注意

**未做：** 本地统计（局数、成功、连胜）、音效开关、数字 / 扑克切换、基础牌面动画。

**开始时注意：**

- 已结束的 `docs/phase-0-handoff.md` 与本文冻结，不要把第 2 期写回来。
- 已玩 id 是全局集合，不按难度分桶。
- 难度筛选只存在对局实例里，杀进程后下次「开始游戏」仍默认简单。
- 提示继续用条目里的 `expression` / `steps`，设备上不要再穷举。
- 第 3 期路线图仍写「小程序 vs 小游戏 go/no-go」；**已定为小游戏**。是否要版号、虚拟支付：**待确认**。

## 文档与代码

- 第 1 期产品验收三项（不抽无解、能展示解法、题库打进包 / 已玩可清缓存）已按当前实现对齐 [prd.md](prd.md) / [tech.md](tech.md) / [roadmap.md](roadmap.md)。
- 规则条文未改 [rules.md](rules.md)。
