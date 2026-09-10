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
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { sendLine, makeLineWebhook, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET } = require("./line");

initializeApp();

// Must match the Firestore database's location.
const REGION = "asia-southeast1";
const TIME_ZONE = "Asia/Bangkok";
const HOUSE_ID = "putter-and-q";

function newlyAdded(before, after) {
  return (after || []).filter((x) => !(before || []).some((y) => y.id === x.id));
}

// Calendar dates are stored as plain YYYY-MM-DD strings in the household's own
// timezone, so compare them against Bangkok's date rather than the server's UTC
// one — at 07:00 Bangkok, UTC is still on the previous day.
function bangkokDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

// Events may span days: `date` is the first, optional `endDate` the last.
function eventEnd(e) {
  return e.endDate && e.endDate > e.date ? e.endDate : e.date;
}
function eventCovers(e, iso) {
  return iso >= e.date && iso <= eventEnd(e);
}

async function loadHouse() {
  const snap = await getFirestore().doc(`households/${HOUSE_ID}`).get();
  return snap.exists ? snap.data() : null;
}

// Delivers one notification to the named people — to every device they've
// registered for push, and to their LINE chat if they've linked one.
async function notify(house, people, title, body) {
  const tokensByUser = house.tokens || {};
  const line = house.line || {};

  const messages = people.flatMap((who) =>
    (tokensByUser[who] || []).map((token) => ({ token, notification: { title, body } }))
  );
  if (messages.length > 0) {
    const res = await getMessaging().sendEach(messages);
    if (res.failureCount > 0) {
      console.warn(`${res.failureCount}/${messages.length} pushes failed`,
        res.responses.filter((r) => !r.success).map((r) => r.error?.code));
    }
  }

  await Promise.all(
    people.filter((who) => line[who]).map((who) => sendLine(line[who], `${title}\n${body}`))
  );
}

// Works out who should hear about each newly added item, and what to say.
// Exported so the routing can be checked without a live Firestore event.
function buildAlerts(before, after) {
  const alerts = [];
  const add = (list, who, title, body) =>
    newlyAdded(before[list], after[list]).forEach((x) => {
      alerts.push({ target: who(x) === "Putter" ? "Q" : "Putter", title, body: body(x) });
    });

  add("shopping", (i) => i.addedBy, "Homie \u00b7 Shopping", (i) => `${i.addedBy} added "${i.text}"`);
  add("events", (e) => e.owner, "Homie \u00b7 Calendar", (e) => `${e.owner} added "${e.title}"`);
  add("expenses", (e) => e.paidBy, "Homie \u00b7 Finance", (e) => `${e.paidBy} logged ${e.desc} (\u0e3f${e.amount})`);

  return alerts;
}
exports.buildAlerts = buildAlerts;

exports.notifyOnHouseChange = onDocumentUpdated(
  {
    document: "households/{houseId}",
    region: REGION,
    secrets: [LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET],
  },
  async (event) => {
    if (!event.data) return;
    const after = event.data.after.data() || {};
    const alerts = buildAlerts(event.data.before.data() || {}, after);
    for (const a of alerts) {
      await notify(after, [a.target], a.title, a.body);
    }
  }
);

// Webhook for the LINE Official Account — people link their chat by messaging
// it their name. Its URL goes in the LINE Developers console.
exports.lineWebhook = makeLineWebhook(REGION, HOUSE_ID);

/* ------------------------------------------------------------------
   Scheduled reminders
------------------------------------------------------------------ */

// Evening before: "you have something on tomorrow".
// A shared event notifies both of you; a personal one only its owner.
exports.remindTomorrow = onSchedule(
  { schedule: "0 20 * * *", timeZone: TIME_ZONE, region: REGION,
    secrets: [LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET] },
  async () => {
    const house = await loadHouse();
    if (!house) return;
    const tomorrow = bangkokDate(1);
    // Only the day it starts — no point repeating the reminder every night
    // of a five-day trip.
    const events = (house.events || []).filter((e) => e.date === tomorrow);
    if (events.length === 0) return;

    for (const who of ["Putter", "Q"]) {
      const mine = events.filter((e) => e.type === "shared" || e.owner === who);
      if (mine.length === 0) continue;
      const body =
        mine.length === 1
          ? `Tomorrow: ${mine[0].title}`
          : `Tomorrow: ${mine.map((e) => e.title).join(", ")}`;
      await notify(house, [who], "Homie · Tomorrow", body);
    }
  }
);

// Morning brief: what's on today, plus anything still waiting.
// Stays quiet on a day with nothing to say rather than sending an empty ping.
exports.morningBrief = onSchedule(
  { schedule: "0 7 * * *", timeZone: TIME_ZONE, region: REGION,
    secrets: [LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET] },
  async () => {
    const house = await loadHouse();
    if (!house) return;
    const today = bangkokDate();
    const openShopping = (house.shopping || []).filter((i) => !i.done);
    const petTasks = (house.pets || []).flatMap((p) =>
      (p.tasks || []).filter((t) => !t.done).map((t) => `${t.text} (${p.name})`)
    );

    for (const who of ["Putter", "Q"]) {
      // A multi-day event is "on today" for every day it covers.
      const events = (house.events || []).filter(
        (e) => eventCovers(e, today) && (e.type === "shared" || e.owner === who)
      );
      const parts = [];
      if (events.length) parts.push(`📅 ${events.map((e) => e.title).join(", ")}`);
      if (openShopping.length) parts.push(`🛒 ${openShopping.length} to buy`);
      if (petTasks.length) parts.push(`🐾 ${petTasks.join(", ")}`);
      if (parts.length === 0) continue;
      await notify(house, [who], "Homie · Good morning", parts.join(" · "));
    }
  }
);
