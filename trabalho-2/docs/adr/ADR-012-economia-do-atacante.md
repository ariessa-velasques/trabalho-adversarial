# ADR-012: Economia do atacante — orçamento de ataque, custo por tática e recuo por ROI

## Status

Aceita — 20/11/2026 — nova. Detalha a ADR-011 §7 e registra a contribuição do Plano de Tarefas do Grupo 9.

## Contexto

O **Plano de Tarefas do Grupo 9** (documento externo, não versionado) atribui ao Agente A um controle econômico próprio:
orçamento de ataque, lucro líquido acumulado, custos distintos por tática (e-mail descartável ≈ R$ 0, número virtual de
SMS + CPF ≈ R$ 5, emulador + endereço variado ≈ R$ 12) e **recuo para A1 quando o custo por conta aprovada supera
R$ 20**.

A ADR-011 define o que o bot observa e quais gatilhos trocam a tática, mas não define a **contabilidade**. Sem ela:

- o gatilho de recuo não é testável nem auditável;
- o custo da sondagem (AM3) desaparece, e é justamente ele que encarece o ataque;
- as métricas correm o risco de **dupla contagem** de desconto, comissão e custo do bot.

O Trabalho 1 fixa os valores de referência (§3): desconto de **R$ 20**, comissão de **20% sobre R$ 30 = R$ 6**,
`c ≈ R$ 0` na rodada 1 e `c ≈ R$ 5` na rodada 2. O §4.4 usa "c perto ou acima de R$ 20" como fronteira de viabilidade
do ataque, e o §3 fecha a rodada 3 com `c ≈ R$ 8` na sondagem.

## Decisão

1. **Duas contas separadas, nunca somadas.** O simulador mantém dois registros independentes:

   | Conta | Fórmula | Quem usa |
               |---|---|---|
   | **Atacante** | `net_bot = 20 × resgates_concluídos − Σ custo(tática) por tentativa` | bot (só o próprio acumulado) e avaliador |
   | **Plataforma** | `budget_debit = 20 × resgates`; `commission = 6 × pedidos_concluídos`; `net_loss = debit − commission` | motor (apenas o orçamento consumido) e avaliador |

   A perda líquida da plataforma é **R$ 20 − R$ 6 = R$ 14 por resgate fraudulento**. Esse número **não** é a receita do
   bot e **não** entra no gatilho de recuo. Como a comissão também é creditada em pedidos legítimos, a perda **atribuída
   à fraude** é isolada pelo avaliador na coorte fraudulenta; o motor só vê o orçamento consumido.

2. **O custo é cobrado por tentativa, não por sucesso.** Uma tentativa recusada já consumiu o insumo comprado. Por isso
   o indicador de decisão é o **custo por conta aprovada**, que carrega o custo afundado das recusas:

   ```text
   spend(r)             = Σ custo(tática) das tentativas da rodada r
   net_bot(r)           = 20 × resgates(r) − spend(r)        # por rodada
   net_bot_acumulado    = Σ net_bot(r)                        # entre rodadas
   cost_per_approved(r) = spend(r) / approvals(r)             # approvals(r) > 0
   roi(r)               = net_bot_acumulado / Σ spend(r)      # indefinido se Σ spend(r) = 0
   ```

   É essa definição que faz a AM3 doer: ao forçar mais tentativas por aceite, o motor eleva `cost_per_approved` sem
   tocar no preço unitário de nenhum insumo.

3. **Custo por tática é configuração** (`costs.tactics` em `config/scenarios.json`, ADR-005). Defaults:

   | Tática | Sinais | Custo por tentativa | Origem |
               |---|---|---|---|
   | `email_disposable` | e-mail descartável, variações `nome+N` | R$ 0,00 | AM1 / Trabalho 1 §3 |
   | `virtual_sms_cpf` | número virtual de SMS + CPF vazado | R$ 5,00 | AM2 / Trabalho 1 §3 (≈ R$ 3 + R$ 2) |
   | `emulator_address` | emulador com novo device ID + endereço variado | R$ 12,00 | Plano de Tarefas (extensão) |

   Os R$ 8 do Trabalho 1 §3 e os R$ 12 do plano **não são o mesmo número**: o primeiro é o custo da rodada de sondagem,
   em que parte dos insumos já foi comprada; o segundo é o custo cheio de uma conta nova com emulador e endereço. A
   reconciliação é calibração (ver "Decisões em aberto" em `ADRs.md`), não código.

4. **Gatilho de recuo.** Ao fim da rodada, se
   `cost_per_approved ≥ 20 × (1 − safety_margin)` — default `safety_margin = 0`, limite configurado em
   `thresholds.bot.retreat_cost_per_approved = 20.00` — o bot **recua para A1 e pausa a operação em escala** na rodada
   seguinte. O gatilho acionado, o valor observado e a decisão ficam registrados como evidência (ADR-011 §9).

5. **Orçamento de ataque próprio.** O bot tem um teto de gasto configurável (`budget.attack`), independente do
   orçamento de aquisição de R$ 100.000 da plataforma. O teto é uma restrição operacional do atacante; o orçamento da
   plataforma é um ativo observado apenas de forma agregada pelo motor.

6. **Separação de informação.** O custo do bot, o lucro acumulado, a tática ativa e o orçamento de ataque **não** são
   projetados para o motor nem para a revisão (ADR-006). O motor vê apenas sinais, relações, limites e o orçamento
   consumido. O avaliador é o único que consolida as duas contas.

7. **Sem dupla contagem.** Desconto concedido é debitado **uma vez**, na conclusão do pedido; comissão é creditada uma
   vez, no mesmo evento; custo do bot é debitado por tentativa, no ato do cadastro. Nenhuma métrica recalcula esses
   valores a partir de outra métrica.

## Consequências

### Positivas

- O recuo para A1 deixa de ser narrativa e passa a ser um limiar testável, com evidência por rodada.
- O custo da sondagem fica visível: a defesa da AM3 aparece como **aumento de `cost_per_approved`**, exatamente o
  mecanismo que responde à pergunta central do Enunciado.
- Duas contas explícitas eliminam a confusão entre "quanto o bot ganhou" e "quanto a plataforma perdeu".
- O ROI por rodada é comparável entre cenários B1, B2 e redesenho, sem recalcular nada à mão.

### Negativas

- O modelo é linear: ignora desconto por volume, custo de tempo e ferramentas, e assume oferta infinita de CPFs e
  números virtuais.
- A receita fixa de R$ 20 por resgate não conta outros ganhos do atacante (revenda, cashback, uso do pedido).
- Com poucas tentativas por rodada, `cost_per_approved` é ruidoso e pode disparar o recuo cedo demais.
- Exige que toda tentativa seja registrada com a tática que a originou; sem isso o custo não é atribuível.

### Neutras

- O teto de ataque raramente é o limitante no protótipo; o limitante é o custo por aprovação.
- A fronteira de R$ 20 vem do Trabalho 1 §4.4 e coincide com o plano; não é um valor calibrado.

## Alternativas consideradas

- **Cobrar custo só por sucesso.** Rejeitado: esconde o custo da sondagem e apaga o efeito da AM3, que é o foco do
  trabalho.
- **Orçamento único, compartilhado entre bot e plataforma.** Rejeitado: mistura ativos diferentes e viola a separação de
  informação (ADR-006).
- **Custo fixo por conta, igual para todas as táticas.** Rejeitado: elimina a diferença econômica entre AM1 e AM2, que é
  o que explica a mudança de comportamento do bot.
- **Limiar de recuo em R$ 14 (perda líquida da plataforma).** Rejeitado: mede outro ator. Usar R$ 14 faria o bot recuar
  tarde, porque sua receita por resgate continua sendo R$ 20.
- **Otimização ou aprendizado por reforço do bot.** Rejeitado na ADR-011: não é explicável nem reproduzível no prazo.

## Referências

- Plano de Tarefas do Grupo 9, seções 2.2, 2.4 e 2.5 (documento externo, não versionado).
- `docs/Trabalho1.md`, §3 (custos por rodada e balanço), §4.4 (fronteira de viabilidade `c ≈ R$ 20`) e §4.5 (AM3).
- ADR-005 (custos e parâmetros em `config/scenarios.json`), ADR-006 (separação de informação), ADR-011 (gatilhos e
  evidência por rodada).
- `AGENTS.md` §6 e §8 (orçamento debitado na conclusão; métricas sem dupla contagem).
