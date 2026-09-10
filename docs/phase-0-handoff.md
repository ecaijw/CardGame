# 第 0 期交接

日期：2026-09-10。玩法见 [rules.md](rules.md)。

**开新的一期或新对话之前：** 先沉淀当前进展（跑 `npm test`、对齐文档、写或更新该期 handoff），再扩功能。

**第 0 期沉淀（2026-09-10）：** `npm test` 通过。文档与对局当时仍读 fixture 的状态一致，未改玩法。随后进入第 1 期抽题。

## 第 0 期已实现

- 首页：开始游戏、玩法说明
- 对局：固定 2×2 格子；点牌 → 运算符 → 再点牌合并
- 再点已选第一张牌：只取消牌，不清运算符；再点已选运算符：取消该运算符
- 合成牌占后点那张的格子，并默认选中，可直接点运算符
- 操作：重开本局、下一局（无撤销按钮）
- 结果：场上只剩一张时成功 / 失败；结算弹窗清空底层点击，避免挡住「下一局」
- 三组写死测试牌循环：`1,2,3,8` / `3,3,8,8` / `1,5,5,5`
- 数字方块，不画扑克；能整除显示整数，否则分数不约分

## 当前项目结构

```
game.js                 小游戏入口（require js/main）
game.json / project.config.json   compileType: game
js/main.ts              场景 home / howto / play；首次开始游戏才抽题
js/ui.ts                Canvas 绘制
js/played.ts            已玩 id（wx 存储）
js/scenes/play.ts       对局（读 puzzles.catalog.js 有解池）
js/game/fraction.ts     分数、显示、是否 24
js/game/merge.ts        合并、outcome；undo 保留未接 UI
js/game/puzzles.ts      加载题库、抽题（不引用 wx）
js/game/puzzles.fixture.ts  第 0 期 3 组题（单测仍用）
js/game/puzzles.catalog.js  运行时题库（小游戏 require）
js/game/puzzles.json    题库正本（不进包）
scripts/solve.ts        离线求解（不进包）
scripts/generate-puzzles.ts
scripts/test-game.ts
docs/                   说明与交接（不进包）
assets/icon.png         头像
```

## 核心规则与技术决策

- 客户端：微信原生小游戏 + TypeScript + Canvas。AppID `wx7ef5e16ec6f6fd5f`。
- 第 0–3 期无服务端、不用云。
- 规则层不引用 `wx`。允许分数、负数、0；除数为 0 非法。
- 成功：只剩一张且交叉相乘等于 24。中间某张是 24 但还有牌，不算赢。
- 编码约束见仓库根目录 [AGENTS.md](../AGENTS.md)。

## 测试与运行

```bash
npm install
npm test
npm run generate:puzzles
```

微信开发者工具：导入选 **Mini Game**，目录选仓库根（含 `game.js`）。不用云。头像用 `assets/icon.png`。

## 已知问题

见 [test.md](test.md)：

- 第 7 条：看答案按钮，open，等写清需求再做（第 1 期提示）。
- 第 9 条：hard 太少（约 16 道），open；后续从 medium 挑大约 30 题改标 hard。

第 1–8 条中已 close 的玩法/UI 问题，对局已按表实现。

## 第 1 期：已做 / 未做 / 注意

**已做（不要在未沉淀的情况下继续扩）：**

- 离线生成 1820 条四元组到 `js/game/puzzles.json`
- 有解 1362；easy 1163 / medium 183 / hard 16 / unsolvable 458
- 难度按中间步骤，规则见 [puzzles-preview.md](puzzles-preview.md)
- 对局抽题：跳过 `unsolvable`，优先未玩；发出该题时把 id 写入 `wx` storage（`playedPuzzleIds`）

**未做：** 提示 UI、难度入口。

**开始时注意：**

- 对局读 `puzzles.catalog.js` 有解池。第 0–4 期只发有解局。小游戏不能直接 `require` JSON。
- 已玩记录用 `wx.setStorage`，不要写进 JSON。清缓存即重置优先未玩。
- 提示用条目里的 `steps` / `expression`，设备上不要再穷举。
- `expression` 已去掉最外层括号。
- 第 3 期路线图仍写「小程序 vs 小游戏 go/no-go」；**已定为小游戏**。是否要版号、虚拟支付：**待确认**。

## 文档与代码曾不一致（已按代码改文档，未改玩法）

- README 仍写撤销、进度停在「第 0 期可玩」→ 已改为第 0 期完成、无撤销。
- tech.md 把撤销写成对局能力、目录含不存在的 `difficulty.ts` → 已对齐。
- prd.md「合并后张数减少」→ 改为固定 2×2、先点格子留空。
- 规则条文与 `fraction.ts` / `merge.ts` / 对局行为核对后无冲突，未改 [rules.md](rules.md)。
