import json
from datetime import date
from sqlalchemy.orm import Session
from app.db import crud

def create_plan(db: Session, user_id: str, plan_date: date, blocks: list[dict], top3: list[str]) -> dict:
    plan_obj = {
        "date": plan_date.isoformat(),
        "blocks": blocks,
        "top3": top3
    }
    row = crud.upsert_plan(db, user_id, plan_date, json.dumps(plan_obj))
    return {"date": row.date.isoformat(), "plan": plan_obj}

def get_plan(db: Session, user_id: str, plan_date: date) -> dict:
    row = crud.get_plan(db, user_id, plan_date)
    if not row:
        return {"date": plan_date.isoformat(), "plan": None}
    return {"date": row.date.isoformat(), "plan": json.loads(row.plan_json)}