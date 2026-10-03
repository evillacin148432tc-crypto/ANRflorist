import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

// Private bucket. Create it once in Supabase (see supabase/chat-images.sql).
export const CHAT_BUCKET = "chat-images";

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

// Opens the photo library. Returns the chosen asset, or null if cancelled.
export async function pickChatImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled) return null;
  return result.assets[0];
}

// Uploads a picked asset into the customer's folder.
// Returns { path } on success or { error } on failure.
// Staff upload into the *customer's* folder too, so one folder = one thread.
export async function uploadChatImage(customerId, asset) {
  const base64 = getBase64(asset);
  if (!base64) return { error: { message: "Could not read that photo." } };

  const mime = asset.mimeType || "image/jpeg";
  const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${customerId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, base64ToBytes(base64), { contentType: mime });

  if (error) return { error };
  return { path };
}
