import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { supabase } from "./supabase";
import { useAuth } from "./AuthProvider";
import { colors, shadow } from "./theme";
import Icon from "./Icon";

// The bell in the top bar. Shows how many of the customer's orders are still
// in progress and opens "My Orders". Keeps itself up to date (realtime plus a
// light refresh), so every screen that uses it always shows the same number.
export default function OrderBell({ style }) {
  const router = useRouter();
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const instance = useRef(Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    if (!user?.id) return;

    const { count: c, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .not("order_status", "in", "(delivered,cancelled)");

    if (!error) setCount(c ?? 0);
  }, [user?.id]);

  // Refresh whenever the screen is shown, plus every 10s as a safety net.
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 10000);
      return () => clearInterval(timer);
    }, [load]),
  );

  // Live: new orders and status changes update the badge instantly.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`order-bell-${user.id}-${instance.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  return (
    <Pressable
      style={[styles.circle, style]}
      onPress={() => router.push("/orders")}
      accessibilityLabel="My orders"
    >
      <Icon name="notifications-outline" size={20} color={colors.plum} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: colors.brick,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
});
