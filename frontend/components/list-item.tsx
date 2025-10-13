import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Text, useTheme } from 'react-native-paper';

export type MarketQuote = {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  currency?: string;
};

type ListItemProps = {
  title: string;
  quote?: MarketQuote;
  loading?: boolean;
  error?: string;
  fractionDigits?: number;
};

export function ListItem({ title, quote, loading, error, fractionDigits = 2 }: ListItemProps) {
  const theme = useTheme();
  const price = quote?.regularMarketPrice;
  const change = quote?.regularMarketChange;
  const changePercent = quote?.regularMarketChangePercent;
  const currency = quote?.currency;
  const positiveColor = theme.colors.tertiary ?? '#16a34a';
  const changeColor =
    change === undefined || change === 0
      ? theme.colors.onSurface
      : change > 0
      ? positiveColor
      : theme.colors.error;

  const formatNumber = (value: number | undefined) => {
    if (value === undefined || Number.isNaN(value)) {
      return '--';
    }
    return value.toLocaleString('ja-JP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
  };

  const formatChangeText = () => {
    if (change === undefined || changePercent === undefined) {
      return '--';
    }
    const sign = change > 0 ? '+' : change < 0 ? '-' : '';
    const formattedChange = formatNumber(Math.abs(change));
    const formattedPercent = Math.abs(changePercent).toFixed(2);
    return `${sign}${formattedChange} (${sign}${formattedPercent}%)`;
  };

  return (
    <Card mode="elevated" style={styles.card} elevation={2}>
      <Card.Content style={styles.content}>
        <View style={styles.leftContainer}>
          <Text variant="titleMedium">{title}</Text>
          <Text variant="bodyMedium" style={styles.symbol}>
            {quote?.symbol ?? '--'}
          </Text>
          {quote?.shortName ? (
            <Text variant="bodySmall" style={styles.shortName}>
              {quote.shortName}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightContainer}>
          {loading ? (
            <ActivityIndicator animating color={theme.colors.primary} />
          ) : error ? (
            <Text variant="bodyMedium" style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : (
            <>
              <Text variant="headlineSmall" style={styles.price}>
                {formatNumber(price)}
                {currency ? ` ${currency}` : ''}
              </Text>
              <Text variant="bodyMedium" style={[styles.change, { color: changeColor }]}>
                {formatChangeText()}
              </Text>
            </>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  leftContainer: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  rightContainer: {
    alignItems: 'flex-end',
    minWidth: 120,
    gap: 6,
  },
  symbol: {
    opacity: 0.7,
  },
  shortName: {
    opacity: 0.7,
  },
  price: {
    fontWeight: '600',
  },
  change: {
    fontWeight: '500',
  },
  errorText: {
    textAlign: 'right',
  },
});
