/**
 * Capacitor native bridge — provides native functionality when running
 * inside a Capacitor Android/iOS shell, with graceful web fallbacks.
 */

import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "android" | "ios" | "web"

// ── Haptics ──
export async function hapticImpact(style: "light" | "medium" | "heavy" = "medium") {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: map[style] });
}

// ── Status Bar ──
export async function configureStatusBar() {
  if (!isNative) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setBackgroundColor({ color: "#0A0118" });
  await StatusBar.setStyle({ style: Style.Dark });
}

// ── Keyboard ──
export async function hideKeyboard() {
  if (!isNative) return;
  const { Keyboard } = await import("@capacitor/keyboard");
  await Keyboard.hide();
}

// ── Push Notifications (native) ──
export async function registerNativePush(): Promise<string | null> {
  if (!isNative) return null;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return null;

  await PushNotifications.register();

  return new Promise((resolve) => {
    PushNotifications.addListener("registration", (token) => {
      resolve(token.value);
    });
    PushNotifications.addListener("registrationError", () => {
      resolve(null);
    });

    // Timeout after 10s
    setTimeout(() => resolve(null), 10000);
  });
}

// ── Camera (photo capture for profile) ──
export async function takePhoto(): Promise<string | null> {
  if (!isNative) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      width: 512,
      height: 512,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

// ── Geolocation (native) ──
export async function getNativeLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!isNative) return null;
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
