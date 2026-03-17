"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePlanner } from "../context/planner-context";

type PlanBlock   = { start: string; end: string; title: string };
type Plan        = { date: string; blocks: PlanBlock[] };
type BlockStatus = { done: boolean; priority: boolean };
type StatusMap   = Record<number, BlockStatus>;

const USER_ID = "demo";

function formatTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function timeToMinutes(t: string) {
  const [hh, mm] = t.split(":").map(x => parseInt(x, 10));
  return Number.isNaN(hh) ? 0 : hh * 60 + mm;
}
function formatDisplayTime(t: string) {
  const [hh, mm] = t.split(":").map(x => parseInt(x, 10));
  if (Number.isNaN(hh)) return t;
  return `${hh % 12 || 12}:${String(mm).padStart(2,"0")} ${hh >= 12 ? "PM" : "AM"}`;
}
function durationLabel(start: string, end: string) {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60), m = diff % 60;
  return m ? `${h}h ${m}m` : diff < 60 ? `${diff}m` : `${h}h`;
}
function blockEmoji(title: string) {
  const t = title.toLowerCase();
  if (t.includes("gym") || t.includes("workout") || t.includes("pilates") || t.includes("yoga")) return "💪";
  if (t.includes("class") || t.includes("study") || t.includes("lecture")) return "📚";
  if (t.includes("lunch") || t.includes("dinner") || t.includes("breakfast") || t.includes("eat") || t.includes("brunch")) return "🍱";
  if (t.includes("meet") || t.includes("call") || t.includes("zoom")) return "📞";
  if (t.includes("sleep") || t.includes("nap")) return "😴";
  if (t.includes("walk") || t.includes("run") || t.includes("hike")) return "🏃";
  if (t.includes("shop") || t.includes("grocer")) return "🛒";
  if (t.includes("read") || t.includes("book")) return "📖";
  return "✦";
}
function moodFromCompletion(pct: number) {
  if (pct >= 90) return { label: "Legend", emoji: "🏆", accent: "#f43f5e", glow: "rgba(244,63,94,0.35)",    ring: "#fda4af" };
  if (pct >= 70) return { label: "Proud",  emoji: "🥹", accent: "#fb7185", glow: "rgba(251,113,133,0.3)",  ring: "#fecdd3" };
  if (pct >= 40) return { label: "Focused",emoji: "🧠", accent: "#f472b6", glow: "rgba(244,114,182,0.3)",  ring: "#fbcfe8" };
  if (pct >  0)  return { label: "Warming",emoji: "🌱", accent: "#f9a8d4", glow: "rgba(249,168,212,0.25)", ring: "#fce7f3" };
  return               { label: "Sleepy", emoji: "😴", accent: "#c084fc", glow: "rgba(192,132,252,0.25)",  ring: "#e9d5ff" };
}

export default function PlannerPage() {
  const [dateStr]                     = useState(() => formatTodayISO());
  const [plan, setPlan]               = useState<Plan | null>(null);
  const [loading, setLoading]         = useState(false);
  const [status, setStatus]           = useState<StatusMap>({});
  const [reaction, setReaction]       = useState<string | null>(null);
  const [confettiIdx, setConfettiIdx] = useState<number | null>(null);
  const [toast, setToast]             = useState<string | null>(null);

  // Add block modal state
  const [showAdd, setShowAdd]   = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd]     = useState("");
  const [saving, setSaving]     = useState(false);

  // ✅ Use shared context for ring values
  const { completionPct, doneCount, totalBlocks, refresh } = usePlanner();
  const mood = moodFromCompletion(completionPct);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  const sortedBlocks = useMemo(() => {
    if (!plan?.blocks) return [];
    return plan.blocks
      .map((b, originalIndex) => ({ ...b, originalIndex }))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }, [plan]);

  function reactTo(title: string) {
    const t = title.toLowerCase();
    if (t.includes("gym") || t.includes("pilates") || t.includes("yoga")) return "Crushed it! 💪";
    if (t.includes("class") || t.includes("study")) return "Brain gains secured 📚✨";
    if (t.includes("lunch") || t.includes("eat") || t.includes("dinner")) return "Fuelled up! 🍱";
    return "One more down! 🎀";
  }

  async function fetchStatus() {
    try {
      const res  = await fetch(`http://localhost:8000/plan/status?user_id=${USER_ID}&date_str=${dateStr}`);
      const data = await res.json();
      const parsed: StatusMap = {};
      for (const k of Object.keys(data.status ?? {})) {
        const raw = data.status[k];
        parsed[Number(k)] = typeof raw === "boolean"
          ? { done: raw, priority: false }
          : { done: Boolean(raw?.done), priority: Boolean(raw?.priority) };
      }
      setStatus(parsed);
    } catch {}
  }

  async function fetchPlan() {
    setLoading(true);
    try {
      const res  = await fetch(`http://localhost:8000/plan?user_id=${USER_ID}&date_str=${dateStr}`);
      const data = await res.json();
      setPlan(data.plan ? { date: data.plan.date, blocks: data.plan.blocks } : null);
      await fetchStatus();
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchPlan(); }, []);

  async function saveStatus(blockIndex: number, full: BlockStatus) {
    await fetch("http://localhost:8000/plan/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: USER_ID, date_str: dateStr, block_index: blockIndex, ...full }),
    });
  }

  function toggleDone(blockIndex: number, title: string) {
    const cur  = status[blockIndex] ?? { done: false, priority: false };
    const next = { ...cur, done: !cur.done };
    setStatus(prev => ({ ...prev, [blockIndex]: next }));
    if (next.done) {
      setReaction(reactTo(title));
      setConfettiIdx(blockIndex);
      setTimeout(() => { setReaction(null); setConfettiIdx(null); }, 2000);
    }
    // ✅ Refresh context after saving so chat ring updates immediately
    saveStatus(blockIndex, next)
      .then(() => refresh())
      .catch(() => setStatus(prev => ({ ...prev, [blockIndex]: cur })));
  }

  function togglePriority(blockIndex: number) {
    const cur  = status[blockIndex] ?? { done: false, priority: false };
    const next = { ...cur, priority: !cur.priority };
    setStatus(prev => ({ ...prev, [blockIndex]: next }));
    saveStatus(blockIndex, next).catch(() => setStatus(prev => ({ ...prev, [blockIndex]: cur })));
  }

  async function saveFullPlan(blocks: PlanBlock[]) {
    await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: USER_ID,
        message: `[Today's date is ${dateStr}] Create a plan for ${dateStr} with these exact blocks: ${JSON.stringify(blocks)}. top3 should be the first 3 block titles.`,
        trace: false,
        llm: "ollama",
      }),
    });
  }

  async function addBlock() {
    if (!newTitle.trim() || !newStart || !newEnd) return;
    setSaving(true);
    const newBlock: PlanBlock = { title: newTitle.trim(), start: newStart, end: newEnd };
    const updatedBlocks = [...(plan?.blocks ?? []), newBlock];
    try {
      await saveFullPlan(updatedBlocks);
      await fetchPlan();
      await refresh(); // ✅ sync context
      setShowAdd(false);
      setNewTitle(""); setNewStart(""); setNewEnd("");
      showToast("Block added! 🎀");
    } catch { showToast("Could not save block"); }
    finally { setSaving(false); }
  }

  async function deleteBlock(originalIndex: number) {
    const updatedBlocks = (plan?.blocks ?? []).filter((_, i) => i !== originalIndex);
    if (updatedBlocks.length === 0) { showToast("Can't delete the last block!"); return; }
    try {
      await saveFullPlan(updatedBlocks);
      await fetchPlan();
      await refresh(); // ✅ sync context
      showToast("Block removed!");
    } catch { showToast("Could not delete block"); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{--accent:${mood.accent};--glow:${mood.glow};--ring:${mood.ring}}
        body{background:#fdf2f8;font-family:'DM Sans',sans-serif}
        .page{min-height:100svh;display:grid;grid-template-columns:280px 1fr;height:100svh;overflow:hidden}
        .sidebar{background:white;border-right:1px solid #fce7f3;display:flex;flex-direction:column;padding:28px 20px;gap:24px;overflow-y:auto}
        .logo-row{display:flex;align-items:center;gap:10px}
        .logo-blob{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--accent),#fda4af);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 16px var(--glow);flex-shrink:0;transition:box-shadow .5s}
        .logo-text{font-family:'Instrument Serif',serif;font-size:22px;color:#1c1c1e}
        .ring-wrap{display:flex;flex-direction:column;align-items:center;gap:12px}
        .ring-svg{filter:drop-shadow(0 0 10px var(--glow))}
        .ring-bg{stroke:#fce7f3}
        .ring-fill{stroke:var(--accent);stroke-linecap:round;transition:stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1),stroke .5s;transform-origin:center;transform:rotate(-90deg)}
        .ring-pct{font-family:'Instrument Serif',serif;font-size:24px;fill:#1c1c1e;text-anchor:middle;dominant-baseline:middle}
        .ring-sub{font-size:10px;fill:#9ca3af;font-family:'DM Sans',sans-serif;text-anchor:middle}
        .mood-chip{display:flex;align-items:center;gap:6px;background:#fdf2f8;border:1px solid var(--ring);border-radius:20px;padding:5px 14px;font-size:12px;font-weight:500;color:#be185d;transition:border-color .5s}
        .count-row{font-size:12px;color:#9ca3af;text-align:center}
        .count-row b{color:#374151}
        .sidebar-divider{height:1px;background:#fce7f3}
        .sidebar-info{font-size:12px;color:#9ca3af;line-height:1.7}
        .sidebar-info b{color:#374151}
        .sidebar-nav{display:flex;flex-direction:column;gap:6px;margin-top:auto}
        .nav-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;text-decoration:none;border:none;background:transparent;width:100%;text-align:left;transition:background .15s,color .15s}
        .nav-btn:hover{background:#fdf2f8;color:#be185d}
        .nav-btn.active{background:linear-gradient(135deg,#fce7f3,#fdf4ff);color:#be185d;font-weight:600}
        .main{display:flex;flex-direction:column;height:100svh;overflow:hidden;background:#fdf2f8}
        .topbar{padding:24px 32px 0;flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between}
        .topbar-title{font-family:'Instrument Serif',serif;font-size:30px;color:#1c1c1e;font-style:italic}
        .topbar-sub{font-size:13px;color:#9ca3af;margin-top:3px}
        .topbar-right{display:flex;align-items:center;gap:10px}
        .add-btn{background:linear-gradient(135deg,var(--accent),#fda4af);border:none;border-radius:14px;padding:8px 18px;font-size:13px;font-weight:600;color:white;cursor:pointer;box-shadow:0 4px 12px var(--glow);transition:all .2s;white-space:nowrap}
        .add-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px var(--glow)}
        .back-btn{background:white;border:1.5px solid #fce7f3;border-radius:14px;padding:8px 16px;font-size:13px;font-weight:500;color:#be185d;text-decoration:none;display:flex;align-items:center;gap:6px;transition:all .2s}
        .back-btn:hover{background:#fdf2f8}
        .timeline-wrap{flex:1;overflow-y:auto;padding:20px 32px 32px;scrollbar-width:thin;scrollbar-color:#fce7f3 transparent}
        .timeline-wrap::-webkit-scrollbar{width:4px}
        .timeline-wrap::-webkit-scrollbar-thumb{background:#fce7f3;border-radius:4px}
        .empty-card{background:white;border:1px dashed #fce7f3;border-radius:20px;padding:40px;text-align:center;color:#9ca3af}
        .empty-hint{margin-top:16px;background:#fdf2f8;border-radius:12px;padding:14px 18px;font-size:13px;color:#be185d;font-family:'Instrument Serif',serif;font-style:italic}
        .toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1c1c1e;color:white;padding:12px 24px;border-radius:20px;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,.2);animation:toastIn .3s cubic-bezier(.34,1.56,.64,1) both;z-index:100;white-space:nowrap}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .blocks-list{position:relative;display:flex;flex-direction:column}
        .blocks-list::before{content:'';position:absolute;left:30px;top:20px;bottom:20px;width:2px;background:linear-gradient(to bottom,var(--accent),#fce7f3);border-radius:2px;z-index:0}
        .block-row{display:flex;gap:16px;align-items:flex-start;position:relative;z-index:1;padding:10px 0;animation:blockIn .35s cubic-bezier(.34,1.2,.64,1) both}
        @keyframes blockIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
        .block-dot{width:22px;height:22px;border-radius:50%;background:white;border:2.5px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:18px;box-shadow:0 0 0 4px var(--glow);transition:all .3s;position:relative;z-index:1}
        .block-dot.done{background:var(--accent);border-color:var(--accent)}
        .block-card{flex:1;background:white;border:1.5px solid #fce7f3;border-radius:18px;padding:16px 18px;transition:all .25s;position:relative;overflow:hidden}
        .block-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(to bottom,var(--accent),#fda4af);border-radius:4px 0 0 4px;opacity:0;transition:opacity .3s}
        .block-card:hover{border-color:var(--ring);box-shadow:0 4px 20px var(--glow);transform:translateY(-1px)}
        .block-card:hover::before,.block-card.done::before{opacity:1}
        .block-card.done{background:linear-gradient(135deg,#fdf2f8,#fff);border-color:var(--ring)}
        .block-card.priority{border-color:#fbbf24}
        .block-card.priority::before{background:linear-gradient(to bottom,#fbbf24,#f59e0b);opacity:1}
        .block-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .block-meta{display:flex;align-items:center;gap:8px}
        .block-emoji{font-size:20px}
        .block-time{font-size:11px;color:#9ca3af;font-weight:500;letter-spacing:.04em}
        .block-title{font-size:15px;font-weight:600;color:#1c1c1e;margin-top:2px;transition:all .3s}
        .block-title.done{text-decoration:line-through;color:#9ca3af}
        .block-duration{display:inline-block;margin-top:6px;background:#fdf2f8;border:1px solid #fce7f3;border-radius:8px;padding:2px 8px;font-size:11px;color:#be185d;font-weight:500}
        .block-actions{display:flex;gap:6px;flex-shrink:0;align-items:center}
        .action-btn{width:36px;height:36px;border-radius:12px;border:1.5px solid #fce7f3;background:white;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s}
        .action-btn:hover{transform:scale(1.1);box-shadow:0 4px 12px var(--glow);border-color:var(--ring)}
        .action-btn.priority-on{background:#fffbeb;border-color:#fbbf24}
        .action-btn.done-on{background:var(--accent);border-color:var(--accent)}
        .action-btn.delete{border-color:#fecaca}
        .action-btn.delete:hover{background:#fef2f2;border-color:#f87171;box-shadow:0 4px 12px rgba(239,68,68,.2)}
        .confetti-burst{position:absolute;top:50%;left:50%;pointer-events:none;z-index:10}
        .confetti-piece{position:absolute;width:6px;height:6px;border-radius:2px;animation:confettiFly .8s ease-out forwards}
        @keyframes confettiFly{from{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}to{opacity:0;transform:var(--fly) rotate(360deg) scale(.5)}}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .modal{background:white;border-radius:24px;padding:28px;width:360px;box-shadow:0 24px 60px rgba(0,0,0,.15);animation:slideUp .25s cubic-bezier(.34,1.56,.64,1)}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        .modal-title{font-family:'Instrument Serif',serif;font-size:22px;color:#1c1c1e;margin-bottom:20px}
        .field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
        .field label{font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase}
        .field input{border:1.5px solid #fce7f3;border-radius:12px;padding:10px 14px;font-size:14px;font-family:'DM Sans',sans-serif;color:#1c1c1e;outline:none;transition:border-color .2s,box-shadow .2s}
        .field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--glow)}
        .modal-row{display:flex;gap:10px}
        .modal-actions{display:flex;gap:10px;margin-top:20px}
        .modal-save{flex:1;background:linear-gradient(135deg,var(--accent),#fda4af);border:none;border-radius:14px;padding:12px;font-size:14px;font-weight:600;color:white;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px var(--glow)}
        .modal-save:hover:not(:disabled){transform:translateY(-1px)}
        .modal-save:disabled{opacity:.6;cursor:not-allowed}
        .modal-cancel{padding:12px 20px;border-radius:14px;border:1.5px solid #fce7f3;background:white;font-size:14px;color:#6b7280;cursor:pointer;transition:all .2s}
        .modal-cancel:hover{background:#fdf2f8;color:#be185d}
        @media(max-width:640px){.page{grid-template-columns:1fr}.sidebar{display:none}.topbar,.timeline-wrap{padding-left:16px;padding-right:16px}}
      `}</style>

      <div className="page">
        <aside className="sidebar">
          <div className="logo-row">
            <div className="logo-blob">🐾</div>
            <span className="logo-text">PocketPal</span>
          </div>

          <div className="ring-wrap">
            {(() => {
              const r = 52, circ = 2 * Math.PI * r;
              const offset = circ - (completionPct / 100) * circ;
              return (
                <svg className="ring-svg" width="140" height="140" viewBox="0 0 140 140">
                  <circle className="ring-bg"   cx="70" cy="70" r={r} fill="none" strokeWidth="10" />
                  <circle className="ring-fill" cx="70" cy="70" r={r} fill="none" strokeWidth="10" strokeDasharray={circ} strokeDashoffset={offset} />
                  <text x="70" y="64">
                    <tspan className="ring-pct" x="70" dy="0">{completionPct}%</tspan>
                    <tspan className="ring-sub" x="70" dy="18">complete</tspan>
                  </text>
                </svg>
              );
            })()}
            <div className="mood-chip"><span>{mood.emoji}</span><span>{mood.label}</span></div>
            {totalBlocks > 0 && <div className="count-row"><b>{doneCount}</b> of <b>{totalBlocks}</b> blocks done</div>}
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-info">
            <b>How to use</b><br />
            Tap <b>○</b> to mark a block done.<br />
            Tap <b>⭐</b> to flag priority tasks.<br />
            Tap <b>＋</b> to add a new block.<br />
            Tap <b>🗑</b> to delete a block.
          </div>

          <div className="sidebar-nav">
            <Link className="nav-btn" href="/">💬 Chat</Link>
            <Link className="nav-btn active" href="/planner">🎀 Planner</Link>
            <Link className="nav-btn" href="/meals">🍱 Meals</Link>
            <Link className="nav-btn" href="/insights">📊 Insights</Link>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">Today's Plan ✦</div>
              <div className="topbar-sub">{new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</div>
            </div>
            <div className="topbar-right">
              <button className="add-btn" onClick={() => setShowAdd(true)}>＋ Add block</button>
              <Link href="/" className="back-btn">← Chat</Link>
            </div>
          </div>

          <div className="timeline-wrap">
            {loading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:8 }}>
                <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
                {[1,2,3].map(i => (
                  <div key={i} style={{ height:80, background:"white", borderRadius:18, border:"1.5px solid #fce7f3", animation:`pulse 1.5s ease-in-out ${i*.15}s infinite` }} />
                ))}
              </div>
            ) : !plan ? (
              <div className="empty-card">
                <div style={{ fontSize:40, marginBottom:12 }}>🗓️</div>
                <div style={{ fontFamily:"Instrument Serif,serif", fontSize:20, color:"#1c1c1e" }}>No plan yet</div>
                <div style={{ fontSize:13, marginTop:6 }}>Head to chat or tap <b>＋ Add block</b> to start</div>
                <div className="empty-hint">"Plan my day: class 10-12, gym 5pm, dinner 7pm"</div>
              </div>
            ) : (
              <div className="blocks-list">
                {sortedBlocks.map((b, idx) => {
                  const i        = b.originalIndex;
                  const s        = status[i] ?? { done: false, priority: false };
                  const dur      = durationLabel(b.start, b.end);
                  const confetti = ["#f43f5e","#fb923c","#facc15","#4ade80","#60a5fa","#c084fc"];
                  return (
                    <div key={`${b.start}-${b.title}-${idx}`} className="block-row" style={{ animationDelay:`${idx*.07}s` }}>
                      <div className={`block-dot ${s.done ? "done" : ""}`}>
                        {s.done ? "✓" : ""}
                      </div>
                      <div className={`block-card ${s.done ? "done" : ""} ${s.priority ? "priority" : ""}`}>
                        {confettiIdx === i && (
                          <div className="confetti-burst">
                            {confetti.map((color, ci) => {
                              const angle = (ci / confetti.length) * 360;
                              const dist  = 40 + Math.random() * 30;
                              const x     = Math.cos((angle * Math.PI) / 180) * dist;
                              const y     = Math.sin((angle * Math.PI) / 180) * dist;
                              return <div key={ci} className="confetti-piece" style={{ background:color, "--fly":`translate(${x}px,${y}px)`, animationDelay:`${ci*.04}s` } as any} />;
                            })}
                          </div>
                        )}
                        <div className="block-top">
                          <div className="block-meta">
                            <div className="block-emoji">{blockEmoji(b.title)}</div>
                            <div>
                              <div className="block-time">{formatDisplayTime(b.start)} – {formatDisplayTime(b.end)}</div>
                              <div className={`block-title ${s.done ? "done" : ""}`}>
                                {b.title}{s.priority && <span style={{ marginLeft:6, fontSize:13 }}>⭐</span>}
                              </div>
                              {dur && <div className="block-duration">{dur}</div>}
                            </div>
                          </div>
                          <div className="block-actions">
                            <button className={`action-btn ${s.priority ? "priority-on" : ""}`} onClick={() => togglePriority(i)} type="button">⭐</button>
                            <button className={`action-btn ${s.done ? "done-on" : ""}`} onClick={() => toggleDone(i, b.title)} type="button">
                              {s.done ? <span style={{ color:"white", fontSize:14 }}>✓</span> : <span style={{ color:"#d1d5db" }}>○</span>}
                            </button>
                            <button className="action-btn delete" onClick={() => deleteBlock(i)} type="button" title="Delete block">
                              <span style={{ fontSize:13 }}>🗑</span>
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

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">Add a block ✦</div>
            <div className="field">
              <label>Title</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Gym, Study, Lunch" autoFocus />
            </div>
            <div className="modal-row">
              <div className="field" style={{ flex:1 }}>
                <label>Start time</label>
                <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} />
              </div>
              <div className="field" style={{ flex:1 }}>
                <label>End time</label>
                <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="modal-save" onClick={addBlock} disabled={saving || !newTitle.trim() || !newStart || !newEnd}>
                {saving ? "Saving…" : "Add block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(reaction || toast) && <div className="toast">🐾 {reaction ?? toast}</div>}
    </>
  );
}