"""Checkout do PedeJá: cadastro (PE1), decisão do motor e conclusão (PE2).

É o caminho que toda tentativa percorre (ADR-011 §2.3): cadastro
(``register_attempt``, PE1) → decisão do motor (``decide``, delegada por
interface) → checkout (``complete_order``, PE2), aplicando a regra do cupom
de ``models/rules/coupon.py`` e devolvendo o ``Outcome`` público. Cada etapa
anexa eventos canônicos ao log de ``models/events.py``.

Invariantes de orçamento (AGENTS.md §6):

- o orçamento de aquisição é debitado **uma única vez, na conclusão** do
  pedido; recusa, verificação pedida ou conclusão sem desconto não debita;
- o desconto configurado não é cobrado duas vezes: a conclusão consome a
  elegibilidade da conta de forma permanente
  (``Account.complete_first_purchase``);
- a primeira compra de valor até o mínimo é **concluída sem desconto** e
  fecha a elegibilidade da conta para sempre — o cupom vale só para a
  primeira compra (decisão do grupo, plano revisado §11) — sem responder
  ``coupon_already_used``, porque o cupom nunca foi usado;
- a comissão configurada sobre o pedido é creditada no mesmo evento do
  resgate (``redemption_completed``), uma única vez;
- orçamento esgotado bloqueia novas conclusões com resposta pública
  ``rate_limited`` genérica, sem revelar a regra interna.

Separação de informação (ADR-006): este módulo nunca importa ``agents/`` nem
``evaluation/`` — o motor entra pela interface ``DecisionEngine``, definida
aqui e implementada em ``agents/engine.py``. O motivo interno da decisão
nunca vai para o log: as projeções expõem só ``outcome`` e
``public_message`` (ADR-006 §5). Toda a aritmética monetária acontece em
centavos inteiros, com a ponte ``reais_to_cents``.

Fica fora deste módulo: a lógica de risco do motor (contrato abaixo,
implementação em ``agents/engine.py``), a persistência dos eventos em disco
(Issue de Execução e evidência) e as mensagens de tela.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Protocol

from models.config import SimulationConfig
from models.entities import Account, Attempt, Decision, Order, Redemption, SimulationState
from models.enums import EventType, Outcome
from models.events import (
    account_created,
    budget_alert,
    coupon_decided,
    order_completed,
    rate_limited,
    redemption_completed,
    verification_requested,
)
from models.rules.coupon import (
    CouponRule,
    budget_allows,
    discount_cents,
    reais_to_cents,
)

__all__ = ["Checkout", "DecisionEngine", "GENERIC_UNAVAILABLE_MESSAGE"]


#: Resposta pública quando a conclusão é bloqueada por orçamento esgotado:
#: genérica de propósito — não revela a regra interna (AGENTS.md §6).
GENERIC_UNAVAILABLE_MESSAGE = "Cupom temporariamente indisponível. Tente novamente mais tarde."


# ---------------------------------------------------------------------------
# Interface do motor antifraude (contrato; implementação em agents/engine.py)
# ---------------------------------------------------------------------------


class DecisionEngine(Protocol):
    """Interface pela qual o checkout delega a decisão (ADR-011 §2.3).

    O motor recebe a tentativa (sinais apresentados, ADR-011 §5) e o estado
    operacional (contas, histórico, janelas de limite, política vigente,
    orçamento) e devolve uma ``Decision`` imutável. Ele não escreve contas,
    orçamento nem eventos: só o checkout aplica a decisão — o motor pode
    apenas manter suas próprias janelas de limite em ``state.limit_windows``
    (controles da AM3).

    A implementação vive em ``agents/engine.py`` e satisfaz este protocolo
    estruturalmente, sem que este módulo importe ``agents/`` (ADR-006).
    """

    def decide(self, attempt: Attempt, state: SimulationState) -> Decision:
        """Decide aceitar, recusar, pedir verificação ou limitar a tentativa."""
        ...


# ---------------------------------------------------------------------------
# Checkout
# ---------------------------------------------------------------------------


@dataclass
class Checkout:
    """Fluxo de cadastro, decisão e conclusão sobre um estado compartilhado.

    Recebe o ``SimulationState`` do controller (ADR-005 §2), a configuração
    da execução e o motor pela interface ``DecisionEngine``. Único escritor
    de contas, orçamento e eventos do caminho PE1 → decisão → PE2. A regra
    do cupom é derivada da configuração na construção (``rule``), em
    centavos inteiros — nenhum valor de negócio fica fixo no código
    (ADR-005 §3).
    """

    state: SimulationState
    config: SimulationConfig
    engine: DecisionEngine
    rule: CouponRule = field(init=False)

    def __post_init__(self) -> None:
        if not isinstance(self.state, SimulationState):
            raise ValueError(f"state: esperado SimulationState, obtido {type(self.state).__name__}")
        if not isinstance(self.config, SimulationConfig):
            raise ValueError(f"config: esperado SimulationConfig, obtido {type(self.config).__name__}")
        if not callable(getattr(self.engine, "decide", None)):
            raise ValueError("engine: esperado motor com decide(attempt, state) (DecisionEngine)")
        self.rule = CouponRule.from_config(self.config.coupon)

    # -- PE1: cadastro ------------------------------------------------------

    def register_attempt(self, attempt: Attempt) -> Account:
        """Registra a conta no cadastro (PE1) e anexa o evento de conta criada.

        A conta nasce elegível, com os sinais apresentados na tentativa; os
        sinais acumulam em ``state.used_signals`` para a detecção de
        relações pelo motor (ADR-011 §5). Levanta ``ValueError`` em
        tentativa inválida ou conta já registrada.
        """

        if not isinstance(attempt, Attempt):
            raise ValueError(f"attempt: esperado Attempt, obtido {type(attempt).__name__}")
        if attempt.account_id in self.state.accounts:
            raise ValueError(
                f"account {attempt.account_id}: conta já registrada no cadastro (PE1)"
            )
        account = Account(account_id=attempt.account_id, signals=attempt.signals)
        self.state.accounts[account.account_id] = account
        self.state.used_signals[account.account_id] = frozenset(attempt.signals)
        account_created(self.state, attempt)
        return account

    # -- decisão do motor ---------------------------------------------------

    def decide(self, attempt: Attempt) -> Decision:
        """Delega a decisão ao motor e registra o resultado (PE1 → PE2).

        Anexa ``coupon_decided`` sempre; ``verification_requested`` quando o
        motor pede verificação e ``rate_limited`` (evento
        ``limit_triggered``) quando bloqueia por limite. O motivo interno da
        decisão nunca entra no log (ADR-006 §5). Levanta ``ValueError`` se a
        conta não passou pelo cadastro (PE1) ou se a decisão não confere
        com a tentativa.
        """

        if not isinstance(attempt, Attempt):
            raise ValueError(f"attempt: esperado Attempt, obtido {type(attempt).__name__}")
        if attempt.account_id not in self.state.accounts:
            raise ValueError(
                f"account {attempt.account_id}: cadastro (PE1) ausente antes da decisão"
            )
        decision = self.engine.decide(attempt, self.state)
        if not isinstance(decision, Decision):
            raise ValueError(
                f"engine: esperado Decision de models/entities.py, obtido {type(decision).__name__}"
            )
        if decision.attempt_id != attempt.attempt_id:
            raise ValueError(
                f"decision {decision.attempt_id!r}: diverge da tentativa "
                f"{attempt.attempt_id!r}"
            )
        coupon_decided(self.state, attempt, decision)
        if decision.outcome is Outcome.VERIFICATION_REQUIRED:
            verification_requested(self.state, attempt, decision)
        elif decision.outcome is Outcome.RATE_LIMITED:
            rate_limited(self.state, attempt)
        return decision

    # -- PE2: conclusão do pedido -------------------------------------------

    def complete_order(
        self,
        order: Order,
        attempt: Attempt,
        decision: Decision,
        *,
        occurred_at: float,
    ) -> Outcome:
        """Conclui o pedido (PE2), aplicando a regra do cupom (AGENTS.md §6).

        Recusa e verificação pedida não debitam o orçamento nem geram
        ``redemption_completed``. A primeira compra de valor até o mínimo é
        concluída **sem desconto** e fecha a elegibilidade da conta para
        sempre (decisão do grupo, plano revisado §11) — sem resposta
        ``coupon_already_used``, pois o cupom nunca foi usado. Na conclusão
        elegível, o desconto é debitado uma única vez, a conta perde a
        elegibilidade de forma permanente e a comissão configurada é
        creditada no mesmo evento do resgate. Com orçamento esgotado, a
        conclusão é bloqueada com ``rate_limited`` genérico, sem revelar a
        regra interna.

        ``occurred_at`` é o instante simulado da conclusão, em horas.
        """

        _require_order(order)
        if not isinstance(attempt, Attempt):
            raise ValueError(f"attempt: esperado Attempt, obtido {type(attempt).__name__}")
        if not isinstance(decision, Decision):
            raise ValueError(f"decision: esperado Decision, obtido {type(decision).__name__}")
        if order.account_id != attempt.account_id:
            raise ValueError(
                f"order {order.order_id}: conta diverge da tentativa "
                f"(esperado {attempt.account_id!r}; obtido {order.account_id!r})"
            )
        if decision.attempt_id != attempt.attempt_id:
            raise ValueError(
                f"decision {decision.attempt_id!r}: diverge da tentativa "
                f"{attempt.attempt_id!r}"
            )
        _require_instant(occurred_at)
        account = self.state.accounts.get(order.account_id)
        if account is None:
            raise ValueError(
                f"account {order.account_id}: cadastro (PE1) ausente antes da conclusão"
            )

        # Recusa (ou verificação pedida): sem débito, sem resgate — o
        # coupon_decided correspondente já foi anexado em decide().
        if decision.outcome is not Outcome.ACCEPTED:
            return decision.outcome

        order_value_cents = reais_to_cents(order.value)

        if account.first_purchase_completed:
            # O cupom vale só para a primeira compra: concluída ela, nenhum
            # pedido seguinte da conta recebe desconto. A recusa pública é
            # ``coupon_already_used`` (vocabulário fechado, ADR-011 §4); o
            # motivo vive na mensagem interna, não no vocabulário. Não há
            # conclusão nem débito.
            outcome = Outcome.COUPON_ALREADY_USED
            coupon_decided(
                self.state,
                attempt,
                Decision(
                    attempt_id=attempt.attempt_id,
                    outcome=outcome,
                    public_message="Não foi possível aplicar o cupom a este pedido.",
                    internal_reason="first_purchase_completed",
                    policy_version=self.state.policy.version,
                ),
            )
            return outcome

        discount = discount_cents(
            rule=self.rule,
            first_purchase_completed=False,
            coupon_used=False,
            order_value_cents=order_value_cents,
        )
        if discount == 0:
            # Primeira compra de valor até o mínimo (decisão do grupo, plano
            # revisado §11): o pedido é CONCLUÍDO sem desconto e a conta
            # perde a elegibilidade para sempre. Não é ``coupon_already_used``
            # — o cupom nunca foi usado. Sem débito: nada há a cobrar do
            # orçamento de aquisição.
            self.state.accounts[account.account_id] = account.complete_first_purchase()
            order_completed(self.state, attempt, order, occurred_at=occurred_at)
            return Outcome.ACCEPTED

        consumed_cents = round(self.state.budget_consumed * 100)
        remaining_cents = reais_to_cents(self.config.budget.acquisition) - consumed_cents
        if not budget_allows(discount, remaining_cents):
            # Orçamento esgotado: bloqueia a conclusão com resposta pública
            # genérica; o evento operacional (budget_alert) registra o reste
            # para o motor — o bot nunca o vê (ADR-006 §1).
            budget_alert(
                self.state,
                attempt,
                order,
                remaining_cents=remaining_cents,
                requested_discount_cents=discount,
            )
            coupon_decided(
                self.state,
                attempt,
                Decision(
                    attempt_id=attempt.attempt_id,
                    outcome=Outcome.RATE_LIMITED,
                    public_message=GENERIC_UNAVAILABLE_MESSAGE,
                    internal_reason="budget_exhausted",
                    policy_version=self.state.policy.version,
                ),
            )
            return Outcome.RATE_LIMITED

        # Débito único: concluído o pedido, a conta perde a elegibilidade de
        # forma permanente e o mesmo desconto não pode ser cobrado de novo.
        self.state.budget_consumed = (consumed_cents + discount) / 100
        self.state.accounts[account.account_id] = account.complete_first_purchase()
        commission_cents = round(order_value_cents * self.config.coupon.commission_rate)
        redemption = Redemption(
            redemption_id=f"red_{attempt.attempt_id}",
            account_id=attempt.account_id,
            order_id=order.order_id,
            discount=discount / 100,
            round_number=attempt.round_number,
        )
        redemption_completed(
            self.state,
            attempt,
            order,
            redemption,
            commission_cents=commission_cents,
            occurred_at=occurred_at,
        )
        return Outcome.ACCEPTED

    # -- leitura de estado ----------------------------------------------------

    def event_types(self) -> list[EventType]:
        """Tipos dos eventos anexados até agora, na ordem do log."""

        return [event.event_type for event in self.state.events]


# ---------------------------------------------------------------------------
# Validação estrutural local
# ---------------------------------------------------------------------------


def _require_order(order: Order) -> None:
    if not isinstance(order, Order):
        raise ValueError(f"order: esperado Order, obtido {type(order).__name__}")


def _require_instant(occurred_at: float) -> None:
    """Falha se o instante simulado não for número finito não negativo."""

    if not isinstance(occurred_at, (int, float)) or isinstance(occurred_at, bool):
        raise ValueError("occurred_at: esperado instante simulado numérico")
    if not math.isfinite(occurred_at) or occurred_at < 0:
        raise ValueError("occurred_at: esperado instante simulado não negativo")
