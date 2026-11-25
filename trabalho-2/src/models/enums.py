"""Vocabulários fechados do domínio (ADR-011 §4; Trabalho 1 §6.3).

Enumerações com valores em inglês (AGENTS.md §5), estáveis entre rodadas e
serializáveis direto no log de eventos em JSONL (ADR-005 §5). O vocabulário
público de resultados é fechado por contrato: a mensagem exibida pode ficar
genérica com o redesenho da AM3 sem mudar estes valores (ADR-011 §4).
"""

from __future__ import annotations

from enum import StrEnum


class Mode(StrEnum):
    """Modo de execução do bot: regras determinísticas ou LLM opcional (ADR-003).

    Espelha ``modes.run`` em ``config/scenarios.json`` (ADR-005 §3). O modo
    ``adversarial_validation`` é o único que faz chamadas externas e nunca é
    exigido pela suíte padrão.
    """

    DETERMINISTIC = "deterministic"
    ADVERSARIAL_VALIDATION = "adversarial_validation"


class VerificationLevel(StrEnum):
    """Nível de verificação do motor: leve (B1) ou rígida (B2)."""

    B1 = "b1"
    B2 = "b2"


class Outcome(StrEnum):
    """Vocabulário público fechado do resultado de uma tentativa (ADR-011 §4).

    ``verification_required`` e ``rate_limited`` são recusas com semântica
    própria; o texto exibido pode mudar entre mensagem detalhada e genérica,
    o vocabulário não.
    """

    ACCEPTED = "accepted"
    COUPON_ALREADY_USED = "coupon_already_used"
    VERIFICATION_REQUIRED = "verification_required"
    RATE_LIMITED = "rate_limited"


class EventType(StrEnum):
    """Eventos canônicos do log append-only (Trabalho 1 §6.3; ADR-005 §5).

    ``bot_strategy_changed`` e ``bot_cost_recorded`` são exclusivos do
    avaliador e nunca são projetados ao motor (ADR-006 §1).
    """

    SIGNUP_STARTED = "signup_started"
    SIGNUP_COMPLETED = "signup_completed"
    SIGNUP_ABANDONED = "signup_abandoned"
    RELATION_DETECTED = "relation_detected"
    VERIFICATION_REQUESTED = "verification_requested"
    VERIFICATION_COMPLETED = "verification_completed"
    ORDER_STARTED = "order_started"
    ORDER_COMPLETED = "order_completed"
    ORDER_ABANDONED = "order_abandoned"
    COUPON_DECIDED = "coupon_decided"
    PROBING_SUSPECTED = "probing_suspected"
    LIMIT_TRIGGERED = "limit_triggered"
    COOLDOWN_IMPOSED = "cooldown_imposed"
    REDEMPTION_COMPLETED = "redemption_completed"
    BUDGET_ALERT = "budget_alert"
    CONTESTATION_OPENED = "contestation_opened"
    CONTESTATION_RESOLVED = "contestation_resolved"
    POLICY_CHANGED = "policy_changed"
    BOT_STRATEGY_CHANGED = "bot_strategy_changed"
    BOT_COST_RECORDED = "bot_cost_recorded"


class ContestationStatus(StrEnum):
    """Ciclo de vida de uma contestação aberta pelo canal da AM3."""

    OPEN = "open"
    UPHELD = "upheld"
    REVERTED = "reverted"


class TacticId(StrEnum):
    """Catálogo fechado de táticas do bot (ADR-003 §1; ADR-012 §3).

    Espelha os ids de ``tactics.catalog`` em ``config/scenarios.json``;
    incluir uma tática nova no catálogo exige estender este enum.
    """

    EMAIL_DISPOSABLE = "email_disposable"
    VIRTUAL_SMS_CPF = "virtual_sms_cpf"
    EMULATOR_ADDRESS = "emulator_address"
