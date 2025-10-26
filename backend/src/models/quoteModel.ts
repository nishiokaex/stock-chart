import { nowInSeconds } from '../utils/time'
import type { QuoteResponse } from './types'
import { fetchUsdJpyQuote } from './forexModel'
import { loadYahooFinance } from './yahooFinanceClient'

type DummyQuoteKey = 'nikkei' | 'topix'

const DUMMY_QUOTES: Record<DummyQuoteKey, QuoteResponse> = {
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

export const getDummyQuote = (key: DummyQuoteKey): QuoteResponse => DUMMY_QUOTES[key]

const SYMBOL_OVERRIDES: Record<string, () => Promise<QuoteResponse>> = {
  USDJPY: fetchUsdJpyQuote,
  'TSE:TOPIX': async () => ({
    ...getDummyQuote('topix'),
    symbol: 'TSE:TOPIX',
    regularMarketTime: nowInSeconds(),
  }),
}

export const fetchQuoteBySymbol = async (symbol: string): Promise<QuoteResponse> => {
  const trimmed = symbol.trim()

  if (!trimmed) {
    throw new Error('symbol is required')
  }

  const normalized = trimmed.toUpperCase()
  const override = SYMBOL_OVERRIDES[normalized]
  if (override) {
    return override()
  }

  const yahooFinance = await loadYahooFinance()
  const quote = await yahooFinance.quote(trimmed)

  if (!quote) {
    throw new Error(`Quote not found for symbol "${trimmed}"`)
  }

  const {
    regularMarketPrice,
    regularMarketChange,
    regularMarketChangePercent,
    regularMarketTime,
    currency,
  } = quote

  if (regularMarketPrice === undefined || Number.isNaN(regularMarketPrice)) {
    throw new Error(`Quote not available for symbol "${trimmed}"`)
  }

  return {
    symbol: quote.symbol ?? normalized,
    regularMarketPrice,
    regularMarketChange,
    regularMarketChangePercent,
    regularMarketTime:
      typeof regularMarketTime === 'number' && Number.isFinite(regularMarketTime)
        ? Math.trunc(regularMarketTime)
        : undefined,
    currency,
  }
}
