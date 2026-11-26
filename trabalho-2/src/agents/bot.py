from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, is_dataclass
from typing import Any

from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.guardrails import PIIDetectionGuardrail

from agents.agno_adapter import RuleBasedFallbackModel, get_model
from agents.guardrails import enforce_bot_decision
from agents.tactics import (
    BotDecisionPayload,
    LastRoundSummary,
    TacticSpec,
    choose_fallback_decision,
)
from models.events import GuardrailBlockedEvent, TacticChosenEvent


def _sanitize_public_view(public_view: Any) -> dict[str, Any]:
    raw = asdict(public_view) if is_dataclass(public_view) else dict(public_view)
    forbidden_keys = {"cpf", "phone", "email", "payer_id", "label", "is_fraud", "ground_truth"}
    return {k: v for k, v in raw.items() if k.lower() not in forbidden_keys}


def build_bot_agent(
    *,
    public_view_provider: Callable[[], Any],
    catalog: Sequence[TacticSpec],
    attack_budget_remaining: float,
    max_cost_per_approval: float,
    round_number: int = 1,
    db_file: str = "saidas/bot_memory.db",
    session_id: str = "session-default",
    tool_call_limit: int = 6,
    on_tactic_chosen: Callable[[TacticChosenEvent], None] | None = None,
    on_guardrail_blocked: Callable[[GuardrailBlockedEvent], None] | None = None,
    model: Any | None = None,
) -> tuple[Agent, dict[str, BotDecisionPayload]]:
    resolved_model = model if model is not None else get_model(allow_rule_fallback=True)
    catalog_map = {spec.name: spec for spec in catalog}
    state: dict[str, BotDecisionPayload] = {}

    def get_round_result() -> dict[str, Any]:
        """Retorna apenas a PublicView da rodada anterior, sem dados pessoais ou rótulos."""
        return _sanitize_public_view(public_view_provider())

    def record_decision(
        tactic: str,
        volume: int,
        rationale: str,
        observation_used: str,
    ) -> dict[str, Any]:
        """Registra a decisão estruturada do bot após validar catálogo e orçamento."""
        spec = catalog_map.get(tactic)
        unit_cost = spec.unit_cost if spec is not None else 0.0

        enforce_bot_decision(
            tactic=tactic,
            volume=volume,
            unit_cost=unit_cost,
            allowed_tactics=catalog_map.keys(),
            attack_budget_remaining=attack_budget_remaining,
            round_number=round_number,
            on_block=on_guardrail_blocked,
        )

        payload = BotDecisionPayload(
            tactic=tactic,
            volume=volume,
            rationale=rationale,
            observation_used=observation_used,
        )
        state["last_decision"] = payload

        if on_tactic_chosen:
            on_tactic_chosen(
                TacticChosenEvent(
                    tactic=tactic,
                    volume=volume,
                    observation_used=observation_used,
                    round_number=round_number,
                    rationale=rationale,
                )
            )

        return {
            "status": "recorded",
            "tactic": tactic,
            "volume": volume,
            "observation_used": observation_used,
        }

    catalog_desc = ", ".join(
        f"{spec.name} (custo={spec.unit_cost:.2f})" for spec in catalog
    )
    instructions = [
        "Você é o agente bot caçador de cupons na simulação do cupom BEMVINDO (desconto de R$ 20).",
        "Seu objetivo econômico é maximizar lucro = R$ 20 * resgates - gasto.",
        f"Catálogo disponível: {catalog_desc}.",
        f"Orçamento restante de ataque nesta rodada: R$ {attack_budget_remaining:.2f}.",
        f"Limiar máximo de custo por aprovação (apenas última rodada): R$ {max_cost_per_approval:.2f}.",
        "Na rodada 2 em diante, chame get_round_result() antes de record_decision() e cite na observation_used algo da rodada anterior.",
        "Se a tática atual não compensar, troque de tática antes de recuar; só use volume=0 se nenhuma alternativa compensar.",
        "Não use nem tente adivinhar regras internas do motor antifraude.",
    ]

    cpf_guardrail = PIIDetectionGuardrail(custom_patterns={"cpf": r"\d{3}\.\d{3}\.\d{3}-\d{2}"})
    db = SqliteDb(db_file=db_file)
    agent_model = None if isinstance(resolved_model, RuleBasedFallbackModel) else resolved_model

    agent = Agent(
        model=agent_model,
        instructions=instructions,
        tools=[get_round_result, record_decision],
        db=db,
        add_history_to_context=True,
        user_id="bot",
        session_id=session_id,
        tool_call_limit=tool_call_limit,
        pre_hooks=[cpf_guardrail],
    )
    agent.model = resolved_model
    return agent, state


def decide_bot_round(
    *,
    agent: Agent,
    state: dict[str, BotDecisionPayload],
    round_number: int,
    catalog: Sequence[TacticSpec],
    used_tactics: Iterable[str],
    last_round: LastRoundSummary | None,
    max_cost_per_approval: float,
    attack_budget_remaining: float,
    prompt_message: str | None = None,
) -> BotDecisionPayload:
    if isinstance(agent.model, RuleBasedFallbackModel):
        decision = choose_fallback_decision(
            round_number=round_number,
            catalog=catalog,
            used_tactics=used_tactics,
            last_round=last_round,
            max_cost_per_approval=max_cost_per_approval,
            attack_budget_remaining=attack_budget_remaining,
        )
        state["last_decision"] = decision
        return decision

    msg = prompt_message or (
        f"Rodada {round_number}: chame get_round_result() e depois record_decision() "
        "com tactic, volume, rationale e observation_used."
    )
    agent.run(msg, user_id="bot")
    if "last_decision" not in state:
        raise RuntimeError("O agente não chamou record_decision() na rodada.")
    return state["last_decision"]