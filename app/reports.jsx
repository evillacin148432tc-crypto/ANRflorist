import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";

import { Link, useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

export default function Reports() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const [revenue, setRevenue] = useState(0);
  const [counts, setCounts] = useState({
    pending: 0,
    preparing: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [bestSellers, setBestSellers] = useState([]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    // Orders: get status + total so we can total revenue and count each stage
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("order_status, total_amount");

    if (!ordersError && orders) {
      const nextCounts = {
        pending: 0,
        preparing: 0,
        out_for_delivery: 0,
        delivered: 0,
        cancelled: 0,
      };
      let total = 0;

      for (const o of orders) {
        if (nextCounts[o.order_status] !== undefined) {
          nextCounts[o.order_status] += 1;
        }
        if (o.order_status === "delivered") {
          total += Number(o.total_amount) || 0;
        }
      }

      setCounts(nextCounts);
      setRevenue(total);
    } else if (ordersError) {
      console.log("ORDERS REPORT ERROR:", ordersError);
    }

    // Best sellers: quantity sold across delivered orders, by product
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(
        "quantity, product:product_id (name), order:order_id!inner (order_status)",
      )
      .eq("order.order_status", "delivered");

    if (!itemsError && items) {
      const totals = {};
      for (const it of items) {
        const name = it.product?.name || "Unknown";
        totals[name] = (totals[name] || 0) + it.quantity;
      }

      const sorted = Object.entries(totals)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      setBestSellers(sorted);
    } else if (itemsError) {
      console.log("BEST SELLERS ERROR:", itemsError);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const activeOrders =
    counts.pending + counts.preparing + counts.out_for_delivery;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <Pressable onPress={() => router.replace("/")}>
        <Text style={styles.back}>← Back to Inventory</Text>
      </Pressable>

      <Text style={styles.title}>Reports</Text>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>
          Total Revenue (Delivered Orders)
        </Text>
        <Text style={styles.revenueValue}>₱{revenue.toFixed(2)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Orders by Status</Text>
      <View style={styles.statsRow}>
        <StatBox label="Active" value={activeOrders} color="#2196F3" />
        <StatBox label="Delivered" value={counts.delivered} color="green" />
        <StatBox label="Cancelled" value={counts.cancelled} color="red" />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="Pending" value={counts.pending} color="#E67E00" />
        <StatBox label="Preparing" value={counts.preparing} color="#2196F3" />
        <StatBox
          label="Out for Delivery"
          value={counts.out_for_delivery}
          color="#9C27B0"
        />
      </View>

      <Text style={styles.sectionTitle}>Best-Selling Bouquets</Text>
      <Text style={styles.hint}>Based on delivered orders.</Text>

      {bestSellers.length === 0 ? (
        <Text style={styles.empty}>No delivered orders yet.</Text>
      ) : (
        bestSellers.map((b, idx) => (
          <View key={b.name} style={styles.sellerRow}>
            <Text style={styles.sellerRank}>{idx + 1}.</Text>
            <Text style={styles.sellerName}>{b.name}</Text>
            <Text style={styles.sellerQty}>{b.qty} sold</Text>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>
        Audit Records
      </Text>
      <Text style={styles.hint}>
        Full, tamper-proof logs for training and review.
      </Text>

      <Link href="/stock-history" asChild>
        <Pressable style={styles.linkCard}>
          <Text style={styles.linkCardText}>Stock Movement Log →</Text>
        </Pressable>
      </Link>

      <Link href="/verification-history" asChild>
        <Pressable style={styles.linkCard}>
          <Text style={styles.linkCardText}>Customer Verification Log →</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function StatBox({ label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

  revenueCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#A5D6A7",
    marginBottom: 20,
  },

  revenueLabel: {
    color: "#2E7D32",
    fontWeight: "600",
  },

  revenueValue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#1B5E20",
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 8,
  },

  hint: {
    color: "gray",
    marginBottom: 10,
    fontSize: 13,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  statBox: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    alignItems: "center",
  },

  statValue: {
    fontSize: 22,
    fontWeight: "bold",
  },

  statLabel: {
    marginTop: 4,
    color: "#555",
    fontSize: 12,
    textAlign: "center",
  },

  empty: {
    color: "gray",
  },

  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  sellerRank: {
    fontWeight: "bold",
    width: 20,
  },

  sellerName: {
    flex: 1,
    fontWeight: "600",
  },

  sellerQty: {
    color: "#555",
  },

  linkCard: {
    borderWidth: 1,
    borderColor: "#2196F3",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },

  linkCardText: {
    color: "#2196F3",
    fontWeight: "bold",
    fontSize: 15,
  },
});
