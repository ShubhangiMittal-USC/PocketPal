import re
from datetime import date
from sqlalchemy.orm import Session
from app.db import crud
from . import tools

# --- simple parsers (rule-based v1) ---

def detect_intent(text: str) -> str:
    t = text.lower()

    # preferences
    if any(kw in t for kw in ["i'm vegetarian", "i am vegetarian", "vegetarian", "avoid whey", "no whey", "eat eggs", "i eat eggs"]):
        return "preference"

    # habits
    if any(kw in t for kw in ["steps", "walked", "water", "drank", "workout", "gym", "cardio", "strength"]):
        return "habit"

    # planner + meals placeholders for later
    if "plan my day" in t or "schedule" in t:
        return "plan"
    if any(kw in t for kw in ["recipe", "cook", "make dinner", "i have tofu", "ingredients"]):
        return "meal"

    return "general"


def parse_water_liters(text: str):
    t = text.lower()
    if "water" not in t and "drank" not in t:
        return None
    # matches "2l", "2 L", "2 liters", "2 litre"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(l|liter|liters|litre|litres)\b", t)
    if m:
        return float(m.group(1))
    return None


def parse_steps(text: str):
    t = text.lower()
    if "step" not in t and "walk" not in t:
        return None
    # "10k", "10,000", "10000"
    m = re.search(r"(\d{1,3}(?:,\d{3})+|\d+)\s*(steps?)\b", t)
    if m:
        raw = m.group(1).replace(",", "")
        return float(raw)
    m2 = re.search(r"(\d+(?:\.\d+)?)\s*k\s*(steps?)?\b", t)
    if m2:
        return float(m2.group(1)) * 1000
    return None


def parse_preference(text: str) -> list[tuple[str, str]]:
    t = text.lower()
    updates = []

    if "vegetarian" in t:
        updates.append(("diet", "vegetarian"))
    if "eat eggs" in t or "i eat eggs" in t or "eggs" in t:
        updates.append(("eggs_ok", "true"))
    if "avoid whey" in t or "no whey" in t or "no protein powder" in t or "avoid protein powder" in t:
        updates.append(("avoid_whey_protein_powder", "true"))

    return updates


def run_agent(db: Session, user_id: str, message: str, trace: bool = True) -> dict:
    # ensure user exists
    crud.get_or_create_user(db, user_id)

    intent = detect_intent(message)
    tool_calls = []
    memory_updates = []

    if intent == "preference":
        prefs = parse_preference(message)
        if not prefs:
            reply = "Got it! Tell me what preferences you want me to remember (diet, eggs, whey/protein powders, etc.) 😊"
        else:
            for key, value in prefs:
                tools.save_preference(db, user_id, key, value)
                memory_updates.append({"key": key, "value": value})
                tool_calls.append({"tool": "save_preference", "args": {"key": key, "value": value}})
            reply = "Saved! I’ll keep that in mind for future plans and meals ✨"

    elif intent == "habit":
        today = date.today()
        water = parse_water_liters(message)
        steps = parse_steps(message)

        if water is None and steps is None:
            reply = "I can log that! Tell me the number (e.g., “2L water” or “8000 steps”). 📝"
        else:
            if water is not None:
                tools.log_habit(db, user_id, "water_liters", water, today)
                tool_calls.append({"tool": "log_habit", "args": {"habit": "water_liters", "value": water, "date": today.isoformat()}})
            if steps is not None:
                tools.log_habit(db, user_id, "steps", steps, today)
                tool_calls.append({"tool": "log_habit", "args": {"habit": "steps", "value": steps, "date": today.isoformat()}})
            reply = "Logged it! Proud of you 💪"

    elif intent == "plan":
        reply = "Planner is coming next! For now, tell me your top tasks + any fixed timings (class/work/gym). 📅"

    elif intent == "meal":
        reply = "Meal helper is coming next! Tell me what ingredients you have + any constraints. 🍲"

    else:
        reply = "Hi! I’m PocketPal 🐾 You can say: “I drank 2L water”, “I walked 10k steps”, or “I’m vegetarian and eat eggs.”"

    debug = None
    if trace:
        debug = {"memory": crud.get_memories(db, user_id)}

    return {
        "reply": reply,
        "intent": intent,
        "tool_calls": tool_calls,
        "memory_updates": memory_updates,
        "debug": debug,
    }
