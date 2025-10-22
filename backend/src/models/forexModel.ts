import type { ForexTickerResponse, QuoteResponse } from './types'

const COIN_Z_API_ENDPOINT = 'https://forex-api.coin.z.com/public/v1/ticker'

const parseNumber = (value?: string): number | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseTimestamp = (value?: string): number | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return undefined
  }
  return Math.floor(parsed / 1000)
}

export const fetchUsdJpyQuote = async (): Promise<QuoteResponse> => {
  const response = await fetch(COIN_Z_API_ENDPOINT)

  if (!response.ok) {
    throw new Error(`Coin.z.com API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json<ForexTickerResponse>()
  const ticker = data.data?.find((item) => item.symbol === 'USD_JPY')

  if (!ticker) {
    throw new Error('USD/JPY ticker not found')
  }

  const price = parseNumber(ticker.bid) ?? parseNumber(ticker.ask)
  if (price === undefined) {
    throw new Error('USD/JPY price is unavailable')
  }

  const open = parseNumber(ticker.open)
  const change = open !== undefined ? price - open : undefined
  const changePercent =
    change !== undefined && open !== undefined && open !== 0 ? (change / open) * 100 : undefined
  const timestamp = parseTimestamp(ticker.timestamp)

  return {
    symbol: 'USDJPY',
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketTime: Number.isFinite(timestamp) ? timestamp : undefined,
    currency: 'JPY',
  }
}

