# ADR-007: Reprodutibilidade por fluxos de aleatoriedade independentes e replay

## Status

Aceita — 18/11/2026

## Contexto

O trabalho precisa de evidências que possam ser reproduzidas e explicadas na apresentação. O §6.4 exige sementes
registradas; o `AGENTS.md` exige "recorded seeds" e regras reproduzíveis.

Há duas fontes de variação:

1. **Aleatoriedade do simulador** — geração de clientes, escolha de sinais, tempos e custos.
2. **LLM adversário** — mesmo com `temperature=0`, a saída não é garantidamente idêntica entre execuções e provedores.

Se os dois agentes compartilharem um único gerador global, a ordem das chamadas de um afeta os números do outro, e a
reprodução quebra.

## Decisão

1. A configuração tem uma **`master_seed`**. Cada ator/concern recebe um fluxo independente derivado dela:
   `random.Random(f"{master_seed}:{stream}")`, com streams nomeados (`scenarios`, `bot`, `engine`, `review`, `costs`).
2. **Nenhum uso de `random` global** no código de domínio; o gerador é injetado explicitamente.
3. Toda execução registra `run_id`, `master_seed`, hash da configuração, versão do Python, do Agno e do modelo externo
   (quando houver).
4. **Modo determinístico é a referência.** Os testes, o replay e a evidência principal das três rodadas usam esse modo.
5. **Modo `adversarial_validation`** grava um transcript com modelo, versão, parâmetros, hash do prompt, observação,
   táticas elegíveis, tática escolhida, justification, tokens e latência. O replay reexecuta o executor com as táticas
   gravadas, sem nova chamada ao LLM.
6. Desempates e ordenações usam chaves explícitas (nunca a ordem de um `set` ou de um `dict` não ordenado).
7. O evento `bot_cost_recorded` e a contabilidade de orçamento têm **um único ponto de débito** (ver ADR-009), para
   não contar o mesmo custo duas vezes.

## Consequências

### Positivas

- Mesma seed + mesma configuração ⇒ mesma sequência de eventos no modo determinístico.
- O replay do transcript permite auditar a validação adversarial sem depender do provedor.
- A separação de fluxos evita que uma mudança no bot altere os números do motor.

### Negativas

- Exige disciplina para injetar o gerador em todos os módulos; um `random.random()` esquecido quebra a reprodução.
- O modo adversarial não é bit a bit reproduzível; a garantia é o transcript + replay.
- O transcript pode crescer e precisa de política de retenção.

### Neutras

- O hash da configuração amarra a saída ao JSON exato que a gerou.
- A seed é um parâmetro de configuração, não um segredo.

## Alternativas consideradas

- **Um único `random` global:** rejeitado. Acopla os atores e quebra a reprodução quando a ordem muda.
- **Confiar em `temperature=0`:** rejeitado. Não é garantia entre provedores/versões e não cobre o executor.
- **Gravar apenas o resultado final:** rejeitado. Não permite auditar a adaptação nem refazer a análise.
- **Replay de toda a chamada ao LLM:** rejeitado. Custa e não é determinístico; o replay das táticas é suficiente para a
  análise.

## Referências

- `AGENTS.md` (seeds e reprodutibilidade).
- `docs/Trabalho1.md`, §6.3 (registro de eventos) e §6.4 (sementes).
- `docs/Enunciado.md`, requisito 5 (evidências).
- ADR-003 (LLM e transcript), ADR-005 (configuração).
