import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { PaperProvider, adaptNavigationTheme } from 'react-native-paper';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { flutterDarkTheme, flutterLightTheme } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { LightTheme: paperNavigationLight, DarkTheme: paperNavigationDark } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
  });

  const paperTheme = isDark ? flutterDarkTheme : flutterLightTheme;
  const navigationTheme = isDark
    ? {
        ...paperNavigationDark,
        colors: {
          ...paperNavigationDark.colors,
          background: flutterDarkTheme.colors.background,
          card: flutterDarkTheme.colors.surface,
          primary: flutterDarkTheme.colors.primary,
          text: flutterDarkTheme.colors.onSurface,
        },
      }
    : {
        ...paperNavigationLight,
        colors: {
          ...paperNavigationLight.colors,
          background: flutterLightTheme.colors.background,
          card: flutterLightTheme.colors.surface,
          primary: flutterLightTheme.colors.primary,
          text: flutterLightTheme.colors.onSurface,
        },
      };

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </PaperProvider>
  );
}
