export type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'unsolvable'

export type DealFilter = 'easy' | 'medium' | 'hard' | 'all'

export type Puzzle = {
  id: string
  nums: [number, number, number, number]
  difficulty: PuzzleDifficulty
  steps: string[]
  expression: string
}

const ALL = require('./puzzles.catalog') as Puzzle[]

export const SOLVABLE: Puzzle[] = ALL.filter((puzzle) => puzzle.difficulty !== 'unsolvable')

const UNSOLVABLE: Puzzle[] = ALL.filter((puzzle) => puzzle.difficulty === 'unsolvable')

const UNSOLVABLE_DEAL_RATE = 0.25

export function puzzlesFor(filter: DealFilter): Puzzle[] {
  if (filter === 'all') {
    return SOLVABLE
  }
  return SOLVABLE.filter((puzzle) => puzzle.difficulty === filter)
}

export function puzzlesForDeal(filter: DealFilter): Puzzle[] {
  return puzzlesFor(filter)
}

export function candidatePuzzles(
  pool: Puzzle[],
  played: ReadonlySet<string>,
  excludeId?: string,
): Puzzle[] {
  const unplayed = pool.filter((puzzle) => !played.has(puzzle.id))
  if (unplayed.length > 0) {
    return unplayed
  }
  const rest = excludeId ? pool.filter((puzzle) => puzzle.id !== excludeId) : pool
  return rest.length > 0 ? rest : pool
}

export function pickPuzzle(
  played: ReadonlySet<string>,
  excludeId?: string,
  random: () => number = Math.random,
  filter: DealFilter = 'all',
  includeUnsolvable = false,
): Puzzle {
  const solvable = candidatePuzzles(puzzlesFor(filter), played, excludeId)
  if (!includeUnsolvable || random() >= UNSOLVABLE_DEAL_RATE) {
    return solvable[Math.floor(random() * solvable.length)]
  }
  const unsolvable = candidatePuzzles(UNSOLVABLE, played, excludeId)
  return unsolvable[Math.floor(random() * unsolvable.length)]
}
