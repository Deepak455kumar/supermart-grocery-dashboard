import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  analyze,
  bandNames,
  changeFilter,
  correlation,
  discountBands,
  filterRows,
  flagGroups,
  groupBy,
  initialFilters,
  median,
  metrics,
  optionsFor,
  pct,
  trend,
  type Row,
} from '../analytics'
import { growth } from '../Comparison'
import { insights } from '../insights'
import controls from './controls.json'
const rows: Row[] = JSON.parse(
  readFileSync(resolve('public/data/sales.json'), 'utf8'),
)
const fixture = (
  id: string,
  sales: number,
  profit: number,
  discount: number,
): Row => ({ ...rows[0], id, sales, profit, discount })
function reconcile(selected: Row[], reference: typeof controls.overall) {
  const k = metrics(selected)
  expect(selected.length).toBe(reference.rows)
  for (const key of ['sales', 'profit', 'orders', 'aov'] as const)
    expect(k[key]).toBeCloseTo(reference[key], 7)
  expect(k.margin).toBeCloseTo(100 * reference.margin, 9)
  expect(k.discount).toBeCloseTo(100 * reference.discount, 9)
}
describe('independent Pandas controls', () => {
  it('reconciles the six headline KPIs across every row', () =>
    reconcile(rows, controls.overall))
  it.each(controls.slices)(
    'reconciles the slice $filters',
    ({ filters, expected }) =>
      reconcile(
        filterRows(rows, { ...filters, start: filters.from, end: filters.to }),
        expected,
      ),
  )
})
describe('aggregation and filters', () => {
  const two = [fixture('same', 20, 10, 0.12), fixture('same', 80, 0, 0.22)]
  it('counts distinct orders and includes every line in totals and AOV', () =>
    expect(metrics(two)).toEqual({
      sales: 100,
      profit: 10,
      margin: 10,
      orders: 1,
      aov: 100,
      discount: 17,
    }))
  it('safe with empty records and zero sales', () => {
    expect(metrics([])).toEqual({
      sales: 0,
      profit: 0,
      margin: 0,
      orders: 0,
      aov: 0,
      discount: 0,
    })
    expect(metrics([fixture('x', 0, -10, 0.25)]).margin).toBe(0)
  })
  it('formats decimal discounts after percentage conversion', () =>
    expect(pct(metrics([two[0]]).discount)).toBe('12%'))
  it('handles threshold boundaries and weights band margins by sales', () => {
    const bands = discountBands([
      fixture('a', 20, 10, 0.05),
      fixture('b', 10, 1, 0.1),
      fixture('c', 10, 2, 0.15),
      fixture('d', 10, 2, 0.2),
      fixture('e', 100, 0, 0.21),
      fixture('f', 20, 12, 0.23),
    ])
    expect(bands.map((g) => g.name)).toEqual(bandNames)
    expect(bands.map((g) => g.count)).toEqual([1, 1, 1, 1, 2])
    expect(bands[4].margin).toBe(10)
  })
  it('returns Pearson r only for varying series', () => {
    expect(correlation([])).toBeNull()
    expect(correlation([two[0]])).toBeNull()
    expect(correlation(Array(50).fill(two[0]))).toBeNull()
    expect(correlation(two)).toBeCloseTo(-1)
  })
  it('maps monthly and quarterly dates and includes both ends of a date range', () => {
    const few = [
      { ...two[0], date: '2017-03-31' },
      { ...two[1], date: '2017-04-01' },
    ]
    expect(trend(few, 'Quarter').map((g) => g.name)).toEqual([
      '2017-Q1',
      '2017-Q2',
    ])
    expect(trend(few, 'Year')[0].orders).toBe(1)
    expect(
      filterRows(few, { start: '2017-03-31', end: '2017-04-01' }),
    ).toHaveLength(2)
  })
  it('restricts descendants to observed combinations and clears stale values', () => {
    expect(
      optionsFor(rows, 'city', { ...initialFilters, region: 'North' }),
    ).toEqual(['Vellore'])
    expect(
      changeFilter(
        { ...initialFilters, city: 'Ooty', state: 'Tamil Nadu' },
        'region',
        'North',
      ),
    ).toEqual({ ...initialFilters, region: 'North' })
  })
  it('computes median flags with strict comparisons and no flagged ties', () => {
    expect(median([5, 1, 2, 4])).toBe(3)
    expect(flagGroups(groupBy(two, 'city')).flagged).toEqual([])
    const data = analyze(rows),
      flags = flagGroups(data.city)
    expect(flags.flagged.length).toBeGreaterThan(0)
    expect(
      flags.flagged.every(
        (g) => g.sales > flags.sales && g.margin < flags.margin,
      ),
    ).toBe(true)
  })
  it('recalculates insights within a selection and handles no records', () => {
    expect(insights(analyze([]))).toEqual([])
    expect(
      insights(analyze(filterRows(rows, { region: 'North' }))).some((x) =>
        x.title.includes('North leads'),
      ),
    ).toBe(true)
  })
  it('handles zero and negative YoY baselines', () => {
    expect(growth(5, 0)).toBeNull()
    expect(growth(-50, -100)).toBe(50)
  })
})
