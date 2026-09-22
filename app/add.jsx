import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";

import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { logStockMovement } from "../lib/stockLog";

const CATEGORIES = ["Flower", "Supply"];

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function AddInventory() {
  const router = useRouter();

  const [materialName, setMaterialName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [currentStock, setCurrentStock] = useState("");
  const [minimumStock, setMinimumStock] = useState("");
  const [maximumStock, setMaximumStock] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveItem() {
    const current = Number(currentStock);
    const min = Number(minimumStock);
    const max = Number(maximumStock);

    if (!materialName.trim() || !category.trim() || !unit.trim()) {
      showMessage("Missing Info", "Name, category, and unit are required.");
      return;
    }

    if (
      currentStock === "" ||
      minimumStock === "" ||
      maximumStock === "" ||
      [current, min, max].some((n) => Number.isNaN(n) || n < 0)
    ) {
      showMessage(
        "Invalid Numbers",
        "Stock, minimum, and maximum must be numbers that are 0 or higher.",
      );
      return;
    }

    if (max > 0 && min > max) {
      showMessage(
        "Invalid Levels",
        "Minimum stock cannot be higher than maximum stock.",
      );
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("inventory")
      .insert({
        material_name: materialName.trim(),
        category: category.trim(),
        unit: unit.trim(),
        current_stock: current,
        minimum_stock: min,
        maximum_stock: max,
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      showMessage("Save Failed", error.message);
      return;
    }

    // Audit trail: record the starting stock
    if (current > 0) {
      await logStockMovement({
        inventoryId: data.id,
        materialName: data.material_name,
        before: 0,
        after: current,
        reason: "Initial stock",
      });
    }

    setSaving(false);
    router.replace("/");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>Add New Inventory</Text>

      <Text style={styles.label}>Material Name</Text>
      <TextInput
        style={styles.input}
        value={materialName}
        onChangeText={setMaterialName}
        placeholder="e.g. Red Rose"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, category === c && styles.chipTextActive]}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="Or type another category"
      />

      <Text style={styles.label}>Unit (pcs, meters, ...)</Text>
      <TextInput
        style={styles.input}
        value={unit}
        onChangeText={setUnit}
        placeholder="e.g. pcs"
      />

      <Text style={styles.label}>Starting Stock</Text>
      <TextInput
        style={styles.input}
        value={currentStock}
        onChangeText={setCurrentStock}
        keyboardType="numeric"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Minimum Stock</Text>
          <TextInput
            style={styles.input}
            value={minimumStock}
            onChangeText={setMinimumStock}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.half}>
          <Text style={styles.label}>Maximum Stock</Text>
          <TextInput
            style={styles.input}
            value={maximumStock}
            onChangeText={setMaximumStock}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Pressable
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={saveItem}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? "Saving..." : "Save Item"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.cancelButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 15,
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

  row: {
    flexDirection: "row",
    gap: 10,
  },

  half: {
    flex: 1,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },

  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#999",
    backgroundColor: "#fff",
  },

  chipActive: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },

  chipText: {
    color: "#333",
  },

  chipTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },

  saveButton: {
    backgroundColor: "#4CAF50",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },

  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  cancelButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },

  cancelText: {
    fontWeight: "600",
  },
});
