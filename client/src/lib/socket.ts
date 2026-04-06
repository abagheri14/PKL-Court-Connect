import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: "/socket.io",
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export type ChatMessage = {
  id?: number;
  conversationId: number;
  senderId: number;
  content?: string;
  messageType: "text" | "image" | "location_pin" | "system";
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
  sentAt: string;
  readAt?: string | null;
};

export type TypingEvent = {
  userId: number;
  conversationId: number;
  isTyping: boolean;
};

export type ReadEvent = {
  userId: number;
  conversationId: number;
};
