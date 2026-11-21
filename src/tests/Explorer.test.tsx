import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Explorer, { buildExplorerCsv } from '../Explorer'
import type { Row } from '../analytics'

const records: Row[] = Array.from({ length: 32 }, (_, i) => ({
  id: 'Order' + (i + 1),
  customer: 'Alias ' + (i + 1),
  category: 'Category A',
  subcategory: 'Group A',
  city: i === 31 ? 'City B' : 'City A',
  date: '2020-06-18',
  region: 'South',
  sales: 1000 + i,
  discount: 0.12,
  profit: 200,
  state: 'State A',
}))
const search = (query: string) =>
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } })
const button = (name: string) => screen.getByRole('button', { name })

describe('Data Explorer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders formatted values, paginates, and returns to page one for a new search or filtered dataset', () => {
    const { rerender } = render(<Explorer rows={records} />)
    expect(screen.getAllByRole('row')).toHaveLength(26)
    expect(screen.getByText('₹1,000')).toBeInTheDocument()
    expect(screen.getAllByText('12%')).toHaveLength(25)
    expect(screen.getAllByText(/18 Jun 2020/)).toHaveLength(25)
    fireEvent.click(button('Next page'))
    expect(screen.getByRole('status')).toHaveTextContent('26–32 of 32 records')
    search('city b')
    expect(screen.getByRole('status')).toHaveTextContent('1–1 of 1 records')
    expect(screen.getByText('Order32')).toBeInTheDocument()
    search('')
    fireEvent.change(screen.getByLabelText('Rows per page'), {
      target: { value: '10' },
    })
    fireEvent.click(button('Next page'))
    rerender(<Explorer rows={records.slice(0, 14)} />)
    expect(screen.getByRole('status')).toHaveTextContent('1–10 of 14 records')
  })

  it('sorts numerically and retains every record with a shared order ID', () => {
    const repeated = [
      { ...records[0], sales: 9 },
      { ...records[0], sales: 300 },
      { ...records[1], sales: 20 },
    ]
    render(<Explorer rows={repeated} />)
    const sales = button('Sort by Sales')
    fireEvent.click(sales)
    expect(sales.closest('th')).toHaveAttribute('aria-sort', 'descending')
    expect(
      within(screen.getAllByRole('row')[1]).getByText('₹300'),
    ).toBeInTheDocument()
    fireEvent.click(sales)
    expect(
      within(screen.getAllByRole('row')[1]).getByText('₹9'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Order1')).toHaveLength(2)
  })

  it('keeps customer aliases hidden until selected and supports keyboard dismissal', () => {
    render(<Explorer rows={records} />)
    expect(
      screen.queryByRole('columnheader', { name: /Customer Name/ }),
    ).not.toBeInTheDocument()
    fireEvent.click(button('Columns'))
    fireEvent.click(screen.getByRole('checkbox', { name: /Customer Name/ }))
    expect(screen.getByText('Alias 1')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button('Columns')).toHaveFocus()
    search('ALIAS 32')
    expect(screen.getByText('Order32')).toBeInTheDocument()
  })

  it('offers recovery from an empty search and disables empty downloads', () => {
    render(<Explorer rows={records} />)
    search('no such order')
    expect(screen.getByText('No matching records')).toBeInTheDocument()
    expect(button('Export CSV')).toBeDisabled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' })[0])
    expect(screen.getByText('Order1')).toBeInTheDocument()
  })

  it('downloads all sorted matching rows, across pages, with only the chosen columns', async () => {
    let exported: Blob | undefined
    const createObjectURL = vi.fn((blob: Blob) => {
      exported = blob
      return 'blob:explorer-test'
    })
    const OriginalURL = URL
    vi.stubGlobal(
      'URL',
      class extends OriginalURL {
        static createObjectURL = createObjectURL
        static revokeObjectURL = vi.fn()
      },
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    render(<Explorer rows={records} />)
    search('City A')
    fireEvent.click(button('Sort by Sales'))
    fireEvent.click(button('Columns'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Region' }))
    fireEvent.click(button('Export CSV'))
    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(exported!)
    })
    const lines = data.trim().split('\r\n')
    expect(lines).toHaveLength(32)
    expect(lines[0]).not.toMatch(/Customer Name|Region|State/)
    expect(lines[1]).toContain('"Order31"')
    expect(lines.at(-1)).toContain('"Order1"')
    expect(data).not.toContain('Order32')
  })

  it('quotes CSV punctuation, neutralizes formula-like text, and preserves numeric and ISO fields', () => {
    const row = {
      ...records[0],
      category: '=SUM(1,2)',
      city: 'Town "A"',
      profit: -42.3,
    }
    const csv = buildExplorerCsv(
      [row],
      ['category', 'city', 'date', 'discount', 'profit'],
    )
    expect(csv).toContain(`"'=SUM(1,2)","Town ""A""","2020-06-18",0.12,-42.3`)
  })
})
