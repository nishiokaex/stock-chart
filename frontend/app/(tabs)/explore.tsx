import axios from 'axios';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, Chip, HelperText, List, Searchbar, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppHeader } from '@/components/app-header';
import { IndicatorMiniChart, InteractiveCandleChart } from '@/components/charts';
import type { IndicatorReferenceLine } from '@/components/charts';
import { buildApiUrl } from '@/lib/api/base';
import type { ChartStyleConfig } from '@/lib/charts/style';
import { fetchStockCandleData } from '@/lib/charts/stock-data';
import type { IndicatorSeries } from '@/lib/charts/stock-data';
import type { Candle, TrendDefinition } from '@/lib/charts/types';
import type { SymbolSearchItem, SymbolSearchResponse } from '@/types/symbol';

const DEFAULT_SYMBOL = 'AAPL';
const SEARCH_DEBOUNCE_MS = 300;
const INITIAL_VISIBLE_CANDLE_COUNT = 180;
const toParamValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

type IndicatorToggleKey = 'movingAverage' | 'rsi' | 'macd';

const INDICATOR_TOGGLES: { key: IndicatorToggleKey; label: string }[] = [
  { key: 'movingAverage', label: '移動平均線' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
];

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [baseCandles, setBaseCandles] = useState<Candle[]>([]);
  const [indicatorSeries, setIndicatorSeries] = useState<IndicatorSeries[]>([]);
  const [indicatorVisibility, setIndicatorVisibility] = useState<Record<IndicatorToggleKey, boolean>>({
    movingAverage: true,
    rsi: false,
    macd: false,
  });
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
    setBaseCandles([]);
    setIndicatorSeries([]);

    const load = async () => {
      try {
        const data = await fetchStockCandleData(selectedSymbol);
        if (!cancelled) {
          setBaseCandles(data.candles);
          setIndicatorSeries(data.indicators);
          setError(null);
        }
      } catch (err) {
        console.error('[chart] failed to load candles', err);
        if (!cancelled) {
          setBaseCandles([]);
          setIndicatorSeries([]);
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

  const movingAverageSeries = useMemo(
    () => indicatorSeries.filter((item) => item.group === 'movingAverage'),
    [indicatorSeries],
  );
  const rsiSeries = useMemo(
    () => indicatorSeries.filter((item) => item.group === 'rsi'),
    [indicatorSeries],
  );
  const macdSeries = useMemo(
    () => indicatorSeries.filter((item) => item.group === 'macd'),
    [indicatorSeries],
  );

  const chartData = useMemo(() => {
    if (!indicatorVisibility.movingAverage || movingAverageSeries.length === 0) {
      return { candles: baseCandles, trendDefinitions: [] as TrendDefinition[] };
    }
    return mergeCandlesWithIndicators(baseCandles, movingAverageSeries);
  }, [baseCandles, indicatorVisibility.movingAverage, movingAverageSeries]);

  const chartCandles = chartData.candles;
  const trendDefinitions = chartData.trendDefinitions;

  const hasIndicatorData = useCallback(
    (key: IndicatorToggleKey) => indicatorSeries.some((item) => item.group === key),
    [indicatorSeries],
  );

  const toggleIndicatorVisibility = useCallback((key: IndicatorToggleKey) => {
    setIndicatorVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

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

  const latestCandle = useMemo(
    () => (baseCandles.length > 0 ? baseCandles[baseCandles.length - 1] : undefined),
    [baseCandles],
  );
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

  const indicatorColorMap = useMemo(
    () => ({
      ma7: theme.colors.primary,
      ma25: theme.colors.secondary,
      rsi14: theme.colors.tertiary ?? theme.colors.primary,
      macd: theme.colors.primary,
      macdSignal: theme.colors.secondary,
    }),
    [theme.colors.primary, theme.colors.secondary, theme.colors.tertiary],
  );

  const fallbackIndicatorColor = useMemo(
    () => theme.colors.onSurfaceVariant ?? theme.colors.primary,
    [theme.colors.onSurfaceVariant, theme.colors.primary],
  );

  const getIndicatorColor = useCallback(
    (id: string) => indicatorColorMap[id] ?? fallbackIndicatorColor,
    [indicatorColorMap, fallbackIndicatorColor],
  );

  const rsiReferenceLines = useMemo<IndicatorReferenceLine[]>(
    () => [
      { id: 'rsi-overbought', value: 70, color: theme.colors.error, dashArray: '6 4', opacity: 0.7 },
      {
        id: 'rsi-oversold',
        value: 30,
        color: theme.colors.tertiary ?? theme.colors.secondary,
        dashArray: '6 4',
        opacity: 0.7,
      },
    ],
    [theme.colors.error, theme.colors.secondary, theme.colors.tertiary],
  );

  const macdReferenceLines = useMemo<IndicatorReferenceLine[]>(
    () => [
      {
        id: 'macd-zero',
        value: 0,
        color: theme.colors.outline ?? theme.colors.onSurfaceVariant,
        dashArray: '4 4',
        opacity: 0.5,
      },
    ],
    [theme.colors.onSurfaceVariant, theme.colors.outline],
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
              <>
                <View style={styles.indicatorToggleRow}>
                  {INDICATOR_TOGGLES.map((item) => (
                    <Chip
                      key={item.key}
                      icon={indicatorVisibility[item.key] ? 'eye' : 'eye-off'}
                      selected={indicatorVisibility[item.key]}
                      onPress={() => toggleIndicatorVisibility(item.key)}
                      disabled={!hasIndicatorData(item.key)}
                      style={styles.indicatorToggleChip}
                      compact
                      mode="outlined"
                    >
                      {item.label}
                    </Chip>
                  ))}
                </View>
                <InteractiveCandleChart
                  candles={chartCandles}
                  trendDefinitions={trendDefinitions}
                  initialVisibleCandleCount={INITIAL_VISIBLE_CANDLE_COUNT}
                  styleConfig={chartStyle}
                  style={styles.chart}
                />
              </>
            )}
          </Card.Content>
        </Card>
        {indicatorVisibility.rsi && rsiSeries.length > 0 ? (
          <IndicatorDetailCard
            title="RSI (14)"
            series={rsiSeries}
            colorForId={getIndicatorColor}
            referenceLines={rsiReferenceLines}
            fixedRange={{ min: 0, max: 100 }}
            formatValue={(value) => formatIndicatorValue(value, 2)}
          />
        ) : null}
        {indicatorVisibility.macd && macdSeries.length > 0 ? (
          <IndicatorDetailCard
            title="MACD (12,26,9)"
            series={macdSeries}
            colorForId={getIndicatorColor}
            referenceLines={macdReferenceLines}
            formatValue={(value) => formatIndicatorValue(value, 3)}
          />
        ) : null}
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

type IndicatorColorResolver = (id: string) => string;

interface IndicatorDetailCardProps {
  title: string;
  series: IndicatorSeries[];
  colorForId: IndicatorColorResolver;
  referenceLines?: IndicatorReferenceLine[];
  fixedRange?: { min?: number; max?: number };
  formatValue?: (value: number | null) => string;
}

const IndicatorDetailCard = ({
  title,
  series,
  colorForId,
  referenceLines,
  fixedRange,
  formatValue = (value) => formatIndicatorValue(value, 2),
}: IndicatorDetailCardProps) => {
  const chartSeries = useMemo(
    () =>
      series.map((indicator) => ({
        id: indicator.id,
        color: colorForId(indicator.id),
        values: indicator.values,
      })),
    [colorForId, series],
  );

  const legendItems = useMemo(
    () =>
      series.map((indicator) => ({
        id: indicator.id,
        label: indicator.label ?? indicator.id,
        color: colorForId(indicator.id),
        value: getLatestValue(indicator.values),
      })),
    [colorForId, series],
  );

  if (chartSeries.length === 0) {
    return null;
  }

  return (
    <Card mode="outlined" style={styles.indicatorCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.indicatorTitle}>
          {title}
        </Text>
        <IndicatorMiniChart
          series={chartSeries}
          referenceLines={referenceLines}
          min={fixedRange?.min}
          max={fixedRange?.max}
          style={styles.indicatorChart}
        />
        <View style={styles.indicatorLegend}>
          {legendItems.map((item) => (
            <View key={item.id} style={styles.indicatorLegendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
              <Text variant="labelSmall" style={styles.indicatorLegendText}>
                {item.label}: {formatValue(item.value)}
              </Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
};

function mergeCandlesWithIndicators(
  candles: Candle[],
  indicators: IndicatorSeries[],
): { candles: Candle[]; trendDefinitions: TrendDefinition[] } {
  if (candles.length === 0 || indicators.length === 0) {
    return { candles, trendDefinitions: [] };
  }

  const trendDefinitions: TrendDefinition[] = indicators.map((indicator) => ({
    id: indicator.id,
    label: indicator.label,
  }));

  const mergedCandles = candles.map((candle, candleIndex) => ({
    ...candle,
    trends: indicators.map((indicator) => indicator.values[candleIndex] ?? null),
  }));

  return {
    candles: mergedCandles,
    trendDefinitions,
  };
}

function getLatestValue(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (value != null && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function formatIndicatorValue(value: number | null, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return value.toFixed(fractionDigits);
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
  indicatorToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  indicatorToggleChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  indicatorCard: {
    borderRadius: 16,
  },
  indicatorTitle: {
    fontWeight: '700',
  },
  indicatorChart: {
    width: '100%',
    marginTop: 12,
    marginBottom: 12,
  },
  indicatorLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  indicatorLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  indicatorLegendText: {
    fontWeight: '600',
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
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
