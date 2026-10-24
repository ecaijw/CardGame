# 第 2.2 期交接

日期：2026-10-20 开工。玩法见 [rules.md](rules.md) §4。产品与技术定稿见 [phase-2.2-duel.md](phase-2.2-duel.md)。

**本文进行中**（第 2.2 期工作记录）。结束并沉淀后再冻结。不要把第 3 期的广告、支付写进来。第 2.1 期上线交接仍见 [phase-2.1-handoff.md](phase-2.1-handoff.md)，不冻结。

## 定义

同一设备双人抢答：先抢答再限时合牌，第一位失败后换对方，先到 5 分获胜。双人题库、难度、统计与单人分开。

## 开工基线

定稿 [phase-2.2-duel.md](phase-2.2-duel.md) 已提交。第 2.1 期上线尚未完成。

## 进展沉淀（2026-10-20）

已落地：

- `js/game/session.ts`、`js/game/duel.ts`
- `js/scenes/duel.ts` 独立双人场景；单人 `play.ts` 改走 session
- 首页「单人游戏」「双人对战」；设置页双人统计与答题时长 ±5
- 双人存储：难度、含无解题、已玩 id、答题秒数、`duelStats`
- `npm test` 含 session / duel 状态机用例

待手测：真机多点抢答、布局与弹窗文案、切后台超时路径。

## 结束时

跑 `npm test`，对齐 [roadmap.md](roadmap.md) / [prd.md](prd.md) / [tech.md](tech.md) / [phase-2.2-duel.md](phase-2.2-duel.md)，把本文改成结束总结并冻结。
