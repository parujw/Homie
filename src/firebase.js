import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

import { firebaseConfig } from "./firebase-config.js";

// Web Push certificate from Project settings → Cloud Messaging. Push
// notifications stay off until this is filled in; everything else works.
const VAPID_KEY = "REPLACE_ME";

const isPushConfigured = VAPID_KEY !== "REPLACE_ME";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Both Putter and Q read/write the same household document.
const HOUSE_ID = "putter-and-q";
const EMPTY_HOUSE = { shopping: [], events: [], moods: [], pets: [], expenses: [], budgets: [], tokens: {} };

/* ---------------- Authentication ---------------- */

// Calls back with the signed-in user (or null) and again on every change.
// Returns an unsubscribe function.
export function watchAuth(onUser) {
  return onAuthStateChanged(auth, onUser);
}

export async function signUp(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  return cred.user;
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function logOut() {
  return signOut(auth);
}

// Turns a Firebase auth error code into something worth showing a user.
export function authErrorMessage(code) {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/weak-password":
      return "Password needs to be at least 6 characters.";
    case "auth/email-already-in-use":
      return "That email already has an account — sign in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/network-request-failed":
      return "Network problem — check your connection.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in isn't enabled for this Firebase project yet.";
    case "auth/configuration-not-found":
      // The Authentication service itself has never been initialised for the
      // project — Console → Authentication → Get started.
      return "Authentication isn't set up for this Firebase project yet.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Subscribes to the shared household doc in real time. Creates it with
// empty defaults on first run. Returns an unsubscribe function.
export function watchHouse(onData) {
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
  if (!isPushConfigured) return null;
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
      localNotify(payload.notification?.title || "Homie", payload.notification?.body || "");
    });
  }
  return token;
}

// Fires a local notification immediately (no server round-trip). Useful for
// same-device reminders ("today's events") without needing Cloud Messaging.
//
// iOS only exposes notifications to an installed PWA, and even there the
// `new Notification()` constructor throws — notifications must come from the
// service worker registration. So prefer the registration everywhere and keep
// the constructor as the desktop fallback.
export async function localNotify(title, body) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options = { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) return reg.showNotification(title, options);
  } catch (e) {
    // Fall through to the constructor below.
  }
  try {
    new Notification(title, options);
  } catch (e) {
    console.error("notification failed", e);
  }
}

/**
 * Why notifications may be unavailable on this device, so the UI can say
 * something more useful than "turn them on".
 *   "ready"        — supported, just needs permission (or already granted)
 *   "needs-install" — iOS: only an installed PWA can show notifications
 *   "unsupported"  — the browser has no Notification API at all
 */
export function notificationSupport() {
  if (typeof Notification !== "undefined") return "ready";
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  return isIOS && !installed ? "needs-install" : "unsupported";
}
