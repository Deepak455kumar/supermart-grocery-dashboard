import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { ChartNoAxesColumn, Download, Table2 } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import {
  compactMoney,
  median,
  money,
  number,
  pct,
  type Group,
  type Period,
  type Row,
} from './analytics'
import './charts.css'

const colors = [
  '#3166ec',
  '#8060d9',
  '#18a69a',
  '#f1a547',
  '#e67b98',
  '#4c9ed2',
  '#a8ae53',
]
const series = {
  sales: 'Sales',
  profit: 'Profit',
  margin: 'Profit margin',
  orders: 'Orders',
  count: 'Records',
}
type Metric = keyof typeof series
type TableSpec = { columns: string[]; rows: () => string[][] }
const axis = { fill: 'var(--muted)', fontSize: 12 }
const grid = {
  stroke: 'var(--grid, var(--line))',
  strokeDasharray: '3 5',
  vertical: false,
}
const metricColor = (metric: Metric) =>
  metric === 'profit' || metric === 'margin' ? '#8060d9' : '#3166ec'
const valueLabel = (metric: Metric, value: number, compact = false) => {
  if (metric === 'sales' || metric === 'profit')
    return compact ? compactMoney(value) : money(value)
  return metric === 'margin' ? pct(value) : number(value)
}
const nameOfPeriod = (name: string) => {
  if (name.includes('-Q')) {
    const [year, quarter] = name.split('-')
    return `${quarter} ${year}`
  }
  if (/^\d{4}-\d{2}$/.test(name))
    return monthFormat.format(new Date(`${name}-01T00:00:00Z`))
  return name
}
const monthFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function ChartTable({ spec }: { spec: TableSpec }) {
  const rows = useMemo(() => spec.rows(), [spec])
  const [requestedPage, setPage] = useState(0)
  const pages = Math.ceil(rows.length / 10)
  const page = Math.max(0, Math.min(requestedPage, pages - 1))
  return (
    <div className="sm-chart-table">
      <div className="sm-chart-scroll">
        <table>
          <thead>
            <tr>
              {spec.columns.map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 10, page * 10 + 10).map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="sm-chart-pages">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            disabled={page === pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function Frame({
  title,
  description,
  tools,
  table,
  className = '',
  empty,
  children,
}: {
  title: string
  description?: string
  tools?: ReactNode
  table: TableSpec
  className?: string
  empty?: boolean
  children: ReactNode
}) {
  const [showTable, setTable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exportError, setExportError] = useState(false)
  const card = useRef<HTMLElement>(null)
  async function downloadChart() {
    if (!card.current || saving) return
    setSaving(true)
    setExportError(false)
    try {
      const { toPng } = await import('html-to-image')
      const url = await toPng(card.current, {
        backgroundColor: getComputedStyle(card.current).backgroundColor,
        pixelRatio: 2,
        filter: (el) =>
          !el.classList?.contains('sm-chart-tools') &&
          !el.classList?.contains('recharts-tooltip-wrapper'),
      })
      const link = document.createElement('a')
      link.download = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png'
      link.href = url
      link.click()
    } catch {
      setExportError(true)
    } finally {
      setSaving(false)
    }
  }
  const titleId = useId()
  return (
    <section
      ref={card}
      className={'sm-chart ' + className}
      aria-labelledby={titleId}
    >
      <header className="sm-chart-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <div className="sm-chart-tools">
          {tools}
          {!showTable && (
            <button
              type="button"
              className="sm-chart-icon"
              disabled={saving}
              onClick={downloadChart}
              aria-label={'Download PNG of ' + title}
              title="Download chart as PNG"
            >
              <Download size={15} />
            </button>
          )}
          <button
            type="button"
            className="sm-chart-icon"
            aria-label={`${showTable ? 'Show chart' : 'Show data table'} for ${title}`}
            title={showTable ? 'Show chart' : 'Show data table'}
            aria-pressed={showTable}
            onClick={() => setTable(!showTable)}
          >
            {showTable ? <ChartNoAxesColumn size={16} /> : <Table2 size={16} />}
          </button>
        </div>
      </header>
      {exportError && (
        <p role="alert">Chart download failed. Try again or use Print view.</p>
      )}
      {empty ? (
        <div className="sm-chart-empty">No records match this selection.</div>
      ) : showTable ? (
        <ChartTable spec={table} />
      ) : (
        children
      )}
    </section>
  )
}

function Key({ label, color }: { label: string; color: string }) {
  return (
    <span className="sm-chart-key">
      <i style={{ background: color }} />
      {label}
    </span>
  )
}
function Tip({
  title,
  lines,
}: {
  title: string
  lines: [string, string, string?][]
}) {
  return (
    <div className="sm-chart-tip">
      <strong>{title}</strong>
      {lines.map(([label, value, color]) => (
        <div key={label}>
          <span>
            {color && <i style={{ background: color }} />} {label}
          </span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}

export function Trend({
  data,
  period,
  onPeriod,
}: {
  data: Group[]
  period: Period
  onPeriod: (period: Period) => void
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const table = {
    columns: ['Period', 'Sales', 'Profit'],
    rows: () =>
      data.map((d) => [nameOfPeriod(d.name), money(d.sales), money(d.profit)]),
  }
  return (
    <Frame
      className="sm-trend"
      title="Sales and profit trend"
      description="Revenue and profit over time"
      table={table}
      empty={!data.length}
      tools={
        <select
          className="sm-period"
          aria-label="Trend period"
          value={period}
          onChange={(e) => onPeriod(e.target.value as Period)}
        >
          {(['Month', 'Quarter', 'Year'] as Period[]).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      }
    >
      <div className="sm-trend-legend">
        <Key label="Sales" color={colors[0]} />
        <Key label="Profit" color={colors[1]} />
      </div>
      <div className="sm-trend-plot">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 12, left: 4, bottom: 1 }}
            accessibilityLayer
          >
            <defs>
              {['sales', 'profit'].map((key, i) => (
                <linearGradient
                  key={key}
                  id={uid + key}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={colors[i]}
                    stopOpacity={i === 0 ? 0.23 : 0.13}
                  />
                  <stop
                    offset="100%"
                    stopColor={colors[i]}
                    stopOpacity={0.015}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...grid} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={axis}
              tickMargin={12}
              minTickGap={25}
              tickFormatter={nameOfPeriod}
              interval="preserveStartEnd"
              height={36}
            />
            <YAxis
              tick={axis}
              tickFormatter={compactMoney}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={62}
              tickCount={5}
            />
            <Tooltip
              cursor={{ stroke: 'var(--muted)', strokeDasharray: '4 4' }}
              content={({ active, payload }) => {
                const d: Group | undefined = payload?.[0]?.payload
                return active && d ? (
                  <Tip
                    title={nameOfPeriod(d.name)}
                    lines={[
                      ['Sales', money(d.sales), colors[0]],
                      ['Profit', money(d.profit), colors[1]],
                    ]}
                  />
                ) : null
              }}
            />
            {(['sales', 'profit'] as const).map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={series[key]}
                stroke={colors[i]}
                strokeWidth={2.6}
                fill={`url(#${uid + key})`}
                dot={data.length === 1 ? { r: 4 } : false}
                activeDot={{ r: 4.5, stroke: 'var(--panel)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Frame>
  )
}

export function Donut({ data }: { data: Group[] }) {
  const total = data.reduce((s, d) => s + d.sales, 0)
  const share = (value: number) => (total ? pct((value / total) * 100) : '—')
  const table = {
    columns: ['Category', 'Sales', 'Share'],
    rows: () => data.map((d) => [d.name, money(d.sales), share(d.sales)]),
  }
  return (
    <Frame
      className="sm-donut"
      title="Sales by category"
      description="Share of total sales"
      table={table}
      empty={!data.length}
    >
      <div className="sm-donut-body">
        <div className="sm-ring">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="sales"
                nameKey="name"
                startAngle={90}
                endAngle={-270}
                innerRadius="69%"
                outerRadius="94%"
                stroke="var(--panel)"
                strokeWidth={2.5}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload?.payload as Group | undefined
                  return active && d ? (
                    <Tip
                      title={d.name}
                      lines={[
                        ['Sales', money(d.sales)],
                        ['Share', share(d.sales)],
                      ]}
                    />
                  ) : null
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="sm-ring-center">
            <strong>{data.length}</strong>
            <span>{data.length === 1 ? 'category' : 'categories'}</span>
          </div>
        </div>
        <ul className="sm-donut-legend">
          {data.map((d, i) => (
            <li key={d.name}>
              <span>
                <i style={{ background: colors[i % colors.length] }} />
                {d.name}
              </span>
              <b>{share(d.sales)}</b>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  )
}

export function Bars({
  title,
  data,
  metric,
  secondary,
  description,
}: {
  title: string
  data: Group[]
  metric: Metric
  secondary?: Metric
  description?: string
}) {
  const metrics = secondary ? [metric, secondary] : [metric]
  const height = Math.max(175, data.length * (secondary ? 39 : 31) + 46)
  const table = {
    columns: ['Group', ...metrics.map((m) => series[m])],
    rows: () =>
      data.map((d) => [d.name, ...metrics.map((m) => valueLabel(m, d[m]))]),
  }
  return (
    <Frame
      title={title}
      description={description}
      table={table}
      empty={!data.length}
    >
      {secondary && (
        <div className="sm-trend-legend">
          {metrics.map((m) => (
            <Key key={m} label={series[m]} color={metricColor(m)} />
          ))}
        </div>
      )}
      <div className="sm-bar-plot" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 22, bottom: 1, left: 1 }}
            barCategoryGap="33%"
            accessibilityLayer
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--grid, var(--line))"
              strokeDasharray="3 5"
            />
            <XAxis
              type="number"
              tick={axis}
              axisLine={false}
              tickLine={false}
              minTickGap={18}
              tickMargin={8}
              tickCount={4}
              tickFormatter={(v) => valueLabel(metric, v, true)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={116}
              axisLine={false}
              tickLine={false}
              tick={{ ...axis, fontSize: 12 }}
              tickMargin={6}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: 'var(--grid, var(--line))', fillOpacity: 0.45 }}
              content={({ active, payload }) => {
                const d: Group | undefined = payload?.[0]?.payload
                return active && d ? (
                  <Tip
                    title={d.name}
                    lines={metrics.map((m) => [
                      series[m],
                      valueLabel(m, d[m]),
                      metricColor(m),
                    ])}
                  />
                ) : null
              }}
            />
            {metrics.map((m) => (
              <Bar
                key={m}
                dataKey={m}
                name={series[m]}
                fill={metricColor(m)}
                radius={[0, 4, 4, 0]}
                maxBarSize={17}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Frame>
  )
}

export function Bubbles({
  title,
  data,
  description,
  mode = 'margin',
}: {
  title: string
  data: Group[]
  description?: string
  mode?: 'margin' | 'profit'
}) {
  const salesMid = median(data.map((d) => d.sales))
  const marginMid = median(data.map((d) => d.margin))
  const table = {
    columns: ['Group', 'Sales', 'Profit', 'Margin', 'Orders'],
    rows: () =>
      data.map((d) => [
        d.name,
        money(d.sales),
        money(d.profit),
        pct(d.margin),
        number(d.orders),
      ]),
  }
  return (
    <Frame
      title={title}
      description={description ?? 'Bubble area represents distinct orders.'}
      table={table}
      empty={!data.length}
    >
      <div className="sm-axis-title">
        {series[mode]} {mode === 'margin' ? '(%)' : '(₹)'}
      </div>
      <div className="sm-scatter-plot">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 24, bottom: 2, left: 2 }}>
            <CartesianGrid
              stroke="var(--grid, var(--line))"
              strokeDasharray="3 5"
            />
            <XAxis
              type="number"
              dataKey="sales"
              name="Sales"
              tick={axis}
              tickCount={5}
              minTickGap={22}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tickFormatter={compactMoney}
            />
            <YAxis
              type="number"
              dataKey={mode}
              name={series[mode]}
              tick={axis}
              width={62}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(v) => valueLabel(mode, v, true)}
            />
            <ZAxis
              type="number"
              dataKey="orders"
              range={[18, 230]}
              name="Orders"
            />
            {mode === 'margin' && (
              <ReferenceLine
                x={salesMid}
                stroke="var(--muted)"
                strokeDasharray="4 4"
              />
            )}
            {mode === 'margin' && (
              <ReferenceLine
                y={marginMid}
                stroke="var(--muted)"
                strokeDasharray="4 4"
              />
            )}
            <Tooltip
              cursor={{ strokeDasharray: '3 5' }}
              content={({ active, payload }) => {
                const d: Group | undefined = payload?.[0]?.payload
                return active && d ? (
                  <Tip
                    title={d.name}
                    lines={[
                      ['Sales', money(d.sales)],
                      ['Profit', money(d.profit)],
                      ['Margin', pct(d.margin)],
                      ['Orders', number(d.orders)],
                    ]}
                  />
                ) : null
              }}
            />
            <Scatter data={data} fill={colors[0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={
                    mode === 'margin' &&
                    d.sales > salesMid &&
                    d.margin < marginMid
                      ? '#e59a34'
                      : colors[0]
                  }
                  fillOpacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="sm-axis-title sm-axis-bottom">Sales (₹)</div>
      {mode === 'margin' && (
        <p className="sm-chart-foot">
          Dashed lines mark median sales and margin. Amber marks groups above
          median sales and below median margin.
        </p>
      )}
    </Frame>
  )
}

// Draw every order on one canvas. The table and pointer inspection use the same filtered rows.
function OrderPlot({ rows }: { rows: Row[] }) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const positions = useRef<{ x: number; y: number; row: Row }[]>([])
  const [active, setActive] = useState<{
    x: number
    y: number
    row: Row
  } | null>(null)
  useEffect(() => {
    const node = canvas.current
    const parent = host.current
    if (!node || !parent) return
    setActive(null)
    const draw = () => {
      const width = parent.clientWidth,
        height = parent.clientHeight
      if (!width || !height) return
      const scale = window.devicePixelRatio || 1
      node.width = Math.round(width * scale)
      node.height = Math.round(height * scale)
      const ctx = node.getContext('2d')
      if (!ctx) return
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      const css = getComputedStyle(parent)
      const left = 64,
        top = 13,
        right = width - 21,
        bottom = height - 33
      let low = 0,
        high = 0,
        maxDiscount = 0
      for (const r of rows) {
        low = Math.min(low, r.profit)
        high = Math.max(high, r.profit)
        maxDiscount = Math.max(maxDiscount, r.discount)
      }
      const step = 10 ** Math.floor(Math.log10((high - low || 1) / 4))
      const unit = Math.ceil((high - low || 1) / 4 / step) * step
      const minProfit = Math.floor(low / unit) * unit,
        maxProfit = Math.max(minProfit + unit, Math.ceil(high / unit) * unit)
      const discountMax = Math.max(0.1, Math.ceil(maxDiscount * 10) / 10)
      const y = (p: number) =>
        bottom - ((p - minProfit) / (maxProfit - minProfit)) * (bottom - top)
      const x = (d: number) => left + (d / discountMax) * (right - left)
      ctx.font = '12px ' + css.fontFamily
      ctx.fillStyle = css.getPropertyValue('--muted').trim() || '#63718a'
      ctx.strokeStyle = css.getPropertyValue('--line').trim() || '#d5dce5'
      ctx.setLineDash([3, 5])
      ctx.textAlign = 'right'
      for (let p = minProfit; p <= maxProfit + unit * 0.001; p += unit) {
        ctx.fillText(compactMoney(p), left - 8, y(p) + 4)
        ctx.beginPath()
        ctx.moveTo(left, y(p))
        ctx.lineTo(right, y(p))
        ctx.stroke()
      }
      ctx.textAlign = 'center'
      for (let i = 0; i <= 4; i++) {
        const d = (i * discountMax) / 4
        ctx.fillText(Number((d * 100).toFixed(1)) + '%', x(d), bottom + 21)
      }
      ctx.fillStyle =
        rows.length > 400 ? 'rgba(55,103,227,.23)' : 'rgba(55,103,227,.75)'
      positions.current = rows.map((row) => {
        const point = { x: x(row.discount), y: y(row.profit), row }
        ctx.beginPath()
        ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2)
        ctx.fill()
        return point
      })
    }
    draw()
    const resize = new ResizeObserver(draw)
    resize.observe(parent)
    const theme = new MutationObserver(draw)
    for (let el: HTMLElement | null = parent; el; el = el.parentElement)
      theme.observe(el, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      })
    return () => {
      resize.disconnect()
      theme.disconnect()
    }
  }, [rows])
  const inspect = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top
    let nearest: typeof active = null,
      distance = 100
    for (const point of positions.current) {
      const d = (point.x - x) ** 2 + (point.y - y) ** 2
      if (d < distance) {
        distance = d
        nearest = point
      }
    }
    setActive(nearest)
  }
  return (
    <>
      <div className="sm-axis-title">Profit (₹)</div>
      <div className="sm-order-plot" ref={host}>
        <canvas
          ref={canvas}
          onPointerMove={inspect}
          onPointerLeave={() => setActive(null)}
          role="img"
          aria-label={`Profit against discount for ${number(rows.length)} records. Use the data table for exact values.`}
        />
        {active && (
          <div
            className="sm-canvas-tip"
            style={{
              left: Math.max(
                4,
                Math.min(
                  active.x + 12,
                  (host.current?.clientWidth ?? 240) - 195,
                ),
              ),
              top: Math.max(4, active.y - 88),
            }}
          >
            <Tip
              title={active.row.id}
              lines={[
                ['Discount', pct(active.row.discount * 100)],
                ['Profit', money(active.row.profit)],
              ]}
            />
          </div>
        )}
      </div>
      <div className="sm-axis-title sm-axis-bottom">Discount (%)</div>
    </>
  )
}
export function DiscountScatter({ rows }: { rows: Row[] }) {
  const table = {
    columns: ['Order ID', 'Discount', 'Profit'],
    rows: () => rows.map((r) => [r.id, pct(r.discount * 100), money(r.profit)]),
  }
  return (
    <Frame
      title="Discount vs profit"
      description="Each point represents one sales record."
      empty={!rows.length}
      table={table}
    >
      <OrderPlot rows={rows} />
    </Frame>
  )
}
