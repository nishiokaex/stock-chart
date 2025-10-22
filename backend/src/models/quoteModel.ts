import type { QuoteResponse } from './types'

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

