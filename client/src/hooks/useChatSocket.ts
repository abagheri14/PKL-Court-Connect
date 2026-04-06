import { useEffect, useRef, useCallback, useState } from "react";
import { getSocket, type ChatMessage, type TypingEvent } from "@/lib/socket";

interface UseChatSocketOptions {
  conversationId: number | null | undefined;
  userId: number | null | undefined;
  onNewMessage?: (msg: ChatMessage) => void;
  onTyping?: (event: TypingEvent) => void;
  onReadReceipt?: (event: { userId: number; conversationId: number }) => void;
}

export function useChatSocket({
  conversationId,
  userId,
  onNewMessage,
  onTyping,
  onReadReceipt,
}: UseChatSocketOptions) {
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const typingTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const callbackRefs = useRef({ onNewMessage, onTyping, onReadReceipt });
  callbackRefs.current = { onNewMessage, onTyping, onReadReceipt };

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    if (!socket.connected) return;

    // Join conversation room
    socket.emit("chat:join", conversationId);

    // Listen for new messages
    const handleMessage = (msg: ChatMessage) => {
      if (msg.conversationId === conversationId) {
        callbackRefs.current.onNewMessage?.(msg);
      }
    };

    // Listen for typing indicators
    const handleTyping = (event: TypingEvent) => {
      if (event.conversationId !== conversationId) return;
      if (event.userId === userId) return; // Don't show own typing

      callbackRefs.current.onTyping?.(event);

      if (event.isTyping) {
        setTypingUsers(prev => new Set(prev).add(event.userId));
        // Auto-clear typing after 5s as safety net
        const existing = typingTimeouts.current.get(event.userId);
        if (existing) clearTimeout(existing);
        typingTimeouts.current.set(
          event.userId,
          setTimeout(() => {
            setTypingUsers(prev => {
              const next = new Set(prev);
              next.delete(event.userId);
              return next;
            });
          }, 5000)
        );
      } else {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(event.userId);
          return next;
        });
        const existing = typingTimeouts.current.get(event.userId);
        if (existing) clearTimeout(existing);
      }
    };

    // Listen for read receipts
    const handleRead = (event: { userId: number; conversationId: number }) => {
      if (event.conversationId === conversationId) {
        callbackRefs.current.onReadReceipt?.(event);
      }
    };

    socket.on("chat:message", handleMessage);
    socket.on("chat:typing", handleTyping);
    socket.on("chat:read", handleRead);

    return () => {
      socket.emit("chat:leave", conversationId);
      socket.off("chat:message", handleMessage);
      socket.off("chat:typing", handleTyping);
      socket.off("chat:read", handleRead);
      // Clean up typing timeouts
      typingTimeouts.current.forEach(t => clearTimeout(t));
      typingTimeouts.current.clear();
      setTypingUsers(new Set());
    };
  }, [conversationId, userId]);

  const sendMessage = useCallback(
    (content: string, messageType: "text" | "image" | "location_pin" = "text") => {
      if (!conversationId) return;
      const socket = getSocket();
      socket.emit("chat:send", {
        conversationId,
        content,
        messageType,
      });
    },
    [conversationId]
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId) return;
      const socket = getSocket();
      socket.emit("chat:typing", { conversationId, isTyping });
    },
    [conversationId]
  );

  const markRead = useCallback(() => {
    if (!conversationId) return;
    const socket = getSocket();
    socket.emit("chat:read", { conversationId });
  }, [conversationId]);

  return {
    sendMessage,
    sendTyping,
    markRead,
    typingUsers,
    isAnyoneTyping: typingUsers.size > 0,
  };
}
