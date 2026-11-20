# ADR-010: Organização em MVC simples

## Status

Aceita — 18/11/2026 — ajusta o layout de pacotes da ADR-001 e os caminhos citados nas ADR-002, 005, 006, 008 e 009.
Emendada em 20/11/2026: mapa do Plano de Tarefas do Grupo 9 para os módulos e entrada headless `main.py` (ADR-013).
Emendada em 20/11/2026: a view Streamlit é substituída pelo frontend React/TypeScript em `src/views/web/` (ADR-014);
models, agents, controllers e evaluation não mudam.

## Contexto

O grupo quer uma estrutura de pastas **fácil de explicar na apresentação** e de navegar por quem entra no projeto
depois. MVC (Model–View–Controller) é o padrão mais reconhecível para separar dados/regras, interface e orquestração.

O projeto tem três naturezas distintas:

1. **Interface** em Streamlit (`app.py`), que só deve apresentar e disparar comandos.
2. **Orquestração** das rodadas, que coordena checkout, agentes e eventos.
3. **Domínio** com regras fortes: cupom, orçamento, políticas, separação de informação e avaliador isolado.

MVC é um padrão de **apresentação**. Aplicá-lo ao simulador inteiro pode esconder a fronteira de domínio que a ADR-006
protege. Por isso a decisão abaixo usa MVC na casca da aplicação e mantém `agents/` e `evaluation/` como módulos de
domínio com regras próprias.

O recorte é um **protótipo**. Uma primeira versão desta ADR propunha módulos separados para estado, configuração,
fachada, componentes e view models; isso era mais estrutura do que o trabalho pede. A versão atual funde esses arquivos
e mantém apenas o que sustenta a iteração adversarial da ADR-011.

## Decisão

1. Adotar **MVC simples** no nível de `src/` (pacotes de topo):
    - **Model (`models/`)** — entidades + estado, enums, configuração, cenários sintéticos, checkout, eventos/projeções
      e regras puras (`models/rules/`). Não importa Streamlit nem constrói agentes.
    - **View (`views/`)** — `app.py` (layout e abas), `pages/` (uma por aba) e `components/` (tabelas e gráficos).
      Passiva: não calcula regra de negócio, não altera estado e não importa `models/` diretamente; recebe dados prontos
      do controller.
    - **Controller (`controllers/`)** — `rounds.py` (laço, relógio virtual e estado), `execution.py` (fachada de casos
      de
      uso) e `results.py` (DataFrames/view models para a view). Recebe comandos da view e chama o model e os agentes.
2. **`agents/` fica fora do MVC**, como camada de atores do domínio: `bot.py`, `engine.py`, `review.py`,
   `agno_adapter.py`, `policies.py` e `tactics.py`. O controller os consome; a view nunca os importa.
3. **`evaluation/` fica fora do MVC** e continua isolada: só lê o modelo e os eventos e nunca é importada por `models/`,
   `agents/` ou `models/checkout.py` (ADR-006).
4. O `app.py` da raiz é o **entrypoint** do Streamlit e apenas delega para `views/app.py`. *(Emenda 20/11: a ADR-014
   substituiu o Streamlit e removeu o `app.py` da raiz; o entrypoint passou a ser `views.app:main`.)*
5. A direção das dependências é fixa:

   ```text
   visao  →  controle  →  modelo
                      →  agentes  →  modelo
   avaliacao  →  modelo (somente leitura)
   ```

6. A view recebe **DataFrames e estruturas prontas** do controller; não monta consulta, não filtra rótulo e não decide
   nada.
7. Os testes espelham as camadas: regras em `models/`, orquestração em `controllers/`, contrato dos agentes e teste de
   fronteira.

## Estrutura de pastas

```text
trabalho-2/
├── app.py                          # entrypoint: streamlit run app.py
├── main.py                         # entrypoint headless (ADR-013)
├── config/
│   └── scenarios.json               # parâmetros, seeds, modos, catálogo de táticas
├── docs/
│   └── adr/
├── saidas/                         # CSV e transcripts, ignorados pelo git
├── src/                            # raiz dos pacotes de topo
│   ├── models/                     # M — estado, regras e simulação
│   │   ├── __init__.py
│   │   ├── entities.py             # Account, Order, Attempt, Decision, Redemption, Event, SimulationState
│   │   ├── enums.py                # Mode, VerificationLevel, Outcome, EventType, ContestationStatus
│   │   ├── config.py               # carrega/valida config/scenarios.json
│   │   ├── scenarios.py            # gera dados sintéticos e mantém pessoa↔conta + rótulos
│   │   ├── checkout.py             # PE1/PE2 e orquestração do cupom
│   │   ├── events.py               # eventos canônicos
│   │   ├── observations.py         # PublicView, OperationalView, EvaluationView
│   │   └── rules/
│   │       ├── __init__.py
│   │       ├── coupon.py           # elegibilidade pura (R$ 30,00 × 30,01)
│   │       └── relations.py        # sinais repetidos e padrão de sondagem
│   ├── agents/                     # atores do domínio (Agno), fora do MVC
│   │   ├── __init__.py
│   │   ├── bot.py
│   │   ├── engine.py
│   │   ├── review.py
│   │   ├── agno_adapter.py         # Model determinístico + fábrica do LLM
│   │   ├── policies.py             # regras puras do bot e do motor
│   │   └── tactics.py              # catálogo fechado de táticas
│   ├── controllers/                # C — orquestração
│   │   ├── __init__.py
│   │   ├── rounds.py               # laço, relógio virtual e estado
│   │   ├── execution.py            # fachada de casos de uso
│   │   └── results.py              # DataFrames/view models para a view
│   ├── views/                      # V — Streamlit
│   │   ├── __init__.py
│   │   ├── app.py                  # layout e abas
│   │   ├── pages/
│   │   │   ├── __init__.py
│   │   │   ├── configuration.py
│   │   │   ├── execution.py
│   │   │   ├── rounds.py
│   │   │   ├── metrics.py
│   │   │   └── contestation.py
│   │   └── components/
│   │       ├── __init__.py
│   │       ├── tables.py
│   │       └── charts.py
│   └── evaluation/                 # avaliador isolado
│       ├── __init__.py
│       └── metrics.py
└── tests/
    ├── test_coupon_rules.py
    ├── test_agents.py
    ├── test_am3_controls.py
    ├── test_separation.py
    └── test_metrics.py
```

Como não há um pacote único, o `pyproject.toml` declara os módulos de topo em
`[tool.uv.build-backend] module-name = ["models", "agents", "controllers", "views", "evaluation"]` e o console script
aponta
para `views.app:main`.

## Mapa do Plano de Tarefas do Grupo 9

O Plano de Tarefas do Grupo 9 divide o trabalho por **arquivo próprio**: `src/ambiente.py`, `src/agente_bot.py`,
`src/agente_antifraude.py`, `src/adaptacao_bot.py`, `src/adaptacao_antifraude.py` e `src/evidencias.py`. Esse arranjo é
o
"pacote plano" já rejeitado nesta ADR: mistura regra, orquestração e apresentação no mesmo nível e dissolve as
fronteiras
das ADR-006 e ADR-011.

A divisão de trabalho, porém, é um requisito de avaliação: a nota é individual e cada integrante precisa de contribuição
identificável no repositório. A solução é manter os pacotes e **mapear cada entregável do plano ao módulo
correspondente**.

| Entregável do plano                                                | Módulo no repositório                                                                                                  | ADR           |
|--------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|---------------|
| `main.py` — loop, orçamento e rodadas                              | `controllers/rounds.py`, `models/config.py`, `models/scenarios.py`                                                     | 005, 011, 013 |
| `src/ambiente.py` (`AmbientePedeJa`)                               | `controllers/rounds.py` (laço e estado), `models/rules/coupon.py` (R$ 20 / R$ 30), `models/scenarios.py` (coorte e P3) | 010, 011      |
| `src/agente_bot.py` (`AgenteBot`, A1/A2, `gerar_tentativas`)       | `agents/bot.py`, `agents/tactics.py`                                                                                   | 002, 003      |
| `src/agente_antifraude.py` (`AgenteAntifraude`, `avaliar_resgate`) | `agents/engine.py`, `agents/policies.py`, `models/rules/relations.py`                                                  | 006, 011      |
| `src/adaptacao_bot.py` (`observar_e_adaptar_bot`, ROI)             | `agents/policies.py` (gatilhos do bot), `agents/tactics.py`                                                            | 011, 012      |
| `src/adaptacao_antifraude.py` (`observar_e_adaptar_defesa`)        | `agents/policies.py` (gatilhos do motor)                                                                               | 011           |
| `src/evidencias.py` (terminal e histórico)                         | `controllers/results.py` (cadeia causal), `evaluation/metrics.py` (agregação), `saidas/runs/<run_id>/`                 | 005, 012, 013 |
| `logs/historico_simulacao.json`                                    | `saidas/runs/<run_id>/events.jsonl`                                                                                    | 005           |

Regras do mapa:

1. **O código usa o nome do repositório.** Os nomes em português do plano (`AmbientePedeJa`, `avaliar_resgate`,
   `observar_e_adaptar_*`) ficam na documentação e na apresentação; o código usa os nomes em inglês do `AGENTS.md` §5.
2. **Um dono por módulo.** Cada linha da tabela tem um responsável identificável, mesmo que o arquivo tenha outro nome.
   A
   propriedade é do **módulo**, não do arquivo do plano.
3. **`src/evidencias.py` não vira módulo de topo.** Exibir e exportar são responsabilidades diferentes: a cadeia causal
   é
   do controller, a agregação com rótulos é do avaliador e a escrita em disco é da ADR-005.
4. **`src/ambiente.py` não vira objeto onisciente.** Orçamento, regra do cupom, laço e coorte legítima já têm casa;
   juntá-los num arquivo só reproduziria o acoplamento que esta ADR evita.
5. **Branch, Issue e PR por integrante são processo**, não arquitetura. A ADR registra apenas a fronteira de propriedade
   que torna a contribuição auditável.

## Consequências

### Positivas

- Estrutura reconhecível e defensável na apresentação: M, V e C têm um lugar claro.
- Arquivos pequenos e com um papel claro; o mapa para o §6.4 continua direto (`entities.py`, `scenarios.py`,
  `checkout.py`, `events.py`, `rounds.py`).
- A view fica fina e passiva, o que reduz o risco de regra de negócio vazar para o Streamlit.
- As regras de domínio continuam isoladas e testáveis, e a fronteira da ADR-006 permanece verificável.
- O mapa do Plano de Tarefas dá um endereço de código a cada entregável, sem reabrir o layout.

### Negativas

- `entities.py` acumula entidades e estado, e `scenarios.py` acumula geração e rótulos; se crescerem, viram duas ADRs.
- `views/pages/` pode crescer; a válvula de escape é extrair componentes só quando doer.
- `controllers/rounds.py` concentra o laço e o estado; `execution.py` e `results.py` precisam ficar finos.
- MVC não cobre bem agentes e avaliador; eles ficam explicitamente fora do padrão, o que exige explicação.
- O mapa do plano precisa ser mantido à mão; se um módulo mudar de nome, a tabela envelhece.

### Neutras

- A divisão semântica do §6.4 é preservada; muda a organização física.
- O entrypoint continua sendo `app.py`, como pede o §6.4.
- Os testes seguem o nome das camadas, não o contrário.

## Alternativas consideradas

- **Pacote plano (status da ADR-001):** rejeitado. Mistura view, orquestração e domínio, e fica difícil de explicar.
- **Pacote plano do Plano de Tarefas do Grupo 9** (`src/ambiente.py`, `src/agente_bot.py`, `src/adaptacao_bot.py`,
  `src/evidencias.py`): rejeitado pelo mesmo motivo. A divisão de trabalho do plano é preservada pelo mapa de
  entregáveis,
  não pela cópia da estrutura de arquivos.
- **MVC expandido e plano (primeira versão desta ADR):** rejeitado. `estado.py`, `configuracao.py`, `execucao.py`,
  `componentes.py` e `view_models.py` ficavam todos no mesmo nível; a versão atual agrupa por responsabilidade
  (`controllers/execution.py`, `views/pages/`, `views/components/`) em vez de espalhar arquivos soltos.
- **MVC colocando `agents/` como Controller:** rejeitado. Agentes são atores de domínio, não controladores de UI; isso
  confundiria a fronteira de informação.
- **Arquitetura hexagonal/clean com portas e adaptadores:** mais rigorosa, mas com mais interfaces e cerimônia do que o
  escopo pede; a ADR-006 já cobre a fronteira essencial.
- **Streamlit multipágina:** rejeitado na ADR-008; a view continua em página única.

## Referências

- ADR-001 (Python, uv e layout `src`).
- ADR-002 (Agno como harness).
- ADR-005 (saídas em `saidas/`).
- ADR-006 (separação de informação e regra de dependência).
- ADR-008 (Streamlit em página única).
- ADR-011 (iteração adversarial).
- ADR-012 (economia do atacante) e ADR-013 (entrada headless).
- `docs/Trabalho1.md`, §6.2 e §6.4.
- Plano de Tarefas do Grupo 9, seções 2.1 a 2.6 — documento externo, não versionado.
