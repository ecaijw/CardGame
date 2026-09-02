export type Fraction = {
  n: number
  d: number
}

export type Op = '+' | '−' | '×' | '÷'

export function frac(n: number, d = 1): Fraction {
  if (d === 0) {
    throw new Error('denominator must not be 0')
  }
  if (d < 0) {
    n = -n
    d = -d
  }
  return { n, d }
}

export function fromInt(value: number): Fraction {
  return frac(value, 1)
}

export function add(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d)
}

export function sub(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.d - b.n * a.d, a.d * b.d)
}

export function mul(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.n, a.d * b.d)
}

export function div(a: Fraction, b: Fraction): Fraction | null {
  if (b.n === 0) {
    return null
  }
  return frac(a.n * b.d, a.d * b.n)
}

export function isTwentyFour(value: Fraction): boolean {
  return value.n === 24 * value.d
}

export function formatFraction(value: Fraction): string {
  const sign = value.n < 0 ? '−' : ''
  const n = Math.abs(value.n)
  if (n % value.d === 0) {
    return `${sign}${n / value.d}`
  }
  return `${sign}${n}/${value.d}`
}

export function applyOp(left: Fraction, op: Op, right: Fraction): Fraction | null {
  switch (op) {
    case '+':
      return add(left, right)
    case '−':
      return sub(left, right)
    case '×':
      return mul(left, right)
    case '÷':
      return div(left, right)
  }
}
