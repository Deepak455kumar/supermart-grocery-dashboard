import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Search,
  X,
} from 'lucide-react'
import { money, number, pct, type Row } from './analytics'
import './explorer.css'

type Key = keyof Pick<
  Row,
  | 'id'
  | 'customer'
  | 'category'
  | 'subcategory'
  | 'city'
  | 'date'
  | 'region'
  | 'sales'
  | 'discount'
  | 'profit'
  | 'state'
>
type Column = { key: Key; label: string; numeric?: boolean }

const columns: Column[] = [
  { key: 'id', label: 'Order ID' },
  { key: 'customer', label: 'Customer Name' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Sub Category' },
  { key: 'city', label: 'City' },
  { key: 'date', label: 'Order Date' },
  { key: 'region', label: 'Region' },
  { key: 'sales', label: 'Sales', numeric: true },
  { key: 'discount', label: 'Discount', numeric: true },
  { key: 'profit', label: 'Profit', numeric: true },
  { key: 'state', label: 'State' },
]
const collator = new Intl.Collator('en-IN', {
  sensitivity: 'base',
  numeric: true,
})
const calendar = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const defaultKeys = columns
  .filter(({ key }) => !['customer', 'state'].includes(key))
  .map(({ key }) => key)
const searchKeys: Key[] = [
  'id',
  'category',
  'subcategory',
  'city',
  'date',
  'region',
  'state',
]

function formatCell(row: Row, key: Key) {
  if (key === 'sales' || key === 'profit') return money(row[key])
  if (key === 'discount') return pct(row.discount * 100)
  if (key === 'date') return calendar.format(new Date(row.date + 'T00:00:00Z'))
  return row[key]
}

function csvCell(value: string | number) {
  if (typeof value === 'number') return String(value)
  // A quoted spreadsheet cell may still be evaluated as a formula when opened.
  const safe = /^[\t\r\n]|^\s*[=+@-]/u.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

export function buildExplorerCsv(rows: Row[], keys: readonly Key[]) {
  const selected = columns.filter((column) => keys.includes(column.key))
  const header = selected.map(({ label }) => csvCell(label)).join(',')
  const lines = rows.map((row) =>
    selected.map(({ key }) => csvCell(row[key])).join(','),
  )
  return '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n'
}

function exportRows(rows: Row[], keys: Key[]) {
  const blob = new Blob([buildExplorerCsv(rows, keys)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'supermart-filtered-sales.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Explorer({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: Key; ascending: boolean }>({
    key: 'id',
    ascending: true,
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [visible, setVisible] = useState<Key[]>(defaultKeys)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settings = useRef<HTMLDivElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const showCustomer = visible.includes('customer')
  const selectedColumns = columns.filter(({ key }) => visible.includes(key))

  useEffect(() => setPage(1), [rows])
  useEffect(() => {
    if (!settingsOpen) return
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !settings.current?.contains(event.target)
      )
        setSettingsOpen(false)
    }
    function close(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        settingsButton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', close)
    }
  }, [settingsOpen])

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en-IN')
    const fields = showCustomer
      ? [...searchKeys, 'customer' as const]
      : searchKeys
    const results = needle
      ? rows.filter((row) =>
          fields.some((key) =>
            String(row[key]).toLocaleLowerCase('en-IN').includes(needle),
          ),
        )
      : [...rows]
    return results.sort((a, b) => {
      const left = a[sort.key],
        right = b[sort.key]
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : collator.compare(String(left), String(right))
      return sort.ascending ? order : -order
    })
  }, [query, rows, sort, showCustomer])
  const pages = Math.max(1, Math.ceil(matches.length / pageSize))
  const currentPage = Math.min(page, pages)
  const offset = (currentPage - 1) * pageSize
  const pageRows = matches.slice(offset, offset + pageSize)

  function toggleSort(key: Key) {
    setSort((previous) => ({
      key,
      ascending:
        previous.key === key
          ? !previous.ascending
          : !['sales', 'profit', 'discount'].includes(key),
    }))
    setPage(1)
  }
  function toggleColumn(key: Key) {
    const next = visible.includes(key)
      ? visible.filter((item) => item !== key)
      : [...visible, key]
    if (!next.length) return
    setVisible(next)
    if (!next.includes(sort.key)) setSort({ key: next[0], ascending: true })
    setPage(1)
  }
  function search(value: string) {
    setQuery(value)
    setPage(1)
  }

  return (
    <section className="explorer" aria-label="Sales records">
      <header className="ex-heading">
        <div>
          <h2>Sales records</h2>
          <p>Explore individual transactions in the selected data.</p>
        </div>
        <button
          className="ex-export"
          disabled={!matches.length}
          onClick={() => exportRows(matches, visible)}
        >
          <Download size={16} aria-hidden="true" />
          Export CSV
        </button>
      </header>
      <div className="ex-tools">
        <div className="ex-search">
          <Search aria-hidden="true" size={17} />
          <input
            ref={searchInput}
            aria-label="Search sales records"
            type="search"
            placeholder="Search orders, categories, locations…"
            value={query}
            onChange={(event) => search(event.target.value)}
          />
          {query && (
            <button
              aria-label="Clear search"
              onClick={() => {
                search('')
                searchInput.current?.focus()
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="ex-settings" ref={settings}>
          <button
            className="ex-button"
            ref={settingsButton}
            aria-controls="explorer-columns"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Columns3 size={16} aria-hidden="true" />
            Columns
          </button>
          {settingsOpen && (
            <fieldset id="explorer-columns" className="ex-column-list">
              <legend>Visible columns</legend>
              {columns.map(({ key, label }) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={visible.includes(key)}
                    disabled={visible.length === 1 && visible[0] === key}
                    onChange={() => toggleColumn(key)}
                  />
                  {label}
                  {key === 'customer' && <small>alias</small>}
                </label>
              ))}
              <p>Exports include visible columns and all matching rows.</p>
            </fieldset>
          )}
        </div>
      </div>
      <div
        className="ex-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scrollable sales table"
      >
        <table>
          <thead>
            <tr>
              {selectedColumns.map(({ key, label, numeric }) => {
                const sorted = sort.key === key
                const Icon = sorted
                  ? sort.ascending
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown
                return (
                  <th
                    key={key}
                    scope="col"
                    className={numeric ? 'ex-numeric' : ''}
                    aria-sort={
                      sorted
                        ? sort.ascending
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    <button
                      aria-label={'Sort by ' + label}
                      onClick={() => toggleSort(key)}
                    >
                      {label}
                      <Icon size={13} aria-hidden="true" />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={offset + i}>
                {selectedColumns.map(({ key, numeric }) => (
                  <td
                    key={key}
                    className={
                      numeric ? 'ex-numeric' : key === 'id' ? 'ex-id' : ''
                    }
                  >
                    {formatCell(row, key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!matches.length && (
        <div className="ex-empty">
          <Search size={22} aria-hidden="true" />
          <strong>No matching records</strong>
          <span>
            {query
              ? 'Try a different search or adjust the global filters.'
              : 'Adjust the global filters to see sales records.'}
          </span>
          {query && (
            <button className="ex-button" onClick={() => search('')}>
              Clear search
            </button>
          )}
        </div>
      )}
      <footer className="ex-footer">
        <span role="status">
          {matches.length
            ? number(offset + 1) +
              '–' +
              number(offset + pageRows.length) +
              ' of ' +
              number(matches.length) +
              ' records'
            : '0 records'}
        </span>
        <div className="ex-paging">
          <label>
            Rows per page{' '}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <button
            aria-label="Previous page"
            className="ex-icon-button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {number(currentPage)} / {number(pages)}
          </span>
          <button
            aria-label="Next page"
            className="ex-icon-button"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </section>
  )
}
