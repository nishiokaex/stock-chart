import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'

import { ListItem, type MarketQuote } from '@/components/list-item'
import { Text, useTheme } from 'react-native-paper'

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

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8787').replace(
  /\/$/,
  '',
)

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
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
        const response = await fetch(buildUrl(config.path))
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const json = (await response.json()) as MarketQuote
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

  const containerStyle = [styles.container, { backgroundColor: theme.colors.background }]

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={containerStyle}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            マーケット
          </Text>
        </View>
        <View style={styles.listContainer}>
          {marketEntries.map(([key, config]) => (
            <ListItem
              key={key}
              title={config.label}
              quote={marketState[key].quote}
              error={marketState[key].error}
              loading={isInitialLoading}
              fractionDigits={config.fractionDigits}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  container: {
    flex: 1,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  listContainer: {
    gap: 12,
  },
})
