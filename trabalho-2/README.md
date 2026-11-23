# PedeJá — laboratório adversarial do cupom `BEMVINDO`

Simulador local do resgate do cupom de primeiro pedido do PedeJá, com dois agentes adversariais:

- **bot caçador de cupons** — A1 (conta única) ou A2 (multicontas), com táticas AM1–AM3;
- **motor antifraude** — B1 (verificação leve), B2 (verificação rígida) ou o redesenho com os quatro controles da AM3.

A interface mostra o ciclo **ação → resposta → observação → adaptação** em pelo menos três rodadas conectadas, com
visões separadas de **Avaliação**, **Bot** e **Motor**.

## Stack

| Camada | Tecnologia | Gerenciador |
|---|---|---|
| Simulação | Python 3.12 | `uv` |
| Interface | React 19 + TypeScript + Vite 7 + Tailwind CSS 4 | `npm` |

`uv` cuida do ambiente Python. As dependências JavaScript ficam em `src/views/web/package.json` e são instaladas com
`npm`; não há dependência JavaScript no `pyproject.toml`.

## Executar a demonstração

```bash
uv sync
npm --prefix src/views/web install
npm --prefix src/views/web run build
uv run trabalho-2
```

Abra <http://127.0.0.1:8501>. O comando serve o build estático com a biblioteca padrão do Python — sem FastAPI e sem
segundo processo. `uv run python -m views.app` é equivalente. Para abrir a demonstração em outro dispositivo da rede, use
`uv run trabalho-2 --host 0.0.0.0`.

### Desenvolvimento da interface

```bash
npm --prefix src/views/web run dev
```

O Vite abre em <http://127.0.0.1:5173> com recarga imediata. Os dados exibidos são sintéticos e determinísticos.

### Verificações

```bash
npm --prefix src/views/web run typecheck
npm --prefix src/views/web run build
```

### Testes

```bash
uv run pytest
```

A suíte padrão roda **offline**: nada dela chama rede nem exige chave de LLM. Testes que usam o LLM externo são
marcados com `@pytest.mark.llm` e pulados sem chave no ambiente (ADR-009). Não há linter nem CI configurados.

## Configuração

`config/scenarios.json` é a única fonte de parâmetros (ADR-005): rodadas e coorte (`rounds`), orçamentos separados de
plataforma e atacante (`budget`), cupom (`coupon`), limiares do bot e da AM3 (`thresholds`), custo por tática cobrado
por tentativa (`costs`), sementes e fluxos (`seeds`), modos (`modes`), catálogo fechado de táticas (`tactics`), LLM
opcional (`llm`) e arquivos de saída (`outputs`). Nenhum segredo entra no JSON — a chave do LLM vai no `.env`.

O carregamento é validado em `src/models/config.py`; configuração inválida levanta `ConfigError` nomeando a chave e o
valor esperado:

```bash
uv run python -c "from models.config import load_config; load_config('config/scenarios.json')"
```

## Estrutura

```text
trabalho-2/
├── src/
│   ├── models/               # M — regras, entidades, checkout, cenários
│   ├── agents/               # bot, motor, revisão, Agno
│   ├── controllers/          # orquestração das rodadas
│   ├── evaluation/           # avaliador isolado (rótulos e métricas)
│   └── views/
│       ├── app.py            # servidor HTTP do build
│       └── web/              # frontend React + TypeScript
│           ├── src/
│           │   ├── app/       # configuração, execução e contexto
│           │   ├── components/# painéis, gráficos e primitivas
│           │   ├── data/      # contrato, dados sintéticos e derivações
│           │   └── pages/     # as cinco abas
│           └── package.json
└── docs/
    └── adr/                   # decisões de arquitetura (ADR-001..014)
```

## Decisões de arquitetura

As decisões estão em [`docs/adr/ADRs.md`](docs/adr/ADRs.md), com mapa de rastreabilidade: ADR-001 (Python/uv/layout),
ADR-005 (configuração em JSON), ADR-007 (reprodutibilidade), ADR-009 (testes), ADR-012 (economia do atacante) e
ADR-014 (frontend React/TypeScript).

## Fonte de dados

`src/views/web/src/data/source.ts` define a interface `SimulatorSource`. Hoje `createDemoSource(seed)` produz os dados
sintéticos do cenário de referência. Quando o backend Python expuser a execução, um adaptador HTTP implementa a mesma
interface e as telas continuam iguais.

As páginas são passivas: não calculam regra de cupom, orçamento, limite, sondagem ou métrica. Enquanto o backend está
em esqueleto, `src/views/web/src/data/derive.ts` materializa o cenário sintético (tentativas, eventos e agregados) e
funciona como stand-in do controller/avaliador. Ao conectar o Python, esse módulo sai do frontend.

## Documentação

- [`docs/Enunciado.md`](docs/Enunciado.md) — requisitos e critérios.
- [`docs/adr/ADRs.md`](docs/adr/ADRs.md) — índice das decisões.
- [`docs/adr/ADR-014-frontend-react-typescript.md`](docs/adr/ADR-014-frontend-react-typescript.md) — decisão do
  frontend e substituição do Streamlit.
- [`AGENTS.md`](AGENTS.md) — regras de arquitetura, domínio e execução.
