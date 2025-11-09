import axios from 'axios';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Card, Chip, HelperText, IconButton, List, Searchbar, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';

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
const MAX_COMPARISON_SYMBOLS = 4;
const COMPARISON_COLORS = ['#FFB74D', '#4FC3F7', '#9575CD', '#FF8A65', '#81C784'];
const toParamValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

type IndicatorToggleKey = 'movingAverage' | 'rsi' | 'macd';

const INDICATOR_TOGGLES: { key: IndicatorToggleKey; label: string }[] = [
  { key: 'movingAverage', label: '移動平均線' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
];

interface ComparisonSymbolEntry {
  symbol: string;
  label: string;
  color: string;
  candles: Candle[];
  loading: boolean;
  error: string | null;
}

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [baseCandles, setBaseCandles] = useState<Candle[]>([]);
  const [indicatorSeries, setIndicatorSeries] = useState<IndicatorSeries[]>([]);
  const [comparisonSymbols, setComparisonSymbols] = useState<ComparisonSymbolEntry[]>([]);
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
  const [comparisonMessage, setComparisonMessage] = useState<string | null>(null);
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

  useEffect(() => {
    setComparisonSymbols((prev) => prev.filter((entry) => entry.symbol !== selectedSymbol));
  }, [selectedSymbol]);

  useEffect(() => {
    if (!comparisonMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setComparisonMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [comparisonMessage]);

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

  const fetchComparisonCandles = useCallback(async (symbol: string) => {
    setComparisonSymbols((prev) =>
      prev.map((entry) =>
        entry.symbol === symbol
          ? {
              ...entry,
              loading: true,
              error: null,
            }
          : entry,
      ),
    );

    try {
      const data = await fetchStockCandleData(symbol);
      setComparisonSymbols((prev) =>
        prev.map((entry) =>
          entry.symbol === symbol
            ? {
                ...entry,
                candles: data.candles,
                loading: false,
                error: null,
              }
            : entry,
        ),
      );
    } catch (err) {
      console.error('[comparison] failed to load candles', err);
      setComparisonSymbols((prev) =>
        prev.map((entry) =>
          entry.symbol === symbol
            ? {
                ...entry,
                candles: [],
                loading: false,
                error: `${symbol} のデータの取得に失敗しました。`,
              }
            : entry,
        ),
      );
    }
  }, []);

  const handleAddComparisonSymbol = useCallback(
    (item: SymbolSearchItem) => {
      const symbol = item.symbol?.trim();
      if (!symbol) {
        return;
      }
      if (symbol === selectedSymbol) {
        setComparisonMessage('表示中の銘柄は比較に追加できません。');
        return;
      }
      if (comparisonSymbols.some((entry) => entry.symbol === symbol)) {
        setComparisonMessage('すでに比較に追加されています。');
        return;
      }
      if (comparisonSymbols.length >= MAX_COMPARISON_SYMBOLS) {
        setComparisonMessage(`比較は最大 ${MAX_COMPARISON_SYMBOLS} 銘柄までです。`);
        return;
      }
      const label = item.name?.trim();
      const nextEntry: ComparisonSymbolEntry = {
        symbol,
        label: label && label.length > 0 ? label : symbol,
        color: pickComparisonColor(comparisonSymbols),
        candles: [],
        loading: true,
        error: null,
      };
      setComparisonSymbols((prev) => [...prev, nextEntry]);
      void fetchComparisonCandles(symbol);
      setComparisonMessage('比較銘柄を追加しました。');
    },
    [comparisonSymbols, fetchComparisonCandles, selectedSymbol],
  );

  const handleRemoveComparisonSymbol = useCallback((symbol: string) => {
    setComparisonSymbols((prev) => prev.filter((entry) => entry.symbol !== symbol));
  }, []);

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

  const movingAverageChartSeries = useMemo(
    () =>
      movingAverageSeries.map((series) => ({
        ...series,
        color: getIndicatorColor(series.id),
      })),
    [getIndicatorColor, movingAverageSeries],
  );

  const comparisonIndicatorSeries = useMemo(() => {
    if (baseCandles.length === 0) {
      return [] as IndicatorSeries[];
    }
    return comparisonSymbols
      .filter((entry) => entry.candles.length > 0)
      .map((entry) => ({
        id: `comparison-${entry.symbol}`,
        label: entry.label,
        group: 'comparison' as const,
        values: alignCandlesByTimestamp(baseCandles, entry.candles),
        color: entry.color,
      }));
  }, [baseCandles, comparisonSymbols]);

  const overlayTrendSeries = useMemo(
    () => [
      ...(indicatorVisibility.movingAverage ? movingAverageChartSeries : []),
      ...comparisonIndicatorSeries,
    ],
    [indicatorVisibility.movingAverage, movingAverageChartSeries, comparisonIndicatorSeries],
  );

  const chartData = useMemo(
    () => mergeCandlesWithIndicators(baseCandles, overlayTrendSeries),
    [baseCandles, overlayTrendSeries],
  );

  const chartCandles = chartData.candles;
  const trendDefinitions = chartData.trendDefinitions;

  const trendLineStyles = useMemo(
    () =>
      overlayTrendSeries.map((series) => ({
        stroke: series.color ?? theme.colors.tertiary ?? theme.colors.primary,
        strokeWidth: 2,
      })),
    [overlayTrendSeries, theme.colors.primary, theme.colors.tertiary],
  );

  const chartStyle = useMemo<ChartStyleConfig>(
    () => ({
      priceGainColor: '#00C853',
      priceLossColor: '#FF1744',
      volumeColor: theme.colors.primary,
      selectionHighlightColor: `${theme.colors.primary}55`,
      overlayBackgroundColor: theme.colors.surfaceVariant,
      trendLineStyles,
    }),
    [theme.colors.primary, theme.colors.surfaceVariant, trendLineStyles],
  );

  const candleIndexLookup = useMemo(() => {
    const map = new Map<number, number>();
    baseCandles.forEach((candle, index) => {
      map.set(candle.timestamp, index);
    });
    return map;
  }, [baseCandles]);

  const overlayFormatter = useCallback(
    (candle: Candle) => {
      const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const formatted: Record<string, string> = {
        日付: dateFormatter.format(new Date(candle.timestamp)),
        始値: candle.open != null ? candle.open.toFixed(2) : '--',
        高値: candle.high != null ? candle.high.toFixed(2) : '--',
        安値: candle.low != null ? candle.low.toFixed(2) : '--',
        終値: candle.close != null ? candle.close.toFixed(2) : '--',
        出来高: candle.volume != null ? formatVolumeLabel(candle.volume) : '--',
      };
      const index = candleIndexLookup.get(candle.timestamp);
      if (index != null) {
        comparisonIndicatorSeries.forEach((series) => {
          formatted[series.label ?? series.id] = formatComparisonValue(series.values[index]);
        });
      }
      return formatted;
    },
    [candleIndexLookup, comparisonIndicatorSeries],
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
      <View style={contentStyle}>
        <Text variant="headlineMedium" style={styles.title}>
          {displayTitle} 株価チャート
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
          {comparisonMessage ? (
            <HelperText type="info" visible style={styles.comparisonMessage}>
              {comparisonMessage}
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
                        right={() => (
                          <View style={styles.searchActionContainer}>
                            <IconButton
                              icon="plus-circle-outline"
                              size={22}
                              disabled={comparisonSymbols.length >= MAX_COMPARISON_SYMBOLS}
                              onPress={() => handleAddComparisonSymbol(item)}
                              accessibilityLabel={`${item.symbol} を比較に追加`}
                            />
                          </View>
                        )}
                      />
                      {index < searchResults.length - 1 ? <View style={styles.searchDivider} /> : null}
                    </Fragment>
                  ))}
                </List.Section>
              )}
            </Card>
          ) : null}
        </View>
        <Card mode="outlined" style={styles.comparisonCard}>
          <Card.Content style={styles.comparisonContent}>
            <View style={styles.comparisonHeader}>
              <Text variant="titleMedium" style={styles.subtitleText}>
                比較銘柄
              </Text>
              <Text variant="bodySmall" style={styles.comparisonHint}>
                最大 {MAX_COMPARISON_SYMBOLS} 銘柄
              </Text>
            </View>
            {comparisonSymbols.length === 0 ? (
              <Text style={styles.comparisonEmptyText}>
                検索結果の「＋」ボタンから比較銘柄を追加してください。
              </Text>
            ) : (
              <View style={styles.comparisonList}>
                {comparisonSymbols.map((entry) => (
                  <View key={entry.symbol} style={styles.comparisonListItem}>
                    <View style={[styles.legendSwatch, styles.comparisonSwatch, { backgroundColor: entry.color }]} />
                    <View style={styles.comparisonTextContainer}>
                      <Text variant="labelLarge" style={styles.comparisonText}>
                        {entry.label} ({entry.symbol})
                      </Text>
                      {entry.loading ? (
                        <View style={styles.comparisonStatusRow}>
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                          <Text style={styles.comparisonStatusText}>読み込み中...</Text>
                        </View>
                      ) : entry.error ? (
                        <Text style={[styles.comparisonStatusText, { color: theme.colors.error }]}>
                          {entry.error}
                        </Text>
                      ) : (
                        <Text style={styles.comparisonStatusText}>データ取得済み</Text>
                      )}
                    </View>
                    <IconButton
                      icon="close"
                      onPress={() => handleRemoveComparisonSymbol(entry.symbol)}
                      accessibilityLabel={`${entry.symbol} を比較から削除`}
                    />
                  </View>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
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
                  overlayFormatter={overlayFormatter}
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

function pickComparisonColor(existing: ComparisonSymbolEntry[]): string {
  for (const color of COMPARISON_COLORS) {
    if (!existing.some((entry) => entry.color === color)) {
      return color;
    }
  }
  return COMPARISON_COLORS[existing.length % COMPARISON_COLORS.length];
}

function alignCandlesByTimestamp(base: Candle[], overlay: Candle[]): (number | null)[] {
  if (base.length === 0) {
    return [];
  }
  if (overlay.length === 0) {
    return base.map(() => null);
  }
  const map = new Map<number, Candle>();
  overlay.forEach((candle) => {
    map.set(candle.timestamp, candle);
  });
  return base.map((candle) => {
    const target = map.get(candle.timestamp);
    if (!target || target.close == null || Number.isNaN(target.close)) {
      return null;
    }
    return target.close;
  });
}

function formatComparisonValue(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return value.toFixed(2);
}

function formatVolumeLabel(volume: number): string {
  if (!Number.isFinite(volume)) {
    return '--';
  }
  if (volume < 1000) {
    return volume.toFixed(0);
  }
  const suffixes = [
    { divider: 1e12, suffix: 'T' },
    { divider: 1e9, suffix: 'B' },
    { divider: 1e6, suffix: 'M' },
    { divider: 1e3, suffix: 'K' },
  ];
  for (const { divider, suffix } of suffixes) {
    if (volume >= divider) {
      return `${(volume / divider).toFixed(1)}${suffix}`;
    }
  }
  return volume.toFixed(0);
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
  searchActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  comparisonCard: {
    borderRadius: 16,
  },
  comparisonContent: {
    gap: 8,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonHint: {
    opacity: 0.7,
  },
  comparisonEmptyText: {
    opacity: 0.7,
  },
  comparisonList: {
    gap: 12,
  },
  comparisonListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  comparisonTextContainer: {
    flex: 1,
    gap: 4,
  },
  comparisonText: {
    fontWeight: '700',
  },
  comparisonStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comparisonStatusText: {
    fontSize: 12,
    opacity: 0.8,
  },
  comparisonSwatch: {
    width: 14,
    height: 14,
    marginTop: 4,
  },
  comparisonMessage: {
    marginTop: -4,
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
