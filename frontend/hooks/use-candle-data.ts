import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Candle, TrendDefinition } from "../lib/charts/types";

interface ApiCandle {
  t: number;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  v: number | null;
  trends?: (number | null)[];
}

interface ApiResponse {
  symbol: string;
  candles: ApiCandle[];
  indicators?: Record<string, (number | null)[]>;
}

export interface LocalIndicator {
  id: string;
  label?: string;
  compute: (candles: Candle[]) => (number | null)[];
}

export interface UseCandleDataOptions {
  symbol?: string;
  interval?: string;
  range?: string;
  enabled?: boolean;
  pollIntervalMs?: number;
  endpoint?: string;
  localIndicators?: LocalIndicator[];
}

export interface UseCandleDataResult {
  candles: Candle[];
  trendDefinitions: TrendDefinition[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const DEFAULT_ENDPOINT = "/api/candles";

export function useCandleData({
  symbol,
  interval = "1d",
  range = "1y",
  enabled = true,
  pollIntervalMs,
  endpoint = DEFAULT_ENDPOINT,
  localIndicators,
}: UseCandleDataOptions): UseCandleDataResult {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trendDefinitions, setTrendDefinitions] = useState<TrendDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const mapPayload = useCallback(
    (payload: ApiResponse) => {
      const apiCandles = payload.candles ?? [];
      const indicatorEntries = Object.entries(payload.indicators ?? {});
      const definitions: TrendDefinition[] = indicatorEntries.map(([id]) => ({
        id,
      }));
      const indicatorValues = indicatorEntries.map(([, values]) => values);

      const mappedCandles: Candle[] = apiCandles.map((candle, index) => {
        const trends = indicatorValues.length
          ? indicatorValues.map((values) => values?.[index] ?? null)
          : undefined;
        return {
          timestamp: candle.t,
          open: normalizeNumber(candle.o),
          high: normalizeNumber(candle.h),
          low: normalizeNumber(candle.l),
          close: normalizeNumber(candle.c),
          volume: normalizeNumber(candle.v),
          trends,
        };
      });

      return { candles: mappedCandles, definitions };
    },
    [],
  );

  const applyLocalIndicators = useCallback(
    (baseCandles: Candle[], baseDefinitions: TrendDefinition[]) => {
      if (!localIndicators?.length) {
        return { candles: baseCandles, definitions: baseDefinitions };
      }
      const nextDefinitions = [...baseDefinitions];
      const extendedCandles = baseCandles.map((candle) => ({
        ...candle,
        trends: candle.trends ? [...candle.trends] : [],
      }));

      localIndicators.forEach((indicator) => {
        try {
          const values = indicator.compute(baseCandles);
          nextDefinitions.push({
            id: indicator.id,
            label: indicator.label,
          });
          extendedCandles.forEach((candle, idx) => {
            if (!candle.trends) {
              candle.trends = [];
            }
            candle.trends.push(values[idx] ?? null);
          });
        } catch (indicatorError) {
          console.warn(`Failed to compute indicator "${indicator.id}":`, indicatorError);
        }
      });

      return { candles: extendedCandles, definitions: nextDefinitions };
    },
    [localIndicators],
  );

  const fetchData = useCallback(async () => {
    if (!symbol || !enabled) {
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<ApiResponse>(endpoint, {
        params: {
          symbol,
          interval,
          range,
        },
        signal: controller.signal,
      });
      const payload = response.data;
      const mapped = mapPayload(payload);
      const withIndicators = applyLocalIndicators(mapped.candles, mapped.definitions);
      setCandles(withIndicators.candles);
      setTrendDefinitions(withIndicators.definitions);
    } catch (fetchError) {
      if (axios.isCancel(fetchError)) {
        return;
      }
      setError(fetchError as Error);
    } finally {
      setLoading(false);
    }
  }, [
    symbol,
    enabled,
    interval,
    range,
    endpoint,
    mapPayload,
    applyLocalIndicators,
  ]);

  useEffect(() => {
    void fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) {
      return;
    }
    const id = setInterval(() => {
      void fetchData();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs, fetchData]);

  const result = useMemo<UseCandleDataResult>(
    () => ({
      candles,
      trendDefinitions,
      loading,
      error,
      refetch: fetchData,
    }),
    [candles, trendDefinitions, loading, error, fetchData],
  );

  return result;
}

function normalizeNumber(value: number | null): number | null {
  if (value == null) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
