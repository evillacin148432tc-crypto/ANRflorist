import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  Image,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SHOP } from "../lib/shop";
import ShopMap from "../lib/ShopMap";
import CustomerTabBar from "../lib/CustomerTabBar";
import {
  colors,
  spacing,
  radius,
  type,
  shadow,
  shared,
  layout,
} from "../lib/theme";
import Icon from "../lib/Icon";
import { categoryIcon } from "../lib/categoryIcon";

const LOGO = require("../assets/logo.png");

function Row({ icon, label, value, onPress }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      style={
        onPress
          ? ({ pressed }) => [styles.row, pressed && styles.rowPressed]
          : styles.row
      }
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color={colors.plum} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, onPress && styles.link]}>{value}</Text>
      </View>
      {onPress && (
        <Icon name="chevron-forward" size={16} color={colors.inkSoft} />
      )}
    </Wrapper>
  );
}

export default function About() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const open = (url) => Linking.openURL(url);
  const { focus } = useLocalSearchParams();
  const scrollRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const [contactY, setContactY] = useState(null);

  // Opened from "Help & support": scroll to Contact info and pulse it
  useEffect(() => {
    if (focus !== "contact" || contactY === null) return;
    scrollRef.current?.scrollTo({
      y: Math.max(contactY - 80, 0),
      animated: true,
    });
    const t = setTimeout(() => {
      Animated.sequence([
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 500,
              useNativeDriver: false,
            }),
            Animated.timing(pulse, {
              toValue: 0,
              duration: 500,
              useNativeDriver: false,
            }),
          ]),
          { iterations: 3 },
        ),
      ]).start();
    }, 450);
    return () => clearTimeout(t);
  }, [focus, contactY]);

  const contactBorder = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.line, colors.plum],
  });
  const contactBg = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.white, colors.plumTint],
  });
  const contactScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });
  const phoneDigits = SHOP.phone.replace(/\s/g, "");

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: 110 + insets.bottom,
          width: "100%",
          maxWidth: layout.maxWidth,
          alignSelf: "center",
        }}
      >
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Icon name="chevron-back" size={20} color={colors.plum} />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.shopName}>{SHOP.name}</Text>
          <Text style={styles.tagline}>{SHOP.tagline}</Text>
          <View style={styles.statusPill}>
            <View style={styles.dot} />
            <Text style={styles.statusText}>
              {SHOP.hours} · {SHOP.followers}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What we make</Text>
          <Text style={styles.cardHint}>Tap a type to see those bouquets.</Text>
          <View style={styles.tags}>
            {SHOP.services.map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() =>
                  router.push({ pathname: "/catalog", params: { category: s } })
                }
              >
                <View style={styles.tileIcon}>
                  <Icon name={categoryIcon(s)} size={16} color={colors.plum} />
                </View>
                <Text style={styles.tileText} numberOfLines={2}>
                  {s}
                </Text>
                <Icon name="chevron-forward" size={14} color={colors.inkSoft} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Find us</Text>
          <ShopMap
            lat={SHOP.lat}
            lng={SHOP.lng}
            title={SHOP.name}
            height={260}
          />
          <Text style={styles.address}>{SHOP.address}</Text>
          <Pressable
            style={styles.directions}
            onPress={() =>
              open(
                `https://www.google.com/maps/dir/?api=1&destination=${SHOP.lat},${SHOP.lng}`,
              )
            }
          >
            <Icon name="navigate" size={16} color={colors.white} />
            <Text style={styles.directionsText}>Get directions</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <Row icon="time-outline" label="Hours" value={SHOP.hours} />
          <Row icon="location-outline" label="Location" value={SHOP.area} />
        </View>

        <Animated.View
          onLayout={(e) => setContactY(e.nativeEvent.layout.y)}
          style={[
            styles.card,
            {
              borderColor: contactBorder,
              backgroundColor: contactBg,
              transform: [{ scale: contactScale }],
            },
          ]}
        >
          <Text style={styles.cardTitle}>Contact info</Text>
          <Row
            icon="call-outline"
            label="Phone"
            value={SHOP.phone}
            onPress={() => open(`tel:${phoneDigits}`)}
          />
          <Row
            icon="mail-outline"
            label="Email"
            value={SHOP.email}
            onPress={() => open(`mailto:${SHOP.email}`)}
          />
          <Row
            icon="musical-notes-outline"
            label="TikTok"
            value={SHOP.tiktok}
            onPress={() => open(`https://www.tiktok.com/@${SHOP.tiktok}`)}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Messenger"
            value={SHOP.messenger}
            onPress={() => open(SHOP.facebookUrl)}
          />
        </Animated.View>

        <Pressable
          style={styles.portfolio}
          onPress={() => router.push("/portfolio")}
        >
          <Icon name="images-outline" size={18} color={colors.plum} />
          <Text style={styles.portfolioText}>See our work</Text>
        </Pressable>
      </ScrollView>

      <CustomerTabBar active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: -spacing.sm,
  },
  logoRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.plum,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadow,
  },
  logo: { width: 116, height: 116, borderRadius: 58 },
  shopName: { ...type.display, fontSize: 24, textAlign: "center" },
  tagline: { color: colors.inkSoft, marginTop: 2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.fernTint,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.fern },
  statusText: { color: colors.fern, fontWeight: "700", fontSize: 12 },

  card: { ...shared.card, marginBottom: spacing.md },
  cardTitle: { ...type.title, fontSize: 16, marginBottom: spacing.md },
  cardHint: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 10,
    minHeight: 56,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontWeight: "600",
    fontSize: 13,
  },

  address: { color: colors.ink, marginTop: spacing.md, lineHeight: 20 },
  directions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.plum,
    borderRadius: radius.sm,
    paddingVertical: 13,
    marginTop: spacing.md,
  },
  directionsText: { color: colors.white, fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  rowPressed: { backgroundColor: colors.plumTint },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 11, color: colors.inkSoft, fontWeight: "600" },
  rowValue: { fontSize: 14, color: colors.ink, marginTop: 1 },
  link: { color: colors.plum, fontWeight: "600" },

  portfolio: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shared.buttonOutline,
  },
  portfolioText: { color: colors.plum, fontWeight: "700" },
});
