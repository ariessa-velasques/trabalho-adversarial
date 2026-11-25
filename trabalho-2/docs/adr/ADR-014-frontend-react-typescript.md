# ADR-014: Frontend React/TypeScript no lugar do Streamlit

## Status

Aceita — 20/11/2026 — nova. Substitui a ADR-008 e emenda a camada de view da ADR-010. Emendada em 20/11/2026: o
entrypoint Python é único (`views.app:main`); o `app.py` de conveniência na raiz foi removido.

## Contexto

A ADR-008 escolheu Streamlit para a demonstração por ser um único comando e já estar no stack. A própria ADR-008
registrou a consequência negativa: "pouca flexibilidade visual e de layout em comparação com um frontend dedicado".

O protótipo de interface em `docs/prototipo_interface/` foi construído em React + TypeScript e cobre as cinco telas com
um vocabulário visual mais adequado ao problema:

- a cadeia causal **Ação → Resposta → Observação → Adaptação** precisa de duas raias paralelas (bot e motor) e de
  cartões de gatilho, não de uma sequência de widgets;
- as visões **Avaliação / Bot / Motor** exigem ocultação seletiva de campos no nível do componente, não apenas esconder
  uma coluna de `DataFrame`;
- a simulação ao vivo, o painel de eventos e a linha do tempo de rodadas são interações de estado que o modelo de
  rerun do Streamlit torna custosas.

O simulador continua local, single-process e determinístico. O backend Python ainda está em esqueleto: os módulos de
`models/`, `controllers/` e `agents/` não têm implementação. Por isso a primeira entrega do frontend usa dados
sintéticos determinísticos, com um contrato explícito para a futura fonte real.

O `AGENTS.md` §5 fixa `views/` como camada passiva. A troca de tecnologia não pode mover regra de negócio para a view.

## Decisão

1. **Substituir o Streamlit** por uma aplicação **React 19 + TypeScript + Vite 7 + Tailwind CSS 4** em
   **`src/views/web/`**. A pasta contém `package.json`, `tsconfig.json`, `vite.config.ts` e `src/`.
2. **Manter `src/views/app.py` como entrypoint Python.** Ele não contém UI: serve o build estático
   `src/views/web/dist` com `ThreadingHTTPServer` da biblioteca padrão, com fallback para `index.html` (SPA). O comando
   `uv run trabalho-2` continua sendo a demonstração em um único processo.
3. **Há um único entrypoint Python: `views.app:main`**, exposto como `uv run trabalho-2`. Não existe `app.py` na
   raiz: o alias antigo duplicava o entrypoint e não entrava no wheel; quem precisa chamar o módulo diretamente usa
   `uv run python -m views.app`.
4. **Remover a view Streamlit**: `src/views/pages/` e `src/views/components/` em Python, o `streamlit` das dependências e
   o caminho `streamlit run app.py`. `pandas` permanece para a futura exportação/agregação no backend.
5. **A view continua passiva.** Nenhuma regra de cupom, orçamento, limite, sondagem ou métrica é calculada nas páginas
   de `src/views/web/src/pages/`. A UI consome estruturas tipadas de `src/views/web/src/data/`.
   Enquanto o backend está em esqueleto, `data/derive.ts` gera o cenário sintético e seus agregados como stand-in do
   controller/avaliador; esse módulo será substituído pelo adaptador Python, não promovido a regra de produção.
6. **Fonte de dados atrás de uma interface.** `SimulatorSource` (`src/views/web/src/data/source.ts`) expõe rodadas,
   políticas, tentativas, eventos, alertas, contestações e totais. Hoje `createDemoSource(seed)` gera os dados
   sintéticos do protótipo; amanhã um `createHttpSource(baseUrl)` implementa a mesma interface quando o backend Python
   expuser a execução. Nenhuma tela muda.
7. **Separação de informação preservada na UI.** O seletor de visão filtra o que cada ator pode ver; os componentes de
   bot e motor não recebem campos que a outra visão não pode enxergar. A regra dura da ADR-006 continua valendo no
   backend.
8. **Ferramentas separadas por ecossistema.** `uv` gerencia Python (`uv sync`, `uv run`); o frontend tem `package.json`
   e é instalado/compilado com `npm`. Não se adiciona dependência JavaScript ao `pyproject.toml` nem dependência Python
   ao `package.json`.
9. **Fluxo de desenvolvimento e demonstração:**
   - desenvolvimento: `npm --prefix src/views/web run dev`;
   - build: `npm --prefix src/views/web run build`;
   - demonstração: `uv run trabalho-2` (serve o build na porta 8501).

## Consequências

### Positivas

- A cadeia causal, as raias dos agentes e as visões de informação passam a ter representação visual própria.
- A UI deixa de depender do modelo de rerun e do estado de sessão do Streamlit.
- O contrato `SimulatorSource` deixa a troca por dados reais localizada em um arquivo, sem reescrever as telas.
- O build estático é servido sem FastAPI, sem segundo processo e sem serviço externo.
- A tipagem estrita (`tsc -b`) detecta campos e estados ausentes antes da demonstração.

### Negativas

- Entra uma segunda toolchain (Node/npm) no repositório; a demo exige um passo de build além do `uv sync`.
- O wheel inclui `views/web/dist` (exclui `node_modules` e as fontes TypeScript), mas só depois de um `npm run build`; um
  clone sem build não serve a interface.
- Há duplicação temporária de dados sintéticos enquanto o backend Python não expõe a execução real.
- Não há `app.py` na raiz; scripts que usavam `python app.py` devem migrar para `uv run trabalho-2` ou
  `python -m views.app`. Quem seguir a ADR-008 encontrará uma decisão substituída.

### Neutras

- As cinco telas e seus IDs (`A1/A2`, `B1/B2`, `AM1–AM3`, `PE1–PE3`) permanecem iguais.
- `main.py` headless (ADR-013) e a cadeia causal de `controllers/results.py` continuam sendo a fonte de verdade do
  backend; o frontend apenas apresenta o que receber.
- A UI pode evoluir para consumir HTTP sem alterar a separação MVC.

## Alternativas consideradas

- **Manter Streamlit (ADR-008).** Rejeitada: o protótipo já demonstrou o limite de layout e de interação; a decisão
  anterior já registrava essa consequência.
- **FastAPI + SPA agora.** Rejeitada nesta etapa: o backend não tem regra implementada; um servidor de API seria uma
  terceira peça sem dado real. A interface `SimulatorSource` deixa o caminho aberto.
- **Servir o SPA com `vite preview` ou `npm run dev` na demo.** Rejeitada: exige Node rodando ao lado do Python e
  quebra o "um comando" da ADR-008.
- **Next.js/SSR.** Rejeitada: o app é local, sem SEO, autenticação ou rotas públicas; SSR adiciona complexidade sem
  benefício.
- **Manter o protótipo apenas como arquivo estático em `docs/`.** Rejeitada: não executa a simulação nem mantém estado
  entre telas, e não atende ao requisito de demonstração funcional.

## Referências

- `docs/Enunciado.md`, requisitos 3, 4 e 5 (rodadas, adaptação e evidências).
- `docs/prototipo_interface/` (referência visual e de conteúdo).
- `AGENTS.md` §3–§6 (stack, MVC, view passiva, separação de informação).
- ADR-006 (separação de informação), ADR-008 (decisão substituída), ADR-010 (MVC e camada de view), ADR-011 (protocolo
  da rodada), ADR-013 (execução headless).
