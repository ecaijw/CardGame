export type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'unsolvable'

export type Puzzle = {
  id: string
  nums: [number, number, number, number]
  difficulty: PuzzleDifficulty
  steps: string[]
  expression: string
}

const ALL = require('./puzzles.catalog') as Puzzle[]

export const SOLVABLE: Puzzle[] = ALL.filter((puzzle) => puzzle.difficulty !== 'unsolvable')

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
): Puzzle {
  const pool = candidatePuzzles(SOLVABLE, played, excludeId)
  return pool[Math.floor(random() * pool.length)]
}
