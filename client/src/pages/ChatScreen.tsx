import { useApp } from "@/contexts/AppContext";
import { trpc } from "@/lib/trpc";
import { useChatSocket } from "@/hooks/useChatSocket";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { useE2E } from "@/hooks/useE2E";
import { markConversationRecentlyRead } from "@/lib/chatReadGuard";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getDisplayName, type AvatarUser } from "@/lib/avatarUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Lock, MapPin, Send, Image, Smile, MoreVertical, UserX, Loader2, PartyPopper, Navigation, Video } from "lucide-react";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";
import { useTranslation } from "react-i18next";

export default function ChatScreen() {
  const { user, selectedMatchId, selectedConversationId, navigate, goBack, setActiveTab, selectPlayer } = useApp();
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [showCheersPicker, setShowCheersPicker] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch the match info from matches list — use cache only, never background refetch
  // (background refetches race with markRead optimistic updates and restore stale unreadCount)
  const matchesQuery = trpc.matches.list.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  const match = (matchesQuery.data ?? []).find((m: any) => m.id === selectedMatchId);
  const conversationId = selectedConversationId ?? match?.conversationId;

  // For DM conversations (premium, no match), fetch participants to get peer info
  const participantsQuery = trpc.chat.getParticipants.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId && !match }
  );
  // Derive the peer user from match data or conversation participants
  const peerFromParticipants = (participantsQuery.data ?? []).find((p: any) => p.userId !== user?.id);
  const peerUser: AvatarUser | null = match?.user ? {
    ...match.user,
    hasProfilePhoto: match.user.hasProfilePhoto ?? false,
  } : (peerFromParticipants ? {
    id: peerFromParticipants.userId,
    name: peerFromParticipants.name,
    nickname: peerFromParticipants.nickname,
    profilePhotoUrl: peerFromParticipants.profilePhotoUrl,
    hasProfilePhoto: peerFromParticipants.hasProfilePhoto ?? false,
  } : null);
  const isDmConversation = !!conversationId && !match;

  // Fetch messages for this conversation (initial load + slow fallback poll)
  const messagesQuery = trpc.chat.getMessages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId, refetchInterval: 15000 }
  );
  const messages = messagesQuery.data ?? [];

  // Mark as read — optimistic update + guaranteed cache sync.
  // The global MutationCache.onSettled in main.tsx matches tRPC's internal mutation key
  // [["chat", "markRead"]] to invalidate matches.list even after this component unmounts
  // (React Query v5 does NOT fire component-level onSettled after unmount).
  const markReadMutation = trpc.chat.markRead.useMutation({
    onMutate: async ({ conversationId: cid }) => {
      await utils.matches.list.cancel();
      const previous = utils.matches.list.getData();
      utils.matches.list.setData(undefined, (old) =>
        old?.map(m => m.conversationId === cid ? { ...m, unreadCount: 0 } : m)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        utils.matches.list.setData(undefined, context.previous);
      }
    },
    // No onSettled invalidation — the global MutationCache.onSuccess in main.tsx
    // sets unreadCount:0 even after unmount, and the periodic poll (15s) confirms
    // server state. Eager invalidation was causing race conditions.
  });

  // Real-time socket for instant messages + typing indicators
  const { sendTyping, markRead: socketMarkRead, isAnyoneTyping } = useChatSocket({
    conversationId,
    userId: user?.id,
    onNewMessage: useCallback(() => {
      // Refetch from server to get full message data
      messagesQuery.refetch();
      // Re-mark as read since we're viewing the conversation
      if (conversationId) {
        markReadMutation.mutate({ conversationId });
      }
    }, [messagesQuery, conversationId]),
  });

  // E2E encryption for messages
  const peerUserId = peerUser?.id as number | undefined;
  const { encrypt, decrypt, isEncrypted: e2eActive } = useE2E(peerUserId);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<number, string>>(new Map());

  // Stable key based on message IDs to prevent re-render loops
  const messageIds = useMemo(() => messages.map(m => m.id).join(","), [messages]);

  // Decrypt messages as they arrive — keyed on messageIds to avoid infinite loops
  useEffect(() => {
    if (messages.length === 0) return;
    let cancelled = false;
    const decryptAll = async () => {
      const newMap = new Map<number, string>();
      let hasNew = false;
      for (const msg of messages) {
        if (msg.content) {
          // Reuse previously decrypted values
          const existing = decryptedMessages.get(msg.id);
          if (existing !== undefined) {
            newMap.set(msg.id, existing);
          } else {
            const decrypted = await decrypt(msg.content);
            if (cancelled) return;
            newMap.set(msg.id, decrypted);
            hasNew = true;
          }
        }
      }
      if (!cancelled && hasNew) {
        setDecryptedMessages(newMap);
      }
    };
    decryptAll();
    return () => { cancelled = true; };
  }, [messageIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      utils.matches.list.invalidate();
    },
    onError: (err) => toast.error(err.message || t("chat.failedToSend")),
  });
  const unmatchMutation = trpc.matches.unmatch.useMutation({
    onSuccess: () => {
      toast(t("chat.unmatchedSuccessfully"));
      setActiveTab("matches");
    },
    onError: (err) => toast.error(err.message),
  });

  // Message reactions
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<number | null>(null);
  const reactionEmojis = ["👍", "❤️", "😂", "🔥", "🏓", "💪"];
  const messageIdsForReactions = useMemo(() => messages.map((m: any) => m.id).filter(Boolean), [messages]);
  const reactionsQuery = trpc.chat.getReactions.useQuery(
    { messageIds: messageIdsForReactions },
    { enabled: messageIdsForReactions.length > 0, refetchInterval: 15000 }
  );
  const reactionsMap: Record<number, any[]> = useMemo(() => {
    const data = reactionsQuery.data;
    if (!data || typeof data !== "object") return {};
    return data as Record<number, any[]>;
  }, [reactionsQuery.data]);
  const addReactionMutation = trpc.chat.addReaction.useMutation({
    onSuccess: () => { reactionsQuery.refetch(); setReactionPickerMsgId(null); },
  });
  const removeReactionMutation = trpc.chat.removeReaction.useMutation({
    onSuccess: () => reactionsQuery.refetch(),
  });

  // Photo upload for chat images
  const { openFilePicker, uploading: photoUploading } = usePhotoUpload({
    purpose: "chat-image",
    onSuccess: async (url) => {
      if (!conversationId) return;
      const encryptedUrl = await encrypt(url);
      sendMessageMutation.mutate({ conversationId, content: encryptedUrl, messageType: "image" });
    },
  });

  useEffect(() => {
    if (conversationId) {
      // Activate the read-guard BEFORE the mutation fires so any concurrent
      // refetch (BottomNav 30s, MatchesList 15s) arriving before the mutation
      // completes will still have its unreadCount patched to 0.
      markConversationRecentlyRead(conversationId);
      markReadMutation.mutate({ conversationId });
      socketMarkRead();
    }
    // On unmount, optimistically zero unreadCount in cache.
    // Do NOT call invalidate() here — it races with the markRead mutation on the server:
    // if the refetch hits the server before markRead commits, it returns stale unreadCount
    // and overwrites the optimistic 0. The global MutationCache.onSettled handler in main.tsx
    // will invalidate after the mutation actually completes (even post-unmount).
    return () => {
      if (conversationId) {
        utils.matches.list.setData(undefined, (old) =>
          old?.map(m => m.conversationId === conversationId ? { ...m, unreadCount: 0 } : m)
        );
      }
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  // Handle typing indicator
  const handleInputChange = (value: string) => {
    setInput(value);
    sendTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 2000);
  };

  if (!match && !conversationId && !matchesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        {matchesQuery.isError ? (
          <QueryError message={t("Failed to load conversation")} onRetry={() => matchesQuery.refetch()} />
        ) : (
          <p className="text-muted-foreground">{t("No conversation selected")}</p>
        )}
      </div>
    );
  }

  if (matchesQuery.isLoading || (!match && !peerUser && (participantsQuery.isLoading || participantsQuery.isFetching))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  const handleSend = async () => {
    if (!input.trim() || !conversationId) return;
    const plaintext = input.trim();
    setInput("");
    sendTyping(false);
    // Encrypt if E2E is available
    const content = await encrypt(plaintext);
    // Send via tRPC — server handles DB save + socket broadcast for instant delivery
    sendMessageMutation.mutate({ conversationId, content });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-screen flex flex-col pb-[68px]">
      {/* Header */}
      <div className="card-elevated border-b border-primary/10 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => goBack()}
          className="p-2 rounded-xl glass hover:scale-105 transition-transform"
        >
          <ArrowLeft size={18} />
        </button>
        {peerUser && (
          <button onClick={() => selectPlayer(Number(peerUser.id))} className="flex-shrink-0">
            <PlayerAvatar user={peerUser} size="sm" showBadges={false} />
          </button>
        )}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => peerUser && selectPlayer(Number(peerUser.id))}>
          <p className="font-bold text-sm">{peerUser ? getDisplayName(peerUser) : "..."}</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock size={8} className="text-green-400" />
            {t("Encrypted")}
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(v => !v)} className="p-2 rounded-xl glass hover:scale-105 transition-transform">
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 z-50 card-elevated rounded-xl p-1 min-w-[140px] shadow-lg">
              {!isDmConversation && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowUnmatchConfirm(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"
                >
                  <UserX size={14} />
                  {t("Unmatch")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unmatch Confirmation */}
      {showUnmatchConfirm && (
        <div className="px-4 py-2">
          <div className="card-elevated rounded-xl p-4 border-red-500/30">
            <p className="text-sm font-semibold mb-1">{t("Unmatch {{name}}?", { name: peerUser ? getDisplayName(peerUser) : t("this user") })}</p>
            <p className="text-xs text-muted-foreground mb-3">{t("This cannot be undone. Your conversation will be deleted.")}</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-red-500 text-white hover:bg-red-600" onClick={() => { if (match) unmatchMutation.mutate({ matchId: match.id }); setShowUnmatchConfirm(false); }}>
                {t("Unmatch")}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowUnmatchConfirm(false)}>
                {t("Cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messagesQuery.isError && messages.length === 0 ? (
          <QueryError message={t("chat.failedToLoad")} onRetry={() => messagesQuery.refetch()} />
        ) : (
        <>
        <div className="text-center text-xs text-muted-foreground mb-4">
          <p>{isDmConversation ? t("Start of conversation") : t("You matched on {{date}}", { date: match?.matchedAt ? new Date(match.matchedAt).toLocaleDateString(i18n.language, { month: "long", day: "numeric", year: "numeric" }) : t("recently") })}</p>
        </div>
        {messages.map((msg: any) => {
          const isMine = msg.senderId === user.id;
          const content = decryptedMessages.get(msg.id) ?? msg.content ?? "";
          const isCheers = content.startsWith("🎉") || content.startsWith("🏆") || content.startsWith("🔥") || content.startsWith("⭐");
          const isLocationPin = msg.messageType === "location_pin";

          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="relative">
              <div
                onDoubleClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                className={`max-w-[80%] rounded-2xl text-sm ${
                  isCheers
                    ? "px-4 py-3 bg-gradient-to-br from-secondary/20 via-yellow-500/10 to-orange-500/10 border border-secondary/30 rounded-2xl"
                    : isLocationPin
                    ? "overflow-hidden rounded-2xl border border-primary/20"
                    : `px-3.5 py-2.5 ${isMine
                        ? "bg-gradient-to-r from-primary to-accent text-white rounded-br-md shadow-[0_2px_12px_rgba(168,85,247,0.15)]"
                        : "card-elevated rounded-bl-md"
                      }`
                }`}
              >
                {isLocationPin ? (
                  <div>
                    {msg.locationLat && msg.locationLng ? (
                      <a
                        href={`https://www.google.com/maps?q=${msg.locationLat},${msg.locationLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <div className="w-52 h-28 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCAwTDQwIDQwTTQwIDBMMCA0MCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] opacity-50" />
                          <div className="relative flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                              <Navigation size={20} className="text-secondary" />
                            </div>
                            <span className="text-[10px] font-medium text-secondary/80">{t("Tap to open map")}</span>
                          </div>
                        </div>
                      </a>
                    ) : (
                      <div className="w-52 h-20 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                        <MapPin size={24} className="text-secondary" />
                      </div>
                    )}
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <MapPin size={12} className="text-secondary" />
                        {msg.locationName || content}
                      </p>
                      {msg.locationLat && msg.locationLng && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {Number(msg.locationLat).toFixed(4)}, {Number(msg.locationLng).toFixed(4)}
                        </p>
                      )}
                      <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.sentAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                        {isMine && msg.readAt && user?.isPremium && " ✓✓"}
                      </p>
                    </div>
                  </div>
                ) : isCheers ? (
                  <div className="text-center">
                    <p className="text-2xl mb-1">{content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.sentAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                      {isMine && msg.readAt && user?.isPremium && " ✓✓"}
                    </p>
                  </div>
                ) : (
                  <>
                    <p>{content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.sentAt).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                      {isMine && msg.readAt && user?.isPremium && " ✓✓"}
                    </p>
                  </>
                )}
              </div>
              {/* Reaction picker */}
              {reactionPickerMsgId === msg.id && (
                <div className={`flex gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                  {reactionEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addReactionMutation.mutate({ messageId: msg.id, emoji })}
                      className="w-7 h-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-sm hover:scale-110 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {/* Reactions display */}
              {reactionsMap[msg.id]?.length > 0 && (
                <div className={`flex gap-0.5 mt-0.5 flex-wrap ${isMine ? "justify-end" : "justify-start"}`}>
                  {Object.entries(
                    (reactionsMap[msg.id] ?? []).reduce((acc: Record<string, number>, r: any) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        const myReaction = (reactionsMap[msg.id] ?? []).find((r: any) => r.userId === user?.id && r.emoji === emoji);
                        if (myReaction) removeReactionMutation.mutate({ messageId: msg.id, emoji });
                        else addReactionMutation.mutate({ messageId: msg.id, emoji });
                      }}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full border transition-colors",
                        (reactionsMap[msg.id] ?? []).some((r: any) => r.userId === user?.id && r.emoji === emoji)
                          ? "bg-primary/20 border-primary/30"
                          : "bg-muted/30 border-border/30 hover:bg-muted/50"
                      )}
                    >
                      {emoji}{(count as number) > 1 ? ` ${count}` : ""}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>
          );
        })}
        </>
        )}
      </div>

      {/* Typing Indicator */}
      {isAnyoneTyping && (
        <div className="px-4 py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            {t("typing...")}
          </div>
        </div>
      )}

      {/* Cheers Picker */}
      {showCheersPicker && (
        <div className="px-4 py-2 border-t border-primary/10 bg-background/80 backdrop-blur">
          <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">{t("chat.sendCheers")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { emoji: "🎉🏓", label: t("chat.cheersGreatGame") },
              { emoji: "🔥🏆", label: t("chat.cheersCrushedIt") },
              { emoji: "⭐💪", label: t("chat.cheersMvpPlay") },
              { emoji: "🎯🏓", label: t("chat.cheersPerfectShot") },
              { emoji: "🥳🤝", label: t("chat.cheersPlayAgain") },
              { emoji: "🏓💥", label: t("chat.cheersWhatARally") },
            ].map((cheer) => (
              <button
                key={cheer.emoji}
                onClick={async () => {
                  if (!conversationId) return;
                  const content = await encrypt(`${cheer.emoji} ${cheer.label}`);
                  sendMessageMutation.mutate({ conversationId, content });
                  setShowCheersPicker(false);
                  setShowConfetti(true);
                  setTimeout(() => setShowConfetti(false), 2000);
                }}
                className="flex-shrink-0 px-3 py-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 transition-all hover:scale-105 active:scale-95"
              >
                <span className="text-lg block">{cheer.emoji}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{cheer.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-celebration-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${60 + Math.random() * 40}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.5 + Math.random() * 1.5}s`,
              }}
            >
              {["🏓", "⭐", "🔥", "🎉", "💥", "🏆"][i % 6]}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="card-elevated border-t border-primary/10 px-4 py-3 flex items-center gap-2 flex-shrink-0">
        <button
          className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={photoUploading}
          onClick={openFilePicker}
        >
          {photoUploading ? <Loader2 size={18} className="animate-spin" /> : <Image size={18} />}
        </button>
        <button
          className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
          disabled={locationSharing}
          onClick={() => {
            if (!conversationId) return;
            if (!navigator.geolocation) {
              toast.error(t("Location not available on this device"));
              return;
            }
            setLocationSharing(true);
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                const { latitude, longitude } = pos.coords;
                const encContent = await encrypt(t("📍 Shared location"));
                sendMessageMutation.mutate({
                  conversationId,
                  content: encContent,
                  messageType: "location_pin",
                  locationLat: latitude,
                  locationLng: longitude,
                  locationName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                });
                toast(t("Location shared!"), { icon: "📍" });
                setLocationSharing(false);
              },
              (err) => {
                toast.error(t("Could not get location: {{msg}}", { msg: err.message }));
                setLocationSharing(false);
              },
              { enableHighAccuracy: true, timeout: 10000 }
            );
          }}
        >
          {locationSharing ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
        </button>
        <button
          className={cn("p-2 transition-colors", showCheersPicker ? "text-secondary" : "text-secondary/60 hover:text-secondary")}
          title={t("Send Cheers")}
          onClick={() => setShowCheersPicker(v => !v)}
        >
          <PartyPopper size={18} />
        </button>
        <Input
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("Type a message...")}
          className="flex-1 bg-background/50 h-9 text-sm"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim()}
          size="sm"
          className="bg-gradient-to-r from-primary to-accent text-white h-9 w-9 p-0 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
