/**
 * OPTIONAL — this is not deployed automatically.
 *
 * This Cloud Function is what makes notifications arrive even when the
 * other person's phone has the app fully closed (real push, not just the
 * in-app "localNotify" used while the app is open).
 *
 * Setup:
 *   1. Install the Firebase CLI: npm install -g firebase-tools
 *   2. From the project root: firebase login && firebase init functions
 *      (choose your existing project, JavaScript, and skip overwriting this file)
 *   3. Your project must be on the Blaze (pay-as-you-go) plan to deploy
 *      functions — it stays free for this kind of usage under normal limits.
 *   4. Copy this file's contents into functions/index.js it creates.
 *   5. Deploy: firebase deploy --only functions
 *
 * What it does: whenever households/putter-and-q changes, it diffs the
 * shopping/events/expenses arrays against the previous version and sends a
 * push notification (via FCM) to whichever person DIDN'T make the change,
 * using the device tokens saved by registerPushToken() in src/firebase.js.
 */
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

function newlyAdded(before, after) {
  return (after || []).filter((x) => !(before || []).some((y) => y.id === x.id));
}

exports.notifyOnHouseChange = onDocumentUpdated("households/{houseId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const tokens = after.tokens || {};

  const messages = [];

  newlyAdded(before.shopping, after.shopping).forEach((item) => {
    const target = item.addedBy === "Putter" ? "Q" : "Putter";
    (tokens[target] || []).forEach((token) =>
      messages.push({ token, notification: { title: "Homie · Shopping", body: `${item.addedBy} added "${item.text}"` } })
    );
  });

  newlyAdded(before.events, after.events).forEach((ev) => {
    const target = ev.owner === "Putter" ? "Q" : "Putter";
    (tokens[target] || []).forEach((token) =>
      messages.push({ token, notification: { title: "Homie · Calendar", body: `${ev.owner} added "${ev.title}"` } })
    );
  });

  newlyAdded(before.expenses, after.expenses).forEach((exp) => {
    const target = exp.paidBy === "Putter" ? "Q" : "Putter";
    (tokens[target] || []).forEach((token) =>
      messages.push({ token, notification: { title: "Homie · Finance", body: `${exp.paidBy} logged ${exp.desc} (฿${exp.amount})` } })
    );
  });

  if (messages.length === 0) return;
  const messaging = getMessaging();
  await Promise.allSettled(messages.map((m) => messaging.send(m)));
});
