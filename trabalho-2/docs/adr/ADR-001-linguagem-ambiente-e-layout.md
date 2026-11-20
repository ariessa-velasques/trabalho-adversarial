# ADR-001: Python 3.12, uv e layout `src`

## Status

Aceita — 18/11/2026 — complementada pela ADR-010 (organização interna em MVC).

## Contexto

- O `trabalho-2` já nasceu como projeto **uv** (`pyproject.toml`, `uv.lock`), com Python **3.14** pinado em
  `.python-version` e `requires-python`.
- O §6.4 do Trabalho 1 propõe a pasta `pedeja-simulador/` e um `requirements.txt`. Essa proposta é anterior à migração
  do repositório para uv/pyproject.
- O `AGENTS.md` determina usar `uv` para toda operação de ambiente/dependência e adaptar a estrutura do §6.4 ao projeto
  existente.
- O Agno 3.1.7 (versão usada na aula) declara `requires-python >=3.9,<4`, mas **não lista Python 3.14** entre os
  classificadores. Streamlit e pandas declaram suporte a 3.14.
- O simulador roda em um único processo local, sem serviços externos obrigatórios (o LLM é opcional — ver ADR-003).

## Decisão

1. Usar **Python 3.12**, versão estável com wheels disponíveis para toda a stack.
2. Usar **`uv`** como único gerenciador (`uv sync`, `uv add`, `uv run`, `uv lock`). Nada de `pip`, virtualenv manual ou
   `requirements.txt`.
3. Manter o **layout `src`**: módulos de topo em `src/` (`models/`, `agents/`, `controllers/`, `views/`, `evaluation/`), com
   `app.py`, `config/`, `tests/` e `saidas/` na raiz de `trabalho-2/`. A organização segue a ADR-010 (MVC simples).
4. Dependências de execução: `agno==3.1.7`, `streamlit`, `pandas`. Desenvolvimento: `pytest`. Versões exatas resolvidas
   no `uv.lock`.
5. **Não** criar `pedeja-simulador/` nem `requirements.txt`.
6. Manter o console script `trabalho-2 = "views.app:main"`, com `main()` em `src/views/app.py`.

## Consequências

### Positivas

- Stack inteira com suporte estável a Python 3.12, reduzindo risco de incompatibilidade do Agno.
- `uv.lock` torna a instalação reproduzível e auditável.
- O layout `src` evita import acidental do pacote a partir da raiz e facilita os testes.
- Alinhamento direto com o `AGENTS.md`.

### Negativas

- O downgrade de 3.14 para 3.12 exige atualizar `.python-version`, `requires-python` e regenerar o `uv.lock`.
- O pin exato do Agno exige uma decisão consciente (e uma nova ADR) para atualizar de versão.

### Neutras

- O §6.4 fica desatualizado; esta ADR registra formalmente a substituição.
- A versão do Python passa a ser parte do contrato de reprodutibilidade (ADR-007).

## Alternativas consideradas

- **Python 3.14 (status atual do repo):** rejeitado. O Agno não certifica 3.14 e o ganho de linguagem não compensa o
  risco em um artefato avaliado.
- **Python 3.13:** viável e mais novo, mas sem ganho concreto sobre 3.12 para esta stack.
- **Python 3.11:** sem ganho e mais distante das versões atuais das bibliotecas.
- **`pedeja-simulador/` + `requirements.txt`:** rejeitado. Conflita com o projeto uv existente e com o `AGENTS.md`; a
  estrutura do §6.4 é adaptada, não copiada.

## Referências

- `docs/Trabalho1.md`, §6.4 (estrutura proposta).
- `AGENTS.md` (regras de uv e estrutura).
- `pyproject.toml` e `.python-version` do `trabalho-2`.
- ADR-002 (Agno como harness), ADR-007 (reprodutibilidade), ADR-010 (MVC simples).
