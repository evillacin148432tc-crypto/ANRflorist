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

// One read-only info row with an icon, label, value and optional divider
function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[styles.infoRow, !last && styles.rowDivider]}>
      <View style={styles.iconBubble}>
        <Text style={styles.iconGlyph}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

// One tappable menu row with a chevron
function MenuRow({ icon, label, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.rowDivider,
        pressed && { backgroundColor: colors.plumTint },
      ]}
    >
      <View style={styles.iconBubble}>
        <Text style={styles.iconGlyph}>{icon}</Text>
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function Profile() {
  const router = useRouter();
  const { profile, user, signOut, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [barangay, setBarangay] = useState(profile?.barangay ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [saving, setSaving] = useState(false);

  const isVerified = profile?.verification_status === "verified";

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

  function cancelEdit() {
    setPhone(profile?.phone ?? "");
    setBarangay(profile?.barangay ?? "");
    setAddress(profile?.address ?? "");
    setEditing(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 34 }}>🌷</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {profile?.full_name || user?.email}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email}
            </Text>

            {!!profile?.verification_status && (
              <View
                style={[
                  styles.statusPill,
                  !isVerified && styles.statusPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    !isVerified && styles.statusPillTextPending,
                  ]}
                >
                  {isVerified ? "✓ Verified" : profile.verification_status}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Contact & delivery */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Contact & delivery</Text>
          {!editing && (
            <Pressable style={styles.editPill} onPress={() => setEditing(true)}>
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          {editing ? (
            <View style={styles.editWrap}>
              <Text style={styles.label}>Mobile number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="09123456789"
                placeholderTextColor={colors.inkSoft}
              />

              <Text style={[styles.label, styles.fieldGap]}>Barangay</Text>
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

              <Text style={[styles.label, styles.fieldGap]}>
                Street / Purok / House No.
              </Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Purok 2"
                placeholderTextColor={colors.inkSoft}
              />

              <View style={styles.editActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.primaryButton, saving && { opacity: 0.6 }]}
                  onPress={save}
                  disabled={saving}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? "Saving…" : "Save changes"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <InfoRow
                icon="📱"
                label="Mobile number"
                value={profile?.phone || "—"}
              />
              <InfoRow
                icon="📍"
                label="Barangay"
                value={
                  profile?.barangay ? `${profile.barangay}, Tagum City` : "—"
                }
              />
              <InfoRow
                icon="🏠"
                label="Street / Purok / House No."
                value={profile?.address || "—"}
                last
              />
            </>
          )}
        </View>

        {/* Account */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Account</Text>
        </View>

        <View style={styles.card}>
          <MenuRow
            icon="📦"
            label="My orders"
            onPress={() => router.push("/orders")}
          />
          <MenuRow
            icon="❤️"
            label="Wishlist"
            onPress={() => router.push("/wishlist")}
          />
          <MenuRow
            icon="💬"
            label="Help & support"
            onPress={() => router.push("/support")}
            last
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
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  title: { ...type.display, marginBottom: spacing.lg },

  /* Header card */
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.plumTint,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.ink },
  email: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },

  statusPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.fernTint,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  statusPillPending: { backgroundColor: colors.white },
  statusPillText: { color: colors.fern, fontSize: 12, fontWeight: "700" },
  statusPillTextPending: { color: colors.inkSoft },

  /* Sections */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  editPill: {
    borderWidth: 1,
    borderColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  editPillText: { color: colors.plum, fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },

  /* Rows */
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: { fontSize: 16 },

  label: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  value: { fontSize: 15, color: colors.ink, marginTop: 2 },

  menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  chevron: { fontSize: 22, color: colors.inkSoft },

  /* Edit mode */
  editWrap: { padding: spacing.lg },
  fieldGap: { marginTop: spacing.md },
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

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
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

  editActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  cancelText: { color: colors.inkSoft, fontWeight: "700" },
  primaryButton: {
    flex: 2,
    backgroundColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.white, fontWeight: "700" },

  /* Log out */
  logoutButton: {
    marginTop: spacing.xl,
    backgroundColor: "#FBEDED",
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: colors.brick, fontWeight: "700" },
});
