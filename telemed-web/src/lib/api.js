// src/lib/api.js
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4005";

const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 10000, // ป้องกัน request แขวน
});

// attach token
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        // มั่นใจว่า headers มีอยู่ก่อนแล้ว
        config.headers = config.headers || {};
        config.headers.Authorization = "Bearer " + token;
      }
    } catch (e) {
      // ignore
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// central response handler: normalize backend error shape and handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const resp = err?.response;
    if (resp) {
      // ถ้า token หมดอายุ ให้เคลียร์แล้วบังคับไปหน้า login
      if (resp.status === 401) {
        try {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          // replace เพื่อไม่ให้ user กด back แล้วกลับมาที่ state เก่า
          window.location.replace("/login");
        } catch (e) {
          // ignore
        }
      }
      // normalize error message
      const payload = resp.data;
      const message =
        payload?.error?.message ||
        payload?.message ||
        (typeof payload === "string" ? payload : "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");

      // ส่ง object ที่มีข้อมูลพอใช้งาน
      return Promise.reject({
        status: resp.status,
        message,
        payload,
      });
    }
    // network or other error
    return Promise.reject({ status: 0, message: err.message || "Network error", raw: err });
  }
);

export default api;
