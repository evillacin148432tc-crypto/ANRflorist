import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Switch,
  Alert,
  Platform,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { colors, spacing, radius, type } from "../lib/theme";

const CATEGORIES = ["Bouquet", "Arrangement", "Single Stem", "Other"];
const BUCKET = "bouquet-photos";

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
      { text: "OK", onPress: () => resolve(true) },
    ]);
  });
}

function base64ToBytes(b64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];

    bytes[p++] = (a << 2) | (b >> 4);
    if (i + 2 < len) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < len) bytes[p++] = ((c & 3) << 6) | d;
  }

  return bytes.slice(0, p);
}

function getBase64(asset) {
  if (asset.base64) return asset.base64;
  if (asset.uri && asset.uri.startsWith("data:"))
    return asset.uri.split(",")[1];
  return null;
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
  const [isAvailable, setIsAvailable] = useState(true);

  // Photos already uploaded to storage: [{ path, url }]
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  // Photos picked just now, not uploaded yet (only matters for a brand-new
  // product, which has no id — and therefore no storage folder — until saved)
  const [pendingPhotos, setPendingPhotos] = useState([]);

  const [inventory, setInventory] = useState([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [recipe, setRecipe] = useState([]);
  const [qtyDraft, setQtyDraft] = useState({});

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInventory();
    if (isEditing) {
      loadProduct();
      loadPhotos();
    }
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
      showMessage("Error", "Could not load this bouquet.");
      setLoading(false);
      return;
    }

    setName(product.name ?? "");
    setVariant(product.variant ?? "");
    setCategory(product.category ?? "");
    setPrice(String(product.price ?? ""));
    setDescription(product.description ?? "");
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

  // All photos for this bouquet live in the "<productId>/" folder of the
  // public bucket — no separate database table needed.
  async function loadPhotos() {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(id, { sortBy: { column: "name", order: "asc" } });

    if (error || !data) return;

    const photos = data.map((file) => {
      const path = `${id}/${file.name}`;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { path, url: pub.publicUrl };
    });

    setUploadedPhotos(photos);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    if (isEditing) {
      // We already have a folder to upload straight into.
      await uploadOnePhoto(asset);
    } else {
      // No product id yet — queue it, upload happens right after the product is created.
      setPendingPhotos((prev) => [...prev, asset]);
    }
  }

  async function uploadOnePhoto(asset, productId = id) {
    const base64 = getBase64(asset);
    if (!base64) {
      showMessage("Image Error", "Could not read that photo. Try another.");
      return;
    }

    const mime = asset.mimeType || "image/jpeg";
    const ext = mime.split("/")[1] || "jpg";
    const path = `${productId}/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, base64ToBytes(base64), { contentType: mime });

    if (error) {
      showMessage("Upload Failed", error.message);
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setUploadedPhotos((prev) => [...prev, { path, url: pub.publicUrl }]);
  }

  async function deletePhoto(photo) {
    const confirmed = await confirmAction(
      "Delete Photo",
      "Remove this photo from the bouquet?",
    );
    if (!confirmed) return;

    setUploadedPhotos((prev) => prev.filter((p) => p.path !== photo.path));

    const { error } = await supabase.storage.from(BUCKET).remove([photo.path]);
    if (error) {
      showMessage("Delete Failed", error.message);
      loadPhotos(); // resync in case the optimistic removal was wrong
    }
  }

  function removePendingPhoto(index) {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
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

    // The cover photo shown in grids/lists is just the first uploaded photo.
    const coverUrl = uploadedPhotos[0]?.url ?? "";

    const payload = {
      name: name.trim(),
      variant: variant.trim(),
      category: category.trim(),
      price: priceNum,
      description: description.trim(),
      image_url: coverUrl,
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

      // Now that the product exists, upload every queued photo into its folder.
      for (const asset of pendingPhotos) {
        await uploadOnePhoto(asset, productId);
      }

      // If any photos were queued, the first one should be the cover.
      if (pendingPhotos.length > 0) {
        const { data: list } = await supabase.storage
          .from(BUCKET)
          .list(productId, { sortBy: { column: "name", order: "asc" } });

        if (list && list.length > 0) {
          const { data: pub } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(`${productId}/${list[0].name}`);
          await supabase
            .from("products")
            .update({ image_url: pub.publicUrl })
            .eq("id", productId);
        }
      }
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
        <Text style={{ color: colors.inkSoft }}>Loading…</Text>
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

      <Text style={styles.label}>Photos</Text>
      <Text style={styles.hint}>
        The first photo is used as the cover in listings. Customers can swipe
        through all of them on the bouquet's page.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: spacing.sm }}
      >
        {uploadedPhotos.map((photo, idx) => (
          <View key={photo.path} style={styles.photoThumbWrap}>
            <Image source={{ uri: photo.url }} style={styles.photoThumb} />
            {idx === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            )}
            <Pressable
              style={styles.deleteBadge}
              onPress={() => deletePhoto(photo)}
            >
              <Text style={{ fontSize: 12 }}>🗑️</Text>
            </Pressable>
          </View>
        ))}

        {pendingPhotos.map((asset, idx) => (
          <View key={idx} style={styles.photoThumbWrap}>
            <Image source={{ uri: asset.uri }} style={styles.photoThumb} />
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Will upload on save</Text>
            </View>
            <Pressable
              style={styles.deleteBadge}
              onPress={() => removePendingPhoto(idx)}
            >
              <Text style={{ fontSize: 12 }}>🗑️</Text>
            </Pressable>
          </View>
        ))}

        <Pressable style={styles.addPhotoButton} onPress={pickPhoto}>
          <Text style={{ fontSize: 22, color: colors.plum }}>+</Text>
          <Text style={styles.addPhotoText}>Add photo</Text>
        </Pressable>
      </ScrollView>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Dozen Red Roses"
        placeholderTextColor={colors.inkSoft}
      />

      <Text style={styles.label}>Variant (optional)</Text>
      <TextInput
        style={styles.input}
        value={variant}
        onChangeText={setVariant}
        placeholder="e.g. Small / Medium / Large"
        placeholderTextColor={colors.inkSoft}
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
        placeholderTextColor={colors.inkSoft}
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

      <View style={styles.switchRow}>
        <Text style={styles.label}>Available for ordering</Text>
        <Switch
          value={isAvailable}
          onValueChange={setIsAvailable}
          trackColor={{ true: colors.fern }}
        />
      </View>

      <Text style={styles.sectionTitle}>Recipe (materials used)</Text>
      <Text style={styles.hint}>
        Pick the flowers and supplies this bouquet uses, and how much of each.
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
        placeholderTextColor={colors.inkSoft}
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
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.paper },
  title: { ...type.display, marginBottom: spacing.md },

  label: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: "600",
    color: colors.ink,
  },
  hint: { color: colors.inkSoft, marginBottom: spacing.sm, fontSize: 13 },

  photoThumbWrap: { marginRight: spacing.sm, position: "relative" },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.plumTint,
  },

  coverBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: colors.plum,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverBadgeText: { color: colors.white, fontSize: 9, fontWeight: "700" },

  pendingBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: colors.marigold,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  pendingBadgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
  },

  deleteBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },

  addPhotoButton: {
    width: 90,
    height: 90,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.plum,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: {
    color: colors.plum,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.ink,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { color: colors.ink },
  chipTextActive: { color: colors.white, fontWeight: "700" },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },

  sectionTitle: { ...type.title, fontSize: 18, marginTop: spacing.xl },
  empty: { color: colors.inkSoft, marginTop: 6 },

  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  recipeName: { flex: 1, fontWeight: "600", color: colors.ink },
  recipeQtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    padding: 6,
    textAlign: "center",
  },
  recipeUnit: { width: 50, color: colors.inkSoft },
  removeText: { color: colors.brick, fontWeight: "600" },

  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  pickName: { flex: 1, color: colors.ink },
  pickQtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    padding: 6,
    textAlign: "center",
  },

  addChip: {
    backgroundColor: colors.plum,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  addChipText: { color: colors.white, fontWeight: "bold" },

  saveButton: {
    backgroundColor: colors.plum,
    padding: 14,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "bold" },

  cancelButton: {
    padding: 14,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cancelText: { fontWeight: "600", color: colors.inkSoft },
});
