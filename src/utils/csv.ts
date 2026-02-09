export interface CsvColumn<T> {
  key: keyof T
  header: string
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const raw = String(value)

  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replaceAll('"', '""')}"`
  }

  return raw
}

export function toCsv<T extends object>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const headerLine = columns.map((column) => escapeCsvCell(column.header)).join(',')
  const dataLines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column.key])).join(','),
  )

  return [headerLine, ...dataLines].join('\n')
}

export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
