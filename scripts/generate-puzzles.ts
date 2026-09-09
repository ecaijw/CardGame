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
  writeFileSync(previewPath, renderPreview(puzzles))
  const counts = countByDifficulty(puzzles)
  const solvable = puzzles.length - counts.unsolvable
  console.log(
    `wrote ${puzzles.length} puzzles → ${jsonPath} (easy ${counts.easy}, medium ${counts.medium}, hard ${counts.hard}, unsolvable ${counts.unsolvable}; solvable ${solvable})`,
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
    '由 `npm run generate:puzzles` 生成。正本在 [`js/game/puzzles.json`](../js/game/puzzles.json)。对局尚未接入。',
    '',
    '## 难度分级',
    '',
    '生成时写入 `difficulty`，运行时只读。按下面顺序判定，命中即停：',
    '',
    '1. **unsolvable**：穷举后没有任何合法合并路径得到 24。`steps` 为空，`expression` 为空字符串。第 0–4 期对局不发这类题。',
    '2. **hard**：所有解法都至少出现一次非整数分数（如 `3/4`、`1/5`、`8/3`，或先造小分数再除）。',
    '3. **easy**：存在全程正整数解，且不必用除法（中间结果都是正整数，允许 11–13，允许减法只要仍为正）。',
    '4. **medium**：存在全程正整数解，但必须整除（如 `48÷2=24`）；或没有正整数解、也不必走非整数分数（例如必须用负数）。',
    '',
    '不再用「最大点数 ≤ 10」或「只要出现除法」直接分档。代表解优先选全程正整数，再少分数、少负数、少除法。`expression` 去掉最外层一对括号。',
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
