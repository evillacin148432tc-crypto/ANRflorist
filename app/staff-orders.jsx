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
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";

const STATUS_FLOW = ["pending", "preparing", "out_for_delivery", "delivered"];

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
  out_for_delivery: "#2F7D9A",
  delivered: colors.fern,
  cancelled: colors.brick,
};

const STATUS_TINT = {
  pending: colors.marigoldTint,
  preparing: colors.plumTint,
  out_for_delivery: "#E3F1F6",
  delivered: colors.fernTint,
  cancelled: colors.brickTint,
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

  const statusColor = STATUS_COLOR[order.order_status] || colors.inkSoft;
  const statusTint = STATUS_TINT[order.order_status] || colors.line;

  return (
    <View style={[styles.card, { borderLeftColor: statusColor }]}>
      <Pressable onPress={toggle}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusTint }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABEL[order.order_status] || order.order_status}
            </Text>
          </View>
        </View>

        <Text style={styles.date}>
          {new Date(order.created_at).toLocaleString()}
        </Text>

        <Text style={styles.total}>₱{order.total_amount}</Text>

        <Text style={styles.address}>
          📍 {order.delivery_address}, {order.delivery_barangay}
        </Text>
        {!!order.delivery_notes && (
          <Text style={styles.notes}>📝 {order.delivery_notes}</Text>
        )}

        <Text style={styles.expandHint}>
          {expanded ? "Hide items ▲" : "View items ▼"}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.itemsBox}>
          {items === null ? (
            <Text style={styles.itemLine}>Loading items...</Text>
          ) : (
            items.map((it, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemQty}>{it.quantity}×</Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {it.product?.name || "Item"}
                </Text>
                <Text style={styles.itemPrice}>₱{it.price}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {(nextStatus || canCancel) && (
        <View style={styles.buttonRow}>
          {nextStatus && (
            <Pressable
              style={[styles.advanceButton, busy && { opacity: 0.6 }]}
              onPress={advance}
              disabled={busy}
            >
              <Text style={styles.advanceText}>
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
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default function StaffOrders() {
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
      <StaffHeader
        title="Orders"
        subtitle={`${orders.length} ${filter === "active" ? "active" : "total"}`}
      />

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
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => <OrderCard order={item} onChanged={load} />}
        ListEmptyComponent={
          <EmptyState
            icon="📦"
            title="No orders to show"
            text={
              filter === "active"
                ? "New orders will appear here as customers place them."
                : "There are no orders yet."
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.lg,
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.md,
  },

  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  filterText: { color: colors.inkSoft, fontWeight: "600", fontSize: 13 },
  filterTextActive: { color: colors.white, fontWeight: "700", fontSize: 13 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 5,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },

  orderId: { fontWeight: "700", fontSize: 16, color: colors.ink },

  statusPill: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  statusText: { fontWeight: "700", fontSize: 12 },

  date: { color: colors.inkSoft, marginTop: 4, fontSize: 12 },

  total: {
    marginTop: spacing.sm,
    fontSize: 22,
    fontWeight: "700",
    color: colors.plum,
  },

  address: { marginTop: 6, color: colors.ink, fontSize: 14 },
  notes: {
    marginTop: 4,
    color: colors.inkSoft,
    fontSize: 13,
    fontStyle: "italic",
  },

  expandHint: {
    marginTop: spacing.sm,
    color: colors.plum,
    fontSize: 12,
    fontWeight: "700",
  },

  itemsBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemQty: { fontWeight: "700", color: colors.plum, width: 30 },
  itemName: { flex: 1, color: colors.ink, fontSize: 14 },
  itemPrice: { color: colors.inkSoft, fontSize: 13 },
  itemLine: { color: colors.inkSoft },

  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  advanceButton: {
    flex: 2,
    backgroundColor: colors.fern,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  advanceText: { color: colors.white, fontWeight: "700" },

  cancelButton: {
    flex: 1,
    backgroundColor: colors.brickTint,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { color: colors.brick, fontWeight: "700" },
});
