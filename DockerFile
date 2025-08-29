#Dockerfile
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./

# ติดตั้ง dependencies แบบ reproducible
RUN npm ci --only=production

COPY . .

# สร้าง user ไม่ใช่ root และโอนสิทธิ์ให้เขียน/อ่านได้
RUN addgroup -S app && adduser -S app -G app \
  && chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV PORT=4005

# เปิดพอร์ตให้ตรงกับที่ใช้จริง
EXPOSE 4005

# เพิ่ม health endpoint ในแอป /healthz
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4005/healthz || exit 1

CMD ["node", "server.js"]
