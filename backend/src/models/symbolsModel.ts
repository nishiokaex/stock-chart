import stocksCsv from '../assets/stocks.csv'

import type { SymbolMasterItem } from './types'

type SearchableSymbol = SymbolMasterItem & {
  symbolLower: string
  nameLower: string
}

const trimLine = (line: string) => line.trim()

const parseSymbolsCsv = (csv: string): SearchableSymbol[] =>
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

const symbols = parseSymbolsCsv(stocksCsv)

const normalize = (value: string) => value.trim().toLowerCase()

export const searchSymbols = (keyword: string): SymbolMasterItem[] => {
  const normalized = normalize(keyword)

  if (!normalized) {
    return []
  }

  return symbols
    .filter(
      (symbol) =>
        symbol.symbolLower.includes(normalized) ||
        symbol.nameLower.includes(normalized),
    )
    .map(({ symbol, name }) => ({ symbol, name }))
}
