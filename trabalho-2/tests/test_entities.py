"""Testes das entidades de domínio (models/entities.py; ADR-005 §1, ADR-011 §6)."""

from __future__ import annotations

import dataclasses
import json
from dataclasses import FrozenInstanceError, replace

import pytest

from models.entities import (
    Account,
    Attempt,
    Decision,
    Event,
    Order,
    Policy,
    Redemption,
    SimulationState,
)
from models.enums import (
    ContestationStatus,
    EventType,
    Mode,
    Outcome,
    TacticId,
    VerificationLevel,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _account(account_id: str = "acc_001", **overrides: object) -> Account:
    """Conta nova e elegível, com um sinal de cadastro descartável."""

    fields: dict[str, object] = {
        "account_id": account_id,
        "signals": frozenset({"disposable_email"}),
    }
    fields.update(overrides)
    return Account(**fields)  # type: ignore[arg-type]


def _policy(**overrides: object) -> Policy:
    """Política de linha de base B1, sem os controles da AM3."""

    fields: dict[str, object] = {
        "version": "pol_v1",
        "verification": VerificationLevel.B1,
    }
    fields.update(overrides)
    return Policy(**fields)  # type: ignore[arg-type]


def _attempt(attempt_id: str = "att_001", **overrides: object) -> Attempt:
    fields: dict[str, object] = {
        "attempt_id": attempt_id,
        "account_id": "acc_001",
        "round_number": 1,
        "tactic_id": TacticId.EMAIL_DISPOSABLE,
        "signals": frozenset({"disposable_email"}),
        "occurred_at": 0.5,
    }
    fields.update(overrides)
    return Attempt(**fields)  # type: ignore[arg-type]


def _decision(**overrides: object) -> Decision:
    fields: dict[str, object] = {
        "attempt_id": "att_001",
        "outcome": Outcome.ACCEPTED,
        "public_message": "Cupom aplicado.",
        "internal_reason": "elegivel: primeira compra",
        "policy_version": "pol_v1",
    }
    fields.update(overrides)
    return Decision(**fields)  # type: ignore[arg-type]


def _event(**overrides: object) -> Event:
    fields: dict[str, object] = {
        "sequence": 1,
        "round_number": 1,
        "occurred_at": 0.5,
        "event_type": EventType.COUPON_DECIDED,
        "account_id": "acc_001",
        "payload": {"outcome": "accepted"},
    }
    fields.update(overrides)
    return Event(**fields)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Vocabulários fechados (enums)
# ---------------------------------------------------------------------------


def test_public_outcome_vocabulary_is_closed() -> None:
    """O resultado público tem vocabulário fechado por contrato (ADR-011 §4)."""

    assert {outcome.value for outcome in Outcome} == {
        "accepted",
        "coupon_already_used",
        "verification_required",
        "rate_limited",
    }


def test_mode_vocabulary_matches_execution_modes() -> None:
    """O modo de execução é determinístico ou validação adversarial (ADR-003)."""

    assert {mode.value for mode in Mode} == {"deterministic", "adversarial_validation"}


def test_verification_levels_are_b1_and_b2() -> None:
    """O motor compara B1 fixa e B2 rígida (AGENTS.md §6)."""

    assert {level.value for level in VerificationLevel} == {"b1", "b2"}


def test_tactic_ids_match_the_closed_catalog() -> None:
    """Os ids de tática espelham ``tactics.catalog`` de scenarios.json (ADR-012 §3)."""

    assert {tactic.value for tactic in TacticId} == {
        "email_disposable",
        "virtual_sms_cpf",
        "emulator_address",
    }


def test_contestation_status_covers_the_am3_channel() -> None:
    """A contestação abre, é mantida ou revertida (canal da AM3)."""

    assert {status.value for status in ContestationStatus} == {"open", "upheld", "reverted"}


def test_event_types_cover_the_canonical_log() -> None:
    """Eventos canônicos do Trabalho 1 §6.3 e da ADR-006 §5, em inglês."""

    assert {event.value for event in EventType} == {
        "signup_started",
        "signup_completed",
        "signup_abandoned",
        "relation_detected",
        "verification_requested",
        "verification_completed",
        "order_started",
        "order_completed",
        "order_abandoned",
        "coupon_decided",
        "probing_suspected",
        "limit_triggered",
        "cooldown_imposed",
        "redemption_completed",
        "budget_alert",
        "contestation_opened",
        "contestation_resolved",
        "policy_changed",
        "bot_strategy_changed",
        "bot_cost_recorded",
    }


def test_enums_serialize_as_plain_strings() -> None:
    """``StrEnum`` serializa direto no JSONL, sem conversão manual (ADR-005 §5)."""

    assert json.dumps({"outcome": Outcome.ACCEPTED, "level": VerificationLevel.B2}) == (
        '{"outcome": "accepted", "level": "b2"}'
    )


# ---------------------------------------------------------------------------
# Account: transições e elegibilidade permanente (ADR-011 §6)
# ---------------------------------------------------------------------------


def test_new_account_starts_eligible() -> None:
    """Conta nova ainda não usou o cupom e é elegível."""

    account = _account()
    assert account.is_eligible is True
    assert account.first_purchase_completed is False


def test_completing_first_purchase_closes_eligibility_permanently() -> None:
    """Concluir a primeira compra fecha a elegibilidade (ADR-011 §6)."""

    account = _account().complete_first_purchase()
    assert account.first_purchase_completed is True
    assert account.is_eligible is False


def test_eligibility_cannot_be_recalculated_after_first_purchase() -> None:
    """Nenhuma instância válida reabre a elegibilidade de conta atendida."""

    account = _account().complete_first_purchase()
    with pytest.raises(ValueError, match="elegível"):
        replace(account, is_eligible=True)
    with pytest.raises(ValueError, match="elegível"):
        Account(account_id="acc_001", is_eligible=True, first_purchase_completed=True)


def test_second_completion_is_rejected() -> None:
    """Débito único: concluir a primeira compra duas vezes é bug, não transição."""

    account = _account().complete_first_purchase()
    with pytest.raises(ValueError, match="já concluída"):
        account.complete_first_purchase()


def test_account_is_frozen() -> None:
    """A conta é imutável; a transição cria nova instância."""

    account = _account()
    with pytest.raises(FrozenInstanceError):
        account.is_eligible = False  # type: ignore[misc]


def test_account_normalizes_signals_to_frozenset() -> None:
    """Sinais apresentados no cadastro ficam armazenados como frozenset."""

    account = Account(account_id="acc_001", signals=["disposable_email"])  # type: ignore[arg-type]
    assert account.signals == frozenset({"disposable_email"})


# ---------------------------------------------------------------------------
# Attempt, Order e Redemption: validações estruturais
# ---------------------------------------------------------------------------


def test_attempt_requires_typed_tactic() -> None:
    """A tentativa referencia o catálogo fechado via enum, não via texto cru."""

    with pytest.raises(ValueError, match="tactic_id"):
        _attempt(tactic_id="email_disposable")


def test_attempt_rejects_round_zero() -> None:
    """O laço de rodadas é 1..N (ADR-011 §2.1)."""

    with pytest.raises(ValueError, match="round_number"):
        _attempt(round_number=0)


def test_order_rejects_non_positive_value() -> None:
    """Pedido precisa de valor positivo para alimentar a regra do cupom."""

    with pytest.raises(ValueError, match="value"):
        Order(order_id="ord_001", account_id="acc_001", value=0.0)


def test_order_rejects_blank_ids() -> None:
    with pytest.raises(ValueError, match="order_id"):
        Order(order_id=" ", account_id="acc_001", value=41.9)


def test_redemption_rejects_non_positive_discount() -> None:
    """Resgate sem desconto não existe; o débito é único e positivo."""

    with pytest.raises(ValueError, match="discount"):
        Redemption(
            redemption_id="red_001",
            account_id="acc_001",
            order_id="ord_001",
            discount=0.0,
            round_number=1,
        )


def test_redemption_rejects_round_zero() -> None:
    with pytest.raises(ValueError, match="round_number"):
        Redemption(
            redemption_id="red_001",
            account_id="acc_001",
            order_id="ord_001",
            discount=20.0,
            round_number=0,
        )


# ---------------------------------------------------------------------------
# Decision: DTO imutável com separação pública/interna (ADR-006 §5)
# ---------------------------------------------------------------------------


def test_decision_is_frozen() -> None:
    """A decisão não é editada após o fato; revisões criam nova decisão/evento."""

    decision = _decision()
    with pytest.raises(FrozenInstanceError):
        decision.outcome = Outcome.RATE_LIMITED  # type: ignore[misc]


def test_decision_keeps_public_and_internal_reasons_separate() -> None:
    """O motivo interno nunca é a mensagem pública (ADR-006 §5)."""

    decision = _decision(
        outcome=Outcome.COUPON_ALREADY_USED,
        public_message="Não foi possível aplicar o cupom.",
        internal_reason="shared_cpf",
    )
    assert decision.public_message != decision.internal_reason
    assert decision.internal_reason == "shared_cpf"
    assert decision.outcome is Outcome.COUPON_ALREADY_USED


def test_decision_requires_typed_outcome() -> None:
    with pytest.raises(ValueError, match="outcome"):
        _decision(outcome="accepted")


# ---------------------------------------------------------------------------
# Policy: controles da AM3 versionados
# ---------------------------------------------------------------------------


def test_policy_attempt_limit_requires_window() -> None:
    """Limite de tentativas e janela são definidos juntos (controle da AM3)."""

    with pytest.raises(ValueError, match="juntos"):
        _policy(attempt_limit=3)
    with pytest.raises(ValueError, match="juntos"):
        _policy(attempt_window_hours=24)


def test_policy_rejects_non_positive_limit_or_window() -> None:
    with pytest.raises(ValueError, match="attempt_limit"):
        _policy(attempt_limit=0, attempt_window_hours=24)
    with pytest.raises(ValueError, match="attempt_window_hours"):
        _policy(attempt_limit=3, attempt_window_hours=0)


def test_policy_requires_typed_verification() -> None:
    with pytest.raises(ValueError, match="verification"):
        _policy(verification="b1")


def test_policy_is_frozen() -> None:
    """B1→B2 cria nova versão de política; a vigente não é mutada."""

    with pytest.raises(FrozenInstanceError):
        _policy().verification = VerificationLevel.B2  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Event: log append-only com payload somente leitura (ADR-005 §5)
# ---------------------------------------------------------------------------


def test_event_payload_is_read_only() -> None:
    """Payload opaco e imutável: as projeções decidem o que expor (ADR-006)."""

    event = _event()
    with pytest.raises(TypeError):
        event.payload["outcome"] = "rate_limited"  # type: ignore[index]


def test_event_rejects_non_positive_sequence() -> None:
    with pytest.raises(ValueError, match="sequence"):
        _event(sequence=0)


def test_event_allows_system_scope_without_account() -> None:
    """Eventos de sistema (ex.: política) não têm conta associada."""

    event = _event(event_type=EventType.POLICY_CHANGED, account_id=None)
    assert event.account_id is None


# ---------------------------------------------------------------------------
# SimulationState: estado do controller, sem singleton (ADR-005 §2)
# ---------------------------------------------------------------------------


def test_state_instances_are_independent() -> None:
    """Cada execução possui seu estado; não há singleton nem estado global."""

    first = SimulationState(run_id="run_a", policy=_policy())
    second = SimulationState(run_id="run_b", policy=_policy())
    assert first is not second

    account = _account()
    first.accounts[account.account_id] = account
    first.record_event(_event())
    first.budget_consumed = 20.0

    assert second.accounts == {}
    assert second.events == []
    assert second.budget_consumed == 0.0


def test_state_persists_across_rounds() -> None:
    """ADR-011 §6: contas, sinais, janelas, política, orçamento e eventos persistem."""

    state = SimulationState(run_id="run_test", policy=_policy())

    # Rodada 1: cadastro, sinais, janela de limite, resgate e primeira compra.
    account = _account()
    state.accounts[account.account_id] = account
    state.used_signals[account.account_id] = frozenset({"disposable_email"})
    state.limit_windows["dev_001"] = (0.5,)
    state.budget_consumed = 20.0
    state.accounts[account.account_id] = state.accounts[
        account.account_id
    ].complete_first_purchase()
    state.record_event(_event(sequence=1, round_number=1))

    # Rodada 2: mesmo estado — política muda, elegibilidade não reabre.
    state.policy = replace(
        _policy(), version="pol_v2", verification=VerificationLevel.B2
    )
    state.used_signals[account.account_id] |= frozenset({"virtual_sms_cpf"})
    state.limit_windows["dev_001"] += (170.0,)
    state.budget_consumed += 20.0
    state.record_event(
        _event(sequence=2, round_number=2, event_type=EventType.POLICY_CHANGED, account_id=None)
    )

    stored = state.accounts[account.account_id]
    assert stored.first_purchase_completed is True
    assert stored.is_eligible is False
    assert state.used_signals[account.account_id] == frozenset(
        {"disposable_email", "virtual_sms_cpf"}
    )
    assert state.limit_windows["dev_001"] == (0.5, 170.0)
    assert state.budget_consumed == 40.0
    assert state.policy.verification is VerificationLevel.B2
    assert [event.round_number for event in state.events] == [1, 2]


def test_record_event_requires_increasing_sequence() -> None:
    """A sequência do log é estritamente crescente para o replay (ADR-007)."""

    state = SimulationState(run_id="run_test", policy=_policy())
    state.record_event(_event(sequence=1))
    with pytest.raises(ValueError, match="estritamente"):
        state.record_event(_event(sequence=1))
    state.record_event(
        _event(sequence=2, event_type=EventType.REDEMPTION_COMPLETED)
    )
    assert len(state.events) == 2


def test_state_rejects_negative_budget() -> None:
    """Orçamento consumido é acumulador não negativo."""

    with pytest.raises(ValueError, match="budget_consumed"):
        SimulationState(run_id="run_test", policy=_policy(), budget_consumed=-1.0)


# ---------------------------------------------------------------------------
# Separação de informação (ADR-006)
# ---------------------------------------------------------------------------

MOTOR_READABLE_ENTITIES = (Account, Order, Attempt, Decision, Redemption, Policy, Event)
FORBIDDEN_FIELD_FRAGMENTS = ("label", "person", "fraud", "cost", "spend", "profit")


@pytest.mark.parametrize("entity", MOTOR_READABLE_ENTITIES, ids=lambda entity: entity.__name__)
def test_motor_readable_entity_has_no_label_person_or_bot_cost_field(entity: type) -> None:
    """Rótulo, pessoa↔conta e custo do bot não aparecem em entidade do motor."""

    field_names = [field.name for field in dataclasses.fields(entity)]
    for fragment in FORBIDDEN_FIELD_FRAGMENTS:
        assert not any(fragment in name for name in field_names), (
            f"{entity.__name__} não pode ter campo com '{fragment}': {field_names}"
        )


def test_tactic_appears_only_on_attempt() -> None:
    """A tática é atribuída só na tentativa (ADR-012 §8) e não vaza ao motor."""

    for entity in MOTOR_READABLE_ENTITIES:
        names = {field.name for field in dataclasses.fields(entity)}
        if entity is Attempt:
            assert "tactic_id" in names
        else:
            assert not any("tactic" in name for name in names), entity.__name__
