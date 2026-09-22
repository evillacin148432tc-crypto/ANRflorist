import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

export default function StockHistory() {
  const router = useRouter();
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error) setMovements(data);
    else console.log("STOCK HISTORY ERROR:", error);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = movements.filter((m) =>
    m.material_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace("/reports")}>
        <Text style={styles.back}>← Back to Reports</Text>
      </Pressable>

      <Text style={styles.title}>Stock Movement Log</Text>
      <Text style={styles.hint}>Most recent 200 changes across all items.</Text>

      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by material name..."
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.material}>{item.material_name}</Text>
              <Text style={styles.reason}>{item.reason}</Text>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>

            <Text
              style={[
                styles.change,
                { color: Number(item.change_amount) >= 0 ? "green" : "red" },
              ]}
            >
              {Number(item.change_amount) > 0 ? "+" : ""}
              {item.change_amount}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text>No stock changes recorded yet.</Text>}
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
  },

  hint: {
    color: "gray",
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
    marginBottom: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  material: {
    fontWeight: "bold",
    fontSize: 15,
  },

  reason: {
    color: "#555",
    marginTop: 2,
  },

  date: {
    color: "gray",
    fontSize: 12,
    marginTop: 2,
  },

  change: {
    fontWeight: "bold",
    fontSize: 16,
    minWidth: 60,
    textAlign: "right",
  },
});
