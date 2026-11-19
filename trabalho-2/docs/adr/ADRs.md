# Architecture Decision Records (ADRs) — Trabalho 2

Este diretório registra as decisões de arquitetura e tecnologia do simulador adversarial do **PedeJá** (`trabalho-2`).
Cada ADR descreve o contexto, a decisão, as alternativas descartadas e as consequências, para que a escolha possa ser
defendida na apresentação e revisada depois.

## Como ler

- **Status:** `Proposta` (em discussão), `Aceita` (vale para o código), `Depreciada` (não vale mais) ou
  `Substituída por ADR-XXX`.
- **Uma decisão por ADR.** Se uma decisão mudar, cria-se uma nova ADR e marca-se a antiga como substituída; o histórico
  não é reescrito.
- **Rastreabilidade:** cada ADR referencia os requisitos do `Enunciado.md` e as seções/IDs do `Trabalho1.md` (`A1/A2`,
  `B1/B2`, `P1–P3`, `PE1–PE3`, `AM1–AM3`).

## Visão geral

```mermaid
graph TD
    UI["app.py → views/ (V)<br/>app, pages, components"] --> C["controllers/ (C)<br/>rounds, execution, results"]
    C --> M["models/ (M)<br/>entities, enums, config, rules, scenarios, checkout, events, observations"]
    C --> AG["agents/<br/>bot, engine, review, Agno"]
    AG --> M
    AV["evaluation/metrics.py"] --> M
    CFG["config/scenarios.json"] --> M
```

A view não importa `models/` nem `agents/`: recebe dados prontos do controller. `evaluation/` é o único consumidor dos
rótulos e do mapa pessoa↔conta.

## Estrutura de módulos (MVC simples)

A organização segue as ADR-010 e ADR-011: `models/` (M), `views/` (V) e `controllers/` (C). `agents/` e `evaluation/` ficam
fora do MVC porque são, respectivamente, atores de domínio e avaliador isolado. A árvore mantém o protótipo enxuto, mas
separa as responsabilidades que vão crescer (regras puras, páginas e componentes).

```text
trabalho-2/
├── app.py                          # entrypoint: streamlit run app.py
├── config/scenarios.json
├── docs/adr/
├── saidas/                         # CSV e transcripts, ignorados pelo git
├── src/                            # raiz dos pacotes de topo
│   ├── models/                     # M — estado, regras e simulação
│   │   ├── entities.py
│   │   ├── enums.py
│   │   ├── config.py
│   │   ├── scenarios.py
│   │   ├── checkout.py
│   │   ├── events.py
│   │   ├── observations.py
│   │   └── rules/
│   │       ├── coupon.py
│   │       └── relations.py
│   ├── agents/                     # atores do domínio (Agno)
│   │   ├── bot.py
│   │   ├── engine.py
│   │   ├── review.py
│   │   ├── agno_adapter.py
│   │   ├── policies.py
│   │   └── tactics.py
│   ├── controllers/                # C — orquestração
│   │   ├── rounds.py
│   │   ├── execution.py
│   │   └── results.py
│   ├── views/                      # V — Streamlit
│   │   ├── app.py
│   │   ├── pages/
│   │   │   ├── configuration.py
│   │   │   ├── execution.py
│   │   │   ├── rounds.py
│   │   │   ├── metrics.py
│   │   │   └── contestation.py
│   │   └── components/
│   │       ├── tables.py
│   │       └── charts.py
│   └── evaluation/
│       └── metrics.py
└── tests/
```

O caminho padrão é o **modo determinístico**. O modo `adversarial_validation` troca apenas o modelo do bot pelo LLM
externo; o motor e o executor continuam iguais. O protocolo da rodada está na ADR-011.

## Índice

| ADR                                                         | Decisão                                                                           | Status |
|-------------------------------------------------------------|-----------------------------------------------------------------------------------|--------|
| [ADR-001](ADR-001-linguagem-ambiente-e-layout.md)           | Python 3.12, `uv` e layout `src`; sem `pedeja-simulador/` nem `requirements.txt`  | Aceita |
| [ADR-002](ADR-002-agno-como-harness-dos-agentes.md)         | Agno como harness dos dois agentes; motor determinístico e bot plugável           | Aceita |
| [ADR-003](ADR-003-llm-adversario-no-nivel-da-tatica.md)     | LLM adversário no nível da tática, com catálogo fechado e executor determinístico | Aceita |
| [ADR-004](ADR-004-simulador-de-rodadas-sincrono.md)         | Simulador síncrono de rodadas com relógio virtual, sem discrete-event             | Aceita |
| [ADR-005](ADR-005-estado-em-memoria-e-configuracao-json.md) | Estado em memória, configuração em JSON e saídas em CSV; sem banco                | Aceita |
| [ADR-006](ADR-006-separacao-de-informacao.md)               | Separação de informação por projeções, DTOs e ferramentas escopadas               | Aceita |
| [ADR-007](ADR-007-reprodutibilidade-e-replay.md)            | RNG independente por ator, seeds versionadas e replay do transcript               | Aceita |
| [ADR-008](ADR-008-interface-streamlit.md)                   | Streamlit em página única, execução in-process                                    | Aceita |
| [ADR-009](ADR-009-estrategia-de-testes.md)                  | pytest, sem rede na suíte padrão; LLM marcado e pulado sem chave                  | Aceita |
| [ADR-010](ADR-010-organizacao-mvc.md)                       | Organização em MVC simples; agentes e avaliador fora do MVC                       | Aceita |
| [ADR-011](ADR-011-iteracao-adversarial.md)                  | Protocolo da rodada, projeções, gatilhos e evidência da adaptação                 | Aceita |

## Mapa de rastreabilidade

| Requisito ou restrição                                            | Onde é atendido           |
|-------------------------------------------------------------------|---------------------------|
| Escopo delimitado (Enunciado, req. 1)                             | ADR-002, ADR-004          |
| Dois agentes, objetivos conflitantes e regras explícitas (req. 2) | ADR-002, ADR-003          |
| Três rodadas conectadas (req. 3)                                  | ADR-004, ADR-011          |
| Adaptação por observação (req. 4)                                 | ADR-003, ADR-004, ADR-011 |
| Iteração adversarial (protocolo da rodada)                        | ADR-011                   |
| Evidências e registro (req. 5)                                    | ADR-005, ADR-006, ADR-007 |
| Agno na camada de agentes (`AGENTS.md`)                           | ADR-002                   |
| `agents/` e `models/checkout.py` não importam `evaluation/`       | ADR-006, ADR-009          |
| Organização de pastas (MVC simples)                               | ADR-010                   |
| Quatro controles da AM3 (Trabalho 1, §4.5 e §5.2)                 | ADR-003, ADR-006, ADR-009 |
| Configuração e sementes registradas (§6.4)                        | ADR-005, ADR-007          |
| Interface web e CSV (§6.2 e §6.4)                                 | ADR-005, ADR-008          |

## Conflitos registrados

1. **§6.1 do Trabalho 1 × `AGENTS.md`.** O relatório diz "sem modelos de IA"; o `AGENTS.md` exige Agno, e o grupo
   decidiu usar um LLM externo como bot atacante. A ADR-002 resolve separando harness (Agno), decisão (política) e
   estado (simulador); a ADR-003 restringe o LLM a um catálogo fechado de táticas. O `AGENTS.md` ainda declara "no
   external services or hidden model calls" e **deve ser atualizado** para refletir o modo opcional.
2. **§6.4 × repositório uv.** A estrutura `pedeja-simulador/` + `requirements.txt` é anterior ao `pyproject.toml`. A
   ADR-001 registra a adaptação, conforme o próprio `AGENTS.md`.
3. **Python 3.14 × Agno.** O Agno não certifica 3.14; a ADR-001 desce para 3.12. O `uv sync` confirmou a resolução em
   Python 3.12.16.

## Estado do ambiente

- Python **3.12.16** e `agno==3.1.7` resolvidos e importados com sucesso; `streamlit==1.67.0`, `pandas==3.1.1` e
  `pytest==9.2.0` instalados via `uv`.
- `uv sync`, `uv run python` e o console script `trabalho-2` funcionam; o `main()` mínimo está em
  `src/views/app.py`.

## Decisões em aberto

- Escolher o provedor padrão (Anthropic ou Groq) quando a chave existir; o código fica agnóstico ao provedor (ADR-003).
- Calibrar o catálogo de táticas, os gatilhos de adaptação e os limiares da AM3 com os cenários sintéticos (ADR-003,
  ADR-009, ADR-011).
- Atualizar o `AGENTS.md` para registrar que o LLM é opcional e nunca exigido pelos testes.

## Como adicionar uma ADR

1. Copie a estrutura de uma ADR existente (`Status`, `Contexto`, `Decisão`, `Consequências`, `Alternativas`,
   `Referências`).
2. Numere em sequência e use um nome descritivo em kebab-case.
3. Se a decisão substituir outra, marque a antiga como `Substituída por ADR-XXX` e explique o motivo na nova.
4. Atualize a tabela do índice e o mapa de rastreabilidade.
