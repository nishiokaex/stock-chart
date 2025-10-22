import type { Hono } from 'hono'

import { getRoot } from './controllers/healthController'
import {
  getNikkeiQuote,
  getStockOhlcv,
  getTopixQuote,
  getUsdJpyQuote,
} from './controllers/quoteController'

export const registerRoutes = (app: Hono) => {
  app.get('/', getRoot)
  app.get('/api/nikkei', getNikkeiQuote)
  app.get('/api/topix', getTopixQuote)
  app.get('/api/usdjpy', getUsdJpyQuote)
  app.get('/api/stocks', getStockOhlcv)

  return app
}

