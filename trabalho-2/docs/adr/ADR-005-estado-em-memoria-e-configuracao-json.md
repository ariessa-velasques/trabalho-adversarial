# ADR-005: Estado em memória, configuração em JSON e saídas em JSONL/CSV

## Status

Aceita — 18/11/2026 — emendada em 20/11/2026: log de eventos em **JSONL** como fonte canônica e CSV como tabela
derivada (item 5).

## Contexto

O simulador roda em um único processo local e precisa ser reproduzível, fácil de demonstrar e de inspecionar. O §6.4
determina que "os parâmetros ficam em `config/scenarios.json`; a lógica permanece nos módulos" e que os CSV vão para
`saidas/`, fora do controle de versão.

Não há requisito de persistência entre execuções, múltiplos usuários ou consultas relacionais.

## Decisão

1. O estado de domínio é mantido **em memória**, com `dataclasses` em `models/entities.py` (`Account`, `Order`,
   `Attempt`, `Decision`, `Redemption`, `Policy`, `Event`, `SimulationState`).
2. O `SimulationState` é criado e possuído pelo `controllers/rounds.py` e passado explicitamente aos componentes. Não há
   estado global mutável.
3. A configuração fica em **`config/scenarios.json`**: `rounds`, `budget`, `thresholds`, `costs`, `seeds`, `modes`,
   `tactics` e `llm`. O carregamento, em `models/config.py`, valida o esquema e falha com mensagem clara.
4. **Sem banco de dados.** O `db`/memória do Agno **não** é usado como fonte de verdade do domínio; se usado para
   depuração, fica desligado por padrão.
5. As saídas vão para **`saidas/runs/<run_id>/`**: `events.jsonl` (fonte canônica, *append-only*, um evento por linha),
   `metrics.csv`, `redemptions.csv`, `attempts.csv` e `llm_transcript.json`, todos referenciando `run_id` e o hash da
   configuração. A pasta é ignorada pelo git.
6. Nenhum parâmetro de negócio fica hard-coded em módulo; constantes só existem como default documentado e são
   sobrescritas pela configuração.
7. **O JSONL é a fonte; o CSV é derivado.** O log de eventos é escrito durante a execução; os CSV são gerados a partir
   dele no fechamento da rodada. Nenhum dado existe apenas no CSV.

## Consequências

### Positivas

- Execução simples, sem infraestrutura, e inicialização instantânea.
- O JSON é diffável, versionável e legível na apresentação.
- Os CSV permitem análise externa (pandas/planilha) sem acoplar o simulador a um banco.
- O JSONL preserva a ordem dos eventos, permite *append* durante a rodada e serve de entrada direta para o replay
  (ADR-007).
- O estado explícito facilita os testes de persistência entre rodadas.

### Negativas

- Não há retomada de uma execução após fechar o processo; cada run começa do zero.
- Configuração inválida só é detectada no carregamento, não em tempo de edição.
- O esquema dos CSV vira um contrato informal e precisa de teste.
- Dois formatos para o mesmo conteúdo: o CSV precisa continuar sendo derivado do JSONL, sob pena de divergirem.

### Neutras

- O `run_id` e o hash da configuração amarram cada saída à execução que a produziu.
- O `historico_simulacao.json` pedido pelo Plano de Tarefas corresponde ao `events.jsonl`; muda o nome e o formato de
  escrita, não o conteúdo.
- A ausência de banco é uma escolha de escopo, não uma limitação técnica permanente.

## Alternativas consideradas

- **SQLite:** rejeitado. Adiciona esquema, migração e estado oculto sem necessidade para um protótipo de rodada única.
- **YAML/TOML:** rejeitado. O §6.4 pede JSON; JSON é biblioteca padrão e não adiciona dependência.
- **Parâmetros por variável de ambiente:** rejeitado. Dificulta a reprodução e o registro do que foi executado.
- **Um único `historico_simulacao.json` reescrito ao final:** rejeitado como formato canônico. Reescreve o arquivo
  inteiro a cada rodada, perde o parcial se a execução for interrompida e não permite leitura incremental no replay. O
  JSONL mantém o mesmo conteúdo com escrita contínua.
- **Persistir o estado no `db` do Agno:** rejeitado. Mistura estado de domínio com sessão do framework e enfraquece a
  separação de informação.

## Referências

- `docs/Trabalho1.md`, §6.2 (componentes) e §6.4 (configuração e saídas).
- `AGENTS.md` (CSV em `saidas/`, fora do versionamento).
- ADR-006 (separação de informação), ADR-007 (reprodutibilidade), ADR-010 (MVC simples).
