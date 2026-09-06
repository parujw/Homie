# Homie — คู่มือติดตั้ง Firebase

แอปนี้เป็น PWA จริง (ติดตั้งขึ้นหน้าจอโฮมได้) พร้อมโครง Firebase ไว้ให้ครบ
แต่ต้องเติม config ของโปรเจกต์ Firebase ของตัวเองก่อนถึงจะ sync ข้อมูลและ
แจ้งเตือนข้ามเครื่องได้จริง

## ขั้นตอน

1. ไปที่ https://console.firebase.google.com → สร้างโปรเจกต์ใหม่ (ฟรี)
2. ในโปรเจกต์ → Add app → เลือก Web (</>) → ตั้งชื่อ → จะได้ config object
   หน้าตาแบบนี้:
   ```js
   {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "...",
   }
   ```
3. เปิดใช้งาน 3 อย่างในคอนโซล:
   - **Firestore Database** → Create database → production mode
   - **Authentication** → Sign-in method → เปิด "Anonymous"
   - **Cloud Messaging** → Project settings → Cloud Messaging → Web Push
     certificates → Generate key pair (นี่คือ VAPID key)
4. วาง config ทั้งหมดลงใน 2 ไฟล์ (ค่าต้องเหมือนกันทั้งคู่):
   - `src/firebase.js` (ตัวแปร `firebaseConfig` และ `VAPID_KEY`)
   - `public/firebase-messaging-sw.js`
5. ตั้ง Firestore Rules (Firestore → Rules):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /households/{houseId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
6. Deploy ใหม่อีกครั้ง (ถ้าใช้ Vercel: แค่ push โค้ดที่แก้แล้ว หรือขอให้ผม
   deploy ให้ใหม่)

## สิ่งที่ทำงานได้เลยตอนนี้ (ไม่ต้องตั้งค่าอะไร)
- ติดตั้งเป็น PWA ขึ้นหน้าจอโฮมได้ทั้ง iOS/Android
- แจ้งเตือนในแอป (ตอนแอปเปิดอยู่) เมื่ออีกคนเพิ่มของ/นัด/รายจ่าย

## สิ่งที่ต้องมี Firebase config ก่อนถึงจะทำงาน
- ข้อมูล sync กันแบบเรียลไทม์ข้ามเครื่อง (Firestore)
- Push notification แม้ปิดแอป (ต้องมี `functions/index.js` deploy เพิ่ม —
  ดูคำอธิบายในไฟล์นั้น ต้องใช้ Firebase แผน Blaze)

## สิ่งที่ทำไม่ได้จากเว็บแอป
- Widget แบบ native บนหน้าจอโฮม (ต้องเขียนแอป native จริงสำหรับ iOS/Android)
- LINE rich menu / LINE bot (ต้องมี LINE Official Account + backend endpoint
  แยกต่างหาก ถ้าต้องการเพิ่มทีหลังบอกได้ ทำเป็นเฟสถัดไปได้)
