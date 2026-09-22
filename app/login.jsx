import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";

import { useAuth } from "../lib/AuthProvider";

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
      // on success the route guard moves you to the right screen
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
    // if confirmation is off, you're logged in automatically
  }

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.title}>ANR Florist</Text>
        <Text style={styles.subtitle}>
          {mode === "login" ? "Log in to continue" : "Create your account"}
        </Text>

        {mode === "signup" && (
          <>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
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
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={submit}
        />

        <Pressable
          style={[styles.button, busy && { opacity: 0.6 }]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? "Please wait..." : mode === "login" ? "Log In" : "Sign Up"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode(mode === "login" ? "signup" : "login")}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {mode === "login"
              ? "No account yet? Sign up"
              : "Already have an account? Log in"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  box: {
    width: "100%",
    maxWidth: 400,
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    color: "gray",
    marginTop: 4,
    marginBottom: 20,
  },

  label: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "600",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },

  button: {
    backgroundColor: "#4CAF50",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  switch: {
    marginTop: 16,
    alignItems: "center",
  },

  switchText: {
    color: "#2196F3",
    fontWeight: "600",
  },
});
