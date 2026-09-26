# 24 点 — Agent 约束

玩法见 [docs/rules.md](docs/rules.md)。分期见 [docs/roadmap.md](docs/roadmap.md)。第 0 期交接见 [docs/phase-0-handoff.md](docs/phase-0-handoff.md)。第 1 期交接见 [docs/phase-1-handoff.md](docs/phase-1-handoff.md)。第 2 期交接见 [docs/phase-2-handoff.md](docs/phase-2-handoff.md)。

## 流程

1. 开新的一期（或新对话继续下一期）之前，先提醒沉淀：跑测试、对齐文档、写或更新**当期** handoff。不要直接扩功能。
2. 未经我明确确认，不要 `git commit` 或 `git push`。写完代码、文档或交接后停在工作区，等我要求再提交。
3. 开始做新功能时，若工作区已有未提交改动（尤其会和新功能改到同一批文件），先停下来问我：要不要先提交当前文件，避免两个功能混在一次提交里。
4. 改 `js/game/`、对局逻辑（`js/scenes/play.ts`、抽题、已玩记录）或 `scripts/test-game.ts` / `scripts/solve.ts` 之后，必须跑 `npm test`，通过后再结束。只改文档或本文件不必测。
5. 已结束的分期交接冻结，不要再改（`docs/phase-0-handoff.md`、`docs/phase-1-handoff.md`、`docs/phase-2-handoff.md`）。新进展写入 [docs/roadmap.md](docs/roadmap.md)、[docs/prd.md](docs/prd.md)、[docs/tech.md](docs/tech.md)，或新建 `docs/phase-N-handoff.md`。

## 编码

### 1. 平台

1. 客户端是微信**小游戏**（`compileType: game`），不是小程序。入口 `game.js`，用 Canvas，没有 WXML。
2. AppID `wx7ef5e16ec6f6fd5f`。第 0–3 期不用云。
3. `js/game/` 内模块不引用 `wx`。场景和 `js/audio/` 可以调用 `wx`（画布、存储、播放）。非法操作提示画在对局里，不要用 `wx.showToast` 挡牌。

### 2. 分数与显示

1. 中间结果用整数分子 / 分母，不做约分。
2. 是否等于 24 用 `isTwentyFour`（交叉相乘），禁止 `number === 24`。
3. 能整除则显示整数，否则不约分（`2÷8` 显示 `2/8`）。

### 3. 对局

1. 合成牌占用**后点**那张的 `slot`；先点的格子留空。固定 2×2，不按剩余张数重排。
2. 弹出结算时清空对局 `hits`，只登记弹窗按钮。
3. 对局 UI 无撤销。`merge.ts` 的 `undo` 可留着不用。

### 4. 题库与打包

1. 求解器只放 `scripts/`，不要打进小游戏包。
2. `docs/`、`scripts/`、`js/game/puzzles.json`、`assets/` 已在 `project.config.json` 的 pack ignore 里。进包音频放仓库根目录 `audio/`，不要放进 `assets/`。
3. 对局 `require` `puzzles.catalog.js`，不要直接 require JSON。
4. 第 0–4 期对局只发有解题。`puzzles.json` 含 `unsolvable`，抽题须跳过。

## 文档分工

1. 玩法：`docs/rules.md`（已冻结；发现与代码不符时先报告，不擅自改玩法）
2. 产品页面与分期验收：`docs/prd.md`
3. 技术：`docs/tech.md`
4. 测试问题：`docs/test.md`（先讨论再改代码）
5. 题库预览与难度：`docs/puzzles-preview.md`
6. 牌面动画（参考拆解与第 2 期方案）：`docs/animation.md`
7. 音效方案：`docs/audio.md`；授权记录：`docs/audio-assets.md`
