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
import { colors, spacing, radius, type } from "../lib/theme";
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.avatarRow}>
          <Pressable
            onPress={pickAvatar}
            style={styles.avatarWrap}
            disabled={uploadingAvatar}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Icon name="person" size={30} color={colors.plum} />
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

          <View>
            <Text style={styles.name}>{profile?.full_name || user?.email}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {profile?.verification_status === "verified"
                  ? "Verified"
                  : profile?.verification_status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email}</Text>

          <Text style={styles.label}>Mobile number</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{profile?.phone || "—"}</Text>
          )}

          <Text style={styles.label}>Barangay</Text>
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
            <Text style={styles.value}>
              {profile?.barangay || "—"}, Tagum City
            </Text>
          )}

          <Text style={styles.label}>Street / Purok / House No.</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
            />
          ) : (
            <Text style={styles.value}>{profile?.address || "—"}</Text>
          )}

          {editing ? (
            <Pressable
              style={[styles.primaryButton, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Saving…" : "Save changes"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.outlineButton}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.outlineText}>Edit details</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={styles.linkRow}
          onPress={() => router.push("/orders")}
        >
          <Text style={styles.linkText}>My orders →</Text>
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>

      <CustomerTabBar active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  title: { ...type.display, marginBottom: spacing.lg },

  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  avatarWrap: {
    position: "relative",
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.plumTint,
  },

  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },

  name: { fontSize: 17, fontWeight: "700", color: colors.ink },

  statusPill: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.fernTint,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },

  statusPillText: { color: colors.fern, fontSize: 12, fontWeight: "700" },

  card: {
    ...{
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.lg,
    },
  },

  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.inkSoft,
    marginTop: spacing.md,
  },
  value: { fontSize: 15, color: colors.ink, marginTop: 2 },

  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.ink,
    marginTop: 4,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { fontSize: 12, color: colors.ink },
  chipTextActive: { color: colors.white, fontWeight: "700" },

  primaryButton: {
    backgroundColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonText: { color: colors.white, fontWeight: "700" },

  outlineButton: {
    borderWidth: 1,
    borderColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  outlineText: { color: colors.plum, fontWeight: "700" },

  linkRow: { marginTop: spacing.lg },
  linkText: { color: colors.plum, fontWeight: "600" },

  logoutButton: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brick,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: { color: colors.brick, fontWeight: "700" },
});
