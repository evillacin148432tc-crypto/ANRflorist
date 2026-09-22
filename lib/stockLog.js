import { supabase } from "./supabase";

// Writes one row to the stock_movements audit log.
// Returns the Supabase error (or null if it worked).
export async function logStockMovement({
  inventoryId,
  materialName,
  before,
  after,
  reason,
}) {
  const { error } = await supabase.from("stock_movements").insert({
    inventory_id: String(inventoryId),
    material_name: materialName,
    stock_before: before,
    stock_after: after,
    change_amount: after - before,
    reason,
  });

  if (error) {
    console.log("STOCK LOG ERROR:", error);
  }

  return error;
}
