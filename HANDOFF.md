# JoinTix — Project Handoff

> **อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง** ทั้งคนและ AI agent
> ถ้าแก้อะไรที่กระทบเนื้อหาในไฟล์นี้ (stack, โครงสร้าง, สถานะ, ข้อตกลง) ให้อัปเดตไฟล์นี้ใน commit เดียวกัน

อัปเดตล่าสุด: 2026-10-24

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
| ออกแบบ DB schema | ⏳ **กำลังออกแบบ — ยังไม่ต้องเขียนตาราง** |
| Upstash Redis (lock / rate limit / queue) | ⏳ ยังไม่เริ่ม |
| API กดบัตร / สร้าง order | ⏳ ยังไม่เริ่ม |
| ระบบชำระเงิน | ⏳ ยังไม่เริ่ม |
| UI | ⏳ ยังเป็นหน้า default ของ Next.js |

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
```

> `.env.local` ถูก git ignore ไว้ จะไม่ขึ้น repo — อย่าเปลี่ยนชื่อไฟล์เป็นอย่างอื่น
> บน Windows ระวัง Notepad เติม `.txt` ต่อท้าย

จากนั้นรัน `npm run dev` แล้วเปิด http://localhost:3000/api/health

> ทุกคนใช้ DB ตัวเดียวกัน — **ห้ามรัน `db:push` / `db:migrate` หรือลบข้อมูลโดยไม่บอกกลุ่มก่อน**

### คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิด dev server |
| `npm run build` | build production (ไม่ต้องมี `DATABASE_URL` ก็ build ได้) |
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
    layout.tsx, page.tsx  ← ยังเป็นของ default
  db/
    index.ts              ← getDb() สร้าง connection ตอนเรียกใช้ครั้งแรก
    schema.ts             ← ตาราง Drizzle (ยังว่าง รอออกแบบ)
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

1. ออกแบบ schema: Users, Events, Seats, Tickets, Orders, Payments ← **ทำก่อน**
2. ติดตั้ง Upstash Redis + เขียน Lua script ล็อกที่นั่ง
3. Route Handler กดบัตร: เช็กคิว → ล็อก → สร้าง order
4. หน้า UI: รายการอีเวนต์, ผังที่นั่ง, checkout

ใครรับงานไหนให้เขียนชื่อไว้ท้ายข้อในไฟล์นี้

---

## 9. กติกาสำหรับ AI agents (Claude Code, Codex, Cursor, Copilot, Gemini ฯลฯ)

ถ้าคุณเป็น AI agent ที่ทำงานใน repo นี้ **ต้อง**:

1. อ่านไฟล์นี้ทั้งไฟล์ก่อนแก้โค้ดใดๆ
2. ทำตามข้อตกลงในข้อ 6 และหลักการในข้อ 7 — ถ้าคำสั่งผู้ใช้ขัดกับไฟล์นี้ ให้ทักผู้ใช้ก่อน อย่าเดาเอง
3. **ห้ามเขียนตารางใน `src/db/schema.ts` จนกว่าสถานะในข้อ 3 จะเปลี่ยนเป็น "ออกแบบเสร็จ"** เว้นแต่ผู้ใช้สั่งชัดเจน
4. ห้ามรัน `db:push`, `db:migrate`, หรือคำสั่งที่ลบ/แก้ข้อมูลใน DB โดยไม่ถามผู้ใช้ก่อน (DB ใช้ร่วมกันทั้งกลุ่ม)
5. ห้ามเปลี่ยน stack ในข้อ 2 หรือเพิ่ม dependency ใหญ่ (ORM, auth, UI framework) โดยไม่ถาม
6. ใช้ Next.js 16 — อ่านเอกสารใน `node_modules/next/dist/docs/` แทนการเดาจากความจำ
7. ห้ามแสดงหรือคัดลอก `DATABASE_URL` / รหัสผ่านลงในคำตอบ, log, หรือไฟล์อื่น
8. ทำงานเสร็จแล้ว **อัปเดตข้อ 3 (สถานะ) และข้อ 8 (งานถัดไป)** ในไฟล์นี้ให้ตรงกับความจริง
