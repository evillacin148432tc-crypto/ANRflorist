// Picks an icon that matches a category name (Ionicons).
export function categoryIcon(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("money")) return "cash-outline";
  if (n.includes("fresh")) return "flower-outline";
  if (n.includes("satin")) return "ribbon-outline";
  if (n.includes("fuzzy") || n.includes("wire")) return "sparkles-outline";
  if (n.includes("chocolate")) return "gift-outline";
  if (n.includes("balloon") || n.includes("filler")) return "balloon-outline";
  return "flower-outline";
}
