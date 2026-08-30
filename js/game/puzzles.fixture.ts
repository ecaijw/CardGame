export type FixturePuzzle = {
  id: string
  nums: [number, number, number, number]
}

export const FIXTURES: FixturePuzzle[] = [
  { id: '1,2,3,8', nums: [1, 2, 3, 8] },
  { id: '3,3,8,8', nums: [3, 3, 8, 8] },
  { id: '1,5,5,5', nums: [1, 5, 5, 5] },
]

export function nextIndex(index: number): number {
  return (index + 1) % FIXTURES.length
}
