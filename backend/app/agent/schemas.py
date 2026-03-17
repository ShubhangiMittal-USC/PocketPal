from pydantic import BaseModel, Field
from typing import Any, Optional


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    user_id: str  = "demo"
    message: str
    trace:   bool = False
    llm:     str  = "ollama"   # "rules" | "ollama"


class ToolCall(BaseModel):
    tool: str
    args: dict[str, Any]


class ChatResponse(BaseModel):
    reply:          str
    intent:         str
    tool_calls:     list[ToolCall]        = Field(default_factory=list)
    memory_updates: list[dict[str, str]]  = Field(default_factory=list)
    debug:          Optional[dict[str, Any]] = None


# ── Plan ─────────────────────────────────────────────────────────────────────

class BlockStatusRequest(BaseModel):
    user_id:     str
    date_str:    str
    block_index: int
    done:        Optional[bool] = None
    priority:    Optional[bool] = None


# ── Meals ─────────────────────────────────────────────────────────────────────

class MealSuggestRequest(BaseModel):
    user_id:     str        = "demo"
    ingredients: list[str]
    preferences: dict[str, str] = Field(default_factory=dict)


class MealSaveRequest(BaseModel):
    user_id:     str
    name:        str
    ingredients: list[str]
    recipe:      str
    tags:        list[str] = Field(default_factory=list)


class MealDeleteRequest(BaseModel):
    user_id: str
    name:    str


# ── Insights ─────────────────────────────────────────────────────────────────

class InsightsRequest(BaseModel):
    user_id: str  = "demo"
    days:    int  = 7
