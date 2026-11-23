"""Testes do checkout: PE1 → decisão → PE2 (models/checkout.py; AGENTS.md §6).

Cobre os critérios de aceite da issue: débito único na conclusão, recusa sem
débito, orçamento esgotado bloqueando com resposta pública genérica,
comissão creditada uma vez e conta inelegível após a primeira compra. O
motor é um dublê determinístico: a lógica de risco dele é outra issue; aqui
vale apenas o contrato ``DecisionEngine``.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from models.checkout import (
    GENERIC_UNAVAILABLE_MESSAGE,
    Checkout,
    DecisionEngine,
)
from models.config import SimulationConfig
from models.entities import (
    Attempt,
    Decision,
    Order,
    Policy,
    SimulationState,
)
from models.enums import (
    ContestationStatus,
    EventType,
    Outcome,
    TacticId,
    VerificationLevel,
)
from models.events import contestation_opened, contestation_reviewed
from models.rules.coupon import COUPON_DISCOUNT_CENTS

CHECKOUT_SOURCE = Path(__file__).resolve().parents[1] / "src" / "models" / "checkout.py"


# ---------------------------------------------------------------------------
# Dublê do motor antifraude (só o contrato; risco é outra issue)
# ---------------------------------------------------------------------------


class ScriptedEngine:
    """Motor de teste: devolve sempre a mesma decisão roteirizada.

    ``decision_attempt_id`` força uma decisão de outra tentativa, para
    exercitar a validação de ligação entre tentativa e decisão.
    """

    def __init__(
        self,
        outcome: Outcome = Outcome.ACCEPTED,
        message: str = "Cupom aplicado.",
        reason: str = "elegivel: primeira compra",
        decision_attempt_id: str | None = None,
    ) -> None:
        self.outcome = outcome
        self.message = message
        self.reason = reason
        self.decision_attempt_id = decision_attempt_id
        self.calls: list[tuple[Attempt, SimulationState]] = []

    def decide(self, attempt: Attempt, state: SimulationState) -> Decision:
        self.calls.append((attempt, state))
        return Decision(
            attempt_id=self.decision_attempt_id or attempt.attempt_id,
            outcome=self.outcome,
            public_message=self.message,
            internal_reason=self.reason,
            policy_version=state.policy.version,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _policy() -> Policy:
    """Política de linha de base B1, sem os controles da AM3."""

    return Policy(version="pol_v1", verification=VerificationLevel.B1)


def _attempt(attempt_id: str = "att_001", account_id: str = "acc_001") -> Attempt:
    """Tentativa de cadastro do bot: tática AM1, sinal de e-mail descartável."""

    return Attempt(
        attempt_id=attempt_id,
        account_id=account_id,
        round_number=1,
        tactic_id=TacticId.EMAIL_DISPOSABLE,
        signals=frozenset({"disposable_email"}),
        occurred_at=0.5,
    )


def _order(order_id: str = "ord_001", account_id: str = "acc_001", value: float = 41.90) -> Order:
    """Pedido acima do mínimo do cupom (R$ 41,90), pela mesma conta."""

    return Order(order_id=order_id, account_id=account_id, value=value)


def _checkout(
    config: SimulationConfig,
    engine: DecisionEngine | None = None,
) -> Checkout:
    """Checkout com estado próprio e motor dublê."""

    state = SimulationState(run_id="run_test", policy=_policy())
    return Checkout(state=state, config=config, engine=engine or ScriptedEngine())


def _redeem(checkout: Checkout, index: int) -> Outcome:
    """Caminho completo de uma conta: PE1 → decisão → PE2."""

    attempt = _attempt(f"att_{index:03d}", f"acc_{index:03d}")
    order = _order(f"ord_{index:03d}", f"acc_{index:03d}")
    checkout.register_attempt(attempt)
    decision = checkout.decide(attempt)
    return checkout.complete_order(order, attempt, decision, occurred_at=1.0)


def _redemption_events(checkout: Checkout) -> list[EventType]:
    return [
        event.event_type
        for event in checkout.state.events
        if event.event_type is EventType.REDEMPTION_COMPLETED
    ]


# ---------------------------------------------------------------------------
# Caminho completo: PE1 → decisão → PE2
# ---------------------------------------------------------------------------


def test_full_path_emits_account_decision_and_redemption_events(config: SimulationConfig) -> None:
    """O caminho de toda tentativa registra os três eventos canônicos em ordem."""

    checkout = _checkout(config)
    outcome = _redeem(checkout, 1)

    assert outcome is Outcome.ACCEPTED
    assert checkout.event_types() == [
        EventType.SIGNUP_COMPLETED,
        EventType.COUPON_DECIDED,
        EventType.REDEMPTION_COMPLETED,
    ]
    assert checkout.state.accounts["acc_001"].first_purchase_completed is True
    assert checkout.state.accounts["acc_001"].is_eligible is False
    assert checkout.state.used_signals["acc_001"] == frozenset({"disposable_email"})


def test_decide_delegates_to_the_engine_by_interface(config: SimulationConfig) -> None:
    """A decisão vem do motor por interface; checkout não implementa risco."""

    engine = ScriptedEngine()
    checkout = _checkout(config, engine)
    attempt = _attempt()
    checkout.register_attempt(attempt)
    decision = checkout.decide(attempt)

    assert engine.calls == [(attempt, checkout.state)]
    assert decision.attempt_id == "att_001"
    assert decision.policy_version == "pol_v1"


def test_registration_is_required_before_decision_and_completion(
    config: SimulationConfig,
) -> None:
    """PE1 vem antes: decidir ou concluir sem cadastro é erro, não recusa."""

    checkout = _checkout(config)
    attempt = _attempt()
    decision = ScriptedEngine().decide(attempt, checkout.state)

    with pytest.raises(ValueError, match="cadastro"):
        checkout.decide(attempt)
    with pytest.raises(ValueError, match="cadastro"):
        checkout.complete_order(_order(), attempt, decision, occurred_at=1.0)


def test_duplicate_registration_is_rejected(config: SimulationConfig) -> None:
    """Cada conta passa pelo cadastro uma única vez."""

    checkout = _checkout(config)
    checkout.register_attempt(_attempt())
    with pytest.raises(ValueError, match="já registrada"):
        checkout.register_attempt(_attempt())


def test_decision_must_match_the_attempt(config: SimulationConfig) -> None:
    """Decisão de outra tentativa não é aceita nem concluída (ligação auditável)."""

    mismatched_engine = ScriptedEngine(decision_attempt_id="att_999")

    deciding = _checkout(config, mismatched_engine)
    deciding.register_attempt(_attempt())
    with pytest.raises(ValueError, match="diverge"):
        deciding.decide(_attempt())

    completing = _checkout(config, mismatched_engine)
    completing.register_attempt(_attempt())
    mismatched = mismatched_engine.decide(_attempt(), completing.state)
    with pytest.raises(ValueError, match="diverge"):
        completing.complete_order(_order(), _attempt(), mismatched, occurred_at=1.0)


# ---------------------------------------------------------------------------
# Débito único e inelegibilidade permanente (critérios de aceite)
# ---------------------------------------------------------------------------


def test_budget_final_is_exactly_acquisition_minus_20_per_redemption(
    config: SimulationConfig,
) -> None:
    """Critério de aceite: orçamento final = aquisição − 20 × resgates."""

    checkout = _checkout(config)
    for index in range(1, 4):
        assert _redeem(checkout, index) is Outcome.ACCEPTED

    assert checkout.state.budget_consumed == pytest.approx(60.0)
    assert checkout.state.budget_consumed == COUPON_DISCOUNT_CENTS / 100 * 3
    remaining = config.budget.acquisition - 20.0 * 3
    assert config.budget.acquisition - checkout.state.budget_consumed == remaining


def test_debit_happens_once_and_account_never_eligible_again(config: SimulationConfig) -> None:
    """Débito único: segunda conclusão da mesma conta não cobra o desconto."""

    checkout = _checkout(config)
    checkout.register_attempt(_attempt())
    first_decision = checkout.decide(_attempt())
    first = checkout.complete_order(_order(), _attempt(), first_decision, occurred_at=1.0)
    assert first is Outcome.ACCEPTED
    assert checkout.state.budget_consumed == pytest.approx(20.0)

    # Segunda tentativa da mesma conta: cadastro não se repete, mas o pedido
    # novo chega ao PE2 — e a conta já não é elegível.
    second_attempt = _attempt(attempt_id="att_002")
    second_decision = checkout.decide(second_attempt)
    second = checkout.complete_order(
        _order(order_id="ord_002"), second_attempt, second_decision, occurred_at=2.0
    )

    assert second is Outcome.COUPON_ALREADY_USED
    assert checkout.state.budget_consumed == pytest.approx(20.0)
    assert len(_redemption_events(checkout)) == 1


def test_refused_order_does_not_debit_or_generate_redemption(config: SimulationConfig) -> None:
    """Critério de aceite: pedido recusado não altera o orçamento."""

    engine = ScriptedEngine(
        outcome=Outcome.COUPON_ALREADY_USED,
        message="Este CPF já foi usado.",
        reason="shared_cpf",
    )
    checkout = _checkout(config, engine)
    outcome = _redeem(checkout, 1)

    assert outcome is Outcome.COUPON_ALREADY_USED
    assert checkout.state.budget_consumed == pytest.approx(0.0)
    assert _redemption_events(checkout) == []
    assert [event.event_type for event in checkout.state.events] == [
        EventType.SIGNUP_COMPLETED,
        EventType.COUPON_DECIDED,
    ]


def test_verification_required_does_not_debit_and_is_recorded(
    config: SimulationConfig,
) -> None:
    """Verificação pedida é recusa com semântica própria: sem débito."""

    engine = ScriptedEngine(
        outcome=Outcome.VERIFICATION_REQUIRED,
        message="Verifique seu telefone.",
        reason="unverified_phone",
    )
    checkout = _checkout(config, engine)
    outcome = _redeem(checkout, 1)

    assert outcome is Outcome.VERIFICATION_REQUIRED
    assert checkout.state.budget_consumed == pytest.approx(0.0)
    assert _redemption_events(checkout) == []
    assert EventType.VERIFICATION_REQUESTED in checkout.event_types()


def test_engine_rate_limit_records_the_public_block(config: SimulationConfig) -> None:
    """Motor bloqueando por limite anexa o evento ``limit_triggered``."""

    engine = ScriptedEngine(
        outcome=Outcome.RATE_LIMITED,
        message="Muitas tentativas. Aguarde.",
        reason="attempt_limit_reached",
    )
    checkout = _checkout(config, engine)
    outcome = _redeem(checkout, 1)

    assert outcome is Outcome.RATE_LIMITED
    assert checkout.state.budget_consumed == pytest.approx(0.0)
    assert EventType.LIMIT_TRIGGERED in checkout.event_types()
    assert _redemption_events(checkout) == []


# ---------------------------------------------------------------------------
# Orçamento esgotado (critério de aceite)
# ---------------------------------------------------------------------------


def test_exhausted_budget_blocks_completion_with_generic_public_response(
    write_config,
) -> None:
    """Orçamento esgotado bloqueia novas conclusões sem revelar a regra."""

    config, _ = write_config(overrides={"budget": {"acquisition": 50.0}})
    checkout = _checkout(config)

    assert _redeem(checkout, 1) is Outcome.ACCEPTED
    assert _redeem(checkout, 2) is Outcome.ACCEPTED
    blocked = _redeem(checkout, 3)

    assert blocked is Outcome.RATE_LIMITED
    # Critério de aceite: orçamento final exato = aquisição − 20 × resgates.
    assert checkout.state.budget_consumed == pytest.approx(40.0)
    assert config.budget.acquisition - checkout.state.budget_consumed == pytest.approx(10.0)
    assert len(_redemption_events(checkout)) == 2
    # Evento operacional para o motor; o bot nunca o vê (ADR-006 §1).
    assert EventType.BUDGET_ALERT in checkout.event_types()
    alert = next(
        event for event in checkout.state.events
        if event.event_type is EventType.BUDGET_ALERT
    )
    assert alert.payload["remaining_cents"] == 1000
    assert alert.payload["requested_discount_cents"] == COUPON_DISCOUNT_CENTS

    # Resposta pública genérica: nada de orçamento, regra interna ou valores.
    decided = [
        event for event in checkout.state.events
        if event.event_type is EventType.COUPON_DECIDED
    ]
    message = decided[-1].payload["public_message"]
    assert message == GENERIC_UNAVAILABLE_MESSAGE
    assert "orçamento" not in message.lower()
    assert "budget" not in message.lower()


def test_partial_budget_still_funds_when_it_covers_the_discount(write_config) -> None:
    """Orçamento que cobre exatamente mais um desconto conclui o resgate."""

    config, _ = write_config(overrides={"budget": {"acquisition": 40.0}})
    checkout = _checkout(config)

    assert _redeem(checkout, 1) is Outcome.ACCEPTED
    assert _redeem(checkout, 2) is Outcome.ACCEPTED
    blocked = _redeem(checkout, 3)

    assert blocked is Outcome.RATE_LIMITED
    assert checkout.state.budget_consumed == pytest.approx(40.0)


# ---------------------------------------------------------------------------
# Comissão (critério de aceite)
# ---------------------------------------------------------------------------


def test_commission_is_credited_once_in_the_redemption_event(
    config: SimulationConfig,
) -> None:
    """Comissão de 20% sobre o pedido entra uma única vez, no mesmo evento."""

    checkout = _checkout(config)
    assert _redeem(checkout, 1) is Outcome.ACCEPTED

    redemptions = [
        event for event in checkout.state.events
        if event.event_type is EventType.REDEMPTION_COMPLETED
    ]
    assert len(redemptions) == 1
    payload = redemptions[0].payload
    assert payload["order_value"] == pytest.approx(41.90)
    assert payload["discount"] == pytest.approx(20.0)
    assert payload["commission"] == pytest.approx(config.coupon.commission_rate * 41.90)
    assert payload["commission"] == pytest.approx(8.38)
    assert checkout.state.budget_consumed == pytest.approx(20.0)


# ---------------------------------------------------------------------------
# Regra do cupom aplicada no PE2 (borda do domínio)
# ---------------------------------------------------------------------------


def test_order_at_the_minimum_is_refused_and_below_border_debits(
    config: SimulationConfig,
) -> None:
    """R$ 30,00 inelegível no PE2; R$ 30,01 resgata (AGENTS.md §6)."""

    below = _checkout(config)
    below.register_attempt(_attempt())
    decision = below.decide(_attempt())
    outcome = below.complete_order(
        _order(value=30.00), _attempt(), decision, occurred_at=1.0
    )
    assert outcome is Outcome.COUPON_ALREADY_USED
    assert below.state.budget_consumed == pytest.approx(0.0)
    assert _redemption_events(below) == []

    above = _checkout(config)
    above.register_attempt(_attempt())
    decision = above.decide(_attempt())
    outcome = above.complete_order(
        _order(value=30.01), _attempt(), decision, occurred_at=1.0
    )
    assert outcome is Outcome.ACCEPTED
    assert above.state.budget_consumed == pytest.approx(20.0)


# ---------------------------------------------------------------------------
# Identidade dos eventos (critério de aceite)
# ---------------------------------------------------------------------------


def test_every_generated_event_has_run_id_round_and_account(write_config) -> None:
    """Critério de aceite: todo evento carrega run_id, round e account_id."""

    config, _ = write_config(overrides={"budget": {"acquisition": 50.0}})
    checkout = _checkout(config)
    _redeem(checkout, 1)
    _redeem(checkout, 2)
    _redeem(checkout, 3)  # bloqueado por orçamento: budget_alert + coupon_decided

    accounts = {f"acc_{index:03d}" for index in (1, 2, 3)}
    assert checkout.state.events
    for event in checkout.state.events:
        assert event.run_id == "run_test", event.event_type
        assert event.round_number == 1, event.event_type
        assert event.account_id in accounts, event.event_type

    # Cada evento pertence à conta da tentativa que o gerou, na ordem.
    grouped = [event.account_id for event in checkout.state.events]
    assert grouped == [
        "acc_001", "acc_001", "acc_001",
        "acc_002", "acc_002", "acc_002",
        "acc_003", "acc_003", "acc_003", "acc_003",
    ]


def test_contestation_events_carry_full_identity(config: SimulationConfig) -> None:
    """Canal da AM3: contestação abre e é revisada com identidade completa."""

    checkout = _checkout(config)
    attempt = _attempt()
    checkout.register_attempt(attempt)

    opened = contestation_opened(checkout.state, attempt, "recusa indevida")
    reviewed = contestation_reviewed(checkout.state, attempt, ContestationStatus.REVERTED)

    assert opened.event_type is EventType.CONTESTATION_OPENED
    assert reviewed.event_type is EventType.CONTESTATION_RESOLVED
    for event in (opened, reviewed):
        assert event.run_id == "run_test"
        assert event.round_number == 1
        assert event.account_id == "acc_001"


def test_coupon_decided_event_keeps_only_public_fields(config: SimulationConfig) -> None:
    """O motivo interno da decisão nunca entra no log (ADR-006 §5)."""

    engine = ScriptedEngine(reason="internal_rule_shared_device")
    checkout = _checkout(config, engine)
    checkout.register_attempt(_attempt())
    checkout.decide(_attempt())

    decided = next(
        event for event in checkout.state.events
        if event.event_type is EventType.COUPON_DECIDED
    )
    assert decided.payload["outcome"] == "accepted"
    assert "internal_rule_shared_device" not in str(decided.payload)


# ---------------------------------------------------------------------------
# Fronteira de imports (ADR-006; AGENTS.md §6)
# ---------------------------------------------------------------------------

FORBIDDEN_IMPORT_ROOTS = {"agents", "evaluation", "views", "controllers", "streamlit"}


def test_checkout_module_has_no_agent_or_evaluation_imports() -> None:
    """O checkout nunca importa ``agents/`` nem ``evaluation/`` (AGENTS.md §6)."""

    tree = ast.parse(CHECKOUT_SOURCE.read_text(encoding="utf-8"))
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            roots.add(node.module.split(".")[0])
    assert roots, "esperado ao menos um import no módulo"
    assert not roots & FORBIDDEN_IMPORT_ROOTS


# ---------------------------------------------------------------------------
# Valores de configuração inconsistentes com a regra do cupom
# ---------------------------------------------------------------------------


def test_checkout_rejects_config_diverging_from_the_coupon_rule(write_config) -> None:
    """Desconto ou mínimo divergentes da regra (R$ 20 / R$ 30) falham cedo."""

    with pytest.raises(ValueError, match="discount"):
        _checkout(write_config(overrides={"coupon": {"discount": 25.0}})[0])
    with pytest.raises(ValueError, match="min_order"):
        _checkout(write_config(overrides={"coupon": {"min_order": 25.0}})[0])
