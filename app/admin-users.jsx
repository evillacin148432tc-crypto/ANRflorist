import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";

const ROLES = ["customer", "staff", "admin"];

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(title, message) {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirm", onPress: () => resolve(true) },
    ]);
  });
}

function UserRow({ item, isSelf, onChanged }) {
  const [busy, setBusy] = useState(false);

  async function changeRole(role) {
    if (role === item.role) return;

    const confirmed = await confirmAction(
      "Change Role",
      `Make ${item.full_name || item.email} a "${role}"?`,
    );

    if (!confirmed) return;

    setBusy(true);
    const { error } = await supabase.rpc("admin_set_role", {
      p_user_id: item.id,
      p_role: role,
    });
    setBusy(false);

    if (error) {
      showMessage("Failed", error.message);
      return;
    }

    onChanged();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.name}>
        {item.full_name || "(no name)"} {isSelf ? "(you)" : ""}
      </Text>
      <Text style={styles.email}>{item.email}</Text>
      <Text style={styles.line}>
        Role: <Text style={styles.bold}>{item.role}</Text> | Verification:{" "}
        {item.verification_status}
      </Text>

      {!isSelf && (
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <Pressable
              key={r}
              style={[
                styles.roleChip,
                item.role === r && styles.roleChipActive,
                busy && { opacity: 0.6 },
              ]}
              onPress={() => changeRole(r)}
              disabled={busy}
            >
              <Text
                style={[
                  styles.roleChipText,
                  item.role === r && styles.roleChipTextActive,
                ]}
              >
                {r}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AdminUsers() {
  const router = useRouter();
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function load() {
    const { data, error } = await supabase.rpc("admin_list_users");

    if (error) {
      console.log("ADMIN LIST USERS ERROR:", error);
      showMessage("Error", error.message);
      return;
    }

    setUsers(data);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = users.filter((u) => {
    const text = `${u.full_name || ""} ${u.email || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace("/")}>
        <Text style={styles.back}>← Back to Inventory</Text>
      </Pressable>

      <Text style={styles.title}>Manage Users</Text>

      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email..."
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <UserRow item={item} isSelf={item.id === user.id} onChanged={load} />
        )}
        ListEmptyComponent={<Text>No users found.</Text>}
      />
    </View>
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

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
    marginBottom: 15,
  },

  card: {
    padding: 15,
    marginBottom: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  name: {
    fontSize: 17,
    fontWeight: "bold",
  },

  email: {
    color: "#555",
    marginTop: 2,
  },

  line: {
    marginTop: 6,
    color: "#444",
  },

  bold: {
    fontWeight: "bold",
  },

  roleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  roleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#999",
    alignItems: "center",
  },

  roleChipActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },

  roleChipText: {
    color: "#333",
    fontWeight: "600",
    fontSize: 13,
  },

  roleChipTextActive: {
    color: "#fff",
  },
});
