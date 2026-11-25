# ADR-013: Execução headless (`main.py`) ao lado do Streamlit

## Status

Aceita — 20/11/2026 — nova. Complementa a ADR-008 sem substituí-la. Emendada em 20/11/2026: o `app.py` deixou de ser
Streamlit e o entrypoint da interface passou a ser `views.app:main` (ADR-014); o caminho headless e a fonte de evidência
não mudam.

## Contexto

O **Plano de Tarefas do Grupo 9** prevê `main.py` como ponto de entrada que roda a simulação e escreve o histórico em
arquivo, além do registro no terminal. A ADR-008 decidiu um único entrypoint Streamlit (`app.py`) e **rejeitou "CLI
apenas"**; a decisão continua válida para a entrega, mas deixou sem resposta três necessidades concretas:

1. **Demonstração reproduzível em um comando**, sem servidor, porta ou navegador.
2. **Evidência para o vídeo e para a análise** (requisito 5 do Enunciado), gerada de forma determinística.
3. **Testes de integração** das rodadas que não dependam da camada de UI.

O Streamlit também não é um bom alvo de teste de ponta a ponta: exige sessão, é sensível a rerun e não roda em ambiente
sem interface.

## Decisão

1. Adicionar **`main.py` na raiz** como entrypoint **headless**, fino por construção: interpreta argumentos (`--rounds`,
   `--mode`, `--config`, `--out`, `--seed`), chama **a mesma função de caso de uso** que a UI chama
   (`controllers/execution.py`) e imprime o resumo da execução. Nenhuma regra de negócio, nenhum cálculo de métrica.
2. **`views.app:main` é o entrypoint da interface** (ADR-014; originalmente `app.py` no Streamlit, ADR-008/ADR-010). O
   `main.py` não o substitui: "CLI apenas" segue rejeitado. Os dois caminhos compartilham o mesmo controlador, o mesmo
   protocolo de rodada e a mesma configuração.
3. **Saídas em `saidas/`, não em `logs/`.** O plano pede `logs/historico_simulacao.json`; a ADR-005 já fixou `saidas/`
   como pasta ignorada pelo git. O histórico vai para `saidas/runs/<run_id>/events.jsonl`, com os CSV derivados. A
   divergência de nome é registrada aqui e não justifica uma segunda pasta.
4. **A cadeia causal é montada uma vez.** `controllers/results.py` produz a sequência Ação → Resposta → Observação →
   Adaptação como estrutura de dados; `main.py` imprime, `views/pages/rounds.py` exibe. Nenhum dos dois recalcula a
   cadeia nem formata regra de negócio.
5. **Sem Streamlit no caminho headless.** `models/`, `agents/` e `controllers/` não importam `streamlit`; o teste de
   fronteira da ADR-009 verifica isso. O `main.py` importa apenas o controller.
6. **Modo e falhas.** O default é `deterministic`; `adversarial_validation` exige a flag explícita e a chave no
   ambiente,
   e falha com mensagem clara quando ela não existe (ADR-003, ADR-009). Configuração inválida encerra com código de
   saída `2`, sem produzir saída parcial.
7. **Reprodutibilidade.** O `main.py` aceita `--seed` e registra `master_seed`, hash da configuração e `run_id` no
   cabeçalho do `events.jsonl`, como exige a ADR-007.

## Consequências

### Positivas

- A demo e a geração de evidências passam a caber em um comando determinístico, sem UI.
- Testes de integração das rodadas rodam na velocidade do controlador, sem sessão do Streamlit.
- O histórico em disco é produzido pelo mesmo código que a interface usa; "demo" e "teste" não divergem.
- Atende ao `main.py` do plano sem reabrir a decisão de interface.

### Negativas

- Passa a existir um segundo entrypoint. É fino, mas pode divergir da UI; a mitigação é chamar o mesmo caso de uso e
  manter `results.py` como única fonte da cadeia causal.
- Duas formas de apresentar o resultado (terminal e tela) para manter consistentes.
- O nome `logs/` do plano não é usado; quem procurar a pasta não a encontra.

### Neutras

- O `main.py` é o caminho natural para gerar as saídas citadas na análise de resultados e para o replay da ADR-007.
- A interface continua sendo o produto demonstrável; o CLI é o instrumento de evidência.

## Alternativas consideradas

- **Script ad hoc em `scripts/run.py`.** Rejeitado: cria uma segunda convenção de entrada além de `app.py` e `main.py`.
- **Testar o Streamlit com `AppTest`.** Rejeitado: mais frágil e mais lento que exercitar o controlador, e não gera
  histórico em disco sem adaptação.
- **Notebook como caminho de execução.** Rejeitado na ADR-008 e novamente aqui: não é determinístico nem versionável com
  facilidade.
- **Substituir o Streamlit pelo CLI.** Rejeitado: mantém a decisão da ADR-008, que a entrega pede demonstração
  funcional.
- **Manter `logs/historico_simulacao.json`.** Rejeitado: duplicaria a pasta de saída e o formato canônico definido na
  ADR-005.

## Referências

- Plano de Tarefas do Grupo 9, seções 2.1 e 2.6 (documento externo, não versionado).
- `docs/Enunciado.md`, requisitos 3, 4 e 5.
- ADR-003 (modo `adversarial_validation`), ADR-005 (saídas em `saidas/` e JSONL), ADR-007 (reprodutibilidade), ADR-008
  (Streamlit), ADR-009 (testes offline), ADR-010 (MVC e entrypoints), ADR-011 (protocolo da rodada).
- `AGENTS.md` §5 (nomes em inglês) e §6 (execução local, sem serviços externos).
