# AGENTS.md — Trabalho 2 (PedeJá)

Este arquivo complementa o [`../AGENTS.md`](../AGENTS.md) da raiz. Vale para tudo dentro de `trabalho-2/`.
Em caso de conflito, prevalecem as regras da raiz e os documentos em `docs/`.

## 1. Objetivo

Implementar um **simulador do resgate do cupom `BEMVINDO`** no PedeJá, com dois agentes:

- **bot caçador de cupons** (A1 conta única / A2 multicontas), que pode usar regras ou um LLM externo opcional;
- **motor antifraude** (B1 verificação leve / B2 verificação rígida), determinístico e auditável.

O simulador executa **pelo menos três rodadas conectadas** e demonstra o ciclo **ação → resposta → observação →
adaptação**. É um protótipo local, em um único processo, sem serviços externos obrigatórios.

## 2. Fontes de verdade

- `docs/Enunciado.md` — requisitos e critérios de avaliação. **Somente leitura.**
- `docs/Trabalho1.md` — §3 (rodadas), §4.5 (AM3), §5 (redesenho) e §6 (arquitetura). **Somente leitura.**
- `docs/Aula 10+11+12.pdf` — conceitos de Agno. **Somente leitura.**
- `docs/adr/ADRs.md` e `docs/adr/ADR-001..014` — decisões de arquitetura e tecnologia.

Se código e documento divergirem, adapte o código e registre a divergência; não edite os documentos somente leitura.

## 3. Estado atual

- Python **3.12.16**, gerenciado por `uv`; Node 22 e npm 10 para o frontend.
- Dependências Python: `agno[anthropic,groq,sqlite]==3.1.7` (o extra `sqlite` traz o `sqlalchemy` exigido pelo
  `SqliteDb`), `pandas>=3.1.1` e `python-dotenv`; dev: `pytest`. O `streamlit` foi removido (ADR-014).
- Dependências do frontend em `src/views/web/package.json` (React 19, Vite 7, Tailwind CSS 4).
- `src/` contém os pacotes de topo `models/`, `agents/`, `controllers/`, `views/` e `evaluation/`.
- As cinco telas estão implementadas em `src/views/web/src/` com dados sintéticos determinísticos; a fonte está
  isolada atrás de `SimulatorSource`. **Decisão do grupo (I-01): o front e `docs/prototipo_interface/` permanecem
  versionados** — não foram removidos; a ligação com dados reais fica para depois, e a ADR-014 será marcada como
  "adiada" na I-02.
- `src/views/app.py` serve o build estático do front (`uv run python -m views.app`). O console script `trabalho-2`
  foi **removido na I-01** (dependia do front) e volta na I-08 apontando para o `main.py` do simulador.
- `models/` (config, entidades, enums, regras do cupom, cenários, eventos e checkout) e `tests/` (163 testes offline)
  estão implementados. `agents/`, `controllers/` e `evaluation/` continuam esqueletos; `models/observations.py`
  (projeções `PublicView`/`OperationalView`/`EvaluationView`) pertence à I-03 (#28).

## 4. Comandos

Execute sempre a partir de `trabalho-2/`:

```bash
uv sync
npm --prefix src/views/web install
npm --prefix src/views/web run dev       # Vite com recarga
npm --prefix src/views/web run typecheck # tsc estrito
npm --prefix src/views/web run build     # gera src/views/web/dist
uv run python -m views.app               # serve o build do front em :8501
uv run pytest                            # suíte offline (163 testes)
uv build --wheel
```

Não use `pip`, virtualenv manual ou `requirements.txt`. `uv` gerencia Python; o frontend usa `npm` e
`src/views/web/package.json`. Não adicione dependência JavaScript ao `pyproject.toml` nem dependência Python ao
`package.json`.

## 5. Arquitetura

- **MVC simples:** `models/` (M), `views/` (V) e `controllers/` (C).
- A view é o app **React + TypeScript** em `src/views/web/`; `src/views/app.py` só serve o build estático. A UI recebe
  dados tipados de `src/views/web/src/data/`, cuja porta é a interface `SimulatorSource` (`data/source.ts`).
- `agents/` e `evaluation/` ficam **fora do MVC**: são atores de domínio e avaliador isolado, respectivamente.
- Direção das dependências:

  ```text
  views  →  controllers  →  models
                         →  agents  →  models
  evaluation  →  models (somente leitura)
  ```

- **Regra dura:** `agents/` e `models/checkout.py` nunca importam `evaluation/`.
- A view é passiva: não calcula regra de negócio, não altera estado de domínio e não importa `models/` diretamente.
  O estado de apresentação (aba, visão, animação, filtros) fica no frontend; o estado da simulação pertence ao
  controller.
- O estado de domínio pertence a `controllers/rounds.py`; os agentes recebem observações tipadas e devolvem decisões.
- **Nomes de código em inglês** (pacotes, módulos, classes, funções, variáveis, eventos, chaves de config e modos).
  **Documentação e IDs do relatório em português.**
- Parâmetros, custos, sementes e modos ficam em `config/scenarios.json`; a lógica fica nos módulos.

## 6. Invariantes de domínio

- Cupom: **R$ 20 de desconto no primeiro pedido com valor estritamente maior que R$ 30** (valores de referência;
  desconto e mínimo vêm de `coupon` em `config/scenarios.json` — não há constantes de negócio em `models/`).
- O orçamento é debitado **somente quando o pedido é concluído**.
- Borda: **R$ 30,00 inelegível; R$ 30,01 elegível**.
- **Primeira compra de valor até o mínimo (decisão do grupo, plano revisado §11):** o pedido é concluído **sem
  desconto**, a conta perde a elegibilidade para sempre e a resposta **não** é `coupon_already_used` — o cupom
  nunca foi usado. O checkout registra `order_completed` com `discount = 0`.
- Uma conta que concluiu a primeira compra **nunca** volta a ser elegível.
- Rodadas conectadas com estado persistindo entre elas: **mínimo 3, máximo 5** (`rounds.min`/`rounds.count` na
  config; a conversão base 70 %/55 % da coorte vem de `rounds.base_conversion`).
- Controles da AM3: **mensagem genérica**, **limite de 3 tentativas por 24 h simuladas**, **detecção de sondagem** e
  **canal de contestação**.
- Configurações de defesa comparadas: **B1 fixa**, **B2 fixa** e o **redesenho da seção 5**.
- O bot vê apenas suas ações, recursos e respostas públicas. O motor vê sinais e histórico operacional. Rótulos e o mapa
  pessoa↔conta pertencem ao avaliador.
- O LLM é opcional e fica no modo `adversarial_validation`; a chave vai no `.env` e **nunca** é exigida pelos testes. O
  padrão é o modo `deterministic`.
- Registre `master_seed`, hash da configuração, `run_id` e transcript do LLM para reprodução e replay.

## 7. Ordem de implementação

1. `models/entities.py`, `models/enums.py`, `models/config.py`.
2. `models/rules/coupon.py` + `tests/test_coupon_rules.py` (bordas R$ 30,00 × 30,01).
3. `models/scenarios.py`, `models/checkout.py`, `models/events.py`, `models/observations.py`.
4. `agents/`: `tactics.py`, `policies.py`, `agno_adapter.py`, `bot.py`, `engine.py`, `review.py`.
5. `controllers/rounds.py`, `controllers/execution.py`, `controllers/results.py`.
6. `views/web/src/` (telas React) e `views/app.py` (servidor do build).
7. `evaluation/metrics.py`.
8. `config/scenarios.json`.
9. Testes de integração das três rodadas e demo.

## 8. Testes

Áreas esperadas:

- regras do cupom (borda, primeira compra, débito único, orçamento);
- adaptação dos agentes e persistência de estado entre rodadas;
- quatro controles da AM3;
- separação de informação (imports proibidos e DTOs públicos);
- métricas e custos sem dupla contagem.

A suíte padrão roda **offline**. Testes que usam LLM são marcados como `llm` e pulados sem chave.

O frontend tem verificação de tipos (`npm --prefix src/views/web run typecheck`) e build. Não há linter ou CI
configurados: **não afirme que lint ou CI passam**. A suíte `pytest` roda offline com 163 testes.

## 9. Não faça

- Não editar `docs/Enunciado.md`, `docs/Trabalho1.md` ou `docs/Aula 10+11+12.pdf`.
- Não usar `pip` nem criar `requirements.txt` ou `pedeja-simulador/`.
- Não commitar `.idea/`, `saidas/` ou `.env`.
- Não colocar regra de negócio em `views/` nem em `src/views/web/`.
- Não vazar rótulos, o mapa pessoa↔conta, a estratégia do bot ou seus custos para o motor ou a revisão.
- Não adicionar chamadas externas ao modo determinístico nem à suíte padrão.
- Não commitar `node_modules/` nem `src/views/web/dist/`; o build é reproduzido por `npm run build`.
- Não embutir chave de API no frontend: o navegador nunca recebe a chave do LLM.
- Não renomear ou reinterpretar os IDs `A1/A2`, `B1/B2`, `P1–P3`, `PE1–PE3`, `AM1–AM3`.

## 10. Onde olhar

- [`docs/adr/ADRs.md`](docs/adr/ADRs.md) — índice e mapa de rastreabilidade.
- ADR-002 — Agno como harness.
- ADR-003 — LLM no nível da tática.
- ADR-006 — separação de informação.
- ADR-007 — reprodutibilidade e replay.
- ADR-010 — organização MVC.
- ADR-011 — protocolo da rodada e adaptação.
- ADR-014 — frontend React/TypeScript e substituição do Streamlit.
