from __future__ import annotations

import math
import os
import pytest

from agents.bot import build_bot_agent, decide_bot_round
from agents.guardrails import BotPolicyViolationError, enforce_bot_decision
from agents.tactics import (
    LastRoundSummary,
    TacticSpec,
    choose_fallback_decision,
    compute_last_round_cost_per_approval,
)


CATALOG = [
    TacticSpec(name="sms_cpf", unit_cost=5.0, avoids_signals=()),
    TacticSpec(name="sms_cpf_emulator", unit_cost=6.0, avoids_signals=("device", "dispositivo")),
    TacticSpec(name="full_spoof", unit_cost=12.0, avoids_signals=("device", "dispositivo", "address", "payer")),
]


def test_zero_approvals_gives_inf_and_retreats_when_no_alternative():
    assert math.isinf(compute_last_round_cost_per_approval(spent=25.0, approvals=0))

    decision = choose_fallback_decision(
        round_number=2,
        catalog=[TacticSpec(name="only_tactic", unit_cost=5.0)],
        used_tactics=["only_tactic"],
        last_round=LastRoundSummary(tactic="only_tactic", spent=25.0, approvals=0),
        max_cost_per_approval=15.0,
        attack_budget_remaining=50.0,
    )
    assert decision.volume == 0


def test_switches_from_sms_cpf_to_emulator_when_device_flagged():
    decision = choose_fallback_decision(
        round_number=2,
        catalog=CATALOG,
        used_tactics=["sms_cpf"],
        last_round=LastRoundSummary(
            tactic="sms_cpf",
            spent=50.0,
            approvals=1,
            rejection_signals=("device",),
            observation_hint="Rodada 1: 1 aprovação em 10 com sms_cpf; sinal device recusado.",
        ),
        max_cost_per_approval=15.0,
        attack_budget_remaining=100.0,
    )
    assert decision.tactic == "sms_cpf_emulator"
    assert decision.volume > 0
    assert "Rodada 1" in decision.observation_used


def test_roi_uses_only_last_round_not_cumulative_loss():
    decision = choose_fallback_decision(
        round_number=3,
        catalog=[TacticSpec(name="sms_cpf_emulator", unit_cost=6.0)],
        used_tactics=["sms_cpf", "sms_cpf_emulator"],
        last_round=LastRoundSummary(
            tactic="sms_cpf_emulator",
            spent=12.0,
            approvals=2,
            rejection_signals=(),
            observation_hint="Rodada 2: 2 aprovações com custo 6.0 cada.",
        ),
        max_cost_per_approval=15.0,
        attack_budget_remaining=60.0,
    )
    assert decision.tactic == "sms_cpf_emulator"
    assert decision.volume > 0


def test_guardrail_blocks_unknown_tactic_and_budget_exceeded():
    blocked = []

    with pytest.raises(BotPolicyViolationError) as exc_tactic:
        enforce_bot_decision(
            tactic="invalid_tactic",
            volume=1,
            unit_cost=5.0,
            allowed_tactics=["sms_cpf"],
            attack_budget_remaining=50.0,
            round_number=1,
            on_block=blocked.append,
        )
    assert exc_tactic.value.event.event_type == "guardrail_blocked"

    with pytest.raises(BotPolicyViolationError) as exc_budget:
        enforce_bot_decision(
            tactic="sms_cpf",
            volume=20,
            unit_cost=5.0,
            allowed_tactics=["sms_cpf"],
            attack_budget_remaining=30.0,
            round_number=1,
            on_block=blocked.append,
        )
    assert exc_budget.value.event.event_type == "guardrail_blocked"
    assert len(blocked) == 2


def test_public_view_boundary_strips_sensitive_fields(tmp_path):
    def provider():
        return {
            "round_number": 1,
            "approvals": 2,
            "rejections": 8,
            "cpf": "123.456.789-00",
            "payer_id": "payer-99",
            "label": "fraud",
        }

    agent, state = build_bot_agent(
        public_view_provider=provider,
        catalog=CATALOG,
        attack_budget_remaining=50.0,
        max_cost_per_approval=15.0,
        db_file=str(tmp_path / "bot.db"),
        session_id="test-session",
    )
    get_tool = next(t for t in agent.tools if getattr(t, "__name__", "") == "get_round_result")
    data = get_tool()
    assert "cpf" not in data
    assert "payer_id" not in data
    assert "label" not in data
    assert data["approvals"] == 2
    assert state == {}


@pytest.mark.llm
def test_groq_tool_call_and_decision(tmp_path):
    if not os.getenv("GROQ_API_KEY"):
        pytest.skip("GROQ_API_KEY não configurada")

    agent, state = build_bot_agent(
        public_view_provider=lambda: {"round_number": 1, "approvals": 1, "rejections": 9},
        catalog=CATALOG,
        attack_budget_remaining=50.0,
        max_cost_per_approval=15.0,
        round_number=2,
        db_file=str(tmp_path / "bot_llm.db"),
        session_id="groq-test",
    )
    decision = decide_bot_round(
        agent=agent,
        state=state,
        round_number=2,
        catalog=CATALOG,
        used_tactics=["sms_cpf"],
        last_round=LastRoundSummary(tactic="sms_cpf", spent=50.0, approvals=1),
        max_cost_per_approval=15.0,
        attack_budget_remaining=50.0,
    )
    assert decision.tactic in {c.name for c in CATALOG}
    assert decision.observation_used.strip() != ""