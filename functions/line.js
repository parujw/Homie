/**
 * LINE notifications via the Messaging API.
 *
 * (LINE Notify, the old one-token way to do this, shut down on 2025-03-31 —
 * the Messaging API with a LINE Official Account is the supported route.)
 *
 * Each person links their own LINE account by messaging the OA with their
 * name, so reminders go to a 1:1 chat. Personal events would leak if these
 * were sent to a shared group.
 */
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const LINE_CHANNEL_ACCESS_TOKEN = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");
const LINE_CHANNEL_SECRET = defineSecret("LINE_CHANNEL_SECRET");

const USERS = ["Putter", "Q"];

/** Sends a push message. `to` is a LINE user ID (or group ID). */
async function sendLine(to, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}`,
    },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    // 429 here means the OA's monthly free message quota is used up.
    console.warn("LINE push failed", res.status, await res.text());
  }
  return res.ok;
}

async function replyLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  }).catch((e) => console.warn("LINE reply failed", e));
}

// LINE signs every webhook delivery; an unsigned request is not from LINE.
function validSignature(rawBody, signature) {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET.value())
    .update(rawBody)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const HELP = `พิมพ์ชื่อของคุณเพื่อผูกบัญชี:\n• Putter\n• Q`;

/**
 * Webhook for the LINE Official Account. Set this function's URL as the
 * webhook URL in the LINE Developers console.
 */
function makeLineWebhook(region, houseId) {
  return onRequest(
    { region, secrets: [LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET], cors: false },
    async (req, res) => {
      if (!validSignature(req.rawBody, req.get("x-line-signature"))) {
        res.status(401).send("bad signature");
        return;
      }

      for (const event of req.body.events || []) {
        const userId = event.source?.userId;
        if (!userId) continue;

        if (event.type === "follow") {
          await replyLine(event.replyToken, `Homie พร้อมแล้ว 👋\n${HELP}`);
          continue;
        }

        if (event.type === "message" && event.message?.type === "text") {
          const said = event.message.text.trim().toLowerCase();
          const who = USERS.find((u) => u.toLowerCase() === said);
          if (who) {
            await getFirestore().doc(`households/${houseId}`).set(
              { line: { [who]: userId } },
              { merge: true }
            );
            await replyLine(event.replyToken, `ผูกกับ ${who} เรียบร้อย ✅\nจะส่งแจ้งเตือนมาที่แชทนี้`);
          } else if (said === "unlink" || said === "ยกเลิก") {
            const ref = getFirestore().doc(`households/${houseId}`);
            const line = (await ref.get()).data()?.line || {};
            const mine = USERS.find((u) => line[u] === userId);
            if (mine) await ref.set({ line: { [mine]: FieldValue.delete() } }, { merge: true });
            await replyLine(event.replyToken, mine ? `ยกเลิกการผูกของ ${mine} แล้ว` : HELP);
          } else {
            await replyLine(event.replyToken, HELP);
          }
        }
      }
      res.status(200).send("ok");
    }
  );
}

module.exports = { sendLine, makeLineWebhook, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET };
