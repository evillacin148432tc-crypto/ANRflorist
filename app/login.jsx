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
} from "react-native";

import { useAuth } from "../lib/AuthProvider";
import FlowerLoader from "../lib/FlowerLoader";
import { colors, spacing, radius, type, shared } from "../lib/theme";

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.box}>
          {/* Logo */}
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />

          <Text style={styles.heading}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "login"
              ? "Log in to order fresh, handmade bouquets."
              : "Sign up to start ordering in Tagum City."}
          </Text>

          <View style={styles.card}>
            {/* Log in / Sign up switch */}
            <View style={styles.segment}>
              <Pressable
                style={[
                  styles.segmentItem,
                  mode === "login" && styles.segmentItemActive,
                ]}
                onPress={() => setMode("login")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === "login" && styles.segmentTextActive,
                  ]}
                >
                  Log in
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.segmentItem,
                  mode === "signup" && styles.segmentItemActive,
                ]}
                onPress={() => setMode("signup")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === "signup" && styles.segmentTextActive,
                  ]}
                >
                  Sign up
                </Text>
              </Pressable>
            </View>

            {mode === "signup" && (
              <>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Juana Dela Cruz"
                  placeholderTextColor={colors.inkSoft}
                />
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.inkSoft}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onSubmitEditing={submit}
                placeholder="••••••••"
                placeholderTextColor={colors.inkSoft}
              />
              <Pressable
                style={styles.eye}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                <Text style={styles.eyeText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
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
                  {mode === "login" ? "Log in" : "Create account"}
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
    padding: spacing.lg,
  },

  box: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },

  logo: {
    width: 190,
    height: 174,
    marginBottom: spacing.sm,
  },

  heading: {
    ...type.display,
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    color: colors.inkSoft,
    fontSize: 14,
    marginTop: 4,
    marginBottom: spacing.lg,
  },

  card: {
    ...shared.card,
    width: "100%",
  },

  segment: {
    flexDirection: "row",
    backgroundColor: colors.plumTint,
    borderRadius: radius.pill,
    padding: 4,
  },

  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: "center",
  },

  segmentItemActive: {
    backgroundColor: colors.white,
  },

  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSoft,
  },

  segmentTextActive: {
    color: colors.plum,
    fontWeight: "700",
  },

  label: {
    ...type.label,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  input: {
    ...shared.input,
  },

  passwordWrap: {
    justifyContent: "center",
  },

  passwordInput: {
    paddingRight: 64,
  },

  eye: {
    position: "absolute",
    right: 14,
  },

  eyeText: {
    color: colors.plum,
    fontSize: 13,
    fontWeight: "700",
  },

  button: {
    ...shared.buttonPrimary,
    marginTop: spacing.xl,
  },

  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  buttonText: {
    ...shared.buttonPrimaryText,
  },

  footer: {
    marginTop: spacing.lg,
    color: colors.inkSoft,
    fontSize: 12,
  },
});
