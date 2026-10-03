// Merges new chat rows into the current list without duplicates, oldest first.
// Used by realtime events, the quick background refresh, and "just sent"
// messages, so the same message arriving from two places shows only once.
export function mergeMessages(prev, incoming) {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m });
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  );
}
