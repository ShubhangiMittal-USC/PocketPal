"use client";

import { useEffect, useMemo, useState } from "react";

type PlanBlock = { start: string; end: string; title: string };
type Plan = { date: string; blocks: PlanBlock[] };
type BlockStatus = { done: boolean; priority: boolean };
type StatusMap = Record<number, BlockStatus>;

const USER_ID = "demo";

function formatTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string) {
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function formatDisplayTime(t: string) {
  const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(hh)) return t;
  const period = hh >= 12 ? "PM" : "AM";
  const h = hh % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${period}`;
}

function moodFromCompletion(pct: number) {
  if (pct >= 90) return { label: "Legend", emoji: "🏆", accent: "#f43f5e", glow: "rgba(244,63,94,0.35)", ring: "#fda4af", bg: "#fff1f2" };
  if (pct >= 70) return { label: "Proud", emoji: "🥹", accent: "#fb7185", glow: "rgba(251,113,133,0.3)", ring: "#fecdd3", bg: "#fff1f2" };
  if (pct >= 40) return { label: "Focused", emoji: "🧠", accent: "#f472b6", glow: "rgba(244,114,182,0.3)", ring: "#fbcfe8", bg: "#fdf4ff" };
  if (pct > 0) return { label: "Warming", emoji: "🌱", accent: "#f9a8d4", glow: "rgba(249,168,212,0.25)", ring: "#fce7f3", bg: "#fdf2f8" };
  return { label: "Sleepy", emoji: "😴", accent: "#c084fc", glow: "rgba(192,132,252,0.25)", ring: "#e9d5ff", bg: "#faf5ff" };
}

function blockEmoji(title: string) {
  const t = title.toLowerCase();
  if (t.includes("gym") || t.includes("workout") || t.includes("exercise")) return "💪";
  if (t.includes("class") || t.includes("lecture") || t.includes("study")) return "📚";
  if (t.includes("lunch") || t.includes("dinner") || t.includes("breakfast") || t.includes("eat")) return "🍱";
  if (t.includes("meet") || t.includes("call") || t.includes("zoom")) return "📞";
  if (t.includes("sleep") || t.includes("nap") || t.includes("rest")) return "😴";
  if (t.includes("walk") || t.includes("run") || t.includes("jog")) return "🏃";
  return "✦";
}

function durationLabel(start: string, end: string) {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return "";
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function PlannerPage() {
  const [dateStr] = useState<string>(() => formatTodayISO());
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMap>({});
  const [reaction, setReaction] = useState<string | null>(null);
  const [confettiIdx, setConfettiIdx] = useState<number | null>(null);

  const sortedBlocks = useMemo(() => {
    if (!plan?.blocks) return [];
    return plan.blocks
      .map((b, originalIndex) => ({ ...b, originalIndex }))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }, [plan]);

  const totalBlocks = plan?.blocks?.length ?? 0;
  const doneCount = useMemo(() => {
    if (!plan?.blocks) return 0;
    let c = 0;
    for (let i = 0; i < plan.blocks.length; i++) if (status[i]?.done) c++;
    return c;
  }, [status, plan]);

  const completionPct = totalBlocks === 0 ? 0 : Math.round((doneCount / totalBlocks) * 100);
  const mood = moodFromCompletion(completionPct);

  function reactTo(title: string) {
    const t = title.toLowerCase();
    if (t.includes("gym")) return "Gym done!! 💪 You're a beast.";
    if (t.includes("class")) return "Brain gains secured 📚✨";
    if (t.includes("lunch") || t.includes("eat")) return "Fuelled up! 🍱";
    return "One more down! 🎀";
  }

  async function fetchStatus() {
    const res = await fetch(`http://localhost:8000/plan/status?user_id=${encodeURIComponent(USER_ID)}&date_str=${encodeURIComponent(dateStr)}`);
    const data = await res.json();
    const statusObj = data.status ?? {};
    const parsed: StatusMap = {};
    for (const k of Object.keys(statusObj)) {
      const raw = statusObj[k];
      parsed[Number(k)] = typeof raw === "boolean"
        ? { done: raw, priority: false }
        : { done: Boolean(raw?.done), priority: Boolean(raw?.priority) };
    }
    setStatus(parsed);
  }

  async function saveStatus(blockIndex: number, full: BlockStatus) {
    await fetch("http://localhost:8000/plan/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, date_str: dateStr, block_index: blockIndex, done: full.done, priority: full.priority }),
    });
  }

  async function fetchPlan() {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/plan?user_id=${encodeURIComponent(USER_ID)}&date_str=${encodeURIComponent(dateStr)}`);
      const data = await res.json();
      setPlan(data.plan ? { date: data.plan.date, blocks: data.plan.blocks } : null);
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPlan(); }, []);

  function toggleDone(blockIndex: number, title: string) {
    const cur = status[blockIndex] ?? { done: false, priority: false };
    const next: BlockStatus = { done: !cur.done, priority: cur.priority };
    setStatus((prev) => ({ ...prev, [blockIndex]: next }));
    if (next.done) {
      setReaction(reactTo(title));
      setConfettiIdx(blockIndex);
      setTimeout(() => { setReaction(null); setConfettiIdx(null); }, 2000);
    }
    saveStatus(blockIndex, next).catch(() => setStatus((prev) => ({ ...prev, [blockIndex]: cur })));
  }

  function togglePriority(blockIndex: number) {
    const cur = status[blockIndex] ?? { done: false, priority: false };
    const next: BlockStatus = { done: cur.done, priority: !cur.priority };
    setStatus((prev) => ({ ...prev, [blockIndex]: next }));
    saveStatus(blockIndex, next).catch(() => setStatus((prev) => ({ ...prev, [blockIndex]: cur })));
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --accent: ${mood.accent};
          --glow: ${mood.glow};
          --ring: ${mood.ring};
        }
        body { background: #fdf2f8; font-family: 'DM Sans', sans-serif; }

        .page {
          min-height: 100svh;
          display: grid;
          grid-template-columns: 280px 1fr;
          height: 100svh;
          overflow: hidden;
        }

        /* Sidebar */
        .sidebar {
          background: white;
          border-right: 1px solid #fce7f3;
          display: flex;
          flex-direction: column;
          padding: 28px 20px;
          gap: 24px;
          overflow-y: auto;
        }

        .logo-row { display: flex; align-items: center; gap: 10px; }
        .logo-blob {
          width: 42px; height: 42px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--accent), #fda4af);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 16px var(--glow);
          flex-shrink: 0;
          transition: box-shadow 0.5s ease;
        }
        .logo-text { font-family: 'Instrument Serif', serif; font-size: 22px; color: #1c1c1e; }

        /* Progress ring */
        .ring-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .ring-svg { filter: drop-shadow(0 0 10px var(--glow)); }
        .ring-bg { stroke: #fce7f3; }
        .ring-fill {
          stroke: var(--accent);
          stroke-linecap: round;
          transition: stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1), stroke 0.5s;
          transform-origin: center;
          transform: rotate(-90deg);
        }
        .ring-pct { font-family: 'Instrument Serif', serif; font-size: 24px; fill: #1c1c1e; text-anchor: middle; dominant-baseline: middle; }
        .ring-sub { font-size: 10px; fill: #9ca3af; font-family: 'DM Sans', sans-serif; text-anchor: middle; }

        .mood-chip {
          display: flex; align-items: center; gap: 6px;
          background: #fdf2f8; border: 1px solid var(--ring);
          border-radius: 20px; padding: 5px 14px;
          font-size: 12px; font-weight: 500; color: #be185d;
          transition: border-color 0.5s;
        }
        .count-row { font-size: 12px; color: #9ca3af; text-align: center; }
        .count-row b { color: #374151; }

        .sidebar-divider { height: 1px; background: #fce7f3; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
        .nav-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-radius: 12px;
          font-size: 13px; font-weight: 500; color: #6b7280;
          cursor: pointer; text-decoration: none;
          border: none; background: transparent; width: 100%; text-align: left;
          transition: background 0.15s, color 0.15s;
        }
        .nav-btn:hover { background: #fdf2f8; color: #be185d; }
        .nav-btn.active { background: linear-gradient(135deg, #fce7f3, #fdf4ff); color: #be185d; font-weight: 600; }

        /* Main */
        .main {
          display: flex; flex-direction: column;
          height: 100svh; overflow: hidden;
          background: #fdf2f8;
        }

        .topbar {
          padding: 24px 32px 0;
          flex-shrink: 0;
          display: flex; align-items: flex-start; justify-content: space-between;
        }
        .topbar-title { font-family: 'Instrument Serif', serif; font-size: 30px; color: #1c1c1e; font-style: italic; }
        .topbar-sub { font-size: 13px; color: #9ca3af; margin-top: 3px; }

        /* Timeline scroll area */
        .timeline-wrap {
          flex: 1; overflow-y: auto; padding: 20px 32px 32px;
          scrollbar-width: thin; scrollbar-color: #fce7f3 transparent;
        }
        .timeline-wrap::-webkit-scrollbar { width: 4px; }
        .timeline-wrap::-webkit-scrollbar-thumb { background: #fce7f3; border-radius: 4px; }

        /* Empty state */
        .empty-card {
          background: white; border: 1px dashed #fce7f3;
          border-radius: 20px; padding: 40px;
          text-align: center; color: #9ca3af;
        }
        .empty-hint {
          margin-top: 16px; background: #fdf2f8;
          border-radius: 12px; padding: 14px 18px;
          font-size: 13px; color: #be185d; font-family: 'Instrument Serif', serif; font-style: italic;
        }

        /* Reaction toast */
        .toast {
          position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
          background: #1c1c1e; color: white;
          padding: 12px 24px; border-radius: 20px;
          font-size: 14px; font-weight: 500;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          animation: toastIn 0.3s cubic-bezier(.34,1.56,.64,1) both;
          z-index: 100; white-space: nowrap;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* Block cards */
        .blocks-list {
          position: relative;
          display: flex; flex-direction: column; gap: 0;
        }

        /* Vertical line connector */
        .blocks-list::before {
          content: '';
          position: absolute;
          left: 30px; top: 20px; bottom: 20px;
          width: 2px;
          background: linear-gradient(to bottom, var(--accent), #fce7f3);
          border-radius: 2px;
          z-index: 0;
        }

        .block-row {
          display: flex; gap: 16px; align-items: flex-start;
          position: relative; z-index: 1;
          padding: 10px 0;
          animation: blockIn 0.35s cubic-bezier(.34,1.2,.64,1) both;
        }
        @keyframes blockIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .block-dot {
          width: 22px; height: 22px; border-radius: 50%;
          background: white; border: 2.5px solid var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; flex-shrink: 0;
          margin-top: 18px;
          box-shadow: 0 0 0 4px var(--glow);
          transition: all 0.3s ease;
          position: relative; z-index: 1;
        }
        .block-dot.done {
          background: var(--accent);
          border-color: var(--accent);
        }

        .block-card {
          flex: 1;
          background: white;
          border: 1.5px solid #fce7f3;
          border-radius: 18px;
          padding: 16px 18px;
          transition: all 0.25s ease;
          cursor: default;
          position: relative;
          overflow: hidden;
        }
        .block-card::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 4px;
          background: linear-gradient(to bottom, var(--accent), #fda4af);
          border-radius: 4px 0 0 4px;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .block-card:hover { border-color: var(--ring); box-shadow: 0 4px 20px var(--glow); transform: translateY(-1px); }
        .block-card:hover::before { opacity: 1; }
        .block-card.done {
          background: linear-gradient(135deg, #fdf2f8, #fff);
          border-color: var(--ring);
        }
        .block-card.done::before { opacity: 1; }
        .block-card.priority { border-color: #fbbf24; }
        .block-card.priority::before { background: linear-gradient(to bottom, #fbbf24, #f59e0b); opacity: 1; }

        .block-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .block-meta { display: flex; align-items: center; gap: 8px; }
        .block-emoji { font-size: 20px; }
        .block-time-info {}
        .block-time { font-size: 11px; color: #9ca3af; font-weight: 500; letter-spacing: 0.04em; }
        .block-title {
          font-size: 15px; font-weight: 600; color: #1c1c1e;
          margin-top: 2px;
          transition: all 0.3s;
        }
        .block-title.done { text-decoration: line-through; color: #9ca3af; }

        .block-duration {
          display: inline-block;
          margin-top: 6px;
          background: #fdf2f8; border: 1px solid #fce7f3;
          border-radius: 8px; padding: 2px 8px;
          font-size: 11px; color: #be185d; font-weight: 500;
        }

        .block-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .action-btn {
          width: 38px; height: 38px;
          border-radius: 12px; border: 1.5px solid #fce7f3;
          background: white; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s ease;
        }
        .action-btn:hover { transform: scale(1.1); box-shadow: 0 4px 12px var(--glow); border-color: var(--ring); }
        .action-btn.priority-on { background: #fffbeb; border-color: #fbbf24; }
        .action-btn.done-on { background: var(--accent); border-color: var(--accent); }

        /* Confetti burst */
        .confetti-burst {
          position: absolute; top: 50%; left: 50%;
          pointer-events: none; z-index: 10;
        }
        .confetti-piece {
          position: absolute;
          width: 6px; height: 6px;
          border-radius: 2px;
          animation: confettiFly 0.8s ease-out forwards;
        }
        @keyframes confettiFly {
          from { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          to { opacity: 0; transform: var(--fly) rotate(360deg) scale(0.5); }
        }

        @media (max-width: 640px) {
          .page { grid-template-columns: 1fr; }
          .sidebar { display: none; }
          .topbar, .timeline-wrap { padding-left: 16px; padding-right: 16px; }
        }
      `}</style>

      <div className="page">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-row">
            <div className="logo-blob">🐾</div>
            <span className="logo-text">PocketPal</span>
          </div>

          <div className="ring-wrap">
            {(() => {
              const r = 52; const circ = 2 * Math.PI * r;
              const offset = circ - (completionPct / 100) * circ;
              return (
                <svg className="ring-svg" width="140" height="140" viewBox="0 0 140 140">
                  <circle className="ring-bg" cx="70" cy="70" r={r} fill="none" strokeWidth="10" />
                  <circle className="ring-fill" cx="70" cy="70" r={r} fill="none" strokeWidth="10"
                    strokeDasharray={circ} strokeDashoffset={offset} />
                  <text x="70" y="64">
                    <tspan className="ring-pct" x="70" dy="0">{completionPct}%</tspan>
                    <tspan className="ring-sub" x="70" dy="18">complete</tspan>
                  </text>
                </svg>
              );
            })()}
            <div className="mood-chip"><span>{mood.emoji}</span><span>{mood.label}</span></div>
            {totalBlocks > 0 && (
              <div className="count-row"><b>{doneCount}</b> of <b>{totalBlocks}</b> blocks done</div>
            )}
          </div>

          <div className="sidebar-divider" />

          <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: "#374151", marginBottom: 6 }}>How to use</div>
            Tap the <b>✓</b> to mark a block done.<br />
            Tap <b>⭐</b> to flag priority tasks.<br />
            Go to <b>Chat</b> to edit your plan.
          </div>

          <div className="sidebar-nav">
            <a className="nav-btn" href="/">
              <span>💬</span> Chat
            </a>
            <a className="nav-btn active" href="/planner">
              <span>🎀</span> Planner
            </a>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">Today's Plan ✦</div>
              <div className="topbar-sub">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>
            <a href="/" style={{
              background: "white", border: "1.5px solid #fce7f3",
              borderRadius: 14, padding: "8px 16px",
              fontSize: 13, fontWeight: 500, color: "#be185d",
              textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.2s"
            }}>← Chat</a>
          </div>

          <div className="timeline-wrap">
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{
                    height: 80, background: "white", borderRadius: 18,
                    border: "1.5px solid #fce7f3",
                    animation: `pulse 1.5s ease-in-out ${i * 0.15}s infinite`
                  }} />
                ))}
                <style>{`@keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
              </div>
            ) : !plan ? (
              <div className="empty-card">
                <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
                <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 20, color: "#1c1c1e" }}>No plan yet</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>Head to chat and tell me about your day</div>
                <div className="empty-hint">"Plan my day: class 10-12, gym 5pm, dinner 7pm"</div>
              </div>
            ) : (
              <div className="blocks-list">
                {sortedBlocks.map((b, idx) => {
                  const i = b.originalIndex;
                  const s = status[i] ?? { done: false, priority: false };
                  const dur = durationLabel(b.start, b.end);
                  const confetti = ["#f43f5e", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#c084fc"];

                  return (
                    <div key={`${b.start}-${b.title}-${idx}`} className="block-row"
                      style={{ animationDelay: `${idx * 0.07}s` }}>
                      <div className={`block-dot ${s.done ? "done" : ""}`}>
                        {s.done ? "✓" : ""}
                      </div>

                      <div className={`block-card ${s.done ? "done" : ""} ${s.priority ? "priority" : ""}`}>
                        {/* Confetti burst when marking done */}
                        {confettiIdx === i && (
                          <div className="confetti-burst">
                            {confetti.map((color, ci) => {
                              const angle = (ci / confetti.length) * 360;
                              const dist = 40 + Math.random() * 30;
                              const x = Math.cos((angle * Math.PI) / 180) * dist;
                              const y = Math.sin((angle * Math.PI) / 180) * dist;
                              return (
                                <div key={ci} className="confetti-piece"
                                  style={{
                                    background: color,
                                    "--fly": `translate(${x}px, ${y}px)`,
                                    animationDelay: `${ci * 0.04}s`,
                                  } as any}
                                />
                              );
                            })}
                          </div>
                        )}

                        <div className="block-top">
                          <div className="block-meta">
                            <div className="block-emoji">{blockEmoji(b.title)}</div>
                            <div className="block-time-info">
                              <div className="block-time">
                                {formatDisplayTime(b.start)} – {formatDisplayTime(b.end)}
                              </div>
                              <div className={`block-title ${s.done ? "done" : ""}`}>
                                {b.title}
                                {s.priority && <span style={{ marginLeft: 6, fontSize: 13 }}>⭐</span>}
                              </div>
                              {dur && <div className="block-duration">{dur}</div>}
                            </div>
                          </div>

                          <div className="block-actions">
                            <button className={`action-btn ${s.priority ? "priority-on" : ""}`}
                              onClick={() => togglePriority(i)} title="Toggle priority" type="button">
                              ⭐
                            </button>
                            <button className={`action-btn ${s.done ? "done-on" : ""}`}
                              onClick={() => toggleDone(i, b.title)} title="Toggle done" type="button">
                              {s.done ? <span style={{ color: "white", fontSize: 14 }}>✓</span> : <span style={{ color: "#d1d5db" }}>○</span>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {reaction && <div className="toast">🐾 {reaction}</div>}
    </>
  );
}