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

export function computeRsi(candles: Candle[], period = 14): (number | null)[] {
  if (period <= 0) {
    throw new Error("period must be greater than zero");
  }
  if (candles.length === 0) {
    return [];
  }

  const closes = candles.map((item) => item.close);
  const result: (number | null)[] = Array(candles.length).fill(null);
  let avgGain: number | null = null;
  let avgLoss: number | null = null;
  let seedCount = 0;
  let seedGains = 0;
  let seedLosses = 0;

  for (let i = 1; i < closes.length; i += 1) {
    const current = closes[i];
    const previous = closes[i - 1];
    if (current == null || previous == null) {
      continue;
    }

    const change = current - previous;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (avgGain == null || avgLoss == null) {
      seedCount += 1;
      seedGains += gain;
      seedLosses += loss;
      if (seedCount >= period) {
        avgGain = seedGains / period;
        avgLoss = seedLosses / period;
        result[i] = calculateRsiValue(avgGain, avgLoss);
      }
      continue;
    }

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    result[i] = calculateRsiValue(avgGain, avgLoss);
  }

  return result;
}

export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function computeMacd(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdResult {
  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    throw new Error("period must be greater than zero");
  }
  if (candles.length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }

  const closes = candles.map((item) => item.close);
  const fastEma = computeEma(closes, fastPeriod);
  const slowEma = computeEma(closes, slowPeriod);
  const macd: (number | null)[] = closes.map((_, index) => {
    const fast = fastEma[index];
    const slow = slowEma[index];
    if (fast == null || slow == null) {
      return null;
    }
    return fast - slow;
  });

  const signal = computeEma(macd, signalPeriod);
  const histogram: (number | null)[] = macd.map((value, index) => {
    const signalValue = signal[index];
    if (value == null || signalValue == null) {
      return null;
    }
    return value - signalValue;
  });

  return { macd, signal, histogram };
}

function calculateRsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100;
  }
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeEma(values: (number | null)[], period: number): (number | null)[] {
  if (period <= 0) {
    throw new Error("period must be greater than zero");
  }
  if (values.length === 0) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const result: (number | null)[] = Array(values.length).fill(null);
  let ema: number | null = null;
  let seedTotal = 0;
  let seedCount = 0;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) {
      continue;
    }

    if (ema == null) {
      seedTotal += value;
      seedCount += 1;
      if (seedCount >= period) {
        ema = seedTotal / period;
        result[i] = ema;
      }
      continue;
    }

    ema = (value - ema) * multiplier + ema;
    result[i] = ema;
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
