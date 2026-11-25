"""Configuração do simulador: única fonte de parâmetros é ``config/scenarios.json`` (ADR-005).

O carregamento valida o esquema e falha com ``ConfigError`` nomeando a chave ausente
ou inválida e o valor esperado. Nenhum parâmetro de negócio fica hard-coded nos
módulos; os defaults abaixo existem apenas para chaves opcionais documentadas
(``llm`` e ``outputs``) e são sobrescritos pela configuração (ADR-005 §6).
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from models.enums import VerificationLevel

#: Seções obrigatórias do esquema (ADR-005 §3). ``llm`` e ``outputs`` são opcionais.
REQUIRED_SECTIONS: tuple[str, ...] = (
    "rounds",
    "budget",
    "coupon",
    "thresholds",
    "costs",
    "seeds",
    "modes",
    "tactics",
)
OPTIONAL_SECTIONS: tuple[str, ...] = ("llm", "outputs")

_RUN_MODES: tuple[str, ...] = ("deterministic", "adversarial_validation")
_SCENARIO_MODES: tuple[str, ...] = ("adaptive", "guided")
_DEFENSES: tuple[str, ...] = ("B1", "B2", "redesign")
_LLM_PROVIDERS: tuple[str, ...] = ("anthropic", "groq")


class ConfigError(ValueError):
    """Configuração ausente, malformada ou com valor fora do contrato."""


# ---------------------------------------------------------------------------
# Dataclasses tipadas
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RoundsConfig:
    """Coorte, horizonte das rodadas e conversão base por nível de verificação.

    ``count`` é o máximo de rodadas e ``min`` o mínimo garantido: o laço para
    em ``count`` ou quando nenhum lado muda nada, nunca antes de ``min``
    (plano revisado §7). ``base_conversion`` é a conversão da primeira compra
    da coorte legítima por nível de verificação (``"b1"``/``"b2"``) — o atrito
    da defesa se mede contra ela (Trabalho 1 §3).
    """

    count: int
    min: int
    days_per_round: int
    legit_customers: int
    shared_device_pct: float
    shared_address_pct: float
    abandonment_pct: float
    base_conversion: dict[str, float]


@dataclass(frozen=True)
class BudgetConfig:
    """Dois orçamentos separados, nunca somados (ADR-012 §1)."""

    acquisition: float
    attack: float


@dataclass(frozen=True)
class CouponConfig:
    """Parâmetros do cupom ``BEMVINDO``."""

    discount: float
    min_order: float
    commission_rate: float


@dataclass(frozen=True)
class BotThresholds:
    """Gatilho de recuo para A1 (ADR-012 §4)."""

    retreat_cost_per_approved: float
    safety_margin: float


@dataclass(frozen=True)
class Am3Thresholds:
    """Limites dos controles da AM3 (limite configurável, Trabalho 1 §6.4)."""

    attempt_limit: int
    attempt_window_hours: int
    probing_min_attempts: int


@dataclass(frozen=True)
class ThresholdsConfig:
    bot: BotThresholds
    am3: Am3Thresholds


@dataclass(frozen=True)
class CostsConfig:
    """Custo por tática, cobrado por tentativa (ADR-012 §2 e §3)."""

    charged_per_attempt: bool
    tactics: dict[str, float]


@dataclass(frozen=True)
class SeedsConfig:
    """Seed mestra e fluxos de aleatoriedade independentes (ADR-007 §1)."""

    master: int
    streams: tuple[str, ...]


@dataclass(frozen=True)
class ModesConfig:
    """Modos de execução e controles ligados/desligados."""

    run: str
    scenario: str
    defense: str
    generic_message: bool
    attempt_limit_on: bool
    probing_detection: bool
    contestation_channel: bool


@dataclass(frozen=True)
class TacticSpec:
    """Entrada do catálogo fechado de táticas (ADR-003 §1)."""

    id: str
    name: str
    signal: str
    description: str
    expected_effect: str


@dataclass(frozen=True)
class TacticsConfig:
    catalog: tuple[TacticSpec, ...]


@dataclass(frozen=True)
class LlmConfig:
    """Provedor e limites do LLM opcional (ADR-003; nenhum segredo aqui)."""

    provider: str = "anthropic"
    model: str = "claude-sonnet-4"
    temperature: float = 0.0
    max_calls_per_round: int = 1


@dataclass(frozen=True)
class OutputsConfig:
    """Arquivos gravados em ``saidas/runs/<run_id>/`` (ADR-005 §5)."""

    events_jsonl: bool = True
    metrics_csv: bool = True
    redemptions_csv: bool = True
    attempts_csv: bool = True
    llm_transcript_json: bool = False


@dataclass(frozen=True)
class SimulationConfig:
    """Configuração validada da execução."""

    rounds: RoundsConfig
    budget: BudgetConfig
    coupon: CouponConfig
    thresholds: ThresholdsConfig
    costs: CostsConfig
    seeds: SeedsConfig
    modes: ModesConfig
    tactics: TacticsConfig
    llm: LlmConfig
    outputs: OutputsConfig
    source_path: str
    hash: str


# ---------------------------------------------------------------------------
# Primitivas de validação
# ---------------------------------------------------------------------------


def _describe(value: Any) -> str:
    if isinstance(value, bool):
        return f"booleano {value}"
    if isinstance(value, (int, float)):
        return f"número {value}"
    if isinstance(value, str):
        return f"texto '{value}'"
    if isinstance(value, list):
        return f"lista de {len(value)} itens"
    if isinstance(value, dict):
        return f"objeto com chaves {sorted(value)}"
    if value is None:
        return "null"
    return type(value).__name__


def _section(raw: dict[str, Any], name: str, source: Path) -> dict[str, Any]:
    parts = name.split(".")
    node: Any = raw
    for index, part in enumerate(parts):
        if not isinstance(node, dict) or part not in node or node[part] is None:
            dotted = ".".join(parts[: index + 1])
            raise ConfigError(f"{source}: seção ausente '{dotted}' (esperado: objeto de configuração)")
        node = node[part]
    if not isinstance(node, dict):
        raise ConfigError(
            f"{source}: chave '{name}' inválida (esperado: objeto de configuração; obtido: {_describe(node)})"
        )
    return node


def _reject_unknown(raw: dict[str, Any], source: Path, owner: str, allowed: tuple[str, ...]) -> None:
    unknown = sorted(set(raw) - set(allowed))
    if unknown:
        prefix = f"{owner}." if owner else ""
        raise ConfigError(
            f"{source}: chave desconhecida '{prefix}{unknown[0]}' (esperadas: {', '.join(allowed)})"
        )


def _subsection(raw: dict[str, Any], name: str, owner: str, source: Path) -> dict[str, Any]:
    """Seção aninhada dentro de outra seção; reporta o caminho completo no erro."""

    return _subsection_impl(raw, name, f"{owner}.{name}", source)


def _subsection_impl(raw: dict[str, Any], name: str, dotted: str, source: Path) -> dict[str, Any]:
    value = raw.get(name)
    if value is None:
        raise ConfigError(f"{source}: seção ausente '{dotted}' (esperado: objeto de configuração)")
    if not isinstance(value, dict):
        raise ConfigError(
            f"{source}: chave '{dotted}' inválida (esperado: objeto de configuração; obtido: {_describe(value)})"
        )
    return value


def _expect(
    raw: dict[str, Any],
    source: Path,
    owner: str,
    key: str,
    check: Callable[[Any], bool],
    expected: str,
) -> Any:
    full_key = f"{owner}.{key}" if owner else key
    if key not in raw:
        raise ConfigError(f"{source}: chave ausente '{full_key}' (esperado: {expected})")
    value = raw[key]
    if not check(value):
        raise ConfigError(
            f"{source}: chave '{full_key}' inválida (esperado: {expected}; obtido: {_describe(value)})"
        )
    return value


def _optional(
    raw: dict[str, Any],
    source: Path,
    owner: str,
    key: str,
    check: Callable[[Any], bool],
    expected: str,
    default: Any,
) -> Any:
    full_key = f"{owner}.{key}" if owner else key
    value = raw.get(key, default)
    if not check(value):
        raise ConfigError(
            f"{source}: chave '{full_key}' inválida (esperado: {expected}; obtido: {_describe(value)})"
        )
    return value


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_bool(value: Any) -> bool:
    return isinstance(value, bool)


def _is_text(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


def _positive(value: Any) -> bool:
    return _is_number(value) and value > 0


def _non_negative(value: Any) -> bool:
    return _is_number(value) and value >= 0


def _pct(value: Any) -> bool:
    return _is_number(value) and 0 <= value <= 100


def _fraction(value: Any) -> bool:
    return _is_number(value) and 0 <= value <= 1


def _unit_interval(value: Any) -> bool:
    return _is_number(value) and 0 <= value <= 1


def _positive_int(value: Any) -> bool:
    return _is_int(value) and value >= 1


def _enum(options: tuple[str, ...]) -> Callable[[Any], bool]:
    return lambda value: isinstance(value, str) and value in options


def _enum_desc(options: tuple[str, ...]) -> str:
    return "um de " + ", ".join(options)


# ---------------------------------------------------------------------------
# Validadores por seção
# ---------------------------------------------------------------------------


def _parse_rounds(raw: dict[str, Any], source: Path) -> RoundsConfig:
    owner = "rounds"
    _reject_unknown(raw, source, owner, tuple(RoundsConfig.__dataclass_fields__))
    count = _expect(raw, source, owner, "count", _positive_int, "inteiro maior que zero")
    minimum = _expect(raw, source, owner, "min", _positive_int, "inteiro maior que zero")
    if minimum > count:
        raise ConfigError(
            f"{source}: chave 'rounds.min' inválida (esperado: inteiro menor ou igual a "
            f"'rounds.count'; obtido: {minimum} maior que {count})"
        )
    conversion_raw = _subsection(raw, "base_conversion", owner, source)
    levels = tuple(sorted(level.value for level in VerificationLevel))
    _reject_unknown(conversion_raw, source, f"{owner}.base_conversion", levels)
    base_conversion = {
        level: _expect(conversion_raw, source, f"{owner}.base_conversion", level, _fraction, "fração entre 0 e 1")
        for level in levels
    }
    return RoundsConfig(
        count=count,
        min=minimum,
        days_per_round=_expect(raw, source, owner, "days_per_round", _positive_int, "inteiro maior que zero"),
        legit_customers=_expect(raw, source, owner, "legit_customers", _non_negative, "número maior ou igual a zero"),
        shared_device_pct=_expect(raw, source, owner, "shared_device_pct", _pct, "percentual entre 0 e 100"),
        shared_address_pct=_expect(raw, source, owner, "shared_address_pct", _pct, "percentual entre 0 e 100"),
        abandonment_pct=_expect(raw, source, owner, "abandonment_pct", _pct, "percentual entre 0 e 100"),
        base_conversion=base_conversion,
    )


def _parse_budget(raw: dict[str, Any], source: Path) -> BudgetConfig:
    owner = "budget"
    _reject_unknown(raw, source, owner, tuple(BudgetConfig.__dataclass_fields__))
    return BudgetConfig(
        acquisition=_expect(raw, source, owner, "acquisition", _positive, "número maior que zero"),
        attack=_expect(raw, source, owner, "attack", _non_negative, "número maior ou igual a zero"),
    )


def _parse_coupon(raw: dict[str, Any], source: Path) -> CouponConfig:
    owner = "coupon"
    _reject_unknown(raw, source, owner, tuple(CouponConfig.__dataclass_fields__))
    return CouponConfig(
        discount=_expect(raw, source, owner, "discount", _positive, "número maior que zero"),
        min_order=_expect(raw, source, owner, "min_order", _non_negative, "número maior ou igual a zero"),
        commission_rate=_expect(raw, source, owner, "commission_rate", _fraction, "fração entre 0 e 1"),
    )


def _parse_thresholds(raw: dict[str, Any], source: Path) -> ThresholdsConfig:
    owner = "thresholds"
    _reject_unknown(raw, source, owner, ("bot", "am3"))
    bot_raw = _subsection(raw, "bot", owner, source)
    _reject_unknown(bot_raw, source, f"{owner}.bot", tuple(BotThresholds.__dataclass_fields__))
    bot = BotThresholds(
        retreat_cost_per_approved=_expect(
            bot_raw, source, f"{owner}.bot", "retreat_cost_per_approved", _non_negative,
            "número maior ou igual a zero",
        ),
        safety_margin=_expect(
            bot_raw, source, f"{owner}.bot", "safety_margin", _unit_interval, "fração entre 0 e 1"
        ),
    )
    am3_raw = _subsection(raw, "am3", owner, source)
    _reject_unknown(am3_raw, source, f"{owner}.am3", tuple(Am3Thresholds.__dataclass_fields__))
    am3 = Am3Thresholds(
        attempt_limit=_expect(
            am3_raw, source, f"{owner}.am3", "attempt_limit", _positive_int, "inteiro maior que zero"
        ),
        attempt_window_hours=_expect(
            am3_raw, source, f"{owner}.am3", "attempt_window_hours", _positive_int, "inteiro maior que zero"
        ),
        probing_min_attempts=_expect(
            am3_raw, source, f"{owner}.am3", "probing_min_attempts", _positive_int, "inteiro maior que zero"
        ),
    )
    return ThresholdsConfig(bot=bot, am3=am3)


def _parse_costs(raw: dict[str, Any], source: Path) -> CostsConfig:
    owner = "costs"
    _reject_unknown(raw, source, owner, tuple(CostsConfig.__dataclass_fields__))
    tactics_raw = _subsection(raw, "tactics", owner, source)
    if not tactics_raw:
        raise ConfigError(
            f"{source}: seção vazia 'costs.tactics' (esperado: custo por tática do catálogo)"
        )
    tactics = {
        tactic_id: _expect(tactics_raw, source, "costs.tactics", tactic_id, _non_negative, "número maior ou igual a zero")
        for tactic_id in sorted(tactics_raw)
    }
    return CostsConfig(
        charged_per_attempt=_expect(
            raw, source, owner, "charged_per_attempt", _is_bool, "booleano (custo por tentativa)"
        ),
        tactics=tactics,
    )


def _parse_seeds(raw: dict[str, Any], source: Path) -> SeedsConfig:
    owner = "seeds"
    _reject_unknown(raw, source, owner, tuple(SeedsConfig.__dataclass_fields__))
    streams = _expect(
        raw, source, owner, "streams",
        lambda v: isinstance(v, list) and all(_is_text(s) for s in v) and len(v) >= 1,
        "lista de nomes de fluxo não vazia",
    )
    return SeedsConfig(
        master=_expect(raw, source, owner, "master", _is_int, "número inteiro"),
        streams=tuple(streams),
    )


def _parse_modes(raw: dict[str, Any], source: Path) -> ModesConfig:
    owner = "modes"
    _reject_unknown(raw, source, owner, tuple(ModesConfig.__dataclass_fields__))
    return ModesConfig(
        run=_expect(raw, source, owner, "run", _enum(_RUN_MODES), _enum_desc(_RUN_MODES)),
        scenario=_expect(raw, source, owner, "scenario", _enum(_SCENARIO_MODES), _enum_desc(_SCENARIO_MODES)),
        defense=_expect(raw, source, owner, "defense", _enum(_DEFENSES), _enum_desc(_DEFENSES)),
        generic_message=_expect(raw, source, owner, "generic_message", _is_bool, "booleano"),
        attempt_limit_on=_expect(raw, source, owner, "attempt_limit_on", _is_bool, "booleano"),
        probing_detection=_expect(raw, source, owner, "probing_detection", _is_bool, "booleano"),
        contestation_channel=_expect(raw, source, owner, "contestation_channel", _is_bool, "booleano"),
    )


def _parse_tactics(raw: dict[str, Any], source: Path) -> TacticsConfig:
    owner = "tactics"
    _reject_unknown(raw, source, owner, ("catalog",))
    catalog_raw = _expect(
        raw, source, owner, "catalog",
        lambda v: isinstance(v, list) and len(v) >= 1,
        "lista de táticas não vazia",
    )
    seen: set[str] = set()
    specs: list[TacticSpec] = []
    for index, entry in enumerate(catalog_raw):
        key = f"{owner}.catalog[{index}]"
        if not isinstance(entry, dict):
            raise ConfigError(
                f"{source}: chave '{key}' inválida (esperado: objeto de tática; obtido: {_describe(entry)})"
            )
        _reject_unknown(entry, source, key, tuple(TacticSpec.__dataclass_fields__))
        tactic_id = _expect(entry, source, key, "id", _is_text, "texto não vazio")
        if tactic_id in seen:
            raise ConfigError(
                f"{source}: chave '{key}.id' duplicada (esperado: id único no catálogo; obtido: '{tactic_id}')"
            )
        seen.add(tactic_id)
        specs.append(
            TacticSpec(
                id=tactic_id,
                name=_expect(entry, source, key, "name", _is_text, "texto não vazio"),
                signal=_expect(entry, source, key, "signal", _is_text, "texto não vazio"),
                description=_expect(entry, source, key, "description", _is_text, "texto não vazio"),
                expected_effect=_expect(entry, source, key, "expected_effect", _is_text, "texto não vazio"),
            )
        )
    return TacticsConfig(catalog=tuple(specs))


def _parse_llm(raw: dict[str, Any], source: Path) -> LlmConfig:
    owner = "llm"
    _reject_unknown(raw, source, owner, tuple(LlmConfig.__dataclass_fields__))
    return LlmConfig(
        provider=_optional(raw, source, owner, "provider", _enum(_LLM_PROVIDERS), _enum_desc(_LLM_PROVIDERS), "anthropic"),
        model=_optional(raw, source, owner, "model", _is_text, "texto não vazio", "claude-sonnet-4"),
        temperature=_optional(raw, source, owner, "temperature", _unit_interval, "fração entre 0 e 1", 0.0),
        max_calls_per_round=_optional(
            raw, source, owner, "max_calls_per_round", _positive_int, "inteiro maior que zero", 1
        ),
    )


def _parse_outputs(raw: dict[str, Any], source: Path) -> OutputsConfig:
    owner = "outputs"
    _reject_unknown(raw, source, owner, tuple(OutputsConfig.__dataclass_fields__))
    return OutputsConfig(
        events_jsonl=_optional(raw, source, owner, "events_jsonl", _is_bool, "booleano", True),
        metrics_csv=_optional(raw, source, owner, "metrics_csv", _is_bool, "booleano", True),
        redemptions_csv=_optional(raw, source, owner, "redemptions_csv", _is_bool, "booleano", True),
        attempts_csv=_optional(raw, source, owner, "attempts_csv", _is_bool, "booleano", True),
        llm_transcript_json=_optional(raw, source, owner, "llm_transcript_json", _is_bool, "booleano", False),
    )


# ---------------------------------------------------------------------------
# Carregamento
# ---------------------------------------------------------------------------


def config_hash(raw: dict[str, Any]) -> str:
    """Hash canônico da configuração (ADR-007 §3): SHA-256 do JSON com chaves ordenadas."""

    canonical = json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def load_config(path: str | Path) -> SimulationConfig:
    """Lê e valida ``scenarios.json``, devolvendo a configuração tipada.

    Levanta ``ConfigError`` nomeando a chave ausente ou inválida e o valor esperado.
    """

    source = Path(path)
    if not source.is_file():
        raise ConfigError(f"{source}: arquivo de configuração não encontrado")

    try:
        raw = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{source}: JSON inválido (esperado: documento JSON válido; obtido: {exc})") from None

    if not isinstance(raw, dict):
        raise ConfigError(f"{source}: raiz inválida (esperado: objeto JSON; obtido: {_describe(raw)})")

    _reject_unknown(raw, source, "", REQUIRED_SECTIONS + OPTIONAL_SECTIONS + ("$comment",))

    costs = _parse_costs(_section(raw, "costs", source), source)
    tactics = _parse_tactics(_section(raw, "tactics", source), source)

    catalog_ids = {spec.id for spec in tactics.catalog}
    cost_ids = set(costs.tactics)
    if catalog_ids != cost_ids:
        missing_costs = sorted(catalog_ids - cost_ids)
        unknown_costs = sorted(cost_ids - catalog_ids)
        detail = (
            f"tática sem custo: {', '.join(missing_costs)}" if missing_costs
            else f"custo sem tática no catálogo: {', '.join(unknown_costs)}"
        )
        raise ConfigError(
            f"{source}: catálogo e custos divergem (esperado: mesmo conjunto de ids em "
            f"'tactics.catalog' e 'costs.tactics'; obtido: {detail})"
        )

    llm_raw = raw.get("llm", {})
    outputs_raw = raw.get("outputs", {})
    for name, section_raw in (("llm", llm_raw), ("outputs", outputs_raw)):
        if section_raw is None:
            raise ConfigError(f"{source}: chave '{name}' inválida (esperado: objeto de configuração; obtido: null)")
        if not isinstance(section_raw, dict):
            raise ConfigError(
                f"{source}: chave '{name}' inválida (esperado: objeto de configuração; obtido: {_describe(section_raw)})"
            )

    return SimulationConfig(
        rounds=_parse_rounds(_section(raw, "rounds", source), source),
        budget=_parse_budget(_section(raw, "budget", source), source),
        coupon=_parse_coupon(_section(raw, "coupon", source), source),
        thresholds=_parse_thresholds(_section(raw, "thresholds", source), source),
        costs=costs,
        seeds=_parse_seeds(_section(raw, "seeds", source), source),
        modes=_parse_modes(_section(raw, "modes", source), source),
        tactics=tactics,
        llm=_parse_llm(llm_raw, source),
        outputs=_parse_outputs(outputs_raw, source),
        source_path=str(source),
        hash=config_hash({key: value for key, value in raw.items() if key != "$comment"}),
    )
