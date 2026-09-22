import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

// Suggested reorder = fill back up to the maximum (or 2x minimum if no maximum is set)
function suggestReorder(item) {
  const current = Number(item.current_stock);
  const min = Number(item.minimum_stock);
  const max = Number(item.maximum_stock);

  const target = max > 0 ? max : min * 2;
  const suggested = target - current;

  return suggested > 0 ? Math.ceil(suggested) : 0;
}

export default function MRP() {
  const router = useRouter();

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
    <View style={styles.container}>
      <Pressable onPress={() => router.replace("/")}>
        <Text style={styles.back}>← Back to Inventory</Text>
      </Pressable>

      <Text style={styles.title}>Material Planning</Text>

      <FlatList
        data={[{ type: "header" }]}
        keyExtractor={() => "wrapper"}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={() => (
          <View>
            <Text style={styles.sectionTitle}>Reorder Suggestions</Text>
            <Text style={styles.hint}>
              Items at or below their minimum stock level, with a suggested
              quantity to bring them back up to a healthy level.
            </Text>

            {lowStock.length === 0 ? (
              <Text style={styles.empty}>
                Nothing needs reordering right now.
              </Text>
            ) : (
              lowStock.map((item) => {
                const suggested = suggestReorder(item);
                return (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.name}>{item.material_name}</Text>
                    <Text style={styles.line}>
                      Current: {item.current_stock} {item.unit} | Minimum:{" "}
                      {item.minimum_stock} {item.unit}
                    </Text>
                    <Text style={styles.suggest}>
                      Suggested reorder: {suggested} {item.unit}
                    </Text>
                  </View>
                );
              })
            )}

            <Text style={[styles.sectionTitle, { marginTop: 30 }]}>
              Demand From Active Orders
            </Text>
            <Text style={styles.hint}>
              How much of each material is committed to orders that are pending,
              preparing, or out for delivery.
            </Text>

            {demand.length === 0 ? (
              <Text style={styles.empty}>No active orders right now.</Text>
            ) : (
              demand.map((d) => (
                <View key={d.inventory_id} style={styles.card}>
                  <Text style={styles.name}>{d.material_name}</Text>
                  <Text style={styles.line}>
                    Needed by {d.active_order_count} active order
                    {d.active_order_count > 1 ? "s" : ""}:{" "}
                    {d.demand_in_active_orders} {d.unit}
                  </Text>
                  <Text style={styles.line}>
                    Currently in stock: {d.current_stock} {d.unit}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
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
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },

  hint: {
    color: "gray",
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
  },

  empty: {
    color: "gray",
  },

  card: {
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  name: {
    fontWeight: "bold",
    fontSize: 16,
  },

  line: {
    marginTop: 4,
    color: "#444",
  },

  suggest: {
    marginTop: 6,
    fontWeight: "bold",
    color: "#E67E00",
  },
});
