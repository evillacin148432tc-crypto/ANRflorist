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

import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";

const STATUS_LABEL = {
  pending: "Pending",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR = {
  pending: "#E67E00",
  preparing: "#2196F3",
  out_for_delivery: "#9C27B0",
  delivered: "green",
  cancelled: "red",
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
              { color: STATUS_COLOR[order.order_status] || "#333" },
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
            <Text>Loading items...</Text>
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
          <Text style={styles.cancelText}>Cancel Order</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function Orders() {
  const router = useRouter();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
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
      <Pressable onPress={() => router.replace("/catalog")}>
        <Text style={styles.back}>← Back to Bouquets</Text>
      </Pressable>

      <Text style={styles.title}>My Orders</Text>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => <OrderCard order={item} onChanged={load} />}
        ListEmptyComponent={<Text>You haven't placed any orders yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },

  back: {
    color: "#2196F3",
    fontWeight: "600",
    marginBottom: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 15,
  },

  card: {
    padding: 15,
    marginBottom: 15,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  orderId: {
    fontWeight: "bold",
    fontSize: 16,
  },

  status: {
    fontWeight: "bold",
  },

  date: {
    color: "gray",
    marginTop: 4,
    fontSize: 13,
  },

  total: {
    marginTop: 6,
    fontWeight: "600",
  },

  address: {
    marginTop: 2,
    color: "#444",
  },

  itemsBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },

  itemLine: {
    marginBottom: 4,
  },

  cancelButton: {
    marginTop: 12,
    backgroundColor: "red",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  cancelText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
