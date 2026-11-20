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
- `docs/adr/ADRs.md` e `docs/adr/ADR-001..011` — decisões de arquitetura e tecnologia.

Se código e documento divergirem, adapte o código e registre a divergência; não edite os documentos somente leitura.

## 3. Estado atual

- Python **3.12.16**, gerenciado por `uv`.
- Dependências instaladas: `agno==3.1.7`, `streamlit==1.67.0`, `pandas==3.1.1`; dev: `pytest==9.2.0`.
- `src/` contém os pacotes de topo `models/`, `agents/`, `controllers/`, `views/` e `evaluation/`.
- Os módulos estão vazios, exceto `src/views/app.py`, que tem um `main()` placeholder.
- `uv run trabalho-2` funciona.
- Ainda faltam: `app.py` da raiz, `config/scenarios.json`, `tests/` e a implementação.

## 4. Comandos

Execute sempre a partir de `trabalho-2/`:

```bash
uv sync
uv run pytest
uv run pytest tests/test_coupon_rules.py -k <expr>
uv run streamlit run app.py   # quando o entrypoint da raiz existir
uv run trabalho-2
uv build --wheel
```

Não use `pip`, virtualenv manual ou `requirements.txt`.

## 5. Arquitetura

- **MVC simples:** `models/` (M), `views/` (V) e `controllers/` (C).
- `agents/` e `evaluation/` ficam **fora do MVC**: são atores de domínio e avaliador isolado, respectivamente.
- Direção das dependências:

  ```text
  views  →  controllers  →  models
                         →  agents  →  models
  evaluation  →  models (somente leitura)
  ```

- **Regra dura:** `agents/` e `models/checkout.py` nunca importam `evaluation/`.
- A view é passiva: não calcula regra de negócio, não altera estado e não importa `models/` diretamente.
- O estado de domínio pertence a `controllers/rounds.py`; os agentes recebem observações tipadas e devolvem decisões.
- **Nomes de código em inglês** (pacotes, módulos, classes, funções, variáveis, eventos, chaves de config e modos).
  **Documentação e IDs do relatório em português.**
- Parâmetros, custos, sementes e modos ficam em `config/scenarios.json`; a lógica fica nos módulos.

## 6. Invariantes de domínio

- Cupom: **R$ 20 de desconto no primeiro pedido com valor estritamente maior que R$ 30**.
- O orçamento é debitado **somente quando o pedido é concluído**.
- Borda: **R$ 30,00 inelegível; R$ 30,01 elegível**.
- Uma conta que concluiu a primeira compra **nunca** volta a ser elegível.
- Três ou mais rodadas conectadas, com estado persistindo entre elas.
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
6. `views/app.py`, `views/pages/` e `views/components/`.
7. `evaluation/metrics.py`.
8. `app.py` da raiz e `config/scenarios.json`.
9. Testes de integração das três rodadas e demo.

## 8. Testes

Áreas esperadas:

- regras do cupom (borda, primeira compra, débito único, orçamento);
- adaptação dos agentes e persistência de estado entre rodadas;
- quatro controles da AM3;
- separação de informação (imports proibidos e DTOs públicos);
- métricas e custos sem dupla contagem.

A suíte padrão roda **offline**. Testes que usam LLM são marcados como `llm` e pulados sem chave. Não há linter,
typechecker ou CI configurados: **não afirme que essas verificações passam**.

## 9. Não faça

- Não editar `docs/Enunciado.md`, `docs/Trabalho1.md` ou `docs/Aula 10+11+12.pdf`.
- Não usar `pip` nem criar `requirements.txt` ou `pedeja-simulador/`.
- Não commitar `.idea/`, `saidas/` ou `.env`.
- Não colocar regra de negócio em `views/`.
- Não vazar rótulos, o mapa pessoa↔conta, a estratégia do bot ou seus custos para o motor ou a revisão.
- Não adicionar chamadas externas ao modo determinístico nem à suíte padrão.
- Não renomear ou reinterpretar os IDs `A1/A2`, `B1/B2`, `P1–P3`, `PE1–PE3`, `AM1–AM3`.

## 10. Onde olhar

- [`docs/adr/ADRs.md`](docs/adr/ADRs.md) — índice e mapa de rastreabilidade.
- ADR-002 — Agno como harness.
- ADR-003 — LLM no nível da tática.
- ADR-006 — separação de informação.
- ADR-007 — reprodutibilidade e replay.
- ADR-010 — organização MVC.
- ADR-011 — protocolo da rodada e adaptação.
