# ADR-008: Interface Streamlit em página única, execução in-process

## Status

Aceita — 18/11/2026

## Contexto

O §6.4 define `app.py` com `streamlit run app.py`, e a entrega exige demonstração funcional com tabelas e gráficos. O
público da apresentação precisa ver a configuração, as rodadas, as decisões e as métricas sem instalar um servidor de
API.

O simulador é local, single-process e determinístico (ADR-004). Não há requisito de multiusuário, autenticação ou API
pública.

## Decisão

1. Um único entrypoint **`app.py`** na raiz, que delega para **`views/app.py`**, com abas: **Configuração**,
   **Execução**, **Rodadas**, **Métricas** e **Contestação**. Cada aba fica em `views/pages/` e os elementos
   reutilizáveis em `views/components/`.
2. O estado da execução fica em `st.session_state`; o botão "executar" chama a fachada `controllers/execution.py`
   **no mesmo processo**, sem servidor intermediário.
3. Tabelas com **pandas**; gráficos nativos do Streamlit; exportação CSV para `saidas/` e download pela interface.
4. A UI **não contém regra de negócio**: só lê configuração, dispara o controlador e apresenta projeções. Nenhum cálculo
   de cupom, limite ou métrica vive em `views/`.
5. **Sem FastAPI e sem AgentOS** no escopo avaliado. As `pages/` não são multipágina do Streamlit: são funções
   chamadas pelas abas da página única.
6. O modo `adversarial_validation` aparece como opção explícita; sem chave, a aba mostra o aviso e mantém o modo
   determinístico disponível.

## Consequências

### Positivas

- Demonstração em um comando (`uv run streamlit run app.py`), com pouco código.
- A UI reflete exatamente a execução do controlador; não há divergência entre "demo" e "teste".
- O CSV exportado serve de evidência e de base para a análise dos resultados.

### Negativas

- O modelo de rerun do Streamlit exige cuidado com estado mutável em `session_state`.
- Pouca flexibilidade visual e de layout em comparação com um frontend dedicado.
- Sem autenticação; adequado a execução local, não a produção.

### Neutras

- As abas seguem o ciclo do jogo (configurar → executar → observar → contestar).
- O `app.py` é fino por construção; a lógica testável fica nos módulos.

## Alternativas consideradas

- **Streamlit multipágina:** rejeitado. Mais arquivos e navegação sem ganho para cinco visões simples.
- **FastAPI + frontend separado:** rejeitado. Over-engineering e mais um processo para a demo.
- **Notebook Jupyter:** rejeitado. Não é uma aplicação demonstrável e dificulta a interação ao vivo.
- **CLI apenas:** rejeitado. A entrega pede demonstração funcional e o Streamlit já está no stack exigido.

## Referências

- `docs/Trabalho1.md`, §6.2 (interface web) e §6.4 (`app.py`).
- `AGENTS.md` (Streamlit + pandas).
- ADR-004 (controlador), ADR-005 (saídas em CSV), ADR-010 (MVC simples).
