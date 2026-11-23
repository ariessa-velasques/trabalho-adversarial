"""Fixtures compartilhadas da suíte offline (ADR-009).

Nenhum teste da suíte padrão depende de rede ou de chave de LLM. Testes que usam
LLM são marcados com ``@pytest.mark.llm`` e pulados sem chave.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from models.config import SimulationConfig, load_config

REPO_ROOT = Path(__file__).resolve().parents[1]

#: Configuração mínima válida: seções obrigatórias, sem as opcionais (llm, outputs).
MINIMAL_CONFIG: dict[str, object] = {
    "rounds": {
        "count": 3,
        "days_per_round": 7,
        "legit_customers": 10,
        "shared_device_pct": 0,
        "shared_address_pct": 0,
        "abandonment_pct": 0,
    },
    "budget": {"acquisition": 1000.0, "attack": 100.0},
    "coupon": {"discount": 20.0, "min_order": 30.0, "commission_rate": 0.2},
    "thresholds": {
        "bot": {"retreat_cost_per_approved": 20.0, "safety_margin": 0.0},
        "am3": {"attempt_limit": 3, "attempt_window_hours": 24, "probing_min_attempts": 3},
    },
    "costs": {
        "charged_per_attempt": True,
        "tactics": {"email_disposable": 0.0, "virtual_sms_cpf": 5.0, "emulator_address": 12.0},
    },
    "seeds": {"master": 7, "streams": ["scenarios", "bot", "engine", "review", "costs"]},
    "modes": {
        "run": "deterministic",
        "scenario": "guided",
        "defense": "redesign",
        "generic_message": True,
        "attempt_limit_on": True,
        "probing_detection": True,
        "contestation_channel": True,
    },
    "tactics": {
        "catalog": [
            {
                "id": "email_disposable",
                "name": "AM1 · e-mail descartável",
                "signal": "disposable_email",
                "description": "Cadastro com e-mail descartável.",
                "expected_effect": "Aprovação sob B1.",
            },
            {
                "id": "virtual_sms_cpf",
                "name": "AM2 · SMS virtual + CPF",
                "signal": "virtual_sms_cpf",
                "description": "Número virtual de SMS e CPF vazado.",
                "expected_effect": "Aprovação sob B2.",
            },
            {
                "id": "emulator_address",
                "name": "Extensão · emulador + endereço",
                "signal": "emulator_address",
                "description": "Emulador com novo device ID.",
                "expected_effect": "Eleva o custo por conta aprovada.",
            },
        ]
    },
}


@pytest.fixture()
def scenarios_path() -> Path:
    """Caminho do ``scenarios.json`` versionado na raiz do repositório."""

    return REPO_ROOT / "config" / "scenarios.json"


@pytest.fixture()
def config(scenarios_path: Path) -> SimulationConfig:
    """Configuração canônica do repositório, carregada e validada."""

    return load_config(scenarios_path)


@pytest.fixture()
def write_config(tmp_path: Path):
    """Grava um dicionário como JSON e devolve a configuração carregada.

    Uso: ``write_config({"rounds": ..., ...})`` ou com substituições parciais
    via ``write_config(base, overrides)``.
    """

    def _write(
        payload: dict[str, object] | None = None,
        overrides: dict[str, object] | None = None,
    ) -> tuple[SimulationConfig, Path]:
        raw = dict(MINIMAL_CONFIG if payload is None else payload)
        if overrides:
            for key, value in overrides.items():
                if isinstance(value, dict) and isinstance(raw.get(key), dict):
                    raw[key] = {**raw[key], **value}  # type: ignore[index]
                else:
                    raw[key] = value
        path = tmp_path / "scenarios.json"
        path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
        return load_config(path), path

    return _write


@pytest.fixture()
def rng_seed(config: SimulationConfig) -> int:
    """Seed mestra para geradores de aleatoriedade (ADR-007 §1)."""

    return config.seeds.master


@pytest.fixture()
def run_id(config: SimulationConfig) -> str:
    """Identificador de execução amarrado ao hash da configuração (ADR-007 §3)."""

    return f"run_test_{config.hash[:8]}"
