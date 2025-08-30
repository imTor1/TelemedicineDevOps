## Summary Report

## ภาพรวม (Executive Summary)
## CI/CD: Pipeline 
สามารถ Build → Push ไปยัง GitHub Container Registry รวม 4 ครั้ง

Deployment: สามารถ Deploy ไปยังเซิร์ฟเวอร์จริงได้ 1 ครั้ง แต่ติดข้อจำกัดทรัพยากรของเครื่อง Cloud (RAM/CPU ต่ำ) ทำให้เกิด Full load และรีบูตตัวเองเมื่อรัน web + server + db พร้อมกัน

Monitoring: ติดตั้ง Prometheus + Grafana เพื่อเก็บ/แสดงผล CPU, Load และ Exporter ที่เกี่ยวข้อง node_exporter, mysqld_exporter

Health: ตรวจสอบปลายทาง GET /api/health ของ service หลักได้ผล HTTP 200 + { ok: true } ในสภาวะระบบปกติ


## สิ่งที่สำเร็จแล้ว:
Build image ด้วย Dockerfile และ Push ไป GHCR ได้สม่ำเสมอ 
Workflow แยกขั้นตอน CI (lint/test/build) และ Docker push ชัดเจน


## ความเสถียรของระบบ (Health / Load Testing)
Prometheus เก็บ time series, Grafana แสดง Dashboard (CPU > 80%, load avg, container restarts)


## ความเสี่ยงที่ควรแก้ไข
ย้าย config/secrets ไป .env + GitHub Secrets, ลบบางค่าออกจาก compose
Resource Constraints – เครื่อง Cloud สเปคต่ำเกิดการ Full load ควรอัปเกรดสเปคหรือแยกบริการ
ควรแยก folder จัดเก็บข้อมูลให้ชัดเจนแยกเป็น back-front-db 


## ข้อเสนอแนะ
* ถ้าต้องการที่จะใช้ could ต่ออัพเกรดเป็นตัวที่สเปคสูงกว่าเพื่อรองรับ
* ควรเพิ่มแจ้งเตือน Alert Rule ให้ครอบครุมมากยิ่งขึ้น