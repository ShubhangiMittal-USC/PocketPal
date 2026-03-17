# 🌸 PocketPal — Your AI Wellness Companion

PocketPal is a cozy AI-powered productivity and wellness app that helps you log habits, plan your day, discover meals, and track your progress — all through a friendly chat interface.

---

## ✨ Features

- **💬 AI Chat** — Talk to your personal wellness assistant powered by Llama 3.1. Log habits, ask for meal suggestions, create a daily plan, and get weekly insights — all in natural language.
- **🎀 Planner** — A beautiful time-blocked daily planner. Add, complete, and delete blocks. Watch your progress ring fill up as you crush your day.
- **🍱 Meals** — Get personalized meal suggestions based on your diet preferences and saved favourites for later.
- **📊 Insights** — Visualize your habits over 7, 14, or 30 days with varied, soft charts — area curves for sleep and water, a donut for mood, bars for steps and calories — plus streaks and plan completion trends.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI, Python |
| AI | Ollama (Llama 3.1) with 7 custom tool calls |
| Database | SQLite via SQLAlchemy |
| Fonts | Instrument Serif + DM Sans |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- [Ollama](https://ollama.ai) installed and running

### 1. Clone the repo
```bash
git clone https://github.com/Shubhangi-Mittal/pocketpal.git
cd pocketpal
```

### 2. Start the backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start Ollama
```bash
ollama run llama3.1
```

### 4. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting 🌸

---

## 🤖 AI Tools

The Ollama agent has 7 built-in tools:

| Tool | What it does |
|------|-------------|
| `log_habit` | Logs water, steps, calories, sleep, mood |
| `save_preference` | Saves diet, allergies, lifestyle preferences |
| `create_plan` | Builds a time-blocked daily schedule |
| `suggest_meals` | Generates 3 personalized meal ideas |
| `save_meal` | Saves a favourite meal |
| `get_saved_meals` | Retrieves saved meals |
| `get_insights` | Returns streaks, trends and habit summaries |

---

## 📁 Project Structure

```
pocketpal/
├── frontend/
│   └── app/
│       ├── page.tsx              # Chat
│       ├── planner/page.tsx      # Planner
│       ├── meals/page.tsx        # Meals
│       ├── insights/page.tsx     # Insights
│       ├── context/
│       │   └── planner-context.tsx
│       └── layout.tsx
└── backend/
    ├── main.py
    ├── ollama_agent.py
    ├── tools.py
    ├── meal_tools.py
    ├── models.py
    ├── crud.py
    └── schemas.py
```

---

## 💡 Example Prompts to Try

```
"Plan my day today"
"I drank 2L of water and walked 8000 steps"
"I'm vegetarian — save that preference"
"Suggest meals for tonight"
"How are my habits this week?"
```

---

## 🌷 Built with

Love, late nights, and a lot of pink ✦