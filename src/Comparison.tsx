import { useMemo } from 'react'
import {
  dateLabel,
  filterRows,
  metrics,
  money,
  pct,
  type Filters,
  type Row,
} from './analytics'
export const growth = (current: number, prior: number) =>
  prior === 0 ? null : (100 * (current - prior)) / Math.abs(prior)
function priorYear(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate()
  return new Date(Date.UTC(year - 1, month - 1, Math.min(lastDay, day)))
    .toISOString()
    .slice(0, 10)
}
export default function Comparison({ all, f }: { all: Row[]; f: Filters }) {
  const c = useMemo(() => {
    const dates = all.map((r) => r.date).sort(),
      min = dates[0],
      max = dates.at(-1)!
    const start = f.start || (!f.end ? max.slice(0, 4) + '-01-01' : min),
      end = f.end || max
    const previousStart = priorYear(start),
      previousEnd = priorYear(end)
    const current = filterRows(all, { ...f, start, end }),
      previous = filterRows(all, {
        ...f,
        start: previousStart,
        end: previousEnd,
      })
    const valid =
      start >= min &&
      end <= max &&
      previousStart >= min &&
      previousEnd <= max &&
      current.length > 0 &&
      previous.length > 0
    return {
      start,
      end,
      previousStart,
      previousEnd,
      current: metrics(current),
      previous: metrics(previous),
      valid,
    }
  }, [all, f])
  return (
    <article className="surface compare">
      <h2>Year-over-year comparison</h2>
      <p className="description">
        {!f.start && !f.end
          ? 'Latest year through the final observed date. '
          : ''}
        {dateLabel(c.start)} – {dateLabel(c.end)} vs.{' '}
        {dateLabel(c.previousStart)} – {dateLabel(c.previousEnd)}. Both periods
        use the same dimension filters.
      </p>
      <div className="scroll-table">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Current period</th>
              <th>Previous year</th>
              <th>Growth</th>
            </tr>
          </thead>
          <tbody>
            {(['sales', 'profit'] as const).map((k) => {
              const change = c.valid
                ? growth(c.current[k], c.previous[k])
                : null
              return (
                <tr key={k}>
                  <td>{k === 'sales' ? 'Sales' : 'Profit'}</td>
                  <td>{money(c.current[k])}</td>
                  <td>{c.valid ? money(c.previous[k]) : 'N/A'}</td>
                  <td>{change === null ? 'N/A' : pct(change)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!c.valid && (
        <p className="description">
          A comparison requires observations in both periods and full date
          coverage within the source range.
        </p>
      )}
    </article>
  )
}
