import React, { useCallback, useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import Svg, { G, Line, Path } from 'react-native-svg'

export interface IndicatorMiniChartSeries {
  id: string
  color: string
  values: (number | null)[]
  strokeWidth?: number
}

export interface IndicatorReferenceLine {
  id: string
  value: number
  color?: string
  dashArray?: string
  strokeWidth?: number
  opacity?: number
}

export interface IndicatorMiniChartProps {
  series: IndicatorMiniChartSeries[]
  referenceLines?: IndicatorReferenceLine[]
  min?: number
  max?: number
  height?: number
  style?: StyleProp<ViewStyle>
  padding?: number
}

const DEFAULT_HEIGHT = 140
const DEFAULT_PADDING = 12

export const IndicatorMiniChart: React.FC<IndicatorMiniChartProps> = ({
  series,
  referenceLines,
  min,
  max,
  height = DEFAULT_HEIGHT,
  style,
  padding = DEFAULT_PADDING,
}) => {
  const [size, setSize] = useState({ width: 0, height })

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height: nextHeight } = event.nativeEvent.layout
      if (width === size.width && nextHeight === size.height) {
        return
      }
      setSize({ width, height: nextHeight })
    },
    [size.height, size.width],
  )

  const innerWidth = Math.max(size.width - padding * 2, 0)
  const innerHeight = Math.max(size.height - padding * 2, 0)
  const pointCount = series.reduce((maxLength, line) => Math.max(maxLength, line.values.length), 0)
  const step = pointCount > 1 ? innerWidth / (pointCount - 1) : 0

  const range = useMemo(() => {
    let computedMin = min ?? Infinity
    let computedMax = max ?? -Infinity

    if (min == null || max == null) {
      series.forEach((line) => {
        line.values.forEach((value) => {
          if (value == null) {
            return
          }
          if (min == null) {
            computedMin = Math.min(computedMin, value)
          }
          if (max == null) {
            computedMax = Math.max(computedMax, value)
          }
        })
      })
    }

    const resolvedMin = Number.isFinite(computedMin) ? computedMin : min ?? 0
    const resolvedMax = Number.isFinite(computedMax) ? computedMax : max ?? 1

    if (resolvedMin === resolvedMax) {
      const delta = Math.abs(resolvedMin) * 0.05 || 1
      return { min: resolvedMin - delta, max: resolvedMax + delta }
    }

    return {
      min: min ?? resolvedMin,
      max: max ?? resolvedMax,
    }
  }, [max, min, series])

  const valueToY = useCallback(
    (value: number) => {
      const clamped = Math.min(Math.max(value, range.min), range.max)
      const ratio = (clamped - range.min) / (range.max - range.min || 1)
      return innerHeight - ratio * innerHeight
    },
    [innerHeight, range.max, range.min],
  )

  const paths = useMemo(
    () =>
      series.map((line) => ({
        id: line.id,
        color: line.color,
        strokeWidth: line.strokeWidth ?? 2,
        d: buildPath(line.values, step, valueToY),
      })),
    [series, step, valueToY],
  )

  const containerStyle = useMemo(() => [styles.container, { height }, style], [height, style])

  return (
    <View style={containerStyle} onLayout={handleLayout}>
      {size.width > 0 && size.height > 0 && innerWidth > 0 && innerHeight > 0 ? (
        <Svg width={size.width} height={size.height}>
          <G transform={`translate(${padding}, ${padding})`}>
            {referenceLines?.map((line) => (
              <Line
                key={line.id}
                x1={0}
                x2={innerWidth}
                y1={valueToY(line.value)}
                y2={valueToY(line.value)}
                stroke={line.color ?? '#9E9E9E'}
                strokeDasharray={line.dashArray}
                strokeWidth={line.strokeWidth ?? 1}
                opacity={line.opacity ?? 0.5}
              />
            ))}
            {paths.map((path) =>
              path.d ? (
                <Path
                  key={path.id}
                  d={path.d}
                  stroke={path.color}
                  strokeWidth={path.strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null,
            )}
          </G>
        </Svg>
      ) : null}
    </View>
  )
}

function buildPath(
  values: (number | null)[],
  step: number,
  valueToY: (value: number) => number,
): string | null {
  if (values.length === 0) {
    return null
  }
  let path = ''
  let started = false

  values.forEach((value, index) => {
    if (value == null) {
      started = false
      return
    }
    const x = step * index
    const y = valueToY(value)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return
    }
    if (!started) {
      path += `M ${x} ${y} `
      started = true
    } else {
      path += `L ${x} ${y} `
    }
  })

  const trimmed = path.trim()
  return trimmed.length > 0 ? trimmed : null
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
})

export default IndicatorMiniChart
