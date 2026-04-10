import { useEffect, useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { requestFirebasePushToken, onFirebaseMessage } from "@/lib/firebase";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type NotificationPermissionState = "default" | "granted" | "denied";

export function usePushNotifications(isAuthenticated: boolean) {
  const { t } = useTranslation();
  const [permission, setPermission] = useState<NotificationPermissionState>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subscribed = useRef(false);

  const subscribeMutation = trpc.push.subscribe.useMutation();
  const utils = trpc.useUtils();

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") {
      toast.error(t("pushNotifications.notSupported"));
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        toast.error(t("pushNotifications.permissionDenied"));
        return false;
      }

      // Try Firebase Cloud Messaging first
      const fcmToken = await requestFirebasePushToken();
      if (fcmToken) {
        await subscribeMutation.mutateAsync({
          subscription: { type: "fcm" as const, token: fcmToken },
        });
        setIsSubscribed(true);
        toast.success(t("pushNotifications.enabled"));
        return true;
      }

      // Fallback: Web Push API with VAPID
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        
        if (vapidKey && vapidKey !== "YOUR_VAPID_KEY_HERE") {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
          });
          const subJson = subscription.toJSON();
          await subscribeMutation.mutateAsync({
            subscription: {
              type: "web-push" as const,
              endpoint: subJson.endpoint!,
              keys: {
                p256dh: subJson.keys!.p256dh!,
                auth: subJson.keys!.auth!,
              },
            },
          });
          setIsSubscribed(true);
          toast.success(t("pushNotifications.enabled"));
          return true;
        }
      }

      // Fallback: Socket.io real-time notifications (always works)
      toast.success(t("pushNotifications.realtimeEnabled"));
      setIsSubscribed(true);
      return true;
    } catch {
      toast.error(t("pushNotifications.enableFailed"));
      return false;
    }
  }, [subscribeMutation]);

  // Listen for in-app notifications via Firebase messaging
  useEffect(() => {
    if (!isAuthenticated || !isSubscribed) return;
    const unsubscribe = onFirebaseMessage((payload) => {
      const { title, body } = payload.notification ?? {};
      if (title) {
        toast(title, { description: body });
      }
      utils.notifications.list.invalidate();
    });
    return () => {
      unsubscribe?.();
    };
  }, [isAuthenticated, isSubscribed]);

  // Listen for in-app notifications via Socket.io (always available)
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();
    const handleNotification = (notification: any) => {
      toast(notification.title || "New notification", {
        description: notification.message || notification.body,
      });
      // Invalidate notifications list so bell badges update immediately
      utils.notifications.list.invalidate();
    };

    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, [isAuthenticated]);

  // Auto-subscribe on login if permission was previously granted
  useEffect(() => {
    if (isAuthenticated && permission === "granted" && !subscribed.current) {
      subscribed.current = true;
      requestPermission();
    }
  }, [isAuthenticated, permission]);

  return {
    permission,
    isSubscribed,
    requestPermission,
    isSupported: typeof Notification !== "undefined",
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
