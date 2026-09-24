import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  FlatList,
  Alert,
  Platform,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { useCart } from "../lib/CartProvider";
import { TAGUM_BARANGAYS } from "../lib/barangays";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type } from "../lib/theme";

// Save your logo at assets/logo.png
const LOGO = require("../assets/logo.png");

const TAGUM_BOX = { minLat: 7.3, maxLat: 7.6, minLng: 125.72, maxLng: 125.95 };

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function base64ToBytes(b64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];

    bytes[p++] = (a << 2) | (b >> 4);
    if (i + 2 < len) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < len) bytes[p++] = ((c & 3) << 6) | d;
  }

  return bytes.slice(0, p);
}

function getBase64(asset) {
  if (asset.base64) return asset.base64;
  if (asset.uri && asset.uri.startsWith("data:"))
    return asset.uri.split(",")[1];
  return null;
}

// Picks an emoji for a category by keyword, falling back to a flower
function categoryEmoji(name = "") {
  const n = name.toLowerCase();
  if (n.includes("money") || n.includes("bill")) return "💵";
  if (n.includes("fresh")) return "🌹";
  if (n.includes("satin")) return "🎀";
  if (n.includes("fuzzy")) return "🧸";
  if (n.includes("card")) return "💌";
  if (n.includes("bouquet")) return "💐";
  return "🌸";
}

const CATEGORY_TINTS = [
  colors.plumTint,
  colors.fernTint,
  colors.marigoldTint,
  colors.brickTint,
];

export default function CustomerHome() {
  const router = useRouter();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { totalItems, addItem } = useCart();

  const status = profile?.verification_status || "unverified";
  const name = profile?.full_name || user?.email;

  // ---------------- Registration form state (unverified / rejected) ----------------
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [barangay, setBarangay] = useState(profile?.barangay ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [pin, setPin] = useState(
    profile?.latitude && profile?.longitude
      ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
      : null,
  );
  const [idImage, setIdImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled) setIdImage(result.assets[0]);
  }

  async function useMyLocation() {
    try {
      setLocating(true);
      const { status: permission } =
        await Location.requestForegroundPermissionsAsync();

      if (permission !== "granted") {
        showMessage(
          "Permission Needed",
          "Location permission was not granted.",
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const inside =
        lat >= TAGUM_BOX.minLat &&
        lat <= TAGUM_BOX.maxLat &&
        lng >= TAGUM_BOX.minLng &&
        lng <= TAGUM_BOX.maxLng;

      if (!inside) {
        showMessage(
          "Outside Tagum City",
          "Your current location looks like it is outside Tagum City, so the pin was not saved. You can still register using your barangay and address.",
        );
        return;
      }

      setPin({ lat, lng });
    } catch (e) {
      showMessage("Location Error", "Could not get your location.");
    } finally {
      setLocating(false);
    }
  }

  async function submitRegistration() {
    if (!/^(09|\+639)\d{9}$/.test(phone.trim())) {
      showMessage(
        "Invalid Phone",
        "Enter a valid mobile number, e.g. 09123456789.",
      );
      return;
    }
    if (!barangay) {
      showMessage("Missing Info", "Please choose your barangay.");
      return;
    }
    if (!address.trim()) {
      showMessage(
        "Missing Info",
        "Please enter your street / purok / house number.",
      );
      return;
    }
    if (!idImage) {
      showMessage("ID Required", "Please upload a photo of a valid ID.");
      return;
    }

    const base64 = getBase64(idImage);
    if (!base64) {
      showMessage(
        "Image Error",
        "Could not read that image. Try another photo.",
      );
      return;
    }

    setSaving(true);

    const mime = idImage.mimeType || "image/jpeg";
    const ext = mime.split("/")[1] || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("customer-ids")
      .upload(path, base64ToBytes(base64), { contentType: mime });

    if (uploadError) {
      setSaving(false);
      showMessage("Upload Failed", uploadError.message);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        phone: phone.trim(),
        address: address.trim(),
        barangay,
        city: "Tagum City",
        latitude: pin ? pin.lat : null,
        longitude: pin ? pin.lng : null,
        id_photo_path: path,
        id_submitted_at: new Date().toISOString(),
        verification_status: "pending",
      })
      .eq("id", user.id)
      .select();

    setSaving(false);

    if (error) {
      showMessage("Save Failed", error.message);
      return;
    }
    if (!data || data.length === 0) {
      showMessage("Save Failed", "Nothing was saved. Please try again.");
      return;
    }

    await refreshProfile();
  }

  // ---------------- Dashboard data (verified only) ----------------
  const [categories, setCategories] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [activeOrderCount, setActiveOrderCount] = useState(0);

  useEffect(() => {
    if (status === "verified") {
      loadCategories();
      loadRecommended();
      loadActiveOrderCount();
    }
  }, [status]);

  async function loadCategories() {
    const { data } = await supabase
      .from("products")
      .select("category")
      .eq("is_available", true);

    const set = new Set((data || []).map((p) => p.category).filter(Boolean));
    setCategories(Array.from(set));
  }

  async function loadRecommended() {
    // Try popularity from delivered orders first...
    const { data: items } = await supabase
      .from("order_items")
      .select(
        "quantity, product:product_id!inner (id, name, price, image_url, category, is_available)",
      )
      .eq("product.is_available", true);

    if (items && items.length > 0) {
      const totals = {};
      for (const it of items) {
        if (!it.product) continue;
        const key = it.product.id;
        if (!totals[key]) totals[key] = { ...it.product, qty: 0 };
        totals[key].qty += it.quantity;
      }
      const sorted = Object.values(totals)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 6);
      if (sorted.length > 0) {
        setRecommended(sorted);
        return;
      }
    }

    // ...fall back to just showing available bouquets, so this section is
    // never empty even before any orders exist.
    const { data: fallback } = await supabase
      .from("products")
      .select("*")
      .eq("is_available", true)
      .limit(6);

    setRecommended(fallback || []);
  }

  async function loadActiveOrderCount() {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .not("order_status", "in", "(delivered,cancelled)");

    setActiveOrderCount(count ?? 0);
  }

  // ---------------- Render: Pending ----------------
  if (status === "pending") {
    return (
      <View style={styles.center}>
        <View style={[styles.logoCard, { width: 200, height: 183 }]}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>

        <Text style={[styles.title, { marginTop: spacing.lg }]}>
          Thanks, {name}!
        </Text>
        <Text style={styles.text}>
          Your ID is being reviewed by ANR Florist. You will be able to order
          once you are approved.
        </Text>

        <Pressable style={styles.primaryButton} onPress={refreshProfile}>
          <Text style={styles.primaryButtonText}>Check status</Text>
        </Pressable>

        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    );
  }

  // ---------------- Render: Verified — the real dashboard ----------------
  if (status === "verified") {
    return (
      <View style={styles.dashContainer}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: icons + logo + greeting, all in one container */}
          <View style={styles.hero}>
            <View style={styles.heroIcons}>
              <Pressable
                style={[styles.iconCircle, styles.iconCircleOnHero]}
                onPress={() => router.push("/orders")}
              >
                <Text style={styles.iconGlyph}>🔔</Text>
                {activeOrderCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{activeOrderCount}</Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={[styles.iconCircle, styles.iconCircleOnHero]}
                onPress={() => router.push("/cart")}
              >
                <Text style={styles.iconGlyph}>🛒</Text>
                {totalItems > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{totalItems}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={styles.heroRow}>
              <View style={styles.heroLogo}>
                <Image
                  source={LOGO}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.greeting} numberOfLines={1}>
                  Hi, {name?.split(" ")[0] || "there"} 🌿
                </Text>
                <Text style={styles.location}>📍 Delivering in Tagum City</Text>

                <Pressable
                  style={styles.heroButton}
                  onPress={() => router.push("/catalog")}
                >
                  <Text style={styles.heroButtonText}>Shop bouquets</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Active orders banner */}
          {activeOrderCount > 0 && (
            <Pressable
              style={styles.orderBanner}
              onPress={() => router.push("/orders")}
            >
              <Text style={styles.orderBannerText}>
                📦 You have {activeOrderCount} active order
                {activeOrderCount > 1 ? "s" : ""}
              </Text>
              <Text style={styles.orderBannerLink}>Track →</Text>
            </Pressable>
          )}

          {/* Categories */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Pressable onPress={() => router.push("/catalog")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(c) => c}
            contentContainerStyle={{
              gap: spacing.sm,
              marginBottom: spacing.lg,
            }}
            renderItem={({ item, index }) => (
              <Pressable
                style={styles.categoryCard}
                onPress={() =>
                  router.push({
                    pathname: "/catalog",
                    params: { category: item },
                  })
                }
              >
                <View
                  style={[
                    styles.categoryIcon,
                    {
                      backgroundColor:
                        CATEGORY_TINTS[index % CATEGORY_TINTS.length],
                    },
                  ]}
                >
                  <Text style={{ fontSize: 24 }}>{categoryEmoji(item)}</Text>
                </View>
                <Text style={styles.categoryLabel} numberOfLines={2}>
                  {item}
                </Text>
              </Pressable>
            )}
          />

          {/* Recommended */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <Pressable onPress={() => router.push("/catalog")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recommended}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ gap: spacing.md }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.recCard}
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
                    style={styles.recThumb}
                  />
                ) : (
                  <View style={[styles.recThumb, styles.recThumbPlaceholder]}>
                    <Text style={{ fontSize: 32 }}>💐</Text>
                  </View>
                )}

                <Text style={styles.recName} numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.category && (
                  <Text style={styles.recCategory} numberOfLines={1}>
                    {item.category}
                  </Text>
                )}

                <View style={styles.recFooter}>
                  <Text style={styles.recPrice}>₱{item.price}</Text>
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
            )}
            ListEmptyComponent={
              <Text style={{ color: colors.inkSoft }}>No bouquets yet.</Text>
            }
          />
        </ScrollView>

        <CustomerTabBar active="home" />
      </View>
    );
  }

  // ---------------- Render: Unverified or rejected — registration form ----------------
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.topBarSimple}>
        <Text style={styles.who}>{name}</Text>
        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.logoCard,
          { width: 180, height: 165, alignSelf: "center" },
        ]}
      >
        <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
      </View>

      <Text style={[styles.heading, { marginTop: spacing.lg }]}>
        Complete your registration
      </Text>
      <Text style={[styles.text, { textAlign: "left" }]}>
        ANR Florist delivers within Tagum City only. Please tell us where you
        live and upload a valid ID so we can verify your account.
      </Text>

      {status === "rejected" && (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectTitle}>
            Your last submission was rejected
          </Text>
          <Text>{profile?.verification_remarks || "No reason was given."}</Text>
          <Text style={{ marginTop: 6 }}>
            Please fix the problem and submit again.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Mobile number</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="09123456789"
        placeholderTextColor={colors.inkSoft}
      />

      <Text style={styles.label}>City</Text>
      <TextInput
        style={[styles.input, styles.locked]}
        value="Tagum City"
        editable={false}
      />

      <Text style={styles.label}>Barangay</Text>
      <View style={styles.chipRow}>
        {TAGUM_BARANGAYS.map((b) => (
          <Pressable
            key={b}
            onPress={() => setBarangay(b)}
            style={[styles.chip, barangay === b && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, barangay === b && styles.chipTextActive]}
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
        placeholder="e.g. Purok 3, Rizal St."
        placeholderTextColor={colors.inkSoft}
      />

      <Text style={styles.label}>Map pin (optional)</Text>
      <Text style={styles.hint}>
        Helps our rider find your exact spot. Only works if you are at your
        delivery address right now.
      </Text>

      <Pressable
        style={styles.outlineButton}
        onPress={useMyLocation}
        disabled={locating}
      >
        <Text style={styles.outlineText}>
          {locating ? "Getting location..." : "Use my current location"}
        </Text>
      </Pressable>

      {pin && (
        <Text style={styles.pinText}>
          Pin saved: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </Text>
      )}

      <Text style={styles.label}>Valid ID photo</Text>
      <Text style={styles.hint}>
        A clear photo of a government-issued or school ID. It is stored
        privately and only ANR Florist staff can view it.
      </Text>

      <Pressable style={styles.outlineButton} onPress={pickImage}>
        <Text style={styles.outlineText}>
          {idImage ? "Choose a different photo" : "Choose ID photo"}
        </Text>
      </Pressable>

      {idImage && (
        <Image
          source={{ uri: idImage.uri }}
          style={styles.preview}
          resizeMode="contain"
        />
      )}

      <Pressable
        style={[styles.primaryButton, saving && { opacity: 0.6 }]}
        onPress={submitRegistration}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? "Submitting..." : "Submit for verification"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  center: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  dashContainer: { flex: 1, backgroundColor: colors.paper },

  /* Logo */
  // New logo has a transparent background, so no white box is needed
  logoCard: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: { width: "100%", height: "100%" },

  /* Verified dashboard header */
  hero: {
    backgroundColor: colors.plumTint,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  heroIcons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconCircleOnHero: {
    backgroundColor: colors.white,
    borderColor: "transparent",
  },
  heroLogo: {
    width: 128,
    height: 117,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { fontSize: 20, fontWeight: "700", color: colors.ink },
  location: { fontSize: 12, color: colors.inkSoft, marginTop: 3 },
  heroButton: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  heroButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },

  orderBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.fernTint,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  orderBannerText: { color: colors.fern, fontWeight: "700", fontSize: 13 },
  orderBannerLink: { color: colors.fern, fontWeight: "700", fontSize: 13 },

  topBarSimple: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  who: { color: colors.inkSoft },

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

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...type.title,
    fontSize: 17,
  },
  seeAll: { color: colors.plum, fontSize: 13, fontWeight: "700" },

  categoryCard: {
    width: 96,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 8,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },

  recCard: {
    width: 150,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
  },

  recThumb: {
    width: "100%",
    height: 120,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
    marginBottom: spacing.sm,
  },

  recThumbPlaceholder: { alignItems: "center", justifyContent: "center" },

  recName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  recCategory: { fontSize: 11, color: colors.inkSoft, marginTop: 1 },
  recFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  recPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.plum,
  },
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

  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: colors.ink,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
    color: colors.ink,
  },
  text: { marginTop: 8, color: colors.inkSoft, textAlign: "center" },

  label: {
    marginTop: 16,
    marginBottom: 4,
    fontWeight: "600",
    color: colors.ink,
  },
  hint: { color: colors.inkSoft, marginBottom: 8, fontSize: 13 },

  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  locked: { backgroundColor: colors.card, color: colors.inkSoft },

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

  outlineButton: {
    borderWidth: 1,
    borderColor: colors.plum,
    borderRadius: radius.sm,
    padding: 12,
    alignItems: "center",
  },
  outlineText: { color: colors.plum, fontWeight: "600" },

  pinText: { marginTop: 8, color: colors.fern },

  preview: {
    width: "100%",
    height: 220,
    marginTop: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },

  primaryButton: {
    backgroundColor: colors.plum,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "700" },

  logout: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 12,
  },
  logoutText: { fontWeight: "600", color: colors.inkSoft },

  rejectBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.brickTint,
    borderWidth: 1,
    borderColor: colors.brick,
  },
  rejectTitle: { fontWeight: "700", color: colors.brick, marginBottom: 4 },
});
