// src/pages/Auth/Register.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  IconButton,
  Select, // << เพิ่ม Select ของ MUI
} from "@mui/material";
import { createTheme, ThemeProvider, styled } from "@mui/material/styles";
import { keyframes } from "@emotion/react";
import api from "../../lib/api";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { transform: translateX(-110%); opacity: 0; }
  40% { opacity: 1; }
  100% { transform: translateX(110%); opacity: 0; }
`;

const theme = createTheme({
  palette: {
    primary: { main: "#2b2b2b" },
    background: { default: "#ffffff", paper: "#ffffff" },
    text: { primary: "#0b1220", secondary: "#6b7280" },
  },
  typography: {
    fontFamily: ['"Inter"', "system-ui", "sans-serif"].join(","),
    h4: { fontWeight: 700, fontSize: "1.6rem", color: "#0b1220" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          padding: "36px",
          animation: `${fadeIn} 320ms ease-out both`,
          boxShadow: "0 20px 40px rgba(8,12,20,0.06)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            backgroundColor: "#ffffff",
            "& fieldset": { borderColor: "#e6e7ea" },
            "&:hover fieldset": { borderColor: "#d7d9dd" },
            "&.Mui-focused fieldset": {
              borderColor: "#2b2b2b",
              boxShadow: "0 0 0 4px rgba(43,43,43,0.04)",
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: "10px 14px",
          fontWeight: 700,
          textTransform: "none",
          boxShadow: "0 8px 18px rgba(11,18,25,0.04)",
        },
      },
    },
  },
});

const ShimmerButton = styled(Button)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  zIndex: 1,
  background: "#2b2b2b",
  color: "#fff",
  "&:hover": { background: "#1f1f1f" },
  "&::after": {
    content: '""',
    position: "absolute",
    left: "-120%",
    top: 0,
    height: "100%",
    width: "40%",
    transform: "skewX(-12deg)",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
    opacity: 0,
    pointerEvents: "none",
  },
  "&:hover::after": {
    animation: `${shimmer} 900ms linear forwards`,
  },
}));

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="down" ref={ref} {...props} />;
});

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    role: "patient",
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [fieldErr, setFieldErr] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    specialties: "",
  });
  const [submitErr, setSubmitErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  // specialties data
  const [specialties, setSpecialties] = useState([]);
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [selectedSpecs, setSelectedSpecs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/specialties");
        setSpecialties(r?.data?.data || []);
      } catch (e) {
        console.warn("failed to load specialties:", e);
        setSpecialties([]);
      }
    })();
  }, []);

  // validators
  const isGmailOrHotmail = (value) => {
    if (!value) return false;
    const re = /^[^\s@]+@(gmail\.com|hotmail\.com)$/i;
    return re.test(value.trim());
  };
  const isPhoneValid = (value) => {
    if (!value) return false;
    const digits = value.replace(/\D/g, "");
    return /^[0-9]{9,10}$/.test(digits);
  };
  const isPasswordValid = (value) => {
    return typeof value === "string" && value.length >= 4;
  };

  const validateAll = () => {
    const errs = { full_name: "", email: "", phone: "", password: "", specialties: "" };

    if (!form.full_name || form.full_name.trim().length < 2) {
      errs.full_name = "กรุณาระบุชื่อ-นามสกุล (อย่างน้อย 2 ตัวอักษร)";
    }
    if (!form.email) {
      errs.email = "กรุณาระบุอีเมล";
    } else if (!isGmailOrHotmail(form.email)) {
      errs.email = "อีเมลต้องลงท้ายด้วย @gmail.com หรือ @hotmail.com";
    }
    if (form.phone && !isPhoneValid(form.phone)) {
      errs.phone = "เบอร์โทรต้องเป็นตัวเลข 9 หรือ 10 หลัก";
    }
    if (!form.password) {
      errs.password = "กรุณาระบุรหัสผ่าน";
    } else if (!isPasswordValid(form.password)) {
      errs.password = "รหัสผ่านต้องอย่างน้อย 4 ตัวอักษร";
    }

    if (form.role === "doctor") {
      if (!selectedSpecs || selectedSpecs.length === 0) {
        errs.specialties = "แพทย์ต้องเลือกสาขาอย่างน้อย 1 รายการ";
      }
    }

    setFieldErr(errs);
    return !errs.full_name && !errs.email && !errs.phone && !errs.password && !errs.specialties;
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitErr("");
    const ok = validateAll();
    if (!ok) {
      setSubmitErr("กรุณาแก้ไขข้อผิดพลาดในฟอร์มก่อนดำเนินการ");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        role: form.role,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        specialties: form.role === "doctor" ? selectedSpecs.map((s) => s.id) : undefined,
      };

      const res = await api.post("/auth/register", payload);
      if (res?.data?.user || res?.status === 201) {
        setSuccessOpen(true);
      } else {
        setSubmitErr("สมัครสมาชิกไม่สำเร็จ");
      }
    } catch (ex) {
      const serverErr = ex?.response?.data?.error;
      if (serverErr?.details && Array.isArray(serverErr.details) && serverErr.details.length) {
        const msgs = serverErr.details.map((d) => `${d.field || "(general)"}: ${d.message}`);
        setSubmitErr(msgs.join(" / "));
      } else if (serverErr?.message) {
        setSubmitErr(serverErr.message);
      } else {
        setSubmitErr("สมัครสมาชิกไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessOk = () => {
    setSuccessOpen(false);
    setTimeout(() => nav("/login"), 260);
  };

  const updateField = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // specialties dialog handlers
  const toggleSpec = (spec) => {
    const found = selectedSpecs.find((s) => s.id === spec.id);
    if (found) setSelectedSpecs((s) => s.filter((x) => x.id !== spec.id));
    else setSelectedSpecs((s) => [...s, spec]);
  };
  const openSpecDialog = () => setSpecDialogOpen(true);
  const closeSpecDialog = () => setSpecDialogOpen(false);
  const confirmSpecDialog = () => {
    setSpecDialogOpen(false);
    setFieldErr((fe) => ({ ...fe, specialties: "" }));
  };

  return (
    <ThemeProvider theme={theme}>
      {/* background image */}
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          backgroundImage: `url('/bgbw.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <Container
        maxWidth={false}
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          px: 3,
          pt: { xs: 8, md: 10 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 760, mx: "auto", mt: { xs: 2, sm: "-3vh", md: "0vh" } }}>
          <Paper elevation={6}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="h4" align="center">
                สมัครสมาชิก
              </Typography>

              <Typography variant="body1" align="center" sx={{ color: "text.secondary", mb: 1 }}>
                สร้างบัญชีใหม่เพื่อใช้งานระบบ นัดหมายกับแพทย์
              </Typography>

              <Box
                component="form"
                onSubmit={submit}
                sx={{
                  mt: 1,
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                }}
              >
                {/* ประเภท */}
                <FormControl fullWidth>
                  <InputLabel id="role-label">ประเภท</InputLabel>
                  <Select
                    labelId="role-label"
                    id="role-select"
                    label="ประเภท"
                    value={form.role}
                    onChange={(e) => updateField("role", e.target.value)}
                    sx={{ borderRadius: 2, background: "#fff" }}
                  >
                    <MenuItem value="patient">คนไข้ (Patient)</MenuItem>
                    <MenuItem value="doctor">แพทย์ (Doctor)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="ชื่อ - นามสกุล"
                  value={form.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  required
                  fullWidth
                  error={!!fieldErr.full_name}
                  helperText={fieldErr.full_name || ""}
                />

                <TextField
                  label="อีเมล"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                  fullWidth
                  sx={{ gridColumn: { xs: "1 / -1", sm: "1 / 2" } }}
                  error={!!fieldErr.email}
                  helperText={fieldErr.email || ""}
                />

                <TextField
                  label="เบอร์โทร (ไม่บังคับ)"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  fullWidth
                  error={!!fieldErr.phone}
                  helperText={fieldErr.phone || ""}
                />

                <TextField
                  label="รหัสผ่าน"
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
                  fullWidth
                  sx={{ gridColumn: "1 / -1" }}
                  error={!!fieldErr.password}
                  helperText={fieldErr.password || ""}
                />

                {/* ถ้าเป็น doctor -> show multi-select trigger */}
                {form.role === "doctor" && (
                  <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 2, alignItems: "center", mt: 1 }}>
                    <Button variant="outlined" onClick={openSpecDialog} sx={{ textTransform: "none" }}>
                      เลือกสาขา {selectedSpecs.length ? `(${selectedSpecs.length})` : ""}
                    </Button>

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {selectedSpecs.map((s) => (
                        <Box
                          key={s.id}
                          sx={{
                            px: 1.2,
                            py: 0.5,
                            borderRadius: 16,
                            bgcolor: "#f3f4f6",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <Typography variant="caption" sx={{ mr: 1 }}>
                            {s.name}
                          </Typography>
                          <IconButton size="small" onClick={() => toggleSpec(s)}>
                            ×
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                <Box
                  sx={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mt: 1,
                    gap: 2,
                  }}
                >
                  <Box sx={{ minHeight: 24 }}>
                    {submitErr ? (
                      <Typography sx={{ color: "#bb1f1f" }}>{submitErr}</Typography>
                    ) : (
                      <Typography sx={{ color: "#6b7280" }}>กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง</Typography>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Box sx={{ mr: 2 }}>
                      <RouterLink to="/login" style={{ color: "#374151", textDecoration: "none" }}>
                        มีบัญชีแล้ว? เข้าสู่ระบบ
                      </RouterLink>
                    </Box>

                    <ShimmerButton type="submit" disabled={loading} variant="contained">
                      {loading ? <CircularProgress size={20} color="inherit" /> : "สมัครสมาชิก"}
                    </ShimmerButton>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>

      {/* Dialog เลือกสาขา */}
      <Dialog
        open={specDialogOpen}
        onClose={closeSpecDialog}
        TransitionComponent={Transition}
        keepMounted
        aria-labelledby="spec-dialog-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="spec-dialog-title">เลือกสาขา (เลือกได้หลายค่า)</DialogTitle>
        <DialogContent dividers>
          <List>
            {specialties && specialties.length ? (
              specialties.map((s) => {
                const checked = !!selectedSpecs.find((x) => x.id === s.id);
                return (
                  <ListItem key={s.id} disablePadding>
                    <ListItemButton onClick={() => toggleSpec(s)}>
                      <Checkbox edge="start" checked={checked} tabIndex={-1} />
                      <ListItemText primary={s.name} />
                    </ListItemButton>
                  </ListItem>
                );
              })
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                ไม่พบรายการสาขา
              </Typography>
            )}
          </List>
          {fieldErr.specialties && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {fieldErr.specialties}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSpecDialog}>ยกเลิก</Button>
          <Button onClick={confirmSpecDialog} variant="contained">
            ตกลง
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog สมัครสำเร็จ */}
      <Dialog open={successOpen} TransitionComponent={Transition} keepMounted onClose={() => setSuccessOpen(false)}>
        <DialogTitle>สมัครสมาชิกสำเร็จ</DialogTitle>
        <DialogContent>
          <Typography>สมัครสมาชิกเรียบร้อยแล้ว กด OK เพื่อไปยังหน้าล็อกอิน</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSuccessOk} variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
