import { Hono } from 'hono'

type QuoteResponse = {
  symbol: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketTime?: number
  currency?: string
}

const nowInSeconds = () => Math.floor(Date.now() / 1000)

const DUMMY_QUOTES: Record<'nikkei' | 'topix', QuoteResponse> = {
  nikkei: {
    symbol: '^N225',
    regularMarketPrice: 40123.45,
    regularMarketChange: 110.25,
    regularMarketChangePercent: 0.28,
    currency: 'JPY',
  },
  topix: {
    symbol: '^TOPX',
    regularMarketPrice: 2775.32,
    regularMarketChange: -4.12,
    regularMarketChangePercent: -0.15,
    currency: 'JPY',
  },
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

type OhlcvItem = {
  date: string
  open: number
  high: number
  low: number
  closeAdjusted: number
  volume: number
}

const MAX_CALENDAR_DAYS_LOOKBACK = 220
const TARGET_DATA_POINTS = 100

type YahooFinanceModule = typeof import('yahoo-finance2')
type YahooFinanceInstance = InstanceType<YahooFinanceModule['default']>

let yahooFinanceClientPromise: Promise<YahooFinanceInstance> | null = null

const loadYahooFinance = async (): Promise<YahooFinanceInstance> => {
  const globalAny = globalThis as Record<string, unknown>

  if (globalAny.__dirname === undefined) {
    globalAny.__dirname = '/'
  }
  if (globalAny.__filename === undefined) {
    globalAny.__filename = '/index.js'
  }

  if (!yahooFinanceClientPromise) {
    yahooFinanceClientPromise = import('yahoo-finance2').then((module) => new module.default())
  }

  return yahooFinanceClientPromise
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
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketTime: Number.isFinite(timestamp) ? timestamp : undefined,
    currency: 'JPY',
  }
}

const fetchDailyOhlcv = async (symbol: string): Promise<OhlcvItem[]> => {
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

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/api/nikkei', async (c) => {
  return c.json({
    ...DUMMY_QUOTES.nikkei,
    regularMarketTime: nowInSeconds(),
  })
})

app.get('/api/topix', async (c) => {
  return c.json({
    ...DUMMY_QUOTES.topix,
    regularMarketTime: nowInSeconds(),
  })
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

app.get('/api/stocks', async (c) => {
  const symbol = c.req.query('symbol')?.trim()

  if (!symbol) {
    return c.json({ message: 'symbol クエリパラメーターは必須です' }, 400)
  }

  try {
    const ohlcv = await fetchDailyOhlcv(symbol)
    return c.json({
      symbol,
      interval: '1d',
      points: ohlcv.length,
      data: ohlcv,
    })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return c.json({ message }, 500)
  }
})

export default app
