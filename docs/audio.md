# 24 点 — 背景音乐与音效（第 2 期）

产品入口见 [prd.md](prd.md)，技术边界见 [tech.md](tech.md)。玩法仍以 [rules.md](rules.md) 为准。本文件是接入方案，**先落地文档，音源由你手动下载后再改代码。**

**现状（2026-09-26）：** 设置页「音效 / 音乐」开关仍写 `soundEnabled` / `musicEnabled`。7 个 MP3 在 `audio/`，授权见 [audio-assets.md](audio-assets.md)。播放由 `[js/audio/audio-manager.ts](../js/audio/audio-manager.ts)` 接入首页、对局和设置。

原则：免费现成素材优先（Kenney CC0 + Pixabay 音乐）；AI 生成只作 BGM 备选，且必须有明确商业授权。不要从来源不明的网站自动抓取。不要用 Mixkit 背景音乐（其免费许可不允许电子游戏）。

---

## 1. 风格

轻松、清新、益智。音乐不能抢注意力。


|     | 要求                                                             |
| --- | -------------------------------------------------------------- |
| BGM | 80–100 BPM；木琴 / 马林巴、轻拨弦、柔和木质打击；无人声；不要重鼓、电舞、紧张或电影感；30–60 秒可无缝循环 |
| 音效  | 轻巧短促；木质 / 气泡 / 马林巴；不要尖锐电子哔声；全套同一听感                             |


---



## 2. 和现有代码怎么接

不要新建一套设置 UI，也不要换存储 key。


| 已有                                                                    | 接入时                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `[js/scenes/settings.ts](../js/scenes/settings.ts)` 音效 / 音乐两行开关       | 开关仍写 `setSoundEnabled` / `setMusicEnabled`，并立刻调用音频模块静音或恢复          |
| `[js/settings.ts](../js/settings.ts)` `soundEnabled` / `musicEnabled` | 继续用这两个 key。不要改成 `audio.sfxEnabled`                                 |
| `[js/main.ts](../js/main.ts)` 首页「开始游戏 / 玩法说明 / 设置」                    | 点「开始游戏」：先 `tap`，再 `unlockAndStartBgm()`，再进对局。说明、设置：`tap`           |
| `[js/scenes/play.ts](../js/scenes/play.ts)`                           | 只在场景里调 `playSfx`，不要在 `js/game/` 里播声音                               |
| `assets/` 已在 pack ignore                                              | **不要**把进包音频放进 `assets/audio/`。用仓库根目录 `audio/`                      |
| `docs/` 已 pack ignore                                                 | 授权记录放 `docs/audio-assets.md`，证明图放 `docs/ux/` 或 `docs/audio-proof/` |


`js/game/` 仍不引用 `wx`。音频模块可以调 `wx`（和 settings 一样）。

合并已在动画期间排队下一手（test.md 第 13 条）。**声音跟「真正执行 merge」走**（`onCard` 里 `merge` 成功的那一刻），不要在排队时先响。

---



## 3. 素材来源（你先下载，不要让工具乱下）



### 3.1 音效 — Kenney（CC0）

- 主选：[UI Audio](https://kenney.nl/assets/ui-audio)
- 备选：[Interface Sounds](https://kenney.nl/assets/interface-sounds)

同一套音色里各挑一只，不要把整包打进游戏。缺「成功」短铃时，可从 [Pixabay UI selection](https://pixabay.com/sound-effects/search/ui%20selection/) 找一句短 `success chime`（同样记授权）。

### 3.2 BGM — Pixabay Music

- 搜：casual puzzle / cute game / marimba / light playful / relaxing game
- [授权摘要](https://pixabay.com/service/license-summary/)
- 无人声、无品牌/影视熟旋律、能剪 30–60 秒循环、优先无 Content ID 盾
- 保存详情页 URL、作者、原文件名、授权页；另存详情页 / 下载或许可说明截图（不进小游戏包）

找不到再考虑生成纯音乐（约 90 BPM，marimba + 拨弦，seamless loop，无人声）。生成工具必须有商业授权，否则不进正式包。

---



## 4. 目录与规格

```
audio/                 打进小游戏包（不要 ignore）
  bgm.mp3
  tap.mp3
  select.mp3
  merge.mp3
  invalid.mp3
  success.mp3
  next.mp3
```


| 文件            | 用途                            |
| ------------- | ----------------------------- |
| `bgm.mp3`     | 首页与对局共用，循环                    |
| `tap.mp3`     | 普通按钮（开始、说明、设置、返回、答案、难度）       |
| `select.mp3`  | 点数字牌、点运算符                     |
| `merge.mp3`   | 一次有效合并，且本步还不是终局 24            |
| `invalid.mp3` | 除以 0、未先选牌点运算、失败结算（第一版不单独做失败曲） |
| `success.mp3` | 最后一张正好 24                     |
| `next.mp3`    | 重试 / 重开本局、下一局                 |


规格：BGM 为 MP3、30–60s、96–128 kbps、44.1 kHz、尽量 < 800KB、首尾能循环。音效 0.05–0.8s、尽量 < 30KB、剪掉首尾静音。全部音频目标约 1MB，上限 1.5MB。ZIP、WAV 原片、未用音效不要进包。

没有文件时：可以先搭模块和调用点，**不要用空文件冒充**。需要你放入 `audio/` 的就是上表 7 个名字。

---



## 5. 模块

新建 `js/audio/audio-manager.ts`（或 `js/audio.ts`）。播放不要散落在各场景里复制 `createInnerAudioContext`。

对外：`init`、`unlockAndStartBgm`、`playBgm`、`pauseBgm`、`playSfx(name)`、`setMusicEnabled`、`setSfxEnabled`、`dispose`。

实现要点：

1. `wx.createInnerAudioContext()`；BGM `loop = true`。
2. BGM 只在玩家第一次点「开始游戏」后开始，不要进页就播。
3. BGM 音量约 0.16–0.22；普通音效 0.35–0.55；success 可略高但不刺耳。
4. 播音效不得让 BGM 重头开始。
5. 连点不能无限 new 音频对象（音效用固定实例，必要时停掉再播）。
6. 播放失败只吞掉，不挡对局。
7. `wx.onHide` 暂停 BGM；`wx.onShow` 若音乐开着再恢复。
8. 声音不参与是否等于 24、抽题、统计。

设置页关音乐：立刻 `pauseBgm`。再开：从当前进度续播或重头均可，行为要稳定。关音效：只静音 SFX。

---



## 6. 触发（一次操作只响一个主音）


| 时机                                | 现有入口                                    | 声音                               |
| --------------------------------- | --------------------------------------- | -------------------------------- |
| 开始游戏                              | `main.ts` `action === 'start'`          | `tap`，然后 `unlockAndStartBgm`     |
| 玩法说明 / 说明返回 / 首页设置                | `main.ts` howto / back / settings       | `tap`                            |
| 设置返回                              | `settings.ts` `back`                    | `tap`                            |
| 拨动音效 / 音乐开关                       | `settings.ts` ~~sound / music~~         | ~~可~~ `tap`~~（音效关时这下可以不响）并应用开关~~ |
| ~~点牌~~                            | `play.ts` ~~~~`onCard` ~~仅改选中、未 merge~~ | `select`                         |
| ~~点运算符~~                          | `play.ts` ~~~~`onOp` ~~选中或改选~~          | `select`                         |
| ~~未选牌点运算~~                        | `onOp` ~~toast「请先点选一张牌」~~               | `invalid`                        |
| ~~除以 0 / 非法 merge~~               | `onCard` ~~~~`merged.ok === false`      | `invalid`                        |
| ~~有效合并且~~ `outcome === 'playing'` | `onCard` 写入 merging 时                   | `merge`（排队的下一手也在真正 `onCard` 时响）  |
| 有效合并且终局成功                         | 同上，`result === 'success'`               | 只 `success`，不要叠 `merge`          |
| 有效合并且终局失败                         | `result === 'fail'`                     | 只 `invalid`                      |
| 重试 / 弹窗重开本局                       | `reset` / `dialog-restart`              | `next`                           |
| 下一局 / 弹窗下一局                       | `nextPuzzle` / `dialog-next`            | `next`                           |
| 答案、难度、对局设置                        | play 底栏                                 | `tap`                            |


点「开始游戏」会切到对局；`tap` 必须在切场景前发出，且不因场景切换掐掉（音频模块是 App 级单例）。

---



## 7. 版权记录

授权记录见 [audio-assets.md](audio-assets.md)（`docs/` 不进包）。每条记：游戏内文件名、原文件名、作者、下载页、日期、许可证、是否裁剪/压缩/改音量。BGM 实际用 OpenGameArt CC0，不是 Pixabay，故无 Pixabay 截图。

---



## 8. 验收

1. 首次进首页不自动出 BGM。
2. 点「开始游戏」后 BGM 开始；回首页再进对局不叠两路。
3. 连点牌不卡、不泄漏音频实例。
4. merge / success / invalid 能分开。
5. 关音乐立刻静；关音效后按钮和对局操作静；重启小游戏设置还在。
6. 前后台切换后 BGM 状态正确。
7. 以真机为准；模拟器报错不能当唯一结论。
8. 包里没有 ZIP、WAV 原片、未用音效。
9. 若改了 `js/game/`、`play.ts` 或抽题 / 已玩记录：`npm test`。
10. 完成后列出实际文件、各大小、音频合计；**不 commit**，停在工作区。

---



## 9. 开工顺序（你确认后再改代码）

1. 你下载 7 个文件放到 `audio/`，并记下授权信息。
2. 做 `audio-manager`，首页 / 对局 / 设置接上表。
3. 写 `docs/audio-assets.md`，更新 [prd.md](prd.md) / [tech.md](tech.md) / [roadmap.md](roadmap.md) 一句「音源已接」。
4. 按第 8 节验收。

