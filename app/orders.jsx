import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";

import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type } from "../lib/theme";

const STATUS_LABEL = {
  pending: "Pending",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR = {
  pending: colors.marigold,
  preparing: colors.plum,
  out_for_delivery: "#9C27B0",
  delivered: colors.fern,
  cancelled: colors.brick,
};

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(title, message) {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "No", style: "cancel", onPress: () => resolve(false) },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: () => resolve(true),
      },
    ]);
  });
}

function OrderCard({ order, onChanged }) {
  const [items, setItems] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    if (!items) {
      const { data, error } = await supabase
        .from("order_items")
        .select("quantity, price, product:product_id (name)")
        .eq("order_id", order.id);

      if (!error) setItems(data);
    }

    setExpanded(true);
  }

  async function cancelOrder() {
    const confirmed = await confirmAction(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
    );

    if (!confirmed) return;

    setBusy(true);
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: order.id,
    });
    setBusy(false);

    if (error) {
      showMessage("Cancel Failed", error.message);
      return;
    }

    onChanged();
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={toggle}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
          <Text
            style={[
              styles.status,
              { color: STATUS_COLOR[order.order_status] || colors.ink },
            ]}
          >
            {STATUS_LABEL[order.order_status] || order.order_status}
          </Text>
        </View>

        <Text style={styles.date}>
          {new Date(order.created_at).toLocaleString()}
        </Text>
        <Text style={styles.total}>Total: ₱{order.total_amount}</Text>
        <Text style={styles.address}>
          Deliver to: {order.delivery_address}, {order.delivery_barangay}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.itemsBox}>
          {items === null ? (
            <Text style={{ color: colors.inkSoft }}>Loading items...</Text>
          ) : (
            items.map((it, idx) => (
              <Text key={idx} style={styles.itemLine}>
                {it.quantity} x {it.product?.name || "Item"} — ₱{it.price} each
              </Text>
            ))
          )}
        </View>
      )}

      {order.order_status === "pending" && (
        <Pressable
          style={[styles.cancelButton, busy && { opacity: 0.6 }]}
          onPress={cancelOrder}
          disabled={busy}
        >
          <Text style={styles.cancelText}>Cancel order</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function Orders() {
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    if (!user) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) setOrders(data);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Orders</Text>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => <OrderCard order={item} onChanged={load} />}
        ListEmptyComponent={
          <Text style={styles.empty}>You haven't placed any orders yet.</Text>
        }
      />

      <CustomerTabBar active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  title: { ...type.display, padding: spacing.lg, paddingBottom: spacing.md },
  empty: { color: colors.inkSoft },

  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: { fontWeight: "700", fontSize: 16, color: colors.ink },
  status: { fontWeight: "700" },

  date: { color: colors.inkSoft, marginTop: 4, fontSize: 13 },
  total: { marginTop: spacing.sm, fontWeight: "600", color: colors.ink },
  address: { marginTop: 2, color: colors.inkSoft },

  itemsBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  itemLine: { marginBottom: 4, color: colors.ink },

  cancelButton: {
    marginTop: spacing.md,
    backgroundColor: colors.brick,
    padding: 10,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  cancelText: { color: colors.white, fontWeight: "700" },
});
