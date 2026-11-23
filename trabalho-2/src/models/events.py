"""Eventos canônicos do caminho PE1 → decisão → PE2 (ADR-005 §5; ADR-011 §2.3).

Fábricas tipadas que anexam eventos ao log append-only do
``SimulationState``. Todo evento sai com o ``run_id`` da execução, o
``round_number`` da rodada e o ``account_id`` da conta preenchidos, com
sequência estritamente crescente (ADR-007); o ``payload`` é opaco e
imutável, e as projeções decidem, por whitelist, o que expor a bot, motor e
revisão (ADR-006 §1–§2). Por isso o motivo interno da ``Decision`` nunca
entra no log — só o resultado público (ADR-006 §5).

Mapeamento dos nomes desta etapa para o vocabulário canônico de
``models.enums.EventType`` (fixado por ``tests/test_entities.py`` e pelo
Trabalho 1 §6.3) — divergência de nomenclatura registrada conforme AGENTS.md
§2; os valores do enum não mudam:

- ``account_created``        → ``signup_completed`` (cadastro concluído em PE1);
- ``verification_requested`` → ``verification_requested``;
- ``coupon_decided``         → ``coupon_decided``;
- ``rate_limited``           → ``limit_triggered`` (o resultado público
  permanece ``rate_limited`` no vocabulário fechado de ``Outcome``, ADR-011 §4);
- ``redemption_completed``   → ``redemption_completed``;
- ``contestation_opened``    → ``contestation_opened``;
- ``contestation_reviewed``  → ``contestation_resolved``.

A aritmética monetária do payload é feita em centavos e exposta em reais
(ordenada a dois), exatamente como a UI consome; nada é debitado ou
creditado aqui — os eventos apenas registram o que o checkout já aplicou.
"""

from __future__ import annotations

from models.entities import Attempt, Decision, Event, Order, Redemption, SimulationState
from models.enums import ContestationStatus, EventType, Outcome

__all__ = [
    "account_created",
    "budget_alert",
    "coupon_decided",
    "contestation_opened",
    "contestation_reviewed",
    "rate_limited",
    "redemption_completed",
    "verification_requested",
]


# ---------------------------------------------------------------------------
# Anexação ao log append-only (única porta de escrita de eventos)
# ---------------------------------------------------------------------------


def _append(
    state: SimulationState,
    *,
    event_type: EventType,
    round_number: int,
    occurred_at: float,
    account_id: str,
    payload: dict[str, object],
) -> Event:
    """Cria o evento com identidade completa e anexa ao estado (ADR-005 §2)."""

    event = Event(
        sequence=len(state.events) + 1,
        round_number=round_number,
        occurred_at=occurred_at,
        event_type=event_type,
        run_id=state.run_id,
        account_id=account_id,
        payload=payload,
    )
    return state.record_event(event)


def _check_state_and_attempt(state: SimulationState, attempt: Attempt) -> None:
    """Falha se o estado ou a tentativa não forem do tipo esperado."""

    if not isinstance(state, SimulationState):
        raise ValueError(f"state: esperado SimulationState, obtido {type(state).__name__}")
    if not isinstance(attempt, Attempt):
        raise ValueError(f"attempt: esperado Attempt, obtido {type(attempt).__name__}")


# ---------------------------------------------------------------------------
# PE1: cadastro
# ---------------------------------------------------------------------------


def account_created(state: SimulationState, attempt: Attempt) -> Event:
    """Cadastro concluído (PE1): conta registrada com os sinais apresentados.

    Os sinais saem ordenados para o log ser determinístico (ADR-007 §6).
    """

    _check_state_and_attempt(state, attempt)
    return _append(
        state,
        event_type=EventType.SIGNUP_COMPLETED,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at,
        account_id=attempt.account_id,
        payload={"attempt_id": attempt.attempt_id, "signals": sorted(attempt.signals)},
    )


# ---------------------------------------------------------------------------
# Decisão do motor sobre a tentativa
# ---------------------------------------------------------------------------


def coupon_decided(
    state: SimulationState,
    attempt: Attempt,
    decision: Decision,
) -> Event:
    """Decisão do motor sobre o cupom da tentativa (resultado público).

    O motivo interno da ``Decision`` fica de fora do log: as projeções
    expõem só ``outcome`` e ``public_message`` (ADR-006 §5).
    """

    _check_state_and_attempt(state, attempt)
    if not isinstance(decision, Decision):
        raise ValueError(f"decision: esperado Decision, obtido {type(decision).__name__}")
    return _append(
        state,
        event_type=EventType.COUPON_DECIDED,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at,
        account_id=attempt.account_id,
        payload={
            "attempt_id": attempt.attempt_id,
            "outcome": decision.outcome.value,
            "public_message": decision.public_message,
            "policy_version": decision.policy_version,
        },
    )


def verification_requested(
    state: SimulationState,
    attempt: Attempt,
    decision: Decision,
) -> Event:
    """Verificação extra pedida pelo motor (recusa com semântica própria)."""

    _check_state_and_attempt(state, attempt)
    if not isinstance(decision, Decision):
        raise ValueError(f"decision: esperado Decision, obtido {type(decision).__name__}")
    if decision.outcome is not Outcome.VERIFICATION_REQUIRED:
        raise ValueError(
            f"decision: verification_requested exige outcome "
            f"'verification_required', obtido {decision.outcome.value!r}"
        )
    return _append(
        state,
        event_type=EventType.VERIFICATION_REQUESTED,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at,
        account_id=attempt.account_id,
        payload={
            "attempt_id": attempt.attempt_id,
            "policy_version": decision.policy_version,
            "verification_level": state.policy.verification.value,
        },
    )


def rate_limited(state: SimulationState, attempt: Attempt) -> Event:
    """Tentativa bloqueada por limite (evento ``limit_triggered``).

    O resultado público permanece ``rate_limited`` no vocabulário fechado
    (ADR-011 §4); os detalhes do limite pertencem à política vigente.
    """

    _check_state_and_attempt(state, attempt)
    return _append(
        state,
        event_type=EventType.LIMIT_TRIGGERED,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at,
        account_id=attempt.account_id,
        payload={"attempt_id": attempt.attempt_id, "policy_version": state.policy.version},
    )


def budget_alert(
    state: SimulationState,
    attempt: Attempt,
    order: Order,
    *,
    remaining_cents: int,
    requested_discount_cents: int,
) -> Event:
    """Orçamento de aquisição insuficiente para concluir o pedido (PE2).

    Evento operacional do motor: expõe o reste e o desconto pedidos — o bot
    nunca o recebe (ADR-006 §1). Valores em centavos, exatos.
    """

    _check_state_and_attempt(state, attempt)
    if not isinstance(order, Order):
        raise ValueError(f"order: esperado Order, obtido {type(order).__name__}")
    if order.account_id != attempt.account_id:
        raise ValueError(
            f"order {order.order_id}: conta diverge da tentativa "
            f"(esperado {attempt.account_id!r}; obtido {order.account_id!r})"
        )
    return _append(
        state,
        event_type=EventType.BUDGET_ALERT,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at,
        account_id=attempt.account_id,
        payload={
            "attempt_id": attempt.attempt_id,
            "order_id": order.order_id,
            "remaining_cents": remaining_cents,
            "requested_discount_cents": requested_discount_cents,
        },
    )


# ---------------------------------------------------------------------------
# PE2: conclusão do pedido e resgate
# ---------------------------------------------------------------------------


def redemption_completed(
    state: SimulationState,
    attempt: Attempt,
    order: Order,
    redemption: Redemption,
    *,
    commission_cents: int,
    occurred_at: float | None = None,
) -> Event:
    """Resgate concluído: desconto debitado e comissão creditada no mesmo evento.

    ``commission_cents`` é a comissão da plataforma sobre o pedido (fração
    configurada em ``config.coupon.commission_rate``), calculada e debitada
    pelo checkout — aqui ela só é registrada, uma única vez, no mesmo evento
    do resgate (AGENTS.md §6).
    """

    _check_state_and_attempt(state, attempt)
    if not isinstance(order, Order):
        raise ValueError(f"order: esperado Order, obtido {type(order).__name__}")
    if not isinstance(redemption, Redemption):
        raise ValueError(f"redemption: esperado Redemption, obtido {type(redemption).__name__}")
    if order.account_id != attempt.account_id:
        raise ValueError(
            f"order {order.order_id}: conta diverge da tentativa "
            f"(esperado {attempt.account_id!r}; obtido {order.account_id!r})"
        )
    if redemption.order_id != order.order_id:
        raise ValueError(
            f"redemption {redemption.redemption_id}: pedido diverge "
            f"(esperado {order.order_id!r}; obtido {redemption.order_id!r})"
        )
    if redemption.round_number != attempt.round_number:
        raise ValueError(
            f"redemption {redemption.redemption_id}: rodada diverge da tentativa "
            f"(esperado {attempt.round_number!r}; obtido {redemption.round_number!r})"
        )
    return _append(
        state,
        event_type=EventType.REDEMPTION_COMPLETED,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at if occurred_at is None else occurred_at,
        account_id=attempt.account_id,
        payload={
            "redemption_id": redemption.redemption_id,
            "attempt_id": attempt.attempt_id,
            "order_id": order.order_id,
            "order_value": order.value,
            "discount": redemption.discount,
            "commission": commission_cents / 100,
        },
    )


# ---------------------------------------------------------------------------
# Canal de contestação da AM3
# ---------------------------------------------------------------------------


def contestation_opened(
    state: SimulationState,
    attempt: Attempt,
    reason: str,
) -> Event:
    """Contestação aberta no canal da AM3 contra a recusa da tentativa."""

    _check_state_and_attempt(state, attempt)
    if not isinstance(reason, str) or not reason.strip():
        raise ValueError("reason: esperado texto não vazio")
    return _append(
        state,
        event_type=EventType.CONTESTATION_OPENED,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at,
        account_id=attempt.account_id,
        payload={
            "attempt_id": attempt.attempt_id,
            "reason": reason,
            "policy_version": state.policy.version,
        },
    )


def contestation_reviewed(
    state: SimulationState,
    attempt: Attempt,
    status: ContestationStatus,
) -> Event:
    """Revisão da contestação concluída (evento ``contestation_resolved``).

    Reverter não é aprovar automaticamente: o checkout reavalia primeira
    compra, valor e orçamento em uma decisão nova (Trabalho 1 §6.2).
    """

    _check_state_and_attempt(state, attempt)
    if not isinstance(status, ContestationStatus):
        raise ValueError(
            f"status: esperado ContestationStatus, obtido {status!r}"
        )
    return _append(
        state,
        event_type=EventType.CONTESTATION_RESOLVED,
        round_number=attempt.round_number,
        occurred_at=attempt.occurred_at,
        account_id=attempt.account_id,
        payload={
            "attempt_id": attempt.attempt_id,
            "status": status.value,
            "policy_version": state.policy.version,
        },
    )
