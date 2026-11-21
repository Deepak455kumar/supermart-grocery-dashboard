import {
  compactMoney,
  flagGroups,
  money,
  number,
  pct,
  rank,
  type Analysis,
} from './analytics'
export type Insight = {
  topic: string
  title: string
  value: string
  interpretation: string
  action: string
}
export function insights(a: Analysis): Insight[] {
  if (!a.kpi.orders) return []
  const category = a.category[0],
    profit = rank(a.category, 'profit')[0],
    region = a.region[0]
  const low = rank(a.subcategory, 'margin').at(-1)!,
    month = rank(a.months, 'sales')[0]
  const cities = flagGroups(a.city).flagged
  const period = new Date(month.name + '-01T00:00:00Z').toLocaleDateString(
    'en-GB',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  )
  return [
    {
      topic: 'Sales mix',
      title: category.name + ' leads category sales',
      value: compactMoney(category.sales),
      interpretation:
        pct((100 * category.sales) / a.kpi.sales) +
        ' of selected sales comes from this category.',
      action:
        'Review stock availability in the leading category before changing its assortment.',
    },
    {
      topic: 'Category profit',
      title: profit.name + ' contributes the most profit',
      value: compactMoney(profit.profit),
      interpretation:
        'The category earns ' +
        money(profit.profit) +
        ' in profit at a ' +
        pct(profit.margin) +
        ' margin.',
      action: 'Compare its subcategory margins before expanding the range.',
    },
    {
      topic: 'Geography',
      title: region.name + ' leads regional sales',
      value: compactMoney(region.sales),
      interpretation:
        'The source assigns ' +
        number(region.orders) +
        ' distinct orders to this region in the selection.',
      action:
        'Compare regional order counts and order values before reallocating stock.',
    },
    {
      topic: 'Product mix',
      title: low.name + ' has the lowest margin',
      value: pct(low.margin),
      interpretation:
        'This group earns ' +
        money(low.profit) +
        ' on ' +
        money(low.sales) +
        ' of sales.',
      action:
        'Review the group’s price and cost breakdown with the buying team.',
    },
    {
      topic: 'Sales trend',
      title: period + ' has the highest sales',
      value: compactMoney(month.sales),
      interpretation:
        number(month.orders) +
        ' distinct orders contributed to this month in the selection. Date filters may include partial months.',
      action:
        'Check the order mix and compare the same calendar month across years.',
    },
    {
      topic: 'City margins',
      title: cities.length
        ? cities[0].name + ' merits a margin review'
        : 'No cities meet both thresholds',
      value: number(cities.length) + ' flagged',
      interpretation:
        'Flagged cities have above-median sales and below-median margin among selected cities.',
      action:
        'Compare category mix and discount bands across the selected cities.',
    },
    {
      topic: 'Discounts',
      title:
        a.r === null
          ? 'Correlation unavailable'
          : Math.abs(a.r) < 0.1
            ? 'Discount and profit show little linear association'
            : 'Discount and profit show a ' +
              (a.r > 0 ? 'positive' : 'negative') +
              ' linear association',
      value: a.r === null ? 'N/A' : 'r = ' + a.r.toFixed(6),
      interpretation:
        a.r === null
          ? 'Pearson correlation needs two or more observations with variation in both fields.'
          : 'Pearson r measures the linear association between the discount fraction and rupee profit per record. It cannot establish causation.',
      action:
        'Compare discount bands within the same category before testing a pricing change.',
    },
  ]
}
