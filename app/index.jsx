import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
  Platform,
} from "react-native";

import { Link, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { logStockMovement } from "../lib/stockLog";
import { useAuth } from "../lib/AuthProvider";
import { colors, spacing, radius, type } from "../lib/theme";

// Save your logo at assets/logo.png
const LOGO = require("../assets/logo.png");

// Alert.alert does NOT work on web, so these helpers handle both platforms.
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
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

const FILTERS = ["All", "Low stock", "Available", "Overstock"];

export default function Index() {
  const [inventory, setInventory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user, profile, role, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // Reloads every time this screen comes into focus (e.g. after editing/adding)
  useFocusEffect(
    useCallback(() => {
      loadInventory();
      loadPendingCount();
      loadPendingOrderCount();
    }, []),
  );

  async function loadPendingCount() {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending");

    if (!error) setPendingCount(count ?? 0);
  }

  async function loadPendingOrderCount() {
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_status", "pending");

    if (!error) setPendingOrderCount(count ?? 0);
  }

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("material_name", {
        ascending: true,
      });

    if (!error) {
      setInventory(data);
      const low = data.filter(
        (item) => Number(item.current_stock) <= Number(item.minimum_stock),
      );
      setLowStockCount(low.length);
    }
  }

  async function refreshInventory() {
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  }

  async function deleteInventory(item) {
    const confirmed = await confirmAction(
      "Delete Inventory",
      `Are you sure you want to delete "${item.material_name}"?`,
    );

    if (!confirmed) return;

    const { data, error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", item.id)
      .select();

    if (error) {
      showMessage("Delete Failed", error.message);
      return;
    }

    if (!data || data.length === 0) {
      showMessage(
        "Delete Failed",
        "Nothing was deleted. Check the Supabase RLS delete policy on the inventory table.",
      );
      return;
    }

    await logStockMovement({
      inventoryId: item.id,
      materialName: item.material_name,
      before: Number(item.current_stock),
      after: 0,
      reason: "Item deleted",
    });

    setInventory((prev) => prev.filter((i) => i.id !== item.id));
    loadInventory();
  }

  function getStatus(item) {
    const current = Number(item.current_stock);
    const min = Number(item.minimum_stock);
    const max = Number(item.maximum_stock);

    if (current <= min) return "Low stock";
    if (max > 0 && current > max) return "Overstock";
    return "Available";
  }

  function getStatusColor(status) {
    if (status === "Low stock") return colors.brick;
    if (status === "Overstock") return colors.marigold;
    return colors.fern;
  }

  function getStatusTint(status) {
    if (status === "Low stock") return colors.brickTint;
    if (status === "Overstock") return colors.marigoldTint;
    return colors.fernTint;
  }

  // How full the stock bar is (0 to 1)
  function getFill(item) {
    const current = Number(item.current_stock);
    const min = Number(item.minimum_stock);
    const max = Number(item.maximum_stock);

    if (max > 0) return Math.max(0, Math.min(current / max, 1));
    if (min > 0) return Math.max(0, Math.min(current / (min * 2), 1));
    return 0;
  }

  const visibleItems = inventory.filter((item) => {
    const matchesSearch = (item.material_name || "")
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter = filter === "All" || getStatus(item) === filter;
    return matchesSearch && matchesFilter;
  });

  // Quick-action tiles (Users is admin only)
  const actions = [
    {
      href: "/staff-orders",
      icon: "📦",
      label: "Orders",
      badge: pendingOrderCount,
    },
    {
      href: "/review",
      icon: "🪪",
      label: "Verify customers",
      badge: pendingCount,
    },
    { href: "/products", icon: "💐", label: "Bouquets" },
    { href: "/mrp", icon: "📋", label: "Material planning" },
    { href: "/reports", icon: "📊", label: "Reports" },
    ...(role === "admin"
      ? [{ href: "/admin-users", icon: "👥", label: "Manage users" }]
      : []),
  ];

  // Built as a JSX element (not an inline component) so the search box
  // does not lose focus every time you type.
  const header = (
    <View>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>ANR Florist</Text>
            <Text style={styles.who} numberOfLines={1}>
              {profile?.full_name || user?.email} ·{" "}
              <Text style={styles.roleText}>{role}</Text>
            </Text>
          </View>
        </View>

        <Pressable style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{inventory.length}</Text>
          <Text style={styles.statLabel}>Materials</Text>
        </View>

        <Link href="/mrp" asChild>
          <Pressable
            style={StyleSheet.flatten([
              styles.statCard,
              lowStockCount > 0 && { backgroundColor: colors.brickTint },
            ])}
          >
            <Text
              style={[
                styles.statNumber,
                lowStockCount > 0 && { color: colors.brick },
              ]}
            >
              {lowStockCount}
            </Text>
            <Text style={styles.statLabel}>Low stock</Text>
          </Pressable>
        </Link>

        <Link href="/staff-orders" asChild>
          <Pressable
            style={StyleSheet.flatten([
              styles.statCard,
              pendingOrderCount > 0 && { backgroundColor: colors.marigoldTint },
            ])}
          >
            <Text
              style={[
                styles.statNumber,
                pendingOrderCount > 0 && { color: colors.marigold },
              ]}
            >
              {pendingOrderCount}
            </Text>
            <Text style={styles.statLabel}>New orders</Text>
          </Pressable>
        </Link>
      </View>

      {/* Alerts */}
      {(lowStockCount > 0 || pendingOrderCount > 0) && (
        <View style={styles.alertBanner}>
          {lowStockCount > 0 && (
            <Link href="/mrp" asChild>
              <Pressable>
                <Text style={styles.alertText}>
                  ⚠️ {lowStockCount} item{lowStockCount > 1 ? "s" : ""} low on
                  stock — view reorder suggestions
                </Text>
              </Pressable>
            </Link>
          )}

          {pendingOrderCount > 0 && (
            <Link href="/staff-orders" asChild>
              <Pressable>
                <Text style={styles.alertText}>
                  🛎️ {pendingOrderCount} new order
                  {pendingOrderCount > 1 ? "s" : ""} waiting to be prepared
                </Text>
              </Pressable>
            </Link>
          )}
        </View>
      )}

      {/* Quick actions */}
      <Text style={styles.sectionLabel}>Quick actions</Text>
      <View style={styles.actionGrid}>
        {actions.map((a) => (
          <Link key={a.href} href={a.href} asChild>
            <Pressable style={styles.actionTile}>
              <View style={styles.actionIcon}>
                <Text style={{ fontSize: 20 }}>{a.icon}</Text>
                {a.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{a.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionLabel} numberOfLines={2}>
                {a.label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>

      {/* Inventory header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.title}>Inventory</Text>

        <Link href="/add" asChild>
          <Pressable style={styles.addPill}>
            <Text style={styles.addPillText}>+ Add new</Text>
          </Pressable>
        </Link>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search materials..."
        placeholderTextColor={colors.inkSoft}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, filter === f && styles.chipTextActive]}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshInventory}
          />
        }
        renderItem={({ item }) => {
          const status = getStatus(item);
          const statusColor = getStatusColor(status);
          const fill = getFill(item);

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.material_name}
                  </Text>
                  <Text style={styles.category}>{item.category}</Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: getStatusTint(status) },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {status}
                  </Text>
                </View>
              </View>

              <Text style={styles.stock}>
                {item.current_stock}{" "}
                <Text style={styles.unit}>{item.unit}</Text>
              </Text>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${fill * 100}%`, backgroundColor: statusColor },
                  ]}
                />
              </View>

              <Text style={styles.limits}>
                Min {item.minimum_stock} · Max{" "}
                {Number(item.maximum_stock) > 0
                  ? item.maximum_stock
                  : "not set"}
              </Text>

              <View style={styles.buttonRow}>
                <Link
                  href={{ pathname: "/edit", params: { id: String(item.id) } }}
                  asChild
                >
                  <Pressable style={styles.editButton}>
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                </Link>

                {role === "admin" && (
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteInventory(item)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {inventory.length === 0
              ? "No inventory found."
              : "No materials match your search."}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  brandRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: { width: 52, height: 48 },
  brand: { fontSize: 18, fontWeight: "700", color: colors.ink },
  who: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  roleText: { color: colors.plum, fontWeight: "700" },

  logoutButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  logoutText: { fontWeight: "600", color: colors.inkSoft, fontSize: 13 },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statNumber: { fontSize: 24, fontWeight: "700", color: colors.ink },
  statLabel: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },

  /* Alerts */
  alertBanner: {
    backgroundColor: colors.marigoldTint,
    borderWidth: 1,
    borderColor: colors.marigold,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  alertText: {
    color: colors.marigold,
    fontWeight: "600",
    fontSize: 13,
  },

  /* Quick actions */
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionTile: {
    flexBasis: "31%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.plum,
    textAlign: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: colors.brick,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },

  /* Inventory header */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  title: { ...type.display },
  addPill: {
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addPillText: { color: colors.white, fontWeight: "700", fontSize: 13 },

  search: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    fontSize: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    marginBottom: spacing.sm,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.inkSoft },
  chipTextActive: { color: colors.white },

  /* Inventory cards */
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  category: { marginTop: 2, color: colors.inkSoft, fontSize: 13 },

  statusPill: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  statusText: { fontSize: 12, fontWeight: "700" },

  stock: {
    marginTop: spacing.md,
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  unit: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },

  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  barFill: { height: "100%", borderRadius: 4 },

  limits: { marginTop: 6, color: colors.inkSoft, fontSize: 12 },

  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.plum,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  editButtonText: { color: colors.plum, fontWeight: "700", fontSize: 14 },

  deleteButton: {
    flex: 1,
    backgroundColor: colors.brickTint,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  deleteButtonText: { color: colors.brick, fontWeight: "700", fontSize: 14 },

  empty: {
    color: colors.inkSoft,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
