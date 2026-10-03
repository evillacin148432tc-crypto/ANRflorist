import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
  Keyboard,
} from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useCart } from "../lib/CartProvider";
import { useAuth } from "../lib/AuthProvider";
import CustomerTabBar from "../lib/CustomerTabBar";
import OrderBell from "../lib/OrderBell";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, type, shadow, layout } from "../lib/theme";
import Icon from "../lib/Icon";

// The shop's main product types. A product belongs to a group when its
// category or name contains one of the keywords (so "Money Bills" -> Money Bouquet).
const SHOP_CATEGORIES = [
  { label: "Money Bouquet", keys: ["money"] },
  { label: "Fresh Bouquet", keys: ["fresh"] },
  { label: "Fuzzy Wire Bouquet", keys: ["fuzzy", "wire"] },
  { label: "Chocolate Bouquet", keys: ["chocolate"] },
  { label: "Satin Bouquet", keys: ["satin"] },
  { label: "Balloons & etc.", keys: ["balloon", "filler"] },
];

function groupOf(category) {
  const c = (category || "").toLowerCase();
  return SHOP_CATEGORIES.find((g) => g.keys.some((k) => c.includes(k)));
}

function inCategory(product, label) {
  if (label === "All") return true;
  const group = SHOP_CATEGORIES.find((g) => g.label === label);
  if (group) {
    const hay = `${product.category || ""} ${product.name || ""}`.toLowerCase();
    return group.keys.some((k) => hay.includes(k));
  }
  return product.category === label;
}

export default function Catalog() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addItem, totalItems } = useCart();
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    params.category
      ? groupOf(params.category)?.label || params.category
      : "All",
  );
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef(null);
  const insets = useSafeAreaInsets();

  // If Home links here with a category (e.g. "Bouquet"), pre-select it once.
  useEffect(() => {
    if (params.category)
      setActiveCategory(groupOf(params.category)?.label || params.category);
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
    const extra = new Set(
      products
        .map((p) => (p.category || "").trim())
        .filter((c) => c.length > 0 && !groupOf(c)),
    );
    return [
      "All",
      ...SHOP_CATEGORIES.map((g) => g.label),
      ...Array.from(extra),
    ];
  }, [products]);

  // Relevance score: 0 = no match. Higher = better.
  function score(p, q) {
    const name = (p.name || "").toLowerCase();
    const cat = (p.category || "").toLowerCase();
    if (!q) return 1;
    if (name.startsWith(q)) return 6;
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return 5;
    if (name.includes(q)) return 4;
    if (cat.includes(q)) return 3;
    // loose match: letters appear in order ("mb" -> "Money Bills")
    let i = 0;
    for (const ch of name) if (ch === q[i]) i++;
    return i === q.length ? 2 : 0;
  }

  const q = search.trim().toLowerCase();

  const filtered = products.filter((p) => {
    return inCategory(p, activeCategory) && score(p, q) > 0;
  });

  // Live suggestions shown under the search box (best matches first)
  const suggestions = useMemo(() => {
    if (!q) return [];
    return products
      .map((p) => ({ p, s: score(p, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
      .slice(0, 5)
      .map((x) => x.p);
  }, [products, q]);

  const showSuggestions = focused && q.length > 0;

  function pickSuggestion(p) {
    clearTimeout(blurTimer.current);
    setSearch(p.name);
    setActiveCategory("All");
    setFocused(false);
    Keyboard.dismiss();
  }

  // Bold the part of the name that matches what was typed
  function Highlighted({ text }) {
    const i = text.toLowerCase().indexOf(q);
    if (i < 0)
      return (
        <Text style={styles.sugName} numberOfLines={1}>
          {text}
        </Text>
      );
    return (
      <Text style={styles.sugName} numberOfLines={1}>
        {text.slice(0, i)}
        <Text style={styles.sugMatch}>{text.slice(i, i + q.length)}</Text>
        {text.slice(i + q.length)}
      </Text>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.inner}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Explore</Text>

          <View style={styles.topIcons}>
            <OrderBell />

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

        {/* Search + suggestions (sits above the grid) */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
            <Icon name="search" size={18} color={colors.inkSoft} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              onFocus={() => {
                clearTimeout(blurTimer.current);
                setFocused(true);
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setFocused(false), 180);
              }}
              placeholder="Search bouquets..."
              placeholderTextColor={colors.inkSoft}
              returnKeyType="search"
              onSubmitEditing={() => {
                setFocused(false);
                Keyboard.dismiss();
              }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={10}>
                <Icon name="close-circle" size={18} color={colors.inkSoft} />
              </Pressable>
            )}
          </View>

          {showSuggestions && (
            <View style={styles.dropdown}>
              {suggestions.length === 0 ? (
                <View style={styles.sugEmpty}>
                  <Icon
                    name="search-outline"
                    size={18}
                    color={colors.inkSoft}
                  />
                  <Text style={styles.sugEmptyText}>
                    No bouquets match "{search}"
                  </Text>
                </View>
              ) : (
                suggestions.map((p, idx) => (
                  <Pressable
                    key={String(p.id)}
                    style={[styles.sugRow, idx > 0 && styles.sugDivider]}
                    onPress={() => pickSuggestion(p)}
                  >
                    {p.image_url ? (
                      <Image
                        source={{ uri: p.image_url }}
                        style={styles.sugThumb}
                      />
                    ) : (
                      <View style={[styles.sugThumb, styles.thumbPlaceholder]}>
                        <Icon
                          name="flower-outline"
                          size={16}
                          color={colors.plum}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Highlighted text={p.name} />
                      <Text style={styles.sugCat} numberOfLines={1}>
                        {p.category}
                      </Text>
                    </View>
                    <Text style={styles.sugPrice}>₱{p.price}</Text>
                    <Icon
                      name="arrow-up-outline"
                      size={14}
                      color={colors.inkSoft}
                      style={{ transform: [{ rotate: "-45deg" }] }}
                    />
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>

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
              style={[
                styles.chip,
                activeCategory === item && styles.chipActive,
              ]}
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => setFocused(false)}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{
            gap: spacing.md,
            paddingBottom: 110 + insets.bottom,
          }}
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
                      <Icon
                        name="flower-outline"
                        size={30}
                        color={colors.plum}
                      />
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
                <Text style={styles.category} numberOfLines={1}>
                  {item.category}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.price}>₱{item.price}</Text>

                  <Pressable
                    style={styles.addButton}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      addItem(item, 1);
                    }}
                  >
                    <Icon name="add" size={16} color={colors.white} />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="search-outline" size={30} color={colors.plum} />
              </View>
              <Text style={styles.empty}>No bouquets match your search.</Text>
            </View>
          }
        />
      </View>

      <CustomerTabBar active="explore" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  inner: {
    flex: 1,
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: { ...type.display },
  topIcons: { flexDirection: "row", gap: spacing.sm },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: colors.brick,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },

  searchWrap: { zIndex: 50, elevation: 50, marginBottom: spacing.md },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  searchBoxFocused: { borderColor: colors.plum },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 12,
  },

  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    shadowColor: "#4E2D75",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  sugRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  sugDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  sugThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.plumTint,
  },
  sugName: { fontSize: 14, color: colors.ink },
  sugMatch: { fontWeight: "800", color: colors.plum },
  sugCat: { fontSize: 11, color: colors.inkSoft, marginTop: 1 },
  sugPrice: { fontSize: 13, fontWeight: "700", color: colors.plum },
  sugEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.lg,
  },
  sugEmptyText: { color: colors.inkSoft, fontSize: 13, flex: 1 },

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
    ...shadow,
  },
  thumb: {
    width: "100%",
    height: 110,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
    marginBottom: spacing.sm,
  },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  heartButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  name: { fontSize: 14, fontWeight: "700", color: colors.ink },
  category: { fontSize: 11, color: colors.inkSoft, marginTop: 1 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  price: { fontSize: 15, fontWeight: "800", color: colors.plum },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fern,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyBox: { alignItems: "center", marginTop: 40, gap: 10 },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { color: colors.inkSoft, textAlign: "center" },
});
