// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Grid,
  Chip,
  Divider,
  Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import api from "../../lib/api";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [editing, setEditing] = useState(false);
  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setErr("");
      try {
        const res = await api.get("/users/me");
        if (!mounted) return;
        const user = res?.data?.user || null;
        setProfile(user);
        setForm({
          full_name: user?.full_name || "",
          email: user?.email || "",
          phone: user?.phone || "",
        });
      } catch (e) {
        console.error("load profile: ", e);
        setErr("โหลดโปรไฟล์ไม่สำเร็จ โปรดลองใหม่");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const validate = (data) => {
    const errors = [];
    if (!data.full_name || !data.full_name.trim())
      errors.push("กรุณาระบุชื่อ-นามสกุล");
    if (
      !data.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(data.email.trim())
    ) {
      errors.push("รูปแบบอีเมลไม่ถูกต้อง");
    }
    if (data.phone && !/^\d{9,10}$/.test(data.phone.trim()))
      errors.push("เบอร์ต้องเป็นตัวเลข 9-10 หลัก");
    return errors;
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setErr("");
    const errors = validate(form);
    if (errors.length) {
      setErr(errors.join(" • "));
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/users/me", {
        full_name: form.full_name,
        phone: form.phone || null,
      });
      const user = res?.data?.user || { ...profile, ...form };
      setProfile(user);
      setEditing(false);
      setSnack({ open: true, msg: "บันทึกสำเร็จ", severity: "success" });
    } catch (e) {
      console.error("save profile:", e);
      setErr("บันทึกไม่สำเร็จ ลองอีกครั้ง");
      setSnack({ open: true, msg: "บันทึกไม่สำเร็จ", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div
        style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}
      >
        <CircularProgress />
      </div>
    );

  return (
    <div style={{ minHeight: "60vh", paddingBottom: 48 }}>
      <div className="container">
        <Box
          sx={{
            // ปรับค่าตรงนี้เพื่อเลื่อน card ลง/ขึ้น ตามขนาดหน้าจอ
            mt: { xs: "24px", sm: "160px", md: "190px" }, // <-- ปรับค่าให้ลงต่ำกว่าเดิม
            mx: "auto",
            maxWidth: 980,
            px: 2,
          }}
        >
          <Paper
            elevation={6}
            sx={{
              borderRadius: 3,
              px: { xs: 3, md: 5 },
              py: { xs: 3, md: 5 },
              minHeight: { xs: 320, md: 340 }, // ปรับความสูงของกล่องที่นี่
              background: "#ffffff",
              boxShadow: "0 24px 48px rgba(12,18,30,0.06)",
              transition: "all 240ms ease",
            }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="flex-start"
              mb={2}
            >
              <Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, letterSpacing: "-0.4px" }}
                >
                  โปรไฟล์ของฉัน
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  ตรวจสอบและแก้ไขข้อมูลส่วนตัว
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={
                    profile?.role === "doctor" ? "บัญชี: หมอ" : "บัญชี: คนไข้"
                  }
                  size="small"
                  sx={{
                    bgcolor: "transparent",
                    border: "1px solid rgba(15,20,30,0.05)",
                    color: "text.secondary",
                    fontWeight: 600,
                  }}
                />
                {!editing ? (
                  <Button
                    startIcon={<EditIcon />}
                    variant="outlined"
                    onClick={() => setEditing(true)}
                    sx={{ textTransform: "none", borderRadius: 2 }}
                  >
                    แก้ไข
                  </Button>
                ) : (
                  <Button
                    startIcon={<SaveIcon />}
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      backgroundColor: "#111",
                      "&:hover": { backgroundColor: "#000" },
                    }}
                  >
                    {saving ? "กำลังบันทึก..." : "บันทึก"}
                  </Button>
                )}
              </Stack>
            </Box>

            <Divider sx={{ my: 2 }} />

            {err && (
              <Box mb={2}>
                <Typography color="error" variant="body2">
                  {err}
                </Typography>
              </Box>
            )}
            <Box component="form" onSubmit={handleSave}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="ชื่อ - นามสกุล"
                    value={form.full_name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, full_name: e.target.value }))
                    }
                    fullWidth
                    disabled={!editing}
                    required
                    variant="outlined"
                    InputProps={{
                      sx: {
                        borderRadius: 2,
                        px: 2,
                        py: 1.2,
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="อีเมล"
                    value={form.email}
                    fullWidth
                    disabled
                    variant="outlined"
                    helperText="ไม่สามารถแก้ไขได้จากที่นี่"
                    InputProps={{
                      sx: { borderRadius: 2, px: 2, py: 1.2 },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="เบอร์โทร (ไม่บังคับ)"
                    value={form.phone || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    fullWidth
                    disabled={!editing}
                    variant="outlined"
                    helperText="ตัวเลข 9-10 หลัก"
                    InputProps={{
                      sx: { borderRadius: 2, px: 2, py: 1.2 },
                    }}
                  />
                </Grid>
                <Grid
                  item
                  xs={12}
                  display="flex"
                  justifyContent="flex-end"
                  sx={{ mt: 1 }}
                >
                  {editing ? (
                    <Button
                      onClick={() => {
                        setEditing(false);
                        setForm({
                          full_name: profile?.full_name || "",
                          email: profile?.email || "",
                          phone: profile?.phone || "",
                        });
                        setErr("");
                      }}
                      sx={{ textTransform: "none" }}
                    >
                      ยกเลิก
                    </Button>
                  ) : null}
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Box>
      </div>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}