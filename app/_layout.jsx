import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";

import { AuthProvider, useAuth } from "../lib/AuthProvider";
import { CartProvider } from "../lib/CartProvider";

// Sends each person to the right place:
//   not logged in  -> /login
//   customer       -> /customer
//   staff / admin  -> inventory screens (/, /add, /edit)
function Gate() {
  const { session, role, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const first = segments[0];
    const onLogin = first === "login";
    // Everything a customer is allowed to visit
    const customerRoutes = ["customer", "catalog", "cart", "orders"];
    const onCustomerArea = customerRoutes.includes(first);
    const isStaff = role === "staff" || role === "admin";

    if (!session) {
      if (!onLogin) router.replace("/login");
      return;
    }

    if (!isStaff) {
      if (!onCustomerArea) router.replace("/customer");
      return;
    }

    // staff/admin: keep them out of the customer-only area and the login screen
    if (onLogin || onCustomerArea) router.replace("/");
  }, [session, role, loading, segments]);

  return (
    <View style={{ flex: 1 }}>
      <Slot />

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <Gate />
      </CartProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
