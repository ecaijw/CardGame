# 24 点

微信小游戏：用 4 个数做四则运算，逐步合并凑出 24。

## 文档

- [玩法规则](docs/rules.md)
- [产品需求](docs/prd.md)
- [技术方案](docs/tech.md)
- [分期路线图](docs/roadmap.md)
- [第 0 期交接](docs/phase-0-handoff.md)
- [题库预览](docs/puzzles-preview.md)
- [Agent 约束](AGENTS.md)

当前进度：**第 0 期已完成。** 第 1 期抽题与查看答案已接入。难度入口未做。

开新的一期之前，先沉淀当前进展（见路线图文首）。

## 本地运行

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目：左侧选 **Mini Game**，目录选本仓库根（含 `game.js` 与 `project.config.json`）
3. AppID 用已有小游戏号 `wx7ef5e16ec6f6fd5f`
4. 不用云服务

```bash
npm install
npm test
npm run generate:puzzles
```

头像上传用 [`assets/icon.png`](assets/icon.png)。

## 技术栈

微信原生小游戏 + TypeScript + Canvas。规则在 `js/game/`，不依赖 `wx`。
