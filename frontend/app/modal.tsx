import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export default function ModalScreen() {
  const theme = useTheme();
  const containerStyle = [styles.container, { backgroundColor: theme.colors.background }];

  return (
    <View style={containerStyle}>
      <Text variant="headlineMedium" style={styles.title}>
        This is a modal
      </Text>
      <Link href="/" dismissTo style={styles.link}>
        <Text variant="bodyMedium" style={styles.linkText}>
          Go to home screen
        </Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontWeight: '700',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
});
