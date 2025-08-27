// server.js
/**
 * Telemedicine Backend (single-file)
 * - Security: helmet, cors, rate-limit
 * - Validation: zod -> message ภาษาไทย
 * - Error format เดียวทั้งระบบ
 *
 * NOTE: ตั้ง env vars ก่อนรัน (PORT, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET)
 */

///////////////////////////////
// 1) IMPORTS
///////////////////////////////
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import Redis from "ioredis";

///////////////////////////////
// 2) CONFIG / ENV
///////////////////////////////
const env = {
  PORT: process.env.PORT || 4005,
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "1234",
  DB_NAME: process.env.DB_NAME || "telemedicinedb",
  JWT_SECRET: process.env.JWT_SECRET || "change-me-very-secret",
  REDIS_URL: process.env.REDIS_URL || "",      // optional
};

///////////////////////////////
// 3) DB POOL
///////////////////////////////
const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
});

///////////////////////////////
// 4) EXPRESS APP + MIDDLEWARE
///////////////////////////////
const app = express();
app.set("trust proxy", false); // ปิดใน dev/ทดสอบ (ป้องกัน warning ของ express-rate-limit)
app.use(express.json());
app.use(helmet());
app.use(
  cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] })
);

// global rate-limit (ทั้งหมด)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message:
            "ขออภัย มีการเรียกใช้งานบ่อยเกินไป กรุณาลองใหม่อีกครั้งภายหลัง",
        },
      });
    },
  })
);

// login endpoint rate-limit (ต่อ IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 6, // อนุญาต 6 ครั้ง/หน้าต่างเวลา
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "ลองเข้าสู่ระบบมากเกินไป กรุณารอแล้วลองใหม่อีกครั้ง",
    },
  },
});

// (debug) ดู IP ที่ระบบเห็น
// app.use((req, _res, next) => {
//   console.log("[CLIENT IP]", req.ip, "xff:", req.headers["x-forwarded-for"]);
//   next();
// });

///////////////////////////////
// 5) REDIS & IP-BLOCK HELPERS
///////////////////////////////
let redisClient = null;
const useRedis = !!env.REDIS_URL;
if (useRedis) {
  redisClient = new Redis(env.REDIS_URL);
  redisClient.on("error", (e) => console.error("Redis error:", e));
}

// fallback in-memory (หายเมื่อรีสตาร์ท)
const ipBlocks = new Map(); // ip -> untilTs

async function blockIp(ip, seconds) {
  if (!ip) return;
  if (useRedis && redisClient) {
    await redisClient.setex(`ipblock:${ip}`, seconds, "1");
  } else {
    ipBlocks.set(ip, Date.now() + seconds * 1000);
  }
}
async function isIpBlocked(ip) {
  if (!ip) return false;
  if (useRedis && redisClient) {
    const v = await redisClient.get(`ipblock:${ip}`);
    return !!v;
  } else {
    const until = ipBlocks.get(ip);
    if (!until) return false;
    if (Date.now() > until) {
      ipBlocks.delete(ip);
      return false;
    }
    return true;
  }
}
async function unblockIp(ip) {
  if (!ip) return;
  if (useRedis && redisClient) {
    await redisClient.del(`ipblock:${ip}`);
  } else {
    ipBlocks.delete(ip);
  }
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

// escalation: ครั้งที่ถูกล็อก (0-based) → ระยะเวลา (วินาที)
function getLockDurationSeconds(lockCount) {
  if (lockCount <= 0) return 30 * 60;
  if (lockCount === 1) return 60 * 60;
  if (lockCount === 2) return 90 * 60;
  if (lockCount === 3) return 120 * 60;
  return 24 * 60 * 60;
}

///////////////////////////////
// 6) GENERIC HELPERS
///////////////////////////////
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function formatZod(err) {
  return (
    err.issues?.map((i) => ({
      field: i.path?.join(".") || "",
      message: i.message,
    })) || []
  );
}
function respondValidation(res, err) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง",
      details: formatZod(err),
    },
  });
}

function requireAuth(roles = []) {
  return (req, res, next) => {
    try {
      const hdr = req.headers.authorization || "";
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
      if (!token) {
        return res
          .status(401)
          .json({ error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบก่อน" } });
      }
      const payload = verifyJwt(token); // may throw
      if (roles.length && !roles.includes(payload.role)) {
        return res
          .status(403)
          .json({ error: { code: "FORBIDDEN", message: "ไม่มีสิทธิ์เข้าถึงทรัพยากรนี้" } });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "โทเค็นไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่",
        },
      });
    }
  };
}

///////////////////////////////
// 7) UTILS (ID / TIME / PASSWORD / JWT)
///////////////////////////////
function genId(kind) {
  const prefixMap = { doctor: "D", patient: "P", slot: "S", appt: "A", spec: "SP" };
  const p = prefixMap[kind] || "X";
  const ts = Date.now().toString();
  let rand = "";
  while (p.length + ts.length + rand.length < 36) rand += Math.floor(Math.random() * 10);
  return (p + ts + rand).slice(0, 36);
}

function looksLikeId(s) {
  return typeof s === "string" && s.length === 36;
}


// === Helpers for date-only slots (daily model) ===
function isDateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function atStartOfDay(dateStr/* YYYY-MM-DD */) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d;
}
function atEndOfDay(dateStr/* YYYY-MM-DD */) {
  const d = new Date(`${dateStr}T23:59:59`);
  return d;
}
function enumerateDailyFromSlot(startIso, endIso) {
  const d0 = new Date(startIso); d0.setHours(0,0,0,0);
  const d1 = new Date(endIso);   d1.setHours(0,0,0,0);
  const out = [];
  for (let d = new Date(d0); d.getTime() <= d1.getTime(); d.setDate(d.getDate()+1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    out.push(`${y}-${m}-${dd}`);
  }
  return out;
}


function toSqlDatetime(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) {
    const e = new Error("รูปแบบเวลาไม่ถูกต้อง");
    e.statusCode = 400;
    e.code = "INVALID_DATETIME";
    throw e;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$1$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [algo, _v, salt, hash] = stored.split("$");
    if (algo !== "scrypt") return false;
    const verify = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verify, "hex"));
  } catch {
    return false;
  }
}

function issueJwt(payload, expiresIn = "2h") {
  // ตั้งค่า default = 2 ชั่วโมง
  return jwt.sign(payload, env.JWT_SECRET, { algorithm: "HS256", expiresIn });
}
function verifyJwt(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
}

///////////////////////////////
// 8) BUSINESS / DB FUNCTIONS
//    (Prepared statements only)
///////////////////////////////
export async function registerUser({ role, full_name, email, phone, password, specialties }) {
  const id = genId(role === "doctor" ? "doctor" : "patient");
  const password_hash = hashPassword(password);
  const sql =
    "INSERT INTO users (id, role, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?)";
  try {
    // insert user
    await pool.query(sql, [id, role, full_name, email, phone || null, password_hash]);

    // ถ้าเป็น doctor และมี specialties ให้ insert ลง doctor_specialties
    if (role === "doctor" && Array.isArray(specialties) && specialties.length) {
      // จะทำ bulk insert รูปแบบ [(doctor_id, spec_id), ...]
      const values = specialties.map((sid) => [id, sid]);
      // ป้องกันกรณี duplicate: ใช้ INSERT IGNORE เพื่อไม่ให้โยน error ถ้า mapping มีอยู่แล้ว
      // แต่ mysql2 .query รองรับ ? แบบ array-of-arrays
      const insertSql = "INSERT IGNORE INTO doctor_specialties (doctor_id, specialty_id) VALUES ?";
      await pool.query(insertSql, [values]);
    }

    return { id, role, full_name, email, phone: phone || null, specialties: specialties || [] };
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      const e = new Error("อีเมลหรือเบอร์โทรนี้ถูกใช้ไปแล้ว");
      e.statusCode = 409;
      e.code = "DUPLICATE";
      throw e;
    }
    throw err;
  }
}

export async function listAllSpecialties() {
  const [rows] = await pool.query(
    "SELECT id, name FROM specialties ORDER BY name ASC"
  );
  return rows;
}

export async function setDoctorSpecialties(doctorId, specialtyIds = []) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ตรวจสอบว่า doctorId เป็นหมอจริง
    const [users] = await conn.query("SELECT role FROM users WHERE id = ?", [doctorId]);
    if (!users[0]) {
      const e = new Error("ไม่พบผู้ใช้");
      e.statusCode = 404; e.code = "USER_NOT_FOUND";
      throw e;
    }
    if (users[0].role !== "doctor") {
      const e = new Error("อัปเดตสาขาได้เฉพาะผู้ใช้ที่เป็นหมอ");
      e.statusCode = 403; e.code = "FORBIDDEN";
      throw e;
    }

    // เคลียร์ของเดิมก่อน
    await conn.query("DELETE FROM doctor_specialties WHERE doctor_id = ?", [doctorId]);

    // ว่างก็จบได้เลย
    if (!specialtyIds.length) {
      await conn.commit();
      return [];
    }

    // ตรวจสอบว่า id ที่ส่งมามีอยู่จริงใน specialties
    const placeholders = specialtyIds.map(() => "?").join(",");
    const [exists] = await conn.query(
      `SELECT id FROM specialties WHERE id IN (${placeholders})`,
      specialtyIds
    );
    if (exists.length !== specialtyIds.length) {
      const e = new Error("มี specialty_id บางรายการไม่ถูกต้อง");
      e.statusCode = 400; e.code = "INVALID_SPECIALTY_ID";
      throw e;
    }

    // ใส่ใหม่ทั้งหมดแบบ bulk
    const values = specialtyIds.map(sid => [doctorId, sid]);
    const bulkPlaceholders = values.map(() => "(?, ?)").join(",");
    await conn.query(
      `INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ${bulkPlaceholders}`,
      values.flat()
    );

    await conn.commit();
    return specialtyIds;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// เก็บไว้ให้เรียกใช้ที่อื่นได้ ถ้าอยากใช้แบบเดิม (ไม่ใช่ตัว escalated logic)
// ใน route /auth/login เราจะใช้ logic แบบ escalated + IP block ด้านล่าง
export async function loginUser(email, password) {
  const e = (email || "").trim().toLowerCase();
  const [rows] = await pool.query(
    "SELECT id, role, full_name, email, phone, password_hash, failed_login_attempts, locked_until FROM users WHERE email = ? LIMIT 1",
    [e]
  );
  const u = rows[0];

  const invalid = () => {
    const err = new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    return err;
  };

  if (!u) throw invalid();

  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    const mLeft = Math.ceil((new Date(u.locked_until) - new Date()) / 60000);
    const err = new Error(`บัญชีถูกล็อกชั่วคราว ลองอีกครั้งใน ${mLeft} นาที`);
    err.statusCode = 423;
    err.code = "ACCOUNT_LOCKED";
    throw err;
  }

  const ok = verifyPassword(password, u.password_hash);
  if (!ok) {
    const newFailed = (u.failed_login_attempts || 0) + 1;
    if (newFailed >= 5) {
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
      await pool.query(
        "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
        [newFailed, lockUntil, u.id]
      );
      const err = new Error(`พยายามเข้าสู่ระบบผิดหลายครั้ง บัญชีถูกล็อก 30 นาที`);
      err.statusCode = 423;
      err.code = "ACCOUNT_LOCKED";
      throw err;
    } else {
      await pool.query("UPDATE users SET failed_login_attempts = ? WHERE id = ?", [
        newFailed,
        u.id,
      ]);
      throw invalid();
    }
  }

  // success
  await pool.query(
    "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
    [u.id]
  );
  const token = issueJwt({ sub: u.id, role: u.role }); // 2h
  return {
    token,
    user: { id: u.id, role: u.role, full_name: u.full_name, email: u.email, phone: u.phone },
  };
}

export async function getUserProfile(userId) {
  const [rows] = await pool.query(
    "SELECT id, role, full_name, email, phone, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  if (!rows[0]) {
    const e = new Error("ไม่พบผู้ใช้");
    e.statusCode = 404;
    e.code = "NOT_FOUND";
    throw e;
  }
  return rows[0];
}

export async function updateUserProfile(userId, patch) {
  const fields = [];
  const params = [];

  if (typeof patch.full_name === "string" && patch.full_name.length) {
    fields.push("full_name = ?");
    params.push(patch.full_name);
  }
  if (typeof patch.phone !== "undefined") {
    fields.push("phone = ?");
    params.push(patch.phone || null);
  }

  // อัปเดตข้อมูลพื้นฐานก่อน (ถ้ามี)
  if (fields.length) {
    const sql = `UPDATE users SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    try {
      await pool.query(sql, [...params, userId]);
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        const e = new Error("อีเมล/เบอร์โทรนี้ถูกใช้แล้ว");
        e.statusCode = 409; e.code = "DUPLICATE";
        throw e;
      }
      throw err;
    }
  }

  // ถ้ามี specialty_ids ให้จัดการ mapping เฉพาะเมื่อเป็นหมอ
  if (Array.isArray(patch.specialty_ids)) {
    await setDoctorSpecialties(userId, patch.specialty_ids);
  }

  return getUserProfile(userId);
}

export async function searchDoctors({ q, specialty_id, specialty_name }) {
  const params = [];
  let sql = "SELECT u.id, u.full_name, u.email, u.phone FROM users u ";
  if (specialty_id || specialty_name) {
    sql +=
      "JOIN doctor_specialties ds ON ds.doctor_id = u.id JOIN specialties s ON s.id = ds.specialty_id ";
  }
  sql += "WHERE u.role = 'doctor' ";
  if (q) {
    sql += "AND u.full_name LIKE ? ";
    params.push(`%${q}%`);
  }
  if (specialty_id) {
    sql += "AND s.id = ? ";
    params.push(specialty_id);
  } else if (specialty_name) {
    sql += "AND s.name LIKE ? ";
    params.push(`%${specialty_name}%`);
  }
  sql += "ORDER BY u.full_name ASC LIMIT 100";
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function createDoctorSlot(doctorId, startISO, endISO) {
  const conn = await pool.getConnection();
  try {
    const isDateOnly = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const normStart = isDateOnly(startISO) ? `${startISO}T00:00:00` : startISO;
    const normEnd   = isDateOnly(endISO)   ? `${endISO}T23:59:59` : endISO;

    const startDT = new Date(normStart);
    const endDT   = new Date(normEnd);
    if (isNaN(startDT) || isNaN(endDT) || endDT.getTime() < startDT.getTime()) {
      const e = new Error("ช่วงเวลาไม่ถูกต้อง");
      e.statusCode = 400; e.code = "INVALID_TIME_RANGE";
      throw e;
    }

    const pad = (n) => String(n).padStart(2,"0");
    const toSql = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const id = genId("slot");

    await conn.beginTransaction();

    // parent slot อย่างเดียว (ไม่แตก daily แล้ว)
    await conn.query(
      "INSERT IGNORE INTO doctor_slots (id, doctor_id, start_time, end_time, status) VALUES (?, ?, ?, ?, 'available')",
      [id, doctorId, toSql(startDT), toSql(endDT)]
    );

    await conn.commit();
    return {
      id,
      doctor_id: doctorId,
      start_time: toSql(startDT),
      end_time: toSql(endDT),
      status: "available",
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


export async function listDoctorSlot(doctorId, fromISO, toISO) {
  // แปลงกรอบวัน
  const toYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date(s).toISOString().slice(0, 10);
  const fromDay = fromISO ? toYMD(fromISO) : null;
  const toDay   = toISO   ? toYMD(toISO)   : null;

  // ดึง parent slots ที่ทับซ้อนกับกรอบที่ค้นหา
  const params = [doctorId];
  let sql = `
    SELECT id, doctor_id, start_time, end_time, status
    FROM doctor_slots
    WHERE doctor_id = ?
  `;
  if (fromDay) { sql += " AND DATE(end_time)   >= ?"; params.push(fromDay); }
  if (toDay)   { sql += " AND DATE(start_time) <= ?"; params.push(toDay); }
  sql += " ORDER BY start_time ASC LIMIT 500";

  const [rows] = await pool.query(sql, params);

  if (!rows.length) return [];

  // ดึง appointments ในกรอบเดียวกัน เพื่อเช็ค “วันไหนถูกจองแล้ว”
  const aParams = [doctorId];
  let aSql = `
    SELECT a.slot_id, a.chosen_date, a.status
    FROM appointments a
    WHERE a.doctor_id = ?
  `;
  if (fromDay) { aSql += " AND a.chosen_date >= ?"; aParams.push(fromDay); }
  if (toDay)   { aSql += " AND a.chosen_date <= ?"; aParams.push(toDay); }

  const [apts] = await pool.query(aSql, aParams);
  const booked = new Map(); // key = slot_id|YYYY-MM-DD -> true
  for (const a of apts) {
    booked.set(`${a.slot_id}|${a.chosen_date}`, true);
  }

  // แตกเป็น daily “เสมือน” แล้วติดสถานะ
  const out = [];
  for (const s of rows) {
    const days = enumerateDailyFromSlot(s.start_time, s.end_time);
    for (const ymd of days) {
      if (fromDay && ymd < fromDay) continue;
      if (toDay && ymd > toDay) continue;
      const isBooked = booked.get(`${s.id}|${ymd}`) === true;
      out.push({
        // id เสมือน เพื่อโชว์ใน UI เท่านั้น
        id: `${s.id}:${ymd}`,
        slot_id: s.id,
        doctor_id: s.doctor_id,
        start_time: `${ymd} 00:00:00`,
        end_time: `${ymd} 23:59:59`,
        status: isBooked ? "booked" : "available",
      });
    }
  }

  // เรียงวัน
  out.sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
  return out;
}

export async function bookAppointment(patientId, slotId, chosenDate /* YYYY-MM-DD */) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) ล็อก slot แม่
    const [srows] = await conn.query(
      "SELECT id, doctor_id, start_time, end_time, status FROM doctor_slots WHERE id = ? FOR UPDATE",
      [slotId]
    );
    const slot = srows[0];
    if (!slot) {
      const e = new Error("ไม่พบเวลานัดหมาย");
      e.statusCode = 404; e.code = "SLOT_NOT_FOUND";
      throw e;
    }
    if (slot.status !== "available") {
      const e = new Error("ช่วงเวลานี้ไม่พร้อมให้นัดหมาย");
      e.statusCode = 409; e.code = "SLOT_NOT_AVAILABLE";
      throw e;
    }

    // 2) chosen_date ต้องอยู่ในช่วง slot
    const ymds = enumerateDailyFromSlot(slot.start_time, slot.end_time);
    if (!ymds.includes(chosenDate)) {
      const e = new Error("วันที่เลือกอยู่นอกช่วงเวลาทำงานของแพทย์");
      e.statusCode = 400; e.code = "DATE_OUT_OF_RANGE";
      throw e;
    }

    // 3) ห้ามจองวันเดียวกัน (ต้องล่วงหน้าอย่างน้อย 1 วัน)
    const today00 = new Date(); today00.setHours(0,0,0,0);
    const tomorrow00 = new Date(today00.getTime() + 24*60*60*1000);
    if (new Date(`${chosenDate}T00:00:00`) < tomorrow00) {
      const e = new Error("การจองทำได้ตั้งแต่พรุ่งนี้เป็นต้นไป");
      e.statusCode = 400; e.code = "BOOKING_TOO_SOON";
      throw e;
    }

    // 4) ใส่นัด (pending) พึ่งพา UNIQUE(slot_id, chosen_date) กันชน
    const apptId = genId("appt");
    await conn.query(
      "INSERT INTO appointments (id, patient_id, doctor_id, slot_id, chosen_date, status) VALUES (?, ?, ?, ?, ?, 'pending')",
      [apptId, patientId, slot.doctor_id, slot.id, chosenDate]
    );

    await conn.commit();
    return {
      id: apptId,
      patient_id: patientId,
      doctor_id: slot.doctor_id,
      slot_id: slot.id,
      chosen_date: chosenDate,
      status: "pending",
      // สำหรับแสดงผล
      start_time: `${chosenDate} 00:00:00`,
      end_time: `${chosenDate} 23:59:59`,
    };
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY") {
      const e = new Error("วันดังกล่าวถูกจองแล้ว");
      e.statusCode = 409; e.code = "SLOT_ALREADY_BOOKED";
      throw e;
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function listAppointmentsForUser(userId, role) {
  if (role === "patient") {
    const [rows] = await pool.query(
      `SELECT a.id, a.status, a.created_at,
         DATE_FORMAT(a.chosen_date, '%Y-%m-%d') AS chosen_date,
         COALESCE(CONCAT(a.chosen_date, ' 00:00:00'), ds.start_time) AS start_time,
         COALESCE(CONCAT(a.chosen_date, ' 23:59:59'), ds.end_time)   AS end_time,
              COALESCE(CONCAT(a.chosen_date, ' 00:00:00'), ds.start_time) AS start_time,
              COALESCE(CONCAT(a.chosen_date, ' 23:59:59'), ds.end_time)   AS end_time,
              d.id AS doctor_id, d.full_name AS doctor_name
       FROM appointments a
       LEFT JOIN doctor_slots ds ON ds.id = a.slot_id
       JOIN users d ON d.id = a.doctor_id
       WHERE a.patient_id = ?
       ORDER BY COALESCE(DATE_FORMAT(a.chosen_date, '%Y-%m-%d'), DATE(ds.start_time)) DESC, a.created_at DESC
       LIMIT 200`,
      [userId]
    );
    return rows;
  }

  if (role === "doctor") {
    const [rows] = await pool.query(
      `SELECT a.id, a.status, a.created_at,
         DATE_FORMAT(a.chosen_date, '%Y-%m-%d') AS chosen_date,
         COALESCE(CONCAT(a.chosen_date, ' 00:00:00'), ds.start_time) AS start_time,
         COALESCE(CONCAT(a.chosen_date, ' 23:59:59'), ds.end_time)   AS end_time,
              COALESCE(CONCAT(a.chosen_date, ' 00:00:00'), ds.start_time) AS start_time,
              COALESCE(CONCAT(a.chosen_date, ' 23:59:59'), ds.end_time)   AS end_time,
              p.id AS patient_id, p.full_name AS patient_name
       FROM appointments a
       LEFT JOIN doctor_slots ds ON ds.id = a.slot_id
       JOIN users p ON p.id = a.patient_id
       WHERE a.doctor_id = ?
       ORDER BY COALESCE(DATE_FORMAT(a.chosen_date, '%Y-%m-%d'), DATE(ds.start_time)) DESC, a.created_at DESC
       LIMIT 200`,
      [userId]
    );
    return rows;
  }

  return [];
}


///////////////////////////////
// 9) SCHEMAS
///////////////////////////////

const SpecialtyIdsSchema = z.array(z.string().length(36, "id ต้องยาว 36 ตัว"))
  .max(10, "เลือกได้ไม่เกิน 10 สาขา");

// Register schema (แก้ให้รองรับ specialties และบังคับให้ doctor ต้องเลือกอย่างน้อย 1)
const RegisterSchema = z
  .object({
    role: z.enum(["patient", "doctor"], { message: "role ไม่ถูกต้อง" }),
    full_name: z.string().min(1, "กรุณาระบุชื่อ-นามสกุล"),
    email: z.string().email("อีเมลไม่ถูกต้อง"),
    phone: z
      .string()
      .min(9, "เบอร์โทรไม่ถูกต้อง")
      .max(10, "เบอร์โทรยาวเกินไป")
      .optional()
      .nullable(),
    password: z.string().min(4, "รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร"),
    specialties: z.array(z.string()).optional().nullable(), // optional: จะเช็คเพิ่มเติมด้านล่าง
  })
  .superRefine((data, ctx) => {
    // ถ้าเป็น doctor → ต้องมี specialties อย่างน้อย 1 รายการ
    if (data.role === "doctor") {
      if (!data.specialties || !Array.isArray(data.specialties) || data.specialties.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "แพทย์ต้องเลือกสาขาอย่างน้อย 1 รายการ",
          path: ["specialties"],
        });
      }
    }
  });


const LoginSchema = z.object({
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

const UpdateProfileSchema = z.object({
  full_name: z.string().min(1, "กรุณาระบุชื่อ-นามสกุล").optional(),
  phone: z.string().min(9, "เบอร์โทรไม่ถูกต้อง").max(32, "เบอร์โทรยาวเกินไป").optional().nullable(),
  // เพิ่มใหม่: อัปเดตสาขาเฉพาะหมอ
  specialty_ids: SpecialtyIdsSchema.optional(),
});

const SearchDoctorsQuery = z.object({
  q: z.string().optional(),
  specialty_id: z.string().optional(),
  specialty_name: z.string().optional(),
});

const CreateSlotSchema = z.object({
  start_time: z.string().min(10, "ต้องระบุเวลาเริ่ม"),
  end_time: z.string().min(10, "ต้องระบุเวลาสิ้นสุด"),
}).superRefine((val, ctx) => {
  const s = val.start_time;
  const e = val.end_time;
  const dateMode = isDateOnly(s) && isDateOnly(e);
  try {
    const start = dateMode ? atStartOfDay(s) : new Date(s);
    const end   = dateMode ? atEndOfDay(e)   : new Date(e);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "รูปแบบเวลาไม่ถูกต้อง" });
    }
    if (end.getTime() <= start.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม" });
    }
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "รูปแบบเวลาไม่ถูกต้อง" });
  }
});

// ACCEPT: "YYYY-MM-DD" หรือ ISO datetime ใด ๆ ที่ new Date() parse ได้
const DateOrDateTime = z.string().refine(
  (s) => (typeof s === "string") && (/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isNaN(new Date(s).getTime())),
  { message: "รูปแบบเวลาไม่ถูกต้อง" }
);

const ListSlotsQuery = z.object({
  from: DateOrDateTime.optional(),
  to: DateOrDateTime.optional(),
});

// ================= schemas =================
const BookSchema = z.object({
  slot_id: z.string().min(1, "กรุณาระบุ slot_id"),
  chosen_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)"),
});

///////////////////////////////
// 10) ROUTES
///////////////////////////////

// healthcheck
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// register
app.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return respondValidation(res, parsed.error);
    const user = await registerUser(parsed.data);
    res.status(201).json({ user });
  })
);

// ESCALATED LOGIN + IP BLOCK
app.post(
  "/auth/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    // validate basic
    const parsed = LoginSchema.safeParse(req.body || {});
    if (!parsed.success) return respondValidation(res, parsed.error);
    const { email, password } = parsed.data;

    const ip = getClientIp(req);
    if (await isIpBlocked(ip)) {
      return res
        .status(429)
        .json({ error: { code: "IP_BLOCKED", message: "จากการลองเข้าสู่ระบบมากเกินไป โปรดลองใหม่ภายหลัง" } });
    }

    // fetch user
    const [rows] = await pool.query(
      "SELECT id, role, email, full_name, password_hash, failed_login_attempts, lock_count, locked_until FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    const user = rows[0];

    if (!user) {
      await new Promise((r) => setTimeout(r, 300)); // ชะลอบอทนิดหน่อย
      return res
        .status(401)
        .json({ error: { code: "INVALID_CREDENTIALS", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" } });
    }

    // account locked?
    if (user.locked_until) {
      const untilTs = new Date(user.locked_until).getTime();
      if (Date.now() < untilTs) {
        const leftMin = Math.ceil((untilTs - Date.now()) / 60000);
        return res.status(423).json({
          error: { code: "ACCOUNT_LOCKED", message: `บัญชีถูกล็อกชั่วคราว โปรดลองอีกครั้งใน ${leftMin} นาที` },
        });
      }
    }

    // verify password
    const ok = verifyPassword(password, user.password_hash);
    if (!ok) {
      const newFailed = (user.failed_login_attempts || 0) + 1;
      await pool.query("UPDATE users SET failed_login_attempts = ? WHERE id = ?", [newFailed, user.id]);

      if (newFailed >= 5) {
        const currentLockCount = user.lock_count || 0;
        const durationSec = getLockDurationSeconds(currentLockCount);
        const until = new Date(Date.now() + durationSec * 1000);
        await pool.query("UPDATE users SET locked_until = ?, lock_count = ? WHERE id = ?", [
          until,
          currentLockCount + 1,
          user.id,
        ]);
        await blockIp(ip, durationSec);
        return res.status(429).json({
          error: {
            code: "TOO_MANY_ATTEMPTS",
            message: `ลองเข้าสู่ระบบมากเกินไป ระบบล็อกบัญชีเป็นเวลา ${Math.round(durationSec / 60)} นาที`,
          },
        });
      }

      return res
        .status(401)
        .json({ error: { code: "INVALID_CREDENTIALS", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" } });
    }

    // success
    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, lock_count = 0, locked_until = NULL WHERE id = ?",
      [user.id]
    );
    await unblockIp(ip);

    const token = issueJwt({ sub: user.id, role: user.role || "patient" }, "2h");
    return res.json({
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role || "patient" },
    });
  })
);

// profile
app.get(
  "/users/me",
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = await getUserProfile(req.user.sub);
    res.json({ user });
  })
);

app.put(
  "/users/me",
  requireAuth(),
  asyncHandler(async (req, res) => {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) return respondValidation(res, parsed.error);
    const user = await updateUserProfile(req.user.sub, parsed.data);
    res.json({ user });
  })
);

// doctors
app.get(
  "/doctors",
  asyncHandler(async (req, res) => {
    // รองรับ alias ตามข้อสอบ: ?specialty= จะถูก map เป็น specialty_name
    const q = { ...req.query };
    if (q.specialty && !q.specialty_name && !q.specialty_id) {
      // ถ้ารูปแบบเป็น UUID/id ให้ map เป็น specialty_id
      if (looksLikeId(q.specialty)) q.specialty_id = q.specialty;
      else q.specialty_name = q.specialty;
    }
    

    const parsed = SearchDoctorsQuery.safeParse(q);
    if (!parsed.success) return respondValidation(res, parsed.error);

    const data = await searchDoctors(parsed.data);
    res.json({ data });
  })
);


app.post(
  "/doctors/:id/slots",
  requireAuth(["doctor"]),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user.sub) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "ไม่สามารถจัดการเวลาให้ผู้อื่นได้" } });
    }
    const parsed = CreateSlotSchema.safeParse(req.body);
    if (!parsed.success) return respondValidation(res, parsed.error);
    const slot = await createDoctorSlot(req.user.sub, parsed.data.start_time, parsed.data.end_time);
    res.status(201).json({ slot });
  })
);

app.get(
  "/doctors/:id/slots",
  asyncHandler(async (req, res) => {
    const parsed = ListSlotsQuery.safeParse(req.query);
    if (!parsed.success) return respondValidation(res, parsed.error);
    const data = await listDoctorSlot(req.params.id, parsed.data.from, parsed.data.to);
    res.json({ data });
  })
);

// appointments
app.post(
  "/appointments",
  requireAuth(["patient"]),
  asyncHandler(async (req, res) => {
    const parsed = BookSchema.safeParse(req.body);
    if (!parsed.success) return respondValidation(res, parsed.error);
    const { slot_id, chosen_date } = parsed.data;
    const appt = await bookAppointment(req.user.sub, slot_id, chosen_date);
    res.status(201).json({ appointment: appt });
  })
);

app.patch(
  "/appointments/:id/status",
  requireAuth(["doctor"]),
  asyncHandler(async (req, res) => {
    const apptId = req.params.id;
    const parsed = UpdateApptStatusSchema.safeParse(req.body);
    if (!parsed.success) return respondValidation(res, parsed.error);

    // อนุญาตแก้เฉพาะนัดของหมอคนนี้
    const [rows] = await pool.query(
      "SELECT id, doctor_id FROM appointments WHERE id = ? LIMIT 1",
      [apptId]
    );
    const a = rows[0];
    if (!a || a.doctor_id !== req.user.sub) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "ไม่พบนัดหมาย" } });
    }

    await pool.query("UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      parsed.data.status,
      apptId,
    ]);

    res.json({ ok: true });
  })
);

app.get(
  "/appointments/me",
  requireAuth(),
  asyncHandler(async (req, res) => {
    const list = await listAppointmentsForUser(req.user.sub, req.user.role);
    res.json({ data: list });
  })
);

// เพิ่ม alias ให้ตรงข้อสอบ
app.get(
  "/appointments/doctor/me",
  requireAuth(["doctor"]),
  asyncHandler(async (req, res) => {
    const list = await listAppointmentsForUser(req.user.sub, "doctor");
    res.json({ data: list });
  })
);

app.get(
  "/appointments/patient/me",
  requireAuth(["patient"]),
  asyncHandler(async (req, res) => {
    const list = await listAppointmentsForUser(req.user.sub, "patient");
    res.json({ data: list });
  })
);

// GET /specialties - คืนรายการ specialties ทั้งหมด
app.get(
  "/specialties",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT id, name FROM specialties ORDER BY name ASC");
    res.json({ data: rows });
  })
);

const UpdateApptStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "rejected", "cancelled"], { message: "สถานะไม่ถูกต้อง" }),
});
///////////////////////////////
// 11) GLOBAL ERROR HANDLER
///////////////////////////////
app.use((err, _req, res, _next) => {
  if (err?.code === "ER_DUP_ENTRY") {
    return res
      .status(409)
      .json({ error: { code: "DUPLICATE", message: "ข้อมูลนี้ถูกใช้งานอยู่แล้ว" } });
  }

  if (err?.statusCode) {
    return res
      .status(err.statusCode)
      .json({ error: { code: err.code || "ERROR", message: err.message || "เกิดข้อผิดพลาด" } });
  }

  if (err?.issues) {
    return respondValidation(res, err);
  }

  console.error(err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL_ERROR", message: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง" } });
});

///////////////////////////////
// 12) START SERVER
///////////////////////////////
app.listen(env.PORT, () => {
  console.log("server started on port", env.PORT);
});
