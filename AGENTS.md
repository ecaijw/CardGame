# 24 点 — Agent 约束

玩法见 [docs/rules.md](docs/rules.md)。分期见 [docs/roadmap.md](docs/roadmap.md)。第 0 期交接见 [docs/phase-0-handoff.md](docs/phase-0-handoff.md)。

开新的一期（或新对话继续下一期）之前，先提醒沉淀当前进展：跑测试、对齐文档、写或更新该期 handoff。不要直接扩功能。

未经我明确确认，不要 `git commit` 或 `git push`。写完代码、文档或交接后停在工作区，等我要求再提交。

## 编码

- 客户端是微信**小游戏**（`compileType: game`），不是小程序。入口 `game.js`，用 Canvas，没有 WXML。
- AppID `wx7ef5e16ec6f6fd5f`。第 0–3 期不用云。
- `js/game/` 内模块不引用 `wx`。场景可以调用 `wx`（toast、画布）。
- 中间结果用整数分子 / 分母，不做约分。是否等于 24 用 `isTwentyFour`（交叉相乘），禁止 `number === 24`。
- 显示：能整除则显示整数，否则不约分（`2÷8` 显示 `2/8`）。
- 合成牌占用**后点**那张的 `slot`；先点的格子留空。固定 2×2，不按剩余张数重排。
- 求解器只放 `scripts/`，不要打进小游戏包。`docs/` 与 `scripts/` 已在 `project.config.json` 的 pack ignore 里。
- 弹出结算时清空对局 `hits`，只登记弹窗按钮。
- 对局 UI 无撤销。`merge.ts` 的 `undo` 可留着不用。
- 第 0–4 期对局只发有解题。`puzzles.json` 含 `unsolvable`，抽题须跳过。

## 文档分工

- 玩法：`docs/rules.md`（已冻结；发现与代码不符时先报告，不擅自改玩法）
- 产品页面与分期验收：`docs/prd.md`
- 技术：`docs/tech.md`
- 测试问题：`docs/test.md`（先讨论再改代码）
- 题库预览与难度：`docs/puzzles-preview.md`
