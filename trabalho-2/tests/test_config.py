"""Testes do carregamento de configuração (models/config.py, ADR-005 §3)."""

from __future__ import annotations

import copy
import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from models.config import ConfigError, SimulationConfig, config_hash, load_config
from tests.conftest import MINIMAL_CONFIG

# ---------------------------------------------------------------------------
# Arquivo válido
# ---------------------------------------------------------------------------


def test_loads_versioned_config(config: SimulationConfig) -> None:
    """O scenarios.json versionado carrega e reflete os valores de referência."""

    assert config.rounds.count == 5
    assert config.rounds.min == 3
    assert config.rounds.days_per_round == 7
    assert config.rounds.base_conversion == {"b1": 0.7, "b2": 0.55}
    assert config.budget.acquisition == 100000.0
    assert config.budget.attack == 5000.0
    assert config.coupon.discount == 20.0
    assert config.coupon.min_order == 30.0
    assert config.coupon.commission_rate == 0.2
    assert config.modes.run == "deterministic"


def test_costs_match_catalog_and_are_per_attempt(config: SimulationConfig) -> None:
    """Cada tática tem custo próprio e o custo é cobrado por tentativa (ADR-012 §2–§3)."""

    catalog_ids = {tactic.id for tactic in config.tactics.catalog}
    assert catalog_ids == set(config.costs.tactics)
    assert config.costs.charged_per_attempt is True
    assert config.costs.tactics["email_disposable"] == 0.0
    assert config.costs.tactics["virtual_sms_cpf"] == 5.0
    assert config.costs.tactics["emulator_address"] == 12.0


def test_seed_streams_are_independent(config: SimulationConfig) -> None:
    """A seed mestra deriva fluxos nomeados e independentes (ADR-007 §1)."""

    assert config.seeds.master == 42
    assert len(config.seeds.streams) == len(set(config.seeds.streams))
    assert "bot" in config.seeds.streams and "engine" in config.seeds.streams


def test_load_accepts_relative_path(scenarios_path: Path) -> None:
    """Caminho relativo funciona, como no comando de aceite."""

    loaded = load_config(str(scenarios_path.relative_to(Path.cwd())))
    assert isinstance(loaded, SimulationConfig)


# ---------------------------------------------------------------------------
# Chave faltando
# ---------------------------------------------------------------------------


def _payload_without(dotted: str) -> dict[str, object]:
    """Cópia da configuração mínima sem a chave do caminho pontado."""

    payload = copy.deepcopy(MINIMAL_CONFIG)
    keys = dotted.split(".")
    node: object = payload
    for key in keys[:-1]:
        node = node[key]  # type: ignore[index]
    del node[keys[-1]]  # type: ignore[index]
    return payload


@pytest.mark.parametrize(
    "missing_key",
    [
        "rounds",
        "rounds.min",
        "rounds.base_conversion",
        "budget.attack",
        "coupon.commission_rate",
        "thresholds.bot",
        "seeds.streams",
        "modes",
        "tactics.catalog",
    ],
)
def test_missing_key_is_named_in_error(write_config, missing_key: str) -> None:
    """Configuração com chave ausente falha nomeando a chave e o esperado."""

    with pytest.raises(ConfigError) as excinfo:
        write_config(_payload_without(missing_key))
    message = str(excinfo.value)
    assert missing_key in message
    assert "ausente" in message
    assert "esperado" in message


def test_empty_tactics_cost_section_is_rejected(write_config) -> None:
    """Catálogo sem custo correspondente falha nomeando a tática."""

    overrides = {"costs": {"charged_per_attempt": True, "tactics": {"email_disposable": 0.0}}}
    with pytest.raises(ConfigError) as excinfo:
        write_config(MINIMAL_CONFIG, overrides)
    assert "virtual_sms_cpf" in str(excinfo.value)


# ---------------------------------------------------------------------------
# Tipo errado / valor inválido
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "key,invalid_value,fragment",
    [
        ("budget.attack", "5000", "número"),
        ("budget.attack", True, "número"),
        ("rounds.count", 0, "maior que zero"),
        ("rounds.count", 2.5, "inteiro"),
        ("rounds.min", 0, "maior que zero"),
        ("rounds.min", 1.5, "inteiro"),
        ("coupon.discount", -1, "maior que zero"),
        ("coupon.commission_rate", 1.5, "entre 0 e 1"),
        ("rounds.shared_device_pct", 101, "entre 0 e 100"),
        ("modes.run", "streamlit", "deterministic"),
        ("modes.defense", "B3", "B1"),
        ("costs.charged_per_attempt", "sim", "booleano"),
        ("seeds.master", "42", "inteiro"),
        ("llm.temperature", 2.0, "entre 0 e 1"),
        ("llm.provider", "openai", "anthropic"),
    ],
)
def test_invalid_value_names_key_and_expected(
    write_config, key: str, invalid_value: object, fragment: str
) -> None:
    """Valor de tipo ou domínio errado falha nomeando a chave e o valor esperado."""

    section, leaf = key.split(".", 1)
    with pytest.raises(ConfigError) as excinfo:
        write_config(MINIMAL_CONFIG, {section: {leaf: invalid_value}})
    message = str(excinfo.value)
    assert key in message
    assert "inválida" in message
    assert fragment in message


def test_unknown_tactic_in_catalog_is_rejected(write_config) -> None:
    """Tática do catálogo sem custo declarado falha nomeando o id."""

    extra = dict(MINIMAL_CONFIG)
    extra["tactics"] = {
        "catalog": [
            *MINIMAL_CONFIG["tactics"]["catalog"],  # type: ignore[index]
            {
                "id": "phone_farm",
                "name": "Phone farm",
                "signal": "device_farm",
                "description": "Fazenda de aparelhos.",
                "expected_effect": "—fora do catálogo fechado.",
            },
        ]
    }
    with pytest.raises(ConfigError) as excinfo:
        write_config(extra)
    assert "phone_farm" in str(excinfo.value)


def test_unknown_top_level_key_is_rejected(write_config) -> None:
    """Erro de digitação em seção falha nomeando a chave desconhecida."""

    with pytest.raises(ConfigError) as excinfo:
        write_config(MINIMAL_CONFIG, {"budgets": {"acquisition": 1.0}})
    assert "'budgets'" in str(excinfo.value)


# ---------------------------------------------------------------------------
# Rodadas: mínimo × máximo e conversão base (I-01)
# ---------------------------------------------------------------------------


def test_rounds_min_above_count_is_rejected(write_config) -> None:
    """O mínimo de rodadas não pode superar o máximo configurado."""

    with pytest.raises(ConfigError) as excinfo:
        write_config(MINIMAL_CONFIG, {"rounds": {"min": 4}})  # count = 3 na config mínima
    message = str(excinfo.value)
    assert "rounds.min" in message
    assert "rounds.count" in message


def test_base_conversion_requires_every_verification_level(write_config) -> None:
    """A tabela de conversão precisa cobrir todos os níveis de verificação."""

    with pytest.raises(ConfigError) as excinfo:
        write_config(MINIMAL_CONFIG, {"rounds": {"base_conversion": {"b1": 0.7}}})
    assert "b2" in str(excinfo.value)


def test_base_conversion_rejects_unknown_level(write_config) -> None:
    """Nível fora do vocabulário (``VerificationLevel``) é rejeitado."""

    overrides = {"rounds": {"base_conversion": {"b1": 0.7, "b2": 0.55, "b3": 0.5}}}
    with pytest.raises(ConfigError) as excinfo:
        write_config(MINIMAL_CONFIG, overrides)
    assert "b3" in str(excinfo.value)


def test_base_conversion_rejects_value_outside_unit_interval(write_config) -> None:
    """Fração fora de [0, 1] falha nomeando a chave e o esperado."""

    overrides = {"rounds": {"base_conversion": {"b1": 1.7, "b2": 0.55}}}
    with pytest.raises(ConfigError) as excinfo:
        write_config(MINIMAL_CONFIG, overrides)
    message = str(excinfo.value)
    assert "rounds.base_conversion.b1" in message
    assert "entre 0 e 1" in message


# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------


def test_optional_sections_have_defaults(write_config) -> None:
    """Sem as seções ``llm`` e ``outputs``, os defaults documentados valem (ADR-005 §6)."""

    loaded, _ = write_config()
    assert loaded.llm.provider == "anthropic"
    assert loaded.llm.model == "claude-sonnet-4"
    assert loaded.llm.temperature == 0.0
    assert loaded.llm.max_calls_per_round == 1
    assert loaded.outputs.events_jsonl is True
    assert loaded.outputs.metrics_csv is True
    assert loaded.outputs.redemptions_csv is True
    assert loaded.outputs.attempts_csv is True
    assert loaded.outputs.llm_transcript_json is False


def test_defaults_are_overridden_by_config(write_config) -> None:
    """Valores presentes na configuração sobrescrevem os defaults."""

    loaded, _ = write_config(MINIMAL_CONFIG, {"llm": {"provider": "groq", "temperature": 0.5}})
    assert loaded.llm.provider == "groq"
    assert loaded.llm.temperature == 0.5
    assert loaded.llm.max_calls_per_round == 1


# ---------------------------------------------------------------------------
# Hash e determinismo do carregamento
# ---------------------------------------------------------------------------


def test_config_hash_is_stable_and_sensitive(scenarios_path: Path, tmp_path: Path) -> None:
    """Mesma configuração ⇒ mesmo hash; mudança de valor ⇒ hash diferente (ADR-007 §3)."""

    first = load_config(scenarios_path)
    second = load_config(scenarios_path)
    assert first.hash == second.hash

    raw = json.loads(scenarios_path.read_text(encoding="utf-8"))
    raw["seeds"] = {**raw["seeds"], "master": raw["seeds"]["master"] + 1}
    other_path = tmp_path / "other.json"
    other_path.write_text(json.dumps(raw), encoding="utf-8")
    assert load_config(other_path).hash != first.hash


def test_config_hash_matches_helper(scenarios_path: Path) -> None:
    """O hash gravado na configuração vem do JSON canônico."""

    raw = json.loads(scenarios_path.read_text(encoding="utf-8"))
    raw.pop("$comment", None)
    assert load_config(scenarios_path).hash == config_hash(raw)


def test_missing_file_is_reported(tmp_path: Path) -> None:
    """Arquivo inexistente falha com mensagem clara."""

    with pytest.raises(ConfigError) as excinfo:
        load_config(tmp_path / "nao-existe.json")
    assert "não encontrado" in str(excinfo.value)


def test_malformed_json_is_reported(tmp_path: Path) -> None:
    """JSON malformado falha apontando o problema."""

    path = tmp_path / "broken.json"
    path.write_text("{ not json", encoding="utf-8")
    with pytest.raises(ConfigError) as excinfo:
        load_config(path)
    assert "JSON inválido" in str(excinfo.value)


def test_config_is_frozen(config: SimulationConfig) -> None:
    """A configuração carregada é imutável (estado não pode ser mutado à mão)."""

    with pytest.raises(FrozenInstanceError):
        config.budget.acquisition = 1.0  # type: ignore[misc]


def test_minimal_config_copy_is_independent(write_config) -> None:
    """As substituições nos fixtures não vazam para o dicionário base."""

    snapshot = copy.deepcopy(MINIMAL_CONFIG)
    write_config(MINIMAL_CONFIG, {"rounds": {"count": 5}})
    assert MINIMAL_CONFIG == snapshot
