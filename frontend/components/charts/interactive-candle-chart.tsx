import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutChangeEvent,
  NativeTouchEvent,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import type {
  Candle,
  TrendDefinition,
  ViewportSlice,
} from "../../lib/charts/types";
import {
  extractPriceExtremes,
  extractVolumeExtremes,
  sliceCandlesForViewport,
} from "../../lib/charts/utils";
import {
  ChartStyleConfig,
  ResolvedChartStyle,
  resolveChartStyle,
  TrendLineStyle,
} from "../../lib/charts/style";

type OverlayInfo = Record<string, string>;

export interface InteractiveCandleChartProps {
  candles: Candle[];
  trendDefinitions?: TrendDefinition[];
  initialVisibleCandleCount?: number;
  styleConfig?: ChartStyleConfig;
  timeLabelFormatter?: (timestamp: number, visibleDataCount: number) => string;
  priceLabelFormatter?: (price: number) => string;
  overlayFormatter?: (candle: Candle) => OverlayInfo;
  onCandlePress?: (candle: Candle, index: number) => void;
  onCandleWidthChange?: (width: number) => void;
  style?: StyleProp<ViewStyle>;
}

interface LayoutSize {
  width: number;
  height: number;
}

interface TapState {
  x: number;
  y: number;
}

interface HighlightState {
  index: number;
  globalIndex: number;
  candle: Candle;
  localX: number;
  screenX: number;
}

const FINGER_MARGIN = 32;
const BASE_VOLUME_GAP = 12;
const BASE_VOLUME_PADDING = 2;

const defaultTimeLabel = (timestamp: number, visibleCount: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (visibleCount > 20) {
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
  }

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${month}-${day}`;
};

const defaultPriceLabel = (price: number): string => price.toFixed(2);

const defaultOverlayFormatter = (candle: Candle): OverlayInfo => {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return {
    Date: dateFormatter.format(new Date(candle.timestamp)),
    Open: candle.open != null ? candle.open.toFixed(2) : "-",
    High: candle.high != null ? candle.high.toFixed(2) : "-",
    Low: candle.low != null ? candle.low.toFixed(2) : "-",
    Close: candle.close != null ? candle.close.toFixed(2) : "-",
    Volume: candle.volume != null ? formatVolume(candle.volume) : "-",
  };
};

function formatVolume(volume: number): string {
  if (!Number.isFinite(volume)) {
    return "-";
  }
  if (volume < 1000) {
    return volume.toFixed(3);
  }
  if (volume >= 1e18) {
    return volume.toExponential(3);
  }

  const formatted = new Intl.NumberFormat("en-US").format(volume);
  const [head, fractional = "0"] = formatted.split(".");
  const groups = head.split(",");
  const suffixes = ["K", "M", "B", "T", "Q"];
  const suffix = suffixes[groups.length - 2] ?? "";

  if (suffix.length === 0) {
    return formatted;
  }

  return `${groups[0]}.${fractional}${suffix}`;
}

export const InteractiveCandleChart: React.FC<InteractiveCandleChartProps> = ({
  candles,
  trendDefinitions,
  initialVisibleCandleCount = 90,
  styleConfig,
  timeLabelFormatter = defaultTimeLabel,
  priceLabelFormatter = defaultPriceLabel,
  overlayFormatter = defaultOverlayFormatter,
  onCandlePress,
  onCandleWidthChange,
  style,
}) => {
  const resolvedStyle = useMemo<ResolvedChartStyle>(
    () => resolveChartStyle(styleConfig),
    [styleConfig],
  );

  const [layoutSize, setLayoutSize] = useState<LayoutSize>({ width: 0, height: 0 });
  const [candleWidth, setCandleWidth] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  const [tapPosition, setTapPosition] = useState<TapState | null>(null);
  const [overlaySize, setOverlaySize] = useState<LayoutSize | null>(null);

  const prevChartWidthRef = useRef<number | null>(null);
  const prevCandleWidthRef = useRef(0);
  const prevStartOffsetRef = useRef(0);
  const initialFocalXRef = useRef(0);

  const candleWidthRef = useRef(0);
  const startOffsetRef = useRef(0);

  useEffect(() => {
    candleWidthRef.current = candleWidth;
  }, [candleWidth]);

  useEffect(() => {
    startOffsetRef.current = startOffset;
  }, [startOffset]);

  useEffect(() => {
    if (candleWidth > 0) {
      onCandleWidthChange?.(candleWidth);
    }
  }, [candleWidth, onCandleWidthChange]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width === layoutSize.width && height === layoutSize.height) {
        return;
      }
      setLayoutSize({ width, height });
      const chartWidth = Math.max(width - resolvedStyle.priceLabelWidth, 0);
      recalculateViewportForResize(
        chartWidth,
        candles.length,
        initialVisibleCandleCount,
        prevChartWidthRef,
        setCandleWidth,
        setStartOffset,
        candleWidthRef,
        startOffsetRef,
      );
    },
    [
      layoutSize.height,
      layoutSize.width,
      resolvedStyle.priceLabelWidth,
      candles.length,
      initialVisibleCandleCount,
    ],
  );

  const chartWidth = Math.max(layoutSize.width - resolvedStyle.priceLabelWidth, 0);
  const chartHeight = Math.max(layoutSize.height - resolvedStyle.timeLabelHeight, 0);
  const priceHeight = chartHeight * (1 - resolvedStyle.volumeHeightFactor);
  const volumeHeight = chartHeight - priceHeight;

  const viewport = useMemo(
    () => ({
      candleWidth,
      startOffset,
      visibleCount: chartWidth > 0 && candleWidth > 0 ? chartWidth / candleWidth : 0,
    }),
    [candleWidth, chartWidth, startOffset],
  );

  const viewportSlice = useMemo<ViewportSlice | null>(() => {
    if (candles.length === 0 || chartWidth <= 0 || candleWidth <= 0) {
      return null;
    }
    return sliceCandlesForViewport(
      {
        candles,
        trendDefinitions,
      },
      viewport,
    );
  }, [candles, trendDefinitions, viewport, chartWidth, candleWidth]);

  const priceExtremes = useMemo(
    () =>
      viewportSlice
        ? extractPriceExtremes(viewportSlice.candles)
        : { maxPrice: 1, minPrice: 0 },
    [viewportSlice],
  );
  const volumeExtremes = useMemo(
    () =>
      viewportSlice
        ? extractVolumeExtremes(viewportSlice.candles)
        : { maxVolume: 0, minVolume: 0 },
    [viewportSlice],
  );

  const xShift = useMemo(() => {
    if (!viewportSlice || candleWidth <= 0) {
      return 0;
    }
    const halfCandle = candleWidth / 2;
    const fraction = startOffset - viewportSlice.startIndex * candleWidth;
    return halfCandle - fraction;
  }, [viewportSlice, candleWidth, startOffset]);

  const highlight = useMemo<HighlightState | null>(() => {
    if (!viewportSlice || !tapPosition || tapPosition.x >= chartWidth) {
      return null;
    }
    const index = Math.floor((tapPosition.x - xShift + candleWidth / 2) / candleWidth);
    if (index < 0 || index >= viewportSlice.candles.length) {
      return null;
    }
    const candle = viewportSlice.candles[index];
    if (!candle) {
      return null;
    }
    const globalIndex = viewportSlice.startIndex + index;
    const localX = index * candleWidth;
    const screenX = localX + xShift;
    return { index, globalIndex, candle, localX, screenX };
  }, [viewportSlice, tapPosition, chartWidth, xShift, candleWidth]);

  const overlayEntries = useMemo(() => {
    if (!highlight) {
      return [];
    }
    const info = overlayFormatter(highlight.candle);
    return Object.entries(info);
  }, [highlight, overlayFormatter]);

  const overlayPosition = useMemo(() => {
    if (!highlight || !overlaySize) {
      return null;
    }
    const totalWidth = layoutSize.width;
    let dx =
      highlight.screenX + FINGER_MARGIN <= totalWidth / 2
        ? highlight.screenX + FINGER_MARGIN
        : highlight.screenX - overlaySize.width - FINGER_MARGIN;

    if (highlight.screenX > totalWidth / 2) {
      dx = Math.max(0, dx);
    } else {
      dx = Math.min(dx, totalWidth - overlaySize.width);
    }

    let dy = tapPosition ? tapPosition.y - overlaySize.height - FINGER_MARGIN : 0;
    if (dy < 0) {
      dy = 0;
    }
    if (dy + overlaySize.height > chartHeight + resolvedStyle.timeLabelHeight) {
      dy = chartHeight + resolvedStyle.timeLabelHeight - overlaySize.height;
    }

    return {
      left: clamp(dx, 0, totalWidth - overlaySize.width),
      top: clamp(dy, 0, layoutSize.height - overlaySize.height),
    };
  }, [
    highlight,
    overlaySize,
    layoutSize.width,
    layoutSize.height,
    tapPosition,
    chartHeight,
    resolvedStyle.timeLabelHeight,
  ]);

  const clearTap = useCallback(() => setTapPosition(null), []);

  const handleTouch = useCallback(
    (event: NativeTouchEvent) => {
      if (event.locationX >= chartWidth) {
        setTapPosition(null);
        return;
      }
      setTapPosition({
        x: event.locationX,
        y: event.locationY,
      });
    },
    [chartWidth],
  );

  const handleTouchEnd = useCallback(() => {
    if (highlight && onCandlePress) {
      onCandlePress(highlight.candle, highlight.globalIndex);
    }
    setTapPosition(null);
  }, [highlight, onCandlePress]);

  const handleOverlayLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setOverlaySize({ width, height });
  }, []);

  const clampStartOffset = useCallback(
    (target: number, chartSpan: number, widthPerCandle: number) => {
      const maxOffset = getMaxStartOffset(
        chartSpan,
        widthPerCandle,
        candles.length,
      );
      return clamp(target, 0, maxOffset);
    },
    [candles.length],
  );

  const handlePinchStart = useCallback(
    (focalX: number) => {
      prevCandleWidthRef.current = candleWidthRef.current;
      prevStartOffsetRef.current = startOffsetRef.current;
      initialFocalXRef.current = clamp(focalX, 0, chartWidth);
      clearTap();
    },
    [chartWidth, clearTap],
  );

  const handlePinchUpdate = useCallback(
    (scale: number, focalX: number) => {
      const prevCandleWidth = prevCandleWidthRef.current || candleWidthRef.current;
      if (prevCandleWidth <= 0 || chartWidth <= 0) {
        return;
      }

      const clampedFocal = clamp(focalX, 0, chartWidth);
      const minCandleWidth = chartWidth / Math.max(candles.length, 1);
      const maxCandleWidth = chartWidth / Math.max(Math.min(14, candles.length), 1);
      let nextCandleWidth = clamp(
        prevCandleWidth * scale,
        minCandleWidth,
        Math.max(minCandleWidth, maxCandleWidth),
      );
      const clampedScale = nextCandleWidth / prevCandleWidth;
      let nextStartOffset = prevStartOffsetRef.current * clampedScale;
      const dx = (clampedFocal - initialFocalXRef.current) * -1;
      nextStartOffset += dx;

      const prevCount = chartWidth / prevCandleWidth;
      const nextCount = chartWidth / nextCandleWidth;
      const zoomAdjustment = (nextCount - prevCount) * nextCandleWidth;
      const focalFactor = clampedFocal / chartWidth;
      nextStartOffset -= zoomAdjustment * focalFactor;

      nextStartOffset = clampStartOffset(nextStartOffset, chartWidth, nextCandleWidth);

      setCandleWidth(nextCandleWidth);
      setStartOffset(nextStartOffset);
    },
    [candles.length, chartWidth, clampStartOffset],
  );

  const handlePanStart = useCallback(() => {
    prevStartOffsetRef.current = startOffsetRef.current;
    clearTap();
  }, [clearTap]);

  const handlePanUpdate = useCallback(
    (translationX: number) => {
      const target = prevStartOffsetRef.current + translationX * -1;
      const nextStartOffset = clampStartOffset(target, chartWidth, candleWidthRef.current);
      setStartOffset(nextStartOffset);
    },
    [chartWidth, clampStartOffset],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          runOnJS(handlePanStart)();
        })
        .onUpdate((event) => {
          runOnJS(handlePanUpdate)(event.translationX);
        }),
    [handlePanStart, handlePanUpdate],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart((event) => {
          runOnJS(handlePinchStart)(event.focalX);
        })
        .onUpdate((event) => {
          runOnJS(handlePinchUpdate)(event.scale, event.focalX);
        }),
    [handlePinchStart, handlePinchUpdate],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture],
  );

  if (candles.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.placeholderText}>No candle data provided.</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        style={[styles.container, style]}
        onLayout={handleLayout}
        onTouchStart={(event) => handleTouch(event.nativeEvent)}
        onTouchMove={(event) => handleTouch(event.nativeEvent)}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Svg
          width={layoutSize.width}
          height={layoutSize.height}
        >
          <Defs>
            <ClipPath id="priceClip">
              <Rect x={0} y={0} width={chartWidth} height={chartHeight} />
            </ClipPath>
          </Defs>
          <G>
            <PriceGridAndLabels
              chartWidth={chartWidth}
              priceHeight={priceHeight}
              maxPrice={priceExtremes.maxPrice}
              minPrice={priceExtremes.minPrice}
              style={resolvedStyle}
              priceLabelFormatter={priceLabelFormatter}
            />
            {viewportSlice && (
              <G clipPath="url(#priceClip)">
                <G transform={`translate(${xShift}, 0)`}>
                  <PriceAndVolumeLayer
                    candles={viewportSlice.candles}
                    candleWidth={candleWidth}
                    priceHeight={priceHeight}
                    volumeHeight={volumeHeight}
                    chartHeight={chartHeight}
                    style={resolvedStyle}
                    maxPrice={priceExtremes.maxPrice}
                    minPrice={priceExtremes.minPrice}
                    maxVolume={volumeExtremes.maxVolume}
                    minVolume={volumeExtremes.minVolume}
                    leadingTrends={viewportSlice.leadingTrends}
                    trailingTrends={viewportSlice.trailingTrends}
                  />
                  {highlight && highlight.localX >= -candleWidth && highlight.localX <= chartWidth + candleWidth && (
                    <Line
                      x1={highlight.localX}
                      x2={highlight.localX}
                      y1={0}
                      y2={chartHeight}
                      stroke={resolvedStyle.selectionHighlightColor}
                      strokeWidth={Math.max(candleWidth * 0.88, 1)}
                    />
                  )}
                </G>
              </G>
            )}
            <TimeLabels
              viewportSlice={viewportSlice}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              candleWidth={candleWidth}
              xShift={xShift}
              style={resolvedStyle}
              timeLabelFormatter={timeLabelFormatter}
            />
          </G>
        </Svg>
        {highlight && overlayEntries.length > 0 && overlayPosition && (
          <View
            pointerEvents="none"
            style={[
              styles.overlayContainer,
              {
                left: overlayPosition.left,
                top: overlayPosition.top,
                backgroundColor: resolvedStyle.overlayBackgroundColor,
              },
            ]}
            onLayout={handleOverlayLayout}
          >
            {overlayEntries.map(([label, value]) => (
              <View key={label} style={styles.overlayRow}>
                <Text
                  style={[styles.overlayLabel, resolvedStyle.overlayTextStyle]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                <Text
                  style={[
                    styles.overlayValue,
                    resolvedStyle.overlayTextStyle,
                  ]}
                  numberOfLines={1}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </GestureDetector>
  );
};

interface PriceGridAndLabelsProps {
  chartWidth: number;
  priceHeight: number;
  maxPrice: number;
  minPrice: number;
  style: ResolvedChartStyle;
  priceLabelFormatter: (price: number) => string;
}

const PriceGridAndLabels: React.FC<PriceGridAndLabelsProps> = ({
  chartWidth,
  priceHeight,
  maxPrice,
  minPrice,
  style,
  priceLabelFormatter,
}) => {
  const mapPrice = useMemo(
    () => createPriceMapper(maxPrice, minPrice, priceHeight),
    [maxPrice, minPrice, priceHeight],
  );
  const yPositions = useMemo(
    () =>
      [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const price = (maxPrice - minPrice) * ratio + minPrice;
        return {
          price,
          y: mapPrice(price),
        };
      }),
    [mapPrice, maxPrice, minPrice],
  );

  return (
    <G>
      {yPositions.map(({ price, y }) => (
        <React.Fragment key={price}>
          <Line
            x1={0}
            x2={chartWidth}
            y1={y}
            y2={y}
            stroke={style.priceGridLineColor}
            strokeWidth={0.5}
          />
          <SvgText
            x={chartWidth + 4}
            y={y}
            fill={style.priceLabelStyle.color ?? "#808080"}
            fontSize={style.priceLabelStyle.fontSize ?? 12}
            fontFamily={("fontFamily" in style.priceLabelStyle && style.priceLabelStyle.fontFamily) || defaultFontFamily()}
            alignmentBaseline="middle"
          >
            {priceLabelFormatter(price)}
          </SvgText>
        </React.Fragment>
      ))}
    </G>
  );
};

interface TimeLabelsProps {
  viewportSlice: ViewportSlice | null;
  chartWidth: number;
  chartHeight: number;
  candleWidth: number;
  xShift: number;
  style: ResolvedChartStyle;
  timeLabelFormatter: (timestamp: number, visibleDataCount: number) => string;
}

const TimeLabels: React.FC<TimeLabelsProps> = ({
  viewportSlice,
  chartWidth,
  chartHeight,
  candleWidth,
  xShift,
  style,
  timeLabelFormatter,
}) => {
  if (!viewportSlice || chartWidth <= 0 || candleWidth <= 0) {
    return null;
  }

  const lineCount = Math.floor(chartWidth / 90);
  const gap = 1 / (lineCount + 1);
  const visibleCount = viewportSlice.candles.length;
  const textY = chartHeight + style.timeLabelHeight - 4;

  return (
    <G>
      {Array.from({ length: lineCount }, (_, idx) => {
        const x = (idx + 1) * gap * chartWidth;
        const rawIndex = Math.floor((x - xShift + candleWidth / 2) / candleWidth);
        const index = clamp(rawIndex, 0, viewportSlice.candles.length - 1);
        const candle = viewportSlice.candles[index];
        const label = candle
          ? timeLabelFormatter(candle.timestamp, visibleCount)
          : "";
        return (
          <SvgText
            key={`${idx}-${label}`}
            x={x}
            y={textY}
            fill={style.timeLabelStyle.color ?? "#808080"}
            fontSize={style.timeLabelStyle.fontSize ?? 16}
            fontFamily={("fontFamily" in style.timeLabelStyle && style.timeLabelStyle.fontFamily) || defaultFontFamily()}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}
    </G>
  );
};

interface PriceAndVolumeLayerProps {
  candles: Candle[];
  candleWidth: number;
  priceHeight: number;
  volumeHeight: number;
  chartHeight: number;
  style: ResolvedChartStyle;
  maxPrice: number;
  minPrice: number;
  maxVolume: number;
  minVolume: number;
  leadingTrends?: (number | null)[];
  trailingTrends?: (number | null)[];
}

const PriceAndVolumeLayer: React.FC<PriceAndVolumeLayerProps> = ({
  candles,
  candleWidth,
  priceHeight,
  volumeHeight,
  chartHeight,
  style,
  maxPrice,
  minPrice,
  maxVolume,
  minVolume,
  leadingTrends,
  trailingTrends,
}) => {
  const priceMapper = useMemo(
    () => createPriceMapper(maxPrice, minPrice, priceHeight),
    [maxPrice, minPrice, priceHeight],
  );
  const volumeMapper = useMemo(
    () => createVolumeMapper(maxVolume, minVolume, priceHeight, volumeHeight),
    [maxVolume, minVolume, priceHeight, volumeHeight],
  );

  const trendLineCount = Math.max(
    getMaxTrendCount(candles),
    leadingTrends?.length ?? 0,
    trailingTrends?.length ?? 0,
  );

  const trendLines = useMemo(
    () =>
      Array.from({ length: trendLineCount }, (_, trendIndex) =>
        buildTrendPath(
          candles,
          trendIndex,
          candleWidth,
          priceMapper,
          leadingTrends,
          trailingTrends,
        ),
      ),
    [
      candles,
      trendLineCount,
      candleWidth,
      priceMapper,
      leadingTrends,
      trailingTrends,
    ],
  );

  return (
    <G>
      {candles.map((candle, index) => {
        const x = index * candleWidth;
        const thickWidth = Math.max(candleWidth * 0.8, 0.8);
        const thinWidth = Math.max(candleWidth * 0.2, 0.2);

        const open = candle.open;
        const close = candle.close;
        const high = candle.high;
        const low = candle.low;
        const color =
          open != null && close != null && open > close
            ? style.priceLossColor
            : style.priceGainColor;

        return (
          <React.Fragment key={candle.timestamp}>
            {open != null && close != null && (
              <Line
                x1={x}
                x2={x}
                y1={priceMapper(open)}
                y2={priceMapper(close)}
                stroke={color}
                strokeWidth={thickWidth}
                strokeLinecap="round"
              />
            )}
            {high != null && low != null && (
              <Line
                x1={x}
                x2={x}
                y1={priceMapper(high)}
                y2={priceMapper(low)}
                stroke={color}
                strokeWidth={thinWidth}
                strokeLinecap="round"
              />
            )}
            {candle.volume != null && (
              <Line
                x1={x}
                x2={x}
                y1={chartHeight}
                y2={volumeMapper(candle.volume)}
                stroke={style.volumeColor}
                strokeWidth={thickWidth}
                strokeLinecap="round"
              />
            )}
          </React.Fragment>
        );
      })}
      {trendLines.map((path, index) => {
        if (!path) {
          return null;
        }
        const styleOverride = getTrendStyle(style.trendLineStyles, index);
        return (
          <Path
            key={`trend-${index}`}
            d={path}
            stroke={styleOverride.stroke}
            strokeWidth={styleOverride.strokeWidth ?? 2}
            strokeOpacity={styleOverride.strokeOpacity ?? 1}
            strokeDasharray={styleOverride.strokeDasharray}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </G>
  );
};

function getTrendStyle(
  styles: TrendLineStyle[],
  index: number,
): TrendLineStyle {
  if (styles[index]) {
    return styles[index];
  }
  return {
    stroke: "#0000FF",
    strokeWidth: 2,
    strokeOpacity: 1,
  };
}

function buildTrendPath(
  candles: Candle[],
  trendIndex: number,
  candleWidth: number,
  priceMapper: (price: number) => number,
  leadingTrends?: (number | null)[],
  trailingTrends?: (number | null)[],
): string | null {
  let path = "";
  let lastPoint: { x: number; y: number } | null = null;

  const appendSegment = (x: number, y: number, move = false) => {
    if (move || path.length === 0) {
      path += `M ${x} ${y} `;
    } else {
      path += `L ${x} ${y} `;
    }
    lastPoint = { x, y };
  };

  const trendCount = getMaxTrendCount(candles);
  if (trendIndex >= trendCount && !leadingTrends && !trailingTrends) {
    return null;
  }

  const leadValue = leadingTrends?.[trendIndex];
  if (leadValue != null) {
    const x = -candleWidth;
    appendSegment(x, priceMapper(leadValue), true);
  }

  candles.forEach((candle, index) => {
    const trends = candle.trends;
    if (!trends) {
      lastPoint = null;
      return;
    }
    const value = trends[trendIndex];
    if (value == null) {
      lastPoint = null;
      return;
    }
    const x = index * candleWidth;
    const y = priceMapper(value);
    appendSegment(x, y, !lastPoint);
  });

  const trailingValue = trailingTrends?.[trendIndex];
  if (trailingValue != null && lastPoint) {
    const x = candles.length * candleWidth;
    appendSegment(x, priceMapper(trailingValue));
  }

  return path.length > 0 ? path.trim() : null;
}

function createPriceMapper(
  maxPrice: number,
  minPrice: number,
  priceHeight: number,
): (price: number) => number {
  const span = maxPrice - minPrice || 1;
  return (price: number) =>
    priceHeight * (maxPrice - price) / span;
}

function createVolumeMapper(
  maxVolume: number,
  minVolume: number,
  priceHeight: number,
  volumeHeight: number,
): (volume: number) => number {
  if (maxVolume === minVolume) {
    return () => priceHeight + volumeHeight / 2;
  }
  const scale = (volumeHeight - BASE_VOLUME_PADDING - BASE_VOLUME_GAP) / (maxVolume - minVolume);
  return (volume: number) =>
    priceHeight + volumeHeight - BASE_VOLUME_PADDING - (volume - minVolume) * scale;
}

function getMaxTrendCount(candles: Candle[]): number {
  return candles.reduce((max, candle) => {
    const len = candle.trends?.length ?? 0;
    return len > max ? len : max;
  }, 0);
}

function recalculateViewportForResize(
  chartWidth: number,
  candleCount: number,
  initialVisibleCandleCount: number,
  prevChartWidthRef: React.MutableRefObject<number | null>,
  setCandleWidth: (width: number) => void,
  setStartOffset: (offset: number) => void,
  candleWidthRef: React.MutableRefObject<number>,
  startOffsetRef: React.MutableRefObject<number>,
) {
  if (chartWidth <= 0 || candleCount === 0) {
    return;
  }

  if (prevChartWidthRef.current != null) {
    const minWidth = chartWidth / candleCount;
    const maxWidth = chartWidth / Math.max(Math.min(14, candleCount), 1);
    const nextCandleWidth = clamp(candleWidthRef.current, minWidth, Math.max(minWidth, maxWidth));
    const nextStartOffset = clamp(
      startOffsetRef.current,
      0,
      getMaxStartOffset(chartWidth, nextCandleWidth, candleCount),
    );
    prevChartWidthRef.current = chartWidth;
    setCandleWidth(nextCandleWidth);
    setStartOffset(nextStartOffset);
    candleWidthRef.current = nextCandleWidth;
    startOffsetRef.current = nextStartOffset;
  } else {
    const visibleCount = Math.min(candleCount, initialVisibleCandleCount);
    const nextCandleWidth = chartWidth / Math.max(visibleCount, 1);
    const nextStartOffset = Math.max(0, (candleCount - visibleCount) * nextCandleWidth);
    prevChartWidthRef.current = chartWidth;
    setCandleWidth(nextCandleWidth);
    setStartOffset(nextStartOffset);
    candleWidthRef.current = nextCandleWidth;
    startOffsetRef.current = nextStartOffset;
  }
}

function getMaxStartOffset(
  chartWidth: number,
  candleWidth: number,
  candleCount: number,
): number {
  if (candleWidth <= 0) {
    return 0;
  }
  const visible = chartWidth / candleWidth;
  const start = candleCount - visible;
  return Math.max(0, candleWidth * start);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function defaultFontFamily(): string {
  if (Platform.OS === "ios") {
    return "System";
  }
  if (Platform.OS === "android") {
    return "Roboto";
  }
  return "sans-serif";
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  placeholderText: {
    textAlign: "center",
    padding: 16,
  },
  overlayContainer: {
    position: "absolute",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  overlayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  overlayLabel: {
    marginRight: 12,
  },
  overlayValue: {
    flexShrink: 1,
    textAlign: "right",
  },
});

export default InteractiveCandleChart;
