"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ToolCall = { tool: string; args: Record<string, any> };
type ChatResponse = {
  reply: string;
  intent: string;
  tool_calls: ToolCall[];
};

type Msg = { role: "user" | "assistant"; text: string };

const USER_ID = "demo";
const TRACE = false;
const LLM: "rules" | "ollama" = "ollama";

function formatTodayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function moodFromCompletion(pct: number) {
  if (pct >= 90) return { label: "Legend", emoji: "🏆", accent: "#f43f5e", glow: "rgba(244,63,94,0.4)", ring: "#fda4af" };
  if (pct >= 70) return { label: "Proud", emoji: "🥹", accent: "#fb7185", glow: "rgba(251,113,133,0.35)", ring: "#fecdd3" };
  if (pct >= 40) return { label: "Focused", emoji: "🧠", accent: "#f472b6", glow: "rgba(244,114,182,0.35)", ring: "#fbcfe8" };
  if (pct > 0) return { label: "Warming", emoji: "🌱", accent: "#f9a8d4", glow: "rgba(249,168,212,0.3)", ring: "#fce7f3" };
  return { label: "Sleepy", emoji: "😴", accent: "#e9d5ff", glow: "rgba(233,213,255,0.3)", ring: "#f3e8ff" };
}

const QUICK_CHIPS = [
  "Plan my morning routine",
  "Add gym at 6pm",
  "What's left today?",
  "Mark class as done",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi! I'm PocketPal 🐾\nTry: \"Plan my day today: class 10-12, gym 5pm…\"" },
  ]);
  const [loading, setLoading] = useState(false);
  const [plannerPct, setPlannerPct] = useState<number>(0);
  const [plannerCounts, setPlannerCounts] = useState<{ done: number; total: number } | null>(null);
  const [time, setTime] = useState(formatTime());
  const [inputFocused, setInputFocused] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mood = useMemo(() => moodFromCompletion(plannerPct), [plannerPct]);

  useEffect(() => {
    const t = setInterval(() => setTime(formatTime()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function fetchPlannerCompletion() {
    const dateStr = formatTodayISO();
    try {
      const planRes = await fetch(
        `http://localhost:8000/plan?user_id=${encodeURIComponent(USER_ID)}&date_str=${encodeURIComponent(dateStr)}`
      );
      const planData = await planRes.json();
      const plan = planData?.plan;
      if (!plan || !Array.isArray(plan.blocks)) { setPlannerCounts(null); setPlannerPct(0); return; }
      const total = plan.blocks.length;
      const statusRes = await fetch(
        `http://localhost:8000/plan/status?user_id=${encodeURIComponent(USER_ID)}&date_str=${encodeURIComponent(dateStr)}`
      );
      const statusData = await statusRes.json();
      const statusObj = statusData?.status ?? {};
      let done = 0;
      for (const k of Object.keys(statusObj)) {
        const v = statusObj[k];
        if (typeof v === "boolean") { if (v) done++; } else { if (v?.done) done++; }
      }
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      setPlannerCounts({ done, total });
      setPlannerPct(pct);
    } catch {}
  }

  useEffect(() => { fetchPlannerCompletion(); }, []);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, message: text, trace: TRACE, llm: LLM }),
      });
      const data: ChatResponse = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
      fetchPlannerCompletion();
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Backend not reachable on :8000" }]);
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

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
          gap: 0;
          overflow: hidden;
          height: 100svh;
        }

        /* ── Sidebar ── */
        .sidebar {
          background: white;
          border-right: 1px solid #fce7f3;
          display: flex;
          flex-direction: column;
          padding: 28px 20px;
          gap: 28px;
          overflow: hidden;
        }

        .logo-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-blob {
          width: 42px; height: 42px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--accent), #fda4af);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 16px var(--glow);
          transition: box-shadow 0.5s ease;
          flex-shrink: 0;
        }
        .logo-text { font-family: 'Instrument Serif', serif; font-size: 22px; color: #1c1c1e; }

        .time-block {
          background: #fdf2f8;
          border-radius: 16px;
          padding: 16px;
          border: 1px solid #fce7f3;
        }
        .time-label { font-size: 11px; font-weight: 500; color: #9ca3af; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
        .time-value { font-family: 'Instrument Serif', serif; font-size: 32px; color: #1c1c1e; line-height: 1; }
        .time-date { font-size: 12px; color: #9ca3af; margin-top: 4px; }

        /* Progress ring area */
        .mood-ring-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .ring-svg { filter: drop-shadow(0 0 8px var(--glow)); }
        .ring-bg { stroke: #fce7f3; }
        .ring-fill {
          stroke: var(--accent);
          stroke-linecap: round;
          transition: stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1), stroke 0.5s ease;
          transform-origin: center;
          transform: rotate(-90deg);
        }
        .ring-center { text-anchor: middle; dominant-baseline: middle; }
        .ring-pct { font-family: 'Instrument Serif', serif; font-size: 22px; fill: #1c1c1e; }
        .ring-sub { font-size: 10px; fill: #9ca3af; font-family: 'DM Sans', sans-serif; }

        .mood-badge {
          display: flex; align-items: center; gap: 6px;
          background: #fdf2f8; border: 1px solid var(--ring);
          border-radius: 20px; padding: 4px 12px;
          font-size: 12px; font-weight: 500; color: #be185d;
          transition: border-color 0.5s ease;
        }

        .count-stat {
          font-size: 12px; color: #9ca3af; text-align: center;
        }
        .count-stat b { color: #374151; }

        .sidebar-nav {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .nav-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px; font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          text-decoration: none;
          border: none; background: transparent; width: 100%; text-align: left;
        }
        .nav-btn:hover { background: #fdf2f8; color: #be185d; }
        .nav-btn.active { background: linear-gradient(135deg, #fce7f3, #fdf4ff); color: #be185d; font-weight: 600; }
        .nav-icon { font-size: 16px; }

        /* ── Main ── */
        .main {
          display: flex;
          flex-direction: column;
          height: 100svh;
          overflow: hidden;
          background: #fdf2f8;
        }

        .topbar {
          padding: 20px 28px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .topbar-title { font-family: 'Instrument Serif', serif; font-size: 28px; color: #1c1c1e; font-style: italic; }
        .topbar-sub { font-size: 13px; color: #9ca3af; margin-top: 2px; }

        /* ── Chat Area ── */
        .chat-wrap {
          flex: 1;
          overflow: hidden;
          padding: 20px 28px 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
        }

        .chat-scroll {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: #fce7f3 transparent;
        }
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #fce7f3; border-radius: 4px; }

        .bubble-row {
          display: flex;
          animation: bubbleIn 0.3s cubic-bezier(.34,1.56,.64,1) both;
        }
        .bubble-row.user { justify-content: flex-end; }
        .bubble-row.assistant { justify-content: flex-start; }

        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .bubble {
          max-width: 72%;
          padding: 12px 16px;
          border-radius: 20px;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-line;
        }
        .bubble.user {
          background: #1c1c1e;
          color: white;
          border-bottom-right-radius: 6px;
        }
        .bubble.assistant {
          background: white;
          color: #1c1c1e;
          border: 1px solid #fce7f3;
          border-bottom-left-radius: 6px;
          box-shadow: 0 2px 12px rgba(244,114,182,0.08);
        }

        .typing-bubble {
          background: white;
          border: 1px solid #fce7f3;
          border-radius: 20px;
          border-bottom-left-radius: 6px;
          padding: 14px 18px;
          display: flex; gap: 5px; align-items: center;
          box-shadow: 0 2px 12px rgba(244,114,182,0.08);
          animation: bubbleIn 0.3s ease both;
        }
        .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--accent);
          animation: bounce 1.2s ease-in-out infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }

        /* ── Quick Chips ── */
        .chips-row {
          display: flex; gap: 8px; flex-wrap: wrap;
          padding-bottom: 4px;
        }
        .chip {
          background: white;
          border: 1px solid #fce7f3;
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 12px; font-weight: 500;
          color: #be185d;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .chip:hover {
          background: #fdf2f8;
          border-color: var(--accent);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--glow);
        }

        /* ── Input Bar ── */
        .input-bar {
          padding: 16px 28px 24px;
          flex-shrink: 0;
        }
        .input-wrap {
          display: flex; gap: 10px; align-items: center;
          background: white;
          border-radius: 20px;
          border: 1.5px solid #fce7f3;
          padding: 6px 6px 6px 18px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-wrap.focused {
          border-color: var(--accent);
          box-shadow: 0 0 0 4px var(--glow);
        }
        .input-field {
          flex: 1;
          border: none;
          outline: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #1c1c1e;
          background: transparent;
        }
        .input-field::placeholder { color: #d1d5db; }
        .send-btn {
          background: linear-gradient(135deg, var(--accent), #f9a8d4);
          border: none;
          border-radius: 14px;
          width: 42px; height: 42px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          box-shadow: 0 4px 12px var(--glow);
        }
        .send-btn:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 6px 18px var(--glow); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .send-icon { color: white; font-size: 16px; }

        @media (max-width: 640px) {
          .page { grid-template-columns: 1fr; }
          .sidebar { display: none; }
        }
      `}</style>

      <div className="page">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo-row">
            <div className="logo-blob">🐾</div>
            <span className="logo-text">PocketPal</span>
          </div>

          <div className="time-block">
            <div className="time-label">Right now</div>
            <div className="time-value">{time}</div>
            <div className="time-date">{today}</div>
          </div>

          {/* Circular progress */}
          <div className="mood-ring-wrap">
            {(() => {
              const r = 52;
              const circ = 2 * Math.PI * r;
              const offset = circ - (plannerPct / 100) * circ;
              return (
                <svg className="ring-svg" width="140" height="140" viewBox="0 0 140 140">
                  <circle className="ring-bg" cx="70" cy="70" r={r} fill="none" strokeWidth="10" />
                  <circle
                    className="ring-fill"
                    cx="70" cy="70" r={r}
                    fill="none"
                    strokeWidth="10"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                  />
                  <text className="ring-center" x="70" y="66">
                    <tspan className="ring-pct" x="70" dy="0">{plannerPct}%</tspan>
                    <tspan className="ring-sub" x="70" dy="16">today</tspan>
                  </text>
                </svg>
              );
            })()}
            <div className="mood-badge">
              <span>{mood.emoji}</span>
              <span>{mood.label}</span>
            </div>
            {plannerCounts && (
              <div className="count-stat">
                <b>{plannerCounts.done}</b> of <b>{plannerCounts.total}</b> blocks done
              </div>
            )}
          </div>

          <div className="sidebar-nav">
            <a className="nav-btn active" href="/">
              <span className="nav-icon">💬</span> Chat
            </a>
            <a className="nav-btn" href="/planner">
              <span className="nav-icon">🎀</span> Planner
            </a>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">What's the plan?</div>
              <div className="topbar-sub">Ask me anything about your day</div>
            </div>
          </div>

          <div className="chat-wrap">
            <div className="chat-scroll">
              {messages.map((m, idx) => (
                <div key={idx} className={`bubble-row ${m.role}`}>
                  <div className={`bubble ${m.role}`}>{m.text}</div>
                </div>
              ))}
              {loading && (
                <div className="bubble-row assistant">
                  <div className="typing-bubble">
                    <div className="dot" />
                    <div className="dot" />
                    <div className="dot" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick chips */}
            <div className="chips-row">
              {QUICK_CHIPS.map((chip) => (
                <button key={chip} className="chip" onClick={() => send(chip)}>
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="input-bar">
            <div className={`input-wrap ${inputFocused ? "focused" : ""}`}>
              <input
                ref={inputRef}
                className="input-field"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try: "Plan my day today: class 10-12, gym 5pm..."'
                onKeyDown={(e) => e.key === "Enter" ? send() : null}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
              <button className="send-btn" onClick={() => send()} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}