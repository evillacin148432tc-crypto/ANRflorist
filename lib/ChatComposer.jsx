import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
} from "react-native";

import { colors, spacing, radius } from "./theme";
import Icon from "./Icon";

// Shared message box for the customer chat and the staff reply screen:
// photo button, optional photo preview, text box, send button.
export default function ChatComposer({
  draft,
  onChangeDraft,
  image, // picked asset (or null)
  onPickImage,
  onClearImage,
  onSend,
  sending,
  placeholder,
  style,
  inputStyle,
}) {
  const canSend = (!!draft.trim() || !!image) && !sending;

  return (
    <View style={style}>
      {!!image && (
        <View style={styles.previewRow}>
          <Image source={{ uri: image.uri }} style={styles.preview} />
          <Pressable style={styles.remove} onPress={onClearImage} hitSlop={8}>
            <Icon name="close" size={14} color={colors.white} />
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        <Pressable
          style={[styles.photoButton, sending && { opacity: 0.5 }]}
          onPress={onPickImage}
          disabled={sending}
          hitSlop={6}
        >
          <Icon name="image-outline" size={22} color={colors.plum} />
        </Pressable>

        <TextInput
          style={[styles.input, inputStyle]}
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={image ? "Add a caption (optional)..." : placeholder}
          placeholderTextColor={colors.inkSoft}
          multiline
        />

        <Pressable
          style={[styles.sendButton, !canSend && { opacity: 0.5 }]}
          onPress={onSend}
          disabled={!canSend}
        >
          <Text style={styles.sendText}>{sending ? "..." : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewRow: { paddingBottom: spacing.sm, alignSelf: "flex-start" },
  preview: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.line,
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brick,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  photoButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.plumTint,
    alignItems: "center",
    justifyContent: "center",
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
