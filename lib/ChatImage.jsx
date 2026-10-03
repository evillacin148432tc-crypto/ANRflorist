import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { supabase } from "./supabase";
import { CHAT_BUCKET } from "./chatUpload";
import { colors } from "./theme";
import Icon from "./Icon";

// Shows a chat photo. `value` is either:
//   - a full URL (older messages, e.g. the GCash QR) -> used as-is
//   - a storage path in the private chat bucket      -> signed on the fly
// Tap the photo to view it full screen (handy for payment screenshots).
export default function ChatImage({ value, style }) {
  const [uri, setUri] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value) {
      setUri(null);
      return;
    }

    if (/^(https?:|data:)/.test(value)) {
      setUri(value);
      return;
    }

    let cancelled = false;
    supabase.storage
      .from(CHAT_BUCKET)
      .createSignedUrl(value, 3600)
      .then(({ data, error }) => {
        if (error) console.log("CHAT IMAGE SIGN ERROR:", error);
        if (!cancelled && data) setUri(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!uri) {
    return (
      <View style={[style, styles.loading]}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Image source={{ uri }} style={style} resizeMode="contain" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Image source={{ uri }} style={styles.full} resizeMode="contain" />
          <View style={styles.close}>
            <Icon name="close" size={22} color={colors.white} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  full: { width: "100%", height: "85%" },
  close: { position: "absolute", top: 48, right: 20 },
});
