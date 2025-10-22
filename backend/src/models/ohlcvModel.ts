import { loadYahooFinance } from './yahooFinanceClient'
import type { OhlcvItem } from './types'

const MAX_CALENDAR_DAYS_LOOKBACK = 220
const TARGET_DATA_POINTS = 100

export const fetchDailyOhlcv = async (symbol: string): Promise<OhlcvItem[]> => {
  if (!symbol) {
    throw new Error('symbol is required')
  }

  const yahooFinance = await loadYahooFinance()

  const today = new Date()
  const period1 = new Date(today)
  period1.setDate(period1.getDate() - MAX_CALENDAR_DAYS_LOOKBACK)

  const quotes = await yahooFinance.historical(symbol, {
    period1,
    period2: today,
    interval: '1d',
  })

  const sanitized = quotes
    .filter((quote) => {
      const { open, high, low, close, adjClose, volume, date } = quote
      return (
        typeof open === 'number' &&
        typeof high === 'number' &&
        typeof low === 'number' &&
        typeof close === 'number' &&
        typeof adjClose === 'number' &&
        typeof volume === 'number' &&
        Number.isFinite(open) &&
        Number.isFinite(high) &&
        Number.isFinite(low) &&
        Number.isFinite(close) &&
        Number.isFinite(adjClose) &&
        Number.isFinite(volume) &&
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
      closeAdjusted: quote.adjClose!,
      volume: quote.volume!,
    }))

  const sliced = sanitized.slice(-TARGET_DATA_POINTS)

  if (sliced.length === 0) {
    throw new Error(`No OHLCV data returned for symbol "${symbol}"`)
  }

  return sliced
}

