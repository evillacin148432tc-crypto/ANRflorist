import { supabase } from "./supabase";

/**
 * Loads portfolio photos: [{ id, image_url, caption, category }].
 * Uses the `portfolio` table if it exists and has rows; otherwise falls back
 * to the shop's product photos so the feature works before any setup.
 */
export async function loadPortfolio(limit) {
  let q = supabase
    .from("portfolio")
    .select("id, image_url, caption, category")
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (!error && data && data.length > 0) return data;

  let p = supabase
    .from("products")
    .select("id, image_url, name, category")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false });
  if (limit) p = p.limit(limit);
  const { data: prods } = await p;
  return (prods || []).map((x) => ({
    id: `p-${x.id}`,
    image_url: x.image_url,
    caption: x.name,
    category: x.category,
  }));
}
