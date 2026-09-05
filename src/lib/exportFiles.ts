export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function toCsvString(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(',')).join('\r\n')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = '﻿' + toCsvString(rows)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}
