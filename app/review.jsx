import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
  Linking,
} from "react-native";

import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function PendingCard({ item, adminId, onDone }) {
  const [idUrl, setIdUrl] = useState(null);
  const [loadingId, setLoadingId] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggleId() {
    if (idUrl) {
      setIdUrl(null);
      return;
    }

    if (!item.id_photo_path) {
      showMessage("No ID", "This customer has no ID photo on file.");
      return;
    }

    setLoadingId(true);

    // private bucket: a short-lived signed link (5 minutes)
    const { data, error } = await supabase.storage
      .from("customer-ids")
      .createSignedUrl(item.id_photo_path, 300);

    setLoadingId(false);

    if (error) {
      console.log("SIGNED URL ERROR:", error);
      showMessage("Could not load ID", error.message);
      return;
    }

    setIdUrl(data.signedUrl);
  }

  async function decide(action) {
    if (action === "rejected" && !remarks.trim()) {
      showMessage(
        "Reason Needed",
        "Please type why you are rejecting this customer so they can fix it.",
      );
      return;
    }

    setBusy(true);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        verification_status: action === "approved" ? "verified" : "rejected",
        verification_remarks: action === "rejected" ? remarks.trim() : null,
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .select();

    if (error) {
      setBusy(false);
      showMessage("Failed", error.message);
      return;
    }

    if (!data || data.length === 0) {
      setBusy(false);
      showMessage(
        "Failed",
        "Nothing was updated. Check the profiles update policy.",
      );
      return;
    }

    // audit trail
    const { error: logError } = await supabase
      .from("verification_logs")
      .insert({
        customer_id: item.id,
        admin_id: adminId,
        action,
        remarks: remarks.trim() || null,
      });

    if (logError) {
      console.log("VERIFICATION LOG ERROR:", logError);
      showMessage(
        "Saved, but not logged",
        "The decision was saved, but the log entry failed: " + logError.message,
      );
    }

    setBusy(false);
    onDone();
  }

  const hasPin = item.latitude && item.longitude;
  const initial = (item.full_name || "?").trim()[0]?.toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.full_name}
          </Text>
          {!!item.id_submitted_at && (
            <Text style={styles.submitted}>
              Submitted {new Date(item.id_submitted_at).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View style={styles.pendingPill}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.line}>📱 {item.phone || "-"}</Text>
        <Text style={styles.line}>
          📍 {item.address || "-"}, {item.barangay || "-"},{" "}
          {item.city || "Tagum City"}
        </Text>

        {hasPin && (
          <Pressable
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps?q=${item.latitude},${item.longitude}`,
              )
            }
          >
            <Text style={styles.link}>Open map pin in Google Maps →</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.outlineButton} onPress={toggleId}>
        <Text style={styles.outlineText}>
          {loadingId ? "Loading..." : idUrl ? "Hide ID" : "🪪  View ID"}
        </Text>
      </Pressable>

      {idUrl && (
        <Image
          source={{ uri: idUrl }}
          style={styles.idImage}
          resizeMode="contain"
        />
      )}

      <TextInput
        style={styles.input}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Remarks (required if rejecting)"
        placeholderTextColor={colors.inkSoft}
      />

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.approve, busy && { opacity: 0.6 }]}
          onPress={() => decide("approved")}
          disabled={busy}
        >
          <Text style={styles.approveText}>✓ Approve</Text>
        </Pressable>

        <Pressable
          style={[styles.reject, busy && { opacity: 0.6 }]}
          onPress={() => decide("rejected")}
          disabled={busy}
        >
          <Text style={styles.rejectText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ReviewCustomers() {
  const { user } = useAuth();

  const [pending, setPending] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("verification_status", "pending")
      .order("id_submitted_at", { ascending: true });

    if (error) {
      console.log("PENDING LOAD ERROR:", error);
      showMessage("Error", error.message);
      return;
    }

    setPending(data);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <StaffHeader
        title="Pending Customers"
        subtitle={
          pending.length > 0
            ? `${pending.length} waiting for review`
            : "Verify new customers"
        }
      />

      <FlatList
        data={pending}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <PendingCard item={item} adminId={user.id} onDone={load} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🪪"
            title="All caught up"
            text="No customers waiting for verification."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.paper,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.plum },

  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  submitted: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },

  pendingPill: {
    backgroundColor: colors.marigoldTint,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pendingText: { color: colors.marigold, fontSize: 12, fontWeight: "700" },

  infoBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 6,
  },
  line: { color: colors.ink, fontSize: 14 },
  link: { color: colors.plum, fontWeight: "700", fontSize: 13, marginTop: 2 },

  outlineButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.plum,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineText: { color: colors.plum, fontWeight: "700" },

  idImage: {
    width: "100%",
    height: 260,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.plumTint,
  },

  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.ink,
  },

  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  approve: {
    flex: 2,
    backgroundColor: colors.fern,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  approveText: { color: colors.white, fontWeight: "700" },

  reject: {
    flex: 1,
    backgroundColor: colors.brickTint,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectText: { color: colors.brick, fontWeight: "700" },
});
