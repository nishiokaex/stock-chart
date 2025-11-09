import { buildApiUrl } from '@/lib/api/base'

import { computeMacd, computeMovingAverage, computeRsi } from './utils'
import type { Candle } from './types'

type OhlcvResponse = {
  date?: string
  open?: number
  high?: number
  low?: number
  closeAdjusted?: number
  volume?: number
}

type StocksApiResponse = {
  symbol?: string
  interval?: string
  points?: number
  data?: OhlcvResponse[]
}

export type IndicatorGroup = 'movingAverage' | 'rsi' | 'macd'

export interface IndicatorSeries {
  id: string
  label: string
  group: IndicatorGroup
  values: (number | null)[]
}

export interface StockCandleData {
  candles: Candle[]
  indicators: IndicatorSeries[]
}

const TARGET_POINTS = 200

const parseDateToTimestamp = (value?: string): number | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp)) {
    return null
  }
  return timestamp
}

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }
  return value
}

export const fetchStockCandleData = async (symbol: string): Promise<StockCandleData> => {
  const url = buildApiUrl(`/api/stocks?symbol=${encodeURIComponent(symbol)}`)
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch OHLCV data: ${response.status}`)
  }

  const payload = (await response.json()) as StocksApiResponse
  const rows = Array.isArray(payload.data) ? payload.data : []

  const parsedCandles: Candle[] = rows
    .map((item) => {
      const timestamp = parseDateToTimestamp(item.date)
      if (timestamp === null) {
        return null
      }
      return {
        timestamp,
        open: toNullableNumber(item.open),
        high: toNullableNumber(item.high),
        low: toNullableNumber(item.low),
        close: toNullableNumber(item.closeAdjusted),
        volume: toNullableNumber(item.volume),
      }
    })
    .filter((value): value is Candle => value !== null)

  if (parsedCandles.length === 0) {
    throw new Error('No OHLCV candles returned')
  }

  const sortedCandles = [...parsedCandles].sort((a, b) => a.timestamp - b.timestamp)
  const candles =
    sortedCandles.length > TARGET_POINTS
      ? sortedCandles.slice(sortedCandles.length - TARGET_POINTS)
      : sortedCandles

  const ma7 = computeMovingAverage(candles, 7)
  const ma25 = computeMovingAverage(candles, 25)
  const rsi14 = computeRsi(candles, 14)
  const macdResult = computeMacd(candles, 12, 26, 9)

  const indicators: IndicatorSeries[] = [
    { id: 'ma7', label: '7日移動平均', group: 'movingAverage', values: ma7 },
    { id: 'ma25', label: '25日移動平均', group: 'movingAverage', values: ma25 },
    { id: 'rsi14', label: 'RSI(14)', group: 'rsi', values: rsi14 },
    { id: 'macd', label: 'MACD', group: 'macd', values: macdResult.macd },
    { id: 'macdSignal', label: 'MACDシグナル', group: 'macd', values: macdResult.signal },
  ]

  return {
    candles,
    indicators,
  }
}
