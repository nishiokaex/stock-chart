import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, HelperText, Text, useTheme } from 'react-native-paper';

import { AppHeader } from '@/components/app-header';
import { InteractiveCandleChart } from '@/components/charts';
import type { ChartStyleConfig } from '@/lib/charts/style';
import { fetchStockCandleData } from '@/lib/charts/stock-data';
import type { Candle, TrendDefinition } from '@/lib/charts/types';

export default function ExploreScreen() {
  const theme = useTheme();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trendDefinitions, setTrendDefinitions] = useState<TrendDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchStockCandleData('AAPL');
        if (!cancelled) {
          setCandles(data.candles);
          setTrendDefinitions(data.trendDefinitions);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setCandles([]);
          setTrendDefinitions([]);
          setError('データの取得に失敗しました。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestCandle = useMemo(() => (candles.length > 0 ? candles[candles.length - 1] : undefined), [candles]);
  const chartStyle = useMemo<ChartStyleConfig>(
    () => ({
      priceGainColor: theme.colors.secondary,
      priceLossColor: theme.colors.error,
      volumeColor: theme.colors.primary,
      selectionHighlightColor: `${theme.colors.primary}55`,
      overlayBackgroundColor: theme.colors.surfaceVariant,
    }),
    [theme.colors.error, theme.colors.primary, theme.colors.secondary, theme.colors.surfaceVariant],
  );

  const screenStyle = [styles.screen, { backgroundColor: theme.colors.background }];
  const contentStyle = [styles.content, { backgroundColor: theme.colors.background }];

  return (
    <View style={screenStyle}>
      <AppHeader title="チャート" />
      <View style={contentStyle}>
        <Text variant="headlineMedium" style={styles.title}>
          AAPL 株価チャート
        </Text>
        <Text variant="titleMedium" style={[styles.subtitle, styles.subtitleText]}>
          終値 {latestCandle?.close?.toFixed(2) ?? '--'} USD（{formatDate(latestCandle?.timestamp)}）
        </Text>
        {error ? (
          <HelperText type="error" visible style={styles.errorText}>
            {error}
          </HelperText>
        ) : null}
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : error ? (
              <View style={styles.loadingContainer}>
                <Text variant="bodyLarge" style={styles.errorMessage}>
                  データがありません
                </Text>
              </View>
            ) : (
              <InteractiveCandleChart
                candles={candles}
                trendDefinitions={trendDefinitions}
                styleConfig={chartStyle}
                style={styles.chart}
              />
            )}
          </Card.Content>
        </Card>
      </View>
    </View>
  );
}

function formatDate(timestamp?: number) {
  if (!timestamp) {
    return 'N/A';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginBottom: 8,
  },
  subtitleText: {
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    flex: 1,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  chart: {
    flex: 1,
    minHeight: 360,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginVertical: -4,
    paddingHorizontal: 0,
  },
  errorMessage: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
