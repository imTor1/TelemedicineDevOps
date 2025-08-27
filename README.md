# Telemedicine Platform

ระบบตัวอย่าง Telemedicine — Backend (Express/Node.js) + MySQL + Frontend (React / Vite)  
รวม Swagger (API docs), Postman collection และ SQL seed

---

## โครงสร้างโปรเจกต์
.
├─ server.js
├─ telemed-web/
│ ├─ package.json
│ └─ src/
├─ telemedicine.postman_collection.json
├─ telemedicinedb_MethapornANT.sql
├─ package.json
└─ .env (ต้องสร้าง)

yaml
Copy code

---

## ความต้องการระบบ
- Node.js 18+
- MySQL 8+
- (Optional) Redis หากต้องการใช้ IP block (`REDIS_URL`)

---

## การติดตั้งฐานข้อมูล
1. สร้างฐานข้อมูล
```sql
CREATE DATABASE telemedicinedb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
นำเข้า schema + seed

bash
Copy code
mysql -u root -p telemedicinedb < telemedicinedb_MethapornANT.sql
ตัวอย่างไฟล์ .env (วางที่รากโปรเจกต์)
env
Copy code
PORT=4005
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=1234
DB_NAME=telemedicinedb
JWT_SECRET=change-me-very-secret
# REDIS_URL=redis://localhost:6379
ติดตั้ง dependencies
Backend (รากโปรเจกต์)
bash
Copy code
npm install
Frontend
bash
Copy code
cd telemed-web
npm install
cd ..
รันระบบ (development)
รันแยก (สองหน้าต่าง)
bash
Copy code
# Terminal A: backend
npm run dev

# Terminal B: frontend
cd telemed-web
npm run dev
รันพร้อมกัน (หนึ่งคำสั่ง)
ติดตั้งเครื่องมือเสริม (หากยังไม่มี)

bash
Copy code
npm install -D concurrently nodemon
เพิ่มสคริปต์ใน package.json (รากโปรเจกต์)

json
Copy code
"scripts": {
  "dev:api": "nodemon server.js",
  "dev:web": "npm run dev --prefix telemed-web",
  "dev:all": "concurrently -n api,web -c auto \"npm:dev:api\" \"npm:dev:web\""
}
รัน

bash
Copy code
npm run dev:all
API Documentation (Swagger)
Swagger UI: http://localhost:4005/docs

Swagger JSON: http://localhost:4005/docs.json

Authentication
JWT Bearer token

Header: Authorization: Bearer <token>

Roles: admin, doctor, patient

Error format:

json
Copy code
{
  "error": {
    "code": "SOME_CODE",
    "message": "ข้อความ",
    "details": [ { "field": "xxx", "message": "..." } ] // optional
  }
}
Postman — ใช้งานอย่างรวดเร็ว
Import telemedicine.postman_collection.json เข้า Postman

สร้าง Environment / Collection variables ตั้งค่า:

baseUrl = http://localhost:4005

(Optional) doctorEmail, doctorPassword, patientEmail, patientPassword

ยิง Auth › Login doctor (success) และเก็บ token/id จาก response โดยใส่โค้ดในแท็บ Tests ดังนี้:

js
Copy code
pm.test("login ok", function () {
  pm.response.to.have.status(200);
  const j = pm.response.json();
  pm.expect(j).to.have.property("token");
  pm.expect(j.user).to.have.property("id");
});
const j = pm.response.json();
pm.collectionVariables.set("doctorToken", String(j.token).trim());
pm.collectionVariables.set("doctorId", String(j.user.id).trim());
pm.environment.set("doctorToken", String(j.token).trim());
pm.environment.set("doctorId", String(j.user.id).trim());
สำหรับ request ที่ต้องใช้สิทธิ์:

Header: Authorization: Bearer {{doctorToken}}

Path param ต้องตรงกับ {{doctorId}} (ไม่เช่นนั้นจะได้ 403)

Endpoints สำคัญ (สรุป)
POST /auth/register — สมัครสมาชิก (doctor ต้องส่ง specialties)

POST /auth/login — รับ JWT

GET /users/me — ดูโปรไฟล์

PUT /users/me — แก้โปรไฟล์

GET /specialties — ดึงรายการสาขา

GET /doctors — ค้นหาแพทย์ (?q=, ?specialty= รองรับ id|uuid|name)

POST /doctors/:id/slots — หมอสร้าง slot (เฉพาะ owner)

GET /doctors/:id/slots — ดู slot แบบ daily virtual

POST /appointments — คนไข้จอง (ต้องส่ง slot_id + chosen_date)

PATCH /appointments/:id/status — หมอเปลี่ยนสถานะ (confirm/reject/cancel)

GET /appointments/me — ดูนัดของตนเอง

GET /reports/appointments[?date=YYYY-MM-DD][&doctor_id=...] — รายงาน

admin: ดูทั้งระบบ หรือ zoom-in ด้วย doctor_id

doctor: ดูเฉพาะของตนเอง

Frontend (telemed-web)
Tech: React + Vite + MUI

ตั้งค่า base API URL ใน telemed-web/src/lib/api.js ให้ชี้ http://localhost:4005

รัน dev: cd telemed-web && npm run dev

การตรวจสอบปัญหา (Troubleshooting)
401 "กรุณาเข้าสู่ระบบก่อน" — ไม่มี header หรือ token ส่งมาไม่ถูกต้อง / หมดอายุ

401 "โทเค็นไม่ถูกต้องหรือหมดอายุ" — token invalid หรือ expired

403 "ไม่สามารถจัดการเวลาให้ผู้อื่นได้" — :id ใน path ไม่ตรงกับ sub ใน token

429 ที่ /auth/login — เกิน limit การลองผิด (ระบบล็อกชั่วคราว / block IP)

ค้นหมอแล้วได้ [] — ตรวจ doctor_specialties และพารามิเตอร์ที่ส่ง

Deployment notes (สรุป)
ใช้ NODE_ENV=production และ npm run start สำหรับ production

แนะนำเปิด Redis สำหรับ IP block ใน production

ตั้ง reverse proxy (Nginx) และ TLS

จัด CI/CD และ DB migrations

License
MIT