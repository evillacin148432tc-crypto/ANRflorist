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

export default function VerificationHistory() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const { data: rows, error } = await supabase
      .from("verification_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.log("VERIFICATION HISTORY ERROR:", error);
      return;
    }

    // verification_logs stores raw user ids, so fetch names separately and merge.
    const ids = [
      ...new Set(
        rows.flatMap((r) => [r.customer_id, r.admin_id]).filter(Boolean),
      ),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);

    const nameById = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p.full_name]),
    );

    setLogs(
      rows.map((r) => ({
        ...r,
        customer_name: nameById[r.customer_id] || "Unknown",
        admin_name: nameById[r.admin_id] || "Unknown",
      })),
    );
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace("/reports")}>
        <Text style={styles.back}>← Back to Reports</Text>
      </Pressable>

      <Text style={styles.title}>Customer Verification Log</Text>
      <Text style={styles.hint}>Most recent 200 approve/reject decisions.</Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.line}>
              <Text style={styles.bold}>{item.customer_name}</Text> was{" "}
              <Text
                style={[
                  styles.bold,
                  { color: item.action === "approved" ? "green" : "red" },
                ]}
              >
                {item.action}
              </Text>{" "}
              by {item.admin_name}
            </Text>

            {!!item.remarks && (
              <Text style={styles.remarks}>"{item.remarks}"</Text>
            )}

            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text>No verification decisions recorded yet.</Text>
        }
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

  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  line: {
    fontSize: 15,
  },

  bold: {
    fontWeight: "bold",
  },

  remarks: {
    marginTop: 4,
    color: "#555",
    fontStyle: "italic",
  },

  date: {
    color: "gray",
    fontSize: 12,
    marginTop: 4,
  },
});
