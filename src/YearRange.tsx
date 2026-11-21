import * as Slider from '@radix-ui/react-slider'
import { ChevronDown } from 'lucide-react'

type Props = {
  periods: string[]
  firstMonth: string
  lastMonth: string
  onMonths: (first: string, last: string) => void
  years: string[]
  from: string
  through: string
  onChange: (from: string, through: string) => void
}

export default function YearRange({ years, from, through, onChange, periods, firstMonth, lastMonth, onMonths }: Props) {
  return (
    <div className="year-picker">
      <div className="year-fields">
        {(['From year', 'Through year'] as const).map((label) => {
          const first = label === 'From year'
          return (
            <label key={label} className="field">
              {label}
              <span className="select-wrap">
                <select
                  aria-label={label}
                  value={first ? from : through}
                  onChange={(e) => {
                    const year = e.target.value
                    if (first) onChange(year, year > through ? year : through)
                    else onChange(year < from ? year : from, year)
                  }}
                >
                  {years.map((year) => (
                    <option key={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </span>
            </label>
          )
        })}
      </div>
      {years.length > 1 && (
        <div className="year-scale">
          <Slider.Root
            className="year-slider"
            min={0}
            max={years.length - 1}
            step={1}
            value={[years.indexOf(from), years.indexOf(through)]}
            onValueChange={([first, last]) =>
              onChange(years[first], years[last])
            }
          >
            <Slider.Track className="year-track">
              <Slider.Range className="year-fill" />
            </Slider.Track>
            <Slider.Thumb
              className="year-thumb"
              aria-label="Start year"
              aria-valuetext={from}
            />
            <Slider.Thumb
              className="year-thumb"
              aria-label="End year"
              aria-valuetext={through}
            />
          </Slider.Root>
          <div className="year-ticks" aria-hidden="true">
            {years.map(
              (year, i) =>
                (years.length <= 6 || i === 0 || i === years.length - 1) && (
                  <span
                    key={year}
                    style={{ left: (100 * i) / (years.length - 1) + '%' }}
                  >
                    {year}
                  </span>
                ),
            )}
          </div>
        </div>
      )}
      <div className="year-fields">
        {(['From month', 'Through month'] as const).map(label => {
          const first = label === 'From month'
          const selected = first ? firstMonth : lastMonth
          return <label className="field" key={label}>{label}
            <span className="select-wrap">
              <select aria-label={label} value={selected} onChange={e => {
                const period = e.target.value
                if (first) onMonths(period, period > lastMonth ? period : lastMonth)
                else onMonths(period < firstMonth ? period : firstMonth, period)
              }}>
                {periods.filter(p => p.startsWith(first ? from : through)).map(p =>
                  <option key={p} value={p}>{new Date(p+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'})}</option>
                )}
              </select><ChevronDown size={14} />
            </span>
          </label>
        })}
      </div>
    </div>
  )
}
