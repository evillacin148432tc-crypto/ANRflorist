import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mergeMessages } from "../lib/chatMerge";
import Icon from "../lib/Icon";
import ZoomImage from "../lib/ZoomImage";
import { colors, spacing, radius } from "../lib/theme";
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

const STATUS_LABEL = {
  pending: "Pending",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR = {
  pending: colors.marigold,
  preparing: colors.plum,
  out_for_delivery: "#2F7D9A",
  delivered: colors.fern,
  cancelled: colors.brick,
};

const STATUS_TINT = {
  pending: colors.marigoldTint,
  preparing: colors.plumTint,
  out_for_delivery: "#E3F1F6",
  delivered: colors.fernTint,
  cancelled: colors.brickTint,
};

const PAYMENT_LABEL = { cash: "Cash (downpayment)", online: "GCash / online" };

// Title for an order card: the product name, or "Name +N more".
function orderTitle(items) {
  if (!items || items.length === 0) return "Order";
  const first = items[0].product?.name || "Item";
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatThread() {
  const { customerId, name, from, orderId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const listRef = useRef(null);
  const [customerName, setCustomerName] = useState(name || "");

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [image, setImage] = useState(null);

  // The customer's orders (with the products in them) shown above the chat
  const [orders, setOrders] = useState([]);
  const [itemsByOrder, setItemsByOrder] = useState({});
  const [panelOpen, setPanelOpen] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!customerId) return;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("CHAT ORDERS LOAD ERROR:", error);
      return;
    }

    setOrders(data || []);

    const ids = (data || []).map((o) => o.id);
    if (ids.length === 0) return;

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, quantity, price, product:product_id (name, image_url)")
      .in("order_id", ids);

    if (itemsError) {
      console.log("CHAT ORDER ITEMS LOAD ERROR:", itemsError);
      return;
    }

    const grouped = {};
    (items || []).forEach((it) => {
      (grouped[it.order_id] = grouped[it.order_id] || []).push(it);
    });
    setItemsByOrder(grouped);
  }, [customerId]);

  // Which orders to show: the one staff tapped from the Orders screen first,
  // then any still in progress. If everything is finished, just the latest.
  const shownOrders = (() => {
    const open = orders.filter(
      (o) => !["delivered", "cancelled"].includes(o.order_status),
    );
    let list = open;
    const target = orderId ? orders.find((o) => o.id === orderId) : null;
    if (target) list = [target, ...open.filter((o) => o.id !== target.id)];
    if (list.length === 0 && orders.length > 0) list = [orders[0]];
    return list;
  })();

  // If we were opened without a name, look it up so the header isn't generic.
  useEffect(() => {
    if (!customerId || (name && name !== "Customer")) return;

    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", customerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setCustomerName(data.full_name);
      });
  }, [customerId, name]);

  const markRead = useCallback(async () => {
    if (!customerId) return;

    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("customer_id", customerId)
      .eq("sender_role", "customer")
      .is("read_at", null);
  }, [customerId]);

  const load = useCallback(async () => {
    if (!customerId) return;

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_role, body, image_url, created_at, read_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true });

    if (error) return;

    setMessages((prev) => mergeMessages(prev, data || []));

    if ((data || []).some((m) => m.sender_role === "customer" && !m.read_at)) {
      markRead();
    }
  }, [customerId, markRead]);

  // Load when the screen opens, then quietly re-check every few seconds as a
  // safety net in case a realtime event is ever missed (weak signal, etc.).
  useFocusEffect(
    useCallback(() => {
      load();
      loadOrders();
      markRead();
      const timer = setInterval(load, 4000);
      const orderTimer = setInterval(loadOrders, 8000);
      return () => {
        clearInterval(timer);
        clearInterval(orderTimer);
      };
    }, [load, loadOrders, markRead]),
  );

  // Live updates: order status changes for this customer refresh the panel.
  useEffect(() => {
    if (!customerId) return;

    const channel = supabase
      .channel(`chat-orders-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${customerId}`,
        },
        () => loadOrders(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, loadOrders]);

  // Live updates: the customer's replies (or a message sent from another
  // staff device) appear instantly without needing to reopen the thread.
  useEffect(() => {
    if (!customerId) return;

    const channel = supabase
      .channel(`chat-thread-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          setMessages((prev) => mergeMessages(prev, [payload.new]));
          if (payload.new.sender_role === "customer") markRead();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, markRead]);

  async function choosePhoto() {
    const asset = await pickChatImage();
    if (asset) setImage(asset);
  }

  async function send() {
    const body = draft.trim();
    if ((!body && !image) || !user?.id || !customerId) return;

    setSending(true);

    // Staff photos go into the *customer's* folder so the whole thread
    // stays together in storage.
    let imagePath = null;
    if (image) {
      const { path, error: uploadError } = await uploadChatImage(
        customerId,
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
        customer_id: customerId,
        sender_role: "staff",
        sender_id: user.id,
        body,
        image_url: imagePath,
      })
      .select("id, sender_role, body, image_url, created_at, read_at")
      .single();

    setSending(false);

    // Show the reply right away; the realtime copy is de-duplicated by id.
    if (saved) setMessages((prev) => mergeMessages(prev, [saved]));

    if (error) {
      console.log("SEND MESSAGE ERROR:", error);
      setDraft(body); // put it back so nothing is lost
      setImage(sentImage);
      showMessage("Not Sent", "Your reply could not be sent. Try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() =>
            router.replace(from === "orders" ? "/staff-orders" : "/messages")
          }
          hitSlop={8}
        >
          <Text style={styles.back}>
            {from === "orders" ? "‹ Orders" : "‹ Messages"}
          </Text>
        </Pressable>
        <Text style={styles.name} numberOfLines={1}>
          {customerName || "Customer"}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      {shownOrders.length > 0 && (
        <View style={styles.orderPanel}>
          <Pressable
            style={styles.orderPanelHeader}
            onPress={() => setPanelOpen((v) => !v)}
          >
            <Icon name="bag-handle-outline" size={18} color={colors.plum} />
            <Text style={styles.orderPanelTitle}>
              {shownOrders.length === 1
                ? "Customer's order"
                : `Customer's orders (${shownOrders.length})`}
            </Text>
            <Icon
              name={panelOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.inkSoft}
            />
          </Pressable>

          {panelOpen && (
            <ScrollView
              style={styles.orderPanelBody}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {shownOrders.map((o) => {
                const items = itemsByOrder[o.id];
                const color = STATUS_COLOR[o.order_status] || colors.inkSoft;
                const tint = STATUS_TINT[o.order_status] || colors.line;
                return (
                  <View key={o.id} style={styles.orderBox}>
                    <View style={styles.orderTop}>
                      <Text style={styles.orderTitle} numberOfLines={1}>
                        {orderTitle(items)}
                      </Text>
                      <View
                        style={[styles.orderPill, { backgroundColor: tint }]}
                      >
                        <Text style={[styles.orderPillText, { color }]}>
                          {STATUS_LABEL[o.order_status] || o.order_status}
                        </Text>
                      </View>
                    </View>

                    {items === undefined ? (
                      <Text style={styles.orderMeta}>Loading items...</Text>
                    ) : (
                      items.map((it, idx) => (
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
                      ))
                    )}

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>₱{o.total_amount}</Text>
                    </View>

                    {!!o.payment_method && (
                      <Text style={styles.orderMeta}>
                        Payment:{" "}
                        {PAYMENT_LABEL[o.payment_method] || o.payment_method}
                      </Text>
                    )}
                    <Text style={styles.orderMeta}>
                      Deliver to: {o.delivery_address}
                      {o.delivery_barangay ? `, ${o.delivery_barangay}` : ""}
                    </Text>
                    {!!o.delivery_notes && (
                      <Text style={styles.orderMeta}>
                        Note: {o.delivery_notes}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg }}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => {
          const isStaff = item.sender_role === "staff";
          return (
            <View
              style={[
                styles.bubbleRow,
                isStaff ? styles.bubbleRowStaff : styles.bubbleRowCustomer,
              ]}
            >
              <View style={[styles.bubble, isStaff && styles.bubbleStaff]}>
                {!!item.image_url && (
                  <ChatImage
                    value={item.image_url}
                    style={{
                      width: 220,
                      height: 260,
                      borderRadius: 10,
                      marginBottom: 6,
                    }}
                  />
                )}
                {!!item.body && (
                  <Text
                    style={[
                      styles.bubbleText,
                      isStaff && styles.bubbleTextStaff,
                    ]}
                  >
                    {item.body}
                  </Text>
                )}
                <Text
                  style={[styles.bubbleTime, isStaff && styles.bubbleTimeStaff]}
                >
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet. Say hello!</Text>
        }
      />

      <ChatComposer
        style={styles.composer}
        inputStyle={{ backgroundColor: colors.paper }}
        draft={draft}
        onChangeDraft={setDraft}
        image={image}
        onPickImage={choosePhoto}
        onClearImage={() => setImage(null)}
        onSend={send}
        sending={sending}
        placeholder="Type a reply..."
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },
  back: { color: colors.plum, fontWeight: "700", fontSize: 14, width: 70 },
  name: { flex: 1, textAlign: "center", fontWeight: "700", color: colors.ink },

  orderPanel: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  orderPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  orderPanelTitle: {
    flex: 1,
    fontWeight: "700",
    color: colors.ink,
    fontSize: 13,
  },
  orderPanelBody: { maxHeight: 230, paddingHorizontal: spacing.lg },
  orderBox: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 6,
  },
  orderTitle: { flex: 1, fontWeight: "700", color: colors.ink, fontSize: 14 },
  orderPill: {
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  orderPillText: { fontSize: 11, fontWeight: "700" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 4,
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
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 6,
    paddingTop: 6,
  },
  totalLabel: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  totalValue: { fontWeight: "700", color: colors.plum, fontSize: 14 },
  orderMeta: { color: colors.inkSoft, fontSize: 12, marginTop: 4 },

  bubbleRow: { marginBottom: spacing.sm, flexDirection: "row" },
  bubbleRowCustomer: { justifyContent: "flex-start" },
  bubbleRowStaff: { justifyContent: "flex-end" },

  bubble: {
    maxWidth: "78%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    padding: spacing.md,
  },
  bubbleStaff: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: 4,
  },
  bubbleText: { fontSize: 14, color: colors.ink },
  bubbleTextStaff: { color: colors.white },
  bubbleTime: { fontSize: 10, color: colors.inkSoft, marginTop: 4 },
  bubbleTimeStaff: { color: "rgba(255,255,255,0.75)" },

  empty: { color: colors.inkSoft, textAlign: "center", marginTop: 40 },

  composer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
});
