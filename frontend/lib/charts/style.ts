import type { TextStyle } from "react-native";

/**
 * Based on the original Flutter implementation located in /lib/src.
 * Ported under MIT license compatibility.
 */

export interface TrendLineStyle {
  stroke: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeDasharray?: string;
}

export interface ChartStyleConfig {
  volumeHeightFactor?: number;
  priceLabelWidth?: number;
  timeLabelHeight?: number;
  timeLabelStyle?: TextStyle;
  priceLabelStyle?: TextStyle;
  overlayTextStyle?: TextStyle;
  priceGainColor?: string;
  priceLossColor?: string;
  volumeColor?: string;
  trendLineStyles?: TrendLineStyle[];
  priceGridLineColor?: string;
  selectionHighlightColor?: string;
  overlayBackgroundColor?: string;
}

export interface ResolvedChartStyle {
  volumeHeightFactor: number;
  priceLabelWidth: number;
  timeLabelHeight: number;
  timeLabelStyle: TextStyle;
  priceLabelStyle: TextStyle;
  overlayTextStyle: TextStyle;
  priceGainColor: string;
  priceLossColor: string;
  volumeColor: string;
  trendLineStyles: TrendLineStyle[];
  priceGridLineColor: string;
  selectionHighlightColor: string;
  overlayBackgroundColor: string;
}

export const DEFAULT_CHART_STYLE: ResolvedChartStyle = {
  volumeHeightFactor: 0.2,
  priceLabelWidth: 48,
  timeLabelHeight: 24,
  timeLabelStyle: {
    fontSize: 16,
    color: "#808080",
  },
  priceLabelStyle: {
    fontSize: 12,
    color: "#808080",
    textAlign: "right",
  },
  overlayTextStyle: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  priceGainColor: "#008000",
  priceLossColor: "#FF0000",
  volumeColor: "#808080",
  trendLineStyles: [],
  priceGridLineColor: "#808080",
  selectionHighlightColor: "rgba(117, 117, 117, 0.2)",
  overlayBackgroundColor: "rgba(117, 117, 117, 0.93)",
};

export function resolveChartStyle(style?: ChartStyleConfig): ResolvedChartStyle {
  if (!style) {
    return DEFAULT_CHART_STYLE;
  }

  return {
    ...DEFAULT_CHART_STYLE,
    ...style,
    trendLineStyles: style.trendLineStyles ?? DEFAULT_CHART_STYLE.trendLineStyles,
    timeLabelStyle: { ...DEFAULT_CHART_STYLE.timeLabelStyle, ...style.timeLabelStyle },
    priceLabelStyle: { ...DEFAULT_CHART_STYLE.priceLabelStyle, ...style.priceLabelStyle },
    overlayTextStyle: { ...DEFAULT_CHART_STYLE.overlayTextStyle, ...style.overlayTextStyle },
  };
}
