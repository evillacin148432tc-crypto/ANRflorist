import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import CustomerTabBar from "../lib/CustomerTabBar";
import { colors, spacing, radius, type } from "../lib/theme";

// NOTE: replace these with ANR Florist's real numbers/links before using
// this in production. Live in-app chat (a message thread with staff) would
// need its own database table and a staff-side inbox screen — a separate
// feature from this "how to reach us" screen.
const SHOP_PHONE = "+639000000000";
const SHOP_MESSENGER_URL = "https://m.me/anrflorist";

export default function Support() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Get in touch</Text>
      <Text style={styles.subtitle}>
        Questions about an order or a bouquet? Reach us directly.
      </Text>

      <Pressable
        style={styles.card}
        onPress={() => Linking.openURL(`tel:${SHOP_PHONE}`)}
      >
        <Text style={{ fontSize: 22 }}>📞</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Call ANR Florist</Text>
          <Text style={styles.cardSubtitle}>{SHOP_PHONE}</Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => Linking.openURL(`sms:${SHOP_PHONE}`)}
      >
        <Text style={{ fontSize: 22 }}>💬</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Text us</Text>
          <Text style={styles.cardSubtitle}>{SHOP_PHONE}</Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() => Linking.openURL(SHOP_MESSENGER_URL)}
      >
        <Text style={{ fontSize: 22 }}>📘</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Message on Facebook</Text>
          <Text style={styles.cardSubtitle}>Usually replies within a day</Text>
        </View>
      </Pressable>

      <CustomerTabBar active="chat" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.lg },
  title: { ...type.display },
  subtitle: {
    color: colors.inkSoft,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  cardSubtitle: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
});
