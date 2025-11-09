import axios from 'axios'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'

import { useRouter } from 'expo-router'
import { RectButton, Swipeable } from 'react-native-gesture-handler'

import {
  ActivityIndicator,
  Button,
  Divider,
  HelperText,
  List,
  Searchbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper'
import { buildApiUrl } from '@/lib/api/base'
import {
  loadCustomSymbols,
  saveCustomSymbols,
  type StoredCustomSymbol,
} from '@/lib/storage/custom-markets'
import type { MarketQuote } from '@/types/market'
import type { SymbolSearchItem, SymbolSearchResponse } from '@/types/symbol'

type MarketEntry = {
  id: string
  label: string
  path: string
  fractionDigits: number
  symbol?: string
}

type MarketState = Record<string, { quote?: MarketQuote; error?: string }>

const SEARCH_DEBOUNCE_MS = 300
const CUSTOM_SYMBOL_FRACTION_DIGITS = 2

const buildQuotePath = (symbol: string) => `/api/quote?symbol=${encodeURIComponent(symbol)}`

const DEFAULT_SYMBOLS: StoredCustomSymbol[] = [
  { symbol: 'TSE:TOPIX', label: 'TOPIX' },
  { symbol: 'USDJPY', label: 'ドル円' },
]

const buildMarketEntries = (symbols: StoredCustomSymbol[]): MarketEntry[] =>
  symbols.map((item) => ({
    id: `custom:${item.symbol}`,
    label: item.label || item.symbol,
    path: buildQuotePath(item.symbol),
    fractionDigits: CUSTOM_SYMBOL_FRACTION_DIGITS,
    symbol: item.symbol,
  }))

const formatNumber = (value: number | undefined, maximumFractionDigits: number) => {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
}

const formatChangeText = (
  change: number | undefined,
  changePercent: number | undefined,
  fractionDigits: number,
) => {
  if (change === undefined || changePercent === undefined) {
    return '--'
  }
  const sign = change > 0 ? '+' : change < 0 ? '-' : ''
  const formattedChange = formatNumber(Math.abs(change), fractionDigits)
  const formattedPercent = Math.abs(changePercent).toFixed(2)
  return `${sign}${formattedChange} (${sign}${formattedPercent}%)`
}

export default function HomeScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [marketState, setMarketState] = useState<MarketState>({})
  const [customSymbols, setCustomSymbols] = useState<StoredCustomSymbol[]>([])
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SymbolSearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string>()
  const [pendingSymbol, setPendingSymbol] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await loadCustomSymbols()
        if (!stored || stored.length === 0) {
          setCustomSymbols(DEFAULT_SYMBOLS)
          try {
            await saveCustomSymbols(DEFAULT_SYMBOLS)
          } catch (error) {
            console.error('[market] 初期シンボルの保存に失敗しました', error)
          }
        } else {
          setCustomSymbols(stored)
        }
      } catch (error) {
        console.error('[market] シンボルの読み込みに失敗しました', error)
        setCustomSymbols(DEFAULT_SYMBOLS)
      }
    }
    void load()
  }, [])

  const marketEntries = useMemo(() => buildMarketEntries(customSymbols), [customSymbols])
  const existingSymbols = useMemo(() => new Set(customSymbols.map((item) => item.symbol)), [customSymbols])

  const fetchMarketData = useCallback(async (entries: MarketEntry[]) => {
    if (entries.length === 0) {
      setMarketState({})
      return
    }

    const settled = await Promise.allSettled(
      entries.map(async (entry) => {
        const { data } = await axios.get<MarketQuote>(buildApiUrl(entry.path))
        if (!data || typeof data !== 'object') {
          throw new Error('不正なレスポンスです。')
        }
        return [entry.id, data] as const
      }),
    )

    const nextState: MarketState = {}
    settled.forEach((result, index) => {
      const entry = entries[index]
      if (result.status === 'fulfilled') {
        nextState[entry.id] = { quote: result.value[1] }
      } else {
        console.error(`[market] ${entry.id} の取得に失敗しました`, result.reason)
        nextState[entry.id] = {
          error: 'データの取得に失敗しました。',
        }
      }
    })

    setMarketState(nextState)
  }, [])

  useEffect(() => {
    const load = async () => {
      await fetchMarketData(marketEntries)
    }
    load()
  }, [fetchMarketData, marketEntries])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchMarketData(marketEntries)
    } finally {
      setRefreshing(false)
    }
  }, [fetchMarketData, marketEntries])

  const performSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) {
        setSearchResults([])
        setSearchError(undefined)
        return
      }

      setIsSearching(true)
      setSearchError(undefined)
      try {
        const { data } = await axios.get<SymbolSearchResponse>(
          buildApiUrl(`/api/symbol?q=${encodeURIComponent(trimmed)}&per_page=20`),
        )
        setSearchResults(data.items ?? [])
      } catch (error) {
        console.error('[market] シンボル検索に失敗しました', error)
        setSearchError('検索に失敗しました。時間をおいて再度お試しください。')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [],
  )

  useEffect(() => {
    const handler = setTimeout(() => {
      void performSearch(searchQuery)
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(handler)
  }, [performSearch, searchQuery])

  const handleAddSymbol = useCallback(
    async (item: SymbolSearchItem) => {
      if (existingSymbols.has(item.symbol)) {
        return
      }

      const nextSymbols = [
        ...customSymbols,
        { symbol: item.symbol, label: item.name || item.symbol },
      ]

      setCustomSymbols(nextSymbols)
      setPendingSymbol(item.symbol)
      try {
        await saveCustomSymbols(nextSymbols)
        await fetchMarketData(buildMarketEntries(nextSymbols))
      } catch (error) {
        console.error('[market] カスタムシンボルの保存に失敗しました', error)
        setCustomSymbols(customSymbols)
        setSearchError('シンボルの追加に失敗しました。もう一度お試しください。')
      } finally {
        setPendingSymbol(null)
      }
    },
    [customSymbols, existingSymbols, fetchMarketData],
  )

  const handleRemoveSymbol = useCallback(
    async (symbol: string) => {
      const prevSymbols = customSymbols
      const nextSymbols = customSymbols.filter((item) => item.symbol !== symbol)

      if (nextSymbols.length === prevSymbols.length) {
        return
      }

      setCustomSymbols(nextSymbols)

      try {
        await saveCustomSymbols(nextSymbols)
        await fetchMarketData(buildMarketEntries(nextSymbols))
      } catch (error) {
        console.error('[market] カスタムシンボルの削除に失敗しました', error)
        setCustomSymbols(prevSymbols)
        setSearchError('シンボルの削除に失敗しました。もう一度お試しください。')
      }
    },
    [customSymbols, fetchMarketData],
  )

  const handleNavigateToChart = useCallback(
    (entry: MarketEntry) => {
      if (!entry.symbol) {
        return
      }

      router.push({
        pathname: '/(tabs)/explore',
        params: {
          symbol: entry.symbol,
          label: entry.label,
        },
      })
    },
    [router],
  )

  const hasQuery = Boolean(searchQuery.trim())

  const screenStyle = [styles.screen, { backgroundColor: theme.colors.background }]
  const scrollStyle = [styles.scroll, { backgroundColor: theme.colors.background }]
  const surfaceStyle = [styles.sectionSurface, { backgroundColor: theme.colors.surface }]
  const positiveColor = theme.colors.tertiary ?? '#16a34a'
  const deleteActionColor = theme.colors.error

  return (
    <View style={screenStyle}>
      <ScrollView
        style={scrollStyle}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Surface mode="flat" style={surfaceStyle}>
          <View style={styles.searchContainer}>
            <Searchbar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="シンボルを検索"
              autoCorrect={false}
              autoCapitalize="characters"
            />
            {searchError ? (
              <HelperText type="error" visible>
                {searchError}
              </HelperText>
            ) : null}
            {hasQuery ? (
              <List.Section style={styles.searchListSection}>
                {isSearching ? (
                  <ActivityIndicator animating color={theme.colors.primary} />
                ) : searchResults.length === 0 ? (
                  <Text variant="bodyMedium" style={styles.searchEmptyText}>
                    該当するシンボルがありません。
                  </Text>
                ) : (
                  searchResults.map((item, index) => {
                    const disabled = existingSymbols.has(item.symbol)
                    return (
                      <Fragment key={item.symbol}>
                        <List.Item
                          title={item.symbol}
                          description={item.name}
                          right={() => (
                            <Button
                              compact
                              mode="text"
                              onPress={() => handleAddSymbol(item)}
                              disabled={disabled}
                              loading={pendingSymbol === item.symbol}
                            >
                              {disabled ? '追加済み' : '追加'}
                            </Button>
                          )}
                        />
                        {index < searchResults.length - 1 && <Divider inset />}
                      </Fragment>
                    )
                  })
                )}
              </List.Section>
            ) : null}
          </View>
        </Surface>

        <Surface mode="flat" style={surfaceStyle}>
          <List.Section style={styles.listSection}>
            {marketEntries.map((entry, index) => {
              const { quote, error } = marketState[entry.id] ?? {}
              const price = quote?.regularMarketPrice
              const change = quote?.regularMarketChange
              const changePercent = quote?.regularMarketChangePercent
              const currency = quote?.currency
              const changeColor =
                change === undefined || change === 0
                  ? theme.colors.onSurface
                  : change > 0
                  ? positiveColor
                  : theme.colors.error
              const isRowLoading = !quote && !error

              const listItem = (
                <List.Item
                  title={entry.label}
                  titleStyle={styles.listTitle}
                  description={quote?.symbol ?? entry.symbol ?? '--'}
                  descriptionStyle={styles.symbol}
                  onPress={entry.symbol ? () => handleNavigateToChart(entry) : undefined}
                  right={() => (
                    <View style={styles.rightContainer}>
                      {isRowLoading ? (
                        <ActivityIndicator animating color={theme.colors.primary} />
                      ) : error ? (
                        <HelperText type="error" visible style={styles.errorText}>
                          {error}
                        </HelperText>
                      ) : (
                        <>
                          <Text variant="titleMedium" style={styles.price}>
                            {formatNumber(price, entry.fractionDigits)}
                            {currency ? ` ${currency}` : ''}
                          </Text>
                          <Text variant="bodyMedium" style={[styles.change, { color: changeColor }]}>
                            {formatChangeText(change, changePercent, entry.fractionDigits)}
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                />
              )

              return (
                <Fragment key={entry.id}>
                  <Swipeable
                    friction={2}
                    rightThreshold={60}
                    renderRightActions={() => (
                      <RectButton
                        style={[styles.deleteAction, { backgroundColor: deleteActionColor }]}
                        onPress={() => {
                          if (entry.symbol) {
                            void handleRemoveSymbol(entry.symbol)
                          }
                        }}
                      >
                        <Text style={styles.deleteActionText}>削除</Text>
                      </RectButton>
                    )}
                  >
                    {listItem}
                  </Swipeable>
                  {index < marketEntries.length - 1 && <Divider inset />}
                </Fragment>
              )
            })}
          </List.Section>
        </Surface>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  sectionSurface: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchContainer: {
    padding: 16,
    gap: 8,
  },
  searchListSection: {
    margin: 0,
    paddingVertical: 0,
  },
  searchEmptyText: {
    textAlign: 'center',
    paddingVertical: 12,
    opacity: 0.7,
  },
  listSection: {
    margin: 0,
    paddingVertical: 0,
  },
  listTitle: {
    fontWeight: '600',
  },
  symbol: {
    opacity: 0.7,
  },
  rightContainer: {
    minWidth: 140,
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    fontWeight: '600',
  },
  change: {
    fontWeight: '500',
  },
  errorText: {
    textAlign: 'right',
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
  },
  deleteActionText: {
    color: '#fff',
    fontWeight: '600',
  },
})
