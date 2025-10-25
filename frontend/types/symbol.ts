export type SymbolSearchItem = {
  symbol: string
  name: string
}

export type SymbolSearchResponse = {
  query: string
  total: number
  page: number
  perPage: number
  totalPages: number
  items: SymbolSearchItem[]
}
