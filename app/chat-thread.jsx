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
} from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { colors, spacing, radius } from "../lib/theme";

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatThread() {
  const { customerId, name } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const listRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_role, body, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true });

    if (!error) setMessages(data || []);
  }, [customerId]);

  async function markRead() {
    if (!customerId) return;

    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("customer_id", customerId)
      .eq("sender_role", "customer")
      .is("read_at", null);
  }

  useFocusEffect(
    useCallback(() => {
      load();
      markRead();
    }, [load]),
  );

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
          setMessages((prev) => [...prev, payload.new]);
          if (payload.new.sender_role === "customer") markRead();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  async function send() {
    const body = draft.trim();
    if (!body || !user?.id || !customerId) return;

    setDraft("");
    setSending(true);

    const { error } = await supabase.from("chat_messages").insert({
      customer_id: customerId,
      sender_role: "staff",
      sender_id: user.id,
      body,
    });

    setSending(false);

    if (error) {
      console.log("SEND MESSAGE ERROR:", error);
      setDraft(body); // put it back so nothing is lost
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/messages")} hitSlop={8}>
          <Text style={styles.back}>‹ Messages</Text>
        </Pressable>
        <Text style={styles.name} numberOfLines={1}>
          {name || "Customer"}
        </Text>
        <View style={{ width: 70 }} />
      </View>

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
                <Text
                  style={[styles.bubbleText, isStaff && styles.bubbleTextStaff]}
                >
                  {item.body}
                </Text>
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

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a reply..."
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
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
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
    backgroundColor: colors.paper,
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
