import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyDifficulty,
  enumerateTuples,
  puzzleId,
  solve,
  type Puzzle,
} from './solve'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const jsonPath = join(root, 'js/game/puzzles.json')
const catalogPath = join(root, 'js/game/puzzles.catalog.js')
const previewPath = join(root, 'docs/puzzles-preview.md')

function main() {
  const puzzles: Puzzle[] = []
  for (const nums of enumerateTuples()) {
    const result = solve(nums)
    puzzles.push({
      id: puzzleId(nums),
      nums,
      difficulty: classifyDifficulty(result),
      steps: result?.best.steps ?? [],
      expression: result?.best.expression ?? '',
    })
    if (puzzles.length % 400 === 0) {
      console.log(`… ${puzzles.length} / 1820`)
    }
  }

  mkdirSync(dirname(jsonPath), { recursive: true })
  writeFileSync(jsonPath, `${JSON.stringify(puzzles, null, 2)}\n`)
  writeFileSync(catalogPath, `module.exports = ${JSON.stringify(puzzles)};\n`)
  writeFileSync(previewPath, renderPreview(puzzles))
  const counts = countByDifficulty(puzzles)
  const solvable = puzzles.length - counts.unsolvable
  console.log(
    `wrote ${puzzles.length} puzzles → ${jsonPath} and ${catalogPath} (easy ${counts.easy}, medium ${counts.medium}, hard ${counts.hard}, unsolvable ${counts.unsolvable}; solvable ${solvable})`,
  )
}

function countByDifficulty(puzzles: Puzzle[]) {
  const counts = { easy: 0, medium: 0, hard: 0, unsolvable: 0 }
  for (const puzzle of puzzles) {
    counts[puzzle.difficulty] += 1
  }
  return counts
}

function renderPreview(puzzles: Puzzle[]): string {
  const counts = countByDifficulty(puzzles)
  const solvable = puzzles.length - counts.unsolvable
  const lines = [
    '# 24 点题库预览',
    '',
    '由 `npm run generate:puzzles` 生成。正本在 [`js/game/puzzles.json`](../js/game/puzzles.json)；对局 `require` [`js/game/puzzles.catalog.js`](../js/game/puzzles.catalog.js)。抽题跳过 `unsolvable`。',
    '',
    '## 难度分级',
    '',
    '生成时写入 `difficulty`，运行时只读。按下面顺序判定，命中即停：',
    '',
    '1. **easy**：存在全程正整数、且不用除法的解法。只使用加、减、乘。',
    '2. **hard**：每一条解法都至少出现一次非整数分数；或者去掉加法、乘法左右交换后，正整数解法模式不超过 2 种，并且这些解法都不能用两张原始牌直接整除。',
    '3. **medium**：其余有解题。包括可以先用两张原始牌直接整除的题，例如 `9÷3` 或 `5÷5`。',
    '4. **unsolvable**：穷举后没有任何合法合并路径得到 24。`steps` 为空，`expression` 为空字符串。第 0–4 期对局不发这类题。',
    '',
    '简单先于困难判定，避免把 `1,1,1,8` 这类不用除法的题划进困难。代表解优先全程正整数、不用除法、两张原始牌直接整除、除数构造更浅、除法更少、中间结果绝对值更小、不用负数。`expression` 去掉最外层一对括号。',
    '',
    '## 数量',
    '',
    `- 全部四元组：${puzzles.length} / 1820`,
    `- 有解：${solvable}`,
    `- easy：${counts.easy}`,
    `- medium：${counts.medium}`,
    `- hard：${counts.hard}`,
    `- unsolvable：${counts.unsolvable}`,
    '',
  ]
  for (const level of ['easy', 'medium', 'hard', 'unsolvable'] as const) {
    lines.push(`## ${level}`, '')
    lines.push('| id | 解法 | 表达式 |')
    lines.push('| --- | --- | --- |')
    const samples = puzzles.filter((puzzle) => puzzle.difficulty === level).slice(0, 5)
    for (const puzzle of samples) {
      const steps = puzzle.steps.length ? puzzle.steps.join(' → ') : '—'
      const expression = puzzle.expression ? `\`${puzzle.expression}\`` : '—'
      lines.push(`| ${puzzle.id} | ${steps} | ${expression} |`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

main()
