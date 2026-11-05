# JoinTix — Project Handoff

> **อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง** ทั้งคนและ AI agent
> ถ้าแก้อะไรที่กระทบเนื้อหาในไฟล์นี้ (stack, โครงสร้าง, สถานะ, ข้อตกลง) ให้อัปเดตไฟล์นี้ใน commit เดียวกัน

อัปเดตล่าสุด: 2026-11-05

---

## 1. โปรเจกต์นี้คืออะไร

เว็บขายบัตรอีเวนต์ / คอนเสิร์ต / งานเลี้ยงรุ่น ที่ต้องรับคนกดพร้อมกันจำนวนมากช่วงเปิดขาย
เป้าหมายหลัก:

1. **ห้ามขายที่นั่งซ้ำ (no double booking)** — สำคัญที่สุด
2. เร็ว รับ traffic พุ่งช่วงเปิดขายได้
3. มีคิวรอ (waiting room) และกันบอท

งานนี้เป็นงานกลุ่มมหาวิทยาลัย

---

## 2. Tech stack (ตัดสินใจแล้ว)

| ส่วน | ใช้อะไร | หมายเหตุ |
|---|---|---|
| Frontend + Backend | **Next.js 16** (App Router, TypeScript, Tailwind v4) | โค้ดอยู่ใน `src/` |
| Database | **Neon** (Serverless **PostgreSQL** 18, region Singapore) | เปลี่ยนจาก PlanetScale MySQL ใน spec แรก ดูเหตุผลข้อ 2.1 |
| ORM | **Drizzle ORM** + `@neondatabase/serverless` (HTTP driver) | |
| Cache / Lock / Queue | **Upstash Redis** | ⏳ ยังไม่ได้ติดตั้ง |
| Auth (สมัคร / ล็อกอิน) | **Better Auth** + Drizzle adapter (อีเมล + รหัสผ่าน, เก็บ session ใน Postgres) | ตั้งค่าที่ `src/lib/auth.ts` ต้องมี `BETTER_AUTH_SECRET` และ `BETTER_AUTH_URL` ใน `.env.local` |
| UI theme / icons | ธีมขาวดำ + ฟอนต์ Google Sans Flex / Noto Sans Thai ยกมาจากโปรเจกต์ next.js-shop, ไอคอน **Hugeicons** | ค่าสีอยู่ใน `src/app/globals.css` ใช้ class อย่าง `bg-card`, `text-muted-foreground` ห้ามใส่สี hex ตรงๆ |

### 2.1 ทำไมใช้ Postgres (Neon) แทน PlanetScale MySQL

- Postgres มี **partial unique index** ทำให้ DB ปฏิเสธการจองซ้ำได้เองเป็นด่านสุดท้าย แม้ Redis จะพลาด
- มี `SELECT … FOR UPDATE SKIP LOCKED`, foreign key ครบ, JSONB (ผังที่นั่ง)
- ต่อยอดได้: pgvector (แนะนำอีเวนต์), PostGIS (อีเวนต์ใกล้ฉัน), full-text search
- Neon ปิดเครื่องเองตอนไม่มีคนใช้ ประหยัด และแตก branch DB ได้

---

## 3. สถานะปัจจุบัน

| เรื่อง | สถานะ |
|---|---|
| ติดตั้ง Next.js + Drizzle + Neon | ✅ เสร็จ |
| เชื่อมต่อฐานข้อมูล (`/api/health`) | ✅ ทดสอบผ่าน |
| ตารางระบบสมาชิก (`user`, `session`, `account`, `verification`) | ✅ สร้างใน Neon แล้ว (migration `drizzle/0000_auth.sql`) |
| ตาราง `events` + `ticket_zones` | ✅ **ออกแบบเสร็จและสร้างใน Neon แล้ว** (migration `drizzle/0002_events.sql` มีอีเวนต์ตัวอย่าง 4 งานติดมาด้วย, `0003_event_gallery.sql` เพิ่ม `events.gallery` (text[] รูปเพิ่มเติมนอกจากโปสเตอร์ สูงสุด 10 รูป), `0004_event_location.sql` เพิ่ม `venue_area` + `latitude` / `longitude` (หมุดแผนที่ ใส่พิกัดให้อีเวนต์ตัวอย่างแล้ว)) PK เป็น UUIDv7 (`uuidv7()` ของ Postgres 18), `events.status` = `draft` / `published` / `closed`, สถานะขายที่หน้าเว็บ (เปิดขาย / ใกล้หมด / รอเปิดขาย / หมด / ปิดการขาย) **ไม่ได้เก็บ** คำนวณใน `saleStatus()` ของ `src/lib/events.ts` จากวันที่ + จำนวนที่เหลือ, `ticket_zones.sold` ให้ API จองเป็นคนอัปเดต (มี CHECK `sold` ≤ `capacity`) |
| ออกแบบ DB schema ส่วนที่นั่ง / ตั๋ว / order / payment | ⏳ **กำลังออกแบบ — ยังไม่ต้องเขียนตาราง** (ให้อ้าง `user.id` ที่เป็น text และ `events.id` / `ticket_zones.id` ที่เป็น uuid) |
| ระบบสมัครสมาชิก / เข้าสู่ระบบ / ออกจากระบบ | ✅ เสร็จ: `/register` (ชื่อ อีเมล เบอร์โทร รหัสผ่าน), `/login`, เมนูบัญชีใน navbar ยังไม่มี: หน้า `/tickets` |
| ยืนยันอีเมล | ✅ เสร็จ 2 ทาง (ไม่บังคับตอนสมัคร/ล็อกอิน แต่ต้องยืนยันก่อนซื้อบัตร): (1) หน้า `/profile` กดส่งลิงก์ทางอีเมล เปิดลิงก์แล้วยืนยันให้เอง (ใช้ได้ 1 ชม.) (2) ในหน้าซื้อบัตร ถ้ายังไม่ยืนยันจะส่งรหัส 6 หลัก (Better Auth plugin `emailOTP`, 10 นาที กรอกผิดได้ 5 ครั้ง) ไม่มี `RESEND_API_KEY` ลิงก์/รหัสจะโผล่ใน terminal ของ server ลิงก์ในอีเมลใช้ `BETTER_AUTH_URL` เป็นโดเมน |
| หน้า `/profile` | ✅ ชื่อ อีเมล เบอร์โทร วันที่สมัคร + สถานะยืนยันอีเมล (ยังแก้ข้อมูลไม่ได้) |
| โรล Super admin + หลังบ้าน `/admin` | ✅ คอลัมน์ `user.role` (`user` / `super_admin`, migration `drizzle/0001_user_role.sql` รันกับ Neon แล้ว) ตอนนี้ super admin คือ rattanatrai.ros@spumail.net หน้า: ภาพรวม (สถิติสมาชิก), `/admin/users` (ค้นหา + ปุ่มต่อแถวแบบ 4TUNEZ: **แก้ไข** ชื่อ/อีเมล/เบอร์/สถานะยืนยันอีเมล/สิทธิ์/ตั้งรหัสผ่านใหม่ (ตั้งแล้วออกจากระบบทุกเครื่อง), **อุปกรณ์** ดูเครื่องที่ล็อกอินอยู่ + สั่งออกจากระบบ, **ลบบัญชี** ถาวร ต้องพิมพ์อีเมลยืนยัน; เปลี่ยนสิทธิ์/ลบบัญชีตัวเองไม่ได้ ยังไม่มี "ระงับบัญชี" เพราะต้องเพิ่มคอลัมน์), `/admin/events` จัดการอีเวนต์ครบ: รายการ (ค้นหา, แท็บ ทั้งหมด/เผยแพร่/ฉบับร่าง/ปิดการขาย, ยอดบัตรขายแล้ว + ยอดเงิน, ปุ่มแก้ไข/ดูหน้าขาย/ทำสำเนา/ลบ), `/admin/events/new` และ `/admin/events/[id]` (ฟอร์มเดียว: ชื่อ, slug, ผู้จัด, สถานที่, รายละเอียด, วันเริ่ม/ประตูเปิด/เปิดขาย/ปิดขาย (เวลาไทย), สถานะ, อีเวนต์แนะนำ, จำกัดใบต่อบัญชี, โปสเตอร์ (**อัปโหลดไฟล์ได้แบบ 4TUNEZ**: คลิก/ลากไฟล์ เห็นตัวอย่างก่อน ส่งตอนกดบันทึก เบราว์เซอร์ย่อรูปก่อนส่ง server แปลงเป็น WebP ไม่เกิน 1200×1500 เก็บที่ `storage/uploads/` (git ignore) เสิร์ฟที่ `/uploads/...` cache 1 ปี รูปที่ไม่มีอีเวนต์ใช้แล้วลบเอง; หรือเลือกจาก `public/posters` / ใส่ path หรือ https เอง), **หมุดแผนที่**: วางลิงก์ Google Maps (ลิงก์สั้น maps.app.goo.gl ก็ได้ server ตามลิงก์ให้) หรือพิกัด / ใช้ตำแหน่งของฉัน เห็นแผนที่ตัวอย่างทันที, โซนบัตร เพิ่ม/ลบ/เรียงลำดับ ราคา จำนวน; **รูปที่อัปโหลดอยู่ในเครื่องที่รันเว็บเท่านั้น** DB ใช้ร่วมกัน เครื่องเพื่อนจะเห็นรูปนั้นเป็นรูปเสีย ถ้าจะ deploy ขึ้น Vercel ต้องย้ายไปที่เก็บไฟล์อย่าง Blob / R2) โซนที่ขายแล้วลบไม่ได้และลดจำนวนต่ำกว่าที่ขายไม่ได้ อีเวนต์ที่ขายแล้วลบไม่ได้ (ให้ปิดการขายแทน) บันทึกแล้วหน้าเว็บอัปเดตทันที (`updateTag("events")`) ภาพรวมแสดงสถิติอีเวนต์จริง หน้าตาแบบหลังบ้าน next.js-shop: เมนูข้างตายตัวบนจอใหญ่ / drawer + แถบบนบนมือถือ ตารางซ่อนคอลัมน์ตามขนาดจอ (ไม่ต้องเลื่อนข้าง) ไม่ใช่ super admin เข้าแล้วเจอ 404 ทุกหน้า/action ใน `/admin` ต้องเรียก `requireSuperAdmin()` จาก `@/lib/session` |
| ลืมรหัสผ่าน | ✅ เสร็จ: `/forgot-password` ส่งลิงก์ทางอีเมล (Resend) → `/reset-password` ตั้งรหัสใหม่ ลิงก์ใช้ได้ครั้งเดียว 1 ชม. และออกจากระบบทุกอุปกรณ์ ถ้ายังไม่ใส่ `RESEND_API_KEY` ลิงก์จะไปโผล่ใน terminal ของ server แทน |
| Upstash Redis (lock / rate limit / queue) | ⏳ ยังไม่เริ่ม |
| API กดบัตร / สร้าง order | ⏳ ยังไม่เริ่ม |
| ระบบชำระเงิน | ⏳ ยังไม่เริ่ม |
| Navbar + สลับธีมขาว/ดำ + ค้นหา (Ctrl K) | ✅ เสร็จ (sticky เป็นแคปซูลลอยตอนเลื่อนลง, มีเมนูมือถือ) |
| หน้าแรก: ส่วน hero (พื้นหลัง veil เคลื่อนไหว, จุดสถานะ DB, ข้อความค่อยๆ ขึ้น) | ✅ เสร็จ (ยกมาจาก next.js-shop) |
| หน้าแรก: แบนเนอร์อีเวนต์แบบสไลด์ (ขอบโค้ง, ปุ่มลูกศร, จุดบอกตำแหน่ง, เลื่อนเองทุก 5 วิ) | ✅ เสร็จ แต่ข้อมูลยังเป็นแบนเนอร์ตัวอย่างใน `src/lib/banners.ts` รูปใน `public/banners/` |
| หน้าแรก: อีเวนต์แนะนำ (การ์ดโปสเตอร์ 4:5, วันที่ + สถานที่, ปุ่มซื้อบัตรเปลี่ยนตามสถานะ) | ✅ เสร็จ ดึงจากตาราง `events` (ติ๊ก "อีเวนต์แนะนำ" ในหลังบ้าน) ผ่าน `getFeaturedEvents()` ที่ cache ไว้ 1 นาที รูปใน `public/posters/` |
| Footer (ชื่อเว็บ + ลิขสิทธิ์, ลิงก์ 3 กลุ่ม, ชื่อ JoinTix แบบ Aceternity Text Hover Effect: เส้นขอบวาดเองตอนเลื่อนถึง + สีรุ้งตามเมาส์) | ✅ เสร็จ ลิงก์ส่วนใหญ่ยังไม่มีหน้า |
| Animation + skeleton loading | ✅ หน้าแรก / login / register / ลืมรหัสผ่าน มี `loading.tsx` เป็น skeleton, รูปค่อยๆ เฟดขึ้นบน skeleton, การ์ดและ footer ลอยขึ้นตอนเลื่อน (`.reveal`) หน้าใหม่ให้เพิ่ม `loading.tsx` ด้วย (ดูหัว `src/components/ui/skeleton.tsx`) |
| หน้าอีเวนต์ / เลือกซื้อบัตร `/events/[id]` (โปสเตอร์ + รายละเอียด, เลือกโซน + จำนวน จำกัดใบต่อบัญชี, สรุปราคา, ยังไม่ล็อกอินให้ไป `/login?next=`, ปุ่มเปลี่ยนตามสถานะขาย) | ✅ UI เสร็จ: รูปแบบ 4TUNEZ (โปสเตอร์ใหญ่ในกรอบ + รูปย่อด้านล่างเมื่อมีหลายรูป กดดูเต็มจอ ซูม/ปัด/ลูกศรได้ `components/event-gallery.tsx`), บล็อกสถานที่ (ไอคอนหมุด + ชื่อ + เขต/จังหวัด + "เปิดแผนที่") และส่วน "การเดินทาง" มีแผนที่ Google ฝัง + ปุ่มนำทาง (เมื่อมีหมุด), ปุ่มแชร์ LINE / Facebook / Messenger / Discord / X / Telegram / WhatsApp / คัดลอกลิงก์ / แชร์ของมือถือ ใต้กล่องเลือกบัตร (`components/share-row.tsx`, สีแบรนด์ `--share-*` ใน globals.css) และ Open Graph ให้ลิงก์ที่แชร์ขึ้นการ์ด ดึงจาก DB ด้วย `getEvent(slug)` (`[id]` ในพาธคือ `events.slug`, ฉบับร่างเปิดไม่เจอ) ต้องล็อกอินและยืนยันอีเมลก่อน ปุ่มซื้อยังแค่บอกว่าระบบจองกำลังพัฒนา รอ API กดบัตร (API ต้องเช็ก `emailVerified` ฝั่ง server ด้วย) |
| หน้า `/events` (รายการทั้งหมด), `/docs` | ⏳ ยังไม่มี (ลิงก์ใน navbar จะขึ้น 404) |

---

## 4. เริ่มต้นใช้งาน (สำหรับเพื่อนในกลุ่ม)

ก่อนเริ่ม ขอ **Neon `DATABASE_URL`** จากเจ้าของโปรเจกต์ในกลุ่มไว้ก่อน เลือกวิธีใดวิธีหนึ่งด้านล่าง

### ทางที่ 1: ติดตั้งในเครื่องด้วยสคริปต์ (แนะนำ)

ไม่ต้องติดตั้ง Node.js เอง สคริปต์จะเช็กให้ ถ้ายังไม่มีจะถามก่อนแล้วติดตั้งให้
จากนั้นจะรัน `npm ci` และถาม `DATABASE_URL` เพื่อสร้างไฟล์ `.env.local` ให้

1. ดาวน์โหลดโปรเจกต์: บน GitHub กด **Code → Download ZIP** แล้วแตกไฟล์ (หรือใช้ `git clone` ถ้ามี git)
2. รันสคริปต์ setup
   - **Windows:** ดับเบิลคลิก `setup.cmd` (หรือพิมพ์ `setup` ใน cmd ที่อยู่ในโฟลเดอร์โปรเจกต์)
   - **macOS / Linux:** เปิด Terminal ในโฟลเดอร์โปรเจกต์ แล้วรัน `bash scripts/setup.sh`
3. ตอบ `Y` เมื่อถามว่าจะติดตั้ง Node.js ไหม (npm มาพร้อม Node.js) และกดยอมรับหน้าต่าง admin ของ Windows ถ้ามีเด้งขึ้นมา
4. วาง `DATABASE_URL` เมื่อสคริปต์ถาม
5. ตอบ `Y` เมื่อถามว่าจะเปิดแอปเลยไหม แล้วเปิด http://localhost:3000/api/health ถ้าเห็น `"ok": true` แปลว่าต่อ DB ได้แล้ว

**ครั้งต่อไป (Windows):** ดับเบิลคลิก `start.cmd` ได้เลย ถ้ายังไม่เคยติดตั้งจะรัน setup ให้ก่อนอัตโนมัติ

> **เจอ `'npm' is not recognized`?** แปลว่ายังไม่มี Node.js หรือเพิ่งติดตั้งแต่ยังใช้หน้าต่าง cmd เดิมอยู่
> ให้ดับเบิลคลิก `setup.cmd` หรือ `start.cmd` แทน หรือปิด cmd แล้วเปิดใหม่
>
> **ดึงโค้ดใหม่แล้วแต่หน้าเว็บไม่มี style / ยังเป็นหน้าเก่า?**
> 1. GitHub Desktop: ปุ่ม **Fetch origin** แค่เช็กว่ามีของใหม่ ต้องกด **Pull origin** ต่ออีกครั้งโค้ดถึงจะเข้าเครื่อง
> 2. ปิด dev server ตัวเก่าทุกหน้าต่าง (Ctrl+C) แล้วรัน `npm i` และ `npm run dev:fresh` (ล้าง cache `.next` แล้วเปิดใหม่)
> 3. ในเบราว์เซอร์กด **Ctrl+F5** เพื่อโหลดใหม่แบบไม่ใช้ cache
>
> **หน้าเว็บรีเฟรชเองรัวๆ ทุกครึ่งวินาที (ตอน `npm run dev`)?** มักเกิดจากรัน `npm run build` ทั้งที่ dev server ยังเปิดอยู่ ทั้งสองใช้โฟลเดอร์ `.next` เดียวกัน
> ให้ปิด dev server (Ctrl+C) แล้วรัน `npm run dev:fresh` และครั้งหน้าปิด dev ก่อนค่อย build
>
> **โปรเจกต์อยู่ใน OneDrive?** แนะนำย้ายออกมาไว้ที่อื่น เช่น `C:\Projects\JoinTix` เพราะ OneDrive จะ sync `node_modules` หลายหมื่นไฟล์ ทำให้ช้ามากและล็อกไฟล์จน `npm` พัง
>
> Windows: สคริปต์ติดตั้ง Node.js ด้วย `winget` ถ้าไม่มีหรือใช้ไม่ได้จะโหลดตัวติดตั้งจาก nodejs.org ให้เอง
> macOS: สคริปต์ใช้ `nvm` หรือ Homebrew ถ้าเครื่องไม่มีทั้งสองตัว ให้โหลดจาก https://nodejs.org

### ทางที่ 2: GitHub Codespaces (ไม่ต้องติดตั้งอะไรในเครื่อง)

เหมาะกับเครื่องที่ติดตั้งโปรแกรมไม่ได้ เช่นคอมมหาลัย ใช้งานผ่านเบราว์เซอร์อย่างเดียว

1. ตั้ง secret หนึ่งครั้ง: GitHub → Settings → Codespaces → **New secret** ชื่อ `DATABASE_URL` เลือก repo นี้
2. ที่หน้า repo กด **Code → Codespaces → Create codespace on main**
3. รอให้ติดตั้งเสร็จ (`npm ci` จะรันเอง และระบบจะสร้าง `.env.local` จาก secret ให้)
4. รัน `npm run dev` ใน Terminal พอร์ต 3000 จะถูกเปิดในเบราว์เซอร์ให้เอง

> Codespaces มีชั่วโมงใช้งานฟรีจำกัดต่อเดือน (บัญชีนักศึกษาผ่าน GitHub Education ได้โควตาเพิ่ม) ใช้เสร็จให้กด Stop codespace

### ทางที่ 3: ทำเองทีละขั้น (ถ้ามี Node.js 22+ อยู่แล้ว)

```bash
npm ci
```

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์ (ระดับเดียวกับ `package.json`) แล้วใส่:

```
DATABASE_URL='<connection string ของ Neon>'
BETTER_AUTH_SECRET='<สุ่มยาว 32 ไบต์ เช่นจาก openssl rand -base64 32>'
BETTER_AUTH_URL='http://localhost:3000'
# ไม่บังคับ: ส่งอีเมลลืมรหัสผ่านจริง (ไม่ใส่ = แสดงลิงก์ใน terminal แทน)
RESEND_API_KEY='re_...'
EMAIL_FROM='JoinTix <onboarding@resend.dev>'
```

> `.env.local` ถูก git ignore ไว้ จะไม่ขึ้น repo — อย่าเปลี่ยนชื่อไฟล์เป็นอย่างอื่น
> บน Windows ระวัง Notepad เติม `.txt` ต่อท้าย

จากนั้นรัน `npm run dev` แล้วเปิด http://localhost:3000/api/health

> ทุกคนใช้ DB ตัวเดียวกัน — **ห้ามรัน `db:push` / `db:migrate` หรือลบข้อมูลโดยไม่บอกกลุ่มก่อน**

### คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิด dev server |
| `npm run dev:fresh` | ล้าง cache `.next` แล้วเปิด dev server (ใช้เมื่อหน้าเว็บค้างของเก่า / style ไม่ขึ้น) |
| `npm run build` | build production (ต้องมี `.env.local` เพราะระบบ auth ต่อ DB ตอนโหลด) |
| `npm run lint` | ตรวจโค้ด |
| `npm run db:generate` | สร้างไฟล์ migration จาก `src/db/schema.ts` ลงโฟลเดอร์ `drizzle/` |
| `npm run db:migrate` | รัน migration กับ DB |
| `npm run db:push` | ดัน schema ขึ้น DB ตรงๆ (ใช้ตอนทดลองเท่านั้น) |
| `npm run db:studio` | เปิดหน้าเว็บดูข้อมูลใน DB |

---

## 5. โครงสร้างโปรเจกต์

```
src/
  app/
    api/health/route.ts   ← เช็กการเชื่อมต่อ DB
    layout.tsx            ← ฟอนต์, script กันจอกระพริบตอนโหลดธีม (ไม่มี Navbar แล้ว)
    not-found.tsx         ← หน้า 404 (มี Navbar ในตัว) + NotFoundMessage
    (site)/               ← route group หน้าฝั่งลูกค้าทั้งหมด (URL ไม่เปลี่ยน) layout.tsx ใส่ Navbar + footer
                            หน้าใหม่ฝั่งลูกค้าให้วางในนี้ ส่วน admin/ อยู่นอก group เพราะมีกรอบของตัวเอง
    (site)/page.tsx       ← หน้าแรก (hero + แบนเนอร์ + อีเวนต์แนะนำ)
    globals.css           ← ค่าสีธีมสว่าง/มืด + animation เมนู
    fonts.ts              ← Google Sans Flex + Noto Sans Thai
  components/
    navbar.tsx            ← แถบเมนูบน: sticky, เมนูมือถือ, ปุ่มค้นหา/ธีม/เข้าสู่ระบบ/สมัคร
    theme-toggle.tsx      ← ปุ่มสลับธีม (จำค่าใน cookie `theme`, ค่าเริ่มต้นธีมสว่าง)
    search-dialog.tsx     ← กล่องค้นหา → ไปที่ /events?q=...
    icon.tsx              ← ห่อ Hugeicons ให้เส้นบาง 1.5 เหมือนกันทั้งเว็บ
    hero-veil.tsx, dark-veil*.ts(x) ← พื้นหลัง WebGL (ogl) หลังหัวข้อหน้าแรก
    db-status.tsx         ← จุดเขียว/แดงบอกว่าต่อ DB ได้ไหม
    dot-matrix-loader.tsx ← ไอคอนจุดวงแหวนกระพริบ
    text-animate.tsx      ← ข้อความค่อยๆ ขึ้นทีละตัว/คำ (ตัดคำไทยถูกต้อง)
    ui/hint.tsx           ← tooltip แทน title ของเบราว์เซอร์
    banner-carousel.tsx   ← แบนเนอร์สไลด์ (Embla)
    section-header.tsx    ← หัวข้อของแต่ละส่วนในหน้าแรก (ไอคอน + ชื่อ + ปุ่มดูทั้งหมด)
    ticket-panel.tsx      ← กล่องเลือกโซน/จำนวนบัตรในหน้าอีเวนต์ (client)
    verify-email-code.tsx ← ยืนยันอีเมลด้วยรหัส 6 หลักในหน้าซื้อบัตร
    verify-email-link.tsx ← กล่องสถานะ + ส่งลิงก์ยืนยันอีเมลในหน้าโปรไฟล์
    event-gallery.tsx     ← รูปอีเวนต์ + รูปย่อ + ดูเต็มจอ (ยกจาก product-gallery ของ next.js-shop)
    share-row.tsx         ← ปุ่มแชร์ไปแอปต่างๆ
    event-card.tsx        ← การ์ดอีเวนต์ (ใช้ class .event-card / .btn-buy ใน globals.css)    site-footer.tsx       ← footer ทุกหน้า (ลิงก์อยู่ในตัวแปร GROUPS)
    text-hover-effect.tsx ← ชื่อเว็บตัวใหญ่ท้าย footer (แบบ Aceternity ทำเองด้วย SVG ไม่ใช้ library)
    skeletons.tsx         ← skeleton ของแต่ละหน้า/ส่วน (Hero, Banner, Events, AuthCard)
    ui/skeleton.tsx       ← Skeleton / SkeletonText / LoadingRegion
    ui/fade-image.tsx     ← รูปที่เฟดขึ้นเมื่อโหลดเสร็จ มี skeleton ระหว่างรอ
    admin/                ← หลังบ้าน (ยกแบบมาจาก next.js-shop): admin-shell.tsx กรอบ + เมนูข้าง/drawer,
                            admin-nav.ts รายการเมนู (หน้าใหม่เพิ่มลิงก์ที่นี่), ui.tsx PageHeader / StatCard / Panel / th td ฯลฯ,
                            dialog.tsx กล่อง <dialog>, form.tsx Notice/Choices/label, member-actions.tsx ปุ่ม+dialog แก้ไข/อุปกรณ์/ลบ สมาชิก,
                            event-form.tsx ฟอร์มสร้าง/แก้อีเวนต์ + โซนบัตร, event-actions.tsx ปุ่มต่อแถว + dialog ลบ,
                            event-delete-panel.tsx, event-status.ts ป้ายสถานะ,
                            date-time-field.tsx ช่องเลือกวัน+เวลาแบบปฏิทินของ 4TUNEZ (ใช้แทน input datetime-local),
                            poster-field.tsx ช่องอัปโหลดโปสเตอร์ (ลากวาง + ตัวอย่าง + เลือกจากรูปที่มี),
                            gallery-field.tsx รูปเพิ่มเติมหลายรูป (เพิ่มทีละหลายไฟล์ / เรียงลำดับ / ลบ),
                            map-pin-field.tsx หมุดแผนที่ (วางลิงก์/พิกัด + แผนที่ตัวอย่าง)
  lib/
    theme.ts              ← อ่าน/ตั้งค่าธีม
    banners.ts            ← รายการแบนเนอร์ (ตัวอย่าง รอดึงจาก DB) — รูปขนาด 5:2 เช่น 1500×600
    events.ts             ← อ่านอีเวนต์ให้หน้าเว็บ (cache tag "events") + saleStatus() — โปสเตอร์ขนาด 4:5 เช่น 800×1000
    event-fields.ts       ← type / ค่าคงที่ของอีเวนต์ที่ฝั่ง client import ได้ (ห้าม import lib/events.ts ใน "use client")
    admin-events.ts       ← อ่านอีเวนต์ทุกสถานะให้หลังบ้าน (ไม่ผ่าน cache)
    poster.ts, uuid.ts    ← เช็ก path โปสเตอร์ / สร้าง UUIDv7 ฝั่ง JS
    map.ts                ← อ่านพิกัดจากลิงก์ Google Maps + ลิงก์เปิดแผนที่/นำทาง/ฝัง (ไม่ต้องใช้ API key)
    uploads.ts            ← เก็บรูปที่อัปโหลด (sharp → WebP) ลง storage/uploads (หรือ UPLOAD_DIR) / ลบ / อ่าน
    shrink-image.ts       ← ย่อรูปในเบราว์เซอร์ก่อนส่ง
  app/uploads/[...path]/  ← เสิร์ฟรูปที่อัปโหลด (cache 1 ปี)
  db/
    index.ts              ← getDb() สร้าง connection ตอนเรียกใช้ครั้งแรก
    schema.ts             ← ตาราง Drizzle: ของ Better Auth + events, ticket_zones
  lib/
    auth.ts               ← ตั้งค่า Better Auth (ฝั่ง server)
    auth-client.ts        ← Better Auth ฝั่งเบราว์เซอร์ (navbar ใช้อ่าน session)
    session.ts            ← getSession() สำหรับ Server Component / safeNext() กัน ?next= พาออกนอกเว็บ
    mail.ts               ← ส่งอีเมลผ่าน Resend + แม่แบบอีเมล (รีเซ็ตรหัสผ่าน, ลิงก์/รหัสยืนยันอีเมล)
  app/
    actions/auth.ts       ← server actions: signIn, signUp, signOut (ข้อความ error ภาษาไทย)
    actions/admin.ts      ← server action ของหลังบ้าน: updateMember, memberSessions, signOutMember, deleteMember
    actions/admin-events.ts ← saveEvent (สร้าง/แก้ + โซน ใน db.batch เดียว), duplicateEvent, deleteEvent
    admin/                ← หลังบ้าน (layout เช็ก super admin, ภาพรวม / users / events)
    api/auth/[...all]/    ← endpoint ของ Better Auth
    (site)/events/[id]/   ← หน้าอีเวนต์ + เลือกซื้อบัตร
    (site)/profile/       ← ข้อมูลบัญชี + ยืนยันอีเมลด้วยลิงก์
    (site)/login/, register/ ← หน้าเข้าสู่ระบบ / สมัครสมาชิก
    (site)/forgot-password/, reset-password/ ← ขอลิงก์ลืมรหัสผ่าน / ตั้งรหัสใหม่
  components/
    auth/                 ← ฟอร์มล็อกอิน / สมัคร (สไตล์จาก next.js-shop)
    account-menu.tsx      ← เมนูบัญชีใน navbar + ปุ่มออกจากระบบ
drizzle.config.ts         ← อ่าน DATABASE_URL จาก .env.local
drizzle/                  ← ไฟล์ migration (จะถูกสร้างเมื่อรัน db:generate)
setup.cmd                 ← ดับเบิลคลิกติดตั้งบน Windows (เรียก scripts/setup.ps1)
start.cmd                 ← ดับเบิลคลิกเปิดแอปบน Windows (เรียก scripts/start.ps1)
scripts/setup.sh          ← สคริปต์ติดตั้งสำหรับ macOS / Linux
.devcontainer/            ← ตั้งค่า GitHub Codespaces
.nvmrc                    ← เวอร์ชัน Node.js ของโปรเจกต์ (22)
```

---

## 6. ข้อตกลงร่วมกัน (ต้องทำตาม)

### โค้ด
- เรียก DB ผ่าน `getDb()` จาก `@/db` เท่านั้น **อย่า** สร้าง connection เองที่อื่น
- โค้ดที่แตะ DB ต้องรันฝั่ง server เท่านั้น (Route Handler / Server Component / Server Action) — ห้าม import `@/db` ใน `"use client"`
- Next.js 16 ต่างจากเวอร์ชันเก่ามาก ก่อนเขียน API ใหม่ให้ดูเอกสารใน `node_modules/next/dist/docs/`
- Route ที่ต้องอ่านข้อมูลสดทุก request ให้เรียก `await connection()` จาก `next/server` (ดูตัวอย่างใน `src/app/api/health/route.ts`) เพราะโปรเจกต์เปิด Cache Components ไว้
- รัน `npm run lint` และ `npm run build` ให้ผ่านก่อน push

### ฐานข้อมูล
- แก้ schema ที่ `src/db/schema.ts` แล้วใช้ `db:generate` + `db:migrate` และ commit ไฟล์ใน `drizzle/` ด้วย
- เปลี่ยน schema ต้องคุยในกลุ่มก่อน เพราะใช้ DB ตัวเดียวกัน

### Git
- แตก branch ต่อ feature เช่น `feat/seat-lock`, `fix/order-timeout` แล้วเปิด PR เข้า `main`
- ห้าม push ตรงเข้า `main`

---

## 7. หลักการออกแบบที่ตกลงไว้แล้ว (ห้ามเปลี่ยนโดยไม่คุยกัน)

### กันตั๋วซ้ำแบบ 2 ชั้น
1. **Redis (ชั้นเร็ว)** — ตอนกดบัตรใช้ Lua script / atomic operation กั๊กที่นั่งไว้ **10 นาที** ถ้าเต็มให้ปฏิเสธทันทีโดยไม่แตะ DB
2. **Postgres (ด่านสุดท้าย)** — มี unique constraint กันที่นั่งเดียวกันถูกจองซ้ำ เช่น

   ```sql
   CREATE UNIQUE INDEX one_active_ticket_per_seat
     ON tickets (event_id, seat_id)
     WHERE status IN ('locked', 'booked');
   ```

### Flow คร่าวๆ
```
ผู้ใช้กดบัตร
  → Redis: rate limit / waiting room
  → Redis: ล็อกที่นั่ง 10 นาที
  → ผู้ใช้จ่ายเงิน
  → Postgres: บันทึก order + ticket ใน transaction
```

### สิ่งที่ควรมีตั้งแต่แรก
- สถานะตั๋ว: `available` → `locked` → `booked`
- **Idempotency key** บน order / payment (กันกดซ้ำ และกัน webhook การชำระเงินเข้ามาซ้ำ)
- Primary key ใช้ UUIDv7 หรือ ULID
- งานหลังจ่ายเงิน (ส่งอีเมล, สร้าง QR) ทำผ่าน outbox table ไม่ทำใน request หลัก

---

## 8. งานถัดไป (ยังไม่มีใครรับ)

1. ออกแบบ schema: Seats, Tickets, Orders, Payments ← **ทำก่อน** (Users มีแล้วจาก Better Auth, Events + ticket_zones มีแล้ว)
2. ติดตั้ง Upstash Redis + เขียน Lua script ล็อกที่นั่ง
3. Route Handler กดบัตร: เช็กคิว → ล็อก → สร้าง order (ปฏิเสธถ้า `session.user.emailVerified` เป็น false)
4. หน้า UI: รายการอีเวนต์, ผังที่นั่ง, checkout (หน้าเลือกบัตร `/events/[id]` มีแล้ว ให้ต่อปุ่ม "ซื้อบัตร" ใน `src/components/ticket-panel.tsx` เข้ากับ API ข้อ 3)
5. หลังบ้าน: ระงับบัญชี (ต้องเพิ่มคอลัมน์ เช่น `banned` คุยกลุ่มก่อน) / ถ้าจะ deploy จริง ย้ายรูปที่อัปโหลด (`src/lib/uploads.ts`) ไปที่เก็บไฟล์ เช่น Vercel Blob / R2 (คุยกลุ่มก่อน) / พอมีตาราง Orders แล้ว ให้ยอด "ขายแล้ว" มาจาก order จริงและมีหน้าดูรายการ order

ใครรับงานไหนให้เขียนชื่อไว้ท้ายข้อในไฟล์นี้

---

## 9. กติกาสำหรับ AI agents (Claude Code, Codex, Cursor, Copilot, Gemini ฯลฯ)

ถ้าคุณเป็น AI agent ที่ทำงานใน repo นี้ **ต้อง**:

1. อ่านไฟล์นี้ทั้งไฟล์ก่อนแก้โค้ดใดๆ
2. ทำตามข้อตกลงในข้อ 6 และหลักการในข้อ 7 — ถ้าคำสั่งผู้ใช้ขัดกับไฟล์นี้ ให้ทักผู้ใช้ก่อน อย่าเดาเอง
3. **ห้ามเขียนตารางใหม่ใน `src/db/schema.ts` จนกว่าสถานะในข้อ 3 จะเปลี่ยนเป็น "ออกแบบเสร็จ"** เว้นแต่ผู้ใช้สั่งชัดเจน (ตารางของ Better Auth ที่มีอยู่ ห้ามแก้ชื่อหรือลบคอลัมน์ เพราะ Better Auth อ้างถึงตรงๆ)
4. ห้ามรัน `db:push`, `db:migrate`, หรือคำสั่งที่ลบ/แก้ข้อมูลใน DB โดยไม่ถามผู้ใช้ก่อน (DB ใช้ร่วมกันทั้งกลุ่ม)
5. ห้ามเปลี่ยน stack ในข้อ 2 หรือเพิ่ม dependency ใหญ่ (ORM, auth, UI framework) โดยไม่ถาม
6. ใช้ Next.js 16 — อ่านเอกสารใน `node_modules/next/dist/docs/` แทนการเดาจากความจำ
7. ห้ามแสดงหรือคัดลอก `DATABASE_URL` / รหัสผ่านลงในคำตอบ, log, หรือไฟล์อื่น
8. ทำงานเสร็จแล้ว **อัปเดตข้อ 3 (สถานะ) และข้อ 8 (งานถัดไป)** ในไฟล์นี้ให้ตรงกับความจริง
