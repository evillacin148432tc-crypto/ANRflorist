import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useCart } from "../lib/CartProvider";
import { useAuth } from "../lib/AuthProvider";
import { colors, spacing, radius, type } from "../lib/theme";
import Icon from "../lib/Icon";

const BUCKET = "bouquet-photos";
const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [photos, setPhotos] = useState([]); // array of URLs
  const [activeIndex, setActiveIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [saved, setSaved] = useState(false);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    load();
    loadPhotos();
  }, [id]);

  // Runs on its own so it re-fires once auth finishes restoring the session
  // (user goes from null to a real value) even though `id` hasn't changed.
  useEffect(() => {
    loadWishlistState();
  }, [id, user?.id]);

  async function load() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (!error) {
      setProduct(data);
      loadRelated(data.category);
    }
  }

  // Other available bouquets in the same category — real data, not fabricated
  // "you might also like" content, so it never shows something misleading.
  async function loadRelated(category) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .eq("is_available", true)
      .neq("id", id)
      .limit(6);

    if (!error) setRelated(data);
  }

  // All uploaded photos live in this bouquet's storage folder. If none exist
  // there (e.g. an older bouquet that only ever had a manually pasted URL),
  // fall back to the single image_url on the product itself.
  async function loadPhotos() {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(id, { sortBy: { column: "name", order: "asc" } });

    if (!error && data && data.length > 0) {
      const urls = data.map((file) => {
        const { data: pub } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${id}/${file.name}`);
        return pub.publicUrl;
      });
      setPhotos(urls);
      return;
    }

    const { data: p } = await supabase
      .from("products")
      .select("image_url")
      .eq("id", id)
      .single();
    setPhotos(p?.image_url ? [p.image_url] : []);
  }

  async function loadWishlistState() {
    if (!user?.id) {
      setSaved(false); // guest, or auth not ready yet
      return;
    }

    const { data } = await supabase
      .from("wishlists")
      .select("product_id")
      .eq("customer_id", user.id)
      .eq("product_id", id)
      .maybeSingle();

    setSaved(!!data);
  }

  async function toggleWishlist() {
    if (!user?.id) {
      router.push("/login"); // guests must sign in to save items
      return;
    }
    setSaved((prev) => !prev);

    if (saved) {
      await supabase
        .from("wishlists")
        .delete()
        .eq("customer_id", user.id)
        .eq("product_id", id);
    } else {
      await supabase
        .from("wishlists")
        .insert({ customer_id: user.id, product_id: id });
    }
  }

  // router.back() throws a GO_BACK warning when there is no previous screen
  // (e.g. after a page reload), so fall back to the catalog.
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/catalog");
  }

  function onScrollEnd(e) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }

  if (!product) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: colors.inkSoft }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={styles.heroWrap}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
            >
              {photos.map((url, idx) => (
                <Image key={idx} source={{ uri: url }} style={styles.hero} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.hero, styles.heroPlaceholder]}>
              <Icon name="flower-outline" size={60} color={colors.plum} />
            </View>
          )}

          {photos.length > 1 && (
            <View style={styles.dotsRow}>
              {photos.map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.dot, idx === activeIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          <View style={styles.heroTopRow}>
            <Pressable onPress={goBack} style={styles.floatingButton}>
              <Text style={styles.floatingButtonText}>←</Text>
            </Pressable>

            <Pressable onPress={toggleWishlist} style={styles.floatingButton}>
              <Icon
                name={saved ? "heart" : "heart-outline"}
                size={20}
                color={saved ? colors.brick : colors.ink}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{product.category}</Text>
            </View>

            <View
              style={[
                styles.availabilityPill,
                {
                  backgroundColor: product.is_available
                    ? colors.fernTint
                    : colors.brickTint,
                },
              ]}
            >
              <Text
                style={[
                  styles.availabilityText,
                  { color: product.is_available ? colors.fern : colors.brick },
                ]}
              >
                {product.is_available
                  ? "Available now"
                  : "Currently unavailable"}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>{product.name}</Text>
          {!!product.variant && (
            <Text style={styles.variant}>{product.variant}</Text>
          )}

          <Text style={styles.price}>₱{product.price}</Text>

          {!!product.description && (
            <View style={styles.descriptionCard}>
              <Text style={styles.sectionTitle}>Details</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}

          {related.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.sectionTitle}>You might also like</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: spacing.sm }}
              >
                {related.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.relatedCard}
                    onPress={() =>
                      router.push({
                        pathname: "/product-detail",
                        params: { id: String(item.id) },
                      })
                    }
                  >
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.relatedThumb}
                      />
                    ) : (
                      <View
                        style={[
                          styles.relatedThumb,
                          styles.relatedThumbPlaceholder,
                        ]}
                      >
                        <Icon
                          name="flower-outline"
                          size={24}
                          color={colors.plum}
                        />
                      </View>
                    )}
                    <Text style={styles.relatedName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.relatedPrice}>₱{item.price}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>

          <Text style={styles.stepperValue}>{qty}</Text>

          <Pressable
            style={styles.stepperButton}
            onPress={() => setQty((q) => q + 1)}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.addToCart, !product.is_available && { opacity: 0.5 }]}
          disabled={!product.is_available}
          onPress={() => {
            addItem(product, qty);
            router.push("/cart");
          }}
        >
          <Text style={styles.addToCartText}>
            Add to cart · ₱{product.price * qty}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  loading: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },

  heroWrap: { position: "relative" },

  hero: { width: SCREEN_WIDTH, height: 320, backgroundColor: colors.plumTint },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },

  dotsRow: {
    position: "absolute",
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 18,
  },

  heroTopRow: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  floatingButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingButtonText: { fontSize: 18, fontWeight: "700", color: colors.ink },

  body: {
    padding: spacing.lg,
    marginTop: -radius.lg,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },

  badgeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },

  categoryPill: {
    backgroundColor: colors.plumTint,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  categoryPillText: { color: colors.plum, fontWeight: "700", fontSize: 12 },

  availabilityPill: {
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  availabilityText: { fontWeight: "700", fontSize: 12 },

  name: { ...type.display, marginBottom: 2 },
  variant: { color: colors.inkSoft, fontSize: 14, marginBottom: spacing.sm },
  price: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    marginTop: spacing.xs,
  },

  descriptionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  description: { color: colors.inkSoft, lineHeight: 21 },

  relatedSection: { marginTop: spacing.xl },

  relatedCard: {
    width: 110,
    marginRight: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  relatedThumb: {
    width: "100%",
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
    marginBottom: spacing.xs,
  },
  relatedThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  relatedName: { fontSize: 12, fontWeight: "700", color: colors.ink },
  relatedPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.plum,
    marginTop: 2,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
  },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { fontSize: 18, fontWeight: "700", color: colors.plum },
  stepperValue: {
    minWidth: 24,
    textAlign: "center",
    fontWeight: "700",
    color: colors.ink,
  },

  addToCart: {
    flex: 1,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  addToCartText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
