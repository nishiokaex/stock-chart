import type { Hono } from 'hono'

import { getRoot } from './controllers/healthController'
import {
  getNikkeiQuote,
  getStockOhlcv,
  getTopixQuote,
  getUsdJpyQuote,
} from './controllers/quoteController'
import { searchSymbolController } from './controllers/symbolController'

export const registerRoutes = (app: Hono) => {
  app.get('/', getRoot)
  app.get('/api/nikkei', getNikkeiQuote)
  app.get('/api/topix', getTopixQuote)
  app.get('/api/usdjpy', getUsdJpyQuote)
  app.get('/api/stocks', getStockOhlcv)
  app.get('/api/symbol', searchSymbolController)

  return app
}
