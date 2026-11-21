export type Row = {
  id: string
  customer: string
  category: string
  subcategory: string
  city: string
  date: string
  region: string
  sales: number
  discount: number
  profit: number
  state: string
}
export type Dimension = 'category' | 'subcategory' | 'region' | 'state' | 'city'
export type Period = 'Month' | 'Quarter' | 'Year'
export type Group = {
  name: string
  sales: number
  profit: number
  orders: number
  count: number
  margin: number
}
export type Filters = Record<Dimension | 'start' | 'end', string>
export const initialFilters: Filters = {
  category: '',
  subcategory: '',
  region: '',
  state: '',
  city: '',
  start: '',
  end: '',
}
export const dimensions: Dimension[] = [
  'category',
  'subcategory',
  'region',
  'state',
  'city',
]
export const labels: Record<Dimension, string> = {
  category: 'Category',
  subcategory: 'Subcategory',
  region: 'Region',
  state: 'State',
  city: 'City',
}
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const digits = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
export const money = (n: number) =>
  (Number.isInteger(n) ? inr : inrPaise).format(n)
export const number = (n: number) => digits.format(n)
export const pct = (points: number) => number(points) + '%'
export const compactMoney = (n: number) =>
  Math.abs(n) >= 1e7
    ? '₹' + number(n / 1e7) + ' Cr'
    : Math.abs(n) >= 1e5
      ? '₹' + number(n / 1e5) + ' L'
      : Math.abs(n) >= 1e3
        ? '₹' + number(n / 1e3) + 'k'
        : money(n)
export const dateLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
export const filterRows = (rows: Row[], f: Partial<Filters>) =>
  rows.filter(
    (row) =>
      (!f.start || row.date >= f.start) &&
      (!f.end || row.date <= f.end) &&
      dimensions.every((key) => !f[key] || row[key] === f[key]),
  )
export function changeFilter(
  f: Filters,
  key: keyof Filters,
  value: string,
): Filters {
  const next = { ...f, [key]: value }
  if (key === 'category') next.subcategory = ''
  if (key === 'region') {
    next.state = ''
    next.city = ''
  }
  if (key === 'state') next.city = ''
  return next
}
export function optionsFor(rows: Row[], key: Dimension, f: Filters) {
  const ancestors: Partial<Filters> = {}
  if (key === 'subcategory') ancestors.category = f.category
  if (key === 'state' || key === 'city') ancestors.region = f.region
  if (key === 'city') ancestors.state = f.state
  return [...new Set(filterRows(rows, ancestors).map((r) => r[key]))].sort()
}
export function metrics(rows: Row[]) {
  let sales = 0,
    profit = 0,
    discount = 0
  const ids = new Set<string>()
  for (const r of rows) {
    sales += Math.round(r.sales * 100)
    profit += Math.round(r.profit * 100)
    discount += r.discount
    ids.add(r.id)
  }
  sales /= 100
  profit /= 100
  return {
    sales,
    profit,
    orders: ids.size,
    margin: sales ? (100 * profit) / sales : 0,
    aov: ids.size ? sales / ids.size : 0,
    discount: rows.length ? (100 * discount) / rows.length : 0,
  }
}
export function groupBy(
  rows: Row[],
  key: Dimension | ((r: Row) => string),
): Group[] {
  const buckets = new Map<string, Row[]>()
  for (const row of rows) {
    const name = typeof key === 'function' ? key(row) : row[key]
    const bucket = buckets.get(name)
    if (bucket) bucket.push(row)
    else buckets.set(name, [row])
  }
  return [...buckets]
    .map(([name, items]) => ({ name, ...metrics(items), count: items.length }))
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name))
}
export const rank = (items: Group[], metric: 'sales' | 'profit' | 'margin') =>
  [...items].sort(
    (a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name),
  )
export function trend(rows: Row[], period: Period) {
  return groupBy(rows, (r) =>
    period === 'Year'
      ? r.date.slice(0, 4)
      : period === 'Quarter'
        ? r.date.slice(0, 4) + '-Q' + Math.ceil(Number(r.date.slice(5, 7)) / 3)
        : r.date.slice(0, 7),
  ).sort((a, b) => a.name.localeCompare(b.name))
}
export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2)
  return !sorted.length
    ? 0
    : sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
}
export function flagGroups(groups: Group[]) {
  const sales = median(groups.map((g) => g.sales)),
    margin = median(groups.map((g) => g.margin))
  return {
    sales,
    margin,
    flagged: groups.filter((g) => g.sales > sales && g.margin < margin),
  }
}
export function correlation(rows: Row[]) {
  if (rows.length < 2) return null
  const avg = (key: 'discount' | 'profit') =>
    rows.reduce((sum, row) => sum + row[key], 0) / rows.length
  const x = avg('discount'),
    y = avg('profit')
  if (
    rows.every((r) => r.discount === rows[0].discount) ||
    rows.every((r) => r.profit === rows[0].profit)
  )
    return null
  let xy = 0,
    xx = 0,
    yy = 0
  for (const r of rows) {
    const a = r.discount - x,
      b = r.profit - y
    xy += a * b
    xx += a * a
    yy += b * b
  }
  return xx && yy ? Math.min(1, Math.max(-1, xy / Math.sqrt(xx * yy))) : null
}
export const bandNames = ['0–5%', '>5–10%', '>10–15%', '>15–20%', '>20%']
export function discountBands(rows: Row[]) {
  const groups = groupBy(
    rows,
    (r) =>
      bandNames[
        r.discount <= 0.05
          ? 0
          : r.discount <= 0.1
            ? 1
            : r.discount <= 0.15
              ? 2
              : r.discount <= 0.2
                ? 3
                : 4
      ],
  )
  return bandNames.map(
    (name) =>
      groups.find((g) => g.name === name) ?? {
        name,
        sales: 0,
        profit: 0,
        margin: 0,
        count: 0,
        orders: 0,
      },
  )
}
export function analyze(rows: Row[]) {
  return {
    kpi: metrics(rows),
    category: groupBy(rows, 'category'),
    subcategory: groupBy(rows, 'subcategory'),
    region: groupBy(rows, 'region'),
    city: groupBy(rows, 'city'),
    state: groupBy(rows, 'state'),
    months: trend(rows, 'Month'),
    bands: discountBands(rows),
    r: correlation(rows),
  }
}
export type Analysis = ReturnType<typeof analyze>
