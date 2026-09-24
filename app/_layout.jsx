import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";

import { AuthProvider, useAuth } from "../lib/AuthProvider";
import { CartProvider } from "../lib/CartProvider";
import FlowerLoader from "../lib/FlowerLoader";
import { colors } from "../lib/theme";

// How long the flower shows when moving between pages (milliseconds).
// Set to 0 to only show it while the app is loading.
const TRANSITION_MS = 450;

// Sends each person to the right place:
//   not logged in  -> /login
//   customer       -> /customer
//   staff / admin  -> inventory screens (/, /add, /edit)
function Gate() {
  const { session, role, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (loading) return;

    const first = segments[0];
    const onLogin = first === "login";
    // Everything a customer is allowed to visit
    const customerRoutes = [
      "customer",
      "catalog",
      "cart",
      "orders",
      "product-detail",
      "wishlist",
      "support",
      "profile",
    ];
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

  // Flash the flower loader briefly whenever the page changes
  const routeKey = segments.join("/");

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (TRANSITION_MS <= 0) return;

    setTransitioning(true);
    const timer = setTimeout(() => setTransitioning(false), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [routeKey]);

  return (
    <View style={{ flex: 1 }}>
      <Slot />

      {loading && (
        <View style={styles.overlay}>
          <FlowerLoader message="Loading..." />
        </View>
      )}

      {!loading && transitioning && (
        <View style={[styles.overlay, styles.overlayLight]}>
          <FlowerLoader message="" />
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
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  // Slightly see-through so page changes feel quick, not like a full reload
  overlayLight: {
    opacity: 0.94,
  },
});
