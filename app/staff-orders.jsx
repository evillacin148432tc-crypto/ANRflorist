import { useCallback, useEffect, useState } from "react";
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
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";
import Icon from "../lib/Icon";
import ZoomImage from "../lib/ZoomImage";

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

// Heading for an order: the product name, or "Name +N more".
function orderTitle(items) {
  if (!items) return "Loading...";
  if (items.length === 0) return "Order";
  const first = items[0].product?.name || "Item";
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

// Product photo you can tap to enlarge (flower icon when there is no photo).
function Thumb({ product, size }) {
  const box = { width: size, height: size, borderRadius: radius.sm };
  if (product?.image_url) {
    return (
      <ZoomImage
        uri={product.image_url}
        caption={product.name}
        style={[styles.thumb, box]}
      />
    );
  }
  return (
    <View style={[styles.thumb, styles.thumbEmpty, box]}>
      <Icon name="flower-outline" size={size * 0.4} color={colors.inkSoft} />
    </View>
  );
}

function OrderCard({ order, items, onChanged }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Items are loaded up front for every order, so each card can show the
  // product photo and name right away.
  function toggle() {
    setExpanded((v) => !v);
  }

  // Opens the chat thread with this order's customer.
  function messageCustomer() {
    router.push({
      pathname: "/chat-thread",
      params: {
        customerId: order.customer_id,
        name: order.customer?.full_name || order.customer?.email || "Customer",
        from: "orders",
        orderId: order.id,
      },
    });
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
          <Thumb product={items?.[0]?.product} size={68} />

          <View style={{ flex: 1 }}>
            <Text style={styles.orderTitle} numberOfLines={2}>
              {orderTitle(items)}
            </Text>
            {!!(order.customer?.full_name || order.customer?.email) && (
              <Text style={styles.customerName} numberOfLines={1}>
                {order.customer.full_name || order.customer.email}
              </Text>
            )}
            <Text style={styles.date}>
              {new Date(order.created_at).toLocaleString()}
            </Text>
            <Text style={styles.total}>₱{order.total_amount}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={[styles.statusPill, { backgroundColor: statusTint }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABEL[order.order_status] || order.order_status}
              </Text>
            </View>
            <Pressable
              style={styles.chatButton}
              onPress={messageCustomer}
              hitSlop={8}
              accessibilityLabel="Message customer"
            >
              <Icon
                name="chatbubble-ellipses-outline"
                size={18}
                color={colors.plum}
              />
            </Pressable>
          </View>
        </View>

        <Text style={styles.address}>
          {order.delivery_address}, {order.delivery_barangay}
        </Text>
        {!!order.delivery_notes && (
          <Text style={styles.notes}>Note: {order.delivery_notes}</Text>
        )}

        {!!items && items.length > 0 && (
          <Text style={styles.expandHint}>
            {expanded ? "Hide items ▲" : "View items ▼"}
          </Text>
        )}
      </Pressable>

      {expanded && !!items && (
        <View style={styles.itemsBox}>
          {items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Thumb product={it.product} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {it.product?.name || "Item"}
                </Text>
                <Text style={styles.itemQtyLine}>
                  {it.quantity} × ₱{it.price}
                </Text>
              </View>
            </View>
          ))}
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
  const [itemsByOrder, setItemsByOrder] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("active"); // "active" | "all"

  useFocusEffect(
    useCallback(() => {
      load();
    }, [filter]),
  );

  // Live updates: new orders and status changes from any device refresh this
  // list immediately, without staff needing to pull-to-refresh.
  useEffect(() => {
    const channel = supabase
      .channel("staff-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

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
    if (error) return;

    // Attach each customer's name so staff can see who they are messaging.
    const ids = [
      ...new Set((data || []).map((o) => o.customer_id).filter(Boolean)),
    ];
    let byId = {};
    if (ids.length > 0) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      (people || []).forEach((p) => {
        byId[p.id] = p;
      });
    }

    setOrders(
      (data || []).map((o) => ({ ...o, customer: byId[o.customer_id] })),
    );

    // Products (name + photo) for all of these orders in one query.
    const orderIds = (data || []).map((o) => o.id);
    if (orderIds.length === 0) return;

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, quantity, price, product:product_id (name, image_url)")
      .in("order_id", orderIds);

    if (itemsError) {
      console.log("ORDER ITEMS LOAD ERROR:", itemsError);
      return;
    }

    const grouped = {};
    orderIds.forEach((id) => {
      grouped[id] = [];
    });
    (items || []).forEach((it) => {
      grouped[it.order_id].push(it);
    });
    setItemsByOrder((prev) => ({ ...prev, ...grouped }));
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
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            items={itemsByOrder[item.id]}
            onChanged={load}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
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
    alignItems: "flex-start",
    gap: spacing.md,
  },

  thumb: { backgroundColor: colors.line },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },

  orderTitle: { fontWeight: "700", fontSize: 16, color: colors.ink },

  headerRight: { alignItems: "flex-end", gap: spacing.sm },
  chatButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  customerName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 4,
  },

  statusPill: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  statusText: { fontWeight: "700", fontSize: 12 },

  date: { color: colors.inkSoft, marginTop: 4, fontSize: 12 },

  total: {
    marginTop: 4,
    fontSize: 18,
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
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemName: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  itemQtyLine: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
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
