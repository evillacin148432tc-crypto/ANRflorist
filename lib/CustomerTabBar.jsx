import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "./theme";

const TABS = [
  { key: "home", label: "Home", icon: "🏠", route: "/customer" },
  { key: "explore", label: "Explore", icon: "🔍", route: "/catalog" },
  { key: "wishlist", label: "Wishlist", icon: "❤️", route: "/wishlist" },
  { key: "chat", label: "Chat", icon: "💬", route: "/support" },
  { key: "profile", label: "Profile", icon: "👤", route: "/profile" },
];

export default function CustomerTabBar({ active }) {
  const router = useRouter();

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => router.replace(tab.route)}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Screens using this bar should add paddingBottom (~80) to their scroll
// content so the last item isn't hidden behind it.
const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },

  icon: {
    fontSize: 18,
  },

  label: {
    fontSize: 11,
    color: colors.inkSoft,
    fontWeight: "600",
  },

  labelActive: {
    color: colors.plum,
  },
});
