"""Regras puras do cupom ``BEMVINDO`` (AGENTS.md §6; Trabalho 1 §3; ADR-010 §2).

Desconto na **primeira compra** com valor **estritamente maior** que o mínimo,
pago pelo orçamento de aquisição. Os valores do cupom (desconto e mínimo) vêm
de ``config/scenarios.json`` — nenhum parâmetro de negócio fica fixo neste
módulo (ADR-005 §3): eles chegam pelo ``CouponRule``, já em **centavos
inteiros**, de modo que a borda do domínio é exata (``min_order_cents``
inelegível, ``min_order_cents + 1`` elegível) e ponto flutuante não decide
nada aqui. A ponte com as entidades, que carregam reais em ``float``, é
``reais_to_cents`` — arredondamento ao centavo mais próximo.

São funções puras e sem estado (ADR-010 §2). Fica fora deste módulo: decidir
se a conta é fraudulenta (motor antifraude), escrever eventos (checkout) e
formatar moeda para a tela (view). O débito único é garantido em conjunto com
``Account.complete_first_purchase``: a conclusão do pedido consome a
elegibilidade da conta de forma permanente, de modo que o mesmo desconto
nunca é debitado duas vezes.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from models.config import CouponConfig
from models.entities import Account


# ---------------------------------------------------------------------------
# Validação estrutural
# ---------------------------------------------------------------------------


def _require_cents(value: int, name: str) -> None:
    """Falha se o valor não for inteiro não negativo de centavos."""

    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{name}: esperado inteiro de centavos")
    if value < 0:
        raise ValueError(f"{name}: esperado centavos não negativos")


def _require_flag(value: bool, name: str) -> None:
    """Falha se o valor não for booleano estrito."""

    if not isinstance(value, bool):
        raise ValueError(f"{name}: esperado booleano")


def _require_rule(rule: CouponRule) -> None:
    """Falha se a regra não for um ``CouponRule`` tipado."""

    if not isinstance(rule, CouponRule):
        raise ValueError(f"rule: esperado CouponRule, obtido {type(rule).__name__}")


# ---------------------------------------------------------------------------
# Ponte reais (float das entidades) → centavos (int da regra)
# ---------------------------------------------------------------------------


def reais_to_cents(value: float) -> int:
    """Converte reais (``float`` das entidades) em centavos inteiros.

    Ponto flutuante não pode decidir a borda: ``30.01 * 100`` não é exato
    em binário, e o arredondamento ao centavo mais próximo devolve o inteiro
    correto (``3001``). Rejeita não numéricos, não finitos e negativos.
    """

    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError("value: esperado valor monetário numérico")
    if not math.isfinite(value):
        raise ValueError("value: esperado valor monetário finito")
    if value < 0:
        raise ValueError("value: esperado valor monetário não negativo")
    return round(value * 100)


# ---------------------------------------------------------------------------
# Regra do cupom parametrizada pela configuração (ADR-005 §3)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CouponRule:
    """Parâmetros do cupom ``BEMVINDO`` em centavos inteiros.

    Construída a partir da configuração com ``CouponRule.from_config``: o
    desconto (R$ 20 na configuração de referência) e o pedido mínimo (R$ 30)
    são parâmetros, não constantes deste módulo. A comparação do mínimo é
    **estritamente maior**: ``min_order_cents`` é inelegível.
    """

    discount_cents: int
    min_order_cents: int

    def __post_init__(self) -> None:
        _require_cents(self.discount_cents, "discount_cents")
        if self.discount_cents < 1:
            raise ValueError("discount_cents: esperado inteiro de centavos maior que zero")
        _require_cents(self.min_order_cents, "min_order_cents")

    @classmethod
    def from_config(cls, coupon: CouponConfig) -> CouponRule:
        """Converte o desconto e o mínimo configurados (reais) em centavos.

        Levanta ``ValueError`` se a seção não for um ``CouponConfig`` tipado.
        """

        if not isinstance(coupon, CouponConfig):
            raise ValueError(f"coupon: esperado CouponConfig, obtido {type(coupon).__name__}")
        return cls(
            discount_cents=reais_to_cents(coupon.discount),
            min_order_cents=reais_to_cents(coupon.min_order),
        )


# ---------------------------------------------------------------------------
# Elegibilidade (primeira compra + cupom não usado + pedido acima do mínimo)
# ---------------------------------------------------------------------------


def is_eligible(
    *,
    rule: CouponRule,
    first_purchase_completed: bool,
    coupon_used: bool,
    order_value_cents: int,
) -> bool:
    """Elegibilidade do pedido ao cupom ``BEMVINDO``.

    Três condições, todas obrigatórias (AGENTS.md §6):

    - a conta nunca concluiu a primeira compra — a inelegibilidade após a
      conclusão é permanente (ADR-011 §6);
    - o cupom ainda não foi usado naquela conta;
    - o valor do pedido é **estritamente maior** que o mínimo da regra — a
      borda é exata em centavos: ``min_order_cents`` inelegível,
      ``min_order_cents + 1`` elegível.
    """

    _require_rule(rule)
    _require_flag(first_purchase_completed, "first_purchase_completed")
    _require_flag(coupon_used, "coupon_used")
    _require_cents(order_value_cents, "order_value_cents")
    return (
        not first_purchase_completed
        and not coupon_used
        and order_value_cents > rule.min_order_cents
    )


def is_account_eligible(rule: CouponRule, account: Account, order_value_cents: int) -> bool:
    """Elegibilidade a partir da entidade ``Account`` (models/entities.py).

    A conta já carrega as duas condições de histórico: a primeira compra
    concluída e a elegibilidade permanente fechada por
    ``Account.complete_first_purchase``. Uma conta que concluiu a primeira
    compra nunca volta a ser elegível, ainda que o pedido novo supere o
    mínimo.
    """

    _require_rule(rule)
    return is_eligible(
        rule=rule,
        first_purchase_completed=account.first_purchase_completed,
        coupon_used=not account.is_eligible,
        order_value_cents=order_value_cents,
    )


# ---------------------------------------------------------------------------
# Desconto e débito no orçamento de aquisição
# ---------------------------------------------------------------------------


def discount_cents(
    *,
    rule: CouponRule,
    first_purchase_completed: bool,
    coupon_used: bool,
    order_value_cents: int,
) -> int:
    """Desconto em centavos do pedido: ``rule.discount_cents`` se elegível, ``0`` se não.

    O desconto é fixo e não depende do valor do pedido — só da elegibilidade.
    """

    _require_rule(rule)
    eligible = is_eligible(
        rule=rule,
        first_purchase_completed=first_purchase_completed,
        coupon_used=coupon_used,
        order_value_cents=order_value_cents,
    )
    return rule.discount_cents if eligible else 0


def budget_allows(discount: int, budget_remaining_cents: int) -> bool:
    """O orçamento de aquisição cobre mais este resgate?

    Falso com orçamento zerado (ou reste menor que o desconto); um desconto
    zero é sempre permitido, pois nada há a debitar.
    """

    _require_cents(discount, "discount")
    _require_cents(budget_remaining_cents, "budget_remaining_cents")
    return budget_remaining_cents >= discount


def debit_budget(
    budget_consumed_cents: int,
    discount: int,
    *,
    order_completed: bool,
) -> int:
    """Novo acumulador do orçamento após a tentativa de resgate (função pura).

    O desconto entra no débito **somente** quando o pedido é concluído
    (AGENTS.md §6): pedido iniciado, abandonado ou recusado deixa o orçamento
    intocado, ainda que o cupom tenha sido exibido. Como a conclusão consome a
    elegibilidade da conta de forma permanente
    (``Account.complete_first_purchase``), o mesmo desconto não pode ser
    debitado duas vezes — a segunda tentativa da conta já chega aqui com
    desconto zero.
    """

    _require_cents(budget_consumed_cents, "budget_consumed_cents")
    _require_cents(discount, "discount")
    _require_flag(order_completed, "order_completed")
    if not order_completed:
        return budget_consumed_cents
    return budget_consumed_cents + discount
