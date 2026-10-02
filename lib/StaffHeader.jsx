import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, type } from "./theme";
import Icon from "./Icon";

/**
 * Shared header for staff/admin sub-screens.
 *   <StaffHeader title="Orders" />
 *   <StaffHeader title="Bouquets" subtitle="12 total" right={<SomeButton />} />
 * Adds the phone's top safe-area automatically.
 */
export default function StaffHeader({ title, subtitle, right }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <Pressable style={styles.backPill} onPress={() => router.replace("/")}>
        <Icon name="chevron-back" size={16} color={colors.plum} />
        <Text style={styles.backText}>Inventory</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}

/** Friendly empty state with an icon. */
export function EmptyState({ icon = "flower-outline", title, text }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} color={colors.plum} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  backPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  backText: { color: colors.plum, fontSize: 13, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { ...type.display },
  subtitle: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  emptyText: {
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: 13,
    textAlign: "center",
  },
});
