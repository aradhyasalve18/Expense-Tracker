import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
  LineChart, Line,
} from "recharts";

const COLORS = ["#c05621","#e07b39","#f59e0b","#84cc16","#22d3ee","#818cf8","#f472b6"];
const CATEGORIES = ["Food","Transport","Shopping","Entertainment","Health","Utilities","Other"];
const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(n);

function shortMonth(ym) {
  const [y, m] = ym.split("-");
  return new Date(y, m - 1).toLocaleDateString("en-IN", { month:"short", year:"2-digit" });
}
function shortDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short" });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip__label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill || "#c05621" }}>
          {p.name}: <b>{fmtINR(p.value)}</b>
        </p>
      ))}
    </div>
  );
};

export default function Analytics({ expenses }) {
  const categoryData = useMemo(() =>
    CATEGORIES
      .map(cat => ({
        name: cat,
        value: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
        count: expenses.filter(e => e.category === cat).length,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value),
  [expenses]);

  const monthData = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      const m = e.date?.slice(0, 7);
      if (!m) return;
      map[m] = (map[m] || 0) + Number(e.amount);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, total]) => ({ month: shortMonth(month), total: Math.round(total * 100) / 100 }));
  }, [expenses]);

  const dailyData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const map = {};
    expenses.forEach(e => {
      const d = e.date?.split("T")[0];
      if (!d || new Date(d) < cutoff) return;
      map[d] = (map[d] || 0) + Number(e.amount);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date: shortDate(date), total: Math.round(total * 100) / 100 }));
  }, [expenses]);

  const grandTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const top = categoryData[0];

  if (expenses.length === 0) {
    return (
      <div className="analytics-empty">
        <span className="analytics-empty__icon">📊</span>
        <p>No data yet. Add some expenses to see analytics!</p>
      </div>
    );
  }

  return (
    <div className="analytics">
      {/* KPI row */}
      <div className="kpi-row">
        <div className="kpi">
          <span className="kpi__label">Total Spent</span>
          <span className="kpi__value">{fmtINR(grandTotal)}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Transactions</span>
          <span className="kpi__value">{expenses.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Avg per Expense</span>
          <span className="kpi__value">{fmtINR(grandTotal / expenses.length)}</span>
        </div>
        {top && (
          <div className="kpi">
            <span className="kpi__label">Top Category</span>
            <span className="kpi__value kpi__value--sm">{top.name}</span>
            <span className="kpi__sub">{fmtINR(top.value)}</span>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Donut */}
        <div className="chart-card chart-card--donut">
          <h3 className="chart-card__title">Spending by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3}>
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8}
                formatter={v => <span style={{ fontSize:12, color:"var(--text-2)" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar */}
        <div className="chart-card">
          <h3 className="chart-card__title">Category Breakdown</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} margin={{ top:4, right:8, left:0, bottom:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--text-3)" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => fmtINR(v)} tick={{ fontSize:10, fill:"var(--text-3)" }}
                tickLine={false} axisLine={false} width={72} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(192,86,33,0.06)" }} />
              <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly trend */}
        {monthData.length > 0 && (
          <div className="chart-card chart-card--wide">
            <h3 className="chart-card__title">Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthData} margin={{ top:4, right:16, left:0, bottom:4 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c05621" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c05621" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize:11, fill:"var(--text-3)" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={v => fmtINR(v)} tick={{ fontSize:10, fill:"var(--text-3)" }}
                  tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" name="Monthly Spend"
                  stroke="#c05621" strokeWidth={2.5} fill="url(#areaGrad)"
                  dot={{ fill:"#c05621", r:4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily - last 30 days */}
        {dailyData.length > 1 && (
          <div className="chart-card chart-card--wide">
            <h3 className="chart-card__title">Daily Spend — Last 30 Days</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData} margin={{ top:4, right:16, left:0, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize:10, fill:"var(--text-3)" }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => fmtINR(v)} tick={{ fontSize:10, fill:"var(--text-3)" }}
                  tickLine={false} axisLine={false} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="total" name="Daily Spend"
                  stroke="#e07b39" strokeWidth={2}
                  dot={{ fill:"#e07b39", r:3 }} activeDot={{ r:5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Summary table */}
        <div className="chart-card chart-card--wide">
          <h3 className="chart-card__title">Category Summary</h3>
          <table className="cat-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Transactions</th>
                <th>Total</th>
                <th>% of Spend</th>
                <th>Bar</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((d, i) => (
                <tr key={d.name}>
                  <td><span className="cat-dot" style={{ background: COLORS[i % COLORS.length] }} />{d.name}</td>
                  <td>{d.count}</td>
                  <td><b>{fmtINR(d.value)}</b></td>
                  <td>{grandTotal > 0 ? ((d.value / grandTotal) * 100).toFixed(1) : 0}%</td>
                  <td>
                    <div className="cat-bar-wrap">
                      <div className="cat-bar" style={{
                        width: grandTotal > 0 ? `${(d.value / grandTotal) * 100}%` : "0%",
                        background: COLORS[i % COLORS.length],
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
