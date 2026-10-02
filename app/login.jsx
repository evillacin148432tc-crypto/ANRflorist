import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  StyleSheet,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";

import { useAuth } from "../lib/AuthProvider";
import FlowerLoader from "../lib/FlowerLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, type, shared, layout } from "../lib/theme";
import Icon from "../lib/Icon";

// Save your logo at assets/logo.png
const LOGO = require("../assets/logo.png");

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function Login() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const logoH = Math.min(150, Math.max(90, height * 0.17));

  async function submit() {
    if (!email.trim() || !password) {
      showMessage("Missing Info", "Please enter your email and password.");
      return;
    }

    if (mode === "signup") {
      if (!fullName.trim()) {
        showMessage("Missing Info", "Please enter your full name.");
        return;
      }

      if (password.length < 6) {
        showMessage("Weak Password", "Password must be at least 6 characters.");
        return;
      }
    }

    setBusy(true);

    if (mode === "login") {
      const error = await signIn(email, password);
      setBusy(false);

      if (error) showMessage("Login Failed", error.message);
      return;
    }

    const { error, needsConfirmation } = await signUp(
      email,
      password,
      fullName,
    );
    setBusy(false);

    if (error) {
      showMessage("Sign Up Failed", error.message);
      return;
    }

    if (needsConfirmation) {
      showMessage(
        "Check Your Email",
        "We sent a confirmation link. Confirm your email, then log in.",
      );
      setMode("login");
    }
  }

  const isLogin = mode === "login";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.box}>
          <Image
            source={LOGO}
            style={{ width: logoH * 1.1, height: logoH }}
            resizeMode="contain"
          />

          <Text style={styles.heading}>
            {isLogin ? "Welcome back" : "Create your account"}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? "Log in to order fresh, handmade bouquets."
              : "Sign up to start ordering in Tagum City."}
          </Text>

          <View style={styles.card}>
            <View style={styles.segment}>
              {[
                ["login", "Log in"],
                ["signup", "Sign up"],
              ].map(([key, text]) => (
                <Pressable
                  key={key}
                  style={[
                    styles.segmentItem,
                    mode === key && styles.segmentItemActive,
                  ]}
                  onPress={() => setMode(key)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      mode === key && styles.segmentTextActive,
                    ]}
                  >
                    {text}
                  </Text>
                </Pressable>
              ))}
            </View>

            {!isLogin && (
              <>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.field}>
                  <Icon
                    name="person-outline"
                    size={18}
                    color={colors.inkSoft}
                  />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Juana Dela Cruz"
                    placeholderTextColor={colors.inkSoft}
                  />
                </View>
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <View style={styles.field}>
              <Icon name="mail-outline" size={18} color={colors.inkSoft} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.inkSoft}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.field}>
              <Icon
                name="lock-closed-outline"
                size={18}
                color={colors.inkSoft}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onSubmitEditing={submit}
                placeholder="••••••••"
                placeholderTextColor={colors.inkSoft}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
              >
                <Icon
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.plum}
                />
              </Pressable>
            </View>

            <Pressable
              style={[styles.button, busy && { opacity: 0.85 }]}
              onPress={submit}
              disabled={busy}
            >
              {busy ? (
                <View style={styles.busyRow}>
                  <FlowerLoader fullScreen={false} size={20} message="" />
                  <Text style={styles.buttonText}>Please wait…</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? "Log in" : "Create account"}
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footer}>
            Handmade flower bouquets · Tagum City
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  box: { width: "100%", maxWidth: layout.maxWidth, alignItems: "center" },
  heading: { ...type.display, textAlign: "center", marginTop: spacing.sm },
  subtitle: {
    textAlign: "center",
    color: colors.inkSoft,
    fontSize: 14,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  card: { ...shared.card, width: "100%" },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.plumTint,
    borderRadius: radius.pill,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  segmentItemActive: { backgroundColor: colors.white },
  segmentText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  segmentTextActive: { color: colors.plum, fontWeight: "700" },
  label: { ...type.label, marginTop: spacing.md, marginBottom: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shared.input,
    paddingVertical: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 13,
  },
  button: { ...shared.buttonPrimary, marginTop: spacing.xl },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttonText: { ...shared.buttonPrimaryText },
  footer: { marginTop: spacing.lg, color: colors.inkSoft, fontSize: 12 },
});
