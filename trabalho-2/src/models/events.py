from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class TacticChosenEvent:
    tactic: str
    volume: int
    observation_used: str
    round_number: int = 1
    rationale: str = ""
    timestamp: str = field(default_factory=_now_iso)
    event_type: str = "tactic_chosen"

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "round_number": self.round_number,
            "tactic": self.tactic,
            "volume": self.volume,
            "observation_used": self.observation_used,
            "rationale": self.rationale,
            "timestamp": self.timestamp,
        }


@dataclass(frozen=True)
class GuardrailBlockedEvent:
    reason: str
    tactic: str | None = None
    requested_spend: float | None = None
    budget_limit: float | None = None
    round_number: int = 1
    timestamp: str = field(default_factory=_now_iso)
    event_type: str = "guardrail_blocked"

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "round_number": self.round_number,
            "reason": self.reason,
            "tactic": self.tactic,
            "requested_spend": self.requested_spend,
            "budget_limit": self.budget_limit,
            "timestamp": self.timestamp,
        }