import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  adaptNavigationTheme,
} from 'react-native-paper';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const lightTheme = {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: Colors.light.tint,
      secondary: Colors.light.tint,
      background: Colors.light.background,
      surface: '#ffffff',
      onSurface: Colors.light.text,
    },
  };

  const darkTheme = {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: Colors.dark.tint,
      secondary: Colors.dark.tint,
      background: Colors.dark.background,
      surface: '#1e1f20',
      onSurface: Colors.dark.text,
    },
  };

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
