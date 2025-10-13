import type { ComponentProps } from 'react';
import type { TextProps as RNTextProps } from 'react-native';
import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export type ThemedTextProps = RNTextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

const variantMap: Record<NonNullable<ThemedTextProps['type']>, ComponentProps<typeof Text>['variant']> = {
  default: 'bodyLarge',
  title: 'headlineMedium',
  defaultSemiBold: 'bodyLarge',
  subtitle: 'titleMedium',
  link: 'bodyMedium',
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const isDark = theme.dark;
  const fallbackColor = type === 'link' ? theme.colors.primary : theme.colors.onSurface;
  const color = (isDark ? darkColor : lightColor) ?? fallbackColor;

  return (
    <Text
      variant={variantMap[type]}
      style={[
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        { color },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    lineHeight: 24,
  },
  defaultSemiBold: {
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    fontWeight: '600',
  },
  link: {
    textDecorationLine: 'underline',
  },
});
