"use client";

import { useEffect, useState } from "react";

const USER_ID = "demo";

type Meal = {
  name: string;
  ingredients: string[];
  recipe: string;
  tags: string[];
  prep_time?: string;
};

function tagColor(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("veg")) return { bg: "#f0fdf4", border: "#86efac", text: "#166534" };
  if (t.includes("quick") || t.includes("fast")) return { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" };
  if (t.includes("protein") || t.includes("high-protein")) return { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" };
  if (t.includes("vegan")) return { bg: "#f0fdf4", border: "#4ade80", text: "#14532d" };
  return { bg: "#fdf2f8", border: "#fce7f3", text: "#be185d" };
}

export default function MealsPage() {
  const [ingredients, setIngredients]     = useState("");
  const [suggestions, setSuggestions]     = useState<Meal[]>([]);
  const [savedMeals,  setSavedMeals]      = useState<Meal[]>([]);
  const [loading,     setLoading]         = useState(false);
  const [saveLoading, setSaveLoading]     = useState<string | null>(null);
  const [tab,         setTab]             = useState<"suggest" | "saved">("suggest");
  const [toast,       setToast]           = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx]     = useState<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function fetchSaved() {
    try {
      const res  = await fetch(`http://localhost:8000/meals/saved?user_id=${USER_ID}`);
      const data = await res.json();
      setSavedMeals(data.meals ?? []);
    } catch {}
  }

  useEffect(() => { fetchSaved(); }, []);

  async function suggest() {
    const ingr = ingredients.split(",").map(s => s.trim()).filter(Boolean);
    if (!ingr.length) return;
    setLoading(true);
    setSuggestions([]);
    try {
      const res  = await fetch("http://localhost:8000/meals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, ingredients: ingr }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch { showToast("Backend not reachable"); }
    finally   { setLoading(false); }
  }

  async function saveMeal(meal: Meal) {
    setSaveLoading(meal.name);
    try {
      await fetch("http://localhost:8000/meals/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, ...meal }),
      });
      showToast(`${meal.name} saved! 🎀`);
      await fetchSaved();
    } catch { showToast("Could not save meal"); }
    finally   { setSaveLoading(null); }
  }

  async function deleteMeal(name: string) {
    try {
      await fetch("http://localhost:8000/meals/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, name }),
      });
      showToast("Removed!");
      await fetchSaved();
    } catch {}
  }

  const displayMeals = tab === "suggest" ? suggestions : savedMeals;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fdf2f8; font-family: 'DM Sans', sans-serif; }

        .page { min-height: 100svh; display: grid; grid-template-columns: 280px 1fr; height: 100svh; overflow: hidden; }

        .sidebar {
          background: white; border-right: 1px solid #fce7f3;
          display: flex; flex-direction: column; padding: 28px 20px; gap: 24px; overflow-y: auto;
        }
        .logo-row { display: flex; align-items: center; gap: 10px; }
        .logo-blob {
          width: 42px; height: 42px; border-radius: 14px;
          background: linear-gradient(135deg, #f472b6, #fda4af);
          display: flex; align-items: center; justify-content: center; font-size: 20px;
          box-shadow: 0 4px 16px rgba(244,114,182,0.35); flex-shrink: 0;
        }
        .logo-text { font-family: 'Instrument Serif', serif; font-size: 22px; color: #1c1c1e; }

        .sidebar-info { font-size: 12px; color: #9ca3af; line-height: 1.7; }
        .sidebar-info b { color: #374151; }

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

        .main { display: flex; flex-direction: column; height: 100svh; overflow: hidden; background: #fdf2f8; }

        .topbar { padding: 24px 32px 0; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; }
        .topbar-title { font-family: 'Instrument Serif', serif; font-size: 30px; color: #1c1c1e; font-style: italic; }
        .topbar-sub { font-size: 13px; color: #9ca3af; margin-top: 3px; }

        .scroll-area { flex: 1; overflow-y: auto; padding: 20px 32px 32px; scrollbar-width: thin; scrollbar-color: #fce7f3 transparent; }

        /* Input area */
        .input-card {
          background: white; border: 1.5px solid #fce7f3; border-radius: 20px;
          padding: 20px; margin-bottom: 20px;
        }
        .input-label { font-size: 12px; font-weight: 600; color: #9ca3af; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px; }
        .input-row { display: flex; gap: 10px; }
        .ingr-input {
          flex: 1; border: 1.5px solid #fce7f3; border-radius: 14px;
          padding: 10px 16px; font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; color: #1c1c1e; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ingr-input:focus { border-color: #f472b6; box-shadow: 0 0 0 4px rgba(244,114,182,0.15); }
        .ingr-input::placeholder { color: #d1d5db; }
        .suggest-btn {
          background: linear-gradient(135deg, #f472b6, #fda4af);
          border: none; border-radius: 14px; padding: 10px 22px;
          font-size: 14px; font-weight: 600; color: white; cursor: pointer;
          box-shadow: 0 4px 12px rgba(244,114,182,0.35);
          transition: all 0.2s; white-space: nowrap;
        }
        .suggest-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(244,114,182,0.4); }
        .suggest-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Tabs */
        .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab-btn {
          padding: 8px 18px; border-radius: 20px; border: 1.5px solid #fce7f3;
          font-size: 13px; font-weight: 500; cursor: pointer;
          background: white; color: #6b7280; transition: all 0.15s;
        }
        .tab-btn.active { background: linear-gradient(135deg, #fce7f3, #fdf4ff); color: #be185d; border-color: #fce7f3; font-weight: 600; }
        .tab-btn:hover:not(.active) { border-color: #f472b6; color: #be185d; }

        /* Meal cards */
        .meals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

        .meal-card {
          background: white; border: 1.5px solid #fce7f3; border-radius: 20px;
          overflow: hidden; transition: all 0.25s ease;
        }
        .meal-card:hover { box-shadow: 0 6px 24px rgba(244,114,182,0.15); transform: translateY(-2px); border-color: #fbcfe8; }

        .meal-header {
          padding: 18px 18px 14px;
          cursor: pointer;
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
        }
        .meal-name { font-size: 16px; font-weight: 600; color: #1c1c1e; font-family: 'Instrument Serif', serif; }
        .meal-prep { font-size: 11px; color: #9ca3af; margin-top: 3px; }

        .meal-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
        .tag-pill {
          padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 500; border: 1px solid;
        }

        .meal-expand { color: #d1d5db; font-size: 14px; flex-shrink: 0; transition: transform 0.2s; }
        .meal-expand.open { transform: rotate(180deg); }

        .meal-body { padding: 0 18px 18px; border-top: 1px solid #fce7f3; padding-top: 14px; }
        .meal-section-label { font-size: 10px; font-weight: 600; color: #9ca3af; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
        .meal-ingr-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
        .ingr-chip { background: #fdf2f8; border: 1px solid #fce7f3; border-radius: 8px; padding: 3px 10px; font-size: 12px; color: #be185d; }
        .meal-recipe { font-size: 13px; color: #4b5563; line-height: 1.7; margin-bottom: 14px; }

        .meal-actions { display: flex; gap: 8px; }
        .save-btn {
          flex: 1; padding: 10px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, #f472b6, #fda4af);
          color: white; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(244,114,182,0.3);
        }
        .save-btn:hover { transform: translateY(-1px); }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .delete-btn {
          padding: 10px 14px; border-radius: 12px; border: 1.5px solid #fce7f3;
          background: white; font-size: 13px; cursor: pointer; transition: all 0.2s; color: #ef4444;
        }
        .delete-btn:hover { background: #fef2f2; border-color: #fca5a5; }

        /* Skeleton */
        .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .skeleton-card { height: 130px; background: white; border-radius: 20px; border: 1.5px solid #fce7f3; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }

        /* Empty */
        .empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
        .empty-emoji { font-size: 48px; margin-bottom: 16px; }
        .empty-title { font-family: 'Instrument Serif', serif; font-size: 22px; color: #1c1c1e; margin-bottom: 6px; }

        /* Toast */
        .toast {
          position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
          background: #1c1c1e; color: white; padding: 12px 24px; border-radius: 20px;
          font-size: 14px; font-weight: 500; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          animation: toastIn 0.3s cubic-bezier(.34,1.56,.64,1) both; z-index: 100; white-space: nowrap;
        }
        @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(12px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

        @media (max-width: 640px) { .page { grid-template-columns: 1fr; } .sidebar { display: none; } .topbar, .scroll-area { padding-left: 16px; padding-right: 16px; } }
      `}</style>

      <div className="page">
        <aside className="sidebar">
          <div className="logo-row">
            <div className="logo-blob">🍱</div>
            <span className="logo-text">PocketPal</span>
          </div>

          <div className="sidebar-info">
            <b>Meal Helper</b><br /><br />
            Tell me what ingredients you have and I'll suggest 3 meals that match your dietary preferences.<br /><br />
            <b>Tip:</b> separate ingredients with commas.<br /><br />
            Your saved preferences (diet, allergies) are applied automatically.
          </div>

          <div className="sidebar-nav">
            <a className="nav-btn" href="/">💬 Chat</a>
            <a className="nav-btn" href="/planner">🎀 Planner</a>
            <a className="nav-btn active" href="/meals">🍱 Meals</a>
            <a className="nav-btn" href="/insights">📊 Insights</a>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">Meal Ideas ✦</div>
              <div className="topbar-sub">Tell me what you have and I'll cook up some ideas</div>
            </div>
            <a href="/" style={{ background:"white", border:"1.5px solid #fce7f3", borderRadius:14, padding:"8px 16px", fontSize:13, fontWeight:500, color:"#be185d", textDecoration:"none" }}>← Chat</a>
          </div>

          <div className="scroll-area">
            {/* Ingredient input */}
            <div className="input-card">
              <div className="input-label">What's in your fridge?</div>
              <div className="input-row">
                <input
                  className="ingr-input"
                  value={ingredients}
                  onChange={e => setIngredients(e.target.value)}
                  placeholder="tofu, rice, soy sauce, ginger, broccoli..."
                  onKeyDown={e => e.key === "Enter" && suggest()}
                />
                <button className="suggest-btn" onClick={suggest} disabled={loading || !ingredients.trim()}>
                  {loading ? "Thinking…" : "✦ Suggest"}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <button className={`tab-btn ${tab === "suggest" ? "active" : ""}`} onClick={() => setTab("suggest")}>
                ✦ Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
              </button>
              <button className={`tab-btn ${tab === "saved" ? "active" : ""}`} onClick={() => { setTab("saved"); fetchSaved(); }}>
                🎀 Saved {savedMeals.length > 0 && `(${savedMeals.length})`}
              </button>
            </div>

            {/* Meals */}
            {loading ? (
              <div className="skeleton-grid">
                {[1,2,3].map(i => <div key={i} className="skeleton-card" style={{ animationDelay: `${i*0.1}s` }} />)}
              </div>
            ) : displayMeals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-emoji">{tab === "suggest" ? "🥗" : "🍽️"}</div>
                <div className="empty-title">{tab === "suggest" ? "No suggestions yet" : "No saved meals"}</div>
                <div style={{ fontSize:13, marginTop:4 }}>
                  {tab === "suggest"
                    ? "Enter ingredients above and hit Suggest"
                    : "Save a suggestion to see it here"}
                </div>
              </div>
            ) : (
              <div className="meals-grid">
                {displayMeals.map((meal, idx) => {
                  const isOpen = expandedIdx === idx;
                  return (
                    <div key={`${meal.name}-${idx}`} className="meal-card" style={{ animation: `fadeUp 0.3s ease ${idx * 0.06}s both` }}>
                      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>
                      <div className="meal-header" onClick={() => setExpandedIdx(isOpen ? null : idx)}>
                        <div>
                          <div className="meal-name">{meal.name}</div>
                          {meal.prep_time && <div className="meal-prep">⏱ {meal.prep_time}</div>}
                          <div className="meal-tags">
                            {(meal.tags ?? []).map(tag => {
                              const c = tagColor(tag);
                              return <span key={tag} className="tag-pill" style={{ background:c.bg, borderColor:c.border, color:c.text }}>{tag}</span>;
                            })}
                          </div>
                        </div>
                        <span className={`meal-expand ${isOpen ? "open" : ""}`}>▼</span>
                      </div>

                      {isOpen && (
                        <div className="meal-body">
                          <div className="meal-section-label">Ingredients</div>
                          <div className="meal-ingr-list">
                            {meal.ingredients.map(i => <span key={i} className="ingr-chip">{i}</span>)}
                          </div>
                          <div className="meal-section-label">Recipe</div>
                          <div className="meal-recipe">{meal.recipe}</div>
                          <div className="meal-actions">
                            {tab === "suggest" ? (
                              <button
                                className="save-btn"
                                onClick={() => saveMeal(meal)}
                                disabled={saveLoading === meal.name}
                              >
                                {saveLoading === meal.name ? "Saving…" : "🎀 Save this meal"}
                              </button>
                            ) : (
                              <button className="delete-btn" onClick={() => deleteMeal(meal.name)}>🗑 Remove</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {toast && <div className="toast">🐾 {toast}</div>}
    </>
  );
}
