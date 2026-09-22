import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Image,
  Alert,
  Platform,
} from "react-native";

import { Link, useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";

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

export default function Products() {
  const router = useRouter();
  const { role } = useAuth();

  const [products, setProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.log("PRODUCTS LOAD ERROR:", error);
      return;
    }

    setProducts(data);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function deleteProduct(item) {
    const confirmed = await confirmAction(
      "Delete Bouquet",
      `Delete "${item.name}"? This also removes its material recipe.`,
    );

    if (!confirmed) return;

    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", item.id)
      .select();

    if (error) {
      showMessage("Delete Failed", error.message);
      return;
    }

    if (!data || data.length === 0) {
      showMessage("Delete Failed", "Nothing was deleted.");
      return;
    }

    setProducts((prev) => prev.filter((p) => p.id !== item.id));
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace("/")}>
        <Text style={styles.back}>← Back to Inventory</Text>
      </Pressable>

      <Text style={styles.title}>Bouquets</Text>

      <Link href="/product-edit" asChild>
        <Pressable style={styles.addButton}>
          <Text style={styles.addText}>+ Add New Bouquet</Text>
        </Pressable>
      </Link>

      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={{ fontSize: 24 }}>💐</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.variant && (
                  <Text style={styles.variant}>{item.variant}</Text>
                )}
                <Text style={styles.category}>Category: {item.category}</Text>
                <Text style={styles.price}>₱{item.price}</Text>
                <Text
                  style={[
                    styles.status,
                    { color: item.is_available ? "green" : "red" },
                  ]}
                >
                  {item.is_available ? "AVAILABLE" : "UNAVAILABLE"}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Link
                href={{
                  pathname: "/product-edit",
                  params: { id: String(item.id) },
                }}
                asChild
              >
                <Pressable style={styles.editButton}>
                  <Text style={styles.buttonText}>Edit</Text>
                </Pressable>
              </Link>

              {role === "admin" && (
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => deleteProduct(item)}
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text>No bouquets yet.</Text>}
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

  row: {
    flexDirection: "row",
    gap: 12,
  },

  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#eee",
  },

  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  name: {
    fontSize: 18,
    fontWeight: "bold",
  },

  variant: {
    color: "#555",
  },

  category: {
    marginTop: 4,
    color: "gray",
  },

  price: {
    marginTop: 4,
    fontWeight: "600",
  },

  status: {
    marginTop: 4,
    fontWeight: "bold",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
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
