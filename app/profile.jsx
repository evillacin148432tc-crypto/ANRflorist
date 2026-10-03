import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
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

const AVATAR_BUCKET = "profile-photos";

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

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, signOut, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [barangay, setBarangay] = useState(profile?.barangay ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [saving, setSaving] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadAvatar();
  }, [profile?.avatar_path]);

  // Private bucket, so we need a short-lived signed link to display it.
  async function loadAvatar() {
    if (!profile?.avatar_path) {
      setAvatarUrl(null);
      return;
    }

    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(profile.avatar_path, 3600);

    if (!error) setAvatarUrl(data.signedUrl);
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const base64 = getBase64(asset);

    if (!base64) {
      showMessage("Image Error", "Could not read that photo. Try another.");
      return;
    }

    setUploadingAvatar(true);

    const mime = asset.mimeType || "image/jpeg";
    const ext = mime.split("/")[1] || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, base64ToBytes(base64), { contentType: mime });

    if (uploadError) {
      setUploadingAvatar(false);
      showMessage("Upload Failed", uploadError.message);
      return;
    }

    // Clean up the old photo, if there was one, so storage doesn't pile up.
    if (profile?.avatar_path) {
      await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_path]);
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", user.id);

    setUploadingAvatar(false);

    if (updateError) {
      showMessage("Save Failed", updateError.message);
      return;
    }

    await refreshProfile();
  }

  async function save() {
    if (!/^(09|\+639)\d{9}$/.test(phone.trim())) {
      showMessage(
        "Invalid Phone",
        "Enter a valid mobile number, e.g. 09123456789.",
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ phone: phone.trim(), barangay, address: address.trim() })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      showMessage("Save Failed", error.message);
      return;
    }

    await refreshProfile();
    setEditing(false);
  }

  const status = profile?.verification_status;

  function cancelEdit() {
    setPhone(profile?.phone ?? "");
    setBarangay(profile?.barangay ?? "");
    setAddress(profile?.address ?? "");
    setEditing(false);
  }

  const InfoRow = ({ icon, label, children, last }) => (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={colors.plum} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );

  const MenuRow = ({ icon, text, onPress, last }) => (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.infoDivider,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={colors.plum} />
      </View>
      <Text style={styles.menuText}>{text}</Text>
      <Icon name="chevron-forward" size={18} color={colors.inkSoft} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: 110 + insets.bottom,
          width: "100%",
          maxWidth: layout.maxWidth,
          alignSelf: "center",
        }}
      >
        {/* Avatar + name */}
        <View style={styles.hero}>
          <Pressable
            onPress={pickAvatar}
            style={styles.avatarWrap}
            disabled={uploadingAvatar}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Icon name="person" size={40} color={colors.plum} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? (
                <Text style={{ fontSize: 12 }}>…</Text>
              ) : (
                <Icon name="camera" size={14} color={colors.plum} />
              )}
            </View>
          </Pressable>

          <Text style={styles.name} numberOfLines={1}>
            {profile?.full_name || user?.email}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
          {!!status && (
            <View
              style={[
                styles.statusPill,
                status !== "verified" && styles.statusPillWarn,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  status !== "verified" && { color: colors.marigold },
                ]}
              >
                {status === "verified" ? "Verified" : status}
              </Text>
            </View>
          )}
        </View>

        {/* Contact & delivery */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>CONTACT & DELIVERY</Text>
          {!editing && (
            <Pressable style={styles.editPill} onPress={() => setEditing(true)}>
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.groupCard}>
          <InfoRow icon="mail-outline" label="Email">
            <Text style={styles.rowValue} numberOfLines={1}>
              {user?.email}
            </Text>
          </InfoRow>

          <InfoRow icon="call-outline" label="Mobile number">
            {editing ? (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.rowValue}>{profile?.phone || "—"}</Text>
            )}
          </InfoRow>

          <InfoRow icon="location-outline" label="Barangay">
            {editing ? (
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
            ) : (
              <Text style={styles.rowValue}>
                {profile?.barangay || "—"}, Tagum City
              </Text>
            )}
          </InfoRow>

          <InfoRow icon="home-outline" label="Street / Purok / House No." last>
            {editing ? (
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
              />
            ) : (
              <Text style={styles.rowValue}>{profile?.address || "—"}</Text>
            )}
          </InfoRow>
        </View>

        {editing && (
          <View style={styles.editActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={cancelEdit}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? "Saving…" : "Save changes"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Account */}
        <Text
          style={[
            styles.sectionLabel,
            { marginTop: spacing.xl, marginBottom: spacing.sm },
          ]}
        >
          ACCOUNT
        </Text>
        <View style={styles.groupCard}>
          <MenuRow
            icon="cube-outline"
            text="My orders"
            onPress={() => router.push("/orders")}
          />
          <MenuRow
            icon="heart-outline"
            text="Wishlist"
            onPress={() => router.push("/wishlist")}
          />
          <MenuRow
            icon="chatbubble-outline"
            text="Help & support"
            last
            onPress={() =>
              router.push({ pathname: "/about", params: { focus: "contact" } })
            }
          />
        </View>

        <Pressable style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>

      <CustomerTabBar active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },

  hero: { alignItems: "center", marginBottom: spacing.xl },
  avatarWrap: { marginBottom: spacing.md },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.plumTint,
    borderWidth: 3,
    borderColor: colors.white,
    ...shadow,
  },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.plumTint,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...type.display, fontSize: 22 },
  email: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
  statusPill: {
    marginTop: spacing.sm,
    backgroundColor: colors.fernTint,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  statusPillWarn: { backgroundColor: colors.marigoldTint },
  statusPillText: { color: colors.fern, fontWeight: "700", fontSize: 12 },

  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.inkSoft,
  },
  editPill: {
    borderWidth: 1,
    borderColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  editPillText: { color: colors.plum, fontWeight: "700", fontSize: 12 },

  groupCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    ...shadow,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  infoDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: "600" },
  rowValue: { fontSize: 15, color: colors.ink, marginTop: 2 },
  input: { ...shared.input, marginTop: 4, paddingVertical: 9 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { color: colors.ink, fontSize: 12 },
  chipTextActive: { color: colors.white, fontWeight: "700" },

  editActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancelButton: { flex: 1, ...shared.buttonOutline },
  cancelText: { color: colors.plum, fontWeight: "700" },
  saveButton: { flex: 2, ...shared.buttonPrimary, paddingVertical: 13 },
  saveText: { ...shared.buttonPrimaryText },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  pressed: { backgroundColor: colors.plumTint },

  logoutButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.brickTint,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  logoutText: { color: colors.brick, fontWeight: "800", fontSize: 15 },
});
