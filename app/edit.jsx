import { useEffect, useState } from "react";
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

import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { logStockMovement } from "../lib/stockLog";

const REASONS = [
  "Restock",
  "Used in order",
  "Damaged / Wilted",
  "Stock count correction",
];

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function EditInventory() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);

  const [materialName, setMaterialName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [currentStock, setCurrentStock] = useState("");
  const [minimumStock, setMinimumStock] = useState("");
  const [maximumStock, setMaximumStock] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (id) {
      loadItem();
      loadHistory();
    }
  }, [id]);

  async function loadItem() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.log("LOAD ITEM ERROR:", error);
      showMessage("Error", "Could not load this item.");
      return;
    }

    setItem(data);
    setMaterialName(data.material_name ?? "");
    setCategory(data.category ?? "");
    setUnit(data.unit ?? "");
    setCurrentStock(String(data.current_stock ?? 0));
    setMinimumStock(String(data.minimum_stock ?? 0));
    setMaximumStock(String(data.maximum_stock ?? 0));
  }

  async function loadHistory() {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("inventory_id", String(id))
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("HISTORY ERROR:", error);
      return;
    }

    setHistory(data);
  }

  async function saveChanges() {
    const current = Number(currentStock);
    const min = Number(minimumStock);
    const max = Number(maximumStock);

    if (!materialName.trim()) {
      showMessage("Missing Info", "Material name is required.");
      return;
    }

    if ([current, min, max].some((n) => Number.isNaN(n) || n < 0)) {
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

    const before = Number(item.current_stock);
    const stockChanged = current !== before;

    if (stockChanged && !reason.trim()) {
      showMessage(
        "Reason Needed",
        "You changed the stock amount. Please pick or type a reason so it's recorded.",
      );
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("inventory")
      .update({
        material_name: materialName.trim(),
        category: category.trim(),
        unit: unit.trim(),
        current_stock: current,
        minimum_stock: min,
        maximum_stock: max,
      })
      .eq("id", id)
      .select();

    if (error) {
      setSaving(false);
      showMessage("Save Failed", error.message);
      return;
    }

    // No error but no rows updated = blocked by Row Level Security
    if (!data || data.length === 0) {
      setSaving(false);
      showMessage(
        "Save Failed",
        "Nothing was updated. Check the Supabase RLS update policy on the inventory table.",
      );
      return;
    }

    if (stockChanged) {
      const logError = await logStockMovement({
        inventoryId: id,
        materialName: materialName.trim(),
        before,
        after: current,
        reason: reason.trim(),
      });

      if (logError) {
        showMessage(
          "Saved, but not logged",
          "The item was updated, but the stock history entry failed: " +
            logError.message,
        );
      }
    }

    setSaving(false);
    router.replace("/");
  }

  if (!item) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const change = Number(currentStock) - Number(item.current_stock);
  const stockChanged = !Number.isNaN(change) && change !== 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>Edit Inventory</Text>

      <Text style={styles.label}>Material Name</Text>
      <TextInput
        style={styles.input}
        value={materialName}
        onChangeText={setMaterialName}
      />

      <Text style={styles.label}>Category</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
      />

      <Text style={styles.label}>Unit (pcs, meters, ...)</Text>
      <TextInput style={styles.input} value={unit} onChangeText={setUnit} />

      <Text style={styles.label}>Current Stock</Text>
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

      {stockChanged && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonTitle}>
            Stock change: {change > 0 ? "+" : ""}
            {change} {unit}
          </Text>

          <Text style={styles.label}>Reason (required)</Text>

          <View style={styles.chipRow}>
            {REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                style={[styles.chip, reason === r && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    reason === r && styles.chipTextActive,
                  ]}
                >
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Or type your own reason"
          />
        </View>
      )}

      <Pressable
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={saveChanges}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.cancelButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>

      <Text style={styles.historyTitle}>Recent Stock History</Text>

      {history.length === 0 ? (
        <Text style={styles.empty}>No stock changes recorded yet.</Text>
      ) : (
        history.map((h) => (
          <View key={h.id} style={styles.historyRow}>
            <Text style={styles.historyMain}>
              {Number(h.change_amount) > 0 ? "+" : ""}
              {h.change_amount} ({h.stock_before} → {h.stock_after})
            </Text>
            <Text style={styles.historySub}>
              {h.reason} • {new Date(h.created_at).toLocaleString()}
            </Text>
          </View>
        ))
      )}
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

  reasonBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#FFE082",
  },

  reasonTitle: {
    fontWeight: "bold",
    fontSize: 16,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
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
    marginTop: 20,
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

  historyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 30,
    marginBottom: 10,
  },

  empty: {
    color: "gray",
  },

  historyRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  historyMain: {
    fontWeight: "600",
  },

  historySub: {
    color: "gray",
    marginTop: 2,
    fontSize: 13,
  },
});
