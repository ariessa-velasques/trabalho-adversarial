# ADR-004: Simulador de rodadas síncrono com relógio virtual

## Status

Aceita — 18/11/2026

## Contexto

O §6.3 do Trabalho 1 lista eventos com rodada e instante simulado, e o §6.2 fala em "controlador de rodadas" que "ordena
eventos, avança o tempo simulado, executa ações dos clientes sintéticos e mantém o estado entre rodadas".

O escopo é um protótipo local, em um único processo, com pelo menos três rodadas conectadas. Não há requisito de
concorrência real, múltiplos serviços ou tempo real.

## Decisão

1. O `controllers/rounds.py` implementa um **laço síncrono**: cada rodada representa uma janela simulada (padrão de 7
   dias) e avança um **relógio virtual** em passos fixos.
2. As ações são ordenadas por uma chave explícita `(rodada, instante, ator, sequência)`. Não há threads, `async` nem
   fila de eventos genérica.
3. O ciclo de cada rodada é: **observação → decisão dos agentes → execução no checkout → registro de eventos →
   fechamento e adaptação**.
4. O estado persiste entre rodadas. Uma conta que concluiu a primeira compra **nunca** volta a ser elegível.
5. **Modo guiado:** um `Script` força os gatilhos da sequência **AM1 → AM2 → AM3** nas rodadas configuradas, e cada
   mudança forçada é registrada como `programada`. **Modo adaptativo:** os gatilhos vêm apenas das observações; nenhuma
   sequência é garantida.
6. O modo guiado é didático e nunca é a única evidência da demo: o modo adaptativo é o padrão da avaliação.

## Consequências

### Positivas

- Simples de implementar, testar e explicar; o determinismo é natural.
- O relógio virtual permite comparar rodadas e medir velocidade de resgates sem espera real.
- A ordenação explícita elimina condições de corrida e resultados dependentes de escalonamento.
- O modo guiado atende à apresentação didática sem contaminar o modo adaptativo.

### Negativas

- Não modela concorrência real entre contas; a ordem das ações é uma simplificação.
- Rodadas de 7 dias são uma granularidade grossa; fenômenos intra-rodada só aparecem via instante simulado.
- O `Script` do modo guiado precisa ser mantido em sincronia com o catálogo de táticas (ADR-003).

### Neutras

- O "tempo" é uma variável do simulador, não `datetime.now()`.
- O fechamento da rodada é o ponto natural de adaptação dos dois agentes.

## Alternativas consideradas

- **Simulação de eventos discretos (ex.: SimPy):** rejeitada. Over-engineering para três a N rodadas; adiciona
  dependência e complexidade de teste sem ganho no escopo.
- **`asyncio`/threads:** rejeitado. Não há I/O concorrente relevante e o não determinismo atrapalha a reprodução.
- **Tempo real (uma rodada = uma semana de calendário):** rejeitado. Inviável para demonstração e para testes.

## Referências

- `docs/Trabalho1.md`, §6.2 (controlador de rodadas) e §6.3 (eventos).
- `docs/Enunciado.md`, requisito 3 (rodadas conectadas).
- ADR-005 (estado), ADR-007 (reprodutibilidade).
