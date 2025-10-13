/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useTheme } from 'react-native-paper';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const colorFromProps = scheme === 'dark' ? props.dark : props.light;

  if (colorFromProps) {
    return colorFromProps;
  }

  switch (colorName) {
    case 'text':
      return theme.colors.onSurface;
    case 'background':
      return theme.colors.background;
    case 'tint':
      return theme.colors.primary;
    case 'icon':
      return theme.colors.onSurfaceVariant ?? theme.colors.onSurface;
    case 'tabIconDefault':
      return theme.colors.onSurfaceVariant ?? Colors[scheme].tabIconDefault;
    case 'tabIconSelected':
      return theme.colors.primary;
    default:
      return Colors[scheme][colorName];
  }
}
