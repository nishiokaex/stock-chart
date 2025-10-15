/**
 * Based on the original Flutter implementation located in /lib/src.
 * Ported under MIT license compatibility.
 */

export type TimestampMs = number;

export interface Candle {
  timestamp: TimestampMs;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  trends?: (number | null)[];
}

export interface CandleBatch {
  candles: Candle[];
  leadingTrends?: (number | null)[];
  trailingTrends?: (number | null)[];
  trendDefinitions?: TrendDefinition[];
}

export interface ViewportSlice extends CandleBatch {
  startIndex: number;
  endIndex: number;
}

export interface ChartViewport {
  candleWidth: number;
  startOffset: number;
  visibleCount: number;
}

export interface TrendDefinition {
  id: string;
  label?: string;
}

export interface PriceExtremes {
  maxPrice: number;
  minPrice: number;
}

export interface VolumeExtremes {
  maxVolume: number;
  minVolume: number;
}
