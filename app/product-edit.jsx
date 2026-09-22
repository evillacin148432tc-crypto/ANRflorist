import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Platform,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

const CATEGORIES = ["Bouquet", "Arrangement", "Single Stem", "Other"];

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(title, message) {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Save Anyway", onPress: () => resolve(true) },
    ]);
  });
}

export default function ProductEdit() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const isEditing = !!id;

  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  const [inventory, setInventory] = useState([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [recipe, setRecipe] = useState([]); // [{ inventory_id, material_name, unit, quantity }]
  const [qtyDraft, setQtyDraft] = useState({}); // { [inventory_id]: "3" }

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInventory();
    if (isEditing) loadProduct();
  }, [id]);

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory")
      .select("id, material_name, unit")
      .order("material_name", { ascending: true });

    if (!error) setInventory(data);
  }

  async function loadProduct() {
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.log("LOAD PRODUCT ERROR:", error);
      showMessage("Error", "Could not load this bouquet.");
      setLoading(false);
      return;
    }

    setName(product.name ?? "");
    setVariant(product.variant ?? "");
    setCategory(product.category ?? "");
    setPrice(String(product.price ?? ""));
    setDescription(product.description ?? "");
    setImageUrl(product.image_url ?? "");
    setIsAvailable(product.is_available ?? true);

    const { data: materials, error: matError } = await supabase
      .from("product_materials")
      .select(
        "inventory_id, quantity_needed, inventory:inventory_id (material_name, unit)",
      )
      .eq("product_id", id);

    if (!matError && materials) {
      setRecipe(
        materials.map((m) => ({
          inventory_id: m.inventory_id,
          material_name: m.inventory?.material_name ?? "Unknown item",
          unit: m.inventory?.unit ?? "",
          quantity: String(m.quantity_needed),
        })),
      );
    }

    setLoading(false);
  }

  function addMaterial(item) {
    if (recipe.some((r) => r.inventory_id === item.id)) {
      showMessage(
        "Already Added",
        `${item.material_name} is already in the recipe.`,
      );
      return;
    }

    const qty = Number(qtyDraft[item.id]);

    if (!qty || qty <= 0) {
      showMessage(
        "Enter Quantity",
        `Type how much ${item.material_name} is needed first.`,
      );
      return;
    }

    setRecipe((prev) => [
      ...prev,
      {
        inventory_id: item.id,
        material_name: item.material_name,
        unit: item.unit,
        quantity: String(qty),
      },
    ]);

    setQtyDraft((prev) => ({ ...prev, [item.id]: "" }));
  }

  function removeMaterial(inventoryId) {
    setRecipe((prev) => prev.filter((r) => r.inventory_id !== inventoryId));
  }

  function updateMaterialQty(inventoryId, value) {
    setRecipe((prev) =>
      prev.map((r) =>
        r.inventory_id === inventoryId ? { ...r, quantity: value } : r,
      ),
    );
  }

  async function save() {
    const priceNum = Number(price);

    if (!name.trim() || !category.trim()) {
      showMessage("Missing Info", "Name and category are required.");
      return;
    }

    if (Number.isNaN(priceNum) || priceNum < 0) {
      showMessage("Invalid Price", "Price must be a number 0 or higher.");
      return;
    }

    if (recipe.length === 0) {
      const confirmed = await confirmAction(
        "No Recipe",
        "This bouquet has no materials in its recipe. Save anyway?",
      );
      if (!confirmed) return;
    }

    for (const r of recipe) {
      const q = Number(r.quantity);
      if (!q || q <= 0) {
        showMessage(
          "Invalid Recipe",
          `${r.material_name} needs a quantity greater than 0.`,
        );
        return;
      }
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      variant: variant.trim(),
      category: category.trim(),
      price: priceNum,
      description: description.trim(),
      image_url: imageUrl.trim(),
      is_available: isAvailable,
    };

    let productId = id;

    if (isEditing) {
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", id)
        .select();

      if (error) {
        setSaving(false);
        showMessage("Save Failed", error.message);
        return;
      }

      if (!data || data.length === 0) {
        setSaving(false);
        showMessage("Save Failed", "Nothing was updated.");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();

      if (error) {
        setSaving(false);
        showMessage("Save Failed", error.message);
        return;
      }

      productId = data.id;
    }

    // Replace the recipe: delete old rows, insert the current list
    const { error: deleteError } = await supabase
      .from("product_materials")
      .delete()
      .eq("product_id", productId);

    if (deleteError) {
      setSaving(false);
      showMessage(
        "Saved, but recipe not updated",
        "The bouquet was saved, but clearing the old recipe failed: " +
          deleteError.message,
      );
      return;
    }

    if (recipe.length > 0) {
      const { error: insertError } = await supabase
        .from("product_materials")
        .insert(
          recipe.map((r) => ({
            product_id: productId,
            inventory_id: r.inventory_id,
            quantity_needed: Number(r.quantity),
          })),
        );

      if (insertError) {
        setSaving(false);
        showMessage(
          "Saved, but recipe not updated",
          "The bouquet was saved, but the recipe failed to save: " +
            insertError.message,
        );
        return;
      }
    }

    setSaving(false);
    router.replace("/products");
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const filteredInventory = inventory.filter((i) =>
    i.material_name.toLowerCase().includes(materialSearch.toLowerCase()),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>
        {isEditing ? "Edit Bouquet" : "Add New Bouquet"}
      </Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Dozen Red Roses"
      />

      <Text style={styles.label}>Variant (optional)</Text>
      <TextInput
        style={styles.input}
        value={variant}
        onChangeText={setVariant}
        placeholder="e.g. Small / Medium / Large"
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

      <Text style={styles.label}>Price (₱)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Photo URL (optional)</Text>
      <TextInput
        style={styles.input}
        value={imageUrl}
        onChangeText={setImageUrl}
        placeholder="https://..."
        autoCapitalize="none"
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Available for ordering</Text>
        <Switch value={isAvailable} onValueChange={setIsAvailable} />
      </View>

      <Text style={styles.sectionTitle}>Recipe (materials used)</Text>
      <Text style={styles.hint}>
        Pick the flowers and supplies this bouquet uses, and how much of each.
        This is what lets the app deduct inventory automatically when it's
        ordered, and forecast supply needs.
      </Text>

      {recipe.length === 0 ? (
        <Text style={styles.empty}>No materials added yet.</Text>
      ) : (
        recipe.map((r) => (
          <View key={r.inventory_id} style={styles.recipeRow}>
            <Text style={styles.recipeName}>{r.material_name}</Text>

            <TextInput
              style={styles.recipeQtyInput}
              value={r.quantity}
              onChangeText={(v) => updateMaterialQty(r.inventory_id, v)}
              keyboardType="numeric"
            />

            <Text style={styles.recipeUnit}>{r.unit}</Text>

            <Pressable onPress={() => removeMaterial(r.inventory_id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.label}>Add a material</Text>
      <TextInput
        style={styles.input}
        value={materialSearch}
        onChangeText={setMaterialSearch}
        placeholder="Search inventory..."
      />

      {filteredInventory.map((item) => (
        <View key={item.id} style={styles.pickRow}>
          <Text style={styles.pickName}>
            {item.material_name} ({item.unit})
          </Text>

          <TextInput
            style={styles.pickQtyInput}
            value={qtyDraft[item.id] ?? ""}
            onChangeText={(v) =>
              setQtyDraft((prev) => ({ ...prev, [item.id]: v }))
            }
            keyboardType="numeric"
            placeholder="qty"
          />

          <Pressable style={styles.addChip} onPress={() => addMaterial(item)}>
            <Text style={styles.addChipText}>Add</Text>
          </Pressable>
        </View>
      ))}

      <Pressable
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? "Saving..." : "Save Bouquet"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.cancelButton}
        onPress={() => router.replace("/products")}
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

  hint: {
    color: "gray",
    marginBottom: 10,
    fontSize: 13,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
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

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 28,
  },

  empty: {
    color: "gray",
    marginTop: 6,
  },

  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  recipeName: {
    flex: 1,
    fontWeight: "600",
  },

  recipeQtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 6,
    textAlign: "center",
  },

  recipeUnit: {
    width: 50,
    color: "gray",
  },

  removeText: {
    color: "red",
    fontWeight: "600",
  },

  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },

  pickName: {
    flex: 1,
  },

  pickQtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 6,
    textAlign: "center",
  },

  addChip: {
    backgroundColor: "#2196F3",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  addChipText: {
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
