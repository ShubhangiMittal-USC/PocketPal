from __future__ import annotations

from datetime import date as dtdate
from sqlalchemy.orm import Session
from . import models


# ── Users ────────────────────────────────────────────────────────────────────

def get_or_create_user(db: Session, user_id: str) -> models.User:
    user = db.get(models.User, user_id)
    if user:
        return user
    user = models.User(id=user_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Memory / Preferences ─────────────────────────────────────────────────────

def upsert_memory(db: Session, user_id: str, key: str, value: str) -> models.Memory:
    existing = (
        db.query(models.Memory)
        .filter(models.Memory.user_id == user_id, models.Memory.key == key)
        .one_or_none()
    )
    if existing:
        existing.value = value
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    m = models.Memory(user_id=user_id, key=key, value=value)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def get_memories(db: Session, user_id: str) -> dict[str, str]:
    rows = db.query(models.Memory).filter(models.Memory.user_id == user_id).all()
    return {r.key: r.value for r in rows}


# ── Habit Logs ───────────────────────────────────────────────────────────────

def upsert_habit_log(
    db: Session, user_id: str, habit: str, value: float, log_date: dtdate
) -> models.HabitLog:
    existing = (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.user_id == user_id,
            models.HabitLog.date   == log_date,
            models.HabitLog.habit  == habit,
        )
        .one_or_none()
    )
    if existing:
        existing.value = value
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    h = models.HabitLog(user_id=user_id, habit=habit, value=value, date=log_date)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


def get_habit_logs_range(
    db: Session, user_id: str, start: dtdate, end: dtdate
) -> list[models.HabitLog]:
    return (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.user_id >= user_id,  # index hit
            models.HabitLog.user_id == user_id,
            models.HabitLog.date    >= start,
            models.HabitLog.date    <= end,
        )
        .order_by(models.HabitLog.date)
        .all()
    )


# ── Plans ────────────────────────────────────────────────────────────────────

def upsert_plan(
    db: Session, user_id: str, plan_date: dtdate, plan_json: str
) -> models.Plan:
    existing = (
        db.query(models.Plan)
        .filter(models.Plan.user_id == user_id, models.Plan.date == plan_date)
        .one_or_none()
    )
    if existing:
        existing.plan_json = plan_json
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    p = models.Plan(user_id=user_id, date=plan_date, plan_json=plan_json)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def get_plan(db: Session, user_id: str, plan_date: dtdate) -> models.Plan | None:
    return (
        db.query(models.Plan)
        .filter(models.Plan.user_id == user_id, models.Plan.date == plan_date)
        .one_or_none()
    )


# ── Plan Block Status ─────────────────────────────────────────────────────────

def get_block_status_map(
    db: Session, user_id: str, plan_date: dtdate
) -> dict[int, dict]:
    rows = (
        db.query(models.PlanBlockStatus)
        .filter(
            models.PlanBlockStatus.user_id == user_id,
            models.PlanBlockStatus.date    == plan_date,
        )
        .all()
    )
    return {
        r.block_index: {
            "done":     bool(r.done),
            "priority": bool(getattr(r, "priority", False)),
        }
        for r in rows
    }


def upsert_block_status(
    db: Session,
    user_id: str,
    plan_date: dtdate,
    block_index: int,
    done: bool | None = None,
    priority: bool | None = None,
) -> models.PlanBlockStatus:
    row = (
        db.query(models.PlanBlockStatus)
        .filter(
            models.PlanBlockStatus.user_id     == user_id,
            models.PlanBlockStatus.date        == plan_date,
            models.PlanBlockStatus.block_index == block_index,
        )
        .one_or_none()
    )
    if row:
        if done     is not None: row.done     = done
        if priority is not None: row.priority = priority
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    row = models.PlanBlockStatus(
        user_id     = user_id,
        date        = plan_date,
        block_index = block_index,
        done        = bool(done)     if done     is not None else False,
        priority    = bool(priority) if priority is not None else False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ── Saved Meals ───────────────────────────────────────────────────────────────

def upsert_saved_meal(
    db: Session, user_id: str, name: str, meal_json: str
) -> models.SavedMeal:
    existing = (
        db.query(models.SavedMeal)
        .filter(models.SavedMeal.user_id == user_id, models.SavedMeal.name == name)
        .one_or_none()
    )
    if existing:
        existing.meal_json = meal_json
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    m = models.SavedMeal(user_id=user_id, name=name, meal_json=meal_json)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def get_meals(db: Session, user_id: str) -> list[models.SavedMeal]:
    return (
        db.query(models.SavedMeal)
        .filter(models.SavedMeal.user_id == user_id)
        .order_by(models.SavedMeal.updated_at.desc())
        .all()
    )


def delete_meal(db: Session, user_id: str, name: str) -> bool:
    row = (
        db.query(models.SavedMeal)
        .filter(models.SavedMeal.user_id == user_id, models.SavedMeal.name == name)
        .one_or_none()
    )
    if row:
        db.delete(row)
        db.commit()
        return True
    return False
