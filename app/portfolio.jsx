import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadPortfolio } from "../lib/portfolio";
import { colors, spacing, radius, type, shadow, layout } from "../lib/theme";
import Icon from "../lib/Icon";

export default function Portfolio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("All");
  const [viewing, setViewing] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadPortfolio().then((rows) => {
        setPhotos(rows);
        setLoading(false);
      });
    }, []),
  );

  const categories = useMemo(() => {
    const set = new Set(
      photos.map((p) => (p.category || "").trim()).filter(Boolean),
    );
    return ["All", ...Array.from(set)];
  }, [photos]);

  const shown = photos.filter((p) => active === "All" || p.category === active);
  const colW =
    (Math.min(width, layout.maxWidth) - spacing.lg * 2 - spacing.md) / 2;

  return (
    <View style={styles.container}>
      <View style={[styles.inner, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Pressable
            style={styles.back}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Icon name="chevron-back" size={20} color={colors.plum} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Our Work</Text>
            <Text style={styles.subtitle}>
              Handmade by ANR Florist · Tagum City
            </Text>
          </View>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c}
          style={styles.chipList}
          contentContainerStyle={{ gap: spacing.sm, alignItems: "center" }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActive(item)}
              style={[styles.chip, active === item && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  active === item && styles.chipTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.plum} />
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(p) => String(p.id)}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ gap: spacing.md }}
            contentContainerStyle={{
              gap: spacing.md,
              paddingBottom: 110 + insets.bottom,
            }}
            renderItem={({ item, index }) => (
              <Pressable style={{ flex: 1 }} onPress={() => setViewing(item)}>
                <Image
                  source={{ uri: item.image_url }}
                  style={[
                    styles.photo,
                    { height: colW * (index % 3 === 0 ? 1.3 : 1) },
                  ]}
                />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <View style={styles.emptyIcon}>
                  <Icon name="images-outline" size={30} color={colors.plum} />
                </View>
                <Text style={styles.empty}>No photos yet.</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.modal}>
          <Pressable
            style={[styles.close, { top: insets.top + spacing.md }]}
            onPress={() => setViewing(null)}
          >
            <Icon name="close" size={22} color={colors.white} />
          </Pressable>
          {viewing && (
            <Image
              source={{ uri: viewing.image_url }}
              style={{
                width: width - spacing.lg * 2,
                height: height * 0.6,
                borderRadius: radius.md,
              }}
              resizeMode="contain"
            />
          )}
          {!!viewing?.caption && (
            <Text style={styles.caption}>{viewing.caption}</Text>
          )}
          {!!viewing?.category && (
            <Text style={styles.catText}>{viewing.category}</Text>
          )}
          <Pressable
            style={[styles.cta, { marginBottom: insets.bottom + spacing.lg }]}
            onPress={() => {
              const cat = viewing?.category || "";
              setViewing(null);
              router.push(
                cat
                  ? { pathname: "/catalog", params: { category: cat } }
                  : "/catalog",
              );
            }}
          >
            <Text style={styles.ctaText}>Order something like this</Text>
            <Icon name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  inner: {
    flex: 1,
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.display },
  subtitle: { color: colors.inkSoft, fontSize: 12, marginTop: 1 },

  chipList: { flexGrow: 0, height: 40, marginBottom: spacing.md },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  chipTextActive: { color: colors.white },

  photo: {
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: colors.plumTint,
    ...shadow,
  },

  emptyBox: { alignItems: "center", marginTop: 50, gap: 10 },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { color: colors.inkSoft },

  modal: {
    flex: 1,
    backgroundColor: "rgba(20,10,25,0.94)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  close: {
    position: "absolute",
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  catText: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: -8 },
  caption: { color: colors.white, fontWeight: "700", fontSize: 16 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  ctaText: { color: colors.white, fontWeight: "700" },
});
