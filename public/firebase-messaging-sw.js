// This file MUST live at the site root as /firebase-messaging-sw.js —
// Firebase Cloud Messaging looks for it there automatically.
//
// Keep these values in sync with src/firebase.js. They are safe to expose
// publicly — they identify the Firebase project, they are not secret keys.

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCfzmhFbtcifzpcAWKMZr38YqLAg7zFkwc",
  authDomain: "homie-f7172.firebaseapp.com",
  projectId: "homie-f7172",
  storageBucket: "homie-f7172.firebasestorage.app",
  messagingSenderId: "238451644705",
  appId: "1:238451644705:web:28c74d9292ee5f346e4660",
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
