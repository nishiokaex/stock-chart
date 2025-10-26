import { MD3DarkTheme, MD3LightTheme, MD3Theme } from 'react-native-paper';
import { Platform } from 'react-native';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    background: '#ffffff',
    surface: '#ffffff',
    surfaceVariant: '#f5f5f5',
    onSurface: 'rgba(0, 0, 0, 0.87)',
    onSurfaceVariant: 'rgba(0, 0, 0, 0.6)',
    onSurfaceDisabled: 'rgba(0, 0, 0, 0.38)',
    surfaceDisabled: 'rgba(0, 0, 0, 0.12)',
    outline: 'rgba(0, 0, 0, 0.12)',
    outlineVariant: 'rgba(0, 0, 0, 0.12)',
    inverseSurface: '#121212',
    inverseOnSurface: '#ffffff',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    background: '#121212',
    surface: '#121212',
    surfaceVariant: '#1e1e1e',
    onSurface: '#ffffff',
    onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
    onSurfaceDisabled: 'rgba(255, 255, 255, 0.5)',
    surfaceDisabled: 'rgba(255, 255, 255, 0.12)',
    outline: 'rgba(255, 255, 255, 0.12)',
    outlineVariant: 'rgba(255, 255, 255, 0.12)',
    inverseSurface: '#ffffff',
    inverseOnSurface: '#121212',
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
