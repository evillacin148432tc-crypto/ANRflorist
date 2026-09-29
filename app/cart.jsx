import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";

import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { useCart } from "../lib/CartProvider";
import { TAGUM_BARANGAYS } from "../lib/barangays";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type } from "../lib/theme";

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function Cart() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items, setQuantity, removeItem, clear, totalPrice } = useCart();

  const [barangay, setBarangay] = useState(profile?.barangay ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  async function checkout() {
    if (items.length === 0) {
      showMessage("Empty Cart", "Add a bouquet first.");
      return;
    }
    if (!barangay) {
      showMessage("Missing Info", "Please choose a delivery barangay.");
      return;
    }
    if (!address.trim()) {
      showMessage("Missing Info", "Please enter a delivery address.");
      return;
    }

    setPlacing(true);

    const { data, error } = await supabase.rpc("place_order", {
      p_items: items.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
      })),
      p_delivery_address: address.trim(),
      p_delivery_barangay: barangay,
      p_delivery_notes: notes.trim(),
    });

    setPlacing(false);

    if (error) {
      showMessage("Order Failed", error.message);
      return;
    }

    clear();
    showMessage(
      "Order Placed!",
      "Thank you! We'll start preparing your order.",
    );
    router.replace("/orders");
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
      >
        <Text style={styles.title}>Your Cart</Text>

        {items.length === 0 ? (
          <Text style={styles.empty}>Your cart is empty.</Text>
        ) : (
          items.map(({ product, quantity }) => (
            <View key={product.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{product.name}</Text>
                <Text style={styles.itemPrice}>₱{product.price} each</Text>
              </View>

              <View style={styles.qtyRow}>
                <Pressable
                  style={styles.qtyButton}
                  onPress={() => setQuantity(product.id, quantity - 1)}
                >
                  <Text style={styles.qtyButtonText}>−</Text>
                </Pressable>
                <Text style={styles.qtyText}>{quantity}</Text>
                <Pressable
                  style={styles.qtyButton}
                  onPress={() => setQuantity(product.id, quantity + 1)}
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => removeItem(product.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}

        {items.length > 0 && (
          <>
            <Text style={styles.total}>Total: ₱{totalPrice.toFixed(2)}</Text>

            <Text style={styles.sectionTitle}>Delivery details</Text>
            <Text style={styles.hint}>
              Delivery is available within Tagum City only.
            </Text>

            <Text style={styles.label}>Barangay</Text>
            <View style={styles.chipRow}>
              {TAGUM_BARANGAYS.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => setBarangay(b)}
                  style={[styles.chip, barangay === b && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      barangay === b && styles.chipTextActive,
                    ]}
                  >
                    {b}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Street / Purok / House No.</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
            />

            <Text style={styles.label}>Notes for the rider (optional)</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="e.g. Gate code, landmark..."
              placeholderTextColor={colors.inkSoft}
            />

            <Pressable
              style={[styles.checkoutButton, placing && { opacity: 0.6 }]}
              onPress={checkout}
              disabled={placing}
            >
              <Text style={styles.checkoutText}>
                {placing ? "Placing order..." : "Place order"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <CustomerTabBar active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  title: { ...type.display, marginBottom: spacing.lg },
  empty: { color: colors.inkSoft },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },

  itemName: { fontWeight: "700", fontSize: 16, color: colors.ink },
  itemPrice: { color: colors.inkSoft, marginTop: 2 },

  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonText: { fontSize: 18, fontWeight: "700", color: colors.plum },
  qtyText: {
    minWidth: 20,
    textAlign: "center",
    fontWeight: "600",
    color: colors.ink,
  },

  removeText: { color: colors.brick, fontWeight: "600" },

  total: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.lg,
    textAlign: "right",
    color: colors.ink,
  },

  sectionTitle: { ...type.title, fontSize: 18, marginTop: spacing.xl },
  hint: { color: colors.inkSoft, marginBottom: spacing.sm, fontSize: 13 },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: "600",
    color: colors.ink,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.ink,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { color: colors.ink },
  chipTextActive: { color: colors.white, fontWeight: "700" },

  checkoutButton: {
    backgroundColor: colors.plum,
    padding: 16,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  checkoutText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
