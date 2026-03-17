"""
Core tools — habits, preferences, insights.
"""

from __future__ import annotations

from datetime import date, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session

from app.db import crud


def save_preference(db: Session, user_id: str, key: str, value: str) -> dict:
    row = crud.upsert_memory(db, user_id, key, value)
    return {"key": row.key, "value": row.value}


def log_habit(db: Session, user_id: str, habit: str, value: float, log_date: date) -> dict:
    row = crud.upsert_habit_log(db, user_id, habit, value, log_date)
    return {"habit": row.habit, "value": row.value, "date": row.date.isoformat()}


def get_insights(db: Session, user_id: str, days: int = 7) -> dict:
    """
    Return:
    - habit_totals: sum per habit over the window
    - habit_daily: day-by-day breakdown
    - streaks: current streak per habit (consecutive days logged)
    - plan_completion: % done per day
    - top3_hits: how often top-3 priorities were completed
    """
    today     = date.today()
    window    = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    window_set = {d.isoformat() for d in window}

    # ── Habits ───────────────────────────────────────────────────────────────
    logs = crud.get_habit_logs_range(db, user_id, window[0], today)

    habit_daily: dict[str, dict[str, float]] = defaultdict(dict)
    for log in logs:
        habit_daily[log.habit][log.date.isoformat()] = log.value

    habit_totals = {h: sum(vals.values()) for h, vals in habit_daily.items()}

    # Streaks: count from today backwards
    streaks: dict[str, int] = {}
    for habit, daily in habit_daily.items():
        streak = 0
        for d in reversed(window):
            if d.isoformat() in daily:
                streak += 1
            else:
                break
        streaks[habit] = streak

    # ── Plan completion ───────────────────────────────────────────────────────
    plan_completion: dict[str, float] = {}
    for d in window:
        plan = crud.get_plan(db, user_id, d)
        if not plan:
            continue
        import json
        try:
            plan_obj = json.loads(plan.plan_json)
        except Exception:
            continue
        total  = len(plan_obj.get("blocks", []))
        if total == 0:
            continue
        status = crud.get_block_status_map(db, user_id, d)
        done   = sum(1 for v in status.values() if v.get("done"))
        plan_completion[d.isoformat()] = round(done / total * 100, 1)

    avg_completion = (
        round(sum(plan_completion.values()) / len(plan_completion), 1)
        if plan_completion else 0
    )

    # ── Daily habit series for charting ──────────────────────────────────────
    daily_series = []
    for d in window:
        entry = {"date": d.isoformat()}
        for habit, daily in habit_daily.items():
            entry[habit] = daily.get(d.isoformat(), 0)
        daily_series.append(entry)

    return {
        "window_days":      days,
        "habit_totals":     habit_totals,
        "habit_daily":      dict(habit_daily),
        "daily_series":     daily_series,
        "streaks":          streaks,
        "plan_completion":  plan_completion,
        "avg_completion":   avg_completion,
    }
