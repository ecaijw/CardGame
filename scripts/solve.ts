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
  sig: string
  positiveInt: boolean
  fractional: boolean
  divs: number
  hasLeafDiv: boolean
  divBuild: number
  maxAbs: number
}

export type SolveResult = {
  solutions: number
  best: Solution
  hasPositiveInt: boolean
  allNeedFraction: boolean
  hasZeroDivPositive: boolean
  positivePatternCount: number
  hasLeafDivPositive: boolean
}

type Node = {
  value: Fraction
  expr: string
  label: string
  sig: string
  leaf: boolean
  hasLeafDiv: boolean
  depth: number
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
    sig: String(value),
    leaf: true,
    hasLeafDiv: false,
    depth: 0,
  }))
  const found: TrackedSolution[] = []
  search(cards, [], [], { fractional: false, positive: true, divs: 0, divBuild: 0, maxAbs: 0 }, found)
  if (found.length === 0) {
    return null
  }
  const unique = uniqueByExpression(found)
  const best = pickBest(unique)
  const positiveSigs = new Set<string>()
  let hasLeafDivPositive = false
  let hasZeroDivPositive = false
  for (const solution of found) {
    if (!solution.positiveInt) {
      continue
    }
    positiveSigs.add(solution.sig)
    if (solution.hasLeafDiv) {
      hasLeafDivPositive = true
    }
    if (solution.divs === 0) {
      hasZeroDivPositive = true
    }
  }
  return {
    solutions: unique.length,
    best: {
      steps: best.steps,
      expression: stripOuterParens(best.expression),
    },
    hasPositiveInt: positiveSigs.size > 0,
    allNeedFraction: found.every((solution) => solution.fractional),
    hasZeroDivPositive,
    positivePatternCount: positiveSigs.size,
    hasLeafDivPositive,
  }
}

export function classifyDifficulty(result: SolveResult | null): Difficulty {
  if (!result) {
    return 'unsolvable'
  }
  if (result.hasZeroDivPositive) {
    return 'easy'
  }
  if (result.allNeedFraction) {
    return 'hard'
  }
  if (result.positivePatternCount <= 2 && !result.hasLeafDivPositive) {
    return 'hard'
  }
  return 'medium'
}

type SearchAcc = {
  fractional: boolean
  positive: boolean
  divs: number
  divBuild: number
  maxAbs: number
}

function canonical(op: Op, a: string, b: string): string {
  if (op === '+' || op === '×') {
    return a < b ? `(${a}${op}${b})` : `(${b}${op}${a})`
  }
  return `(${a}${op}${b})`
}

function search(
  cards: Node[],
  steps: string[],
  infos: StepInfo[],
  acc: SearchAcc,
  out: TrackedSolution[],
) {
  if (cards.length === 1) {
    if (isTwentyFour(cards[0].value)) {
      out.push({
        steps: [...steps],
        expression: cards[0].expr,
        infos: [...infos],
        sig: cards[0].sig,
        positiveInt: acc.positive,
        fractional: acc.fractional,
        divs: acc.divs,
        hasLeafDiv: cards[0].hasLeafDiv,
        divBuild: acc.divBuild,
        maxAbs: acc.maxAbs,
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
        if ((op === '+' || op === '×') && j < i) {
          continue
        }
        const value = applyOp(cards[i].value, op, cards[j].value)
        if (value === null) {
          continue
        }
        const label = formatFraction(value)
        const magnitude = Math.abs(value.n / value.d)
        const next: Node = {
          value,
          expr: `(${cards[i].expr}${op}${cards[j].expr})`,
          label,
          sig: canonical(op, cards[i].sig, cards[j].sig),
          leaf: false,
          hasLeafDiv:
            cards[i].hasLeafDiv ||
            cards[j].hasLeafDiv ||
            (op === '÷' && cards[i].leaf && cards[j].leaf),
          depth: 1 + Math.max(cards[i].depth, cards[j].depth),
        }
        const remaining = cards.filter((_, index) => index !== i && index !== j)
        search(
          [...remaining, next],
          [...steps, `${cards[i].label}${op}${cards[j].label}=${label}`],
          [...infos, { op, left: cards[i].value, right: cards[j].value, result: value }],
          {
            fractional: acc.fractional || isNonInteger(value),
            positive: acc.positive && isPositiveInt(value),
            divs: acc.divs + (op === '÷' ? 1 : 0),
            divBuild: op === '÷' ? Math.max(acc.divBuild, cards[j].depth) : acc.divBuild,
            maxAbs: Math.max(acc.maxAbs, magnitude),
          },
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

function pickBest(solutions: TrackedSolution[]): TrackedSolution {
  return solutions.reduce((best, current) => (better(current, best) ? current : best))
}

function better(current: TrackedSolution, best: TrackedSolution): boolean {
  const left = score(current)
  const right = score(best)
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return left[index] < right[index]
    }
  }
  return current.expression < best.expression
}

function score(solution: TrackedSolution): number[] {
  const hasNegative = solution.infos.some(
    (step) => isNegative(step.left) || isNegative(step.right) || isNegative(step.result),
  )
  return [
    solution.positiveInt ? 0 : solution.fractional ? 2 : 1,
    solution.divs === 0 ? 0 : 1,
    solution.hasLeafDiv ? 0 : 1,
    solution.divBuild,
    solution.divs,
    Math.round(solution.maxAbs * 1000),
    hasNegative ? 1 : 0,
  ]
}
