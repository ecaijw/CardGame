# 24 点 — 音频授权记录

游戏内文件在仓库根目录 [`audio/`](../audio/)。ZIP / WAV 原片不进仓库，留在本机 `/tmp/cardgame-audio`。播放见 [audio.md](audio.md)。

下载日期：2026-09-26。`select` / `merge` 于同日换成 kalimba。

## 合计

7 个 MP3，约 **593 KB**（BGM 563 KB + 音效约 30 KB），低于方案 1.5 MB 上限。

| 游戏内文件 | 大小 | 时长 | 原文件 | 作者 | 下载页 | 许可证 | 处理 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `audio/bgm.mp3` | 564 KB | 48.0 s | `cozy_puzzle_in-game_2_bpm90.mp3` | MintoDog | [OpenGameArt · Cozy Puzzle In-Game 2](https://opengameart.org/content/cozy-puzzle-in-game-2) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 截取 0–48 s；96 kbps stereo / 44.1 kHz |
| `audio/tap.mp3` | 1.9 KB | 97 ms | `click_001.ogg` | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 | 转 MP3 96 kbps mono |
| `audio/select.mp3` | 5.7 KB | 400 ms | `kalimba.wav`（第一音） | railkill | [OpenGameArt · Kalimba Two-Notes](https://opengameart.org/content/kalimba-two-notes) | CC0 | 轻的第一音；淡出；96 kbps mono |
| `audio/merge.mp3` | 2.9 KB | 180 ms | `kalimba.wav`（第二音） | railkill | 同上 | CC0 | 从第二音起音后截取，去掉开头的第一音尾巴；96 kbps mono |
| `audio/invalid.mp3` | 2.8 KB | 160 ms | `error_001.ogg` | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 | 转 MP3 96 kbps mono |
| `audio/success.mp3` | 6.8 KB | 517 ms | `confirmation_002.ogg` | Kenney | 同上 | CC0 | 同上 |
| `audio/next.mp3` | 4.6 KB | 315 ms | `open_002.ogg` | Kenney | 同上 | CC0 | 同上 |

Kenney 包说明：`Interface Sounds (1.0)`，创建日 2020-02-11，作者 Kenney（www.kenney.nl）。包内 `License.txt` 写明个人 / 教育 / 商业可用，致谢非强制。

## 和方案的偏差

- 音效用了方案里的**备选包** Interface Sounds，没用主选 UI Audio（同一作者、同为 CC0；音色更贴近轻点 / 选择 / 确认）。
- `select` / `merge` 后来换成 OpenGameArt *Kalimba Two-Notes*（拇指琴，接近马林巴的木质余韵）。Kenney 的 `select_003` / `pluck_002` 太短促、偏电子点击。点牌用轻的第一音，合并用更响的第二音，避免同音叠在一起。
- BGM 没用 Pixabay：开发机无法免登录直接下。改用 OpenGameArt 上同风格、可循环、**CC0** 的 *Cozy Puzzle In-Game 2*（90 BPM，无人声）。因此没有 Pixabay 详情页截图。
- 未改音量；音量留给播放模块（BGM 约 0.16–0.22，音效约 0.35–0.55）。

若听感不合适，可在不改文件名的前提下换源文件，并改本表对应行。
