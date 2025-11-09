import { loadYahooFinance } from './yahooFinanceClient'
import type { OhlcvItem } from './types'

const MAX_CALENDAR_DAYS_LOOKBACK = 220
const TARGET_DATA_POINTS = 200

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const fetchDailyOhlcv = async (symbol: string): Promise<OhlcvItem[]> => {
  if (!symbol) {
    throw new Error('symbol is required')
  }

  const yahooFinance = await loadYahooFinance()

  const today = new Date()
  const period1 = new Date(today)
  period1.setDate(period1.getDate() - MAX_CALENDAR_DAYS_LOOKBACK)

  const chartResult = await yahooFinance.chart(symbol, {
    period1,
    period2: today,
    interval: '1d',
    return: 'array',
  })

  const sanitized = (chartResult.quotes ?? [])
    .filter((quote) => {
      const { open, high, low, close, adjclose, volume, date } = quote
      const adjustedClose = isFiniteNumber(adjclose) ? adjclose : close
      return (
        isFiniteNumber(open) &&
        isFiniteNumber(high) &&
        isFiniteNumber(low) &&
        isFiniteNumber(close) &&
        isFiniteNumber(adjustedClose) &&
        isFiniteNumber(volume) &&
        date instanceof Date &&
        !Number.isNaN(date.getTime())
      )
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map<OhlcvItem>((quote) => ({
      date: quote.date.toISOString().slice(0, 10),
      open: quote.open!,
      high: quote.high!,
      low: quote.low!,
      closeAdjusted: (isFiniteNumber(quote.adjclose) ? quote.adjclose : quote.close)!,
      volume: quote.volume!,
    }))

  const sliced = sanitized.slice(-TARGET_DATA_POINTS)

  if (sliced.length === 0) {
    throw new Error(`No OHLCV data returned for symbol "${symbol}"`)
  }

  return sliced
}

