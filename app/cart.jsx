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
      console.log("PLACE ORDER ERROR:", error);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Pressable onPress={() => router.replace("/catalog")}>
        <Text style={styles.back}>← Back to Bouquets</Text>
      </Pressable>

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
                <Text style={styles.qtyButtonText}>-</Text>
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

          <Text style={styles.sectionTitle}>Delivery Details</Text>
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
          />

          <Pressable
            style={[styles.checkoutButton, placing && { opacity: 0.6 }]}
            onPress={checkout}
            disabled={placing}
          >
            <Text style={styles.checkoutText}>
              {placing ? "Placing Order..." : "Place Order"}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
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

  empty: {
    color: "gray",
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  itemName: {
    fontWeight: "bold",
    fontSize: 16,
  },

  itemPrice: {
    color: "gray",
    marginTop: 2,
  },

  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#999",
    alignItems: "center",
    justifyContent: "center",
  },

  qtyButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },

  qtyText: {
    minWidth: 20,
    textAlign: "center",
    fontWeight: "600",
  },

  removeText: {
    color: "red",
    fontWeight: "600",
  },

  total: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "right",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 24,
  },

  hint: {
    color: "gray",
    marginBottom: 10,
    fontSize: 13,
  },

  label: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "600",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#999",
    backgroundColor: "#fff",
  },

  chipActive: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },

  chipText: {
    color: "#333",
  },

  chipTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },

  checkoutButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },

  checkoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
