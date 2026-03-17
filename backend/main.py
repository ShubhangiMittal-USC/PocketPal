"""
PocketPal FastAPI backend — all routes.
"""
from __future__ import annotations

import json
from datetime import date
from typing import Generator

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db.database import SessionLocal, engine
from app.db import models, crud
from app.agent import ollama_agent
from app.agent import router as rules_router
from app.agent import meal_tools, tools as agent_tools
from app.agent.schemas import (
    ChatRequest, ChatResponse, ToolCall,
    BlockStatusRequest,
    MealSuggestRequest, MealSaveRequest, MealDeleteRequest,
    InsightsRequest,
)

# Create all tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PocketPal API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://pocketpalfrontend.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ── DB dependency ─────────────────────────────────────────────────────────────

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Chat ──────────────────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    if req.llm == "ollama":
        result = ollama_agent.run_ollama_agent(
            db, req.user_id, req.message, trace=req.trace
        )
    else:
        result = rules_router.run_agent(
            db, req.user_id, req.message, trace=req.trace
        )
    return ChatResponse(
        reply          = result["reply"],
        intent         = result["intent"],
        tool_calls     = [ToolCall(**tc) for tc in result.get("tool_calls", [])],
        memory_updates = result.get("memory_updates", []),
        debug          = result.get("debug"),
    )


# ── Plan ──────────────────────────────────────────────────────────────────────

@app.get("/plan")
def get_plan(user_id: str, date_str: str, db: Session = Depends(get_db)):
    try:
        plan_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="date_str must be YYYY-MM-DD")
    row = crud.get_plan(db, user_id, plan_date)
    if not row:
        return {"date": date_str, "plan": None}
    return {"date": date_str, "plan": json.loads(row.plan_json)}


@app.get("/plan/status")
def get_plan_status(user_id: str, date_str: str, db: Session = Depends(get_db)):
    try:
        plan_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="date_str must be YYYY-MM-DD")
    status = crud.get_block_status_map(db, user_id, plan_date)
    return {"date": date_str, "status": status}


@app.post("/plan/status")
def update_plan_status(req: BlockStatusRequest, db: Session = Depends(get_db)):
    try:
        plan_date = date.fromisoformat(req.date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="date_str must be YYYY-MM-DD")
    row = crud.upsert_block_status(
        db, req.user_id, plan_date, req.block_index,
        done=req.done, priority=req.priority,
    )
    return {"block_index": row.block_index, "done": row.done, "priority": row.priority}


# ── Meals ─────────────────────────────────────────────────────────────────────

@app.post("/meals/suggest")
def suggest_meals(req: MealSuggestRequest, db: Session = Depends(get_db)):
    """Suggest 3 meals from ingredients + saved user preferences."""
    # merge saved prefs with any per-request overrides
    saved_prefs = crud.get_memories(db, req.user_id)
    merged      = {**saved_prefs, **req.preferences}
    return meal_tools.suggest_meals(db, req.user_id, req.ingredients, merged)


@app.get("/meals/saved")
def get_saved_meals(user_id: str, db: Session = Depends(get_db)):
    return meal_tools.get_saved_meals(db, user_id)


@app.post("/meals/save")
def save_meal(req: MealSaveRequest, db: Session = Depends(get_db)):
    return meal_tools.save_meal(
        db, req.user_id,
        name=req.name, ingredients=req.ingredients,
        recipe=req.recipe, tags=req.tags,
    )


@app.delete("/meals/delete")
def delete_meal(req: MealDeleteRequest, db: Session = Depends(get_db)):
    return meal_tools.delete_meal(db, req.user_id, req.name)


# ── Insights ─────────────────────────────────────────────────────────────────

@app.get("/insights")
def get_insights(user_id: str, days: int = 7, db: Session = Depends(get_db)):
    return agent_tools.get_insights(db, user_id, days=days)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
