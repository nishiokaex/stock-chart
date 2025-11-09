import axios from 'axios';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, HelperText, List, Searchbar, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppHeader } from '@/components/app-header';
import { InteractiveCandleChart } from '@/components/charts';
import { buildApiUrl } from '@/lib/api/base';
import type { ChartStyleConfig } from '@/lib/charts/style';
import { fetchStockCandleData } from '@/lib/charts/stock-data';
import type { Candle, TrendDefinition } from '@/lib/charts/types';
import type { SymbolSearchItem, SymbolSearchResponse } from '@/types/symbol';

const DEFAULT_SYMBOL = 'AAPL';
const SEARCH_DEBOUNCE_MS = 300;
const INITIAL_VISIBLE_CANDLE_COUNT = 180;
const toParamValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trendDefinitions, setTrendDefinitions] = useState<TrendDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SymbolSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { symbol: symbolParam, label: labelParam } = useLocalSearchParams<{
    symbol?: string | string[];
    label?: string | string[];
  }>();

  const selectedSymbol = useMemo(() => {
    const raw = toParamValue(symbolParam)?.trim();
    return raw && raw.length > 0 ? raw : DEFAULT_SYMBOL;
  }, [symbolParam]);

  const selectedLabel = useMemo(() => {
    const raw = toParamValue(labelParam)?.trim();
    return raw && raw.length > 0 ? raw : undefined;
  }, [labelParam]);

  const displayTitle = selectedLabel ?? selectedSymbol;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCandles([]);
    setTrendDefinitions([]);

    const load = async () => {
      try {
        const data = await fetchStockCandleData(selectedSymbol);
        if (!cancelled) {
          setCandles(data.candles);
          setTrendDefinitions(data.trendDefinitions);
          setError(null);
        }
      } catch (err) {
        console.error('[chart] failed to load candles', err);
        if (!cancelled) {
          setCandles([]);
          setTrendDefinitions([]);
          setError(`${selectedSymbol} のデータの取得に失敗しました。`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  const performSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const { data } = await axios.get<SymbolSearchResponse>(
        buildApiUrl(`/api/symbol?q=${encodeURIComponent(trimmed)}&per_page=10`),
      );
      setSearchResults(data.items ?? []);
    } catch (err) {
      console.error('[chart] シンボル検索に失敗しました', err);
      setSearchResults([]);
      setSearchError('検索に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      void performSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [performSearch, searchQuery]);

  const handleSelectSymbol = useCallback(
    (item: SymbolSearchItem) => {
      router.setParams({
        symbol: item.symbol,
        label: item.name || item.symbol,
      });
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
    },
    [router],
  );

  const latestCandle = useMemo(() => (candles.length > 0 ? candles[candles.length - 1] : undefined), [candles]);
  const chartStyle = useMemo<ChartStyleConfig>(
    () => ({
      priceGainColor: '#00C853',
      priceLossColor: '#FF1744',
      volumeColor: theme.colors.primary,
      selectionHighlightColor: `${theme.colors.primary}55`,
      overlayBackgroundColor: theme.colors.surfaceVariant,
    }),
    [theme.colors.primary, theme.colors.surfaceVariant],
  );

  const screenStyle = [styles.screen, { backgroundColor: theme.colors.background }];
  const contentStyle = [styles.content, { backgroundColor: theme.colors.background }];
  const hasQuery = Boolean(searchQuery.trim());

  return (
    <View style={screenStyle}>
      <AppHeader title="チャート" />
      <View style={contentStyle}>
        <Text variant="headlineMedium" style={styles.title}>
          {displayTitle} 株価チャート
        </Text>
        <Text variant="titleMedium" style={[styles.subtitle, styles.subtitleText]}>
          銘柄コード: {selectedSymbol} / 終値 {latestCandle?.close?.toFixed(2) ?? '--'} USD（{formatDate(latestCandle?.timestamp)}）
        </Text>
        <View style={styles.searchContainer}>
          <Searchbar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="シンボルを検索"
            autoCorrect={false}
            autoCapitalize="characters"
          />
          {searchError ? (
            <HelperText type="error" visible style={styles.searchErrorText}>
              {searchError}
            </HelperText>
          ) : null}
          {hasQuery ? (
            <Card mode="outlined" style={styles.searchResultsCard}>
              {isSearching ? (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : searchResults.length === 0 ? (
                <Text variant="bodyMedium" style={styles.searchEmptyText}>
                  該当するシンボルがありません。
                </Text>
              ) : (
                <List.Section>
                  {searchResults.map((item, index) => (
                    <Fragment key={item.symbol}>
                      <List.Item
                        title={item.symbol}
                        description={item.name}
                        onPress={() => handleSelectSymbol(item)}
                        right={() => <List.Icon icon="chart-line" />}
                      />
                      {index < searchResults.length - 1 ? <View style={styles.searchDivider} /> : null}
                    </Fragment>
                  ))}
                </List.Section>
              )}
            </Card>
          ) : null}
        </View>
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
                initialVisibleCandleCount={INITIAL_VISIBLE_CANDLE_COUNT}
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
  searchContainer: {
    width: '100%',
    gap: 8,
  },
  searchResultsCard: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  searchLoadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmptyText: {
    textAlign: 'center',
    paddingVertical: 12,
    opacity: 0.7,
  },
  searchDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
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
  searchErrorText: {
    marginTop: -4,
  },
  errorMessage: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
