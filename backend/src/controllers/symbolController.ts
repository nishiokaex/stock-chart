import type { Context } from 'hono'

import { searchSymbols } from '../models/symbolsModel'
import { renderError } from '../views/quoteView'
import { renderSymbolSearchResponse } from '../views/symbolView'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 50
const MAX_PER_PAGE = 200

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const searchSymbolController = (c: Context) => {
  const keyword = c.req.query('q')?.trim()

  if (!keyword) {
    return c.json(renderError('q クエリパラメーターは必須です'), 400)
  }

  const page = parsePositiveInteger(c.req.query('page'), DEFAULT_PAGE)
  const requestedPerPage = parsePositiveInteger(
    c.req.query('per_page'),
    DEFAULT_PER_PAGE,
  )
  const perPage = Math.min(requestedPerPage, MAX_PER_PAGE)

  const matches = searchSymbols(keyword)
  const total = matches.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage)
  const start = (page - 1) * perPage
  const items = start >= total ? [] : matches.slice(start, start + perPage)

  return c.json(
    renderSymbolSearchResponse({
      query: keyword,
      total,
      page,
      perPage,
      totalPages,
      items,
    }),
  )
}
