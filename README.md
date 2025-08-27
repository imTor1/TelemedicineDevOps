# Telemedicine Platform — Quickstart

ระบบตัวอย่าง Telemedicine: Backend (Express/Node.js) + MySQL + Frontend (React/Vite) พร้อม Swagger และ Postman

---

## Requirements
- Node.js 18+
- MySQL 8+
- (Optional) Redis สำหรับ IP block

---

## 0) เตรียมฐานข้อมูล (ต้องทำก่อนรันระบบ)
นำไฟล์ `telemedicinedb_MethapornANT.sql` ไปติดตั้งให้เรียบร้อย

```bash
# สร้างฐานข้อมูล
mysql -u root -p -e "CREATE DATABASE telemedicinedb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# นำเข้า schema + seed
mysql -u root -p telemedicinedb < telemedicinedb_MethapornANT.sql
