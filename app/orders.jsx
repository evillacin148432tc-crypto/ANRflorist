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

import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import CustomerTabBar from "../lib/CustomerTabBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "../lib/Icon";
import ZoomImage from "../lib/ZoomImage";
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
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Items are loaded up front for every order, so the card can show the
  // product photo and name right away.
  function toggle() {
    setExpanded((v) => !v);
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
          <Thumb product={items?.[0]?.product} size={64} />

          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.orderTitle} numberOfLines={2}>
                {orderTitle(items)}
              </Text>
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
          </View>
        </View>

        <Text style={styles.address}>
          Deliver to: {order.delivery_address}, {order.delivery_barangay}
        </Text>

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
                <Text style={styles.itemQty}>
                  {it.quantity} × ₱{it.price}
                </Text>
              </View>
            </View>
          ))}
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
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState([]);
  const [itemsByOrder, setItemsByOrder] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  // Live updates: status changes (Preparing, Delivered, ...) show up at once.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`my-orders-${user.id}`)
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
  }, [user?.id]);

  async function load() {
    if (!user) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return;
    setOrders(data);

    // Products (name + photo) for all of these orders in one query.
    const ids = (data || []).map((o) => o.id);
    if (ids.length === 0) return;

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, quantity, price, product:product_id (name, image_url)")
      .in("order_id", ids);

    if (itemsError) {
      console.log("ORDER ITEMS LOAD ERROR:", itemsError);
      return;
    }

    const grouped = {};
    ids.forEach((id) => {
      grouped[id] = [];
    });
    (items || []).forEach((it) => {
      grouped[it.order_id].push(it);
    });
    setItemsByOrder(grouped);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { paddingTop: spacing.lg + insets.top }]}>
        My Orders
      </Text>

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
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            items={itemsByOrder[item.id]}
            onChanged={load}
          />
        )}
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
    alignItems: "flex-start",
    gap: spacing.md,
  },
  thumb: { backgroundColor: colors.line },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  orderTitle: { flex: 1, fontWeight: "700", fontSize: 16, color: colors.ink },
  status: { fontWeight: "700", fontSize: 13 },

  date: { color: colors.inkSoft, marginTop: 4, fontSize: 13 },
  total: { marginTop: spacing.sm, fontWeight: "600", color: colors.ink },
  address: { marginTop: spacing.sm, color: colors.inkSoft },
  expandHint: {
    marginTop: spacing.sm,
    color: colors.plum,
    fontWeight: "700",
    fontSize: 12,
  },

  itemsBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  itemName: { color: colors.ink, fontWeight: "600" },
  itemQty: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },

  cancelButton: {
    marginTop: spacing.md,
    backgroundColor: colors.brick,
    padding: 10,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  cancelText: { color: colors.white, fontWeight: "700" },
});
