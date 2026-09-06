/**
 * Push notifications for when the other person's phone has the app closed.
 * (While the app is open the client shows these itself via localNotify.)
 *
 * Deploy with:  npx -y firebase-tools@latest deploy --only functions
 * Requires the Blaze plan.
 *
 * Whenever households/putter-and-q changes, this diffs the shopping, events
 * and expenses arrays against the previous version and pushes to whichever
 * person did NOT make the change, using the device tokens that
 * registerPushToken() in src/firebase.js saves on the same document.
 */
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// Must match the Firestore database's location.
const REGION = "asia-southeast1";

function newlyAdded(before, after) {
  return (after || []).filter((x) => !(before || []).some((y) => y.id === x.id));
}

// Builds one FCM message per (new item, device of the other person).
// Exported so the routing can be checked without a live Firestore event.
function buildMessages(before, after) {
  const tokens = after.tokens || {};
  const messages = [];

  const add = (list, who, title, body) =>
    newlyAdded(before[list], after[list]).forEach((x) => {
      const target = who(x) === "Putter" ? "Q" : "Putter";
      (tokens[target] || []).forEach((token) =>
        messages.push({ token, notification: { title, body: body(x) } })
      );
    });

  add("shopping", (i) => i.addedBy, "Homie \u00b7 Shopping", (i) => `${i.addedBy} added "${i.text}"`);
  add("events", (e) => e.owner, "Homie \u00b7 Calendar", (e) => `${e.owner} added "${e.title}"`);
  add("expenses", (e) => e.paidBy, "Homie \u00b7 Finance", (e) => `${e.paidBy} logged ${e.desc} (\u0e3f${e.amount})`);

  return messages;
}
exports.buildMessages = buildMessages;

exports.notifyOnHouseChange = onDocumentUpdated(
  { document: "households/{houseId}", region: REGION },
  async (event) => {
    if (!event.data) return;
    const messages = buildMessages(
      event.data.before.data() || {},
      event.data.after.data() || {}
    );
    if (messages.length === 0) return;
    // sendEach delivers every message even if some tokens are stale, and
    // reports the failures rather than throwing on the first one.
    const res = await getMessaging().sendEach(messages);
    if (res.failureCount > 0) {
      console.warn(`${res.failureCount}/${messages.length} pushes failed`,
        res.responses.filter((r) => !r.success).map((r) => r.error?.code));
    }
  }
);
