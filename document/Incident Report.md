Incident Report


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
Time Detected
Description
Root Cause
Resolution
Preventive Actions
 