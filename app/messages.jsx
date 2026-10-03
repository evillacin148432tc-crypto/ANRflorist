import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import StaffHeader, { EmptyState } from "../lib/StaffHeader";
import { colors, spacing, radius } from "../lib/theme";

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : d.toLocaleDateString();
}

export default function Messages() {
  const router = useRouter();
  const [threads, setThreads] = useState([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    // Newest first, then grouped by customer in JS below so each customer
    // appears once with their most recent message and unread count.
    // (Plain query, no joins: a join on a column that doesn't exist makes the
    // whole query fail and the inbox shows "0 conversations".)
    const { data, error } = await supabase
      .from("chat_messages")
      .select(
        "id, customer_id, sender_role, body, image_url, created_at, read_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.log("MESSAGES LOAD ERROR:", error);
      return;
    }

    // Look up the customers' names separately.
    const ids = [...new Set(data.map((r) => r.customer_id).filter(Boolean))];
    const names = {};
    if (ids.length > 0) {
      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);

      if (peopleError) console.log("MESSAGES NAMES ERROR:", peopleError);
      (people || []).forEach((p) => {
        names[p.id] = p;
      });
    }

    const byCustomer = new Map();
    for (const row of data) {
      const existing = byCustomer.get(row.customer_id);
      if (!existing) {
        byCustomer.set(row.customer_id, {
          ...row,
          customer: names[row.customer_id],
          unread: 0,
        });
      }
      const entry = byCustomer.get(row.customer_id);
      if (row.sender_role === "customer" && !row.read_at) entry.unread += 1;
    }

    setThreads(Array.from(byCustomer.values()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 5000); // safety net for missed realtime events
      return () => clearInterval(timer);
    }, [load]),
  );

  // Live updates: a new message from any customer bumps them to the top and
  // updates their unread count immediately.
  useEffect(() => {
    const channel = supabase
      .channel("staff-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = threads.filter((t) => {
    const text = (t.customer?.full_name || "Customer").toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <View style={styles.container}>
      <StaffHeader
        title="Messages"
        subtitle={
          totalUnread > 0
            ? `${totalUnread} unread`
            : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`
        }
      />

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name..."
        placeholderTextColor={colors.inkSoft}
      />

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.customer_id}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const displayName = item.customer?.full_name || "Customer";
          const initial = displayName.trim()[0]?.toUpperCase();
          const text = item.body || (item.image_url ? "📷 Photo" : "");
          const preview = item.sender_role === "staff" ? `You: ${text}` : text;

          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/chat-thread",
                  params: {
                    customerId: item.customer_id,
                    name: displayName,
                  },
                })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.time}>{formatTime(item.created_at)}</Text>
                </View>

                <View style={styles.rowBottom}>
                  <Text
                    style={[
                      styles.preview,
                      item.unread > 0 && styles.previewUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>

                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No messages yet"
            text="Customer conversations will show up here."
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

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
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

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
  time: { fontSize: 11, color: colors.inkSoft },

  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: 2,
  },
  preview: { flex: 1, fontSize: 13, color: colors.inkSoft },
  previewUnread: { color: colors.ink, fontWeight: "700" },

  badge: {
    backgroundColor: colors.brick,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
});
