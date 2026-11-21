import { chromium } from 'playwright-core'
import { preview } from 'vite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'chrome',
  headless: true,
})
let server
try {
  server = await preview({
    preview: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  })
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  const base = server.resolvedUrls.local[0].replace(/\/$/, '')
  await page.goto(base)
  await page
    .getByRole('heading', { level: 1, name: 'Executive overview' })
    .waitFor()
  await page.locator('.recharts-area-curve').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  const dest = path.resolve('docs/screenshots')
  const capture = process.argv.includes('--screenshots')
  if (capture) await fs.mkdir(dest, { recursive: true })
  if (capture) await page.screenshot({ path: path.join(dest, 'overview.png') })
  const nav = [
    ['/', 'Executive overview'],
    ['/sales', 'Sales analytics'],
    ['/products', 'Product performance'],
    ['/profit', 'Profit & discount'],
    ['/geography', 'Geographic analytics'],
    ['/explorer', 'Data explorer'],
    ['/insights', 'Business insights'],
    ['/about', 'About project'],
  ]
  for (const width of [1920, 1366, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 950 })
    for (const [route, name] of nav) {
      if (width <= 1050)
        await page.getByRole('button', { name: 'Open navigation' }).click()
      await page
        .getByRole('navigation')
        .getByRole('link', { name, exact: true })
        .click()
      await page.getByRole('heading', { level: 1, name, exact: true }).waitFor()
      if (route === '/explorer')
        await page.getByRole('heading', { name: 'Sales records' }).waitFor()
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      )
      const state = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        view: innerWidth,
        zero: [
          ...document.querySelectorAll('.recharts-responsive-container'),
        ].filter((el) => !el.clientHeight || !el.clientWidth).length,
      }))
      assert.ok(
        state.w <= width + 1,
        route + ' overflow @' + width + ': ' + JSON.stringify(state),
      )
      assert.equal(state.zero, 0, route + ' chart size @' + width)
      if (width === 390 && route === '/')
        if (capture)
          await page.screenshot({ path: path.join(dest, 'mobile.png') })
    }
    console.log('All eight routes passed at ' + width + 'px.')
  }
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto(base)
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByLabel('Category', { exact: true }).selectOption('Beverages')
  await page.getByLabel('Region', { exact: true }).selectOption('South')
  await page.getByRole('button', { name: 'Done' }).click()
  assert.equal(
    await page.locator('.kpi.sales>strong').textContent(),
    '₹3,44,666',
  )
  assert.match(
    await page.locator('.filter-chips').innerText(),
    /227 matching records/,
  )
  await page.getByRole('link', { name: 'Data explorer', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ])
  const csv = await fs.readFile(await download.path(), 'utf8')
  assert.equal(csv.trim().split(/\r?\n/).length, 228)
  assert.ok(!csv.includes('Customer Name'))
  await page
    .getByRole('link', { name: 'Business insights', exact: true })
    .click()
  assert.ok(
    (await page.locator('.insight').first().innerText()).includes('Beverages'),
  )
  await page.getByRole('button', { name: 'Reset all filters' }).click()
  await page
    .getByRole('link', { name: 'Geographic analytics', exact: true })
    .click()
  await page.getByLabel('Region', { exact: true }).selectOption('North')
  assert.deepEqual(
    await page
      .getByLabel('City', { exact: true })
      .locator('option')
      .allTextContents(),
    ['All cities', 'Vellore'],
  )
  await page.getByLabel('State', { exact: true }).selectOption('Tamil Nadu')
  await page.getByLabel('City', { exact: true }).selectOption('Vellore')
  await page.getByRole('button', { name: 'Reset all filters' }).click()
  await page.getByRole('link', { name: 'Executive overview' }).click()
  const yearButton = page.getByRole('button', { name: /^Year range,/ })
  const yearPanel = page.getByRole('dialog', { name: 'Year range' })
  const salesKpi = page.locator('.kpi.sales>strong')
  await yearButton.click()
  await yearPanel.getByLabel('Through year', {exact:true}).selectOption('2015')
  await yearPanel.getByLabel('Through month', {exact:true}).selectOption('2015-01')
  assert.equal(await salesKpi.textContent(), '₹2,03,014')
  assert.equal(await yearButton.innerText(), 'Jan 2015')
  await yearPanel.getByRole('button', {name:'All years'}).click()
  const startSlider = yearPanel.getByRole('slider', { name: 'Start year' })
  const endSlider = yearPanel.getByRole('slider', { name: 'End year' })
  await startSlider.press('ArrowRight')
  await endSlider.press('ArrowLeft')
  assert.equal(await yearButton.innerText(), '2016–2017')
  assert.equal(await salesKpi.textContent(), '₹70,03,871')
  const thumb = await startSlider.boundingBox()
  const otherThumb = await endSlider.boundingBox()
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    otherThumb.x + otherThumb.width / 2,
    otherThumb.y + otherThumb.height / 2,
    { steps: 10 },
  )
  await page.mouse.up()
  assert.equal(await yearButton.innerText(), '2017')
  assert.equal(await salesKpi.textContent(), '₹38,71,912')
  await yearPanel.getByLabel('From year', { exact: true }).selectOption('2018')
  assert.equal(
    await yearPanel.getByLabel('Through year', { exact: true }).inputValue(),
    '2018',
  )
  await yearPanel
    .getByLabel('Through year', { exact: true })
    .selectOption('2017')
  await yearPanel.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: /^Filters/ }).click()
  await page.getByLabel('Category', { exact: true }).selectOption('Beverages')
  await page.getByRole('button', { name: 'Done' }).click()
  assert.equal(await salesKpi.textContent(), '₹5,43,575')
  await yearButton.click()
  await yearPanel.getByRole('button', { name: 'All years' }).click()
  await yearPanel.getByRole('button', { name: 'Done' }).click()
  assert.equal(await yearButton.innerText(), '2015–2018')
  assert.equal(await salesKpi.textContent(), '₹20,85,313')
  await page.getByRole('button', { name: /^Filters/ }).click()
  await page.getByLabel('Region', { exact: true }).selectOption('North')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('heading', { name: 'No matching records' }).waitFor()
  await page
    .getByRole('button', { name: 'Clear all filters', exact: true })
    .click()
  await page.getByLabel('Trend period').selectOption('Quarter')
  await page
    .getByRole('button', { name: 'Show data table for Sales and profit trend' })
    .click()
  assert.ok(await page.getByRole('cell', { name: 'Q1 2015' }).count())
  await page
    .getByRole('button', { name: 'Show chart for Sales and profit trend' })
    .click()
  const [png] = await Promise.all([
    page.waitForEvent('download', { timeout: 45000 }),
    page
      .getByRole('button', {
        name: 'Download PNG of Sales and profit trend',
        exact: true,
      })
      .click(),
  ])
  const pngBytes = await fs.readFile(await png.path())
  assert.equal(pngBytes.subarray(1, 4).toString(), 'PNG')
  assert.ok(pngBytes.length > 15000)

  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Switch to light mode' }).waitFor()
  if (capture) await page.screenshot({ path: path.join(dest, 'dark.png') })
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.goto(base + '/profit')
  await page.locator('canvas').waitFor()
  await page.locator('canvas').hover()
  await page.goto(base + '/sales')
  await page
    .getByRole('heading', { name: 'Year-over-year comparison' })
    .waitFor()
  assert.match(await page.locator('.compare').innerText(), /₹49,77,512/)
  assert.match(await page.locator('.compare').innerText(), /₹38,61,744/)
  console.log(
    'PNG, PDF, matched-year comparison, filters, cross-page state, CSV contents, dependent selectors, date ranges, empty state, chart tables, theme persistence and direct route load passed.',
  )
  assert.deepEqual(errors, [])
  console.log('Zero browser console errors and page exceptions.')
} finally {
  await browser.close()
  if (server) await new Promise((resolve) => server.httpServer.close(resolve))
}
