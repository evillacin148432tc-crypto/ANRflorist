import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { useCart } from "../lib/CartProvider";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type, shadow, layout } from "../lib/theme";
import Icon from "../lib/Icon";

const useNative = Platform.OS !== "web";

export default function Wishlist() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addItem, totalItems } = useCart();

  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  // per-product button state: "loading" | "added"
  const [btn, setBtn] = useState({});
  const [toast, setToast] = useState("");
  const toastAnim = useRef(new Animated.Value(0)).current;
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
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

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function remove(productId) {
    if (!user?.id) return;
    setItems((prev) => prev.filter((row) => row.product_id !== productId));
    await supabase
      .from("wishlists")
      .delete()
      .eq("customer_id", user.id)
      .eq("product_id", productId);
  }

  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  function showToast(text) {
    setToast(text);
    toastAnim.stopAnimation();
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: useNative,
    }).start();
    later(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: useNative,
      }).start();
    }, 2200);
  }

  // Add button: spinner -> "Added" check -> back to "Add"
  function handleAdd(p) {
    if (btn[p.id]) return;
    setBtn((s) => ({ ...s, [p.id]: "loading" }));
    later(() => {
      addItem(p, 1);
      setBtn((s) => ({ ...s, [p.id]: "added" }));
      showToast(`${p.name} added to cart`);
      later(() => {
        setBtn((s) => {
          const next = { ...s };
          delete next[p.id];
          return next;
        });
      }, 1400);
    }, 600);
  }

  function renderItem({ item: row }) {
    const p = row.product;
    const state = btn[p.id];

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
            <Icon name="flower-outline" size={28} color={colors.plum} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.price}>₱{p.price}</Text>

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.addButton,
                state === "added" && styles.addButtonDone,
                state === "loading" && styles.addButtonBusy,
              ]}
              disabled={!!state}
              onPress={() => handleAdd(p)}
            >
              {state === "loading" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Icon
                  name={state === "added" ? "checkmark" : "cart-outline"}
                  size={15}
                  color={colors.white}
                />
              )}
              <Text style={styles.addButtonText}>
                {state === "loading"
                  ? "Adding"
                  : state === "added"
                    ? "Added"
                    : "Add to cart"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.removeButton}
              hitSlop={8}
              onPress={() => remove(p.id)}
            >
              <Icon name="trash-outline" size={18} color={colors.brick} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.inner, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Wishlist</Text>
            <Text style={styles.subtitle}>
              {items.length} saved bouquet{items.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Pressable
            style={styles.cartCircle}
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

        <FlatList
          data={items}
          keyExtractor={(row) => String(row.product_id)}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{
            paddingBottom: 110 + insets.bottom,
            flexGrow: 1,
          }}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="heart-outline" size={34} color={colors.plum} />
              </View>
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyText}>
                Tap the heart on any bouquet to save it here.
              </Text>
              <Pressable
                style={styles.browse}
                onPress={() => router.replace("/catalog")}
              >
                <Text style={styles.browseText}>Browse bouquets</Text>
              </Pressable>
            </View>
          }
        />
      </View>

      <Animated.View
        pointerEvents={toast ? "box-none" : "none"}
        style={[
          styles.toast,
          {
            bottom: 84 + insets.bottom,
            opacity: toastAnim,
            transform: [
              {
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.toastCheck}>
          <Icon name="checkmark" size={14} color={colors.white} />
        </View>
        <Text style={styles.toastText} numberOfLines={1}>
          {toast}
        </Text>
        <Pressable onPress={() => router.push("/cart")} hitSlop={8}>
          <Text style={styles.toastLink}>View cart</Text>
        </Pressable>
      </Animated.View>

      <CustomerTabBar active="wishlist" />
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: { ...type.display },
  subtitle: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
  cartCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
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

  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadow,
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
  },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  info: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  price: { fontSize: 16, fontWeight: "800", color: colors.plum, marginTop: 2 },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addButton: {
    flex: 1,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.fern,
    borderRadius: radius.sm,
  },
  addButtonBusy: { opacity: 0.85 },
  addButtonDone: { backgroundColor: colors.plum },
  addButtonText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  removeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.brickTint,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
    gap: 6,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  emptyText: { color: colors.inkSoft, textAlign: "center", maxWidth: 240 },
  browse: {
    marginTop: spacing.md,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  browseText: { color: colors.white, fontWeight: "700" },

  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: layout.maxWidth - spacing.lg * 2,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...shadow,
  },
  toastCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.fern,
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: { flex: 1, color: colors.white, fontSize: 13, fontWeight: "600" },
  toastLink: { color: "#D9C2F2", fontWeight: "800", fontSize: 13 },
});
