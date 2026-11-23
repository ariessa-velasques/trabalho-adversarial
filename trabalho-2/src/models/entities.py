"""Entidades de domínio do simulador (ADR-005 §1).

Dataclasses tipadas compartilhadas por bot, motor, controller e avaliador —
sem negociação de dicionários crus (ADR-006 §2). O ``SimulationState`` é o
agregado mutável possuído pelo ``controllers/rounds.py`` e passado
explicitamente aos componentes; não existe singleton nem estado global
(ADR-005 §2). As transições de conta são imutáveis: cada método devolve uma
nova instância, e a inelegibilidade após a primeira compra é permanente,
verificada em ``__post_init__`` (ADR-011 §6).

Separação de informação (ADR-006): nenhuma entidade carrega rótulo
("fraudulento"/"legítimo"), o mapa pessoa↔conta ou o custo do bot. O mapa
pertence a ``models/scenarios.py`` e o custo do bot entra como payload do
evento ``bot_cost_recorded``; ambos chegam somente ao avaliador, pelas
projeções. A tática aparece apenas em ``Attempt``, para atribuição de custo
(ADR-012 §8), e nunca é projetada ao motor (ADR-011 §5).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from types import MappingProxyType
from typing import Mapping

from models.enums import EventType, Outcome, TacticId, VerificationLevel


# ---------------------------------------------------------------------------
# Primitivas de validação estrutural
# ---------------------------------------------------------------------------


def _require_text(value: str, name: str) -> None:
    """Falha se o texto for vazio ou só espaços."""

    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name}: esperado texto não vazio")


def _require_number(value: float, name: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{name}: esperado número")
    if not math.isfinite(value):
        raise ValueError(f"{name}: esperado número finito")


def _require_positive(value: float, name: str) -> None:
    """Falha se o valor não for número finito estritamente positivo."""

    _require_number(value, name)
    if value <= 0:
        raise ValueError(f"{name}: esperado número finito maior que zero")


def _require_non_negative(value: float, name: str) -> None:
    """Falha se o valor não for número finito maior ou igual a zero."""

    _require_number(value, name)
    if value < 0:
        raise ValueError(f"{name}: esperado número finito maior ou igual a zero")


def _require_positive_int(value: int, name: str) -> None:
    """Falha se o valor não for inteiro maior ou igual a 1."""

    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"{name}: esperado inteiro maior ou igual a 1")


def _require_enum(value: object, enum_type: type, name: str) -> None:
    """Falha se o valor não for instância do enum tipado esperado."""

    if not isinstance(value, enum_type):
        raise ValueError(f"{name}: esperado {enum_type.__name__}, obtido {value!r}")


# ---------------------------------------------------------------------------
# Entidades compartilhadas (ADR-005 §1)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Account:
    """Conta do PedeJá e sua elegibilidade permanente ao cupom (ADR-011 §6).

    ``is_eligible`` só vai de ``True`` para ``False``: depois que
    ``first_purchase_completed`` é ``True``, nenhuma instância válida volta a
    ser elegível — o ``__post_init__`` rejeita a combinação, inclusive via
    ``dataclasses.replace``.
    """

    account_id: str
    signals: frozenset[str] = frozenset()
    is_eligible: bool = True
    first_purchase_completed: bool = False

    def __post_init__(self) -> None:
        _require_text(self.account_id, "account_id")
        if isinstance(self.signals, str):
            raise ValueError("signals: esperado coleção de sinais, não texto")
        object.__setattr__(self, "signals", frozenset(self.signals))
        if self.first_purchase_completed and self.is_eligible:
            raise ValueError(
                f"account {self.account_id}: conta com primeira compra concluída "
                "não pode ser elegível (ADR-011 §6)"
            )

    def complete_first_purchase(self) -> Account:
        """Fecha a elegibilidade da conta de forma permanente (débito único).

        Levanta ``ValueError`` se a primeira compra já foi concluída: o
        desconto é debitado uma única vez, na conclusão do pedido
        (AGENTS.md §6).
        """

        if self.first_purchase_completed:
            raise ValueError(
                f"account {self.account_id}: primeira compra já concluída"
            )
        return replace(self, is_eligible=False, first_purchase_completed=True)


@dataclass(frozen=True)
class Order:
    """Pedido e o valor que alimenta a regra do cupom (elegibilidade R$ 30)."""

    order_id: str
    account_id: str
    value: float
    coupon_applied: bool = False

    def __post_init__(self) -> None:
        _require_text(self.order_id, "order_id")
        _require_text(self.account_id, "account_id")
        _require_positive(self.value, "value")


@dataclass(frozen=True)
class Attempt:
    """Tentativa de cadastro e resgate do bot em uma rodada.

    ``tactic_id`` existe para atribuição de custo pelo avaliador (ADR-012 §8)
    e não é projetado ao motor; o motor vê ``signals`` e histórico (ADR-011
    §5). ``occurred_at`` é o instante simulado, em horas desde o início da
    execução.
    """

    attempt_id: str
    account_id: str
    round_number: int
    tactic_id: TacticId
    signals: frozenset[str]
    occurred_at: float

    def __post_init__(self) -> None:
        _require_text(self.attempt_id, "attempt_id")
        _require_text(self.account_id, "account_id")
        _require_positive_int(self.round_number, "round_number")
        _require_enum(self.tactic_id, TacticId, "tactic_id")
        if isinstance(self.signals, str):
            raise ValueError("signals: esperado coleção de sinais, não texto")
        object.__setattr__(self, "signals", frozenset(self.signals))
        _require_non_negative(self.occurred_at, "occurred_at")


@dataclass(frozen=True)
class Decision:
    """Decisão imutável do motor sobre uma tentativa (ADR-006 §5).

    O motivo interno fica separado do resultado público; as projeções expõem
    só ``outcome`` e ``public_message`` (ADR-006 §1). A mensagem pode virar
    genérica com o redesenho da AM3 sem mudar o vocabulário de ``Outcome``
    (ADR-011 §4).
    """

    attempt_id: str
    outcome: Outcome
    public_message: str
    internal_reason: str
    policy_version: str

    def __post_init__(self) -> None:
        _require_text(self.attempt_id, "attempt_id")
        _require_enum(self.outcome, Outcome, "outcome")
        _require_text(self.public_message, "public_message")
        _require_text(self.internal_reason, "internal_reason")
        _require_text(self.policy_version, "policy_version")


@dataclass(frozen=True)
class Redemption:
    """Resgate concluído: desconto debitado do orçamento uma única vez.

    O débito ocorre somente na conclusão do pedido (AGENTS.md §6). A rodada é
    mantida para atribuição de métricas sem dupla contagem (ADR-012 §7).
    """

    redemption_id: str
    account_id: str
    order_id: str
    discount: float
    round_number: int

    def __post_init__(self) -> None:
        _require_text(self.redemption_id, "redemption_id")
        _require_text(self.account_id, "account_id")
        _require_text(self.order_id, "order_id")
        _require_positive(self.discount, "discount")
        _require_positive_int(self.round_number, "round_number")


@dataclass(frozen=True)
class Policy:
    """Política de defesa vigente do motor, versionada (ADR-011 §9).

    Os defaults representam a linha de base B1 antes do redesenho da AM3:
    mensagem detalhada e os quatro controles desligados (AGENTS.md §6).
    ``config/scenarios.json`` sobrescreve; transições (B1→B2, controles)
    criam uma nova instância com outra versão, e o evento ``policy_changed``
    registra o gatilho (ADR-011 §7).
    """

    version: str
    verification: VerificationLevel
    generic_message: bool = False
    attempt_limit: int | None = None
    attempt_window_hours: int | None = None
    probing_detection: bool = False
    contestation_channel: bool = False

    def __post_init__(self) -> None:
        _require_text(self.version, "version")
        _require_enum(self.verification, VerificationLevel, "verification")
        if (self.attempt_limit is None) != (self.attempt_window_hours is None):
            raise ValueError(
                "policy: limite de tentativas e janela em horas devem ser "
                "definidos juntos (controle da AM3)"
            )
        if self.attempt_limit is not None:
            _require_positive_int(self.attempt_limit, "policy.attempt_limit")
        if self.attempt_window_hours is not None:
            _require_positive_int(self.attempt_window_hours, "policy.attempt_window_hours")


@dataclass(frozen=True)
class Event:
    """Evento canônico do log append-only (ADR-005 §5; Trabalho 1 §6.3).

    ``payload`` é opaco e somente leitura; cada projeção decide, por
    whitelist, o que expõe a bot, motor e revisão (ADR-006 §1–§2).
    ``occurred_at`` é o instante simulado em horas; a sequência começa em 1 e
    é estritamente crescente dentro da execução (ADR-007).
    """

    sequence: int
    round_number: int
    occurred_at: float
    event_type: EventType
    account_id: str | None = None
    payload: Mapping[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _require_positive_int(self.sequence, "sequence")
        _require_positive_int(self.round_number, "round_number")
        _require_non_negative(self.occurred_at, "occurred_at")
        _require_enum(self.event_type, EventType, "event_type")
        if self.account_id is not None:
            _require_text(self.account_id, "account_id")
        if not isinstance(self.payload, Mapping):
            raise ValueError("payload: esperado mapeamento de dados do evento")
        object.__setattr__(self, "payload", MappingProxyType(dict(self.payload)))


@dataclass
class SimulationState:
    """Estado de domínio da execução, possuído pelo controller (ADR-005 §2).

    Criado por ``controllers/rounds.py`` e passado explicitamente aos
    componentes — não há singleton nem estado global. Guarda tudo o que
    persiste entre rodadas (ADR-011 §6): contas e elegibilidade, sinais já
    usados por conta, janelas de limite por escopo, política vigente,
    orçamento consumido da plataforma e o histórico de eventos da execução.
    O gasto do bot não mora aqui: é estado do próprio bot (ADR-012 §5–§6).
    """

    run_id: str
    policy: Policy
    accounts: dict[str, Account] = field(default_factory=dict)
    used_signals: dict[str, frozenset[str]] = field(default_factory=dict)
    limit_windows: dict[str, tuple[float, ...]] = field(default_factory=dict)
    budget_consumed: float = 0.0
    events: list[Event] = field(default_factory=list)

    def __post_init__(self) -> None:
        _require_text(self.run_id, "run_id")
        _require_enum(self.policy, Policy, "policy")
        _require_non_negative(self.budget_consumed, "budget_consumed")

    def record_event(self, event: Event) -> Event:
        """Anexa o evento ao histórico com sequência estritamente crescente.

        Única forma sancionada de acrescentar eventos; a ordem preserva o
        replay (ADR-007). Levanta ``ValueError`` em sequência fora de ordem.
        """

        if self.events and event.sequence <= self.events[-1].sequence:
            raise ValueError(
                f"event {event.sequence}: sequência deve ser estritamente "
                f"crescente (último evento: {self.events[-1].sequence})"
            )
        self.events.append(event)
        return event
