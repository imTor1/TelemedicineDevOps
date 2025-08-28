## 1) ติดตั้ง Dependencies (ทำครั้งแรก หรือเวลาเปลี่ยน package.json)

```bash
# ที่โฟลเดอร์ root ของโปรเจกต์
npm i

# ติดตั้งของ frontend
npm i --prefix telemed-web

# หรือจะยิงรวดเดียวก็ได้
npm i && npm i --prefix telemed-web


2) Run โหมด Dev / Prod
2.1 รันเฉพาะ Backend
# Dev (watch ด้วย nodemon)
npm run dev
# Production
npm start

2.2 รันเฉพาะ Frontend
# จาก root ใช้สคริปต์ที่เตรียมไว้
npm run dev:web
# หรือเข้าไปที่โฟลเดอร์ frontend แล้วรันตรง ๆ
cd telemed-web && npm run dev

2.3 รันทั้ง Backend + Frontend พร้อมกัน
npm run dev:both



3) สร้างไฟล์ .env
# .env (put in project root)
NODE_ENV=development
PORT=4005

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=1234
DB_NAME=telemedicinedb

JWT_SECRET=few878f3hfh892f3 #สุ่มเปลี่ยนเอาได้ตามใจชอบ

# ถ้าใช้ Redis (optional)
REDIS_URL=redis://localhost:6379



4) ติดตั้งฐานข้อมูล (MySQL)
telemedicinedb_MethapornANT.sql


5) ทดสอบได้ด้วย Postman
telemedicine.postman_collection.json