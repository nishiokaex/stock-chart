import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { PaperProvider, adaptNavigationTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { darkTheme, lightTheme } from '@/constants/theme';

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

  const paperTheme = isDark ? darkTheme : lightTheme;
  const navigationTheme = isDark
    ? {
        ...paperNavigationDark,
        colors: {
          ...paperNavigationDark.colors,
          background: darkTheme.colors.background,
          card: darkTheme.colors.surface,
          primary: darkTheme.colors.primary,
          text: darkTheme.colors.onSurface,
        },
      }
    : {
        ...paperNavigationLight,
        colors: {
          ...paperNavigationLight.colors,
          background: lightTheme.colors.background,
          card: lightTheme.colors.surface,
          primary: lightTheme.colors.primary,
          text: lightTheme.colors.onSurface,
        },
      };

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={navigationTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </ThemeProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
