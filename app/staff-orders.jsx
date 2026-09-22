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

const STATUS_FLOW = ["pending", "preparing", "out_for_delivery", "delivered"];

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

  async function advance() {
    const currentIndex = STATUS_FLOW.indexOf(order.order_status);
    const next = STATUS_FLOW[currentIndex + 1];

    if (!next) return;

    setBusy(true);
    const { error } = await supabase.rpc("update_order_status", {
      p_order_id: order.id,
      p_status: next,
      p_remarks: null,
    });
    setBusy(false);

    if (error) {
      showMessage("Update Failed", error.message);
      return;
    }

    onChanged();
  }

  async function cancel() {
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

  const currentIndex = STATUS_FLOW.indexOf(order.order_status);
  const nextStatus = STATUS_FLOW[currentIndex + 1];
  const canCancel =
    order.order_status === "pending" || order.order_status === "preparing";

  return (
    <View style={styles.card}>
      <Pressable onPress={toggle}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
          <Text
            style={[styles.status, { color: STATUS_COLOR[order.order_status] }]}
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
        {!!order.delivery_notes && (
          <Text style={styles.notes}>Notes: {order.delivery_notes}</Text>
        )}
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

      <View style={styles.buttonRow}>
        {nextStatus && (
          <Pressable
            style={[styles.advanceButton, busy && { opacity: 0.6 }]}
            onPress={advance}
            disabled={busy}
          >
            <Text style={styles.buttonText}>
              Mark as {STATUS_LABEL[nextStatus]}
            </Text>
          </Pressable>
        )}

        {canCancel && (
          <Pressable
            style={[styles.cancelButton, busy && { opacity: 0.6 }]}
            onPress={cancel}
            disabled={busy}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function StaffOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("active"); // "active" | "all"

  useFocusEffect(
    useCallback(() => {
      load();
    }, [filter]),
  );

  async function load() {
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter === "active") {
      query = query.in("order_status", [
        "pending",
        "preparing",
        "out_for_delivery",
      ]);
    }

    const { data, error } = await query;
    if (!error) setOrders(data);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace("/")}>
        <Text style={styles.back}>← Back to Inventory</Text>
      </Pressable>

      <Text style={styles.title}>Orders</Text>

      <View style={styles.filterRow}>
        <Pressable
          style={[
            styles.filterChip,
            filter === "active" && styles.filterChipActive,
          ]}
          onPress={() => setFilter("active")}
        >
          <Text
            style={
              filter === "active" ? styles.filterTextActive : styles.filterText
            }
          >
            Active
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterChip,
            filter === "all" && styles.filterChipActive,
          ]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={
              filter === "all" ? styles.filterTextActive : styles.filterText
            }
          >
            All
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => <OrderCard order={item} onChanged={load} />}
        ListEmptyComponent={<Text>No orders to show.</Text>}
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
    marginBottom: 12,
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 15,
  },

  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#999",
  },

  filterChipActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },

  filterText: {
    color: "#333",
  },

  filterTextActive: {
    color: "#fff",
    fontWeight: "bold",
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

  notes: {
    marginTop: 2,
    color: "#444",
    fontStyle: "italic",
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

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  advanceButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  cancelButton: {
    flex: 1,
    backgroundColor: "red",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
