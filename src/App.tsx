import YearRange from './YearRange'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  Boxes,
  CalendarDays,
  ChartColumnIncreasing,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  LayoutDashboard,
  Lightbulb,
  MapPinned,
  Menu,
  Moon,
  PanelLeft,
  Percent,
  Printer,
  RotateCcw,
  SearchX,
  SlidersHorizontal,
  Sun,
  Table2,
  X,
} from 'lucide-react'
import {
  analyze,
  changeFilter,
  dateLabel,
  dimensions,
  filterRows,
  initialFilters,
  labels,
  number,
  optionsFor,
  type Dimension,
  type Filters,
  type Row,
} from './analytics'
import {
  About,
  Geography,
  InsightsPage,
  Overview,
  Products,
  Profit,
  Sales,
} from './AnalyticsPages'
import Comparison from './Comparison'
const Explorer = lazy(() => import('./Explorer'))
const nav = [
  {
    url: '/',
    label: 'Executive overview',
    icon: LayoutDashboard,
    group: 'Workspace',
    subtitle: 'Sales, profit and order activity across your grocery business.',
  },
  {
    url: '/sales',
    label: 'Sales analytics',
    icon: ChartColumnIncreasing,
    group: 'Analytics',
    subtitle:
      'Track revenue over time and see which categories and regions contribute most.',
  },
  {
    url: '/products',
    label: 'Product performance',
    icon: Boxes,
    group: 'Analytics',
    subtitle:
      'Explore category and subcategory sales, profitability and order mix.',
  },
  {
    url: '/profit',
    label: 'Profit & discount',
    icon: Percent,
    group: 'Analytics',
    subtitle:
      'Examine discount patterns and how profitability varies across groups.',
  },
  {
    url: '/geography',
    label: 'Geographic analytics',
    icon: MapPinned,
    group: 'Analytics',
    subtitle:
      'Drill from region to state to city across the observed locations.',
  },
  {
    url: '/explorer',
    label: 'Data explorer',
    icon: Table2,
    group: 'Explore',
    subtitle: 'Search, sort and export the records behind the dashboard.',
  },
  {
    url: '/insights',
    label: 'Business insights',
    icon: Lightbulb,
    group: 'Explore',
    subtitle:
      'Findings and recommendations calculated from the current selection.',
  },
  {
    url: '/about',
    label: 'About project',
    icon: CircleHelp,
    group: 'Project',
    subtitle: 'Dataset coverage, calculation methods and project objectives.',
  },
]
function DimensionField({
  dim,
  all,
  f,
  update,
}: {
  dim: Dimension
  all: Row[]
  f: Filters
  update: (key: keyof Filters, v: string) => void
}) {
  const options = useMemo(() => optionsFor(all, dim, f), [all, dim, f])
  const plurals = {
    category: 'categories',
    subcategory: 'subcategories',
    region: 'regions',
    state: 'states',
    city: 'cities',
  }
  return (
    <label className="field">
      {labels[dim]}
      <span className="select-wrap">
        <select
          aria-label={labels[dim]}
          value={f[dim]}
          onChange={(e) => update(dim, e.target.value)}
        >
          <option value="">All {plurals[dim]}</option>
          {options.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <ChevronDown size={14} />
      </span>
    </label>
  )
}
function Sidebar({
  open,
  close,
  all,
}: {
  open: boolean
  close: () => void
  all: Row[]
}) {
  return (
    <>
      {open && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <div className="brand">
          <img src={import.meta.env.BASE_URL + "favicon.svg"} alt="" />
          <div>
            <b>
              Supermart<span>IQ</span>
            </b>
            <small>Retail analytics</small>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {['Workspace', 'Analytics', 'Explore', 'Project'].map((group) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {nav
                .filter((n) => n.group === group)
                .map((n) => (
                  <NavLink key={n.url} end to={n.url} onClick={close}>
                    <n.icon size={18} />
                    {n.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="source-info">
          <span className="db-icon">
            <Database size={18} />
          </span>
          <div>
            <b>Grocery sales dataset</b>
            <small>{number(all.length)} source records</small>
          </div>
        </div>
      </aside>
    </>
  )
}
function Empty({ reset }: { reset: () => void }) {
  return (
    <section className="empty">
      <SearchX size={32} />
      <h2>No matching records</h2>
      <p>Try another date range or clear the active filters.</p>
      <button className="btn primary" onClick={reset}>
        Clear all filters
      </button>
    </section>
  )
}
function Dashboard({ all }: { all: Row[] }) {
  const { pathname } = useLocation(),
    current = nav.find((n) => n.url === pathname) ?? nav[0]
  const [f, setF] = useState<Filters>(initialFilters),
    [menu, setMenu] = useState(false),
    [popover, setPopover] = useState<'date' | 'filter' | null>(null)
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('supermart-theme') === 'dark'
    } catch {
      return false
    }
  })
  const bar = useRef<HTMLDivElement>(null),
    dateBtn = useRef<HTMLButtonElement>(null),
    filterBtn = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    menuBtn = useRef<HTMLButtonElement>(null)
  const rows = useMemo(() => filterRows(all, f), [all, f]),
    a = useMemo(() => analyze(rows), [rows])
  const dates = useMemo(() => all.map((r) => r.date).sort(), [all]),
    years = useMemo(
      () => [...new Set(dates.map((d) => d.slice(0, 4)))],
      [dates],
    )
  const start = dates[0],
    end = dates.at(-1)!
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try {
      localStorage.setItem('supermart-theme', dark ? 'dark' : 'light')
    } catch {}
  }, [dark])
  useEffect(() => {
    window.scrollTo(0, 0)
    setPopover(null)
    setMenu(false)
    document.title = current.label + ' Â· Supermart IQ'
  }, [pathname, current])
  useEffect(() => {
    if (!popover && !menu) return
    if (popover)
      panel.current?.querySelector<HTMLElement>('select,input')?.focus()
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopover(null)
        setMenu(false)
        ;(menu
          ? menuBtn
          : popover === 'date'
            ? dateBtn
            : filterBtn
        ).current?.focus()
      }
    }
    const outside = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node))
        setPopover(null)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', outside)
    }
  }, [popover, menu])
  const update = (key: keyof Filters, value: string) =>
    setF((prev) => changeFilter(prev, key, value))
  const fromYear = (f.start || start).slice(0, 4)
  const throughYear = (f.end || end).slice(0, 4)
  const periods = useMemo(() => [...new Set(dates.map(date => date.slice(0, 7)))], [dates])
  const firstMonth = (f.start || start).slice(0, 7)
  const lastMonth = (f.end || end).slice(0, 7)
  const monthLabel = (period: string) => new Date(period + '-01T00:00:00Z').toLocaleDateString('en-GB', {month:'short',year:'numeric',timeZone:'UTC'})
  const rangeLabel = firstMonth.endsWith('-01') && lastMonth.endsWith('-12')
    ? (fromYear === throughYear ? fromYear : fromYear + 'â€“' + throughYear)
    : firstMonth === lastMonth ? monthLabel(firstMonth) : monthLabel(firstMonth) + ' â€“ ' + monthLabel(lastMonth)
  const hasYearFilter = Boolean(f.start || f.end)
  const activeDimensions = dimensions.filter((key) => f[key])
  const activeCount = activeDimensions.length + Number(hasYearFilter)
  function setMonths(from: string, through: string) {
    const fullRange = from === periods[0] && through === periods.at(-1)
    const [year, month] = through.split('-').map(Number)
    const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0,10)
    setF(prev => ({...prev,
      start: fullRange ? '' : from === periods[0] ? start : from+'-01',
      end: fullRange ? '' : through === periods.at(-1) ? end : monthEnd,
    }))
  }
  function setYearRange(from: string, through: string) {
    const starts = periods.filter(p => p.startsWith(from))
    const ends = periods.filter(p => p.startsWith(through))
    const first = starts.find(p => p >= from + firstMonth.slice(4)) ?? starts.at(-1)!
    const last = ends.filter(p => p <= through + lastMonth.slice(4)).at(-1) ?? ends[0]
    if (first > last && through !== throughYear) setMonths(last,last)
    else setMonths(first,last < first ? first : last)
  }
  const resetYears = () => setMonths(periods[0], periods.at(-1)!)
  const reset = () => setF({ ...initialFilters })
  const toggle = (p: 'date' | 'filter') =>
    setPopover((prev) => (prev === p ? null : p))
  const props = { rows, a }
  const geography = (
    <div className="surface drill">
      <div>
        <h2>Location drill-down</h2>
        <p className="description">Choose a region, state and city.</p>
      </div>
      {(['region', 'state', 'city'] as Dimension[]).map((dim) => (
        <DimensionField key={dim} dim={dim} all={all} f={f} update={update} />
      ))}
    </div>
  )
  return (
    <div className="app">
      <a href="#main" className="skip">
        Skip to dashboard
      </a>
      <Sidebar open={menu} close={() => setMenu(false)} all={all} />
      <div className="workspace">
        <header className="topbar">
          <button
            ref={menuBtn}
            className="icon-btn menu-toggle"
            onClick={() => setMenu(true)}
            aria-label="Open navigation"
            aria-expanded={menu}
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            <PanelLeft size={17} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>{current.label}</b>
          </div>
          <div className="toolbar" ref={bar}>
            <button
              ref={dateBtn}
              className={
                'btn date-btn ' + (popover === 'date' ? 'selected' : '')
              }
              aria-label={'Year range, ' + rangeLabel}
              aria-expanded={popover === 'date'}
              onClick={() => toggle('date')}
            >
              <CalendarDays size={16} />
              <span>{rangeLabel}</span>
              <ChevronDown size={13} />
            </button>
            <button
              ref={filterBtn}
              className={'btn ' + (popover === 'filter' ? 'selected' : '')}
              onClick={() => toggle('filter')}
              aria-expanded={popover === 'filter'}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeCount > 0 && <b className="count">{activeCount}</b>}
            </button>
            <button
              className="icon-btn"
              onClick={reset}
              title="Reset all filters"
              aria-label="Reset all filters"
            >
              <RotateCcw size={16} />
            </button>
            {popover && (
              <div
                className="popover"
                role="dialog"
                aria-label={
                  popover === 'filter' ? 'Global filters' : 'Year range'
                }
                ref={panel}
              >
                <div className="popover-title">
                  <h2>
                    {popover === 'filter' ? 'Global filters' : 'Year range'}
                  </h2>
                  <button
                    className="icon-btn"
                    aria-label="Close panel"
                    onClick={() => {
                      setPopover(null)
                      ;(popover === 'date'
                        ? dateBtn
                        : filterBtn
                      ).current?.focus()
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                {popover === 'filter' ? (
                  dimensions.map((dim) => (
                    <DimensionField
                      key={dim}
                      dim={dim}
                      all={all}
                      f={f}
                      update={update}
                    />
                  ))
                ) : (
                  <YearRange
                    years={years}
                    from={fromYear}
                    through={throughYear}
                    periods={periods}
                    firstMonth={firstMonth}
                    lastMonth={lastMonth}
                    onMonths={setMonths}
                    onChange={setYearRange}
                  />
                )}
                <div className="popover-foot">
                  <button onClick={popover === 'date' ? resetYears : reset}>
                    {popover === 'date' ? 'All years' : 'Clear all'}
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setPopover(null)
                      ;(popover === 'date'
                        ? dateBtn
                        : filterBtn
                      ).current?.focus()
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="top-divider" />
          <button
            className="icon-btn"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
            onClick={() => setDark((v) => !v)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="period-label">
                <span className="period-line" />
                {dateLabel(f.start || start)} â€“ {dateLabel(f.end || end)}
              </div>
              <h1>{current.label}</h1>
              <p>{current.subtitle}</p>
            </div>
            <button
              className="btn export"
              title="Print this view or save it as PDF"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print view
            </button>
          </div>
          {activeCount > 0 && (
            <div className="filter-chips">
              <span>{number(rows.length)} matching records</span>
              {hasYearFilter && (
                <button
                  onClick={resetYears}
                  aria-label="Remove year range filter"
                >
                  Year range Â· {rangeLabel}
                  <X size={12} />
                </button>
              )}
              {activeDimensions.map((key) => (
                <button
                  key={key}
                  onClick={() => update(key, '')}
                  aria-label={'Remove ' + key + ' filter'}
                >
                  {labels[key]} Â· {f[key]}
                  <X size={12} />
                </button>
              ))}
              <button className="clear-btn" onClick={reset}>
                Clear all
              </button>
            </div>
          )}
          <Suspense fallback={<div className="empty">Loading viewâ€¦</div>}>
            {!rows.length && pathname !== '/about' ? (
              <Empty reset={reset} />
            ) : (
              <Routes>
                <Route path="/" element={<Overview {...props} />} />
                <Route
                  path="/sales"
                  element={
                    <>
                      <Sales {...props} />
                      <Comparison all={all} f={f} />
                    </>
                  }
                />
                <Route path="/products" element={<Products {...props} />} />
                <Route path="/profit" element={<Profit {...props} />} />
                <Route
                  path="/geography"
                  element={<Geography a={a} drill={geography} />}
                />
                <Route path="/explorer" element={<Explorer rows={rows} />} />
                <Route path="/insights" element={<InsightsPage {...props} />} />
                <Route path="/about" element={<About all={all} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </Suspense>
          <footer className="page-footer">
            <span>Supermart IQ</span>
            <span>
              {number(rows.length)} of {number(all.length)} records Â· INR
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}
export default function App() {
  const [rows, setRows] = useState<Row[] | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch(import.meta.env.BASE_URL + 'data/sales.json', {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then((value) => {
        if (!Array.isArray(value) || !value.length) throw Error()
        setRows(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [retry])
  if (error)
    return (
      <div className="empty">
        <h1>Sales data could not be loaded</h1>
        <p>Check the connection and try again.</p>
        <button className="btn" onClick={() => setRetry((v) => v + 1)}>
          Retry
        </button>
      </div>
    )
  if (!rows)
    return (
      <div className="empty" role="status">
        <img src={import.meta.env.BASE_URL + "favicon.svg"} width="42" alt="" />
        <h2>Loading grocery salesâ€¦</h2>
      </div>
    )
  return <Dashboard all={rows} />
}

