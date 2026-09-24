import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useCart } from "../lib/CartProvider";
import { useAuth } from "../lib/AuthProvider";
import { colors, spacing, radius, type } from "../lib/theme";

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  // Re-runs when the user becomes available (auth restores after a reload)
  useEffect(() => {
    loadWishlistState();
  }, [id, user?.id]);

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

    const wasSaved = saved;
    setSaved(!wasSaved);

    if (wasSaved) {
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

  async function load() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (!error) setProduct(data);
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
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Pressable style={styles.heartButton} onPress={toggleWishlist}>
            <Text style={{ fontSize: 18 }}>{saved ? "❤️" : "🤍"}</Text>
          </Pressable>
        </View>

        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Text style={{ fontSize: 56 }}>🌸</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.name}>{product.name}</Text>
          {!!product.variant && (
            <Text style={styles.variant}>{product.variant}</Text>
          )}

          <Text style={styles.price}>₱{product.price}</Text>

          {!!product.description && (
            <>
              <Text style={styles.sectionTitle}>Details</Text>
              <Text style={styles.description}>{product.description}</Text>
            </>
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
          style={styles.addToCart}
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
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  loading: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
  },

  backButton: {},

  heartButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: colors.plum,
    fontWeight: "600",
  },

  hero: {
    width: "100%",
    height: 280,
    backgroundColor: colors.plumTint,
  },

  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  body: {
    padding: spacing.lg,
  },

  category: {
    color: colors.plum,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  name: {
    ...type.display,
    marginTop: spacing.xs,
  },

  variant: {
    color: colors.inkSoft,
    fontSize: 14,
    marginTop: 2,
  },

  price: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginTop: spacing.sm,
  },

  sectionTitle: {
    ...type.title,
    fontSize: 16,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },

  description: {
    color: colors.inkSoft,
    lineHeight: 21,
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

  stepperButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.plum,
  },

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

  addToCartText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
});
