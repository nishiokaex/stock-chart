import type { OhlcvItem, QuoteResponse } from '../models/types'

export const renderQuote = (quote: QuoteResponse) => quote

export const renderStocksResponse = (symbol: string, data: OhlcvItem[]) => ({
  symbol,
  interval: '1d',
  points: data.length,
  data,
})

export const renderError = (message: string) => ({
  message,
})

