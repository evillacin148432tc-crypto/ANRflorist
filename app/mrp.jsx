import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";

import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";

// Suggested reorder = fill back up to the maximum (or 2x minimum if no maximum is set)
function suggestReorder(item) {
  const current = Number(item.current_stock);
  const min = Number(item.minimum_stock);
  const max = Number(item.maximum_stock);

  const target = max > 0 ? max : min * 2;
  const suggested = target - current;

  return suggested > 0 ? Math.ceil(suggested) : 0;
}

// How full the stock bar is (0 to 1)
function fillOf(item) {
  const current = Number(item.current_stock);
  const min = Number(item.minimum_stock);
  const max = Number(item.maximum_stock);
  const target = max > 0 ? max : min * 2;

  if (target <= 0) return 0;
  return Math.max(0, Math.min(current / target, 1));
}

export default function MRP() {
  const [lowStock, setLowStock] = useState([]);
  const [demand, setDemand] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const [invResult, demandResult] = await Promise.all([
      supabase
        .from("inventory")
        .select("*")
        .order("material_name", { ascending: true }),
      supabase
        .from("mrp_demand")
        .select("*")
        .order("demand_in_active_orders", { ascending: false }),
    ]);

    if (!invResult.error) {
      const low = invResult.data.filter(
        (item) => Number(item.current_stock) <= Number(item.minimum_stock),
      );
      setLowStock(low);
    } else {
      console.log("INVENTORY LOAD ERROR:", invResult.error);
    }

    if (!demandResult.error) {
      setDemand(demandResult.data);
    } else {
      console.log("MRP DEMAND ERROR:", demandResult.error);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <StaffHeader title="Material Planning" subtitle="Know what to buy next" />

      {/* Reorder suggestions */}
      <Text style={styles.sectionTitle}>🛒 Reorder suggestions</Text>
      <Text style={styles.hint}>
        Items at or below their minimum stock level, with a suggested quantity
        to bring them back up to a healthy level.
      </Text>

      {lowStock.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="✅"
            title="All stocked up"
            text="Nothing needs reordering right now."
          />
        </View>
      ) : (
        lowStock.map((item) => {
          const suggested = suggestReorder(item);
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.material_name}
                </Text>
                <View
                  style={[styles.pill, { backgroundColor: colors.brickTint }]}
                >
                  <Text style={[styles.pillText, { color: colors.brick }]}>
                    Low stock
                  </Text>
                </View>
              </View>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${fillOf(item) * 100}%`,
                      backgroundColor: colors.brick,
                    },
                  ]}
                />
              </View>

              <Text style={styles.line}>
                Current {item.current_stock} {item.unit} · Minimum{" "}
                {item.minimum_stock} {item.unit}
              </Text>

              <View style={styles.suggestBox}>
                <Text style={styles.suggestLabel}>Suggested reorder</Text>
                <Text style={styles.suggestValue}>
                  {suggested} {item.unit}
                </Text>
              </View>
            </View>
          );
        })
      )}

      {/* Demand */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
        📋 Demand from active orders
      </Text>
      <Text style={styles.hint}>
        How much of each material is committed to orders that are pending,
        preparing, or out for delivery.
      </Text>

      {demand.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="📭"
            title="No active orders"
            text="Materials needed for orders will show up here."
          />
        </View>
      ) : (
        demand.map((d) => {
          const short =
            Number(d.demand_in_active_orders) > Number(d.current_stock);

          return (
            <View key={d.inventory_id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {d.material_name}
                </Text>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: short
                        ? colors.brickTint
                        : colors.fernTint,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: short ? colors.brick : colors.fern },
                    ]}
                  >
                    {short ? "Not enough" : "Enough stock"}
                  </Text>
                </View>
              </View>

              <Text style={styles.line}>
                Needed by {d.active_order_count} active order
                {d.active_order_count > 1 ? "s" : ""}:{" "}
                <Text style={styles.bold}>
                  {d.demand_in_active_orders} {d.unit}
                </Text>
              </Text>
              <Text style={styles.line}>
                Currently in stock: {d.current_stock} {d.unit}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },

  hint: {
    color: colors.inkSoft,
    marginTop: 4,
    marginBottom: spacing.md,
    fontSize: 13,
    lineHeight: 18,
  },

  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },

  name: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },

  pill: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pillText: { fontSize: 12, fontWeight: "700" },

  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  barFill: { height: "100%", borderRadius: 4 },

  line: { marginTop: 6, color: colors.inkSoft, fontSize: 13 },
  bold: { fontWeight: "700", color: colors.ink },

  suggestBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.marigoldTint,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  suggestLabel: { color: colors.marigold, fontWeight: "600", fontSize: 13 },
  suggestValue: { color: colors.marigold, fontWeight: "700", fontSize: 16 },
});
