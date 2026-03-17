"""
Meal tools — Milestone 3
Handles: suggest meals from ingredients + prefs, save/retrieve favourites.
Meal suggestions are generated via a secondary Ollama call so they stay
coherent with the user's dietary preferences stored in memory.
"""

from __future__ import annotations

import json
import os
import requests
from sqlalchemy.orm import Session

from app.db import crud, models

OLLAMA_MODEL = os.getenv("POCKETPAL_OLLAMA_MODEL", "llama3.1")
OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")


# ---------------------------------------------------------------------------
# Suggest meals
# ---------------------------------------------------------------------------

def suggest_meals(
    db: Session,
    user_id: str,
    ingredients: list[str],
    preferences: dict,
) -> dict:
    """
    Ask Ollama to suggest 3 meals given ingredients + preferences.
    Returns structured JSON with name, ingredients, recipe, tags.
    """
    pref_lines = "\n".join(f"- {k}: {v}" for k, v in preferences.items()) if preferences else "None specified"
    ingr_str   = ", ".join(ingredients) if ingredients else "anything available"

    prompt = f"""You are a creative chef assistant. 
Suggest exactly 3 meal ideas using these ingredients: {ingr_str}

Dietary preferences:
{pref_lines}

Respond ONLY with a valid JSON array (no markdown, no extra text):
[
  {{
    "name": "Meal Name",
    "ingredients": ["ingredient1", "ingredient2"],
    "recipe": "Short 2-3 sentence cooking instructions.",
    "tags": ["vegetarian", "quick"],
    "prep_time": "20 mins"
  }}
]
"""

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model":  OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()
        content = resp.json().get("message", {}).get("content", "")
        meals   = _parse_meal_json(content)
        return {"suggestions": meals, "ingredients_used": ingredients}
    except Exception as exc:
        return {"error": str(exc), "suggestions": []}


def _parse_meal_json(text: str) -> list[dict]:
    """Extract JSON array from LLM output (strips markdown fences)."""
    text = text.strip()
    # strip ```json ... ``` fences
    if text.startswith("```"):
        lines = text.split("\n")
        text  = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
        text  = text.rstrip("`").strip()
    start = text.find("[")
    end   = text.rfind("]")
    if start == -1 or end == -1:
        return []
    try:
        return json.loads(text[start:end + 1])
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Save / retrieve favourite meals
# ---------------------------------------------------------------------------

def save_meal(
    db: Session,
    user_id: str,
    name: str,
    ingredients: list[str],
    recipe: str,
    tags: list[str] | None = None,
) -> dict:
    if not name or not recipe:
        return {"error": "name and recipe are required"}

    meal_data = {
        "name":        name,
        "ingredients": ingredients,
        "recipe":      recipe,
        "tags":        tags or [],
    }
    row = crud.upsert_saved_meal(db, user_id, name=name, meal_json=json.dumps(meal_data))
    return {"saved": True, "meal": meal_data, "id": row.id}


def get_saved_meals(db: Session, user_id: str) -> dict:
    rows  = crud.get_meals(db, user_id)
    meals = []
    for r in rows:
        try:
            meals.append(json.loads(r.meal_json))
        except Exception:
            pass
    return {"meals": meals, "count": len(meals)}


def delete_meal(db: Session, user_id: str, name: str) -> dict:
    deleted = crud.delete_meal(db, user_id, name)
    return {"deleted": deleted, "name": name}
