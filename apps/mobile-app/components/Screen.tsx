import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from "react-native";

type ScreenProps = ViewProps & {
  title: string;
  loading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
};

export function Screen({ title, loading, error, children, style, ...rest }: ScreenProps) {
  return (
    <ScrollView contentContainerStyle={[styles.container, style]} {...rest}>
      <Text style={styles.title}>{title}</Text>
      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewProps["style"];
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 56,
    backgroundColor: "#0f172a",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 16,
  },
  spinner: { marginVertical: 24 },
  error: { color: "#f87171", marginBottom: 12 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
});
