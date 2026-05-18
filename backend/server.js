const express  = require("express");
const cors     = require("cors");
const mysql    = require("mysql2/promise");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
require("dotenv").config();

const app       = express();
const PORT      = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_this";

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000","https://expense-tracker-omega-nine-58.vercel.app"],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// ── DB Pool ───────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  database:           process.env.DB_NAME     || "expense_tracker",
  port:               Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit:    10,
});

pool.query("SELECT 1")
  .then(() => console.log("✅  MySQL connected successfully"))
  .catch(err => console.error("❌  MySQL connection failed:", err.message));

// ── Auth Middleware ───────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided. Please login." });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token. Please login again." });
  }
}

// ── Health ────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim())     return res.status(400).json({ error: "Name is required" });
    if (!email?.trim())    return res.status(400).json({ error: "Email is required" });
    if (!password)         return res.status(400).json({ error: "Password is required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    // Check if email already exists
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Hash password and save user
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name.trim(), email.toLowerCase(), hashed]
    );

    // Generate token
    const token = jwt.sign(
      { id: result.insertId, name: name.trim(), email: email.toLowerCase() },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: { id: result.insertId, name: name.trim(), email: email.toLowerCase() },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: "Email is required" });
    if (!password)      return res.status(400).json({ error: "Password is required" });

    // Find user
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = rows[0];

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — verify token & return user info
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ══════════════════════════════════════════════════════════
//  EXPENSE ROUTES (all protected — require login)
// ══════════════════════════════════════════════════════════

// GET all expenses (for logged-in user only)
app.get("/api/expenses", authMiddleware, async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = "SELECT * FROM expenses WHERE user_id = ?";
    const params = [req.user.id];
    if (category && category !== "All") { sql += " AND category = ?"; params.push(category); }
    if (search)                          { sql += " AND name LIKE ?";  params.push(`%${search}%`); }
    sql += " ORDER BY date DESC, created_at DESC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET one expense
app.get("/api/expenses/:id", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM expenses WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — create expense
app.post("/api/expenses", authMiddleware, async (req, res) => {
  try {
    const { name, amount, category, date } = req.body;
    if (!name?.trim())                            return res.status(400).json({ error: "name required" });
    if (!amount || isNaN(amount) || +amount <= 0) return res.status(400).json({ error: "valid amount required" });
    if (!category)                                return res.status(400).json({ error: "category required" });
    if (!date)                                    return res.status(400).json({ error: "date required" });

    const [r] = await pool.query(
      "INSERT INTO expenses (user_id, name, amount, category, date) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, name.trim(), parseFloat(amount), category, date]
    );
    const [rows] = await pool.query("SELECT * FROM expenses WHERE id = ?", [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT — update expense
app.put("/api/expenses/:id", authMiddleware, async (req, res) => {
  try {
    const { name, amount, category, date } = req.body;
    if (!name?.trim())                            return res.status(400).json({ error: "name required" });
    if (!amount || isNaN(amount) || +amount <= 0) return res.status(400).json({ error: "valid amount required" });
    if (!category)                                return res.status(400).json({ error: "category required" });
    if (!date)                                    return res.status(400).json({ error: "date required" });

    const [r] = await pool.query(
      "UPDATE expenses SET name = ?, amount = ?, category = ?, date = ? WHERE id = ? AND user_id = ?",
      [name.trim(), parseFloat(amount), category, date, req.params.id, req.user.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
    const [rows] = await pool.query("SELECT * FROM expenses WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE — delete expense
app.delete("/api/expenses/:id", authMiddleware, async (req, res) => {
  try {
    const [r] = await pool.query(
      "DELETE FROM expenses WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: Number(req.params.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics (protected) ─────────────────────────────────

app.get("/api/analytics/by-category", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT category, ROUND(SUM(amount),2) AS total, COUNT(*) AS count
       FROM expenses WHERE user_id = ? GROUP BY category ORDER BY total DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/analytics/by-month", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date,'%Y-%m') AS month, ROUND(SUM(amount),2) AS total, COUNT(*) AS count
       FROM expenses WHERE user_id = ? GROUP BY month ORDER BY month ASC LIMIT 12`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/analytics/by-day", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT date, ROUND(SUM(amount),2) AS total, COUNT(*) AS count
       FROM expenses WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY date ORDER BY date ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Server running → http://localhost:${PORT}`);
  console.log(`   Health check  → http://localhost:${PORT}/api/health\n`);
});
