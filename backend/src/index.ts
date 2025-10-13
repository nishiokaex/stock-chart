import { Hono } from 'hono'

type QuoteResponse = {
  symbol: string
  shortName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketTime?: number
  currency?: string
}

const fetchQuote = async (symbol: string): Promise<QuoteResponse> => {
  const endpoint = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json<{ quoteResponse?: { result?: QuoteResponse[] } }>()
  const quote = data.quoteResponse?.result?.[0]

  if (!quote) {
    throw new Error(`Quote not found for symbol: ${symbol}`)
  }

  return quote
}

type ForexTickerItem = {
  symbol: string
  timestamp?: string
  bid?: string
  ask?: string
  open?: string
  high?: string
  low?: string
  last?: string
}

type ForexTickerResponse = {
  status?: number
  data?: ForexTickerItem[]
}

const fetchUsdJpyQuote = async (): Promise<QuoteResponse> => {
  const endpoint = 'https://forex-api.coin.z.com/public/v1/ticker'
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(`Coin.z.com API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json<ForexTickerResponse>()
  const ticker = data.data?.find((item) => item.symbol === 'USD_JPY')

  if (!ticker) {
    throw new Error('USD/JPY ticker not found')
  }

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
    shortName: 'ドル円',
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketTime: Number.isFinite(timestamp) ? timestamp : undefined,
    currency: 'JPY',
  }
}

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/api/nikkei', async (c) => {
  try {
    const data = await fetchQuote('^N225')
    return c.json(data)
  } catch (error) {
    console.error(error)
    return c.json({ message: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})

app.get('/api/topix', async (c) => {
  try {
    const data = await fetchQuote('^TOPX')
    return c.json(data)
  } catch (error) {
    console.error(error)
    return c.json({ message: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})

app.get('/api/usdjpy', async (c) => {
  try {
    const data = await fetchUsdJpyQuote()
    return c.json(data)
  } catch (error) {
    console.error(error)
    return c.json({ message: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})

export default app
