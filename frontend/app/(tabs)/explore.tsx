import { Dimensions, StyleSheet, View } from 'react-native';
import { Svg, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Card, Text, useTheme } from 'react-native-paper';

type PricePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

const chartData: PricePoint[] = [
  { date: '2024-01-02', open: 185.1, high: 186.2, low: 184.5, close: 185.5 },
  { date: '2024-01-03', open: 185.6, high: 187.8, low: 185.0, close: 187.2 },
  { date: '2024-01-04', open: 187.4, high: 188.0, low: 183.0, close: 183.9 },
  { date: '2024-01-05', open: 184.4, high: 187.2, low: 184.0, close: 186.4 },
  { date: '2024-01-08', open: 186.7, high: 190.0, low: 186.2, close: 189.1 },
  { date: '2024-01-09', open: 189.8, high: 190.4, low: 188.0, close: 188.7 },
  { date: '2024-01-10', open: 189.0, high: 192.0, low: 188.6, close: 191.5 },
  { date: '2024-01-11', open: 191.8, high: 194.0, low: 191.0, close: 193.2 },
  { date: '2024-01-12', open: 193.5, high: 194.1, low: 191.8, close: 192.6 },
  { date: '2024-01-16', open: 192.4, high: 195.6, low: 192.0, close: 194.8 },
];

const CHART_HORIZONTAL_PADDING = 16;
const CHART_HEIGHT = 220;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const svgWidth = SCREEN_WIDTH - CHART_HORIZONTAL_PADDING * 2;

type CandleShape = {
  key: string;
  centerX: number;
  highY: number;
  lowY: number;
  bodyTop: number;
  bodyBottom: number;
  isBullish: boolean;
};

function buildCandlestickData(data: PricePoint[]) {
  if (data.length === 0) {
    return {
      candles: [],
      min: 0,
      max: 0,
      candleWidth: 0,
    };
  }

  const highs = data.map(point => point.high);
  const lows = data.map(point => point.low);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const valueRange = max - min || 1; // avoid division by zero when all values are equal
  const stepX = data.length > 0 ? svgWidth / data.length : 0;
  const candleWidth = Math.min(24, stepX * 0.6);
  const scaleY = (value: number) => CHART_HEIGHT - ((value - min) / valueRange) * CHART_HEIGHT;

  const candles: CandleShape[] = data.map((point, index) => {
    const centerX = data.length > 1 ? index * stepX + stepX / 2 : svgWidth / 2;
    const highY = scaleY(point.high);
    const lowY = scaleY(point.low);
    const openY = scaleY(point.open);
    const closeY = scaleY(point.close);
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);

    return {
      key: point.date,
      centerX,
      highY,
      lowY,
      bodyTop,
      bodyBottom,
      isBullish: point.close >= point.open,
    };
  });

  return {
    candles,
    min,
    max,
    candleWidth,
  };
}

export default function TabTwoScreen() {
  const theme = useTheme();
  const { candles, min, max, candleWidth } = buildCandlestickData(chartData);
  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : undefined;
  const axisColor = theme.colors.outlineVariant ?? theme.colors.outline;
  const axisLabelColor = theme.colors.onSurfaceVariant ?? theme.colors.onSurface;
  const bullishColor = theme.colors.tertiary ?? theme.colors.primary;
  const bearishColor = theme.colors.error;
  const screenStyle = [styles.screen, { backgroundColor: theme.colors.background }];

  return (
    <View style={screenStyle}>
      <Text variant="headlineMedium" style={styles.title}>
        AAPL ダミー株価チャート
      </Text>
      <Text variant="titleMedium" style={[styles.subtitle, styles.subtitleText]}>
        終値 {latest?.close.toFixed(2) ?? '--'} USD ( {latest?.date ?? 'N/A'} )
      </Text>
      <Card mode="elevated" style={styles.chartCard}>
        <Card.Content style={styles.chartContent}>
          <Svg width={svgWidth} height={CHART_HEIGHT}>
            <Line
              x1={0}
              y1={CHART_HEIGHT}
              x2={svgWidth}
              y2={CHART_HEIGHT}
              stroke={axisColor}
              strokeWidth={1}
            />
            <Line x1={0} y1={0} x2={0} y2={CHART_HEIGHT} stroke={axisColor} strokeWidth={1} />
            {candles.map(candle => (
              <Line
                key={`${candle.key}-wick`}
                x1={candle.centerX}
                y1={candle.highY}
                x2={candle.centerX}
                y2={candle.lowY}
                stroke={axisColor}
                strokeWidth={1}
              />
            ))}
            {candles.map(candle => (
              <Rect
                key={`${candle.key}-body`}
                x={candle.centerX - candleWidth / 2}
                y={candle.bodyTop}
                width={candleWidth}
                height={Math.max(candle.bodyBottom - candle.bodyTop, 1)}
                fill={candle.isBullish ? bullishColor : bearishColor}
                stroke={candle.isBullish ? bullishColor : bearishColor}
                rx={2}
              />
            ))}
            <SvgText x={svgWidth} y={12} fontSize={12} fill={axisLabelColor} textAnchor="end">
              {max.toFixed(1)} USD
            </SvgText>
            <SvgText
              x={svgWidth}
              y={CHART_HEIGHT - 6}
              fontSize={12}
              fill={axisLabelColor}
              textAnchor="end"
            >
              {min.toFixed(1)} USD
            </SvgText>
          </Svg>
          <View style={styles.legend}>
            <Text variant="bodyLarge" style={styles.legendText}>
              期間: {chartData.length > 0 ? chartData[0].date : '--'} ～ {latest?.date ?? '--'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: CHART_HORIZONTAL_PADDING,
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
  chartCard: {
    borderRadius: 16,
  },
  chartContent: {
    paddingHorizontal: 0,
    alignItems: 'center',
    gap: 12,
  },
  legend: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendText: {
    fontWeight: '600',
  },
});
