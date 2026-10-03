import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  Image,
} from "react-native";

import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type } from "../lib/theme";
import Icon from "../lib/Icon";

const STATUS_LABEL = {
  pending: "Order placed",
  preparing: "Preparing your order",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_ICON = {
  pending: "receipt-outline",
  preparing: "construct-outline",
  out_for_delivery: "car-outline",
  delivered: "checkmark-circle-outline",
  cancelled: "close-circle-outline",
};

const STATUS_COLOR = {
  pending: colors.marigold,
  preparing: colors.plum,
  out_for_delivery: "#2F7D9A",
  delivered: colors.fern,
  cancelled: colors.brick,
};

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString()} · ${time}`;
}

// Merges order-status system events with real chat messages into one
// chronological feed, each item tagged with a `kind` so it renders
// differently ("system" bubble vs. a real message bubble).
function mergeFeed(statusRows, messageRows) {
  const items = [
    ...statusRows.map((r) => ({ kind: "system", sortKey: r.created_at, ...r })),
    ...messageRows.map((r) => ({
      kind: "message",
      sortKey: r.created_at,
      ...r,
    })),
  ];
  items.sort((a, b) => new Date(a.sortKey) - new Date(b.sortKey));
  return items;
}

export default function Support() {
  const { user } = useAuth();
  const listRef = useRef(null);

  const [statusRows, setStatusRows] = useState([]);
  const [messageRows, setMessageRows] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setStatusRows([]);
      setMessageRows([]);
      return;
    }

    // RLS restricts both queries to this customer's own data, so no extra
    // filter is needed on the status history.
    const [statusResult, messageResult] = await Promise.all([
      supabase
        .from("order_status_history")
        .select(
          "id, order_id, status, remarks, created_at, order:order_id (id, total_amount, delivery_address, delivery_barangay)",
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("chat_messages")
        .select("id, sender_role, body, image_url, created_at")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    if (!statusResult.error) setStatusRows(statusResult.data || []);
    else console.log("ORDER STATUS HISTORY LOAD ERROR:", statusResult.error);

    if (!messageResult.error) setMessageRows(messageResult.data || []);
    else console.log("CHAT MESSAGES LOAD ERROR:", messageResult.error);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live updates: a new order-status event or a staff reply appears the
  // instant it happens, with no refresh needed.
  useEffect(() => {
    if (!user?.id) return;

    const statusChannel = supabase
      .channel(`order-updates-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history" },
        () => load(),
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`chat-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `customer_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [user?.id, load]);

  async function send() {
    const body = draft.trim();
    if (!body || !user?.id) return;

    setDraft("");
    setSending(true);

    const { error } = await supabase.from("chat_messages").insert({
      customer_id: user.id,
      sender_role: "customer",
      sender_id: user.id,
      body,
    });

    setSending(false);

    if (error) {
      console.log("SEND MESSAGE ERROR:", error);
      setDraft(body); // put it back so nothing is lost
    }
  }

  const feed = mergeFeed(statusRows, messageRows);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Chat</Text>

      {/* Merged feed: automatic order updates + real messages with staff */}
      <FlatList
        ref={listRef}
        data={feed}
        keyExtractor={(row) => `${row.kind}-${row.id}`}
        contentContainerStyle={{ paddingBottom: 16, paddingTop: spacing.sm }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item, index }) => {
          if (item.kind === "system") {
            const prev = feed[index - 1];
            const isNewOrder =
              !prev ||
              prev.kind !== "system" ||
              prev.order_id !== item.order_id;
            const color = STATUS_COLOR[item.status] || colors.inkSoft;

            return (
              <View>
                {isNewOrder && (
                  <View style={styles.orderDivider}>
                    <Text style={styles.orderDividerText}>
                      Order #{item.order_id.slice(0, 8)}
                      {item.order?.delivery_barangay
                        ? ` · ${item.order.delivery_barangay}`
                        : ""}
                    </Text>
                  </View>
                )}

                <View style={styles.systemRow}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: color + "22" },
                    ]}
                  >
                    <Icon
                      name={STATUS_ICON[item.status] || "cube-outline"}
                      size={18}
                      color={color}
                    />
                  </View>

                  <View style={styles.systemBubble}>
                    <Text style={[styles.systemTitle, { color }]}>
                      {STATUS_LABEL[item.status] || item.status}
                    </Text>
                    {!!item.remarks && (
                      <Text style={styles.systemText}>{item.remarks}</Text>
                    )}
                    {item.status === "pending" && item.order?.total_amount && (
                      <Text style={styles.systemText}>
                        Total ₱{item.order.total_amount}
                        {item.order.delivery_address
                          ? ` · ${item.order.delivery_address}`
                          : ""}
                      </Text>
                    )}
                    <Text style={styles.systemTime}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }

          // A real chat message
          const isCustomer = item.sender_role === "customer";
          return (
            <View
              style={[
                styles.bubbleRow,
                isCustomer ? styles.bubbleRowCustomer : styles.bubbleRowStaff,
              ]}
            >
              <View
                style={[styles.bubble, isCustomer && styles.bubbleCustomer]}
              >
                {!!item.image_url && (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.bubbleImage}
                    resizeMode="contain"
                  />
                )}
                <Text
                  style={[
                    styles.bubbleText,
                    isCustomer && styles.bubbleTextCustomer,
                  ]}
                >
                  {item.body}
                </Text>
                <Text
                  style={[
                    styles.bubbleTime,
                    isCustomer && styles.bubbleTimeCustomer,
                  ]}
                >
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="cube-outline" size={40} color={colors.inkSoft} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              Order updates and replies from ANR Florist will show up here.
            </Text>
          </View>
        }
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message ANR Florist..."
          placeholderTextColor={colors.inkSoft}
          multiline
        />
        <Pressable
          style={[
            styles.sendButton,
            (!draft.trim() || sending) && { opacity: 0.5 },
          ]}
          onPress={send}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>

      <CustomerTabBar active="chat" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  title: { ...type.display, marginBottom: spacing.md },

  orderDivider: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginVertical: spacing.md,
  },
  orderDividerText: { fontSize: 11, fontWeight: "700", color: colors.inkSoft },

  systemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  systemBubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    padding: spacing.md,
  },
  systemTitle: { fontSize: 14, fontWeight: "700" },
  systemText: { fontSize: 13, color: colors.ink, marginTop: 4 },
  systemTime: { fontSize: 11, color: colors.inkSoft, marginTop: 6 },

  bubbleRow: { marginBottom: spacing.sm, flexDirection: "row" },
  bubbleRowStaff: { justifyContent: "flex-start" },
  bubbleRowCustomer: { justifyContent: "flex-end" },

  bubble: {
    maxWidth: "78%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    padding: spacing.md,
  },
  bubbleCustomer: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: 4,
  },
  bubbleImage: {
    width: 220,
    height: 260,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    marginBottom: 6,
  },
  bubbleText: { fontSize: 14, color: colors.ink },
  bubbleTextCustomer: { color: colors.white },
  bubbleTime: { fontSize: 10, color: colors.inkSoft, marginTop: 4 },
  bubbleTimeCustomer: { color: "rgba(255,255,255,0.75)" },

  empty: {
    alignItems: "center",
    marginTop: 40,
    gap: 6,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  emptyText: { color: colors.inkSoft, textAlign: "center", fontSize: 13 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  sendButton: {
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  sendText: { color: colors.white, fontWeight: "700" },
});
