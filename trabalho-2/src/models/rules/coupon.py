"""Regras puras do cupom ``BEMVINDO`` (AGENTS.md §6; Trabalho 1 §3; ADR-010 §2).

R$ 20 de desconto na **primeira compra** com valor **estritamente maior** que
R$ 30, pago pelo orçamento de aquisição (R$ 100.000 ≈ 5.000 resgates). Toda a
aritmética monetária acontece em **centavos inteiros**: a borda do domínio é
exata (``3000`` inelegível, ``3001`` elegível) e ponto flutuante não decide
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

from models.entities import Account

#: Desconto do cupom: R$ 20,00 em centavos (Trabalho 1 §3).
COUPON_DISCOUNT_CENTS = 2000
#: Valor mínimo do pedido: R$ 30,00 em centavos; a regra exige estritamente maior.
MIN_ORDER_VALUE_CENTS = 3000


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


# ---------------------------------------------------------------------------
# Ponte reais (float das entidades) → centavos (int da regra)
# ---------------------------------------------------------------------------


def reais_to_cents(value: float) -> int:
    """Converte reais (``float`` das entidades) em centavos inteiros.

    Ponto flutuante não pode decidir a borda: ``30.01 * 100`` vale
    ``3000.999…`` em binário, e o arredondamento ao centavo mais próximo
    devolve exatamente ``3001``. Rejeita não numéricos, não finitos e
    negativos.
    """

    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError("value: esperado valor monetário numérico")
    if not math.isfinite(value):
        raise ValueError("value: esperado valor monetário finito")
    if value < 0:
        raise ValueError("value: esperado valor monetário não negativo")
    return round(value * 100)


# ---------------------------------------------------------------------------
# Elegibilidade (primeira compra + cupom não usado + pedido > R$ 30)
# ---------------------------------------------------------------------------


def is_eligible(
    *,
    first_purchase_completed: bool,
    coupon_used: bool,
    order_value_cents: int,
) -> bool:
    """Elegibilidade do pedido ao cupom ``BEMVINDO``.

    Três condições, todas obrigatórias (AGENTS.md §6):

    - a conta nunca concluiu a primeira compra — a inelegibilidade após a
      conclusão é permanente (ADR-011 §6);
    - o cupom ainda não foi usado naquela conta;
    - o valor do pedido é **estritamente maior** que R$ 30,00 — a borda é
      exata em centavos: ``3000`` inelegível, ``3001`` elegível.
    """

    _require_flag(first_purchase_completed, "first_purchase_completed")
    _require_flag(coupon_used, "coupon_used")
    _require_cents(order_value_cents, "order_value_cents")
    return (
        not first_purchase_completed
        and not coupon_used
        and order_value_cents > MIN_ORDER_VALUE_CENTS
    )


def is_account_eligible(account: Account, order_value_cents: int) -> bool:
    """Elegibilidade a partir da entidade ``Account`` (models/entities.py).

    A conta já carrega as duas condições de histórico: a primeira compra
    concluída e a elegibilidade permanente fechada por
    ``Account.complete_first_purchase``. Uma conta que concluiu a primeira
    compra nunca volta a ser elegível, ainda que o pedido novo supere o
    mínimo.
    """

    return is_eligible(
        first_purchase_completed=account.first_purchase_completed,
        coupon_used=not account.is_eligible,
        order_value_cents=order_value_cents,
    )


# ---------------------------------------------------------------------------
# Desconto e débito no orçamento de aquisição
# ---------------------------------------------------------------------------


def discount_cents(
    *,
    first_purchase_completed: bool,
    coupon_used: bool,
    order_value_cents: int,
) -> int:
    """Desconto em centavos do pedido: ``2000`` se elegível, ``0`` caso contrário.

    O desconto é fixo (R$ 20,00) e não depende do valor do pedido — só da
    elegibilidade.
    """

    eligible = is_eligible(
        first_purchase_completed=first_purchase_completed,
        coupon_used=coupon_used,
        order_value_cents=order_value_cents,
    )
    return COUPON_DISCOUNT_CENTS if eligible else 0


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
