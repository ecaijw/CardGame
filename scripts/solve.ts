import {
  applyOp,
  formatFraction,
  fromInt,
  isTwentyFour,
  type Fraction,
  type Op,
} from '../js/game/fraction'

const OPS: Op[] = ['+', '−', '×', '÷']

export type Difficulty = 'easy' | 'medium' | 'hard' | 'unsolvable'

export type Puzzle = {
  id: string
  nums: [number, number, number, number]
  difficulty: Difficulty
  steps: string[]
  expression: string
}

export type Solution = {
  steps: string[]
  expression: string
}

type StepInfo = {
  op: Op
  left: Fraction
  right: Fraction
  result: Fraction
}

type TrackedSolution = Solution & {
  infos: StepInfo[]
}

export type SolveResult = {
  solutions: number
  best: Solution
  hasPositiveInt: boolean
  allNeedFraction: boolean
}

type Node = {
  value: Fraction
  expr: string
  label: string
}

export function puzzleId(nums: number[]): string {
  return [...nums].sort((a, b) => a - b).join(',')
}

export function enumerateTuples(): Array<[number, number, number, number]> {
  const tuples: Array<[number, number, number, number]> = []
  for (let a = 1; a <= 13; a++) {
    for (let b = a; b <= 13; b++) {
      for (let c = b; c <= 13; c++) {
        for (let d = c; d <= 13; d++) {
          tuples.push([a, b, c, d])
        }
      }
    }
  }
  return tuples
}

export function solve(nums: number[]): SolveResult | null {
  const cards: Node[] = nums.map((value) => ({
    value: fromInt(value),
    expr: String(value),
    label: formatFraction(fromInt(value)),
  }))
  const found: TrackedSolution[] = []
  search(cards, [], [], found)
  if (found.length === 0) {
    return null
  }
  const unique = uniqueByExpression(found)
  const best = pickBest(unique)
  const kinds = unique.map(inspect)
  return {
    solutions: unique.length,
    best: {
      steps: best.steps,
      expression: stripOuterParens(best.expression),
    },
    hasPositiveInt: kinds.some((kind) => kind.positiveInt),
    allNeedFraction: kinds.every((kind) => kind.fractional),
  }
}

export function classifyDifficulty(result: SolveResult | null): Difficulty {
  if (!result) {
    return 'unsolvable'
  }
  if (result.allNeedFraction) {
    return 'hard'
  }
  if (result.hasPositiveInt) {
    const divs = result.best.steps.filter((step) => step.includes('÷')).length
    return divs === 0 ? 'easy' : 'medium'
  }
  return 'medium'
}

function search(
  cards: Node[],
  steps: string[],
  infos: StepInfo[],
  out: TrackedSolution[],
) {
  if (cards.length === 1) {
    if (isTwentyFour(cards[0].value)) {
      out.push({
        steps: [...steps],
        expression: cards[0].expr,
        infos: [...infos],
      })
    }
    return
  }
  for (let i = 0; i < cards.length; i++) {
    for (let j = 0; j < cards.length; j++) {
      if (i === j) {
        continue
      }
      for (const op of OPS) {
        const value = applyOp(cards[i].value, op, cards[j].value)
        if (value === null) {
          continue
        }
        const label = formatFraction(value)
        const next: Node = {
          value,
          expr: `(${cards[i].expr}${op}${cards[j].expr})`,
          label,
        }
        const remaining = cards.filter((_, index) => index !== i && index !== j)
        search(
          [...remaining, next],
          [...steps, `${cards[i].label}${op}${cards[j].label}=${label}`],
          [...infos, { op, left: cards[i].value, right: cards[j].value, result: value }],
          out,
        )
      }
    }
  }
}

function uniqueByExpression(solutions: TrackedSolution[]): TrackedSolution[] {
  const seen = new Set<string>()
  const unique: TrackedSolution[] = []
  for (const solution of solutions) {
    if (seen.has(solution.expression)) {
      continue
    }
    seen.add(solution.expression)
    unique.push(solution)
  }
  return unique
}

function stripOuterParens(expression: string): string {
  if (expression.startsWith('(') && expression.endsWith(')')) {
    return expression.slice(1, -1)
  }
  return expression
}

function isNonInteger(value: Fraction): boolean {
  return value.n % value.d !== 0
}

function isNegative(value: Fraction): boolean {
  return value.n < 0
}

function isPositiveInt(value: Fraction): boolean {
  return value.n > 0 && value.n % value.d === 0
}

function inspect(solution: TrackedSolution) {
  const values = solution.infos.flatMap((step) => [step.left, step.right, step.result])
  return {
    fractional: values.some(isNonInteger),
    positiveInt: values.every(isPositiveInt),
  }
}

function pickBest(solutions: TrackedSolution[]): TrackedSolution {
  return solutions.reduce((best, current) => (rank(current) < rank(best) ? current : best))
}

function rank(solution: TrackedSolution): string {
  const kind = inspect(solution)
  const classRank = kind.positiveInt ? 0 : kind.fractional ? 2 : 1
  const fracCount = solution.infos.filter(
    (step) => isNonInteger(step.left) || isNonInteger(step.right) || isNonInteger(step.result),
  ).length
  const negCount = solution.infos.filter(
    (step) => isNegative(step.left) || isNegative(step.right) || isNegative(step.result),
  ).length
  const divCount = solution.infos.filter((step) => step.op === '÷').length
  return `${classRank}:${fracCount}:${negCount}:${divCount}:${solution.steps.join('|')}`
}
