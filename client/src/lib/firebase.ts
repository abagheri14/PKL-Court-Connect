import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY_HERE" &&
    firebaseConfig.projectId
  );
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    try {
      app = initializeApp(firebaseConfig);
    } catch {
      return null;
    }
  }
  return app;
}

export function getFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  try {
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch {
    return null;
  }
}

export async function requestFirebasePushToken(): Promise<string | null> {
  const msg = getFirebaseMessaging();
  if (!msg) return null;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey || vapidKey === "YOUR_VAPID_KEY_HERE") return null;

  try {
    const token = await getToken(msg, { vapidKey });
    return token;
  } catch {
    return null;
  }
}

export function onFirebaseMessage(callback: (payload: any) => void): (() => void) | null {
  const msg = getFirebaseMessaging();
  if (!msg) return null;
  return onMessage(msg, callback);
}
