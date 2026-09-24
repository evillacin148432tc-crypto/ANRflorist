import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, radius, type } from "./theme";

/**
 * Shared header for staff/admin sub-screens.
 *
 *   <StaffHeader title="Orders" />
 *   <StaffHeader title="Bouquets" subtitle="12 total" right={<SomeButton />} />
 */
export default function StaffHeader({ title, subtitle, right }) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.backPill} onPress={() => router.replace("/")}>
        <Text style={styles.backText}>← Inventory</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {right}
      </View>
    </View>
  );
}

/** Friendly empty state with an icon. */
export function EmptyState({ icon = "🌸", title, text }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 30 }}>{icon}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },

  backPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },

  backText: {
    color: colors.plum,
    fontSize: 13,
    fontWeight: "700",
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  title: {
    ...type.display,
  },

  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    marginTop: 2,
  },

  empty: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },

  emptyText: {
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: 13,
    textAlign: "center",
  },
});
