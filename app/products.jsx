import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Image,
  Alert,
  Platform,
} from "react-native";

import { Link, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";

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
  const { role } = useAuth();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
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

  const filtered = products.filter((p) => {
    const text = `${p.name || ""} ${p.category || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <View style={styles.container}>
      <StaffHeader
        title="Bouquets"
        subtitle={`${products.length} item${products.length === 1 ? "" : "s"}`}
        right={
          <Link href="/product-edit" asChild>
            <Pressable style={styles.addPill}>
              <Text style={styles.addPillText}>+ Add new</Text>
            </Pressable>
          </Link>
        }
      />

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search bouquets..."
        placeholderTextColor={colors.inkSoft}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
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
                  <Text style={{ fontSize: 30 }}>💐</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: item.is_available
                          ? colors.fernTint
                          : colors.brickTint,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: item.is_available ? colors.fern : colors.brick,
                        },
                      ]}
                    >
                      {item.is_available ? "Available" : "Unavailable"}
                    </Text>
                  </View>
                </View>

                {!!item.variant && (
                  <Text style={styles.variant}>{item.variant}</Text>
                )}
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.price}>₱{item.price}</Text>
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
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              </Link>

              {role === "admin" && (
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => deleteProduct(item)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="💐"
            title={products.length === 0 ? "No bouquets yet" : "No matches"}
            text={
              products.length === 0
                ? "Tap “+ Add new” to create your first bouquet."
                : "Try a different search."
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.paper,
  },

  addPill: {
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addPillText: { color: colors.white, fontWeight: "700", fontSize: 13 },

  search: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    fontSize: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    marginBottom: spacing.md,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  row: {
    flexDirection: "row",
    gap: spacing.md,
  },

  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.plumTint,
  },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },

  statusPill: {
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  variant: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
  category: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  price: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: colors.plum,
  },

  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.plum,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  editText: { color: colors.plum, fontWeight: "700" },

  deleteButton: {
    flex: 1,
    backgroundColor: colors.brickTint,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  deleteText: { color: colors.brick, fontWeight: "700" },
});
