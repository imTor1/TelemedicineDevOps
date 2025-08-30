## Incident Report

📌 Incident ID : INC-20250830-1
Time Detected: 2025-08-30 เวลา 06:30
Description
*   ไม่สามารถ Deploy ไปยัง server AWS EC2 t3.micro ได้ เนื่องจาก RAM 1GB น้อยเกินไป 
    ทำให้เครื่อง server ค้างและ Docker ไม่สามารถรัน container stack ได้ครบ 
    ส่งผลให้ service หลัก web, server, db ล่มทั้งหมด
    
Root Cause
* EC2 instance ใช้ t3.micro 1 vCPU, 1 GB RAM ซึ่งไม่เพียงพอสำหรับ stack ที่ประกอบด้วย
* MySQL 8.0 ต้องการ memory สูง
* Node.js server
* Nginx + Exporters + Prometheus + Grafana

Resolution
* พยายามลองรีสตาร์ท EC2 instance

Preventive Actions
* อัพเกรด instance เป็นตัวที่สเปคสูงกว่า



📌 Incident ID : INC-20250830-2
Time Detected 2025-08-30 เวลา 1:30
Description
* server กับ db ไม่สามารถเชื่อมต่อกันได้ เนื่องจาก config database ใน Github Repository secrets ไม่ถูกต้อง

Root Cause
* กำหนด config ในไฟล์ compose ให้ถูกต้อง 
* Config ข้อมูลสำหรับ Dababase ใน Github Repository secrets
 *เพิ่ม .env ระบุคีย์ทั้งหมดที่ต้องใช้ และใช้ชื่อเดียวกันทั้งโค้ด/compose

Resolution
* แก้ไฟล์ compose ให้แมป ENV ถูกต้อง และเพิ่ม healthcheck และลอง test build ในเครื่อง localhost
* ลอง deploy ใหม่: docker compose -f docker-compose.dev.yml down && docker docker compose -f docker-compose.dev.yml up -d  

Preventive Actions
* เพิ่ม .env ระบุคีย์ทั้งหมดที่ต้องใช้ และใช้ชื่อเดียวกันทั้งโค้ด/compose