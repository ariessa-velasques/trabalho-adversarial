"""Testes das populações sintéticas das rodadas (models/scenarios.py; ADR-011 §2.3).

Critérios de aceite da coorte: mesma seed → mesma coorte; seeds diferentes →
coortes diferentes; P3 presente (dispositivo e endereço compartilhados na
coorte legítima); rótulos e mapa pessoa↔conta confinados ao avaliador
(ADR-006 §4).
"""

from __future__ import annotations

import ast
import dataclasses
from collections.abc import Iterator
from pathlib import Path
from types import MappingProxyType

import pytest

from models.config import SimulationConfig
from models.entities import Account
from models.enums import VerificationLevel
from models.scenarios import (
    BASE_CONVERSION,
    FRAUD_PERSON_ID,
    BotPlan,
    CohortProfile,
    GroundTruth,
    Label,
    LegitPlan,
    RoundPopulation,
    RoundScenario,
    completes_first_purchase,
    generate_round_scenario,
    scenarios_rng,
)

MODELS_DIR = Path(__file__).resolve().parents[1] / "src" / "models"

TACTIC_SIGNAL = "disposable_email"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _scenario(config: SimulationConfig, round_number: int = 1, bot_count: int = 50) -> RoundScenario:
    """Cenário de referência para os testes."""

    return generate_round_scenario(config, round_number, bot_count=bot_count, tactic_signal=TACTIC_SIGNAL)


def _all_plans(population: RoundPopulation) -> tuple[BotPlan | LegitPlan, ...]:
    return (*population.bot, *population.legit)


def _shared_signal_groups(
    plans: tuple[LegitPlan, ...], prefix: str
) -> dict[str, set[str]]:
    """Agrupa contas legítimas por sinal com o prefixo dado (device:/address:)."""

    groups: dict[str, set[str]] = {}
    for plan in plans:
        for signal in plan.account.signals:
            if signal.startswith(prefix):
                groups.setdefault(signal, set()).add(plan.account.account_id)
    return groups


def _customers_sharing(plans: tuple[LegitPlan, ...], prefix: str) -> int:
    """Quantas pessoas legítimas dividem ao menos um sinal do prefixo dado."""

    groups = _shared_signal_groups(plans, prefix)
    return sum(len(accounts) for accounts in groups.values() if len(accounts) >= 2)


def _iter_leaves(value: object) -> Iterator[object]:
    """Percorre recursivamente dataclasses, tuplas, conjuntos e mapeamentos."""

    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        for field in dataclasses.fields(value):
            yield from _iter_leaves(getattr(value, field.name))
    elif isinstance(value, MappingProxyType) or isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _iter_leaves(item)
    elif isinstance(value, (tuple, frozenset, list, set)):
        for item in value:
            yield from _iter_leaves(item)
    else:
        yield value


# ---------------------------------------------------------------------------
# Determinismo (critério de aceite: mesma seed → mesmas contas, sinais, rótulos)
# ---------------------------------------------------------------------------


def test_same_seed_reproduces_accounts_signals_and_labels(config: SimulationConfig) -> None:
    """Duas execuções com a mesma seed geram exatamente o mesmo cenário."""

    first = _scenario(config)
    second = _scenario(config)

    assert first == second
    assert first.population.bot == second.population.bot
    assert first.population.legit == second.population.legit
    assert [plan.account.signals for plan in first.population.legit] == [
        plan.account.signals for plan in second.population.legit
    ]
    assert first.ground_truth.labels == second.ground_truth.labels
    assert first.ground_truth.accounts_by_person == second.ground_truth.accounts_by_person


def test_different_seeds_generate_different_cohorts(
    write_config,
) -> None:
    """Seeds diferentes produzem coortes diferentes (mesma configuração)."""

    config_a, _ = write_config(overrides={"seeds": {"master": 42}})
    config_b, _ = write_config(overrides={"seeds": {"master": 43}})

    scenario_a = _scenario(config_a)
    scenario_b = _scenario(config_b)

    assert scenario_a.population != scenario_b.population
    assert scenario_a.ground_truth != scenario_b.ground_truth
    assert [plan.account.signals for plan in scenario_a.population.legit] != [
        plan.account.signals for plan in scenario_b.population.legit
    ]
    assert [plan.order_value for plan in scenario_a.population.legit] != [
        plan.order_value for plan in scenario_b.population.legit
    ]


def test_round_substreams_are_independent(config: SimulationConfig) -> None:
    """Gerar a rodada 2 não depende de gerar (ou não) a rodada 1 (ADR-007 §1)."""

    baseline = _scenario(config, round_number=2)
    _scenario(config, round_number=1)
    after = _scenario(config, round_number=2)

    assert baseline == after


def test_scenarios_rng_is_derived_from_the_stream_name() -> None:
    """O fluxo segue o formato seed:stream (ADR-007 §1) e varia por rodada."""

    first = scenarios_rng(42, 1)
    same = scenarios_rng(42, 1)
    other_round = scenarios_rng(42, 2)
    other_seed = scenarios_rng(43, 1)

    assert first.random() == same.random()
    assert first.random() != other_round.random()
    assert first.random() != other_seed.random()


# ---------------------------------------------------------------------------
# P3: dispositivo e endereço compartilhados na coorte legítima
# ---------------------------------------------------------------------------


def test_p3_shared_device_and_address_exist(config: SimulationConfig) -> None:
    """Critério de aceite: ao menos um caso de cada na coorte legítima."""

    scenario = _scenario(config)
    legit = scenario.population.legit

    device_groups = _shared_signal_groups(legit, "device:")
    address_groups = _shared_signal_groups(legit, "address:")

    assert any(len(accounts) >= 2 for accounts in device_groups.values()), (
        "esperado ao menos um dispositivo compartilhado na coorte legítima"
    )
    assert any(len(accounts) >= 2 for accounts in address_groups.values()), (
        "esperado ao menos um endereço compartilhado na coorte legítima"
    )


def test_sharing_reflects_the_configured_percentages(config: SimulationConfig) -> None:
    """Os percentuais configurados calibram o compartilhamento (12% e 18%)."""

    scenario = _scenario(config)
    legit = scenario.population.legit

    # Metas de 18% (endereço) e 12% (aparelho) com folga para o arredondamento
    # e para o tamanho atômico dos grupos (domicílio entra inteiro).
    assert 12 <= _customers_sharing(legit, "address:") <= 26
    assert 10 <= _customers_sharing(legit, "device:") <= 25


def test_all_three_p3_variations_occur(config: SimulationConfig) -> None:
    """Há quem divida só endereço, quem divida só aparelho e quem divida ambos."""

    scenario = _scenario(config)
    legit = scenario.population.legit

    device_groups = _shared_signal_groups(legit, "device:")
    address_groups = _shared_signal_groups(legit, "address:")
    shared_devices = {signal for signal, accounts in device_groups.items() if len(accounts) >= 2}
    shared_addresses = {signal for signal, accounts in address_groups.items() if len(accounts) >= 2}

    device_only = address_only = both = False
    for plan in legit:
        device_signals = {s for s in plan.account.signals if s.startswith("device:")}
        address_signals = {s for s in plan.account.signals if s.startswith("address:")}
        shares_device = bool(device_signals & shared_devices)
        shares_address = bool(address_signals & shared_addresses)
        device_only = device_only or (shares_device and not shares_address)
        address_only = address_only or (shares_address and not shares_device)
        both = both or (shares_device and shares_address)

    assert device_only, "esperado colegas de trabalho dividindo só o aparelho"
    assert address_only, "esperado domicílio dividindo só o endereço"
    assert both, "esperado família/república dividindo aparelho e endereço"


# ---------------------------------------------------------------------------
# Perfis e pedidos da coorte
# ---------------------------------------------------------------------------


def test_cohort_mixes_all_profiles(config: SimulationConfig) -> None:
    """Pessoa única, família e república aparecem na coorte."""

    scenario = _scenario(config)
    profiles = set(scenario.ground_truth.profile_of_person.values())

    assert {
        CohortProfile.SINGLE,
        CohortProfile.FAMILY,
        CohortProfile.SHARED_HOUSE,
    } <= profiles


def test_cohort_mixes_orders_above_and_below_the_minimum(config: SimulationConfig) -> None:
    """Parte da coorte compra acima de R$ 30 e parte abaixo (até a borda exata)."""

    scenario = _scenario(config)
    legit = scenario.population.legit
    values = [plan.order_value for plan in legit]

    assert any(value > 30 for value in values)
    assert any(value < 30 for value in values)


def test_bot_orders_are_always_above_the_minimum(config: SimulationConfig) -> None:
    """Conta do bot que pedisse abaixo de R$ 30 não resgataria nada."""

    scenario = _scenario(config)

    assert all(plan.order_value > 30 for plan in scenario.population.bot)


def test_bot_accounts_present_the_tactic_signal_and_fresh_identities(
    config: SimulationConfig,
) -> None:
    """Cada conta do bot carrega o sinal da tática e identidade nova."""

    scenario = _scenario(config)

    bot_devices = [s for plan in scenario.population.bot for s in plan.account.signals if s.startswith("device:")]
    bot_addresses = [
        s for plan in scenario.population.bot for s in plan.account.signals if s.startswith("address:")
    ]

    assert all(TACTIC_SIGNAL in plan.account.signals for plan in scenario.population.bot)
    assert len(bot_devices) == len(set(bot_devices)) == len(scenario.population.bot)
    assert len(bot_addresses) == len(set(bot_addresses)) == len(scenario.population.bot)


def test_account_ids_do_not_repeat_and_are_neutral(config: SimulationConfig) -> None:
    """Ids são únicos na rodada e não revelam a que população a conta pertence."""

    scenario = _scenario(config)
    ids = [plan.account.account_id for plan in _all_plans(scenario.population)]

    assert len(ids) == len(set(ids))
    assert all(not account_id.startswith("bot") for account_id in ids)


# ---------------------------------------------------------------------------
# Conversão base e atrito (70% em B1 → 55% em B2)
# ---------------------------------------------------------------------------


def test_base_conversion_matches_the_reference_scenario() -> None:
    """Conversão base configurável: 70% em B1 e 55% em B2 (Trabalho 1 §3)."""

    assert BASE_CONVERSION[VerificationLevel.B1] == pytest.approx(0.70)
    assert BASE_CONVERSION[VerificationLevel.B2] == pytest.approx(0.55)


def test_b2_friction_drops_conversion_monotonically(config: SimulationConfig) -> None:
    """B2 converte ~55%, B1 ~70%, e ninguém compra sob B2 sem comprar sob B1."""

    scenario = _scenario(config)
    legit = scenario.population.legit
    total = len(legit)

    completes_b1 = [completes_first_purchase(plan, VerificationLevel.B1) for plan in legit]
    completes_b2 = [completes_first_purchase(plan, VerificationLevel.B2) for plan in legit]

    assert total > 0
    assert sum(completes_b1) / total == pytest.approx(0.70, abs=0.10)
    assert sum(completes_b2) / total == pytest.approx(0.55, abs=0.10)
    assert all(b2 <= b1 for b1, b2 in zip(completes_b1, completes_b2, strict=True))


def test_conversion_override_is_configurable(config: SimulationConfig) -> None:
    """A tabela de conversão é um parâmetro — o motor pode calibrar o redesenho."""

    scenario = _scenario(config)
    plan = scenario.population.legit[0]

    custom = {VerificationLevel.B1: 0.0, VerificationLevel.B2: 1.0}
    assert completes_first_purchase(plan, VerificationLevel.B1, base_conversion=custom) is False
    assert completes_first_purchase(plan, VerificationLevel.B2, base_conversion=custom) is True


def test_conversion_function_validates_inputs(config: SimulationConfig) -> None:
    """A função rejeita plano, nível e tabela inválidos."""

    scenario = _scenario(config)
    plan = scenario.population.legit[0]

    with pytest.raises(ValueError, match="plan"):
        completes_first_purchase("not_a_plan", VerificationLevel.B1)  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="verification_level"):
        completes_first_purchase(plan, "b1")  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="base_conversion"):
        completes_first_purchase(plan, VerificationLevel.B1, base_conversion={})


# ---------------------------------------------------------------------------
# Separação de informação (ADR-006 §4; critério de aceite)
# ---------------------------------------------------------------------------


def test_labels_and_person_map_cover_exactly_the_population(config: SimulationConfig) -> None:
    """Toda conta tem um rótulo; todo rótulo aponta para conta da população."""

    scenario = _scenario(config)
    population_ids = {plan.account.account_id for plan in _all_plans(scenario.population)}

    assert set(scenario.ground_truth.labels) == population_ids
    mapped = {
        account
        for accounts in scenario.ground_truth.accounts_by_person.values()
        for account in accounts
    }
    assert mapped == population_ids
    assert set(scenario.ground_truth.person_of_account) == population_ids


def test_bot_accounts_share_one_fraud_person_legit_ones_are_one_to_one(
    config: SimulationConfig,
) -> None:
    """O fraudador é uma pessoa só; cada legítimo tem conta única."""

    scenario = _scenario(config)
    truth = scenario.ground_truth

    bot_ids = {plan.account.account_id for plan in scenario.population.bot}
    legit_ids = {plan.account.account_id for plan in scenario.population.legit}

    assert all(truth.labels[account_id] is Label.FRAUDULENT for account_id in bot_ids)
    assert all(truth.labels[account_id] is Label.LEGITIMATE for account_id in legit_ids)
    assert set(truth.accounts_by_person[FRAUD_PERSON_ID]) == bot_ids
    assert truth.accounts_by_person[FRAUD_PERSON_ID] == tuple(sorted(bot_ids))

    legit_persons = [
        person for person, accounts in truth.accounts_by_person.items() if person != FRAUD_PERSON_ID
    ]
    assert len(legit_persons) == len(legit_ids)
    assert all(len(truth.accounts_by_person[person]) == 1 for person in legit_persons)


def test_labels_never_appear_in_the_public_population(config: SimulationConfig) -> None:
    """Nenhum rótulo é alcançável a partir da população pública."""

    scenario = _scenario(config)

    assert "ground_truth" not in {field.name for field in dataclasses.fields(RoundPopulation)}
    assert "ground_truth" not in {field.name for field in dataclasses.fields(BotPlan)}
    assert "ground_truth" not in {field.name for field in dataclasses.fields(LegitPlan)}

    leaves = list(_iter_leaves(scenario.population))
    assert not any(isinstance(leaf, (Label, GroundTruth)) for leaf in leaves)
    strings = {leaf for leaf in leaves if isinstance(leaf, str)}
    assert not strings & {label.value for label in Label}


def test_profiles_are_ground_truth_only(config: SimulationConfig) -> None:
    """O perfil demográfico (por que se divide um aparelho) é do avaliador."""

    scenario = _scenario(config)

    assert "profile" not in {field.name for field in dataclasses.fields(RoundPopulation)}
    assert "profile" not in {field.name for field in dataclasses.fields(LegitPlan)}
    leaves = list(_iter_leaves(scenario.population))
    assert not any(isinstance(leaf, CohortProfile) for leaf in leaves)


# ---------------------------------------------------------------------------
# Validação estrutural
# ---------------------------------------------------------------------------


def test_round_population_rejects_duplicate_account_ids() -> None:
    """População com conta repetida é rejeitada na construção."""

    account = Account(account_id="acc_r01_0001", signals=frozenset({TACTIC_SIGNAL}))

    with pytest.raises(ValueError, match="repetidas"):
        RoundPopulation(
            round_number=1,
            bot=(BotPlan(account=account, order_value=41.9),),
            legit=(
                LegitPlan(account=account, order_value=41.9, conversion_draw=0.5),
            ),
        )


def test_ground_truth_rejects_inconsistent_person_map() -> None:
    """O mapa pessoa↔conta valida inverso, cobertura e perfil conhecido."""

    with pytest.raises(ValueError, match="conjuntos de contas distintos"):
        GroundTruth(
            labels={"acc_1": Label.LEGITIMATE},
            accounts_by_person={"p1": ("acc_1",), "p2": ("acc_2",)},
            person_of_account={"acc_1": "p1", "acc_2": "p2"},
            profile_of_person={},
        )

    with pytest.raises(ValueError, match="diverge do inverso"):
        GroundTruth(
            labels={"acc_1": Label.LEGITIMATE},
            accounts_by_person={"p1": ("acc_1",)},
            person_of_account={"acc_1": "p2"},
            profile_of_person={},
        )

    with pytest.raises(ValueError, match="pessoa sem conta no mapa"):
        GroundTruth(
            labels={"acc_1": Label.LEGITIMATE},
            accounts_by_person={"p1": ("acc_1",)},
            person_of_account={"acc_1": "p1"},
            profile_of_person={"p2": CohortProfile.FAMILY},
        )

    with pytest.raises(ValueError, match="pessoa sem conta no mapa"):
        GroundTruth(
            labels={"acc_1": Label.LEGITIMATE},
            accounts_by_person={"p1": ()},
            person_of_account={"acc_1": "p1"},
            profile_of_person={},
        )


def test_round_scenario_rejects_mismatched_parts(config: SimulationConfig) -> None:
    """Cenário exige população e verdade de campo da mesma rodada e cobertura."""

    scenario = _scenario(config)
    other = _scenario(config, round_number=2)

    with pytest.raises(ValueError, match="diverge da população"):
        RoundScenario(
            round_number=2,
            population=scenario.population,
            ground_truth=scenario.ground_truth,
        )

    with pytest.raises(ValueError, match="não cobrem exatamente a população"):
        RoundScenario(
            round_number=1,
            population=scenario.population,
            ground_truth=other.ground_truth,
        )


def test_generate_round_scenario_validates_parameters(config: SimulationConfig) -> None:
    """Parâmetros inválidos falham com ValueError nomeando o parâmetro."""

    with pytest.raises(ValueError, match="round_number"):
        generate_round_scenario(config, 0, bot_count=1, tactic_signal=TACTIC_SIGNAL)
    with pytest.raises(ValueError, match="bot_count"):
        generate_round_scenario(config, 1, bot_count=-1, tactic_signal=TACTIC_SIGNAL)
    with pytest.raises(ValueError, match="tactic_signal"):
        generate_round_scenario(config, 1, bot_count=1, tactic_signal="  ")
    with pytest.raises(ValueError, match="config"):
        generate_round_scenario("not_a_config", 1, bot_count=1, tactic_signal=TACTIC_SIGNAL)  # type: ignore[arg-type]


def test_empty_cohort_and_zero_bot_volume(write_config) -> None:
    """Rodada vazia é válida: população e verdade de campo vazias."""

    config, _ = write_config(overrides={"rounds": {"legit_customers": 0}})
    scenario = generate_round_scenario(config, 1, bot_count=0, tactic_signal=TACTIC_SIGNAL)

    assert scenario.population.bot == ()
    assert scenario.population.legit == ()
    assert scenario.ground_truth.labels == {}
    assert scenario.ground_truth.accounts_by_person == {}


def test_single_customer_cohort_degenerates_gracefully(write_config) -> None:
    """Coorte de 1 pessoa: nenhum grupo compartilhado é obrigatório."""

    config, _ = write_config(overrides={"rounds": {"legit_customers": 1}})
    scenario = generate_round_scenario(config, 1, bot_count=0, tactic_signal=TACTIC_SIGNAL)

    assert len(scenario.population.legit) == 1
    assert scenario.ground_truth.profile_of_person == {
        next(iter(scenario.ground_truth.person_of_account.values())): CohortProfile.SINGLE
    }


# ---------------------------------------------------------------------------
# Fronteira de imports (ADR-006 §6; ADR-010; AGENTS.md §5–§6)
# ---------------------------------------------------------------------------

FORBIDDEN_IMPORT_ROOTS = {"agents", "controllers", "evaluation", "views"}


def test_models_package_never_imports_evaluation_or_upward_layers() -> None:
    """Nenhum módulo de models importa evaluation (nem agentes, view, controller)."""

    for source in sorted(MODELS_DIR.rglob("*.py")):
        tree = ast.parse(source.read_text(encoding="utf-8"))
        roots: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                roots.add(node.module.split(".")[0])
        assert not roots & FORBIDDEN_IMPORT_ROOTS, (
            f"{source.name}: import proibido em models/ ({sorted(roots & FORBIDDEN_IMPORT_ROOTS)})"
        )
