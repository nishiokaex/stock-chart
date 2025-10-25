import stocksCsv from '../assets/stocks.csv'

import type { StockMasterItem } from './types'

type SearchableStock = StockMasterItem & {
  symbolLower: string
  nameLower: string
}

const trimLine = (line: string) => line.trim()

const parseStocksCsv = (csv: string): SearchableStock[] =>
  csv
    .split(/\r?\n/)
    .map(trimLine)
    .filter(Boolean)
    .map((line) => {
      const [symbolRaw, nameRaw] = line.split('|')
      const symbol = symbolRaw?.trim() ?? ''
      const name = nameRaw?.trim() ?? ''

      return {
        symbol,
        name,
        symbolLower: symbol.toLowerCase(),
        nameLower: name.toLowerCase(),
      }
    })
    .filter((item) => item.symbol && item.name)

const stocks = parseStocksCsv(stocksCsv)

const normalize = (value: string) => value.trim().toLowerCase()

export const searchStocks = (keyword: string): StockMasterItem[] => {
  const normalized = normalize(keyword)

  if (!normalized) {
    return []
  }

  return stocks
    .filter(
      (stock) =>
        stock.symbolLower.includes(normalized) ||
        stock.nameLower.includes(normalized),
    )
    .map(({ symbol, name }) => ({ symbol, name }))
}
