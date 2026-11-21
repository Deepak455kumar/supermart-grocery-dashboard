import { useMemo, useState } from 'react'
import {
  Activity,
  BadgePercent,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  Database,
  Lightbulb,
  MapPin,
  Percent,
  ReceiptText,
  ShoppingBasket,
  ShoppingCart,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bars, Bubbles, DiscountScatter, Donut, Trend } from './Charts'
import {
  dateLabel,
  flagGroups,
  money,
  number,
  pct,
  rank,
  trend,
  type Analysis,
  type Group,
  type Period,
  type Row,
} from './analytics'
import { insights } from './insights'
export type ViewProps = { a: Analysis; rows: Row[] }
function Spark({
  data,
  field,
}: {
  data: Group[]
  field: 'sales' | 'profit' | 'margin'
}) {
  const values = data.slice(-18).map((d) => d[field])
  if (!values.length) return null
  const min = Math.min(...values),
    span = Math.max(...values) - min || 1
  const line = values
    .map(
      (v, i) =>
        ((i * 104) / Math.max(1, values.length - 1)).toFixed(1) +
        ',' +
        (30 - (26 * (v - min)) / span).toFixed(1),
    )
    .join(' ')
  return (
    <svg className="spark" viewBox="0 0 105 34" aria-hidden="true">
      <polygon
        points={'0,34 ' + line + ' 104,34'}
        fill="currentColor"
        opacity=".10"
      />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
function Kpis({ a }: { a: Analysis }) {
  const major = [
    {
      label: 'Total sales',
      value: money(a.kpi.sales),
      key: 'sales',
      icon: ShoppingBasket,
      caption: 'Recorded sales',
    },
    {
      label: 'Total profit',
      value: money(a.kpi.profit),
      key: 'profit',
      icon: Banknote,
      caption: 'Reported profit',
    },
    {
      label: 'Profit margin',
      value: pct(a.kpi.margin),
      key: 'margin',
      icon: Activity,
      caption: 'Profit ÷ sales',
    },
  ] as const
  const minor = [
    { label: 'Total orders', value: number(a.kpi.orders), icon: ReceiptText },
    {
      label: 'Average order value',
      value: money(a.kpi.aov),
      icon: ShoppingCart,
    },
    {
      label: 'Average discount',
      value: pct(a.kpi.discount),
      icon: BadgePercent,
    },
  ]
  return (
    <>
      <div className="major-grid">
        {major.map((m) => (
          <article key={m.key} className={'kpi ' + m.key}>
            <div className="kpi-line">
              <span className="metric-icon">
                <m.icon size={17} />
              </span>
              {m.label}
            </div>
            <strong>{m.value}</strong>
            <div className="kpi-foot">
              <span>{m.caption}</span>
              <Spark data={a.months} field={m.key} />
            </div>
          </article>
        ))}
      </div>
      <div className="minor-grid">
        {minor.map((m) => (
          <div key={m.label}>
            <span className="minor-icon">
              <m.icon size={19} />
            </span>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
function TrendView({ rows, a }: ViewProps) {
  const [period, setPeriod] = useState<Period>('Month')
  const data = useMemo(
    () => (period === 'Month' ? a.months : trend(rows, period)),
    [a, rows, period],
  )
  return <Trend data={data} period={period} onPeriod={setPeriod} />
}
function Findings({ text }: { text: string }) {
  return (
    <div className="finding">
      <Lightbulb size={19} />
      <p>{text}</p>
    </div>
  )
}
export function Overview(props: ViewProps) {
  const { a } = props
  return (
    <div className="page-stack">
      <Kpis a={a} />
      <div className="featured-grid">
        <TrendView {...props} />
        <Donut data={a.category} />
      </div>
      <div className="section-head">
        <div>
          <h2>Performance breakdown</h2>
          <p>Compare contributions across the selected records.</p>
        </div>
        <Link to="/sales">Sales analytics</Link>
      </div>
      <div className="chart-grid">
        <Bars title="Sales by region" data={a.region} metric="sales" />
        <Bars
          title="Profit by category"
          data={rank(a.category, 'profit')}
          metric="profit"
        />
      </div>
    </div>
  )
}
export function Sales(props: ViewProps) {
  const { a } = props,
    leader = a.category[0],
    strongest = a.region[0],
    first = a.months[0],
    last = a.months.at(-1)!
  return (
    <div className="page-stack">
      <Findings
        text={
          leader.name +
          ' generates ' +
          pct((100 * leader.sales) / a.kpi.sales) +
          ' of sales. ' +
          strongest.name +
          ' leads regions at ' +
          money(strongest.sales) +
          '. The first and last observed months in this selection total ' +
          money(first.sales) +
          ' (' +
          first.name +
          ') and ' +
          money(last.sales) +
          ' (' +
          last.name +
          ').'
        }
      />
      <div className="featured-grid">
        <TrendView {...props} />
        <Donut data={a.category} />
      </div>
      <div className="chart-grid">
        <Bars title="Sales by category" data={a.category} metric="sales" />
        <Bars title="Regional sales" data={a.region} metric="sales" />
      </div>
      <div className="summary-strip">
        <span>
          Total sales <b>{money(a.kpi.sales)}</b>
        </span>
        <span>
          Total profit <b>{money(a.kpi.profit)}</b>
        </span>
      </div>
    </div>
  )
}
function Flags({ groups, noun }: { groups: Group[]; noun: string }) {
  const { sales, margin, flagged } = flagGroups(groups)
  return (
    <article className="surface">
      <h2>High-sales, low-margin {noun}</h2>
      <p className="description">
        Sales above the {money(sales)} median and profit margin below the{' '}
        {pct(margin)} median among visible {noun}.
      </p>
      {flagged.length ? (
        <div className="scroll-table">
          <table>
            <thead>
              <tr>
                <th>{noun === 'cities' ? 'City' : 'Subcategory'}</th>
                <th>Sales</th>
                <th>Profit</th>
                <th>Margin</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td>
                  <td>{money(g.sales)}</td>
                  <td>{money(g.profit)}</td>
                  <td>{pct(g.margin)}</td>
                  <td>{number(g.orders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No {noun} meet both conditions in this selection.</p>
      )}
    </article>
  )
}
export function Products({ a }: ViewProps) {
  return (
    <div className="page-stack">
      <Findings text="Subcategory is the finest product detail in this dataset. Each bubble represents a subcategory, with its area indicating the number of distinct orders." />
      <div className="chart-grid">
        <Bars
          title="Top 10 subcategories by sales"
          data={a.subcategory.slice(0, 10)}
          metric="sales"
        />
        <Bars
          title="Top 10 subcategories by profit"
          data={rank(a.subcategory, 'profit').slice(0, 10)}
          metric="profit"
        />
      </div>
      <Bubbles title="Subcategory sales and margin" data={a.subcategory} />
      <Flags groups={a.subcategory} noun="subcategories" />
      <div className="chart-grid">
        <Bars
          title="Category sales and profit"
          data={a.category}
          metric="sales"
          secondary="profit"
        />
        <Bubbles
          title="Subcategory sales and profit"
          data={a.subcategory}
          mode="profit"
        />
      </div>
      <Bars
        title="Subcategory profit margins"
        data={rank(a.subcategory, 'margin')}
        metric="margin"
      />
    </div>
  )
}
export function Profit({ rows, a }: ViewProps) {
  return (
    <div className="page-stack">
      <Findings
        text={
          (a.r === null
            ? 'Pearson correlation is undefined for this selection.'
            : 'Discount and profit have a Pearson correlation of ' +
              a.r.toFixed(6) +
              ' across ' +
              number(rows.length) +
              ' records.') +
          ' This measures linear association. Establishing causation would require a controlled comparison.'
        }
      />
      <div className="chart-grid">
        <Bars
          title="Profit by category"
          data={rank(a.category, 'profit')}
          metric="profit"
        />
        <Bars
          title="Profit by region"
          data={rank(a.region, 'profit')}
          metric="profit"
        />
      </div>
      <DiscountScatter rows={rows} />
      <div className="chart-grid">
        <Bars
          title="Discount distribution"
          description="Records in each discount band"
          data={a.bands}
          metric="count"
        />
        <Bars
          title="Profit margin by discount band"
          description="Total profit divided by sales in each populated band"
          data={a.bands.filter((b) => b.count)}
          metric="margin"
        />
      </div>
    </div>
  )
}
export function Geography({
  a,
  drill,
}: {
  a: Analysis
  drill: React.ReactNode
}) {
  return (
    <div className="page-stack">
      {drill}
      <Findings
        text={
          a.state.length +
          ' state' +
          (a.state.length === 1 ? '' : 's') +
          ' represented in this selection. Regions follow the source labels. A city can appear in multiple regions.'
        }
      />
      <div className="chart-grid">
        <Bars
          title="Top cities by sales"
          data={a.city.slice(0, 10)}
          metric="sales"
        />
        <Bars
          title="City profit ranking"
          data={rank(a.city, 'profit')}
          metric="profit"
        />
      </div>
      <Bubbles title="City sales and profit margin" data={a.city} />
      <Flags groups={a.city} noun="cities" />
      <div className="chart-grid">
        <Bars title="Top states by sales" data={a.state} metric="sales" />
        <Bars
          title="State profit ranking"
          data={rank(a.state, 'profit')}
          metric="profit"
        />
      </div>
      <Bars
        title="Regional performance comparison"
        data={a.region}
        metric="sales"
        secondary="profit"
      />
    </div>
  )
}
export function InsightsPage({ a }: ViewProps) {
  return (
    <div className="insight-grid">
      {insights(a).map((x) => (
        <article className="surface insight" key={x.topic}>
          <div className="topic">
            <Lightbulb size={16} />
            {x.topic}
          </div>
          <h2>{x.title}</h2>
          <strong>{x.value}</strong>
          <p>{x.interpretation}</p>
          <footer>
            <b>Recommendation</b> {x.action}
          </footer>
        </article>
      ))}
    </div>
  )
}
export function About({ all }: { all: Row[] }) {
  const dates = all.map((r) => r.date).sort()
  return (
    <div className="page-stack">
      <article className="surface">
        <div className="topic">
          <Database size={16} />
          Source dataset
        </div>
        <h2>Supermart Grocery Sales</h2>
        <p>
          The Sapphire IQ project explores sales, category performance,
          discounts and geography using the supplied retail transactions. This
          page describes the full dataset.
        </p>
        <div className="about-stats">
          <span>
            <b>{number(all.length)}</b>records
          </span>
          <span>
            <b>{new Set(all.map((r) => r.city)).size}</b>cities
          </span>
          <span>
            <b>{new Set(all.map((r) => r.state)).size}</b>state
          </span>
        </div>
        <p>
          {dateLabel(dates[0])} – {dateLabel(dates.at(-1)!)}
        </p>
      </article>
      <div className="chart-grid">
        {[
          {
            icon: ChartNoAxesCombined,
            title: 'Sales performance',
            text: 'Sales and profit are summed across matching records. Average order value divides sales by distinct order IDs.',
          },
          {
            icon: Boxes,
            title: 'Product performance',
            text: 'Categories and subcategories are the available product groupings. Flagged groups have sales above the median and margins below the median of their selected peers.',
          },
          {
            icon: Percent,
            title: 'Profit and discount',
            text: 'Average discount is the arithmetic mean of recorded fractions. Group margin divides total profit by total sales. Pearson correlation measures record-level linear association.',
          },
          {
            icon: MapPin,
            title: 'Geographic performance',
            text: 'All records reference Tamil Nadu. Region, state and city selectors follow observed combinations. North contains a single record in the complete dataset.',
          },
        ].map((x) => (
          <article key={x.title} className="surface">
            <x.icon size={21} className="accent" />
            <h2>{x.title}</h2>
            <p>{x.text}</p>
          </article>
        ))}
      </div>
      <article className="surface">
        <h2>Dates, privacy and reproducibility</h2>
        <p>
          Slash dates use month/day/year. Hyphen dates follow the project’s
          day/month/year convention. Both hyphen fields are at most 12, so their
          order cannot be independently confirmed from those strings.
        </p>
        <p>
          Customer names are replaced by aliases before browser delivery. Static
          hosting makes the complete processed dataset downloadable. The project
          includes the Pandas preprocessing script, validation report, data
          dictionary and automated tests.
        </p>
      </article>
    </div>
  )
}
