# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app

# แยก layer สำหรับ dependency ให้ cache ง่าย
COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:4005
ENV VITE_API_URL=$VITE_API_URL

# build ออกมาเป็น /app/dist
RUN npm run build

# ----- Runtime (serve ด้วย nginx) -----
FROM nginx:1.25-alpine AS runner

# config nginx (มี proxy /api และ SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# คัดลอกไฟล์ static ที่ build แล้ว
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx","-g","daemon off;"]
