import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
  Platform,
} from "react-native";

import { Link, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { logStockMovement } from "../lib/stockLog";
import { useAuth } from "../lib/AuthProvider";

// Alert.alert does NOT work on web, so these helpers handle both platforms.
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
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export default function Index() {
  const [inventory, setInventory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user, profile, role, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);

  // Reloads every time this screen comes into focus (e.g. after editing/adding)
  useFocusEffect(
    useCallback(() => {
      loadInventory();
      loadPendingCount();
      loadPendingOrderCount();
    }, []),
  );

  async function loadPendingCount() {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending");

    if (!error) setPendingCount(count ?? 0);
  }

  async function loadPendingOrderCount() {
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_status", "pending");

    if (!error) setPendingOrderCount(count ?? 0);
  }

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("material_name", {
        ascending: true,
      });

    console.log("DATA:", data);
    console.log("ERROR:", error);

    if (!error) {
      setInventory(data);
      const low = data.filter(
        (item) => Number(item.current_stock) <= Number(item.minimum_stock),
      );
      setLowStockCount(low.length);
    }
  }

  async function refreshInventory() {
    setRefreshing(true);

    await loadInventory();

    setRefreshing(false);
  }

  async function deleteInventory(item) {
    const confirmed = await confirmAction(
      "Delete Inventory",
      `Are you sure you want to delete "${item.material_name}"?`,
    );

    if (!confirmed) return;

    // .select() returns the deleted rows so we can tell if anything was really deleted
    const { data, error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", item.id)
      .select();

    console.log("DELETE DATA:", data);
    console.log("DELETE ERROR:", error);

    if (error) {
      showMessage("Delete Failed", error.message);
      return;
    }

    // No error but no rows deleted = blocked by Row Level Security
    if (!data || data.length === 0) {
      showMessage(
        "Delete Failed",
        "Nothing was deleted. Check the Supabase RLS delete policy on the inventory table.",
      );
      return;
    }

    // Audit trail: record that the remaining stock was removed
    await logStockMovement({
      inventoryId: item.id,
      materialName: item.material_name,
      before: Number(item.current_stock),
      after: 0,
      reason: "Item deleted",
    });

    setInventory((prev) => prev.filter((i) => i.id !== item.id));
    loadInventory();
  }

  function getStatus(item) {
    const current = Number(item.current_stock);
    const min = Number(item.minimum_stock);
    const max = Number(item.maximum_stock);

    if (current <= min) {
      return "LOW STOCK";
    }

    // maximum_stock of 0 (or empty) means "no maximum set"
    if (max > 0 && current > max) {
      return "OVERSTOCK";
    }

    return "AVAILABLE";
  }

  function getStatusColor(status) {
    if (status === "LOW STOCK") return "red";
    if (status === "OVERSTOCK") return "#E67E00";
    return "green";
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.who}>
          {profile?.full_name || user?.email} ({role})
        </Text>

        <Pressable style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>ANR Florist Inventory</Text>

      {(lowStockCount > 0 || pendingOrderCount > 0) && (
        <View style={styles.alertBanner}>
          {lowStockCount > 0 && (
            <Link href="/mrp" asChild>
              <Pressable>
                <Text style={styles.alertText}>
                  ⚠ {lowStockCount} item{lowStockCount > 1 ? "s" : ""} low on
                  stock — view reorder suggestions
                </Text>
              </Pressable>
            </Link>
          )}

          {pendingOrderCount > 0 && (
            <Link href="/staff-orders" asChild>
              <Pressable>
                <Text style={styles.alertText}>
                  🛒 {pendingOrderCount} new order
                  {pendingOrderCount > 1 ? "s" : ""} waiting to be prepared
                </Text>
              </Pressable>
            </Link>
          )}
        </View>
      )}

      <Link href="/add" asChild>
        <Pressable style={styles.addButton}>
          <Text style={styles.addText}>+ Add New Inventory</Text>
        </Pressable>
      </Link>

      <View style={styles.linkRow}>
        <Link href="/review" asChild>
          <Pressable style={styles.linkButton}>
            <Text style={styles.verifyText}>
              Verify Customers{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Text>
          </Pressable>
        </Link>

        <Link href="/products" asChild>
          <Pressable style={styles.linkButton}>
            <Text style={styles.verifyText}>Manage Bouquets</Text>
          </Pressable>
        </Link>

        <Link href="/staff-orders" asChild>
          <Pressable style={styles.linkButton}>
            <Text style={styles.verifyText}>Orders</Text>
          </Pressable>
        </Link>

        <Link href="/mrp" asChild>
          <Pressable style={styles.linkButton}>
            <Text style={styles.verifyText}>Material Planning</Text>
          </Pressable>
        </Link>

        <Link href="/reports" asChild>
          <Pressable style={styles.linkButton}>
            <Text style={styles.verifyText}>Reports</Text>
          </Pressable>
        </Link>

        {role === "admin" && (
          <Link href="/admin-users" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.verifyText}>Manage Users</Text>
            </Pressable>
          </Link>
        )}
      </View>

      <FlatList
        data={inventory}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshInventory}
          />
        }
        renderItem={({ item }) => {
          const status = getStatus(item);

          return (
            <View style={styles.card}>
              <Text style={styles.name}>{item.material_name}</Text>

              <Text style={styles.category}>Category: {item.category}</Text>

              <Text style={styles.stock}>
                Stock: {item.current_stock} {item.unit}
              </Text>

              <Text style={styles.limits}>
                Min: {item.minimum_stock} | Max:{" "}
                {Number(item.maximum_stock) > 0
                  ? item.maximum_stock
                  : "not set"}
              </Text>

              <Text style={[styles.status, { color: getStatusColor(status) }]}>
                {status}
              </Text>

              <View style={styles.buttonRow}>
                <Link
                  href={{ pathname: "/edit", params: { id: String(item.id) } }}
                  asChild
                >
                  <Pressable style={styles.editButton}>
                    <Text style={styles.buttonText}>Edit</Text>
                  </Pressable>
                </Link>

                {role === "admin" && (
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteInventory(item)}
                  >
                    <Text style={styles.buttonText}>Delete</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text>No inventory found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 15,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  who: {
    color: "gray",
    flex: 1,
  },

  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },

  logoutText: {
    fontWeight: "600",
  },

  alertBanner: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#FFE082",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },

  alertText: {
    color: "#8A6100",
    fontWeight: "600",
  },

  linkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },

  verifyButton: {
    borderWidth: 1,
    borderColor: "#2196F3",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  linkButton: {
    flexGrow: 1,
    minWidth: 150,
    borderWidth: 1,
    borderColor: "#2196F3",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  verifyText: {
    color: "#2196F3",
    fontSize: 16,
    fontWeight: "bold",
  },

  addButton: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: "center",
  },

  addText: {
    color: "#fff",
    fontSize: 16,
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

  name: {
    fontSize: 20,
    fontWeight: "bold",
  },

  category: {
    marginTop: 5,
    color: "gray",
  },

  stock: {
    marginTop: 10,
    fontSize: 16,
  },

  limits: {
    marginTop: 4,
    color: "gray",
  },

  status: {
    marginTop: 10,
    fontWeight: "bold",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },

  editButton: {
    flex: 1,
    backgroundColor: "#2196F3",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  deleteButton: {
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
