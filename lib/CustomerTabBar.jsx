import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "./theme";
import Icon from "./Icon";

const TABS = [
  { key: "home", label: "Home", icon: "home", route: "/customer" },
  { key: "explore", label: "Explore", icon: "search", route: "/catalog" },
  { key: "wishlist", label: "Wishlist", icon: "heart", route: "/wishlist" },
  {
    key: "chat",
    label: "Chat",
    icon: "chatbubble-ellipses",
    route: "/support",
  },
  { key: "profile", label: "Profile", icon: "person", route: "/profile" },
];

export default function CustomerTabBar({ active }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => router.replace(tab.route)}
          >
            <View style={[styles.pill, isActive && styles.pillActive]}>
              <Icon
                name={isActive ? tab.icon : `${tab.icon}-outline`}
                size={21}
                color={isActive ? colors.plum : colors.inkSoft}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.label, isActive && styles.labelActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Screens using this bar should add paddingBottom (~100) to their scroll content.
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
    paddingTop: 6,
    shadowColor: "#4E2D75",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, minWidth: 0 },
  pill: {
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: colors.plumTint },
  label: { fontSize: 11, color: colors.inkSoft, fontWeight: "600" },
  labelActive: { color: colors.plum, fontWeight: "700" },
});
