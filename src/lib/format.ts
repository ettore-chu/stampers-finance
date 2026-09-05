export function won(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('ko-KR').format(Math.round(n)) + '원'
}

export function signedWon(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return sign + won(n)
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toFixed(digits) + '%'
}

export function millions(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return (n / 1_000_000).toFixed(1) + 'M'
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return d
}
