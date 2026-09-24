import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { useCart } from "../lib/CartProvider";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type } from "../lib/theme";

export default function Wishlist() {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [items, setItems] = useState([]);

  // Recreated when the user changes, so it never runs with a stale null user
  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]); // guest, or auth not ready yet
      return;
    }

    const { data, error } = await supabase
      .from("wishlists")
      .select("product_id, product:product_id (*)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) setItems(data.filter((row) => row.product));
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function remove(productId) {
    if (!user?.id) return;

    setItems((prev) => prev.filter((row) => row.product_id !== productId));

    await supabase
      .from("wishlists")
      .delete()
      .eq("customer_id", user.id)
      .eq("product_id", productId);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wishlist</Text>

      <FlatList
        data={items}
        keyExtractor={(row) => row.product_id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item: row }) => {
          const p = row.product;
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/product-detail",
                  params: { id: String(p.id) },
                })
              }
            >
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={{ fontSize: 24 }}>💐</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.price}>₱{p.price}</Text>
              </View>

              <Pressable
                style={styles.addButton}
                onPress={(e) => {
                  e.stopPropagation?.();
                  addItem(p, 1);
                }}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>

              <Pressable
                style={styles.removeButton}
                onPress={(e) => {
                  e.stopPropagation?.();
                  remove(p.id);
                }}
              >
                <Text style={{ fontSize: 16 }}>🗑️</Text>
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🤍</Text>
            <Text style={styles.emptyText}>
              Tap the heart on any bouquet to save it here.
            </Text>
          </View>
        }
      />

      <CustomerTabBar active="wishlist" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  title: { ...type.display, marginBottom: spacing.lg },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
  },

  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },

  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  price: { fontSize: 14, fontWeight: "700", color: colors.plum, marginTop: 2 },

  addButton: {
    backgroundColor: colors.fern,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },

  addButtonText: { color: colors.white, fontWeight: "700", fontSize: 12 },

  removeButton: { padding: 4 },

  empty: { alignItems: "center", marginTop: 80, gap: spacing.sm },
  emptyText: { color: colors.inkSoft, textAlign: "center", maxWidth: 220 },
});
