import { trpc } from "@/lib/trpc";
import { I18nProvider } from "@/lib/i18n";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { markConversationRecentlyRead, recentlyReadConvIds, applyRecentlyReadGuard } from "@/lib/chatReadGuard";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onMutate: (_variables, mutation) => {
      const key = mutation.options.mutationKey;
      if (
        Array.isArray(key) &&
        Array.isArray(key[0]) &&
        key[0][0] === "chat" &&
        key[0][1] === "markRead"
      ) {
        // Activate the read-guard IMMEDIATELY so any concurrent or soon-arriving
        // refetch data for this conversation will be patched to unreadCount:0.
        const vars = _variables as { conversationId?: number } | undefined;
        if (vars?.conversationId) {
          markConversationRecentlyRead(vars.conversationId);
        }
        // Cancel any in-flight matches.list fetches to prevent stale data
        queryClient.cancelQueries({ queryKey: [["matches", "list"]] });
      }
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      const key = mutation.options.mutationKey;
      if (
        Array.isArray(key) &&
        Array.isArray(key[0]) &&
        key[0][0] === "chat" &&
        key[0][1] === "markRead"
      ) {
        // Refresh the guard timer (extends 30s from NOW, not from onMutate)
        // and globally set unreadCount to 0 for the read conversation.
        const vars = mutation.state.variables as { conversationId?: number } | undefined;
        if (vars?.conversationId) {
          markConversationRecentlyRead(vars.conversationId);
          queryClient.setQueriesData(
            { queryKey: [["matches", "list"]] },
            (old: any[] | undefined) =>
              old?.map((m: any) => m.conversationId === vars.conversationId ? { ...m, unreadCount: 0 } : m)
          );
        }
      }
    },
  }),
});

// ── Bulletproof read-guard: intercept ALL matches.list data at the cache level ──
// This catches data from background refetches (BottomNav 30s, MatchesList 15s),
// invalidation (sendMessage, notification handlers), and any other source.
// If a conversation was marked read in the last 30 seconds, its unreadCount
// is forced to 0 regardless of what the server returned.
let _guardPatching = false;
queryClient.getQueryCache().subscribe((event) => {
  if (_guardPatching || recentlyReadConvIds.size === 0) return;
  if (event.type !== "updated") return;
  const action = (event as any).action;
  if (!action || action.type !== "success") return;
  const key = event.query.queryKey;
  if (
    !Array.isArray(key) || !Array.isArray(key[0]) ||
    key[0][0] !== "matches" || key[0][1] !== "list"
  ) return;
  const data = event.query.state.data as any[] | undefined;
  if (!data?.some((m: any) => recentlyReadConvIds.has(m.conversationId) && m.unreadCount > 0)) return;
  // A background refetch returned stale unreadCount for a recently-read conversation — patch it.
  _guardPatching = true;
  try {
    queryClient.setQueryData(key, applyRecentlyReadGuard(data));
  } finally {
    _guardPatching = false;
  }
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </trpc.Provider>
);

// ── Register Service Worker for PWA + Offline + Push ──
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(
      () => {},
      () => {},
    );
  });
}
