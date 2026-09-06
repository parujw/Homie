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

เหลืออีกขั้นเดียวถ้าอยากให้เตือนตอน**ปิดแอป**: deploy `functions/index.js`
ซึ่งต้องอัปโปรเจกต์เป็นแผน **Blaze** ก่อน แล้วรัน

```bash
npx -y firebase-tools@latest deploy --only functions
```

หมายเหตุ iOS: Safari จะให้สิทธิ์แจ้งเตือนเฉพาะเมื่อติดตั้งเป็น PWA แล้วเท่านั้น
(Share → Add to Home Screen แล้วเปิดจากหน้าโฮม) — หน้า Profile ในแอปจะบอก
สถานะนี้ให้เอง

## สิ่งที่ทำไม่ได้จากเว็บแอป

- Widget แบบ native บนหน้าจอโฮม (ต้องเขียนแอป native จริง)
- LINE rich menu / LINE bot (ต้องมี LINE Official Account + backend แยก)

## หมายเหตุ

โค้ดเดิมเรียกใช้ Tailwind utility class (`flex`, `px-5`, …) แต่โปรเจกต์
ยังไม่ได้ติดตั้ง Tailwind เลย class เหล่านั้นจึงไม่มีผล — หน้าตาบางหน้าจะ
ยังไม่ตรงตามที่ออกแบบไว้ ถ้าจะแก้ต้องเพิ่ม Tailwind เข้าโปรเจกต์
(หน้า login เขียนด้วย inline style จึงแสดงผลถูกต้องอยู่แล้ว)
