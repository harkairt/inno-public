export interface ParsedTable {
  headers: string[]
  rows: string[][]
}

export const parseHtmlTable = (tableHtml: string): ParsedTable => {
  const doc = new DOMParser().parseFromString(tableHtml, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return { headers: [], rows: [] }

  const headers = Array.from(table.querySelectorAll('thead th'), (th) =>
    (th.textContent ?? '').trim(),
  )

  const rows = Array.from(table.querySelectorAll('tbody tr'), (tr) =>
    Array.from(tr.querySelectorAll('td'), (td) => (td.textContent ?? '').trim()),
  )

  return { headers, rows }
}
