import type { StockMasterItem } from '../models/types'

export type StockSearchResponse = {
  query: string
  total: number
  page: number
  perPage: number
  totalPages: number
  items: StockMasterItem[]
}

export const renderStockSearchResponse = (response: StockSearchResponse) => response
