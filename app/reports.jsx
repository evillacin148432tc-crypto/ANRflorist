import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";

import { Link, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Reports() {
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
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <StaffHeader title="Reports" subtitle="Sales and order overview" />

      {/* Revenue */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>
          Total revenue · delivered orders
        </Text>
        <Text style={styles.revenueValue}>
          ₱
          {revenue.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text style={styles.revenueHint}>
          {counts.delivered} delivered order{counts.delivered === 1 ? "" : "s"}
        </Text>
      </View>

      {/* Status tiles */}
      <Text style={styles.sectionLabel}>Orders by status</Text>
      <View style={styles.statsRow}>
        <StatBox
          icon="🛎️"
          label="Active"
          value={activeOrders}
          color={colors.plum}
          tint={colors.plumTint}
        />
        <StatBox
          icon="✅"
          label="Delivered"
          value={counts.delivered}
          color={colors.fern}
          tint={colors.fernTint}
        />
        <StatBox
          icon="✖️"
          label="Cancelled"
          value={counts.cancelled}
          color={colors.brick}
          tint={colors.brickTint}
        />
      </View>
      <View style={styles.statsRow}>
        <StatBox
          icon="⏳"
          label="Pending"
          value={counts.pending}
          color={colors.marigold}
          tint={colors.marigoldTint}
        />
        <StatBox
          icon="🛠️"
          label="Preparing"
          value={counts.preparing}
          color={colors.plum}
          tint={colors.plumTint}
        />
        <StatBox
          icon="🚚"
          label="Out for delivery"
          value={counts.out_for_delivery}
          color="#2F7D9A"
          tint="#E3F1F6"
        />
      </View>

      {/* Best sellers */}
      <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
        Best-selling bouquets
      </Text>
      <View style={styles.listCard}>
        {bestSellers.length === 0 ? (
          <EmptyState
            icon="💐"
            title="No sales yet"
            text="Best sellers appear here once orders are delivered."
          />
        ) : (
          bestSellers.map((b, idx) => (
            <View
              key={b.name}
              style={[
                styles.sellerRow,
                idx < bestSellers.length - 1 && styles.rowDivider,
              ]}
            >
              <Text style={styles.sellerRank}>
                {MEDALS[idx] || `${idx + 1}.`}
              </Text>
              <Text style={styles.sellerName} numberOfLines={1}>
                {b.name}
              </Text>
              <View style={styles.qtyPill}>
                <Text style={styles.qtyText}>{b.qty} sold</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Audit records */}
      <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
        Audit records
      </Text>
      <Text style={styles.hint}>
        Full, tamper-proof logs for training and review.
      </Text>

      <View style={styles.listCard}>
        <Link href="/stock-history" asChild>
          <Pressable style={styles.linkRow}>
            <View style={styles.linkIcon}>
              <Text style={{ fontSize: 16 }}>📦</Text>
            </View>
            <Text style={styles.linkText}>Stock movement log</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>

        <View style={styles.rowDividerLine} />

        <Link href="/verification-history" asChild>
          <Pressable style={styles.linkRow}>
            <View style={styles.linkIcon}>
              <Text style={{ fontSize: 16 }}>🪪</Text>
            </View>
            <Text style={styles.linkText}>Customer verification log</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

function StatBox({ icon, label, value, color, tint }) {
  return (
    <View style={[styles.statBox, { backgroundColor: tint }]}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  revenueCard: {
    backgroundColor: colors.plum,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  revenueLabel: {
    color: colors.white,
    opacity: 0.85,
    fontWeight: "600",
    fontSize: 13,
  },
  revenueValue: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.white,
    marginTop: 6,
  },
  revenueHint: {
    color: colors.white,
    opacity: 0.75,
    fontSize: 12,
    marginTop: 4,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },

  hint: {
    color: colors.inkSoft,
    fontSize: 12,
    marginBottom: spacing.sm,
    marginTop: -4,
  },

  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  statBox: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: "700" },
  statLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },

  listCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: "hidden",
  },

  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowDividerLine: { height: 1, backgroundColor: colors.line },
  sellerRank: { width: 28, fontSize: 18, fontWeight: "700", color: colors.ink },
  sellerName: { flex: 1, fontWeight: "700", color: colors.ink, fontSize: 15 },
  qtyPill: {
    backgroundColor: colors.plumTint,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  qtyText: { color: colors.plum, fontSize: 12, fontWeight: "700" },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  chevron: { fontSize: 22, color: colors.inkSoft },
});
