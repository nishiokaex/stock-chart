import type { Context } from 'hono'

import { fetchDailyOhlcv } from '../models/ohlcvModel'
import { fetchUsdJpyQuote } from '../models/forexModel'
import { getDummyQuote } from '../models/quoteModel'
import { renderError, renderQuote, renderStocksResponse } from '../views/quoteView'
import { nowInSeconds } from '../utils/time'

export const getNikkeiQuote = (c: Context) => {
  const quote = getDummyQuote('nikkei')
  return c.json(
    renderQuote({
      ...quote,
      regularMarketTime: nowInSeconds(),
    }),
  )
}

export const getTopixQuote = (c: Context) => {
  const quote = getDummyQuote('topix')
  return c.json(
    renderQuote({
      ...quote,
      regularMarketTime: nowInSeconds(),
    }),
  )
}

export const getUsdJpyQuote = async (c: Context) => {
  try {
    const quote = await fetchUsdJpyQuote()
    return c.json(renderQuote(quote))
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return c.json(renderError(message), 500)
  }
}

export const getStockOhlcv = async (c: Context) => {
  const symbol = c.req.query('symbol')?.trim()

  if (!symbol) {
    return c.json(renderError('symbol クエリパラメーターは必須です'), 400)
  }

  try {
    const ohlcv = await fetchDailyOhlcv(symbol)
    return c.json(renderStocksResponse(symbol, ohlcv))
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return c.json(renderError(message), 500)
  }
}

