"""Testes das regras puras do cupom (models/rules/coupon.py; AGENTS.md §6).

Desconto e mínimo são parâmetros vindos da configuração (``CouponRule``),
não constantes do módulo (ADR-005 §3; I-01). A borda do domínio é exata:
com o mínimo de R$ 30,00 (3000 centavos), R$ 30,00 é inelegível e R$ 30,01
(3001 centavos) é elegível. Todo o dinheiro vive em centavos inteiros;
ponto flutuante só entra como ponte de conversão.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from models.config import CouponConfig
from models.entities import Account
from models.rules.coupon import (
    CouponRule,
    budget_allows,
    debit_budget,
    discount_cents,
    is_account_eligible,
    is_eligible,
    reais_to_cents,
)

COUPON_SOURCE = Path(__file__).resolve().parents[1] / "src" / "models" / "rules" / "coupon.py"

#: Regra de referência dos testes: R$ 20 de desconto, mínimo de R$ 30 (T1 §3).
RULE = CouponRule(discount_cents=2000, min_order_cents=3000)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _order_kwargs(**overrides: object) -> dict[str, object]:
    """Pedido de referência elegível: primeira compra, cupom livre, R$ 41,90."""

    fields: dict[str, object] = {
        "rule": RULE,
        "first_purchase_completed": False,
        "coupon_used": False,
        "order_value_cents": 4190,
    }
    fields.update(overrides)
    return fields


# ---------------------------------------------------------------------------
# Regra parametrizada pela configuração (I-01; ADR-005 §3)
# ---------------------------------------------------------------------------


def test_rule_comes_from_configuration() -> None:
    """Desconto e mínimo chegam da config, convertidos em centavos inteiros."""

    rule = CouponRule.from_config(CouponConfig(discount=20.0, min_order=30.0, commission_rate=0.2))
    assert rule.discount_cents == 2000
    assert rule.min_order_cents == 3000

    custom = CouponRule.from_config(CouponConfig(discount=25.0, min_order=40.0, commission_rate=0.2))
    assert custom.discount_cents == 2500
    assert custom.min_order_cents == 4000


def test_rule_validation_rejects_invalid_values() -> None:
    """A regra exige desconto inteiro positivo e mínimo não negativo."""

    with pytest.raises(ValueError, match="discount_cents"):
        CouponRule(discount_cents=0, min_order_cents=3000)
    with pytest.raises(ValueError, match="discount_cents"):
        CouponRule(discount_cents=-100, min_order_cents=3000)
    with pytest.raises(ValueError, match="min_order_cents"):
        CouponRule(discount_cents=2000, min_order_cents=-1)
    with pytest.raises(ValueError, match="coupon"):
        CouponRule.from_config("not_a_coupon_config")  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Borda do mínimo (critério de aceite)
# ---------------------------------------------------------------------------


def test_border_3000_is_ineligible_and_3001_is_eligible() -> None:
    """Critério de aceite: a borda é estritamente maior que R$ 30,00."""

    assert is_eligible(**_order_kwargs(order_value_cents=3000)) is False
    assert is_eligible(**_order_kwargs(order_value_cents=3001)) is True


@pytest.mark.parametrize(
    ("order_value_cents", "expected"),
    [(1, False), (2999, False), (3000, False), (3001, True), (3002, True), (100_000, True)],
)
def test_minimum_order_border_is_exact(order_value_cents: int, expected: bool) -> None:
    """A comparação acontece em centavos inteiros, sem folga implícita."""

    assert is_eligible(**_order_kwargs(order_value_cents=order_value_cents)) is expected


def test_border_follows_the_configured_minimum() -> None:
    """A borda acompanha o mínimo da regra, não um valor fixo (I-01)."""

    custom = CouponRule(discount_cents=1500, min_order_cents=2500)
    assert is_eligible(**_order_kwargs(rule=custom, order_value_cents=2500)) is False
    assert is_eligible(**_order_kwargs(rule=custom, order_value_cents=2501)) is True


def test_order_below_the_minimum_gets_no_discount() -> None:
    """Pedido abaixo do mínimo é inelegível e não gera desconto."""

    kwargs = _order_kwargs(order_value_cents=2999)
    assert is_eligible(**kwargs) is False
    assert discount_cents(**kwargs) == 0


# ---------------------------------------------------------------------------
# Elegibilidade por histórico da conta
# ---------------------------------------------------------------------------


def test_account_with_previous_purchase_is_never_eligible_again() -> None:
    """Conta com compra anterior não volta a ser elegível, mesmo com pedido novo."""

    # Pela primitiva pura: primeira compra concluída fecha o cupom para sempre.
    assert is_eligible(**_order_kwargs(first_purchase_completed=True)) is False

    # Pela entidade: a transição de conclusão é permanente (ADR-011 §6).
    account = Account(account_id="acc_001").complete_first_purchase()
    assert is_account_eligible(RULE, account, RULE.min_order_cents + 1) is False
    assert is_account_eligible(RULE, account, 100_000) is False


def test_coupon_already_used_in_the_same_account_is_ineligible() -> None:
    """Cupom já usado na mesma conta não é concedido de novo."""

    kwargs = _order_kwargs(coupon_used=True)
    assert is_eligible(**kwargs) is False
    assert discount_cents(**kwargs) == 0


# ---------------------------------------------------------------------------
# Desconto
# ---------------------------------------------------------------------------


def test_discount_is_paid_only_for_eligible_orders() -> None:
    """Pedido elegível recebe exatamente o desconto da regra."""

    assert discount_cents(**_order_kwargs()) == RULE.discount_cents


def test_discount_follows_the_configured_value() -> None:
    """O desconto concedido é o da regra configurada (I-01)."""

    custom = CouponRule(discount_cents=1500, min_order_cents=3000)
    assert discount_cents(**_order_kwargs(rule=custom)) == 1500


def test_discount_is_zero_for_every_ineligible_case() -> None:
    """Nenhuma condição quebrada gera desconto parcial."""

    cases = [
        _order_kwargs(order_value_cents=3000),
        _order_kwargs(first_purchase_completed=True),
        _order_kwargs(coupon_used=True),
    ]
    for kwargs in cases:
        assert discount_cents(**kwargs) == 0


# ---------------------------------------------------------------------------
# Ponte reais (float) → centavos (int)
# ---------------------------------------------------------------------------


def test_reais_to_cents_preserves_the_exact_border() -> None:
    """A conversão corrige a imprecisão binária e preserva a borda 3000×3001."""

    assert reais_to_cents(30.00) == 3000
    assert reais_to_cents(30.01) == 3001
    assert reais_to_cents(20.00) == RULE.discount_cents
    assert reais_to_cents(41.90) == 4190


def test_float_order_value_is_judged_in_cents() -> None:
    """Pedido em reais (``float`` da entidade) é julgado em centavos exatos."""

    account = Account(account_id="acc_001")
    assert is_account_eligible(RULE, account, reais_to_cents(30.00)) is False
    assert is_account_eligible(RULE, account, reais_to_cents(30.01)) is True


@pytest.mark.parametrize("value", [-0.01, float("nan"), float("inf"), "30.00", True])
def test_reais_to_cents_rejects_non_monetary_values(value: object) -> None:
    """A ponte rejeita negativos, não finitos e não numéricos."""

    with pytest.raises(ValueError, match="value"):
        reais_to_cents(value)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Débito no orçamento de aquisição
# ---------------------------------------------------------------------------


def test_debit_happens_only_when_the_order_completes() -> None:
    """Critério de aceite: pedido não concluído deixa o orçamento intocado."""

    budget_consumed = 0
    assert debit_budget(budget_consumed, RULE.discount_cents, order_completed=False) == 0
    assert debit_budget(budget_consumed, RULE.discount_cents, order_completed=True) == (
        RULE.discount_cents
    )


def test_debit_is_unique_per_account() -> None:
    """Débito único: concluída a primeira compra, não há segundo débito."""

    account = Account(account_id="acc_001")
    budget_consumed = 0

    # Primeiro pedido: elegível e concluído — o desconto entra no orçamento.
    assert is_account_eligible(RULE, account, 4190) is True
    budget_consumed = debit_budget(budget_consumed, RULE.discount_cents, order_completed=True)
    assert budget_consumed == RULE.discount_cents
    account = account.complete_first_purchase()

    # Segundo pedido da mesma conta: sem desconto e, portanto, sem débito.
    second_discount = discount_cents(
        rule=RULE,
        first_purchase_completed=account.first_purchase_completed,
        coupon_used=not account.is_eligible,
        order_value_cents=4190,
    )
    assert second_discount == 0
    assert debit_budget(budget_consumed, second_discount, order_completed=True) == (
        budget_consumed
    )


def test_zeroed_budget_cannot_fund_a_redemption() -> None:
    """Orçamento zerado (ou reste menor que o desconto) não paga mais resgate."""

    assert budget_allows(RULE.discount_cents, budget_remaining_cents=0) is False
    assert budget_allows(RULE.discount_cents, budget_remaining_cents=1999) is False
    assert budget_allows(RULE.discount_cents, budget_remaining_cents=2000) is True


def test_full_acquisition_budget_funds_five_thousand_redemptions() -> None:
    """R$ 100.000 de aquisição cobrem exatamente 5.000 resgates de R$ 20."""

    budget_total_cents = reais_to_cents(100_000.00)
    assert budget_total_cents // RULE.discount_cents == 5000
    assert budget_allows(RULE.discount_cents, budget_remaining_cents=budget_total_cents) is True


# ---------------------------------------------------------------------------
# Validação de entrada
# ---------------------------------------------------------------------------


def test_rule_inputs_are_validated() -> None:
    """A regra rejeita centavos não inteiros/negativos e flags não booleanas."""

    with pytest.raises(ValueError, match="order_value_cents"):
        is_eligible(**_order_kwargs(order_value_cents=-1))
    with pytest.raises(ValueError, match="order_value_cents"):
        is_eligible(**_order_kwargs(order_value_cents=3000.0))  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="first_purchase_completed"):
        is_eligible(**_order_kwargs(first_purchase_completed=1))  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="rule"):
        is_eligible(**_order_kwargs(rule=None))  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="budget_consumed_cents"):
        debit_budget(-1, RULE.discount_cents, order_completed=True)
    with pytest.raises(ValueError, match="discount"):
        debit_budget(0, -1, order_completed=True)


# ---------------------------------------------------------------------------
# Fronteira de imports (ADR-010; AGENTS.md §5–§6)
# ---------------------------------------------------------------------------

FORBIDDEN_IMPORT_ROOTS = {"streamlit", "agents", "evaluation", "views", "controllers"}


def test_coupon_module_has_no_ui_agent_or_evaluation_imports() -> None:
    """A regra pura não depende de UI, agentes, controller nem avaliador."""

    tree = ast.parse(COUPON_SOURCE.read_text(encoding="utf-8"))
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            roots.add(node.module.split(".")[0])
    assert roots, "esperado ao menos um import no módulo"
    assert not roots & FORBIDDEN_IMPORT_ROOTS
