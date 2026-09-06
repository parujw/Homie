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

// Web Push certificate from Project settings → Cloud Messaging. Public by
// design: it identifies this project to the browser's push service.
const VAPID_KEY =
  "BARWNfeCWE9cGd8s6Y45MIiQPuO0KnTApzSK_gaQtumF_x9zItay3CkE_azZeFqAQYoCxRxihASNzdKp8my1bGQ";

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

// Turns a Firestore error into something worth showing a user. The common
// case by far is rules that haven't been deployed yet.
export function syncErrorMessage(err) {
  switch (err?.code) {
    case "permission-denied":
      return "Can't save — Firestore security rules are rejecting this. Deploy firestore.rules (see SETUP.md).";
    case "not-found":
    case "failed-precondition":
      return "Can't save — this project has no Firestore database yet. Create one in the Firebase console.";
    case "unauthenticated":
      return "Can't save — your session expired. Sign out and back in.";
    case "unavailable":
      return "Can't reach the server. Your changes will sync when you're back online.";
    default:
      return `Can't save — ${err?.message || "unknown error"}.`;
  }
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
export function watchHouse(onData, onError) {
  const ref = doc(db, "households", HOUSE_ID);
  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        setDoc(ref, EMPTY_HOUSE).catch((e) => {
          console.error("watchHouse create error", e);
          onError?.(e);
        });
        onData(EMPTY_HOUSE);
      } else {
        onData({ ...EMPTY_HOUSE, ...snap.data() });
      }
    },
    (err) => {
      console.error("watchHouse error", err);
      onError?.(err);
    }
  );
  return unsub;
}

// Overwrites a single field (e.g. "shopping") on the shared house doc.
// A merging setDoc creates the document if it isn't there yet and updates it
// if it is, so this needs no create/update branch. Errors propagate: a write
// the rules reject must reach the UI, not disappear.
export function saveField(field, value) {
  const ref = doc(db, "households", HOUSE_ID);
  return setDoc(ref, { [field]: value }, { merge: true });
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
  // Push must be delivered to firebase-messaging-sw.js, which has the
  // onBackgroundMessage handler — navigator.serviceWorker.ready would hand
  // back the app's own sw.js instead, and background pushes would land in a
  // worker that doesn't know how to render them.
  //
  // The worker pulls the Firebase compat scripts from gstatic, so registering
  // it can fail offline or behind a filtering proxy. That only costs push
  // while the app is closed — in-app notifications keep working — so give up
  // quietly rather than failing the whole "enable notifications" action.
  let reg;
  try {
    reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/firebase-cloud-messaging-push-scope",
    });
  } catch (e) {
    console.error("messaging service worker failed to register", e);
    return null;
  }
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
