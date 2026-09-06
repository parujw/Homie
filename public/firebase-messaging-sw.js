// This file MUST live at the site root as /firebase-messaging-sw.js —
// Firebase Cloud Messaging looks for it there automatically.
//
// ⚠️ Fill in the same config values as src/firebase.js below, then redeploy.
// These values are safe to expose publicly — they identify your Firebase
// project, they are not secret keys.

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
});

const messaging = firebase.messaging();

// Background push (app closed / tab not focused) is handled here.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Homie";
  const options = {
    body: payload.notification?.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };
  self.registration.showNotification(title, options);
});
