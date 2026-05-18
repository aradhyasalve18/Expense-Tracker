import { useState, useEffect, useRef } from "react";
import Analytics from "./Analytics.jsx";
import Login     from "./Login.jsx";
import Signup    from "./Signup.jsx";

const BASE = "http://localhost:5000";

const CATEGORIES = ["Food","Transport","Shopping","Entertainment","Health","Utilities","Other"];
const CAT_ICONS  = { Food:"🍜", Transport:"🚌", Shopping:"🛍️", Entertainment:"🎬", Health:"💊", Utilities:"💡", Other:"📌" };

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(n);

function today() { return new Date().toISOString().split("T")[0]; }

export default function App() {
  // ── Auth state ───────────────────────────────────────────
  const [user,   setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; }
  });
  const [token,  setToken]  = useState(() => localStorage.getItem("token") || null);
  const [authPage, setAuthPage] = useState("login"); // "login" | "signup"

  // ── Expense state ────────────────────────────────────────
  const [expenses,      setExpenses]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [form,          setForm]          = useState({ name:"", amount:"", category:"Other", date:today() });
  const [editId,        setEditId]        = useState(null);
  const [formError,     setFormError]     = useState("");
  const [search,        setSearch]        = useState("");
  const [filterCat,     setFilterCat]     = useState("All");
  const [sortBy,        setSortBy]        = useState("date_desc");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast,         setToast]         = useState(null);
  const [formOpen,      setFormOpen]      = useState(false);
  const [tab,           setTab]           = useState("expenses");
  const nameRef = useRef();

  // ── Fetch expenses when logged in ────────────────────────
  useEffect(() => {
    if (user && token) fetchExpenses();
  }, [user, token]);

  // ── Auth helpers ─────────────────────────────────────────
  function handleLogin(userData, userToken) {
    setUser(userData);
    setToken(userToken);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setExpenses([]);
  }

  // Authenticated fetch helper
  async function authFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...options.headers,
      },
    });
    // If token expired, force logout
    if (res.status === 401) {
      handleLogout();
      throw new Error("Session expired. Please login again.");
    }
    return res;
  }

  // ── Show auth pages if not logged in ─────────────────────
  if (!user || !token) {
    if (authPage === "signup") {
      return <Signup onLogin={handleLogin} onGoLogin={() => setAuthPage("login")} />;
    }
    return <Login onLogin={handleLogin} onGoSignup={() => setAuthPage("signup")} />;
  }

  // ── Expense functions ────────────────────────────────────
  async function fetchExpenses() {
    try {
      setLoading(true); setError(null);
      const res = await authFetch(`${BASE}/api/expenses`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setExpenses(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function resetForm() {
    setForm({ name:"", amount:"", category:"Other", date:today() });
    setEditId(null); setFormError("");
  }

  function openAdd() {
    resetForm(); setFormOpen(true);
    setTimeout(() => nameRef.current?.focus(), 100);
  }

  function openEdit(exp) {
    setForm({
      name: exp.name, amount: String(exp.amount),
      category: exp.category, date: exp.date?.split("T")[0] || today(),
    });
    setEditId(exp.id); setFormOpen(true);
    setTimeout(() => nameRef.current?.focus(), 100);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { name, amount, category, date } = form;
    if (!name.trim())                           return setFormError("Expense name is required.");
    if (!amount || isNaN(amount) || +amount<=0) return setFormError("Enter a valid positive amount.");
    setFormError("");
    const payload = { name: name.trim(), amount: parseFloat(amount), category, date };
    try {
      const url  = editId ? `${BASE}/api/expenses/${editId}` : `${BASE}/api/expenses`;
      const meth = editId ? "PUT" : "POST";
      const res  = await authFetch(url, { method: meth, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      showToast(editId ? "Expense updated!" : "Expense added!");
      resetForm(); setFormOpen(false); fetchExpenses();
    } catch (e) { showToast(e.message, "error"); }
  }

  async function handleDelete(id) {
    try {
      const res = await authFetch(`${BASE}/api/expenses/${id}`, { method:"DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirm(null); fetchExpenses();
      showToast("Expense deleted.", "info");
    } catch (e) { showToast(e.message, "error"); }
  }

  const filtered = expenses
    .filter(e => {
      const ms = e.name.toLowerCase().includes(search.toLowerCase());
      const mc = filterCat==="All" || e.category===filterCat;
      return ms && mc;
    })
    .sort((a,b) => {
      if (sortBy==="date_desc")   return new Date(b.date)-new Date(a.date);
      if (sortBy==="date_asc")    return new Date(a.date)-new Date(b.date);
      if (sortBy==="amount_desc") return b.amount-a.amount;
      if (sortBy==="amount_asc")  return a.amount-b.amount;
      return 0;
    });

  const total      = filtered.reduce((s,e) => s+Number(e.amount), 0);
  const grandTotal = expenses.reduce((s,e) => s+Number(e.amount), 0);
  const catTotals  = CATEGORIES
    .map(cat => ({ cat, total: expenses.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount),0) }))
    .filter(c => c.total > 0);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="app">
      {/* Toast */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.type==="success"&&"✅ "}{toast.type==="error"&&"❌ "}{toast.type==="info"&&"ℹ️ "}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header__brand">
          <span className="header__icon">💸</span>
          <div>
            <h1 className="header__title">Kharcha</h1>
            <p className="header__sub">Expense Tracker</p>
          </div>
        </div>
        <div className="header__right">
          <div className="header__total">
            <span className="header__total-label">Total Spent</span>
            <span className="header__total-amount">{fmtINR(grandTotal)}</span>
          </div>
          <div className="header__user">
            <div className="header__avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="header__user-info">
              <span className="header__user-name">{user.name}</span>
              <button className="header__logout" onClick={handleLogout}>Sign out</button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab==="expenses"?"tab--active":""}`}  onClick={()=>setTab("expenses")}>📋 Expenses</button>
        <button className={`tab ${tab==="analytics"?"tab--active":""}`} onClick={()=>setTab("analytics")}>📊 Analytics</button>
      </div>

      <main className="main">
        {tab==="analytics" ? (
          <Analytics expenses={expenses} />
        ) : (
          <>
            {/* Category chips */}
            {catTotals.length>0 && (
              <section className="summary">
                {catTotals.map(({cat,total})=>(
                  <div key={cat}
                    className={`summary__chip ${filterCat===cat?"summary__chip--active":""}`}
                    onClick={()=>setFilterCat(filterCat===cat?"All":cat)}>
                    <span>{CAT_ICONS[cat]}</span>
                    <span className="summary__chip-name">{cat}</span>
                    <span className="summary__chip-amt">{fmtINR(total)}</span>
                  </div>
                ))}
              </section>
            )}

            {/* Controls */}
            <div className="controls">
              <div className="controls__left">
                <div className="search-wrap">
                  <span className="search-icon">🔍</span>
                  <input className="search" placeholder="Search expenses…"
                    value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
                <select className="select" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
                  <option value="All">All Categories</option>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
                <select className="select" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="amount_desc">Highest Amount</option>
                  <option value="amount_asc">Lowest Amount</option>
                </select>
              </div>
              <button className="btn btn--primary" onClick={openAdd}>+ Add Expense</button>
            </div>

            {/* Form */}
            {formOpen && (
              <div className="form-card">
                <div className="form-card__header">
                  <h2 className="form-card__title">{editId?"Edit Expense":"New Expense"}</h2>
                  <button className="form-card__close" onClick={()=>{setFormOpen(false);resetForm();}}>✕</button>
                </div>
                <form onSubmit={handleSubmit} className="form">
                  <div className="form__row">
                    <label className="form__label">Name</label>
                    <input ref={nameRef} className="form__input" placeholder="e.g. Lunch at Café"
                      value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
                  </div>
                  <div className="form__row">
                    <label className="form__label">Amount (₹)</label>
                    <input className="form__input" type="number" placeholder="0.00" min="0" step="0.01"
                      value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} />
                  </div>
                  <div className="form__row">
                    <label className="form__label">Category</label>
                    <select className="form__input form__select" value={form.category}
                      onChange={e=>setForm({...form,category:e.target.value})}>
                      {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form__row">
                    <label className="form__label">Date</label>
                    <input className="form__input" type="date" value={form.date}
                      onChange={e=>setForm({...form,date:e.target.value})} />
                  </div>
                  {formError && <p className="form__error">{formError}</p>}
                  <div className="form__actions">
                    <button type="button" className="btn btn--ghost"
                      onClick={()=>{setFormOpen(false);resetForm();}}>Cancel</button>
                    <button type="submit" className="btn btn--primary">{editId?"Update":"Add Expense"}</button>
                  </div>
                </form>
              </div>
            )}

            {/* List */}
            <section className="list-section">
              {loading && <div className="state-msg">Loading expenses…</div>}
              {error   && <div className="state-msg state-msg--error">⚠️ {error}</div>}
              {!loading && !error && filtered.length===0 && (
                <div className="state-msg">No expenses yet. Add your first one!</div>
              )}
              {!loading && !error && filtered.length>0 && (
                <>
                  <div className="list-header">
                    <span>{filtered.length} expense{filtered.length!==1?"s":""}</span>
                    <span className="list-header__total">{fmtINR(total)}</span>
                  </div>
                  <ul className="expense-list">
                    {filtered.map(exp=>(
                      <li key={exp.id} className="expense-item">
                        <div className="expense-item__icon">{CAT_ICONS[exp.category]||"📌"}</div>
                        <div className="expense-item__body">
                          <span className="expense-item__name">{exp.name}</span>
                          <span className="expense-item__meta">
                            <span className="expense-item__cat">{exp.category}</span>
                            <span className="expense-item__date">
                              {new Date(exp.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
                            </span>
                          </span>
                        </div>
                        <span className="expense-item__amount">{fmtINR(exp.amount)}</span>
                        <div className="expense-item__actions">
                          <button className="icon-btn icon-btn--edit"   title="Edit"   onClick={()=>openEdit(exp)}>✏️</button>
                          <button className="icon-btn icon-btn--delete" title="Delete" onClick={()=>setDeleteConfirm(exp.id)}>🗑️</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </>
        )}
      </main>

      {/* Delete modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 className="modal__title">Delete Expense?</h3>
            <p className="modal__body">This action cannot be undone.</p>
            <div className="modal__actions">
              <button className="btn btn--ghost"  onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={()=>handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
