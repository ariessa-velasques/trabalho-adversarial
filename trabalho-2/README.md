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
```

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
