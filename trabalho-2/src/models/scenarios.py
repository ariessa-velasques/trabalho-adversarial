"""Populações sintéticas das rodadas: contas do bot e coorte legítima (ADR-011 §2.3).

Cada rodada mistura contas do bot com uma coorte de clientes novos legítimos
que passa pelo mesmo checkout. É a coorte que produz os falsos positivos e a
queda de conversão (70% → 55%) que dão custo real à defesa (Trabalho 1 §3) —
e é aqui que o pressuposto **P3** aparece: famílias e repúblicas dividem
aparelho e endereço (Trabalho 1 §1.3), e colegas de trabalho dividem o
aparelho sem dividir o endereço. A regra que liga contas por dispositivo ou
endereço recusa, de vez em quando, um cliente legítimo real.

Perfis da coorte legítima (P3):

- ``single``: pessoa única, com aparelho e endereço próprios;
- ``family``: família que divide o endereço e, às vezes, um aparelho;
- ``shared_house``: república que divide o endereço e, às vezes, um aparelho;
- parte das pessoas únicas divide um aparelho de trabalho com colegas.

Parte da coorte pretende comprar acima do mínimo do cupom e parte abaixo —
quem compra abaixo de R$ 30 sofre o atrito da verificação sem poder resgatar
nada. A conversão base é configurável por nível de verificação
(``BASE_CONVERSION``: 70% em B1, 55% em B2) e o motor a usa para medir atrito
(``completes_first_purchase``).

A geração é determinística a partir da ``master_seed``: cada rodada usa um
fluxo próprio derivado do stream ``scenarios`` (ADR-007 §1), de modo que gerar
a rodada 3 não depende de gerar antes as rodadas 1 e 2. Os identificadores
sintéticos saem de pools embaralhados pela própria seed, e nenhuma ordenação
depende de ``set`` ou ``dict`` não ordenado (ADR-007 §6).

Separação de informação (ADR-006 §4): este é o único módulo de domínio que
conhece os rótulos (``fraudulent``/``legitimate``) e o mapa pessoa↔conta.
Ambos vivem em ``GroundTruth``, estrutura separada da população e consumida
somente por ``evaluation/``. A população pública (``RoundPopulation``) carrega
apenas o que bot e motor observariam: contas, sinais e pedidos — o motor vê
cadastros na ordem em que ocorrem, nunca marcados; o bot conhece as próprias
contas; quem separa os fluxos é o controller.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType
from typing import Mapping

from models.config import SimulationConfig
from models.entities import Account
from models.enums import VerificationLevel

#: Nome do stream de aleatoriedade dos cenários (ADR-007 §1).
STREAM = "scenarios"

#: Pessoa sintética única por trás de todas as contas do bot — o fraudador é
#: um jogador só (Trabalho 1 §3); o mapa pessoa↔conta revela isso ao avaliador.
FRAUD_PERSON_ID = "person_fraud"

#: Conversão base da primeira compra por nível de verificação (Trabalho 1 §3):
#: 70% em B1; a verificação rígida derruba para 55%. O redesenho da seção 5
#: herda a base de B2 — os controles da AM3 modulam o atrito além desta base.
BASE_CONVERSION: Mapping[VerificationLevel, float] = MappingProxyType(
    {
        VerificationLevel.B1: 0.70,
        VerificationLevel.B2: 0.55,
    }
)

#: Fração da coorte legítima que pretende comprar acima do mínimo do cupom;
#: as demais pedem abaixo de R$ 30 e não têm resgate a perder.
ABOVE_MIN_ORDER_SHARE = 0.65

#: Entre os domicílios com endereço compartilhado, fração que é família
#: (o restante é república).
FAMILY_SHARE_OF_SHARED = 0.60

#: Pedido legítimo acima do mínimo: R$ 30,01 a R$ 120,00 (em centavos).
_LEGIT_ABOVE_CENTS = (3001, 12000)
#: Pedido legítimo abaixo do mínimo: R$ 5,00 a R$ 30,00 — R$ 30,00 exato é a
#: borda inelegível e entra na coorte de propósito (AGENTS.md §6).
_LEGIT_BELOW_CENTS = (500, 3000)
#: Pedido do bot: sempre acima do mínimo — conta que pede abaixo de R$ 30 não
#: resgata nada e não otimiza o ataque.
_BOT_ORDER_CENTS = (3001, 9000)


# ---------------------------------------------------------------------------
# Vocabulário dos cenários
# ---------------------------------------------------------------------------


class CohortProfile(StrEnum):
    """Perfil demográfico da pessoa legítima (Trabalho 1 §1.3, P3).

    Dado do avaliador: explicar por que duas contas dividem aparelho é dizer
    que elas são de pessoas diferentes — o motor não pode receber isso pronto.
    """

    SINGLE = "single"
    FAMILY = "family"
    SHARED_HOUSE = "shared_house"


class Label(StrEnum):
    """Rótulo de verdade de campo, exclusivo do avaliador (ADR-006 §1).

    Nunca projetado ao bot, ao motor ou à revisão: as métricas de falsos
    positivos e falsos negativos só existem dentro de ``evaluation/``.
    """

    FRAUDULENT = "fraudulent"
    LEGITIMATE = "legitimate"


#: Faixas de tamanho: família de 2 a 4 pessoas; república de 3 a 6.
_HOUSEHOLD_SIZES: dict[CohortProfile, tuple[int, int]] = {
    CohortProfile.FAMILY: (2, 4),
    CohortProfile.SHARED_HOUSE: (3, 6),
}

#: Fração da meta de aparelho compartilhado reservada a grupos de trabalho
#: entre pessoas únicas — garante o caso "divide o aparelho, não o endereço".
_WORKGROUP_SHARE_OF_DEVICE_TARGET = 0.40

#: Colegas de trabalho dividem um aparelho (o computador do escritório) sem
#: dividir endereço: P3 falha também nesse sentido (Trabalho 1 §1.3).
_WORKGROUP_SIZES = (2, 3)


# ---------------------------------------------------------------------------
# Validação estrutural
# ---------------------------------------------------------------------------


def _require_text(value: str, name: str) -> None:
    """Falha se o texto for vazio ou só espaços."""

    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name}: esperado texto não vazio")


def _require_positive_int(value: int, name: str) -> None:
    """Falha se o valor não for inteiro maior ou igual a 1."""

    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"{name}: esperado inteiro maior ou igual a 1")


def _require_non_negative_int(value: int, name: str) -> None:
    """Falha se o valor não for inteiro maior ou igual a 0."""

    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"{name}: esperado inteiro maior ou igual a 0")


def _require_positive_number(value: float, name: str) -> None:
    """Falha se o valor não for número finito estritamente positivo."""

    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{name}: esperado número")
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name}: esperado número finito maior que zero")


def _require_unit_interval(value: float, name: str) -> None:
    """Falha se o valor não estiver em [0, 1)."""

    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{name}: esperado número")
    if not math.isfinite(value) or not 0 <= value < 1:
        raise ValueError(f"{name}: esperado número em [0, 1)")


# ---------------------------------------------------------------------------
# Planos de checkout da população pública
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BotPlan:
    """Conta planejada pelo bot na rodada, com o pedido pretendido.

    O volume e a tática são decisão do bot (ADR-011 §2.2); este módulo apenas
    materializa as identidades sintéticas da rodada. O pedido nasce acima do
    mínimo do cupom: é o resgate que interessa ao ataque.
    """

    account: Account
    order_value: float

    def __post_init__(self) -> None:
        if not isinstance(self.account, Account):
            raise ValueError("account: esperado Account de models/entities.py")
        _require_positive_number(self.order_value, "order_value")


@dataclass(frozen=True)
class LegitPlan:
    """Cliente legítimo da coorte, com pedido pretendido e sorteio de conversão.

    ``conversion_draw`` é o único estado de atrito: a primeira compra é
    concluída quando o sorteio fica abaixo da conversão base do nível de
    verificação vigente (``completes_first_purchase``). Como 0.55 < 0.70, as
    conclusões sob B2 formam um subconjunto estrito das conclusões sob B1 —
    verificação extra só adiciona abandono, nunca recupera cliente.
    """

    account: Account
    order_value: float
    conversion_draw: float

    def __post_init__(self) -> None:
        if not isinstance(self.account, Account):
            raise ValueError("account: esperado Account de models/entities.py")
        _require_positive_number(self.order_value, "order_value")
        _require_unit_interval(self.conversion_draw, "conversion_draw")


@dataclass(frozen=True)
class RoundPopulation:
    """População pública da rodada: bot e coorte legítima, sem rótulos.

    A separação ``bot`` × ``legit`` existe para o controller rotear as
    tentativas — o bot conhece as próprias contas (ADR-011 §4). Nada daqui
    chega ao motor marcado: o motor vê cadastros e pedidos na ordem em que
    ocorrem, e quem intercala os fluxos é o executor.
    """

    round_number: int
    bot: tuple[BotPlan, ...]
    legit: tuple[LegitPlan, ...]

    def __post_init__(self) -> None:
        _require_positive_int(self.round_number, "round_number")
        for plan in self.bot:
            if not isinstance(plan, BotPlan):
                raise ValueError("bot: esperado BotPlan")
        for plan in self.legit:
            if not isinstance(plan, LegitPlan):
                raise ValueError("legit: esperado LegitPlan")
        account_ids = [plan.account.account_id for plan in (*self.bot, *self.legit)]
        if len(account_ids) != len(set(account_ids)):
            raise ValueError("round population: contas repetidas na população da rodada")


# ---------------------------------------------------------------------------
# Verdade de campo (exclusiva do avaliador — ADR-006 §4)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GroundTruth:
    """Rótulos e mapa pessoa↔conta da rodada (ADR-006 §4).

    Estrutura separada da população, consumida somente por ``evaluation/``:
    nunca projetada ao bot, ao motor ou à revisão. ``labels`` mapeia cada
    conta ao seu rótulo de verdade; ``accounts_by_person`` e
    ``person_of_account`` são inversos um do outro; ``profile_of_person``
    guarda o perfil demográfico das pessoas legítimas (o fraudador não tem
    perfil de domicílio).
    """

    labels: Mapping[str, Label]
    accounts_by_person: Mapping[str, tuple[str, ...]]
    person_of_account: Mapping[str, str]
    profile_of_person: Mapping[str, CohortProfile]

    def __post_init__(self) -> None:
        labels = dict(self.labels)
        accounts_by_person = {
            person: tuple(accounts) for person, accounts in self.accounts_by_person.items()
        }
        person_of_account = dict(self.person_of_account)
        profile_of_person = dict(self.profile_of_person)

        for account_id, label in labels.items():
            _require_text(account_id, "labels chave (account_id)")
            if not isinstance(label, Label):
                raise ValueError(f"labels[{account_id!r}]: esperado Label, obtido {label!r}")
        for person, accounts in accounts_by_person.items():
            _require_text(person, "accounts_by_person chave (person_id)")
            if not accounts:
                raise ValueError(f"accounts_by_person[{person!r}]: pessoa sem conta no mapa")
            if len(set(accounts)) != len(accounts):
                raise ValueError(f"accounts_by_person[{person!r}]: contas repetidas")
        for account_id, person in person_of_account.items():
            _require_text(account_id, "person_of_account chave (account_id)")
            _require_text(person, "person_of_account valor (person_id)")
        for person, profile in profile_of_person.items():
            _require_text(person, "profile_of_person chave (person_id)")
            if not isinstance(profile, CohortProfile):
                raise ValueError(
                    f"profile_of_person[{person!r}]: esperado CohortProfile, obtido {profile!r}"
                )

        mapped = sorted(
            account for accounts in accounts_by_person.values() for account in accounts
        )
        if mapped != sorted(labels):
            raise ValueError(
                "ground truth: rótulos e mapa pessoa↔conta cobrem conjuntos de contas distintos"
            )
        inverse = {
            account: person
            for person, accounts in accounts_by_person.items()
            for account in accounts
        }
        if inverse != person_of_account:
            raise ValueError(
                "ground truth: person_of_account diverge do inverso de accounts_by_person"
            )
        unknown = sorted(set(profile_of_person) - set(accounts_by_person))
        if unknown:
            raise ValueError(f"profile_of_person: pessoa sem conta no mapa: {unknown[0]!r}")

        object.__setattr__(self, "labels", MappingProxyType(labels))
        object.__setattr__(
            self,
            "accounts_by_person",
            MappingProxyType(
                {person: tuple(sorted(accounts)) for person, accounts in accounts_by_person.items()}
            ),
        )
        object.__setattr__(self, "person_of_account", MappingProxyType(person_of_account))
        object.__setattr__(self, "profile_of_person", MappingProxyType(profile_of_person))


@dataclass(frozen=True)
class RoundScenario:
    """Cenário completo da rodada: população pública + verdade de campo.

    O controller consome ``population`` para executar a rodada e entrega
    ``ground_truth`` somente ao avaliador, junto dos eventos (ADR-011 §2.6).
    """

    round_number: int
    population: RoundPopulation
    ground_truth: GroundTruth

    def __post_init__(self) -> None:
        _require_positive_int(self.round_number, "round_number")
        if not isinstance(self.population, RoundPopulation):
            raise ValueError("population: esperado RoundPopulation")
        if not isinstance(self.ground_truth, GroundTruth):
            raise ValueError("ground_truth: esperado GroundTruth")
        if self.population.round_number != self.round_number:
            raise ValueError("round_number: diverge da população da rodada")
        population_ids = {
            plan.account.account_id for plan in (*self.population.bot, *self.population.legit)
        }
        if set(self.ground_truth.labels) != population_ids:
            raise ValueError("ground truth: rótulos não cobrem exatamente a população da rodada")


# ---------------------------------------------------------------------------
# Atrito do checkout: conversão base por nível de verificação
# ---------------------------------------------------------------------------


def completes_first_purchase(
    plan: LegitPlan,
    verification_level: VerificationLevel,
    *,
    base_conversion: Mapping[VerificationLevel, float] | None = None,
) -> bool:
    """O cliente legítimo conclui a primeira compra sob o nível vigente?

    Ponto único onde a conversão base vira atrito (Trabalho 1 §3): sob B1 a
    coorte converte 70%; sob B2, 55%. O motor compara a conversão observada
    com esta base para medir o atrito da própria política. O sorteio é da
    geração da coorte — o resultado é determinístico por seed (ADR-007).
    """

    if not isinstance(plan, LegitPlan):
        raise ValueError("plan: esperado LegitPlan de models/scenarios.py")
    if not isinstance(verification_level, VerificationLevel):
        raise ValueError("verification_level: esperado VerificationLevel")
    table = BASE_CONVERSION if base_conversion is None else base_conversion
    if verification_level not in table:
        raise ValueError(
            f"base_conversion: sem conversão base para {verification_level.value!r}"
        )
    return plan.conversion_draw < table[verification_level]


# ---------------------------------------------------------------------------
# Geração determinística (ADR-007 §1)
# ---------------------------------------------------------------------------


def scenarios_rng(master_seed: int, round_number: int) -> random.Random:
    """Fluxo de aleatoriedade da rodada, derivado da seed mestra (ADR-007 §1).

    Fluxos por rodada, não um gerador global: gerar a rodada 3 sozinha dá
    exatamente o mesmo resultado de gerá-la depois das rodadas 1 e 2.
    """

    return random.Random(f"{master_seed}:{STREAM}:round:{round_number}")


@dataclass
class _Household:
    """Domicílio provisório da coorte (antes da atribuição de ids)."""

    profile: CohortProfile
    member_count: int
    shares_device: bool = False


@dataclass
class _Member:
    """Pessoa provisória da coorte (antes da atribuição de ids)."""

    profile: CohortProfile
    household_index: int
    device_group: int | None
    order_value: float
    conversion_draw: float


@dataclass
class _LegitCohort:
    """Coorte legítima provisória, sem identificadores definitivos."""

    members: list[_Member]
    household_count: int
    device_group_count: int


@dataclass
class _BotSeed:
    """Identidade provisória de uma conta do bot (antes da atribuição de ids)."""

    signals: frozenset[str]
    order_value: float


def _draw_shared_households(rng: random.Random, *, shared_target: int) -> list[_Household]:
    """Domicílios multi-pessoa até cobrir a meta de endereço compartilhado.

    Sobra menor que 2 pessoas não divide endereço e volta para o grupo das
    pessoas únicas — 1 pessoa não forma domicílio compartilhado.
    """

    households: list[_Household] = []
    assigned = 0
    while assigned + 2 <= shared_target:
        is_family = rng.random() < FAMILY_SHARE_OF_SHARED
        profile = CohortProfile.FAMILY if is_family else CohortProfile.SHARED_HOUSE
        low, high = _HOUSEHOLD_SIZES[profile]
        size = min(rng.randint(low, high), shared_target - assigned)
        households.append(_Household(profile=profile, member_count=size))
        assigned += size
    return households


def _draw_order_value(rng: random.Random) -> float:
    """Pedido pretendido de um legítimo: acima ou abaixo do mínimo do cupom."""

    if rng.random() < ABOVE_MIN_ORDER_SHARE:
        return rng.randint(*_LEGIT_ABOVE_CENTS) / 100
    return rng.randint(*_LEGIT_BELOW_CENTS) / 100


def _draw_legit_cohort(
    rng: random.Random,
    *,
    count: int,
    shared_device_pct: float,
    shared_address_pct: float,
) -> _LegitCohort:
    """Desenha a coorte legítima da rodada: perfis, grupos e pedidos.

    Metas derivadas da configuração: ``shared_address_pct`` das pessoas mora
    em domicílio multi-pessoa (família ou república) e compartilha endereço;
    ``shared_device_pct`` compartilha aparelho — parte dentro do domicílio
    (o tablet da família) e parte entre pessoas únicas (colegas de trabalho).
    """

    if count <= 0:
        return _LegitCohort(members=[], household_count=0, device_group_count=0)

    shared_address_target = round(count * shared_address_pct / 100)
    shared_device_target = round(count * shared_device_pct / 100)

    # Parte da meta de aparelho fica reservada a grupos de trabalho entre
    # pessoas únicas; o resto é distribuído dentro dos domicílios.
    workgroup_target = round(shared_device_target * _WORKGROUP_SHARE_OF_DEVICE_TARGET)
    household_device_budget = shared_device_target - workgroup_target

    shared = _draw_shared_households(rng, shared_target=shared_address_target)
    shared_members = sum(household.member_count for household in shared)
    single_count = count - shared_members

    # Aparelho compartilhado dentro de parte dos domicílios multi-pessoa.
    device_probability = (
        min(1.0, household_device_budget / shared_members) if shared_members else 0.0
    )
    covered = 0
    for household in shared:
        if covered < household_device_budget and rng.random() < device_probability:
            household.shares_device = True
            covered += household.member_count

    # Domicílios de pessoa única fecham a coorte (endereço e aparelho próprios).
    households = shared + [
        _Household(profile=CohortProfile.SINGLE, member_count=1) for _ in range(single_count)
    ]

    # Grupos de aparelho entre pessoas únicas: dividem o aparelho, não o
    # endereço (colegas de trabalho — P3 falha nesse sentido também).
    workgroup_sizes: list[int] = []
    remaining = single_count
    while covered < shared_device_target and remaining >= min(_WORKGROUP_SIZES):
        low, high = _WORKGROUP_SIZES
        size = min(rng.randint(low, high), remaining)
        workgroup_sizes.append(size)
        remaining -= size
        covered += size

    # Membros na ordem fixa dos domicílios; pedidos e sorteio de conversão
    # na mesma ordem — a sequência de consumo do rng é determinística.
    members: list[_Member] = []
    for index, household in enumerate(households):
        for _ in range(household.member_count):
            members.append(
                _Member(
                    profile=household.profile,
                    household_index=index,
                    device_group=None,
                    order_value=_draw_order_value(rng),
                    conversion_draw=rng.random(),
                )
            )

    # Grupos de aparelho: primeiro os domicílios marcados, depois os grupos
    # de trabalho entre pessoas únicas.
    group_count = 0
    group_of_household: dict[int, int] = {}
    for index, household in enumerate(shared):
        if household.shares_device:
            group_of_household[index] = group_count
            group_count += 1
    single_indices = [i for i, member in enumerate(members) if member.profile is CohortProfile.SINGLE]
    rng.shuffle(single_indices)
    cursor = 0
    for size in workgroup_sizes:
        group_index = group_count
        group_count += 1
        for i in single_indices[cursor : cursor + size]:
            members[i].device_group = group_index
        cursor += size
    for member in members:
        if member.profile is not CohortProfile.SINGLE:
            member.device_group = group_of_household.get(member.household_index)

    return _LegitCohort(
        members=members,
        household_count=len(households),
        device_group_count=group_count,
    )


def _draw_bot_seeds(rng: random.Random, *, count: int, tactic_signal: str) -> list[_BotSeed]:
    """Identidades provisórias do bot na rodada.

    Cada conta nasce com o sinal da tática escolhida e pedidos acima do
    mínimo. Aparelho e endereço vêm de pool compartilhado com a coorte e são
    únicos por conta — identidade nova a cada cadastro, o comportamento do
    emulador (config.tactics.catalog). Reuso deliberado de identidade é
    decisão de tática e cabe ao executor, não à geração da população.
    """

    return [
        _BotSeed(
            signals=frozenset({tactic_signal}),
            order_value=rng.randint(*_BOT_ORDER_CENTS) / 100,
        )
        for _ in range(count)
    ]


def generate_round_scenario(
    config: SimulationConfig,
    round_number: int,
    *,
    bot_count: int,
    tactic_signal: str,
) -> RoundScenario:
    """Gera a população da rodada e a verdade de campo correspondente.

    Determinística: mesma ``master_seed`` e mesmos parâmetros devolvem
    exatamente as mesmas contas, sinais, pedidos e rótulos (ADR-007). A
    coorte legítima é nova a cada rodada (clientes novos); o fraudador é a
    mesma pessoa em todas. ``tactic_signal`` é o sinal da tática escolhida
    pelo bot na rodada (``config.tactics.catalog``) e ``bot_count`` é o
    volume escolhido — decisões do bot, não da geração.

    Levanta ``ValueError`` em parâmetros inválidos ou configuração de outro
    tipo.
    """

    if not isinstance(config, SimulationConfig):
        raise ValueError(f"config: esperado SimulationConfig, obtido {type(config).__name__}")
    _require_positive_int(round_number, "round_number")
    _require_non_negative_int(bot_count, "bot_count")
    _require_text(tactic_signal, "tactic_signal")

    rng = scenarios_rng(config.seeds.master, round_number)
    rounds = config.rounds

    legit = _draw_legit_cohort(
        rng,
        count=rounds.legit_customers,
        shared_device_pct=rounds.shared_device_pct,
        shared_address_pct=rounds.shared_address_pct,
    )
    bot_seeds = _draw_bot_seeds(rng, count=bot_count, tactic_signal=tactic_signal)

    # Identificadores saem de pools embaralhados pela seed: a ordem dos ids
    # não revela quem é bot nem quem divide aparelho ou endereço com quem.
    total_accounts = len(legit.members) + len(bot_seeds)
    account_ids = [f"acc_r{round_number:02d}_{index:04d}" for index in range(total_accounts)]
    rng.shuffle(account_ids)
    device_ids = [
        f"d{index:04d}"
        for index in range(1, legit.device_group_count + len(legit.members) + len(bot_seeds) + 1)
    ]
    rng.shuffle(device_ids)
    address_ids = [
        f"e{index:04d}" for index in range(1, legit.household_count + len(bot_seeds) + 1)
    ]
    rng.shuffle(address_ids)

    labels: dict[str, Label] = {}
    accounts_by_person: dict[str, list[str]] = {}
    person_of_account: dict[str, str] = {}
    profile_of_person: dict[str, CohortProfile] = {}

    legit_plans: list[LegitPlan] = []
    for index, member in enumerate(legit.members):
        account_id = account_ids[index]
        signals = {
            f"device:{device_ids[legit.device_group_count + index]}",
            f"address:{address_ids[member.household_index]}",
        }
        if member.device_group is not None:
            signals.add(f"device:{device_ids[member.device_group]}")
        account = Account(account_id=account_id, signals=frozenset(signals))
        person_id = f"person_r{round_number:02d}_{index:04d}"
        legit_plans.append(
            LegitPlan(
                account=account,
                order_value=member.order_value,
                conversion_draw=member.conversion_draw,
            )
        )
        labels[account_id] = Label.LEGITIMATE
        accounts_by_person[person_id] = [account_id]
        person_of_account[account_id] = person_id
        profile_of_person[person_id] = member.profile

    bot_plans: list[BotPlan] = []
    device_offset = legit.device_group_count + len(legit.members)
    address_offset = legit.household_count
    for index, seed in enumerate(bot_seeds):
        account_id = account_ids[len(legit.members) + index]
        signals = set(seed.signals) | {
            f"device:{device_ids[device_offset + index]}",
            f"address:{address_ids[address_offset + index]}",
        }
        account = Account(account_id=account_id, signals=frozenset(signals))
        bot_plans.append(BotPlan(account=account, order_value=seed.order_value))
        labels[account_id] = Label.FRAUDULENT
        person_of_account[account_id] = FRAUD_PERSON_ID
        accounts_by_person.setdefault(FRAUD_PERSON_ID, []).append(account_id)

    population = RoundPopulation(
        round_number=round_number,
        bot=tuple(bot_plans),
        legit=tuple(legit_plans),
    )
    ground_truth = GroundTruth(
        labels=labels,
        accounts_by_person={
            person: tuple(accounts) for person, accounts in accounts_by_person.items()
        },
        person_of_account=person_of_account,
        profile_of_person=profile_of_person,
    )
    return RoundScenario(
        round_number=round_number,
        population=population,
        ground_truth=ground_truth,
    )
