import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Appbar, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Appbar.Header
      statusBarHeight={insets.top}
      mode="center-aligned"
      elevated
      style={[styles.header, { backgroundColor: theme.colors.elevation.level2 }]}
    >
      <Appbar.Content title={title} subtitle={subtitle} />
      {actions}
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
  },
});
