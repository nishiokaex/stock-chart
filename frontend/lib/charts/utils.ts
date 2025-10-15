import {
  Candle,
  CandleBatch,
  ChartViewport,
  PriceExtremes,
  ViewportSlice,
  VolumeExtremes,
} from "./types";

const EPSILON = 1e-6;

export function computeMovingAverage(candles: Candle[], period = 7): (number | null)[] {
  if (period <= 0) {
    throw new Error("period must be greater than zero");
  }
  if (candles.length === 0) {
    return [];
  }
  if (candles.length < period * 2) {
    return Array(candles.length).fill(null);
  }

  const closes = candles.map((item) => item.close);
  const seed = closes.slice(0, period).filter((value): value is number => value != null);
  if (seed.length === 0) {
    return Array(candles.length).fill(null);
  }

  const result: (number | null)[] = Array(period).fill(null);
  let movingAverage = seed.reduce((sum, value) => sum + value, 0) / seed.length;

  for (let i = period; i < candles.length; i += 1) {
    const current = closes[i];
    const previous = closes[i - period];
    if (current != null && previous != null) {
      movingAverage = (movingAverage * period + current - previous) / period;
      result.push(movingAverage);
    } else {
      result.push(null);
    }
  }

  return result;
}

export function extractPriceExtremes(candles: Candle[]): PriceExtremes {
  if (candles.length === 0) {
    return { maxPrice: 1, minPrice: 0 };
  }

  const highs: number[] = [];
  const lows: number[] = [];

  for (const candle of candles) {
    const highValue =
      candle.high ??
      (candle.open != null && candle.close != null
        ? Math.max(candle.open, candle.close)
        : candle.open ?? candle.close ?? null);
    const lowValue =
      candle.low ??
      (candle.open != null && candle.close != null
        ? Math.min(candle.open, candle.close)
        : candle.open ?? candle.close ?? null);

    if (highValue != null) {
      highs.push(highValue);
    }
    if (lowValue != null) {
      lows.push(lowValue);
    }
  }

  if (highs.length === 0 || lows.length === 0) {
    return { maxPrice: 1, minPrice: 0 };
  }

  return {
    maxPrice: Math.max(...highs),
    minPrice: Math.min(...lows),
  };
}

export function extractVolumeExtremes(candles: Candle[]): VolumeExtremes {
  if (candles.length === 0) {
    return { maxVolume: 0, minVolume: 0 };
  }

  const volumes = candles
    .map((candle) => candle.volume)
    .filter((value): value is number => value != null);

  if (volumes.length === 0) {
    return { maxVolume: 0, minVolume: 0 };
  }

  return {
    maxVolume: Math.max(...volumes),
    minVolume: Math.min(...volumes),
  };
}

export function sliceCandlesForViewport(batch: CandleBatch, viewport: ChartViewport): ViewportSlice {
  const total = batch.candles.length;
  if (total === 0) {
    return {
      candles: [],
      startIndex: 0,
      endIndex: 0,
    };
  }

  const candleWidth = Math.max(Math.abs(viewport.candleWidth), EPSILON);
  const startIndex = clampIndex(Math.floor(viewport.startOffset / candleWidth), total);
  const visibleFloat = Math.max(0, viewport.visibleCount);
  const endEstimate = startIndex + visibleFloat;
  const endIndex = clampEnd(Math.ceil(endEstimate), startIndex, total);

  const sliced = batch.candles.slice(startIndex, endIndex);
  if (endIndex < total) {
    sliced.push(batch.candles[endIndex]);
  }

  const leading =
    startIndex > 0
      ? batch.candles[startIndex - 1].trends
      : batch.leadingTrends;
  const trailingIndex = endIndex + 1;
  const trailing =
    trailingIndex < total
      ? batch.candles[trailingIndex].trends
      : batch.trailingTrends;

  return {
    candles: sliced,
    leadingTrends: leading ? [...leading] : undefined,
    trailingTrends: trailing ? [...trailing] : undefined,
    trendDefinitions: batch.trendDefinitions,
    startIndex,
    endIndex,
  };
}

function clampIndex(value: number, length: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(0, value), Math.max(0, length - 1));
}

function clampEnd(candidate: number, startIndex: number, total: number): number {
  const normalized = Number.isFinite(candidate) ? candidate : startIndex;
  const effective = Math.max(startIndex, normalized);
  return Math.min(total, effective);
}
