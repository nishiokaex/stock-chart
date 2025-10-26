import { MD3DarkTheme, MD3LightTheme, MD3Theme } from 'react-native-paper';
import { Platform } from 'react-native';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
  },
};

export const Colors = {
  light: {
    text: lightTheme.colors.onSurface,
    background: lightTheme.colors.background,
    tint: lightTheme.colors.primary,
    icon: lightTheme.colors.onSurfaceVariant ?? lightTheme.colors.onSurface,
    tabIconDefault: lightTheme.colors.onSurfaceVariant ?? lightTheme.colors.onSurface,
    tabIconSelected: lightTheme.colors.primary,
  },
  dark: {
    text: darkTheme.colors.onSurface,
    background: darkTheme.colors.background,
    tint: darkTheme.colors.primary,
    icon: darkTheme.colors.onSurfaceVariant ?? darkTheme.colors.onSurface,
    tabIconDefault: darkTheme.colors.onSurfaceVariant ?? darkTheme.colors.onSurface,
    tabIconSelected: darkTheme.colors.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
