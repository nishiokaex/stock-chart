import type { ViewProps } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  elevation?: number;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  elevation = 0,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();
  const backgroundColor = (theme.dark ? darkColor : lightColor) ?? theme.colors.background;

  return (
    <Surface
      mode="flat"
      elevation={elevation}
      style={[{ backgroundColor }, style]}
      {...otherProps}
    />
  );
}
