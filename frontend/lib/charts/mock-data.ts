import { computeMovingAverage } from "./utils";
import type { Candle, TrendDefinition } from "./types";

interface RawPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const MOCK_CANDLE_COUNT = 120;
const START_DATE = Date.UTC(2023, 6, 3); // 2023-07-03 UTC

const rawPoints: RawPoint[] = Array.from({ length: MOCK_CANDLE_COUNT }, (_, index) => {
  const timestamp = START_DATE + index * 24 * 60 * 60 * 1000;
  const base = 180 + index * 0.25;
  const drift = centeredNoise(index) * 4;
  const open = roundToTwo(base + drift);
  const close = roundToTwo(open + centeredNoise(index + 1) * 3);
  const high = roundToTwo(Math.max(open, close) + Math.abs(noise(index + 2)) * 2.2);
  const low = roundToTwo(Math.min(open, close) - Math.abs(noise(index + 3)) * 2.1);
  const volume = Math.floor(55_000_000 + noise(index + 4) * 25_000_000);

  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  };
});

const candles: Candle[] = rawPoints.map((point) => ({
  timestamp: point.timestamp,
  open: point.open,
  high: point.high,
  low: point.low,
  close: point.close,
  volume: point.volume,
}));

const ma7 = computeMovingAverage(candles, 7);
const ma25 = computeMovingAverage(candles, 25);

const candlesWithTrends: Candle[] = candles.map((candle, index) => ({
  ...candle,
  trends: [ma7[index] ?? null, ma25[index] ?? null],
}));

const trendDefinitions: TrendDefinition[] = [
  { id: "ma7", label: "7日移動平均" },
  { id: "ma25", label: "25日移動平均" },
];

export interface MockCandleData {
  candles: Candle[];
  trendDefinitions: TrendDefinition[];
}

const mockPayload: MockCandleData = {
  candles: candlesWithTrends,
  trendDefinitions,
};

export async function fetchMockCandleData(delayMs = 400): Promise<MockCandleData> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockPayload), delayMs);
  });
}

function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function centeredNoise(seed: number): number {
  return noise(seed) * 2 - 1;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
