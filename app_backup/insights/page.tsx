"use client";

import { useEffect, useState, useMemo } from "react";

const USER_ID = "demo";

type DayEntry = { date: string; [habit: string]: string | number };
type InsightsData = {
  window_days:     number;
  habit_totals:    Record<string, number>;
  daily_series:    DayEntry[];
  streaks:         Record<string, number>;
  plan_completion: Record<string, number>;
  avg_completion:  number;
};

const HABIT_META: Record<string, { label: string; unit: string; emoji: string; color: string; max: number }> = {
  water_liters: { label: "Water",   unit: "L",   emoji: "💧", color: "#38bdf8", max: 3 },
  steps:        { label: "Steps",   unit: "k",   emoji: "👟", color: "#34d399", max: 15000 },
  calories:     { label: "Calories",unit: "kcal",emoji: "🔥", color: "#fb923c", max: 2500 },
  sleep_hours:  { label: "Sleep",   unit: "h",   emoji: "😴", color: "#a78bfa", max: 10 },
  mood_score:   { label: "Mood",    unit: "/10", emoji: "✨", color: "#f472b6", max: 10 },
};

function fmt(habit: string, val: number): string {
  if (habit === "steps") return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val);
  if (habit === "water_liters") return `${val.toFixed(1)}L`;
  if (habit === "sleep_hours") return `${val.toFixed(1)}h`;
  if (habit === "mood_score") return `${val.toFixed(1)}/10`;
  return String(Math.round(val));
}

function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Mini bar chart component
function MiniBarChart({ data, habit, color, max }: { data: DayEntry[]; habit: string; color: string; max: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56 }}>
      {data.map((entry, i) => {
        const val = Number(entry[habit] ?? 0);
        const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: "100%", height: 44, display: "flex", alignItems: "flex-end" }}>
              <div style={{
                width: "100%",
                height: `${Math.max(pct, 4)}%`,
                background: pct > 0 ? color : "#f3f4f6",
                borderRadius: 4,
                transition: `height 0.8s cubic-bezier(.4,0,.2,1) ${i * 0.05}s`,
                opacity: pct > 0 ? 0.85 + (pct / 100) * 0.15 : 1,
              }} />
            </div>
            <div style={{ fontSize: 9, color: "#9ca3af", whiteSpace: "nowrap" }}>
              {shortDate(entry.date).split(" ")[0].slice(0,3)}{" "}{shortDate(entry.date).split(" ")[1]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Completion line sparkline
function CompletionSparkline({ data, days }: { data: Record<string, number>; days: number }) {
  const today  = new Date();
  const points = Array.from({ length: days }, (_, i) => {
    const d  = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const k  = d.toISOString().slice(0, 10);
    return { date: k, val: data[k] ?? null };
  });

  const W = 260, H = 60, PAD = 8;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  const path = points
    .map((p, i) => {
      if (p.val === null) return null;
      const x = PAD + (i / (points.length - 1)) * plotW;
      const y = PAD + (1 - p.val / 100) * plotH;
      return `${i === 0 || points.slice(0, i).every(q => q.val === null) ? "M" : "L"}${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f472b6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {path && (
        <>
          <path d={`${path} L${PAD + plotW},${PAD + plotH} L${PAD},${PAD + plotH} Z`}
            fill="url(#sparkGrad)" />
          <path d={path} fill="none" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {points.map((p, i) => p.val !== null && (
        <circle key={i}
          cx={PAD + (i / (points.length - 1)) * plotW}
          cy={PAD + (1 - p.val / 100) * plotH}
          r="3.5" fill="white" stroke="#f472b6" strokeWidth="2" />
      ))}
    </svg>
  );
}

export default function InsightsPage() {
  const [data,    setData]    = useState<InsightsData | null>(null);
  const [days,    setDays]    = useState(7);
  const [loading, setLoading] = useState(true);

  async function fetchInsights(d: number) {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/insights?user_id=${USER_ID}&days=${d}`);
      setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { fetchInsights(days); }, [days]);

  const habits  = useMemo(() => Object.keys(data?.habit_totals ?? {}), [data]);
  const hasData = habits.length > 0 || (data && Object.keys(data.plan_completion).length > 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fdf2f8; font-family: 'DM Sans', sans-serif; }

        .page { min-height:100svh; display:grid; grid-template-columns:280px 1fr; height:100svh; overflow:hidden; }

        .sidebar { background:white; border-right:1px solid #fce7f3; display:flex; flex-direction:column; padding:28px 20px; gap:24px; overflow-y:auto; }
        .logo-blob { width:42px; height:42px; border-radius:14px; background:linear-gradient(135deg,#f472b6,#fda4af); display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 4px 16px rgba(244,114,182,0.35); flex-shrink:0; }
        .logo-text { font-family:'Instrument Serif',serif; font-size:22px; color:#1c1c1e; }
        .logo-row { display:flex; align-items:center; gap:10px; }
        .sidebar-nav { display:flex; flex-direction:column; gap:6px; margin-top:auto; }
        .nav-btn { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:12px; font-size:13px; font-weight:500; color:#6b7280; cursor:pointer; text-decoration:none; border:none; background:transparent; width:100%; text-align:left; transition:background 0.15s,color 0.15s; }
        .nav-btn:hover { background:#fdf2f8; color:#be185d; }
        .nav-btn.active { background:linear-gradient(135deg,#fce7f3,#fdf4ff); color:#be185d; font-weight:600; }

        .main { display:flex; flex-direction:column; height:100svh; overflow:hidden; background:#fdf2f8; }
        .topbar { padding:24px 32px 0; flex-shrink:0; display:flex; align-items:flex-start; justify-content:space-between; }
        .topbar-title { font-family:'Instrument Serif',serif; font-size:30px; color:#1c1c1e; font-style:italic; }
        .topbar-sub { font-size:13px; color:#9ca3af; margin-top:3px; }
        .scroll-area { flex:1; overflow-y:auto; padding:20px 32px 32px; scrollbar-width:thin; scrollbar-color:#fce7f3 transparent; }

        /* Window selector */
        .window-pills { display:flex; gap:8px; margin-bottom:24px; flex-wrap:wrap; }
        .pill-btn { padding:6px 16px; border-radius:20px; border:1.5px solid #fce7f3; font-size:12px; font-weight:500; cursor:pointer; background:white; color:#6b7280; transition:all 0.15s; }
        .pill-btn.active { background:linear-gradient(135deg,#fce7f3,#fdf4ff); color:#be185d; border-color:#fce7f3; font-weight:600; }

        /* Cards */
        .section-title { font-size:11px; font-weight:600; color:#9ca3af; letter-spacing:0.07em; text-transform:uppercase; margin-bottom:12px; }

        .stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; margin-bottom:28px; }
        .stat-card { background:white; border:1.5px solid #fce7f3; border-radius:18px; padding:16px; transition:all 0.2s; }
        .stat-card:hover { box-shadow:0 4px 16px rgba(244,114,182,0.12); transform:translateY(-1px); }
        .stat-top { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .stat-emoji { font-size:20px; }
        .stat-label { font-size:11px; color:#9ca3af; font-weight:500; }
        .stat-value { font-family:'Instrument Serif',serif; font-size:26px; color:#1c1c1e; line-height:1; }
        .stat-sub { font-size:11px; color:#9ca3af; margin-top:4px; }

        /* Streak badge */
        .streak-badge { display:inline-flex; align-items:center; gap:4px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:3px 8px; font-size:11px; color:#c2410c; font-weight:600; }

        /* Chart card */
        .chart-card { background:white; border:1.5px solid #fce7f3; border-radius:18px; padding:20px; margin-bottom:16px; }
        .chart-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .chart-title { font-size:14px; font-weight:600; color:#1c1c1e; }

        /* Completion card */
        .completion-card { background:white; border:1.5px solid #fce7f3; border-radius:18px; padding:20px; margin-bottom:28px; }
        .avg-pct { font-family:'Instrument Serif',serif; font-size:40px; color:#1c1c1e; line-height:1; }
        .avg-label { font-size:13px; color:#9ca3af; }

        /* skeleton */
        .skel { background:white; border-radius:18px; border:1.5px solid #fce7f3; animation:pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }

        /* empty */
        .empty-state { text-align:center; padding:80px 20px; color:#9ca3af; }
        .empty-title { font-family:'Instrument Serif',serif; font-size:22px; color:#1c1c1e; margin:12px 0 6px; }

        @media (max-width:640px) { .page{grid-template-columns:1fr} .sidebar{display:none} .topbar,.scroll-area{padding-left:16px;padding-right:16px} }
      `}</style>

      <div className="page">
        <aside className="sidebar">
          <div className="logo-row">
            <div className="logo-blob">📊</div>
            <span className="logo-text">PocketPal</span>
          </div>

          <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>
            <b style={{ color: "#374151" }}>Insights</b><br /><br />
            Track your habits, plan completion trends and streaks over time.<br /><br />
            Log habits in <b>Chat</b> ("I drank 2L water") and mark plan blocks done in <b>Planner</b>.
          </div>

          <div className="sidebar-nav">
            <a className="nav-btn" href="/">💬 Chat</a>
            <a className="nav-btn" href="/planner">🎀 Planner</a>
            <a className="nav-btn" href="/meals">🍱 Meals</a>
            <a className="nav-btn active" href="/insights">📊 Insights</a>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">Your Insights ✦</div>
              <div className="topbar-sub">Streaks, trends and weekly summaries</div>
            </div>
            <a href="/" style={{ background:"white", border:"1.5px solid #fce7f3", borderRadius:14, padding:"8px 16px", fontSize:13, fontWeight:500, color:"#be185d", textDecoration:"none" }}>← Chat</a>
          </div>

          <div className="scroll-area">
            {/* Window selector */}
            <div className="window-pills">
              {[7, 14, 30].map(d => (
                <button key={d} className={`pill-btn ${days === d ? "active" : ""}`} onClick={() => setDays(d)}>
                  Last {d} days
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div className="skel" style={{ height:100 }} />
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12 }}>
                  {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height:100, animationDelay:`${i*0.1}s` }} />)}
                </div>
                <div className="skel" style={{ height:160 }} />
              </div>
            ) : !hasData ? (
              <div className="empty-state">
                <div style={{ fontSize:48 }}>📈</div>
                <div className="empty-title">No data yet</div>
                <div style={{ fontSize:13 }}>Log habits in Chat and complete plan blocks to see insights here</div>
              </div>
            ) : (
              <>
                {/* Plan completion overview */}
                {data && Object.keys(data.plan_completion).length > 0 && (
                  <>
                    <div className="section-title">Plan Completion</div>
                    <div className="completion-card" style={{ marginBottom: 28 }}>
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:24, flexWrap:"wrap" }}>
                        <div>
                          <div className="avg-pct">{data.avg_completion}%</div>
                          <div className="avg-label">average daily completion</div>
                          <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
                            {Object.entries(data.plan_completion).slice(-7).map(([d, pct]) => (
                              <div key={d} style={{ textAlign:"center" }}>
                                <div style={{ height:40, width:28, background:"#fdf2f8", borderRadius:6, display:"flex", alignItems:"flex-end", overflow:"hidden" }}>
                                  <div style={{ width:"100%", height:`${pct}%`, background:"linear-gradient(to top, #f472b6, #fda4af)", borderRadius:6, minHeight:3 }} />
                                </div>
                                <div style={{ fontSize:9, color:"#9ca3af", marginTop:3 }}>{shortDate(d).split(" ")[1]}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ minWidth:260 }}>
                          <div style={{ fontSize:12, color:"#9ca3af", marginBottom:8, fontWeight:500 }}>Completion trend</div>
                          <CompletionSparkline data={data.plan_completion} days={days} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Habit stat cards */}
                {habits.length > 0 && (
                  <>
                    <div className="section-title">Habit Totals · Last {days} days</div>
                    <div className="stats-grid">
                      {habits.map(h => {
                        const meta   = HABIT_META[h];
                        const total  = data!.habit_totals[h] ?? 0;
                        const streak = data!.streaks[h] ?? 0;
                        return (
                          <div key={h} className="stat-card">
                            <div className="stat-top">
                              <span className="stat-emoji">{meta?.emoji ?? "📌"}</span>
                              <span className="stat-label">{meta?.label ?? h}</span>
                            </div>
                            <div className="stat-value">{fmt(h, total)}</div>
                            <div className="stat-sub">total</div>
                            {streak > 0 && (
                              <div className="streak-badge" style={{ marginTop:8 }}>🔥 {streak}d streak</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-habit bar charts */}
                    <div className="section-title">Daily Breakdown</div>
                    {habits.map(h => {
                      const meta = HABIT_META[h];
                      return (
                        <div key={h} className="chart-card">
                          <div className="chart-header">
                            <div className="chart-title">{meta?.emoji ?? "📌"} {meta?.label ?? h}</div>
                            <div style={{ fontSize:12, color:"#9ca3af" }}>
                              avg: {fmt(h, (data!.habit_totals[h] ?? 0) / days)}
                            </div>
                          </div>
                          <MiniBarChart
                            data={data!.daily_series}
                            habit={h}
                            color={meta?.color ?? "#f472b6"}
                            max={meta?.max ?? 100}
                          />
                        </div>
                      );
                    })}
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
