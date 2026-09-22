import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";

import { Link, useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useCart } from "../lib/CartProvider";
import { useAuth } from "../lib/AuthProvider";

export default function Catalog() {
  const router = useRouter();
  const { addItem, totalItems } = useCart();
  const { signOut } = useAuth();

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
      .eq("is_available", true)
      .order("name", { ascending: true });

    if (!error) setProducts(data);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Our Bouquets</Text>

        <View style={styles.topButtons}>
          <Link href="/orders" asChild>
            <Pressable style={styles.smallLink}>
              <Text style={styles.smallLinkText}>My Orders</Text>
            </Pressable>
          </Link>

          <Pressable style={styles.logoutButton} onPress={signOut}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={{ fontSize: 28 }}>💐</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {!!item.variant && (
                <Text style={styles.variant}>{item.variant}</Text>
              )}
              {!!item.description && (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <Text style={styles.price}>₱{item.price}</Text>
            </View>

            <Pressable
              style={styles.addButton}
              onPress={() => addItem(item, 1)}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text>No bouquets available right now.</Text>}
      />

      {totalItems > 0 && (
        <Pressable style={styles.cartBar} onPress={() => router.push("/cart")}>
          <Text style={styles.cartBarText}>
            View Cart ({totalItems} item{totalItems > 1 ? "s" : ""})
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
  },

  topButtons: {
    flexDirection: "row",
    gap: 8,
  },

  smallLink: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2196F3",
  },

  smallLinkText: {
    color: "#2196F3",
    fontWeight: "600",
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
    color: "#333",
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
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
    fontSize: 17,
    fontWeight: "bold",
  },

  variant: {
    color: "#555",
  },

  description: {
    color: "gray",
    marginTop: 2,
    fontSize: 13,
  },

  price: {
    marginTop: 4,
    fontWeight: "700",
  },

  addButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },

  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  cartBar: {
    backgroundColor: "#2196F3",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  cartBarText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
