# ADR-003: LLM adversário no nível da tática, com catálogo fechado

## Status

Aceita — 18/11/2026

## Contexto

O grupo decidiu usar um **LLM externo** (chave via `.env`, adicionada posteriormente) como **bot atacante**, para
validar adversarialmente a proposta de defesa. O `Enunciado.md` exige "regras de decisão explícitas" e rejeita uma
sequência previamente roteirizada.

Um LLM livre traz três problemas para este trabalho:

1. **Regras não explícitas:** os pesos do modelo não são auditáveis, e o requisito 2 pede regras explícitas.
2. **Custo e latência:** uma chamada por conta inviabiliza centenas de contas por rodada.
3. **Não determinismo:** a mesma execução pode produzir resultados diferentes, dificultando a demonstração e os testes.

## Decisão

1. O bot escolhe entre um **catálogo fechado de táticas** declarado em `config/scenarios.json`. Cada tática tem `id`,
   descrição, pré-condições, parâmetros, custo e efeito esperado (ex.: `A1`, `A2-disposable-email`,
   `A2-virtual-sms`, `probing-single-signal`, `multi-signal-rotation`).
2. O LLM faz **uma chamada por rodada** (opcionalmente uma segunda para a adaptação) e devolve, via ferramenta
   `choose_tactic`, o `id` da tática e uma `justification`. O executor em Python aplica a tática a N contas de forma
   determinística.
3. A "regra de decisão" fica explícita no nível que o trabalho avalia: **observação → táticas elegíveis → escolha
   registrada**. O LLM não inventa ação nem parâmetro fora do esquema.
4. **Modos:**
    - `deterministic` (padrão): o bot escolhe a tática por regras; é o modo dos testes e do replay.
    - `adversarial_validation`: o bot usa o LLM externo; é o modo da demonstração de validação.
5. **Provedor e chave:** `ANTHROPIC_API_KEY` ou `GROQ_API_KEY` no `.env` (já ignorado pelo git). O provedor e o
   `model_id` ficam no `scenarios.json`; **nenhum segredo** entra no JSON, no CSV ou no repositório.
6. **Sem chave:** o modo `adversarial_validation` falha com mensagem clara; `uv run pytest` e o modo determinístico
   continuam funcionando.
7. **Observação não confiável:** o LLM recebe a resposta pública como campos estruturados e sanitizados, nunca como
   texto livre do motor. As respostas públicas são entrada adversarial e não podem virar instrução (mitigação de injeção
   de prompt).
8. **Transcript e replay:** cada execução grava modelo, versão, parâmetros, hash do prompt, observação, táticas
   elegíveis, tática escolhida, justification, tokens e latência em `saidas/`. O replay reexecuta o executor com as
   táticas gravadas, sem nova chamada ao LLM.

## Consequências

### Positivas

- Atende ao requisito de regras explícitas sem abrir mão do LLM.
- Custo de API baixo (uma chamada por rodada) e execução rápida.
- A escolha do LLM é auditável e reproduzível por replay.
- O bot continua vendo apenas respostas públicas — a separação de informação é preservada.

### Negativas

- O LLM pode escolher uma tática subótima ou repetir a anterior; a qualidade da validação depende do prompt e do
  catálogo.
- O modo adversarial não é bit a bit reproduzível; a reprodutibilidade vem do transcript e do modo determinístico.
- Introduz dependência de rede, custo e latência no modo de demonstração.
- O catálogo precisa ser mantido: uma tática nova muda o jogo e exige nova calibração.

### Neutras

- O catálogo de táticas vira o contrato entre o LLM e o executor.
- O `scenarios.json` passa a ter uma seção `llm` (provedor, modelo, temperatura, limite de chamadas).
- Testes que usam LLM ficam marcados e são pulados sem chave (ADR-009).

## Alternativas consideradas

- **LLM decidindo por conta:** rejeitado. Custo e latência altos, resultados não reproduzíveis e risco de centenas de
  chamadas por rodada.
- **LLM com uso livre de ferramentas:** rejeitado. Contraria "regras de decisão explícitas" e abre espaço para ações
  fora do escopo.
- **LLM apenas como juiz/avaliador:** rejeitado. O grupo quer o LLM como atacante, não como corretor.
- **Sem LLM:** rejeitado pela decisão do grupo; permanece como modo determinístico, não como único caminho.

## Referências

- `docs/Enunciado.md`, requisito 2 e aviso sobre sequência roteirizada.
- `docs/Trabalho1.md`, §4.5 e §5.2 (controles da AM3), §6.1 (separação de informação).
- `docs/Aula 10+11+12.pdf`, seções 2.2 (agente), 3.1 (ferramentas) e 5.1 (guardrails).
- ADR-002 (harness), ADR-007 (reprodutibilidade e replay).
