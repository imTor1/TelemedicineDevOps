// src/pages/Profile.jsx (Optimized UI)
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
  Card,
  CardContent,
  Avatar,
  IconButton,
  Fade,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
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

  const handleCancel = () => {
    setEditing(false);
    setForm({
      full_name: profile?.full_name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
    });
    setErr("");
  };

  if (loading)
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );

  const renderProfileView = () => (
    <Grid container spacing={4}>
      <Grid item xs={12} md={4}>
        <Stack spacing={2} alignItems="center">
          <Avatar sx={{ width: 100, height: 100 }}>
            {profile?.full_name?.charAt(0) || "?"}
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {profile?.full_name}
          </Typography>
          <Chip
            label={profile?.role === "doctor" ? "บัญชี: หมอ" : "บัญชี: คนไข้"}
            size="small"
            sx={{
              bgcolor: "#e0f7fa",
              color: "#00796b",
              fontWeight: 600,
            }}
          />
        </Stack>
      </Grid>
      <Grid item xs={12} md={8}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              ชื่อ - นามสกุล
            </Typography>
            <Typography variant="body1">{profile?.full_name}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              อีเมล
            </Typography>
            <Typography variant="body1">{profile?.email}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              เบอร์โทร
            </Typography>
            <Typography variant="body1">{profile?.phone || "-"}</Typography>
          </Box>
        </Stack>
      </Grid>
    </Grid>
  );

  const renderEditForm = () => (
    <Box component="form" onSubmit={handleSave}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            label="ชื่อ - นามสกุล"
            value={form.full_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, full_name: e.target.value }))
            }
            fullWidth
            required
            variant="outlined"
            InputProps={{
              sx: { borderRadius: 2 },
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="อีเมล"
            value={form.email}
            fullWidth
            disabled
            variant="outlined"
            helperText="ไม่สามารถแก้ไขได้จากที่นี่"
            InputProps={{
              sx: { borderRadius: 2 },
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="เบอร์โทร (ไม่บังคับ)"
            value={form.phone || ""}
            onChange={(e) =>
              setForm((p) => ({ ...p, phone: e.target.value }))
            }
            fullWidth
            variant="outlined"
            helperText="ตัวเลข 9-10 หลัก"
            InputProps={{
              sx: { borderRadius: 2 },
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ minHeight: "60vh", py: 4, background: "#f5f5f5" }}>
      <Box
        sx={{
          mt: { xs: 2, sm: 10, md: 15 },
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
            background: "#ffffff",
            boxShadow: "0 24px 48px rgba(12,18,30,0.06)",
            transition: "all 240ms ease",
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, letterSpacing: "-0.4px" }}
              >
                โปรไฟล์ของฉัน
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                ตรวจสอบและแก้ไขข้อมูลส่วนตัว
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {!editing ? (
                <IconButton onClick={() => setEditing(true)}>
                  <EditIcon />
                </IconButton>
              ) : (
                <Stack direction="row" spacing={1}>
                  <IconButton onClick={handleCancel}>
                    <CloseIcon />
                  </IconButton>
                  <IconButton onClick={handleSave} disabled={saving} color="primary">
                    <SaveIcon />
                  </IconButton>
                </Stack>
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
          <Fade in={!editing}>
            <Box sx={{ display: editing ? 'none' : 'block' }}>
              {renderProfileView()}
            </Box>
          </Fade>
          <Fade in={editing}>
            <Box sx={{ display: !editing ? 'none' : 'block' }}>
              {renderEditForm()}
            </Box>
          </Fade>
        </Paper>
      </Box>

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
    </Box>
  );
}