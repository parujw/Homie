import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

/**
 * ⚠️ SETUP REQUIRED ⚠️
 * 1. Go to https://console.firebase.google.com → Create a project (free).
 * 2. Add a Web App inside the project → copy the config object it gives you
 *    and paste it below, replacing every "REPLACE_ME".
 * 3. In the Firebase console, enable:
 *      - Firestore Database (start in production mode, region asia-southeast1 is fine)
 *      - Authentication → Sign-in method → Anonymous → Enable
 *      - Cloud Messaging (for push notifications) → generate a Web Push
 *        certificate (VAPID key) under Project settings → Cloud Messaging,
 *        and paste it into VAPID_KEY below.
 * 4. Copy the exact same config into public/firebase-messaging-sw.js.
 * 5. Set Firestore rules (Firestore → Rules) to something like:
 *
 *      rules_version = '2';
 *      service cloud.firestore {
 *        match /databases/{database}/documents {
 *          match /households/{houseId} {
 *            allow read, write: if request.auth != null;
 *          }
 *        }
 *      }
 *
 * Until this is filled in, the app runs in "offline demo" mode — it works
 * for one device only and nothing syncs, but nothing crashes.
 */
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};
const VAPID_KEY = "REPLACE_ME";

export const isFirebaseConfigured = firebaseConfig.apiKey !== "REPLACE_ME";

let app, db, auth;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

// Both Putter and Q read/write the same household document.
const HOUSE_ID = "putter-and-q";
const EMPTY_HOUSE = { shopping: [], events: [], moods: [], pets: [], expenses: [], budgets: [], tokens: {} };

export async function ensureSignedIn() {
  if (!isFirebaseConfigured) return null;
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) resolve(user);
      else signInAnonymously(auth).catch((e) => console.error("auth error", e));
    });
  });
}

// Subscribes to the shared household doc in real time. Creates it with
// empty defaults on first run. Returns an unsubscribe function.
export function watchHouse(onData) {
  if (!isFirebaseConfigured) {
    onData(EMPTY_HOUSE);
    return () => {};
  }
  const ref = doc(db, "households", HOUSE_ID);
  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        setDoc(ref, EMPTY_HOUSE).catch((e) => console.error(e));
        onData(EMPTY_HOUSE);
      } else {
        onData({ ...EMPTY_HOUSE, ...snap.data() });
      }
    },
    (err) => console.error("watchHouse error", err)
  );
  return unsub;
}

// Overwrites a single field (e.g. "shopping") on the shared house doc.
export async function saveField(field, value) {
  if (!isFirebaseConfigured) return;
  const ref = doc(db, "households", HOUSE_ID);
  try {
    await updateDoc(ref, { [field]: value });
  } catch (e) {
    // Doc may not exist yet on the very first write.
    await setDoc(ref, { ...EMPTY_HOUSE, [field]: value }, { merge: true });
  }
}

/* ---------------- Notifications ---------------- */

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  const perm = await Notification.requestPermission();
  return perm; // "granted" | "denied" | "default"
}

// Registers this device for push (Firebase Cloud Messaging) and stores the
// token under the current user's name so a Cloud Function (see
// functions/index.js) can target it later.
export async function registerPushToken(identity) {
  if (!isFirebaseConfigured) return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  const messaging = getMessaging(app);
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  }).catch((e) => {
    console.error("FCM token error", e);
    return null;
  });
  if (token) {
    await updateDoc(doc(db, "households", HOUSE_ID), {
      [`tokens.${identity}`]: arrayUnion(token),
    }).catch((e) => console.error(e));
    onMessage(messaging, (payload) => {
      // Foreground push — the tab is open, so show an in-page notification.
      new Notification(payload.notification?.title || "Homie", {
        body: payload.notification?.body || "",
        icon: "/icons/icon-192.png",
      });
    });
  }
  return token;
}

// Fires a local notification immediately (no server round-trip). Useful for
// same-device reminders ("today's events") without needing Cloud Messaging.
export function localNotify(title, body) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/icons/icon-192.png" });
}
