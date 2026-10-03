import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";

import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mergeMessages } from "../lib/chatMerge";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type } from "../lib/theme";
import Icon from "../lib/Icon";
import ZoomImage from "../lib/ZoomImage";
import ChatImage from "../lib/ChatImage";
import ChatComposer from "../lib/ChatComposer";
import { pickChatImage, uploadChatImage } from "../lib/chatUpload";

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Height of CustomerTabBar without the bottom safe-area inset.
const TAB_BAR_HEIGHT = 58;

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

// Heading for an order: the product name, or "Name +N more".
// Falls back to the short order number until the items have loaded.
function orderTitle(items, orderId) {
  if (!items || items.length === 0) return `Order #${orderId.slice(0, 8)}`;
  const first = items[0].product?.name || "Item";
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

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
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  const [statusRows, setStatusRows] = useState([]);
  const [messageRows, setMessageRows] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [image, setImage] = useState(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [itemsByOrder, setItemsByOrder] = useState({});
  const itemsLoaded = useRef(new Set());

  // The bottom tab bar floats over the screen (position: absolute), so the
  // message box has to sit above it. While typing, the keyboard takes over
  // that space, so the tab bar steps aside.
  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const b = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const tabBarSpace = TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.sm);

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

    if (!statusResult.error) {
      const rows = statusResult.data || [];
      setStatusRows(rows);

      // Fetch the products for any order we haven't loaded yet (once each).
      const ids = [...new Set(rows.map((r) => r.order_id))].filter(
        (id) => id && !itemsLoaded.current.has(id),
      );
      if (ids.length > 0) {
        ids.forEach((id) => itemsLoaded.current.add(id));

        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select(
            "order_id, quantity, price, product:product_id (name, image_url)",
          )
          .in("order_id", ids);

        if (itemsError) {
          console.log("ORDER ITEMS LOAD ERROR:", itemsError);
          ids.forEach((id) => itemsLoaded.current.delete(id)); // try again next time
        } else {
          const grouped = {};
          (items || []).forEach((it) => {
            (grouped[it.order_id] = grouped[it.order_id] || []).push(it);
          });
          setItemsByOrder((prev) => ({ ...prev, ...grouped }));
        }
      }
    } else console.log("ORDER STATUS HISTORY LOAD ERROR:", statusResult.error);

    if (!messageResult.error) setMessageRows(messageResult.data || []);
    else console.log("CHAT MESSAGES LOAD ERROR:", messageResult.error);
  }, [user?.id]);

  // Load when the screen opens, then quietly re-check every few seconds as a
  // safety net in case a realtime event is ever missed.
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 4000);
      return () => clearInterval(timer);
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
        (payload) =>
          setMessageRows((prev) => mergeMessages(prev, [payload.new])),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [user?.id, load]);

  async function choosePhoto() {
    const asset = await pickChatImage();
    if (asset) setImage(asset);
  }

  async function send() {
    const body = draft.trim();
    if ((!body && !image) || !user?.id) return;

    setSending(true);

    // Photos go into this customer's folder in the private chat bucket.
    let imagePath = null;
    if (image) {
      const { path, error: uploadError } = await uploadChatImage(
        user.id,
        image,
      );
      if (uploadError) {
        setSending(false);
        showMessage("Upload Failed", uploadError.message);
        return;
      }
      imagePath = path;
    }

    const sentImage = image;
    setDraft("");
    setImage(null);

    const { data: saved, error } = await supabase
      .from("chat_messages")
      .insert({
        customer_id: user.id,
        sender_role: "customer",
        sender_id: user.id,
        body,
        image_url: imagePath,
      })
      .select("id, sender_role, body, image_url, created_at")
      .single();

    setSending(false);

    // Show the message right away; the realtime copy is de-duplicated by id.
    if (saved) setMessageRows((prev) => mergeMessages(prev, [saved]));

    if (error) {
      console.log("SEND MESSAGE ERROR:", error);
      setDraft(body); // put it back so nothing is lost
      setImage(sentImage);
      showMessage("Not Sent", "Your message could not be sent. Try again.");
    }
  }

  const feed = mergeFeed(statusRows, messageRows);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: spacing.lg + insets.top }]}
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
                    <Text style={styles.orderDividerText} numberOfLines={1}>
                      {orderTitle(itemsByOrder[item.order_id], item.order_id)}
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
                    {item.status === "pending" &&
                      (itemsByOrder[item.order_id] || []).map((it, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          {it.product?.image_url ? (
                            <ZoomImage
                              uri={it.product.image_url}
                              caption={it.product.name}
                              style={styles.itemImage}
                            />
                          ) : (
                            <View
                              style={[styles.itemImage, styles.itemImageEmpty]}
                            >
                              <Icon
                                name="flower-outline"
                                size={20}
                                color={colors.inkSoft}
                              />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName} numberOfLines={2}>
                              {it.product?.name || "Item"}
                            </Text>
                            <Text style={styles.itemQtyLine}>
                              Qty {it.quantity}
                            </Text>
                          </View>
                          <Text style={styles.itemPrice}>₱{it.price}</Text>
                        </View>
                      ))}
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
                  <ChatImage
                    value={item.image_url}
                    style={styles.bubbleImage}
                  />
                )}
                {!!item.body && (
                  <Text
                    style={[
                      styles.bubbleText,
                      isCustomer && styles.bubbleTextCustomer,
                    ]}
                  >
                    {item.body}
                  </Text>
                )}
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

      <ChatComposer
        style={[
          styles.composer,
          { paddingBottom: keyboardOpen ? spacing.sm : tabBarSpace },
        ]}
        draft={draft}
        onChangeDraft={setDraft}
        image={image}
        onPickImage={choosePhoto}
        onClearImage={() => setImage(null)}
        onSend={send}
        sending={sending}
        placeholder="Message ANR Florist..."
      />

      {!keyboardOpen && <CustomerTabBar active="chat" />}
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
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.line,
  },
  itemImageEmpty: { alignItems: "center", justifyContent: "center" },
  itemName: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  itemQtyLine: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  itemPrice: { color: colors.ink, fontSize: 13, fontWeight: "600" },
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

  composer: { paddingTop: spacing.sm },
});
