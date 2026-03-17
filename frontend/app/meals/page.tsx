"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  if (t.includes("breakfast")) return { bg: "#fff7ed", border: "#fdba74", text: "#c2410c" };
  if (t.includes("lunch") || t.includes("dinner")) return { bg: "#fdf4ff", border: "#e9d5ff", text: "#7c3aed" };
  return { bg: "#fdf2f8", border: "#fce7f3", text: "#be185d" };
}

export default function MealsPage() {
  const [ingredients, setIngredients] = useState("");
  const [suggestions, setSuggestions] = useState<Meal[]>([]);
  const [savedMeals,  setSavedMeals]  = useState<Meal[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [saveLoading, setSaveLoading] = useState<string | null>(null);
  const [tab,         setTab]         = useState<"suggest" | "saved">("suggest");
  const [toast,       setToast]       = useState<string | null>(null);

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
    setTab("suggest");
    try {
      const res  = await fetch("http://localhost:8000/meals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, ingredients: ingr }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch { showToast("Backend not reachable"); }
    finally  { setLoading(false); }
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
    finally  { setSaveLoading(null); }
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
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#fdf2f8;font-family:'DM Sans',sans-serif}
        .page{min-height:100svh;display:grid;grid-template-columns:280px 1fr;height:100svh;overflow:hidden}
        .sidebar{background:white;border-right:1px solid #fce7f3;display:flex;flex-direction:column;padding:28px 20px;gap:24px;overflow-y:auto}
        .logo-row{display:flex;align-items:center;gap:10px}
        .logo-blob{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#f472b6,#fda4af);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 16px rgba(244,114,182,0.35);flex-shrink:0}
        .logo-text{font-family:'Instrument Serif',serif;font-size:22px;color:#1c1c1e}
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
        .back-btn{background:white;border:1.5px solid #fce7f3;border-radius:14px;padding:8px 16px;font-size:13px;font-weight:500;color:#be185d;text-decoration:none;transition:all .2s}
        .back-btn:hover{background:#fdf2f8}
        .scroll-area{flex:1;overflow-y:auto;padding:20px 32px 32px;scrollbar-width:thin;scrollbar-color:#fce7f3 transparent}
        .scroll-area::-webkit-scrollbar{width:4px}
        .scroll-area::-webkit-scrollbar-thumb{background:#fce7f3;border-radius:4px}
        .input-card{background:white;border:1.5px solid #fce7f3;border-radius:20px;padding:20px;margin-bottom:20px}
        .input-label{font-size:12px;font-weight:600;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px}
        .input-row{display:flex;gap:10px}
        .ingr-input{flex:1;border:1.5px solid #fce7f3;border-radius:14px;padding:10px 16px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;color:#1c1c1e;transition:border-color .2s,box-shadow .2s}
        .ingr-input:focus{border-color:#f472b6;box-shadow:0 0 0 4px rgba(244,114,182,.15)}
        .ingr-input::placeholder{color:#d1d5db}
        .suggest-btn{background:linear-gradient(135deg,#f472b6,#fda4af);border:none;border-radius:14px;padding:10px 22px;font-size:14px;font-weight:600;color:white;cursor:pointer;box-shadow:0 4px 12px rgba(244,114,182,.35);transition:all .2s;white-space:nowrap}
        .suggest-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 18px rgba(244,114,182,.4)}
        .suggest-btn:disabled{opacity:.6;cursor:not-allowed}
        .tabs{display:flex;gap:8px;margin-bottom:20px}
        .tab-btn{padding:8px 18px;border-radius:20px;border:1.5px solid #fce7f3;font-size:13px;font-weight:500;cursor:pointer;background:white;color:#6b7280;transition:all .15s}
        .tab-btn.active{background:linear-gradient(135deg,#fce7f3,#fdf4ff);color:#be185d;border-color:#fce7f3;font-weight:600}

        /* Meal cards — always fully visible, stacked vertically */
        .meals-list{display:flex;flex-direction:column;gap:16px}
        .meal-card{background:white;border:1.5px solid #fce7f3;border-radius:20px;padding:22px;animation:fadeUp .3s ease both;transition:box-shadow .2s,border-color .2s}
        .meal-card:hover{border-color:#fda4af;box-shadow:0 6px 24px rgba(244,114,182,.12)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .meal-name{font-family:'Instrument Serif',serif;font-size:20px;color:#1c1c1e;margin-bottom:4px}
        .meal-prep{font-size:12px;color:#9ca3af;margin-bottom:10px}
        .meal-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
        .tag-pill{padding:3px 10px;border-radius:20px;border:1px solid;font-size:11px;font-weight:500}
        .meal-divider{height:1px;background:#fce7f3;margin:14px 0}
        .meal-section-label{font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}
        .meal-ingr-list{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
        .ingr-chip{background:#fdf2f8;border:1px solid #fce7f3;border-radius:8px;padding:3px 10px;font-size:12px;color:#be185d;font-weight:500}
        .meal-recipe{font-size:13px;color:#374151;line-height:1.65;margin-bottom:16px}
        .save-btn{width:100%;padding:11px;border-radius:14px;border:none;background:linear-gradient(135deg,#f472b6,#fda4af);color:white;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px rgba(244,114,182,.3)}
        .save-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 16px rgba(244,114,182,.4)}
        .save-btn:disabled{opacity:.6;cursor:not-allowed}
        .delete-btn{width:100%;padding:11px;border-radius:14px;border:1.5px solid #fce7f3;background:white;font-size:14px;color:#ef4444;cursor:pointer;font-weight:500;transition:all .2s}
        .delete-btn:hover{background:#fef2f2;border-color:#fca5a5}
        .saved-badge{display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:2px 8px;font-size:11px;color:#166534;font-weight:500;margin-bottom:12px}

        /* skeleton */
        .skeleton-list{display:flex;flex-direction:column;gap:16px}
        .skeleton-card{height:200px;background:white;border-radius:20px;border:1.5px solid #fce7f3;animation:pulse 1.5s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        .empty-state{text-align:center;padding:60px 20px;color:#9ca3af}
        .empty-emoji{font-size:48px;margin-bottom:16px}
        .empty-title{font-family:'Instrument Serif',serif;font-size:22px;color:#1c1c1e;margin-bottom:6px}
        .toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1c1c1e;color:white;padding:12px 24px;border-radius:20px;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,.2);animation:toastIn .3s cubic-bezier(.34,1.56,.64,1) both;z-index:100;white-space:nowrap}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @media(max-width:640px){.page{grid-template-columns:1fr}.sidebar{display:none}.topbar,.scroll-area{padding-left:16px;padding-right:16px}}
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
            <Link className="nav-btn" href="/">💬 Chat</Link>
            <Link className="nav-btn" href="/planner">🎀 Planner</Link>
            <Link className="nav-btn active" href="/meals">🍱 Meals</Link>
            <Link className="nav-btn" href="/insights">📊 Insights</Link>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">Meal Ideas ✦</div>
              <div className="topbar-sub">Tell me what you have and I'll cook up some ideas</div>
            </div>
            <Link href="/" className="back-btn">← Chat</Link>
          </div>

          <div className="scroll-area">
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

            <div className="tabs">
              <button className={`tab-btn ${tab === "suggest" ? "active" : ""}`} onClick={() => setTab("suggest")}>
                ✦ Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
              </button>
              <button className={`tab-btn ${tab === "saved" ? "active" : ""}`} onClick={() => { setTab("saved"); fetchSaved(); }}>
                🎀 Saved {savedMeals.length > 0 && `(${savedMeals.length})`}
              </button>
            </div>

            {loading ? (
              <div className="skeleton-list">
                {[1,2,3].map(i => <div key={i} className="skeleton-card" style={{ animationDelay:`${i*0.1}s` }} />)}
              </div>
            ) : displayMeals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-emoji">{tab === "suggest" ? "🥗" : "🍽️"}</div>
                <div className="empty-title">{tab === "suggest" ? "No suggestions yet" : "No saved meals"}</div>
                <div style={{ fontSize:13, marginTop:4 }}>
                  {tab === "suggest" ? "Enter ingredients above and hit Suggest" : "Save a suggestion to see it here"}
                </div>
              </div>
            ) : (
              <div className="meals-list">
                {displayMeals.map((meal, idx) => {
                  const alreadySaved = savedMeals.some(m => m.name === meal.name);
                  return (
                    <div key={`${meal.name}-${idx}`} className="meal-card" style={{ animationDelay:`${idx*0.08}s` }}>
                      <div className="meal-name">{meal.name}</div>
                      {meal.prep_time && <div className="meal-prep">⏱ {meal.prep_time}</div>}
                      <div className="meal-tags">
                        {(meal.tags ?? []).map(tag => {
                          const c = tagColor(tag);
                          return <span key={tag} className="tag-pill" style={{ background:c.bg, borderColor:c.border, color:c.text }}>{tag}</span>;
                        })}
                      </div>

                      <div className="meal-divider" />

                      <div className="meal-section-label">Ingredients</div>
                      <div className="meal-ingr-list">
                        {(meal.ingredients ?? []).map(ing => (
                          <span key={ing} className="ingr-chip">{ing}</span>
                        ))}
                      </div>

                      <div className="meal-section-label">Recipe</div>
                      <div className="meal-recipe">{meal.recipe}</div>

                      {tab === "suggest" ? (
                        alreadySaved ? (
                          <div className="saved-badge">✓ Saved to favourites</div>
                        ) : (
                          <button
                            className="save-btn"
                            onClick={() => saveMeal(meal)}
                            disabled={saveLoading === meal.name}
                          >
                            {saveLoading === meal.name ? "Saving…" : "🎀 Save this meal"}
                          </button>
                        )
                      ) : (
                        <button className="delete-btn" onClick={() => deleteMeal(meal.name)}>🗑 Remove from saved</button>
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
