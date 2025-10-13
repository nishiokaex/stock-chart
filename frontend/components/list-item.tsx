import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { Colors } from '@/constants/theme'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useColorScheme } from '@/hooks/use-color-scheme'

export type MarketQuote = {
  symbol: string
  shortName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketTime?: number
  currency?: string
}

type ListItemProps = {
  title: string
  quote?: MarketQuote
  loading?: boolean
  error?: string
  fractionDigits?: number
}

export function ListItem({ title, quote, loading, error, fractionDigits = 2 }: ListItemProps) {
  const colorScheme = useColorScheme()
  const price = quote?.regularMarketPrice
  const change = quote?.regularMarketChange
  const changePercent = quote?.regularMarketChangePercent
  const currency = quote?.currency
  const changeColor =
    change === undefined || change === 0
      ? Colors[colorScheme ?? 'light'].text
      : change > 0
        ? '#16a34a'
        : '#dc2626'

  const formatNumber = (value: number | undefined) => {
    if (value === undefined || Number.isNaN(value)) {
      return '--'
    }
    return value.toLocaleString('ja-JP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    })
  }

  const formatChangeText = () => {
    if (change === undefined || changePercent === undefined) {
      return '--'
    }
    const sign = change > 0 ? '+' : change < 0 ? '-' : ''
    const formattedChange = formatNumber(Math.abs(change))
    const formattedPercent = Math.abs(changePercent).toFixed(2)
    return `${sign}${formattedChange} (${sign}${formattedPercent}%)`
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.leftContainer}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText style={styles.symbol}>{quote?.symbol ?? '--'}</ThemedText>
        {quote?.shortName ? <ThemedText style={styles.shortName}>{quote.shortName}</ThemedText> : null}
      </View>
      <View style={styles.rightContainer}>
        {loading ? (
          <ActivityIndicator color={Colors[colorScheme ?? 'light'].tint} />
        ) : error ? (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        ) : (
          <>
            <ThemedText style={styles.price}>
              {formatNumber(price)}
              {currency ? ` ${currency}` : ''}
            </ThemedText>
            <ThemedText style={[styles.change, { color: changeColor }]}>{formatChangeText()}</ThemedText>
          </>
        )}
      </View>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  leftContainer: {
    flex: 1,
    marginRight: 12,
  },
  rightContainer: {
    alignItems: 'flex-end',
    minWidth: 120,
    gap: 4,
  },
  symbol: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.7,
  },
  shortName: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0.7,
  },
  price: {
    fontSize: 20,
    fontWeight: '600',
  },
  change: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
})
