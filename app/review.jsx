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

import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";

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

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.full_name}</Text>
      <Text style={styles.line}>Phone: {item.phone || "-"}</Text>
      <Text style={styles.line}>
        Address: {item.address || "-"}, {item.barangay || "-"},{" "}
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
          <Text style={styles.link}>Open map pin in Google Maps</Text>
        </Pressable>
      )}

      <Pressable style={styles.outlineButton} onPress={toggleId}>
        <Text style={styles.outlineText}>
          {loadingId ? "Loading..." : idUrl ? "Hide ID" : "View ID"}
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
      />

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.approve, busy && { opacity: 0.6 }]}
          onPress={() => decide("approved")}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Approve</Text>
        </Pressable>

        <Pressable
          style={[styles.reject, busy && { opacity: 0.6 }]}
          onPress={() => decide("rejected")}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ReviewCustomers() {
  const router = useRouter();
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
      <Pressable onPress={() => router.replace("/")}>
        <Text style={styles.back}>← Back to Inventory</Text>
      </Pressable>

      <Text style={styles.title}>Pending Customers</Text>

      <FlatList
        data={pending}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <PendingCard item={item} adminId={user.id} onDone={load} />
        )}
        ListEmptyComponent={<Text>No customers waiting for verification.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
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

  card: {
    padding: 15,
    marginBottom: 15,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  name: {
    fontSize: 20,
    fontWeight: "bold",
  },

  line: {
    marginTop: 4,
    color: "#444",
  },

  link: {
    marginTop: 6,
    color: "#2196F3",
    fontWeight: "600",
  },

  outlineButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#2196F3",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },

  outlineText: {
    color: "#2196F3",
    fontWeight: "600",
  },

  idImage: {
    width: "100%",
    height: 260,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "#eee",
  },

  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  approve: {
    flex: 1,
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  reject: {
    flex: 1,
    backgroundColor: "red",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
