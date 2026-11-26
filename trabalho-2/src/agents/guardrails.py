from __future__ import annotations

from collections.abc import Callable, Iterable

from models.events import GuardrailBlockedEvent

try:
    from agno.exceptions import OutputCheckError
except ImportError:
    class OutputCheckError(Exception):
        pass


class BotPolicyViolationError(OutputCheckError):
    def __init__(self, message: str, event: GuardrailBlockedEvent) -> None:
        super().__init__(message)
        self.event = event


def validate_bot_decision(
    *,
    tactic: str,
    volume: int,
    unit_cost: float,
    allowed_tactics: Iterable[str],
    attack_budget_remaining: float,
    round_number: int = 1,
    on_block: Callable[[GuardrailBlockedEvent], None] | None = None,
) -> tuple[bool, GuardrailBlockedEvent | None]:
    allowed_set = set(allowed_tactics)
    estimated_spend = max(0, volume) * max(0.0, unit_cost)

    if tactic not in allowed_set:
        event = GuardrailBlockedEvent(
            reason=f"Tática '{tactic}' fora do catálogo permitido.",
            tactic=tactic,
            requested_spend=estimated_spend,
            budget_limit=attack_budget_remaining,
            round_number=round_number,
        )
        if on_block:
            on_block(event)
        return False, event

    if estimated_spend > attack_budget_remaining:
        event = GuardrailBlockedEvent(
            reason=(
                f"Gasto estimado ({estimated_spend:.2f}) excede budget.attack "
                f"({attack_budget_remaining:.2f})."
            ),
            tactic=tactic,
            requested_spend=estimated_spend,
            budget_limit=attack_budget_remaining,
            round_number=round_number,
        )
        if on_block:
            on_block(event)
        return False, event

    return True, None


def enforce_bot_decision(
    *,
    tactic: str,
    volume: int,
    unit_cost: float,
    allowed_tactics: Iterable[str],
    attack_budget_remaining: float,
    round_number: int = 1,
    on_block: Callable[[GuardrailBlockedEvent], None] | None = None,
) -> None:
    ok, event = validate_bot_decision(
        tactic=tactic,
        volume=volume,
        unit_cost=unit_cost,
        allowed_tactics=allowed_tactics,
        attack_budget_remaining=attack_budget_remaining,
        round_number=round_number,
        on_block=on_block,
    )
    if not ok and event is not None:
        raise BotPolicyViolationError(event.reason, event)