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

import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";

const ROLES = ["customer", "staff", "admin"];

const ROLE_STYLE = {
  customer: { bg: colors.plumTint, fg: colors.plum },
  staff: { bg: colors.marigoldTint, fg: colors.marigold },
  admin: { bg: colors.brickTint, fg: colors.brick },
};

const VERIFY_STYLE = {
  verified: { bg: colors.fernTint, fg: colors.fern, label: "Verified" },
  pending: { bg: colors.marigoldTint, fg: colors.marigold, label: "Pending" },
  rejected: { bg: colors.brickTint, fg: colors.brick, label: "Rejected" },
  unverified: { bg: colors.line, fg: colors.inkSoft, label: "Unverified" },
};

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

  const initial = (item.full_name || item.email || "?")
    .trim()[0]
    ?.toUpperCase();
  const roleStyle = ROLE_STYLE[item.role] || ROLE_STYLE.customer;
  const verify =
    VERIFY_STYLE[item.verification_status] || VERIFY_STYLE.unverified;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.full_name || "(no name)"}
            {isSelf ? "  (you)" : ""}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: roleStyle.bg }]}>
          <Text style={[styles.badgeText, { color: roleStyle.fg }]}>
            {item.role}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: verify.bg }]}>
          <Text style={[styles.badgeText, { color: verify.fg }]}>
            {verify.label}
          </Text>
        </View>
      </View>

      {!isSelf && (
        <View style={[styles.segment, busy && { opacity: 0.6 }]}>
          {ROLES.map((r) => (
            <Pressable
              key={r}
              style={[
                styles.segmentItem,
                item.role === r && styles.segmentItemActive,
              ]}
              onPress={() => changeRole(r)}
              disabled={busy}
            >
              <Text
                style={[
                  styles.segmentText,
                  item.role === r && styles.segmentTextActive,
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
      <StaffHeader
        title="Manage Users"
        subtitle={`${users.length} account${users.length === 1 ? "" : "s"}`}
      />

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email..."
        placeholderTextColor={colors.inkSoft}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <UserRow item={item} isSelf={item.id === user.id} onChanged={load} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title="No users found"
            text="Try another name or email."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.lg,
  },

  search: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    fontSize: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    marginBottom: spacing.md,
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

  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  email: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },

  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.md,
  },

  badge: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },

  badgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.plumTint,
    borderRadius: radius.pill,
    padding: 4,
    marginTop: spacing.md,
  },

  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: "center",
  },

  segmentItemActive: { backgroundColor: colors.plum },

  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkSoft,
    textTransform: "capitalize",
  },

  segmentTextActive: { color: colors.white, fontWeight: "700" },
});
