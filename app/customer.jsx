import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from "react-native";

import { useRouter } from "expo-router";

import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthProvider";
import { TAGUM_BARANGAYS } from "../lib/barangays";

// Rough bounding box around Tagum City. Only used to sanity-check the optional map pin.
const TAGUM_BOX = { minLat: 7.3, maxLat: 7.6, minLng: 125.72, maxLng: 125.95 };

function showMessage(title, message) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Turns a base64 string into raw bytes for uploading
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

export default function CustomerHome() {
  const router = useRouter();
  const { profile, user, signOut, refreshProfile } = useAuth();

  useEffect(() => {
    if (profile?.verification_status === "verified") {
      router.replace("/catalog");
    }
  }, [profile?.verification_status]);

  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [barangay, setBarangay] = useState(profile?.barangay ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [pin, setPin] = useState(
    profile?.latitude && profile?.longitude
      ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
      : null,
  );
  const [idImage, setIdImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const status = profile?.verification_status || "unverified";
  const name = profile?.full_name || user?.email;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled) {
      setIdImage(result.assets[0]);
    }
  }

  async function useMyLocation() {
    try {
      setLocating(true);

      const { status: permission } =
        await Location.requestForegroundPermissionsAsync();

      if (permission !== "granted") {
        showMessage(
          "Permission Needed",
          "Location permission was not granted.",
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const inside =
        lat >= TAGUM_BOX.minLat &&
        lat <= TAGUM_BOX.maxLat &&
        lng >= TAGUM_BOX.minLng &&
        lng <= TAGUM_BOX.maxLng;

      if (!inside) {
        showMessage(
          "Outside Tagum City",
          "Your current location looks like it is outside Tagum City, so the pin was not saved. You can still register using your barangay and address.",
        );
        return;
      }

      setPin({ lat, lng });
    } catch (e) {
      console.log("LOCATION ERROR:", e);
      showMessage("Location Error", "Could not get your location.");
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    if (!/^(09|\+639)\d{9}$/.test(phone.trim())) {
      showMessage(
        "Invalid Phone",
        "Enter a valid mobile number, e.g. 09123456789.",
      );
      return;
    }

    if (!barangay) {
      showMessage("Missing Info", "Please choose your barangay.");
      return;
    }

    if (!address.trim()) {
      showMessage(
        "Missing Info",
        "Please enter your street / purok / house number.",
      );
      return;
    }

    if (!idImage) {
      showMessage("ID Required", "Please upload a photo of a valid ID.");
      return;
    }

    const base64 = getBase64(idImage);

    if (!base64) {
      showMessage(
        "Image Error",
        "Could not read that image. Try another photo.",
      );
      return;
    }

    setSaving(true);

    // 1) upload the ID photo to the PRIVATE bucket, inside this user's own folder
    const mime = idImage.mimeType || "image/jpeg";
    const ext = mime.split("/")[1] || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("customer-ids")
      .upload(path, base64ToBytes(base64), { contentType: mime });

    if (uploadError) {
      console.log("UPLOAD ERROR:", uploadError);
      setSaving(false);
      showMessage("Upload Failed", uploadError.message);
      return;
    }

    // 2) save the details and mark the account as pending review
    const { data, error } = await supabase
      .from("profiles")
      .update({
        phone: phone.trim(),
        address: address.trim(),
        barangay,
        city: "Tagum City",
        latitude: pin ? pin.lat : null,
        longitude: pin ? pin.lng : null,
        id_photo_path: path,
        id_submitted_at: new Date().toISOString(),
        verification_status: "pending",
      })
      .eq("id", user.id)
      .select();

    setSaving(false);

    if (error) {
      showMessage("Save Failed", error.message);
      return;
    }

    if (!data || data.length === 0) {
      showMessage("Save Failed", "Nothing was saved. Please try again.");
      return;
    }

    await refreshProfile();
  }

  // ---------- Pending ----------
  if (status === "pending") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Thanks, {name}!</Text>
        <Text style={styles.text}>
          Your ID is being reviewed by ANR Florist. You will be able to order
          once you are approved.
        </Text>

        <Pressable style={styles.button} onPress={refreshProfile}>
          <Text style={styles.buttonText}>Check Status</Text>
        </Pressable>

        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>
    );
  }

  // ---------- Verified (normally redirected to /catalog by the effect above) ----------
  if (status === "verified") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Welcome, {name}!</Text>
        <Text style={[styles.text, { color: "green", fontWeight: "bold" }]}>
          Your account is verified.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => router.replace("/catalog")}
        >
          <Text style={styles.buttonText}>Browse Bouquets</Text>
        </Pressable>

        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>
    );
  }

  // ---------- Unverified or rejected: registration form ----------
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.topBar}>
        <Text style={styles.who}>{name}</Text>
        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Complete Your Registration</Text>
      <Text style={styles.text}>
        ANR Florist delivers within Tagum City only. Please tell us where you
        live and upload a valid ID so we can verify your account.
      </Text>

      {status === "rejected" && (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectTitle}>
            Your last submission was rejected
          </Text>
          <Text>{profile?.verification_remarks || "No reason was given."}</Text>
          <Text style={{ marginTop: 6 }}>
            Please fix the problem and submit again.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Mobile Number</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="09123456789"
      />

      <Text style={styles.label}>City</Text>
      <TextInput
        style={[styles.input, styles.locked]}
        value="Tagum City"
        editable={false}
      />

      <Text style={styles.label}>Barangay</Text>
      <View style={styles.chipRow}>
        {TAGUM_BARANGAYS.map((b) => (
          <Pressable
            key={b}
            onPress={() => setBarangay(b)}
            style={[styles.chip, barangay === b && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, barangay === b && styles.chipTextActive]}
            >
              {b}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Street / Purok / House No.</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. Purok 3, Rizal St."
      />

      <Text style={styles.label}>Map Pin (optional)</Text>
      <Text style={styles.hint}>
        Helps our rider find your exact spot. Only works if you are at your
        delivery address right now.
      </Text>

      <Pressable
        style={styles.outlineButton}
        onPress={useMyLocation}
        disabled={locating}
      >
        <Text style={styles.outlineText}>
          {locating ? "Getting location..." : "Use my current location"}
        </Text>
      </Pressable>

      {pin && (
        <Text style={styles.pinText}>
          Pin saved: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </Text>
      )}

      <Text style={styles.label}>Valid ID Photo</Text>
      <Text style={styles.hint}>
        A clear photo of a government-issued or school ID. It is stored
        privately and only ANR Florist staff can view it.
      </Text>

      <Pressable style={styles.outlineButton} onPress={pickImage}>
        <Text style={styles.outlineText}>
          {idImage ? "Choose a different photo" : "Choose ID photo"}
        </Text>
      </Pressable>

      {idImage && (
        <Image
          source={{ uri: idImage.uri }}
          style={styles.preview}
          resizeMode="contain"
        />
      )}

      <Pressable
        style={[styles.button, saving && { opacity: 0.6 }]}
        onPress={submit}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? "Submitting..." : "Submit for Verification"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },

  center: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  who: {
    color: "gray",
    flex: 1,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },

  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 6,
  },

  text: {
    marginTop: 8,
    color: "gray",
    textAlign: "center",
  },

  label: {
    marginTop: 16,
    marginBottom: 4,
    fontWeight: "600",
  },

  hint: {
    color: "gray",
    marginBottom: 8,
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

  locked: {
    backgroundColor: "#eee",
    color: "#555",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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

  outlineButton: {
    borderWidth: 1,
    borderColor: "#2196F3",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  outlineText: {
    color: "#2196F3",
    fontWeight: "600",
  },

  pinText: {
    marginTop: 8,
    color: "green",
  },

  preview: {
    width: "100%",
    height: 220,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },

  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  logout: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginTop: 12,
  },

  logoutText: {
    fontWeight: "600",
  },

  rejectBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FDECEA",
    borderWidth: 1,
    borderColor: "#F5A5A0",
  },

  rejectTitle: {
    fontWeight: "bold",
    color: "#B71C1C",
    marginBottom: 4,
  },
});
