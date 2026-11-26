from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Sequence


@dataclass(frozen=True)
class TacticSpec:
    name: str
    unit_cost: float
    avoids_signals: tuple[str, ...] = ()


@dataclass(frozen=True)
class LastRoundSummary:
    tactic: str
    spent: float
    approvals: int
    rejection_signals: tuple[str, ...] = ()
    observation_hint: str = ""


@dataclass(frozen=True)
class BotDecisionPayload:
    tactic: str
    volume: int
    rationale: str
    observation_used: str


def compute_last_round_cost_per_approval(spent: float, approvals: int) -> float:
    """Calcula custo por aprovada apenas da última rodada (nunca acumulado)."""
    if spent <= 0 and approvals == 0:
        return 0.0
    if approvals <= 0:
        return math.inf
    return spent / approvals


def is_tactic_profitable(
    spent: float,
    approvals: int,
    max_cost_per_approval: float,
    coupon_value: float = 20.0,
) -> bool:
    cost_per_approval = compute_last_round_cost_per_approval(spent, approvals)
    if math.isinf(cost_per_approval):
        return False
    return cost_per_approval <= max_cost_per_approval and cost_per_approval < coupon_value


def choose_fallback_decision(
    round_number: int,
    catalog: Sequence[TacticSpec],
    used_tactics: Iterable[str],
    last_round: LastRoundSummary | None,
    max_cost_per_approval: float,
    attack_budget_remaining: float,
    coupon_value: float = 20.0,
) -> BotDecisionPayload:
    """Fallback determinístico sem LLM: troca antes de recuar; recua = volume 0."""
    ordered_catalog = sorted(catalog, key=lambda item: item.unit_cost)
    used_set = set(used_tactics)

    if not ordered_catalog or attack_budget_remaining <= 0:
        return BotDecisionPayload(
            tactic=ordered_catalog[0].name if ordered_catalog else "none",
            volume=0,
            rationale="Sem orçamento de ataque disponível ou catálogo vazio; recuando.",
            observation_used="Sem rodada anterior" if last_round is None else (last_round.observation_hint or f"rodada {round_number - 1}: gasto={last_round.spent}"),
        )

    # Rodada 1 ou sem histórico anterior: começa pela tática mais barata dentro do orçamento
    if round_number <= 1 or last_round is None:
        cheapest = ordered_catalog[0]
        affordable_volume = max(0, min(10, int(attack_budget_remaining // cheapest.unit_cost))) if cheapest.unit_cost > 0 else 10
        return BotDecisionPayload(
            tactic=cheapest.name,
            volume=affordable_volume,
            rationale="Iniciando pela tática mais barata do catálogo.",
            observation_used="Rodada inicial sem observação de rodada anterior.",
        )

    used_set.add(last_round.tactic)
    obs = last_round.observation_hint or (
        f"Rodada {round_number - 1}: tática={last_round.tactic}, gasto={last_round.spent}, "
        f"aprovações={last_round.approvals}, sinais={','.join(last_round.rejection_signals) or 'nenhum'}"
    )

    # 1) Se a recusa citou um sinal, tenta trocar para tática ainda não usada que evite o sinal
    for signal in last_round.rejection_signals:
        for candidate in ordered_catalog:
            if candidate.name not in used_set and signal in candidate.avoids_signals and candidate.unit_cost < coupon_value:
                vol = max(1, min(10, int(attack_budget_remaining // candidate.unit_cost))) if candidate.unit_cost > 0 else 10
                if vol > 0:
                    return BotDecisionPayload(
                        tactic=candidate.name,
                        volume=vol,
                        rationale=f"Recusa indicou sinal '{signal}'; trocando para '{candidate.name}'.",
                        observation_used=obs,
                    )

    # 2) Se a tática da última rodada ainda compensa pelo ROI da própria rodada, mantém
    if is_tactic_profitable(
        spent=last_round.spent,
        approvals=last_round.approvals,
        max_cost_per_approval=max_cost_per_approval,
        coupon_value=coupon_value,
    ):
        current_spec = next((c for c in ordered_catalog if c.name == last_round.tactic), ordered_catalog[0])
        vol = max(1, min(10, int(attack_budget_remaining // current_spec.unit_cost))) if current_spec.unit_cost > 0 else 10
        return BotDecisionPayload(
            tactic=current_spec.name,
            volume=vol,
            rationale="ROI da última rodada dentro do limiar; mantendo tática.",
            observation_used=obs,
        )

    # 3) Tática atual não compensa: troca para a próxima tática ainda não usada com custo < desconto
    for candidate in ordered_catalog:
        if candidate.name not in used_set and candidate.unit_cost < coupon_value:
            vol = max(1, min(10, int(attack_budget_remaining // candidate.unit_cost))) if candidate.unit_cost > 0 else 10
            if vol > 0:
                return BotDecisionPayload(
                    tactic=candidate.name,
                    volume=vol,
                    rationale=f"ROI acima do limiar; trocando para alternativa '{candidate.name}'.",
                    observation_used=obs,
                )

    # 4) Nenhuma alternativa compensa: recua (volume = 0)
    return BotDecisionPayload(
        tactic=last_round.tactic,
        volume=0,
        rationale="Nenhuma tática restante do catálogo compensa o custo; recuando (volume 0).",
        observation_used=obs,
    )