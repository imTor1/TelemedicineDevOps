## Infrastructure & Deployment Plan


## สถาปัตยกรรมระบบ
Stack: React (Vite) + Node/Express + MySQL 8 + Prometheus + Grafana
Runtime: Docker + Docker Compose
IaC: Terraform (ส่วน  Database)
Services
	web (Nginx, proxy /api → server:4005)
	server (REST API, /api/health)
	db (MySQL)
	node_exporter, mysqld_exporter, prometheus, grafana


## CI/CD Pipeline Flow
CI: GitHub Actions → checkout → npm ci/test/build (server & web)
Build/Push: Docker compose สร้าง image
Deploy: SSH ไปเครื่องปลายทาง → docker compose pull && up -d → health check API
Secrets: เก็บใน GitHub Secrets (Database SSH)


## Environments
Dev (local): docker-compose.dev.yml
Prod: docker-compose.prod.yml
แยกไฟล์ compose/ENV, แยกฐานข้อมูล, เปิดพอร์ตเท่าที่จำเป็น


## Monitoring
prometheus + Grafana ใช้เก็บค่าและแสดงสถานะ
node_exporter: CPU, Disk, Load
mysqld_exporter: mysql_up, connections, uptime, buffer pool, threads