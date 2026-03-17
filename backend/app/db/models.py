from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import (
    String, Integer, Float, Date, DateTime,
    ForeignKey, UniqueConstraint, Text, Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id:         Mapped[str]      = mapped_column(String, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    memories:    Mapped[list["Memory"]]    = relationship(back_populates="user", cascade="all, delete-orphan")
    habit_logs:  Mapped[list["HabitLog"]]  = relationship(back_populates="user", cascade="all, delete-orphan")
    saved_meals: Mapped[list["SavedMeal"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Memory(Base):
    __tablename__ = "memories"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_user_key"),)

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:    Mapped[str]      = mapped_column(String, ForeignKey("users.id"), index=True)
    key:        Mapped[str]      = mapped_column(String, index=True)
    value:      Mapped[str]      = mapped_column(String)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="memories")


class HabitLog(Base):
    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("user_id", "date", "habit", name="uq_user_date_habit"),)

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:    Mapped[str]      = mapped_column(String, ForeignKey("users.id"), index=True)
    date:       Mapped[date]     = mapped_column(Date, default=date.today, index=True)
    habit:      Mapped[str]      = mapped_column(String, index=True)
    value:      Mapped[float]    = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="habit_logs")


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_date_plan"),)

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:    Mapped[str]      = mapped_column(String, ForeignKey("users.id"), index=True)
    date:       Mapped[date]     = mapped_column(Date, index=True)
    plan_json:  Mapped[str]      = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlanBlockStatus(Base):
    __tablename__ = "plan_block_status"
    __table_args__ = (UniqueConstraint("user_id", "date", "block_index", name="uq_user_date_block"),)

    id:          Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:     Mapped[str]      = mapped_column(String, ForeignKey("users.id"), index=True)
    date:        Mapped[date]     = mapped_column(Date, index=True)
    block_index: Mapped[int]      = mapped_column(Integer)
    done:        Mapped[bool]     = mapped_column(Boolean, default=False)
    priority:    Mapped[bool]     = mapped_column(Boolean, default=False)
    updated_at:  Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SavedMeal(Base):
    """Favourite meals saved by the user."""
    __tablename__ = "saved_meals"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_meal_name"),)

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:    Mapped[str]      = mapped_column(String, ForeignKey("users.id"), index=True)
    name:       Mapped[str]      = mapped_column(String, index=True)
    meal_json:  Mapped[str]      = mapped_column(Text)   # full meal dict as JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="saved_meals")
