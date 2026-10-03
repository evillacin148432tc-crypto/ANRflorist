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
  useWindowDimensions,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import LocationPicker from "../lib/LocationPicker";
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
import { categoryIcon } from "../lib/categoryIcon";
import { loadPortfolio } from "../lib/portfolio";

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

export default function CustomerHome() {
  const router = useRouter();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { totalItems } = useCart();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gridW = Math.min(width, layout.maxWidth);
  const cardW = (gridW - spacing.lg * 2 - spacing.md) / 2;
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

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled) setIdImage(result.assets[0]);
  }

  // Called when the customer taps the map or drags the pin
  function handlePick(lat, lng) {
    const inside =
      lat >= TAGUM_BOX.minLat &&
      lat <= TAGUM_BOX.maxLat &&
      lng >= TAGUM_BOX.minLng &&
      lng <= TAGUM_BOX.maxLng;

    if (!inside) {
      showMessage(
        "Outside Tagum City",
        "That spot is outside Tagum City, so the pin was not saved. Please pin a place inside Tagum City.",
      );
      return;
    }
    setPin({ lat, lng });
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
  const [work, setWork] = useState([]);

  useEffect(() => {
    if (status === "verified") {
      loadCategories();
      loadRecommended();
      loadActiveOrderCount();
      loadPortfolio(8).then(setWork);
    }
  }, [status]);

  async function loadCategories() {
    const { data } = await supabase
      .from("products")
      .select("category")
      .eq("is_available", true);

    const set = new Set(
      (data || [])
        .map((p) => (p.category || "").trim())
        .filter((c) => c.length > 0),
    );
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
      <View
        style={[
          styles.center,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.statusIcon}>
          <Icon name="time-outline" size={40} color={colors.plum} />
        </View>
        <Text style={styles.title}>Thanks, {name}!</Text>
        <Text style={styles.text}>
          Your ID is being reviewed by ANR Florist. You will be able to order
          once you are approved.
        </Text>
        <Pressable
          style={[styles.primaryButton, { alignSelf: "stretch" }]}
          onPress={refreshProfile}
        >
          <Text style={styles.primaryButtonText}>Check status</Text>
        </Pressable>
        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    );
  }

  // ---------------- Render: Verified dashboard ----------------
  if (status === "verified") {
    const firstName = name?.split(" ")[0] || "there";
    const BellCart = ({ icon, count, to }) => (
      <Pressable style={styles.iconCircle} onPress={() => router.push(to)}>
        <Icon name={icon} size={20} color={colors.plum} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </Pressable>
    );

    return (
      <View style={styles.dashContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + spacing.md,
            paddingBottom: 110 + insets.bottom,
            paddingHorizontal: spacing.lg,
            width: "100%",
            maxWidth: layout.maxWidth,
            alignSelf: "center",
          }}
        >
          <View style={styles.topBar}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.greeting} numberOfLines={1}>
                Hi, {firstName} 👋
              </Text>
              <View style={styles.locRow}>
                <Icon name="location" size={12} color={colors.plum} />
                <Text style={styles.location}>Delivering in Tagum City</Text>
              </View>
            </View>
            <View style={styles.topIcons}>
              <BellCart
                icon="notifications-outline"
                count={activeOrderCount}
                to="/orders"
              />
              <BellCart icon="cart-outline" count={totalItems} to="/cart" />
            </View>
          </View>

          <Pressable
            style={styles.search}
            onPress={() => router.push("/catalog")}
          >
            <Icon name="search" size={18} color={colors.inkSoft} />
            <Text style={styles.searchText}>Search bouquets, flowers…</Text>
          </Pressable>

          <Pressable
            style={styles.hero}
            onPress={() => router.push("/catalog")}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>HANDMADE FRESH</Text>
              <Text style={styles.heroTitle}>
                Flowers for every{"\n"}special moment
              </Text>
              <View style={styles.heroBtn}>
                <Text style={styles.heroBtnText}>Shop now</Text>
                <Icon name="arrow-forward" size={14} color={colors.plum} />
              </View>
            </View>
            <Icon name="flower" size={78} color="rgba(255,255,255,0.28)" />
          </Pressable>

          <View style={styles.sectionHead}>
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
            style={{ marginHorizontal: -spacing.lg }}
            contentContainerStyle={{
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingBottom: 4,
            }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.categoryChip}
                onPress={() =>
                  router.push({
                    pathname: "/catalog",
                    params: { category: item },
                  })
                }
              >
                <View style={styles.categoryDot}>
                  <Icon
                    name={categoryIcon(item)}
                    size={16}
                    color={colors.plum}
                  />
                </View>
                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {item}
                </Text>
              </Pressable>
            )}
          />

          {work.length > 0 && (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Our Work</Text>
                <Pressable onPress={() => router.push("/portfolio")}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={work}
                keyExtractor={(w) => String(w.id)}
                style={{
                  marginHorizontal: -spacing.lg,
                  marginBottom: spacing.xl,
                }}
                contentContainerStyle={{
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => router.push("/portfolio")}>
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.workPhoto}
                    />
                  </Pressable>
                )}
              />
            </>
          )}

          <Pressable
            style={styles.shopCard}
            onPress={() => router.push("/about")}
          >
            <View style={styles.shopIcon}>
              <Icon name="storefront-outline" size={22} color={colors.plum} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.shopTitle}>Visit our shop</Text>
              <Text style={styles.shopSub} numberOfLines={1}>
                Map, contact info & hours
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.inkSoft} />
          </Pressable>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
          </View>
          {recommended.length === 0 ? (
            <Text style={{ color: colors.inkSoft }}>No bouquets yet.</Text>
          ) : (
            <View style={styles.grid}>
              {recommended.map((item) => (
                <Pressable
                  key={String(item.id)}
                  style={[styles.recCard, { width: cardW }]}
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
                      style={[styles.recThumb, { height: cardW * 0.9 }]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.recThumb,
                        styles.recThumbPlaceholder,
                        { height: cardW * 0.9 },
                      ]}
                    >
                      <Icon
                        name="flower-outline"
                        size={32}
                        color={colors.plum}
                      />
                    </View>
                  )}
                  <Text style={styles.recName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.recPrice}>₱{item.price}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <CustomerTabBar active="home" />
      </View>
    );
  }

  // ---------------- Render: Registration form ----------------
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: spacing.lg,
        width: "100%",
        maxWidth: layout.maxWidth,
        alignSelf: "center",
      }}
    >
      <View style={styles.topBarSimple}>
        <Text style={styles.who} numberOfLines={1}>
          {name}
        </Text>
        <Pressable style={[styles.logout, { marginTop: 0 }]} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Complete your registration</Text>
      <Text style={styles.sub}>
        ANR Florist delivers within Tagum City only. Tell us where you live and
        upload a valid ID so we can verify your account.
      </Text>

      {status === "rejected" && (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectTitle}>
            Your last submission was rejected
          </Text>
          <Text style={{ color: colors.ink }}>
            {profile?.verification_remarks || "No reason was given."}
          </Text>
          <Text style={{ marginTop: 6, color: colors.ink }}>
            Please fix the problem and submit again.
          </Text>
        </View>
      )}

      <View style={styles.formCard}>
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
          placeholder="e.g. Purok 3, Rizal St."
          placeholderTextColor={colors.inkSoft}
        />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Pin your location (optional)</Text>
        <Text style={styles.hint}>
          Tap the map to drop a pin on your house or landmark. You can drag the
          pin to adjust it.
        </Text>
        <LocationPicker
          initial={pin}
          bounds={{
            minLat: TAGUM_BOX.minLat,
            maxLat: TAGUM_BOX.maxLat,
            minLng: TAGUM_BOX.minLng,
            maxLng: TAGUM_BOX.maxLng,
          }}
          onPick={handlePick}
        />
        {pin ? (
          <View style={styles.pinRow}>
            <Icon name="checkmark-circle" size={18} color={colors.fern} />
            <Text style={[styles.pinText, { flex: 1, marginTop: 0 }]}>
              Pin saved: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </Text>
            <Pressable onPress={() => setPin(null)} hitSlop={8}>
              <Text style={styles.pinClear}>Clear</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.pinHint}>
            No pin yet. You can still register without one.
          </Text>
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Valid ID photo</Text>
        <Text style={styles.hint}>
          A clear photo of a government-issued or school ID. It is stored
          privately and only ANR Florist staff can view it.
        </Text>
        <Pressable style={styles.outlineButton} onPress={pickImage}>
          <Icon name="image-outline" size={18} color={colors.plum} />
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
      </View>

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
  center: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  statusIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  dashContainer: { flex: 1, backgroundColor: colors.paper },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  topBarSimple: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: 22, fontWeight: "800", color: colors.ink },
  locRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  location: { fontSize: 12, color: colors.inkSoft },
  who: { color: colors.inkSoft, flex: 1 },
  topIcons: { flexDirection: "row", gap: spacing.sm },
  iconCircle: {
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

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: spacing.lg,
  },
  searchText: { color: colors.inkSoft, fontSize: 14 },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.plum,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    overflow: "hidden",
    ...shadow,
  },
  heroKicker: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
    lineHeight: 26,
  },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: spacing.md,
  },
  heroBtnText: { color: colors.plum, fontSize: 13, fontWeight: "700" },

  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: { ...type.title },
  seeAll: { color: colors.plum, fontWeight: "700", fontSize: 13 },

  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    marginBottom: spacing.lg,
  },
  categoryDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: { fontSize: 13, fontWeight: "600", color: colors.ink },

  workPhoto: {
    width: 130,
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.plumTint,
  },
  shopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadow,
  },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  shopTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  shopSub: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  recCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...shadow,
  },
  recThumb: {
    width: "100%",
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
    marginBottom: spacing.sm,
  },
  recThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  recName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    paddingHorizontal: 2,
  },
  recPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.plum,
    marginTop: 2,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },

  title: { ...type.display, fontSize: 24, textAlign: "center" },
  heading: { ...type.display, marginBottom: 6 },
  text: {
    marginTop: 8,
    marginBottom: spacing.lg,
    color: colors.inkSoft,
    textAlign: "center",
    lineHeight: 21,
  },
  sub: { color: colors.inkSoft, lineHeight: 21, marginBottom: spacing.lg },

  formCard: { ...shared.card, marginBottom: spacing.md },
  cardTitle: { ...type.title, fontSize: 16, marginBottom: 4 },
  label: { ...type.label, marginTop: spacing.md, marginBottom: 6 },
  hint: {
    color: colors.inkSoft,
    marginBottom: spacing.md,
    fontSize: 13,
    lineHeight: 19,
  },
  input: { ...shared.input },
  locked: { backgroundColor: colors.plumTint, color: colors.inkSoft },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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

  outlineButton: {
    ...shared.buttonOutline,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  outlineText: { color: colors.plum, fontWeight: "700" },
  pinRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  pinClear: { color: colors.brick, fontWeight: "700", fontSize: 13 },
  pinHint: { marginTop: 10, color: colors.inkSoft, fontSize: 12 },
  pinText: { marginTop: 8, color: colors.fern, fontWeight: "600" },
  preview: {
    width: "100%",
    height: 200,
    marginTop: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
  },

  primaryButton: {
    ...shared.buttonPrimary,
    marginTop: spacing.md,
    paddingHorizontal: 24,
  },
  primaryButtonText: { ...shared.buttonPrimaryText },

  logout: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    marginTop: 12,
  },
  logoutText: { fontWeight: "600", color: colors.inkSoft },

  rejectBox: {
    marginBottom: spacing.md,
    padding: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.brickTint,
    borderWidth: 1,
    borderColor: colors.brick,
  },
  rejectTitle: { fontWeight: "700", color: colors.brick, marginBottom: 4 },
});
