import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useCart } from "../lib/CartProvider";
import { useAuth } from "../lib/AuthProvider";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius } from "../lib/theme";
import Icon from "../lib/Icon";

export default function Catalog() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addItem, totalItems } = useCart();
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    params.category || "All",
  );
  const [wishlistIds, setWishlistIds] = useState(new Set());

  // If Home links here with a category (e.g. "Bouquet"), pre-select it once.
  useEffect(() => {
    if (params.category) setActiveCategory(params.category);
  }, [params.category]);

  useFocusEffect(
    useCallback(() => {
      load();
      loadWishlist();
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

  async function loadWishlist() {
    if (!user) return;

    const { data, error } = await supabase
      .from("wishlists")
      .select("product_id")
      .eq("customer_id", user.id);

    if (!error) setWishlistIds(new Set(data.map((w) => w.product_id)));
  }

  async function toggleWishlist(productId) {
    if (!user) return;

    const isSaved = wishlistIds.has(productId);

    // optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(productId) : next.add(productId);
      return next;
    });

    if (isSaved) {
      await supabase
        .from("wishlists")
        .delete()
        .eq("customer_id", user.id)
        .eq("product_id", productId);
    } else {
      await supabase
        .from("wishlists")
        .insert({ customer_id: user.id, product_id: productId });
    }
  }

  const categories = useMemo(() => {
    const set = new Set(
      products
        .map((p) => (p.category || "").trim())
        .filter((c) => c.length > 0),
    );
    return ["All", ...Array.from(set)];
  }, [products]);

  const filtered = products.filter((p) => {
    const matchesCategory =
      activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Explore</Text>

        <View style={styles.topIcons}>
          <Pressable
            style={styles.iconCircle}
            onPress={() => router.push("/orders")}
          >
            <Icon name="notifications-outline" size={20} color={colors.plum} />
          </Pressable>

          <Pressable
            style={styles.iconCircle}
            onPress={() => router.push("/cart")}
          >
            <Icon name="cart-outline" size={20} color={colors.plum} />
            {totalItems > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalItems}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search bouquets..."
        placeholderTextColor={colors.inkSoft}
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(c) => c}
        style={styles.chipList}
        contentContainerStyle={{ gap: spacing.sm, alignItems: "center" }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setActiveCategory(item)}
            style={[styles.chip, activeCategory === item && styles.chipActive]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.chipText,
                activeCategory === item && styles.chipTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        )}
      />

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 100 }}
        renderItem={({ item }) => {
          const saved = wishlistIds.has(item.id);

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/product-detail",
                  params: { id: String(item.id) },
                })
              }
            >
              <View>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.thumb}
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Icon name="flower-outline" size={30} color={colors.plum} />
                  </View>
                )}

                <Pressable
                  style={styles.heartButton}
                  onPress={() => toggleWishlist(item.id)}
                >
                  <Icon
                    name={saved ? "heart" : "heart-outline"}
                    size={16}
                    color={saved ? colors.brick : colors.inkSoft}
                  />
                </Pressable>
              </View>

              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.category}>{item.category}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.price}>₱{item.price}</Text>

                <Pressable
                  style={styles.addButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    addItem(item, 1);
                  }}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No bouquets match your search.</Text>
        }
      />

      <CustomerTabBar active="explore" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  title: { fontSize: 20, fontWeight: "700", color: colors.ink },

  topIcons: { flexDirection: "row", gap: spacing.sm },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },

  iconGlyph: { fontSize: 18 },

  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.brick,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },

  search: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    fontSize: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    marginBottom: spacing.md,
  },

  chipList: {
    flexGrow: 0,
    flexShrink: 0,
    height: 40,
    marginBottom: spacing.md,
  },

  chip: {
    flexShrink: 0,
    alignSelf: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },

  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  chipTextActive: { color: colors.white },

  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
  },

  thumb: {
    width: "100%",
    height: 100,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
    marginBottom: spacing.sm,
  },

  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },

  heartButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },

  name: { fontSize: 14, fontWeight: "700", color: colors.ink },
  category: { fontSize: 11, color: colors.inkSoft, marginTop: 1 },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },

  price: { fontSize: 14, fontWeight: "700", color: colors.plum },

  addButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.fern,
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 16,
  },

  empty: { color: colors.inkSoft, textAlign: "center", marginTop: spacing.xl },
});
