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
  Image,
  KeyboardAvoidingView,
} from "react-native";

import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { useCart } from "../lib/CartProvider";
import { TAGUM_BARANGAYS } from "../lib/barangays";
import CustomerTabBar from "../lib/CustomerTabBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  spacing,
  radius,
  type,
  shared,
  shadow,
  layout,
} from "../lib/theme";
import Icon from "../lib/Icon";

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
  const [pickerOpen, setPickerOpen] = useState(!profile?.barangay);
  const insets = useSafeAreaInsets();
  const tabH = 64 + Math.max(insets.bottom, 8);

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

  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingBottom: tabH + (items.length > 0 ? 100 : 24),
            width: "100%",
            maxWidth: layout.maxWidth,
            alignSelf: "center",
          }}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.back}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Icon name="chevron-back" size={20} color={colors.plum} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Your Cart</Text>
              {items.length > 0 && (
                <Text style={styles.subtitle}>
                  {count} item{count === 1 ? "" : "s"}
                </Text>
              )}
            </View>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Icon name="cart-outline" size={34} color={colors.plum} />
              </View>
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptyText}>
                Add a bouquet to get started.
              </Text>
              <Pressable
                style={styles.browse}
                onPress={() => router.replace("/catalog")}
              >
                <Text style={styles.browseText}>Browse bouquets</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {items.map(({ product, quantity }) => (
                <View key={product.id} style={styles.itemCard}>
                  {product.image_url ? (
                    <Image
                      source={{ uri: product.image_url }}
                      style={styles.thumb}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPh]}>
                      <Icon
                        name="flower-outline"
                        size={24}
                        color={colors.plum}
                      />
                    </View>
                  )}

                  <View style={styles.itemInfo}>
                    <View style={styles.itemTop}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Pressable
                        onPress={() => removeItem(product.id)}
                        hitSlop={8}
                      >
                        <Icon
                          name="trash-outline"
                          size={18}
                          color={colors.brick}
                        />
                      </Pressable>
                    </View>

                    <Text style={styles.itemPrice}>₱{product.price} each</Text>

                    <View style={styles.itemBottom}>
                      <View style={styles.qtyRow}>
                        <Pressable
                          style={styles.qtyButton}
                          onPress={() => setQuantity(product.id, quantity - 1)}
                        >
                          <Icon name="remove" size={16} color={colors.plum} />
                        </Pressable>
                        <Text style={styles.qtyText}>{quantity}</Text>
                        <Pressable
                          style={styles.qtyButton}
                          onPress={() => setQuantity(product.id, quantity + 1)}
                        >
                          <Icon name="add" size={16} color={colors.plum} />
                        </Pressable>
                      </View>
                      <Text style={styles.lineTotal}>
                        ₱{(Number(product.price) * quantity).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              <View style={styles.formCard}>
                <View style={styles.formHead}>
                  <View style={styles.formIcon}>
                    <Icon name="location" size={16} color={colors.plum} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Delivery details</Text>
                    <Text style={styles.hint}>Within Tagum City only.</Text>
                  </View>
                </View>

                <Text style={styles.label}>Barangay</Text>
                <Pressable
                  style={styles.select}
                  onPress={() => setPickerOpen((v) => !v)}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !barangay && { color: colors.inkSoft },
                    ]}
                    numberOfLines={1}
                  >
                    {barangay || "Choose your barangay"}
                  </Text>
                  <Icon
                    name={pickerOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.plum}
                  />
                </Pressable>

                {pickerOpen && (
                  <View style={styles.chipRow}>
                    {TAGUM_BARANGAYS.map((b) => (
                      <Pressable
                        key={b}
                        onPress={() => {
                          setBarangay(b);
                          setPickerOpen(false);
                        }}
                        style={[
                          styles.chip,
                          barangay === b && styles.chipActive,
                        ]}
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
                )}

                <Text style={styles.label}>Street / Purok / House No.</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. Purok 3, Rizal St."
                  placeholderTextColor={colors.inkSoft}
                />

                <Text style={styles.label}>Notes for the rider (optional)</Text>
                <TextInput
                  style={[styles.input, styles.notes]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  textAlignVertical="top"
                  placeholder="e.g. Gate code, landmark..."
                  placeholderTextColor={colors.inkSoft}
                />
              </View>
            </>
          )}
        </ScrollView>

        {items.length > 0 && (
          <View style={[styles.checkoutBar, { bottom: tabH }]}>
            <View style={styles.checkoutInner}>
              <View>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.total}>₱{totalPrice.toFixed(2)}</Text>
              </View>
              <Pressable
                style={[styles.checkoutButton, placing && { opacity: 0.7 }]}
                onPress={checkout}
                disabled={placing}
              >
                <Text style={styles.checkoutText}>
                  {placing ? "Placing order..." : "Place order"}
                </Text>
                {!placing && (
                  <Icon name="arrow-forward" size={16} color={colors.white} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <CustomerTabBar active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.display },
  subtitle: { color: colors.inkSoft, fontSize: 13, marginTop: 1 },

  emptyBox: { alignItems: "center", paddingTop: 60, gap: 6 },
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
  emptyText: { color: colors.inkSoft },
  browse: {
    marginTop: spacing.md,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  browseText: { color: colors.white, fontWeight: "700" },

  itemCard: {
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
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
  },
  thumbPh: { alignItems: "center", justifyContent: "center" },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  itemName: { flex: 1, fontWeight: "700", fontSize: 15, color: colors.ink },
  itemPrice: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  itemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: spacing.sm,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.plumTint,
    borderRadius: radius.pill,
    padding: 3,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    minWidth: 28,
    textAlign: "center",
    fontWeight: "700",
    color: colors.ink,
  },
  lineTotal: { fontWeight: "800", fontSize: 15, color: colors.plum },

  formCard: { ...shared.card, marginTop: spacing.sm },
  formHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  formIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { ...type.title, fontSize: 17 },
  hint: { color: colors.inkSoft, fontSize: 12 },
  label: { ...type.label, marginTop: spacing.md, marginBottom: 6 },
  input: { ...shared.input },
  notes: { height: 84 },

  select: {
    ...shared.input,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  selectText: { flex: 1, fontSize: 16, color: colors.ink },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: spacing.md,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextActive: { color: colors.white, fontWeight: "700" },

  checkoutBar: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  checkoutInner: {
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  totalLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "600" },
  total: { fontSize: 20, fontWeight: "800", color: colors.ink },
  checkoutButton: {
    ...shared.buttonPrimary,
    flex: 1,
    maxWidth: 230,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
  },
  checkoutText: { ...shared.buttonPrimaryText },
});
