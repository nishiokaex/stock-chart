import type { SymbolMasterItem } from '../models/types'

export type SymbolSearchResponse = {
  query: string
  total: number
  page: number
  perPage: number
  totalPages: number
  items: SymbolMasterItem[]
}

export const renderSymbolSearchResponse = (response: SymbolSearchResponse) => response
