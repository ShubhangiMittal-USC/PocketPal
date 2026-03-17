"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

const USER_ID = "demo";

type DayEntry     = { date: string; [habit: string]: string | number };
type InsightsData = {
  window_days:     number;
  habit_totals:    Record<string, number>;
  habit_daily:     Record<string, number[]>;
  daily_series:    DayEntry[];
  streaks:         Record<string, number>;
  plan_completion: Record<string, number>;
  avg_completion:  number;
};

const HABIT_META: Record<string, { label: string; unit: string; emoji: string; color: string; trackColor: string; max: number }> = {
  water_liters: { label: "Water",    unit: "L",    emoji: "💧", color: "#7dd3fc", trackColor: "#e0f2fe", max: 3     },
  steps:        { label: "Steps",    unit: "k",    emoji: "👟", color: "#6ee7b7", trackColor: "#d1fae5", max: 15000 },
  calories:     { label: "Calories", unit: "kcal", emoji: "🔥", color: "#fdba74", trackColor: "#ffedd5", max: 2500  },
  sleep_hours:  { label: "Sleep",    unit: "h",    emoji: "😴", color: "#c4b5fd", trackColor: "#ede9fe", max: 10    },
  mood_score:   { label: "Mood",     unit: "/10",  emoji: "✨", color: "#f9a8d4", trackColor: "#fce7f3", max: 10    },
};

function fmtAvg(habit: string, val: number): string {
  if (habit === "steps")        return val >= 1000 ? `${(val/1000).toFixed(1)}k` : String(Math.round(val));
  if (habit === "water_liters") return `${val.toFixed(1)}L`;
  if (habit === "sleep_hours")  return `${val.toFixed(1)}h`;
  if (habit === "mood_score")   return `${val.toFixed(1)}/10`;
  return String(Math.round(val));
}

// "Mar 7" → just the day number for tight axis labels
function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Area / line chart (sleep, water) — no dots, just soft curve ──────────────
function AreaChart({
  data, habit, color, trackColor, max,
}: { data: DayEntry[]; habit: string; color: string; trackColor: string; max: number }) {
  if (!data.length) return null;
  const W = 280, H = 90, PL = 6, PR = 6, PT = 8, PB = 22;
  const plotW = W - PL - PR, plotH = H - PT - PB;

  const vals = data.map(e => Number(e[habit] ?? 0));
  const pts  = vals.map((v, i) => ({
    x: PL + (i / Math.max(data.length - 1, 1)) * plotW,
    y: PT + (1 - Math.min(v / max, 1)) * plotH,
  }));

  function smoothPath(p: {x:number;y:number}[]) {
    return p.map((pt, i) => {
      if (i === 0) return `M${pt.x},${pt.y}`;
      const prev = p[i-1];
      const cx   = (prev.x + pt.x) / 2;
      return `C${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
    }).join(" ");
  }

  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length-1].x},${PT+plotH} L${pts[0].x},${PT+plotH} Z`;

  // x-axis labels: show a subset so they don't crowd
  const step   = data.length <= 7 ? 1 : data.length <= 14 ? 2 : 5;
  const labels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`ag-${habit}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* soft grid line */}
      <line x1={PL} y1={PT + plotH * 0.5} x2={PL + plotW} y2={PT + plotH * 0.5}
        stroke={trackColor} strokeWidth="1" strokeDasharray="3 3" />
      <path d={area} fill={`url(#ag-${habit})`} />
      <path d={line}  fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* x-axis date labels */}
      {data.map((e, i) => {
        if (i % step !== 0 && i !== data.length - 1) return null;
        const x = PL + (i / Math.max(data.length - 1, 1)) * plotW;
        return (
          <text key={i} x={x} y={H - 4} textAnchor="middle"
            fontSize="9" fill="#c4b5d1" fontFamily="DM Sans, sans-serif">
            {dayLabel(e.date)}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Donut chart (mood) ────────────────────────────────────────────────────────
function DonutChart({ value, max, color, trackColor }: { value: number; max: number; color: string; trackColor: string }) {
  const size = 110, r = 40, cx = size/2, cy = size/2;
  const circ  = 2 * Math.PI * r;
  const pct   = Math.min(value / max, 1);
  const offset = circ - pct * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="17" fontWeight="600" fill="#2d2d2d"
        fontFamily="Instrument Serif, serif">{value.toFixed(1)}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="10" fill="#c4b5d1"
        fontFamily="DM Sans, sans-serif">/ 10</text>
    </svg>
  );
}

// ─── Horizontal bars (calories) ───────────────────────────────────────────────
function HorizBars({ data, habit, color, trackColor, max }: {
  data: DayEntry[]; habit: string; color: string; trackColor: string; max: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {data.slice(-5).map((e, i) => {
        const val = Number(e[habit] ?? 0);
        const pct = Math.min((val / max) * 100, 100);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 10, color: "#c4b5d1", width: 32, flexShrink: 0, letterSpacing: "-0.01em" }}>
              {dayLabel(e.date)}
            </div>
            <div style={{ flex: 1, height: 10, background: trackColor, borderRadius: 8, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%", background: color,
                borderRadius: 8, transition: "width 1s cubic-bezier(.4,0,.2,1)",
              }} />
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", width: 36, textAlign: "right" }}>{Math.round(val)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Vertical bars (steps) — taller, rounder, with date labels ────────────────
function VertBars({ data, habit, color, trackColor, max }: {
  data: DayEntry[]; habit: string; color: string; trackColor: string; max: number;
}) {
  // show a subset of date labels so they don't overlap
  const step = data.length <= 7 ? 1 : data.length <= 14 ? 2 : 5;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 88 }}>
        {data.map((e, i) => {
          const val = Number(e[habit] ?? 0);
          const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
          return (
            <div key={i} title={`${dayLabel(e.date)}: ${val.toLocaleString()}`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "100%", height: 76, display: "flex", alignItems: "flex-end" }}>
                <div style={{
                  width: "100%",
                  height: pct > 0 ? `${Math.max(pct, 6)}%` : "6%",
                  background: pct > 0 ? color : trackColor,
                  borderRadius: "5px 5px 3px 3px",
                  transition: "height 1s cubic-bezier(.4,0,.2,1)",
                  opacity: pct > 0 ? 1 : 0.4,
                }} />
              </div>
            </div>
          );
        })}
      </div>
      {/* date row below bars */}
      <div style={{ display: "flex", gap: 4 }}>
        {data.map((e, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#c4b5d1", lineHeight: 1 }}>
            {(i % step === 0 || i === data.length - 1) ? dayLabel(e.date) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Completion sparkline card ─────────────────────────────────────────────────
function CompletionCard({ data, days, avg }: { data: Record<string, number>; days: number; avg: number }) {
  const today  = new Date();
  const points = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i));
    const k = d.toISOString().slice(0, 10);
    return { date: k, val: data[k] ?? null };
  });
  const W = 180, H = 48, PAD = 4, plotW = W - PAD * 2, plotH = H - PAD * 2;
  const filtered = points
    .map((p, i) => p.val !== null ? { x: PAD + (i / (points.length - 1)) * plotW, y: PAD + (1 - p.val / 100) * plotH } : null)
    .filter(Boolean) as { x: number; y: number }[];
  function smooth(pts: { x: number; y: number }[]) {
    return pts.map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = pts[i - 1], cx = (prev.x + p.x) / 2;
      return `C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    }).join(" ");
  }
  const line = filtered.length > 1 ? smooth(filtered) : "";
  const area = line ? `${line} L${filtered[filtered.length-1].x},${PAD+plotH} L${filtered[0].x},${PAD+plotH} Z` : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "Instrument Serif,serif", fontSize: 36, color: "#1c1c1e", lineHeight: 1 }}>{avg}%</div>
        <div style={{ fontSize: 11, color: "#c4b5d1", marginTop: 3 }}>avg completion</div>
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
        {Object.entries(data).slice(-7).map(([d, pct]) => (
          <div key={d} style={{ textAlign: "center" }}>
            <div style={{ height: 36, width: 20, background: "#fdf2f8", borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
              <div style={{ width: "100%", height: `${pct}%`, background: "#f9a8d4", borderRadius: 6, minHeight: 2, transition: "height 1s cubic-bezier(.4,0,.2,1)" }} />
            </div>
            <div style={{ fontSize: 9, color: "#c4b5d1", marginTop: 3 }}>{dayLabel(d).split(" ")[1]}</div>
          </div>
        ))}
      </div>
      {line && (
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f9a8d4" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#sg)" />
          <path d={line} fill="none" stroke="#f9a8d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [data,    setData]    = useState<InsightsData | null>(null);
  const [days,    setDays]    = useState(7);
  const [loading, setLoading] = useState(true);

  async function fetchInsights(d: number) {
    setLoading(true);
    try {
      const res = await fetch(`https://pocketpal-production-d2ae.up.railway.app/insights?user_id=${USER_ID}&days=${d}`);
      setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { fetchInsights(days); }, [days]);

  const habits  = useMemo(() => Object.keys(data?.habit_totals ?? {}), [data]);
  const hasData = habits.length > 0 || (data && Object.keys(data.plan_completion).length > 0);

  function avgForHabit(habit: string): number {
    if (!data) return 0;
    const series       = data.daily_series ?? [];
    const daysWithData = series.filter(e => Number(e[habit] ?? 0) > 0);
    if (!daysWithData.length) return 0;
    return daysWithData.reduce((s, e) => s + Number(e[habit] ?? 0), 0) / daysWithData.length;
  }

  function renderChart(habit: string) {
    if (!data) return null;
    const meta   = HABIT_META[habit];
    const series = data.daily_series ?? [];
    if (!series.length) return null;

    if (habit === "mood_score") return (
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <DonutChart value={avgForHabit(habit)} max={10} color={meta.color} trackColor={meta.trackColor} />
        <div>
          <div style={{ fontSize: 11, color: "#c4b5d1", marginBottom: 6 }}>avg mood score</div>
          <div style={{ fontFamily: "Instrument Serif,serif", fontSize: 28, color: "#1c1c1e", lineHeight: 1 }}>
            {avgForHabit(habit).toFixed(1)}
            <span style={{ fontSize: 14, color: "#c4b5d1", fontFamily: "DM Sans,sans-serif" }}> / 10</span>
          </div>
        </div>
      </div>
    );
    if (habit === "calories")   return <HorizBars data={series} habit={habit} color={meta.color} trackColor={meta.trackColor} max={meta.max} />;
    if (habit === "sleep_hours") return <AreaChart data={series} habit={habit} color={meta.color} trackColor={meta.trackColor} max={meta.max} />;
    // water + steps → same vert bars for steps, area for water
    if (habit === "water_liters") return <AreaChart data={series} habit={habit} color={meta.color} trackColor={meta.trackColor} max={meta.max} />;
    return <VertBars data={series} habit={habit} color={meta.color} trackColor={meta.trackColor} max={meta.max} />;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#fdf2f8;font-family:'DM Sans',sans-serif}
        .page{display:grid;grid-template-columns:280px 1fr;height:100svh;overflow:hidden}
        .sidebar{background:white;border-right:1px solid #fce7f3;display:flex;flex-direction:column;padding:28px 20px;gap:24px;overflow-y:auto}
        .logo-row{display:flex;align-items:center;gap:10px}
        .logo-blob{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#f9a8d4,#fda4af);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .logo-text{font-family:'Instrument Serif',serif;font-size:22px;color:#1c1c1e}
        .sidebar-nav{display:flex;flex-direction:column;gap:6px;margin-top:auto}
        .nav-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:500;color:#9ca3af;cursor:pointer;text-decoration:none;border:none;background:transparent;width:100%;text-align:left;transition:background .15s,color .15s}
        .nav-btn:hover{background:#fdf2f8;color:#be185d}
        .nav-btn.active{background:#fdf2f8;color:#be185d;font-weight:600}
        .main{display:flex;flex-direction:column;height:100svh;overflow:hidden}
        .topbar{padding:22px 28px 0;flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between}
        .topbar-title{font-family:'Instrument Serif',serif;font-size:28px;color:#1c1c1e;font-style:italic}
        .topbar-sub{font-size:13px;color:#c4b5d1;margin-top:2px}
        .back-btn{background:white;border:1.5px solid #fce7f3;border-radius:14px;padding:8px 16px;font-size:13px;font-weight:500;color:#f472b6;text-decoration:none;transition:background .15s;flex-shrink:0}
        .back-btn:hover{background:#fdf2f8}
        .scroll-area{flex:1;overflow-y:auto;padding:16px 28px 32px;scrollbar-width:thin;scrollbar-color:#fce7f3 transparent}
        .scroll-area::-webkit-scrollbar{width:4px}
        .scroll-area::-webkit-scrollbar-thumb{background:#fce7f3;border-radius:4px}
        .window-pills{display:flex;gap:8px;margin-bottom:18px}
        .pill-btn{padding:5px 16px;border-radius:20px;border:1.5px solid #fce7f3;font-size:12px;font-weight:500;cursor:pointer;background:white;color:#c4b5d1;transition:all .15s;letter-spacing:.01em}
        .pill-btn.active{background:#fdf2f8;color:#be185d;border-color:#f9a8d4}
        .completion-card{background:white;border:1.5px solid #fce7f3;border-radius:22px;padding:20px 22px;margin-bottom:18px}
        .section-label{font-size:10px;font-weight:600;color:#d8b4d8;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px}
        .habits-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .habit-card{background:white;border:1.5px solid #fce7f3;border-radius:20px;padding:18px}
        .habit-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px}
        .habit-title-row{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:#374151}
        .habit-emoji{font-size:16px;line-height:1}
        .habit-avg-text{font-size:11px;color:#c4b5d1;text-align:right;line-height:1.4}
        .streak-badge{display:inline-flex;align-items:center;gap:3px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:2px 8px;font-size:10px;color:#ea580c;font-weight:600;margin-top:5px}
        .skel{background:white;border-radius:20px;border:1.5px solid #fce7f3;animation:pulse 1.6s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
        .empty-state{text-align:center;padding:64px 20px;color:#c4b5d1}
        .empty-title{font-family:'Instrument Serif',serif;font-size:24px;color:#1c1c1e;margin:14px 0 6px;font-style:italic}
        @media(max-width:640px){.page{grid-template-columns:1fr}.sidebar{display:none}.topbar,.scroll-area{padding-left:18px;padding-right:18px}.habits-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="page">
        <aside className="sidebar">
          <div className="logo-row">
            <div className="logo-blob">📊</div>
            <span className="logo-text">PocketPal</span>
          </div>
          <div style={{ fontSize: 12, color: "#c4b5d1", lineHeight: 1.8 }}>
            <span style={{ color: "#374151", fontWeight: 600 }}>Insights</span><br /><br />
            Track your habits, trends and streaks over time.<br /><br />
            Log habits in <span style={{ color: "#f472b6" }}>Chat</span> and mark blocks done in <span style={{ color: "#f472b6" }}>Planner</span>.
          </div>
          <div className="sidebar-nav">
            <Link className="nav-btn" href="/">💬 Chat</Link>
            <Link className="nav-btn" href="/planner">🎀 Planner</Link>
            <Link className="nav-btn" href="/meals">🍱 Meals</Link>
            <Link className="nav-btn active" href="/insights">📊 Insights</Link>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">Your Insights ✦</div>
              <div className="topbar-sub">Streaks, trends and weekly summaries</div>
            </div>
            <Link href="/" className="back-btn">← Chat</Link>
          </div>

          <div className="scroll-area">
            <div className="window-pills" style={{ marginTop: 14 }}>
              {[7, 14, 30].map(d => (
                <button key={d} className={`pill-btn ${days === d ? "active" : ""}`} onClick={() => setDays(d)}>
                  {d}d
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="skel" style={{ height: 92 }} />
                <div className="habits-grid">
                  {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 160, animationDelay: `${i * .12}s` }} />)}
                </div>
              </div>
            ) : !hasData ? (
              <div className="empty-state">
                <div style={{ fontSize: 52 }}>🌸</div>
                <div className="empty-title">Nothing here yet</div>
                <div style={{ fontSize: 13 }}>Log habits in Chat and mark plan blocks done to see your insights bloom ✿</div>
              </div>
            ) : (
              <>
                {data && Object.keys(data.plan_completion).length > 0 && (
                  <>
                    <div className="section-label">Plan Completion</div>
                    <div className="completion-card">
                      <CompletionCard data={data.plan_completion} days={days} avg={data.avg_completion} />
                    </div>
                  </>
                )}

                {habits.length > 0 && (
                  <>
                    <div className="section-label">Daily Averages · Last {days} days</div>
                    <div className="habits-grid">
                      {habits.map(h => {
                        const meta   = HABIT_META[h];
                        const avg    = avgForHabit(h);
                        const streak = data!.streaks[h] ?? 0;
                        return (
                          <div key={h} className="habit-card">
                            <div className="habit-header">
                              <div className="habit-title-row">
                                <span className="habit-emoji">{meta?.emoji ?? "📌"}</span>
                                <span>{meta?.label ?? h}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                <div className="habit-avg-text">{fmtAvg(h, avg)} / day</div>
                                {streak > 0 && <div className="streak-badge">🔥 {streak}d</div>}
                              </div>
                            </div>
                            {renderChart(h)}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
