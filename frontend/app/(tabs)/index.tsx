import axios from 'axios'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'

import { AppHeader } from '@/components/app-header'
import {
  ActivityIndicator,
  Divider,
  HelperText,
  List,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper'
import { buildApiUrl } from '@/lib/api/base'
import type { MarketQuote } from '@/types/market'

type MarketKey = 'nikkei' | 'topix' | 'usdjpy'

type MarketConfig = {
  label: string
  path: string
  fractionDigits: number
}

type MarketState = Record<MarketKey, { quote?: MarketQuote; error?: string }>

const MARKET_CONFIG: Record<MarketKey, MarketConfig> = {
  nikkei: { label: '日経平均', path: '/api/nikkei', fractionDigits: 2 },
  topix: { label: 'TOPIX', path: '/api/topix', fractionDigits: 2 },
  usdjpy: { label: 'ドル円', path: '/api/usdjpy', fractionDigits: 3 },
}

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
  const theme = useTheme()
  const [marketState, setMarketState] = useState<MarketState>({
    nikkei: {},
    topix: {},
    usdjpy: {},
  })
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  const fetchMarketData = useCallback(async () => {
    const entries = Object.entries(MARKET_CONFIG) as [MarketKey, MarketConfig][]
    const settled = await Promise.allSettled(
      entries.map(async ([key, config]) => {
        const { data } = await axios.get<MarketQuote>(buildApiUrl(config.path))
        const json = data
        if (!json || typeof json !== 'object') {
          throw new Error('不正なレスポンスです。')
        }
        return [key, json] as const
      }),
    )

    const nextState: MarketState = {
      nikkei: {},
      topix: {},
      usdjpy: {},
    }

    settled.forEach((result, index) => {
      const [key] = entries[index]
      if (result.status === 'fulfilled') {
        nextState[key] = { quote: result.value[1] }
      } else {
        const reason = result.reason
        console.error(`[market] ${key} の取得に失敗しました`, reason)
        nextState[key] = {
          error: 'データの取得に失敗しました。',
        }
      }
    })

    setMarketState(nextState)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        await fetchMarketData()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchMarketData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchMarketData()
    } finally {
      setRefreshing(false)
    }
  }, [fetchMarketData])

  const isInitialLoading = loading && !refreshing
  const marketEntries = useMemo(
    () => Object.entries(MARKET_CONFIG) as [MarketKey, MarketConfig][],
    [],
  )

  const screenStyle = [styles.screen, { backgroundColor: theme.colors.background }]
  const scrollStyle = [styles.scroll, { backgroundColor: theme.colors.background }]
  const surfaceStyle = [styles.sectionSurface, { backgroundColor: theme.colors.surface }]
  const positiveColor = theme.colors.tertiary ?? '#16a34a'

  return (
    <View style={screenStyle}>
      <AppHeader title="マーケット" />
      <ScrollView
        style={scrollStyle}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Surface mode="flat" style={surfaceStyle}>
          <List.Section style={styles.listSection}>
            {marketEntries.map(([key, config], index) => {
              const { quote, error } = marketState[key]
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

              return (
                <Fragment key={key}>
                  <List.Item
                    title={config.label}
                    titleStyle={styles.listTitle}
                    description={quote?.symbol ?? '--'}
                    descriptionStyle={styles.symbol}
                    right={() => (
                      <View style={styles.rightContainer}>
                        {isInitialLoading ? (
                          <ActivityIndicator animating color={theme.colors.primary} />
                        ) : error ? (
                          <HelperText type="error" visible style={styles.errorText}>
                            {error}
                          </HelperText>
                        ) : (
                          <>
                            <Text variant="titleMedium" style={styles.price}>
                              {formatNumber(price, config.fractionDigits)}
                              {currency ? ` ${currency}` : ''}
                            </Text>
                            <Text variant="bodyMedium" style={[styles.change, { color: changeColor }]}>
                              {formatChangeText(change, changePercent, config.fractionDigits)}
                            </Text>
                          </>
                        )}
                      </View>
                    )}
                  />
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
})
