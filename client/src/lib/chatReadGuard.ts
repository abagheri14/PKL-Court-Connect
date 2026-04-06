// ── Recently-read conversation guard ──────────────────────────────────────
// Tracks conversations marked read in the last 30 seconds so any stale
// refetch data can't overwrite an optimistic unreadCount:0 update.
export const recentlyReadConvIds = new Map<number, ReturnType<typeof setTimeout>>();

export function markConversationRecentlyRead(conversationId: number) {
  const existing = recentlyReadConvIds.get(conversationId);
  if (existing) clearTimeout(existing);
  recentlyReadConvIds.set(conversationId, setTimeout(() => {
    recentlyReadConvIds.delete(conversationId);
  }, 30_000));
}

export function applyRecentlyReadGuard(data: any[] | undefined): any[] | undefined {
  if (!data || recentlyReadConvIds.size === 0) return data;
  return data.map((m: any) =>
    recentlyReadConvIds.has(m.conversationId) ? { ...m, unreadCount: 0 } : m
  );
}
