# Homie — คู่มือ Firebase

แอปนี้เป็น PWA (ติดตั้งขึ้นหน้าจอโฮมได้) ต่อกับโปรเจกต์ Firebase
**`homie-f7172`** เรียบร้อยแล้ว — config ของ web app ถูกใส่ไว้ใน
`src/firebase.js` และ `public/firebase-messaging-sw.js` แล้ว

## สิ่งที่ต่อไว้แล้ว

- **Authentication (Email/Password)** — สมัคร/เข้าสู่ระบบด้วยอีเมล+รหัสผ่าน
  ต้องล็อกอินก่อนถึงจะเข้าแอปได้ (`AuthGate` ใน `src/App.jsx`)
- **Firestore** — ข้อมูลทั้งบ้าน (ของซื้อ / ปฏิทิน / mood / สัตว์เลี้ยง /
  รายจ่าย) sync แบบเรียลไทม์ผ่าน document `households/putter-and-q`
- **PWA** — ติดตั้งขึ้นหน้าจอโฮมได้ทั้ง iOS/Android

## ขั้นตอนที่ต้องทำในคอนโซล (ครั้งเดียว)

1. **เปิด Email/Password sign-in**
   Authentication → Sign-in method → Email/Password → Enable
   หรือ deploy จากไฟล์ `firebase.json` ในโปรเจกต์นี้:
   ```bash
   npx -y firebase-tools@latest login
   npx -y firebase-tools@latest deploy --only auth
   ```
2. **สร้าง Firestore database** (ถ้ายังไม่มี)
   Firestore Database → Create database → production mode
3. **Deploy security rules** จาก `firestore.rules` ในโปรเจกต์นี้:
   ```bash
   npx -y firebase-tools@latest deploy --only firestore:rules
   ```
4. **เพิ่มโดเมน production** ที่ deploy จริง (เช่นโดเมนของ Vercel) ลงใน
   `authorizedDomains` ใน `firebase.json` แล้ว deploy auth ใหม่ —
   ใส่แค่ชื่อโดเมน ห้ามใส่ `https://` หรือเลข port

## Push notification

VAPID key ใส่ไว้ใน `src/firebase.js` แล้ว เครื่องที่กด "Enable notifications"
จะลงทะเบียน FCM token เก็บไว้ใน `households/putter-and-q` (ฟิลด์ `tokens`)

`functions/index.js` มี 3 ตัว (เวลาไทยทั้งหมด):

| ฟังก์ชัน | ทำงานเมื่อ | ส่งอะไร |
|---|---|---|
| `notifyOnHouseChange` | ทันทีที่อีกฝ่ายเพิ่มของ/นัด/รายจ่าย | แจ้งอีกฝ่ายที่ไม่ได้เป็นคนเพิ่ม |
| `remindTomorrow` | ทุกวัน 20:00 | นัดของพรุ่งนี้ (นัดส่วนตัวส่งเฉพาะเจ้าของ, นัด shared ส่งทั้งคู่) |
| `morningBrief` | ทุกวัน 07:00 | สรุปเช้า: นัดวันนี้ + ของที่ต้องซื้อ + งานสัตว์เลี้ยงค้าง (ถ้าไม่มีอะไรเลยจะไม่ส่ง) |

เหลืออีกขั้นเดียวถ้าอยากให้เตือนตอน**ปิดแอป**: deploy `functions/index.js`
ซึ่งต้องอัปโปรเจกต์เป็นแผน **Blaze** ก่อน แล้วรัน

```bash
npx -y firebase-tools@latest deploy --only functions
```

หมายเหตุ iOS: Safari จะให้สิทธิ์แจ้งเตือนเฉพาะเมื่อติดตั้งเป็น PWA แล้วเท่านั้น
(Share → Add to Home Screen แล้วเปิดจากหน้าโฮม) — หน้า Profile ในแอปจะบอก
สถานะนี้ให้เอง

## แจ้งเตือนทาง LINE

แจ้งเตือนทุกแบบข้างบนจะถูกส่งเข้า LINE ด้วย ถ้าผูกบัญชีไว้
(LINE Notify ปิดบริการไปแล้วเมื่อ 31 มี.ค. 2025 จึงต้องใช้ Messaging API)

**ตั้งค่าครั้งเดียว:**

1. สร้าง LINE Official Account ที่ https://developers.line.biz/console/
   → Create channel → **Messaging API**
2. ในแท็บ **Messaging API** ของ channel:
   - กด **Issue** เพื่อออก **Channel access token (long-lived)**
   - ปิด **Auto-reply messages** และ **Greeting messages** (ไม่งั้นบอทจะตอบข้อความอัตโนมัติกวน)
3. ในแท็บ **Basic settings** คัดลอก **Channel secret**
4. เก็บทั้งสองค่าเป็น secret ของ Cloud Functions:
   ```bash
   npx -y firebase-tools@latest functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN
   npx -y firebase-tools@latest functions:secrets:set LINE_CHANNEL_SECRET
   ```
5. Deploy: `npx -y firebase-tools@latest deploy --only functions`
6. เอา URL ของฟังก์ชัน `lineWebhook` ที่ได้จากผล deploy ไปใส่เป็น
   **Webhook URL** ในแท็บ Messaging API แล้วเปิด **Use webhook**
7. แอดเพื่อนกับ OA (สแกน QR ในหน้า Messaging API) แล้ว **พิมพ์ชื่อตัวเอง**
   ในแชท — `Putter` หรือ `Q` — บอทจะตอบยืนยันว่าผูกแล้ว

พิมพ์ `ยกเลิก` ในแชทเพื่อเลิกรับแจ้งเตือน

**โควตา:** LINE Official Account แบบฟรีส่งข้อความได้จำนวนจำกัดต่อเดือน
ถ้าเกินโควตา LINE จะตอบ 429 และฟังก์ชันจะเขียน log ไว้ (แจ้งเตือนใน
แอปกับ push ยังทำงานปกติ)

## สิ่งที่ทำไม่ได้จากเว็บแอป

- Widget แบบ native บนหน้าจอโฮม (ต้องเขียนแอป native จริง)
- LINE rich menu / LINE bot (ต้องมี LINE Official Account + backend แยก)

## หมายเหตุ

โค้ดเดิมเรียกใช้ Tailwind utility class (`flex`, `px-5`, …) แต่โปรเจกต์
ยังไม่ได้ติดตั้ง Tailwind เลย class เหล่านั้นจึงไม่มีผล — หน้าตาบางหน้าจะ
ยังไม่ตรงตามที่ออกแบบไว้ ถ้าจะแก้ต้องเพิ่ม Tailwind เข้าโปรเจกต์
(หน้า login เขียนด้วย inline style จึงแสดงผลถูกต้องอยู่แล้ว)
