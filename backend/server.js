const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
require("dotenv").config();

const User    = require("./models/User");
const Expense = require("./models/Expense");

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_this";

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
  ],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json());

// ── MongoDB Connection ────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅  MongoDB connected successfully"))
  .catch(err => console.error("❌  MongoDB connection failed:", err.message));

// ── Auth Middleware ───────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided. Please login." });
  }
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token. Please login again." });
  }
}

// ── Health ────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  const state = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  if (state === 1) {
    res.json({ status: "ok", db: "connected" });
  } else {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// ══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim())       return res.status(400).json({ error: "Name is required" });
    if (!email?.trim())      return res.status(400).json({ error: "Email is required" });
    if (!password)            return res.status(400).json({ error: "Password is required" });
    if (password.length < 6)  return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name: name.trim(), email: email.toLowerCase(), password: hashed });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email },
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
    if (!password)       return res.status(400).json({ error: "Password is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ══════════════════════════════════════════════════════════
//  EXPENSE ROUTES  (all protected)
// ══════════════════════════════════════════════════════════

// Helper: convert Mongoose doc to plain object matching old MySQL shape
function fmt(doc) {
  const o = doc.toObject({ virtuals: false });
  return {
    id:         o._id,
    user_id:    o.user_id,
    name:       o.name,
    amount:     o.amount,
    category:   o.category,
    date:       o.date,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  };
}

// GET /api/expenses
app.get("/api/expenses", authMiddleware, async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = { user_id: req.user.id };
    if (category && category !== "All") query.category = category;
    if (search) query.name = { $regex: search, $options: "i" };

    const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 });
    res.json(expenses.map(fmt));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/:id
app.get("/api/expenses/:id", authMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!expense) return res.status(404).json({ error: "Not found" });
    res.json(fmt(expense));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses
app.post("/api/expenses", authMiddleware, async (req, res) => {
  try {
    const { name, amount, category, date } = req.body;
    if (!name?.trim())                            return res.status(400).json({ error: "name required" });
    if (!amount || isNaN(amount) || +amount <= 0) return res.status(400).json({ error: "valid amount required" });
    if (!category)                                return res.status(400).json({ error: "category required" });
    if (!date)                                    return res.status(400).json({ error: "date required" });

    const expense = await Expense.create({
      user_id:  req.user.id,
      name:     name.trim(),
      amount:   parseFloat(amount),
      category,
      date:     new Date(date),
    });
    res.status(201).json(fmt(expense));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id
app.put("/api/expenses/:id", authMiddleware, async (req, res) => {
  try {
    const { name, amount, category, date } = req.body;
    if (!name?.trim())                            return res.status(400).json({ error: "name required" });
    if (!amount || isNaN(amount) || +amount <= 0) return res.status(400).json({ error: "valid amount required" });
    if (!category)                                return res.status(400).json({ error: "category required" });
    if (!date)                                    return res.status(400).json({ error: "date required" });

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      { name: name.trim(), amount: parseFloat(amount), category, date: new Date(date) },
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ error: "Not found" });
    res.json(fmt(expense));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id
app.delete("/api/expenses/:id", authMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!expense) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted", id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  ANALYTICS  (protected)
// ══════════════════════════════════════════════════════════

// GET /api/analytics/by-category
app.get("/api/analytics/by-category", authMiddleware, async (req, res) => {
  try {
    const data = await Expense.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: {
          _id:   "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
      }},
      { $sort: { total: -1 } },
      { $project: { _id:0, category:"$_id", total:{ $round:["$total",2] }, count:1 } },
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/by-month
app.get("/api/analytics/by-month", authMiddleware, async (req, res) => {
  try {
    const data = await Expense.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
      { $limit: 12 },
      { $project: { _id:0, month:"$_id", total:{ $round:["$total",2] }, count:1 } },
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/by-day  (last 30 days)
app.get("/api/analytics/by-day", authMiddleware, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data = await Expense.aggregate([
      { $match: {
          user_id: new mongoose.Types.ObjectId(req.user.id),
          date: { $gte: thirtyDaysAgo },
      }},
      { $group: {
          _id:   { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
      { $project: { _id:0, date:"$_id", total:{ $round:["$total",2] }, count:1 } },
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Server running → http://localhost:${PORT}`);
  console.log(`   Health check  → http://localhost:${PORT}/api/health\n`);
});
