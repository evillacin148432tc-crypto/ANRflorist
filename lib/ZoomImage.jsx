import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "./theme";
import Icon from "./Icon";

// A picture you can tap to see full screen (tap anywhere to close).
// Use it for thumbnails, e.g. the product photos inside an order.
export default function ZoomImage({ uri, style, caption }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="View photo">
        <Image source={{ uri }} style={style} resizeMode="cover" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Image source={{ uri }} style={styles.full} resizeMode="contain" />
          {!!caption && <Text style={styles.caption}>{caption}</Text>}
          <View style={styles.close}>
            <Icon name="close" size={24} color={colors.white} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  full: { width: "100%", height: "80%" },
  caption: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    marginTop: 12,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  close: { position: "absolute", top: 48, right: 20 },
});
