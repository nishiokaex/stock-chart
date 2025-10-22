export type QuoteResponse = {
  symbol: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketTime?: number
  currency?: string
}

export type ForexTickerItem = {
  symbol: string
  timestamp?: string
  bid?: string
  ask?: string
  open?: string
  high?: string
  low?: string
  last?: string
}

export type ForexTickerResponse = {
  status?: number
  data?: ForexTickerItem[]
}

export type OhlcvItem = {
  date: string
  open: number
  high: number
  low: number
  closeAdjusted: number
  volume: number
}

