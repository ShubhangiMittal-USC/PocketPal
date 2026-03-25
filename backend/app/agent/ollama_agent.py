"""
PocketPal Agent — Groq cloud LLM with persistent per-user chat history.
Drop-in replacement for the local Ollama version.
"""

import os
import json
import ast
import requests
from collections import defaultdict
from datetime import date
from typing import Any
from sqlalchemy.orm import Session

from app.db import crud
from . import tools as local_tools
from . import planner_tools
from . import meal_tools

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"

ALLOWED_HABITS = {"water_liters", "steps", "calories", "sleep_hours", "mood_score"}

# ---------------------------------------------------------------------------
# Persistent in-memory chat history  { user_id: [ {role, content}, ... ] }
# Survives across requests for the lifetime of the FastAPI process.
# ---------------------------------------------------------------------------

MAX_HISTORY = 20   # keep last 20 turns (10 exchanges) to stay within token limits
_chat_histories: dict[str, list[dict]] = defaultdict(list)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM = """You are PocketPal 🐾, a cozy, friendly productivity and wellness buddy.

Tone: warm, concise, encouraging. Use 1-2 emojis max per message.

You have access to tools for:
- Saving user preferences (diet, allergies, lifestyle)
- Logging habits (water, steps, sleep, calories, mood)
- Creating day plans with time blocks
- Suggesting meals based on ingredients + preferences
- Saving favourite meals

Rules:
1. ONLY call a tool when the user clearly requests that action. Never invent data.
2. If the user asks a general question, answer conversationally without tools.
3. Use today's date unless the user specifies otherwise.
4. After a tool succeeds, confirm briefly what was done.
5. If a tool returns an error, DO NOT claim success — ask a clarifying question.
6. For meal suggestions: always check user preferences (diet, allergies) before suggesting.
7. When saving a meal, ONLY save meals explicitly suggested in THIS conversation. Use the exact name and recipe. Never invent a meal name.
8. For insights/summaries: use the get_insights tool to fetch real data.
9. Keep replies under 3 sentences unless showing a list or plan.
10. Never print raw JSON. Use tools.
11. CRITICAL — create_plan rules:
    a. ONLY include blocks the user EXPLICITLY mentioned. NEVER add, split, rename, or invent blocks.
    b. If user says "10am class, 12pm lunch, 3pm gym" → exactly 3 blocks. No "lunch break", no "gym time", no gap fillers.
    c. Use the user's EXACT wording for titles (e.g. "class" not "class session").
    d. Call create_plan exactly ONCE with ALL blocks in a single call.
    e. NEVER duplicate blocks.
12. NEVER output raw JSON, function calls, or tool syntax in your reply text. Only respond in plain natural language. Never call it multiple times for the same request.
"""

# ---------------------------------------------------------------------------
# Coercion helpers
# ---------------------------------------------------------------------------

def _coerce_list(value):
    if isinstance(value, list):
        return value
    if value is None:
        return []
    if isinstance(value, str):
        s = value.strip()
        try:
            v = json.loads(s)
            if isinstance(v, list):
                return v
        except Exception:
            pass
        try:
            v = ast.literal_eval(s)
            if isinstance(v, list):
                return v
        except Exception:
            pass
    return []


def _coerce_blocks(value):
    blocks  = _coerce_list(value)
    cleaned = []
    for b in blocks:
        if not isinstance(b, dict):
            continue
        start = str(b.get("start", "")).strip()
        end   = str(b.get("end",   "")).strip()
        title = str(b.get("title", "")).strip()
        if start and end and title:
            cleaned.append({"start": start, "end": end, "title": title})
    return cleaned


def _resolve_date(raw) -> date:
    if not raw:
        return date.today()
    s = str(raw).strip().lower()
    if not s or "today" in s or "yyyy" in s or "assuming" in s:
        return date.today()
    try:
        return date.fromisoformat(s)
    except ValueError:
        return date.today()

# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

def _execute_tool(db: Session, user_id: str, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:

    if tool_name == "save_preference":
        return local_tools.save_preference(
            db, user_id,
            key=str(args["key"]).strip(),
            value=str(args["value"]).strip(),
        )

    if tool_name == "log_habit":
        habit = str(args.get("habit", "")).strip()
        if habit not in ALLOWED_HABITS:
            return {"error": f"Unsupported habit '{habit}'", "allowed": sorted(ALLOWED_HABITS)}
        value    = float(args["value"])
        log_date = _resolve_date(args.get("date"))
        return local_tools.log_habit(db, user_id, habit=habit, value=value, log_date=log_date)

    if tool_name == "create_plan":
        plan_date = _resolve_date(args.get("date"))
        blocks    = _coerce_blocks(args.get("blocks"))
        top3      = [str(x).strip() for x in _coerce_list(args.get("top3")) if str(x).strip()][:3]
        while len(top3) < 3:
            top3.append("")
        if not blocks:
            return {"error": "blocks must be a non-empty list of {start, end, title}"}
        return planner_tools.create_plan(db, user_id, plan_date, blocks=blocks, top3=top3)

    if tool_name == "suggest_meals":
        ingredients = _coerce_list(args.get("ingredients"))
        preferences = crud.get_memories(db, user_id)
        extra_prefs = args.get("preferences", {})
        if isinstance(extra_prefs, dict):
            preferences.update(extra_prefs)
        return meal_tools.suggest_meals(db, user_id, ingredients=ingredients, preferences=preferences)

    if tool_name == "save_meal":
        return meal_tools.save_meal(
            db, user_id,
            name        = str(args.get("name", "")).strip(),
            ingredients = _coerce_list(args.get("ingredients")),
            recipe      = str(args.get("recipe", "")).strip(),
            tags        = _coerce_list(args.get("tags")),
        )

    if tool_name == "get_saved_meals":
        return meal_tools.get_saved_meals(db, user_id)

    if tool_name == "get_insights":
        days = int(args.get("days", 7))
        return local_tools.get_insights(db, user_id, days=days)

    return {"error": f"Unknown tool: {tool_name}"}

# ---------------------------------------------------------------------------
# Tool schemas (OpenAI-compatible — same format Groq expects)
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "save_preference",
            "description": "Remember a user preference such as diet, allergies, or lifestyle choices.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key":   {"type": "string", "description": "e.g. 'diet', 'allergy', 'goal'"},
                    "value": {"type": "string", "description": "e.g. 'vegetarian', 'peanuts', 'lose weight'"},
                },
                "required": ["key", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_habit",
            "description": "Log a habit metric. Supported: water_liters, steps, calories, sleep_hours, mood_score (1-10).",
            "parameters": {
                "type": "object",
                "properties": {
                    "habit": {
                        "type": "string",
                        "enum": ["water_liters", "steps", "calories", "sleep_hours", "mood_score"],
                    },
                    "value": {"type": "number"},
                    "date":  {"type": "string", "description": "YYYY-MM-DD, defaults to today"},
                },
                "required": ["habit", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_plan",
            "description": "Create a time-blocked day plan. Use 24h time strings like '09:30'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "blocks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "start": {"type": "string"},
                                "end":   {"type": "string"},
                                "title": {"type": "string"},
                            },
                            "required": ["start", "end", "title"],
                        },
                    },
                    "top3": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Top 3 priorities for the day (short phrases)",
                    },
                },
                "required": ["date", "blocks", "top3"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_meals",
            "description": "Suggest 3 meal ideas based on available ingredients and dietary preferences.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ingredients": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Ingredients the user has available",
                    },
                    "preferences": {
                        "type": "object",
                        "description": "Additional constraints e.g. {cuisine: 'asian', max_time: '30 mins'}",
                    },
                },
                "required": ["ingredients"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_meal",
            "description": "Save a meal recipe to the user's favourites.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name":        {"type": "string"},
                    "ingredients": {"type": "array", "items": {"type": "string"}},
                    "recipe":      {"type": "string", "description": "Short cooking instructions"},
                    "tags":        {"type": "array",  "items": {"type": "string"}, "description": "e.g. ['vegetarian','quick']"},
                },
                "required": ["name", "ingredients", "recipe"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_saved_meals",
            "description": "Retrieve the user's saved/favourite meals.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_insights",
            "description": "Get habit streaks, weekly summaries and completion trends for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Number of past days to analyse (default 7)"},
                },
            },
        },
    },
]

# ---------------------------------------------------------------------------
# Groq API call helper
# ---------------------------------------------------------------------------

def _groq_call(messages: list[dict], use_tools: bool = True) -> dict:
    """Single call to the Groq chat completions endpoint."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY environment variable is not set.")

    payload: dict[str, Any] = {
        "model":    GROQ_MODEL,
        "messages": messages,
    }
    if use_tools:
        payload["tools"]       = TOOLS
        payload["tool_choice"] = "auto"

    resp = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type":  "application/json",
        },
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()

# ---------------------------------------------------------------------------
# Main agent entry point
# ---------------------------------------------------------------------------

def run_ollama_agent(db: Session, user_id: str, message: str, trace: bool = False) -> dict:
    crud.get_or_create_user(db, user_id)

    # Build system prompt with user's saved memory
    memories = crud.get_memories(db, user_id)
    memory_block = ""
    if memories:
        mem_lines    = "\n".join(f"  - {k}: {v}" for k, v in memories.items())
        memory_block = f"\n\nUser memory (use this context):\n{mem_lines}"
    system_with_memory = SYSTEM + memory_block

    # ── Retrieve + update persistent history ────────────────────────────────
    history = _chat_histories[user_id]
    history.append({"role": "user", "content": message})

    # Trim to MAX_HISTORY to avoid token overflow
    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]
        _chat_histories[user_id] = history

    # Full messages list = system prompt + conversation history
    messages: list[dict] = [{"role": "system", "content": system_with_memory}] + history

    # ── Round 1: LLM decides whether to call a tool ──────────────────────────
    data1    = _groq_call(messages, use_tools=True)
    choice1  = data1["choices"][0]
    msg1     = choice1["message"]
    tc_raw   = msg1.get("tool_calls") or []

    tool_calls     = []
    memory_updates = []

    # ── Pure conversational reply — no tool needed ───────────────────────────
    if not tc_raw:
        reply = _clean_reply(msg1.get("content") or "I'm here! 🐾")
        # Save assistant reply to history
        history.append({"role": "assistant", "content": reply})
        return _build_response(
            reply=reply,
            intent="groq_chat",
            tool_calls=[],
            memory_updates=[],
            db=db, user_id=user_id, trace=trace,
        )

    # ── Process tool calls ───────────────────────────────────────────────────
    # Groq returns tool calls in OpenAI format; append the assistant message first
    messages.append(msg1)

    for tc in tc_raw:
        fn   = tc.get("function", {})
        name = fn.get("name", "")
        try:
            args = json.loads(fn.get("arguments", "{}"))
        except Exception:
            args = {}

        result = _execute_tool(db, user_id, name, args)
        tool_calls.append({"tool": name, "args": args})

        if name == "save_preference" and "key" in result and "value" in result:
            memory_updates.append({"key": result["key"], "value": result["value"]})

        # Groq expects tool results in this exact format
        messages.append({
            "role":         "tool",
            "tool_call_id": tc.get("id", name),
            "name":         name,
            "content":      json.dumps(result),
        })

    # ── Round 2: get final user-facing reply ─────────────────────────────────
    data2 = _groq_call(messages, use_tools=False)
    reply = data2["choices"][0]["message"].get("content") or "Done! 🐾"

    # Strip ANY leaked tool-call / JSON artifacts from the reply
    reply = _clean_reply(reply)

    # Save the final assistant reply to persistent history
    history.append({"role": "assistant", "content": reply})

    return _build_response(
        reply=reply,
        intent="groq_tool_call",
        tool_calls=tool_calls,
        memory_updates=memory_updates,
        db=db, user_id=user_id, trace=trace,
    )

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

import re as _re

def _clean_reply(text: str) -> str:
    """Remove any leaked tool-call artifacts / raw JSON from LLM reply."""
    # Remove <function=...>...</function> tags and their contents
    text = _re.sub(r"<function=[^>]*>.*?</function>", "", text, flags=_re.DOTALL)
    # Remove function=name>{...} (no angle brackets)
    text = _re.sub(r"function=\w+>\s*\{.*?\}", "", text, flags=_re.DOTALL)
    # Remove (tool_name>{...})
    text = _re.sub(r"\(\w+>\s*\{.*?\}\)", "", text, flags=_re.DOTALL)
    # Remove any remaining standalone JSON objects with "blocks", "date", "top3" keys
    text = _re.sub(r"\{[^{}]*\"(?:blocks|top3|date)\"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", "", text, flags=_re.DOTALL)
    # Remove leftover </function> or <function> tags
    text = _re.sub(r"</?function[^>]*>", "", text)
    # Clean up excess whitespace
    text = _re.sub(r"\n{3,}", "\n\n", text).strip()
    return text or "Done! 🐾"


def _build_response(*, reply, intent, tool_calls, memory_updates, db, user_id, trace):
    debug = {"memory": crud.get_memories(db, user_id)} if trace else None
    return {
        "reply":          reply,
        "intent":         intent,
        "tool_calls":     tool_calls,
        "memory_updates": memory_updates,
        "debug":          debug,
    }


def _extract_json_tool_request(text: str) -> dict | None:
    if not text:
        return None
    start = text.find("{")
    end   = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        obj = json.loads(text[start:end + 1])
        if isinstance(obj, dict) and "name" in obj:
            return obj
    except Exception:
        pass
    return None
