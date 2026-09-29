import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";

// Thin wrapper around Ionicons so every screen uses the same icon set.
// Browse names at https://icons.expo.fyi (Ionicons).
export default function Icon({ name, size = 20, color = colors.ink, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
