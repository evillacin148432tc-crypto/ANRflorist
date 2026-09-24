import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Platform,
} from "react-native";
import { colors, spacing } from "./theme";

/**
 * Spinning flower loader.
 *
 * Usage:
 *   <FlowerLoader />                          full-screen, "Loading..."
 *   <FlowerLoader message="Getting your bouquets..." />
 *   <FlowerLoader fullScreen={false} size={28} message="" />   small inline spinner
 */
export default function FlowerLoader({
  message = "Loading...",
  fullScreen = true,
  size = 56,
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver,
      }),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver,
        }),
      ]),
    );

    spinLoop.start();
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [spin, pulse]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.1],
  });

  return (
    <View style={[styles.wrap, fullScreen && styles.fullScreen]}>
      <Animated.Text
        style={{
          fontSize: size,
          transform: [{ rotate }, { scale }],
        }}
      >
        🌸
      </Animated.Text>

      {!!message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  message: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "600",
  },
});
