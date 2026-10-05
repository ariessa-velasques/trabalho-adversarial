# Trabalho 1 — Análise de um Sistema Adversarial

**Sistema analisado:** aplicativo de delivery de comida (hipotético: _PedeJá_) — **Interação:** resgate do cupom de
desconto de primeira compra (`BEMVINDO`)

**Grupo 9**

| Integrante                               | GitHub             |
|------------------------------------------|--------------------|
| Ariessa Velasques Oliveira               | @ariessa-velasques |
| Maria Eduarda Sanchez Chessio            | @mariasanchez0     |
| Mirieli Rodrigues dos Santos de Oliveira | @mirielii          |
| Vitoria Pereira Garcia                   | @vitoriapgarcia7   |
| Guilherme Jaques                         | @Novato320         |
| Eduardo Dutra Ferreira                   | @ed-dferreira      |

**Links:** [Slides (PDF)](_[link do Google Drive]_) · [Vídeo (YouTube)](_[link]_)

> **Pergunta central:** O que torna esse sistema adversarial, como os participantes tomam decisões e como a interação
> evolui ao longo das rodadas?

## Sumário

0. [Ficha do sistema (decisão do grupo)](#0-ficha-do-sistema-decisão-do-grupo)
1. [Descrição do sistema adversarial](#1-descrição-do-sistema-adversarial)
2. [Modelo estratégico estático](#2-modelo-estratégico-estático)
3. [Modelo estratégico dinâmico](#3-modelo-estratégico-dinâmico)
4. [Ameaças e riscos](#4-ameaças-e-riscos)
5. [Redesenho e resiliência](#5-redesenho-e-resiliência)
6. [Arquitetura proposta para o Trabalho 2](#6-arquitetura-proposta-para-o-trabalho-2)
7. [Conclusão: pergunta final](#7-conclusão-pergunta-final)
8. [Fundamentação conceitual](#8-fundamentação-conceitual)
9. [Referências](#9-referências)
10. [Declaração de uso de IA generativa](#10-declaração-de-uso-de-ia-generativa)
11. [Contribuições individuais](#11-contribuições-individuais)

---

## 0. Ficha do sistema (decisão do grupo)

> Preenchida em conjunto na reunião inicial. **Todas as seções usam estes nomes** — não renomeiem atores, ativos ou
> ações sem atualizar esta ficha.

| Item                                       | Decisão                                                                                                                                                                                                                                                                                                                                  |
|--------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Sistema                                    | **PedeJá**, aplicativo hipotético de delivery de comida que conecta clientes a restaurantes parceiros.                                                                                                                                                                                                                                   |
| Interação específica                       | **Resgate do cupom `BEMVINDO`**: toda conta nova recebe R$ 20 de desconto no primeiro pedido acima de R$ 30. O desconto é custeado pela plataforma.                                                                                                                                                                                      |
| Ator/jogador A (adversário)                | **Bot caçador de cupons**: agente de software (script automatizado, operado por um fraudador) que cria contas e tenta resgatar o `BEMVINDO` repetidas vezes, ajustando sua estratégia conforme as respostas do checkout.                                                                                                                 |
| Ator/jogador B (defensor/sistema)          | **Motor antifraude do PedeJá**: agente de software que avalia cada cadastro e resgate, escolhe o nível de verificação e decide se o cupom é aceito, ajustando suas regras conforme as métricas observadas.                                                                                                                               |
| Outros atores (humanos, não são jogadores) | **Fraudador**: opera e configura o bot. **Equipe de produto/marketing**: define o orçamento do cupom e cobra conversão. **Cliente novo legítimo**: quer usar o cupom uma única vez, com o mínimo de atrito. **Restaurante parceiro**: recebe os pedidos e ganha com o volume, mas não paga o cupom.                                      |
| Ativo ou propriedade preservada            | **Distribuição justa do orçamento de aquisição**: um desconto por pessoa real. Secundários: a experiência de cadastro do cliente legítimo (conversão) e a confiança nos dados de cadastro.                                                                                                                                               |
| Regra/métrica explorável                   | "Um cupom **por conta**", sendo que conta nova = e-mail ainda não cadastrado. A regra pressupõe 1 conta = 1 pessoa.                                                                                                                                                                                                                      |
| Resposta observável                        | O cupom é **aceito** ou **recusado**, com a mensagem exibida no checkout ("cupom válido apenas para primeira compra", "verifique seu telefone"...); a conta pode ser bloqueada; o sistema pode pedir verificações extras.                                                                                                                |
| Decisão central do jogo (A1/A2 × B1/B2)    | **A1** = **conta única**: o bot opera uma só conta, com comportamento igual ao de um cliente legítimo (não ataca); **A2** = criar contas falsas para resgatar o cupom várias vezes (**multicontas**). **B1** = **verificação leve** (só e-mail); **B2** = **verificação rígida** (SMS no telefone + CPF + identificação do dispositivo). |
| Fora do escopo                             | Pagamento e fraude de cartão, entrega e entregadores, avaliações de restaurantes, programa de fidelidade, outros cupons, ataques à infraestrutura (DoS, invasão).                                                                                                                                                                        |

**Vocabulário comum (usar exatamente estes termos em todas as seções):**

| Termo                     | Significado                                                                      |
|---------------------------|----------------------------------------------------------------------------------|
| cupom `BEMVINDO`          | desconto de R$ 20 na primeira compra acima de R$ 30                              |
| conta                     | cadastro no PedeJá (e-mail + senha; na verificação rígida também telefone e CPF) |
| multicontas               | várias contas controladas pela mesma pessoa                                      |
| verificação leve / rígida | ações B1 / B2                                                                    |
| sinais de identidade      | e-mail, telefone, CPF, dispositivo, endereço de entrega, cartão                  |
| resgate                   | aplicação do cupom a um pedido concluído                                         |
| bot / motor antifraude    | os dois agentes de software que jogam o jogo (A e B)                             |

**Âncoras de rastreabilidade (IDs fixos — todas as seções referenciam estes IDs; cada seção detalha, mas não renomeia
nem remove):**

> As ameaças usam o prefixo **AM** para não confundir com as ações **A1/A2** do jogo.

| ID | Pressuposto                                                                      | Como pode falhar                                                                                                                                                                      |
|----|----------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| P1 | Cada conta corresponde a uma pessoa real diferente (e-mail novo = cliente novo). | E-mails descartáveis e variações do mesmo e-mail (`nome+1@...`) permitem criar contas em massa a custo quase zero.                                                                    |
| P2 | Telefone, CPF e dispositivo são caros ou difíceis de obter em quantidade.        | Chips pré-pagos, números virtuais de SMS, CPFs vazados de terceiros e emuladores ou reset do identificador do aparelho reduzem esse custo.                                            |
| P3 | Um mesmo dispositivo ou endereço de entrega indica a mesma pessoa.               | Famílias, repúblicas e colegas de trabalho compartilham aparelho e endereço (**falso positivo** contra o cliente legítimo); o bot varia endereços (vizinho, portaria, ponto próximo). |

| ID  | Ponto de exploração                                                                   | Tipo                        |
|-----|---------------------------------------------------------------------------------------|-----------------------------|
| PE1 | Formulário de cadastro de conta (e verificação de telefone/CPF na verificação rígida) | Interface                   |
| PE2 | Regra de elegibilidade do cupom no checkout ("uma vez por conta")                     | Regra                       |
| PE3 | Mensagens de recusa e de pedido de verificação exibidas no checkout                   | Fluxo / resposta observável |

| ID  | Ameaça (resumo)                                                                                                                 | Ponto    | Pressuposto ou fraqueza                      | Ativo afetado                                                                                 |
|-----|---------------------------------------------------------------------------------------------------------------------------------|----------|----------------------------------------------|-----------------------------------------------------------------------------------------------|
| AM1 | Bot caçador de cupons cria contas em massa com e-mails descartáveis e resgata o `BEMVINDO` em cada uma                          | PE1, PE2 | P1                                           | Orçamento de aquisição (distribuição justa)                                                   |
| AM2 | Bot caçador de cupons passa pela verificação rígida usando números virtuais, CPFs de terceiros e aparelhos emulados             | PE1      | P2                                           | Orçamento de aquisição; confiança nos dados de cadastro                                       |
| AM3 | Bot caçador de cupons testa variações e lê as mensagens de recusa para descobrir qual sinal o denunciou, trocando só esse sinal | PE3      | Fraqueza: mensagens de recusa detalhadas; P3 | Eficácia da defesa; experiência do cliente legítimo (defesa endurece e gera falsos positivos) |

---

## 1. Descrição do sistema adversarial

> Responsável: **Ariessa**

### 1.1 Sistema e interação analisada

O **PedeJá** é um aplicativo hipotético de delivery de comida que conecta clientes a restaurantes parceiros. A
plataforma ganha uma comissão sobre cada pedido e, para atrair novos clientes, oferece o cupom **`BEMVINDO`**:
**R$ 20 de desconto no primeiro pedido acima de R$ 30**, pago com o orçamento de aquisição da própria plataforma (o
restaurante recebe o valor cheio).

O sistema de delivery como um todo não é o objeto da análise. O trabalho se concentra **em uma única interação: o
resgate do cupom `BEMVINDO`**, que segue este fluxo:

1. uma **conta** é criada no PedeJá (na verificação leve, apenas e-mail e senha);
2. no primeiro pedido, o cupom `BEMVINDO` é aplicado no checkout;
3. o **motor antifraude** avalia a conta e os **sinais de identidade** disponíveis (e-mail, telefone, CPF, dispositivo,
   endereço de entrega, cartão);
4. o motor **aceita** o cupom, **recusa** o cupom (com uma mensagem no checkout) ou **pede uma verificação extra** (por
   exemplo, código por SMS);
5. se o pedido for concluído com desconto, ocorre o **resgate**.

A regra de negócio central é **"um cupom por conta"**. Ela foi pensada para "um cupom por pessoa", mas o sistema só
consegue verificar contas. É nessa diferença entre **conta** e **pessoa** que surge o conflito: um **bot caçador de
cupons** automatiza a criação de contas para resgatar o cupom várias vezes, e o motor antifraude tenta distinguir essas
contas das de clientes novos legítimos sem afastá-los.

Valores de referência (hipotéticos, usados em todo o trabalho):

| Parâmetro                         | Valor                         |
|-----------------------------------|-------------------------------|
| Desconto do `BEMVINDO`            | R$ 20 por resgate             |
| Pedido mínimo                     | R$ 30                         |
| Orçamento mensal de aquisição     | R$ 100.000 (≈ 5.000 resgates) |
| Comissão da plataforma por pedido | 20% do valor do pedido        |

### 1.2 Atores, objetivos e ativos

Os **dois jogadores** da interação são **agentes de software**: o **bot caçador de cupons** (jogador A) e o **motor
antifraude** (jogador B). Os demais atores são pessoas ou organizações que configuram os agentes ou sofrem as
consequências das decisões deles, mas não jogam diretamente.

**Ativo principal — distribuição justa do orçamento de aquisição.** O orçamento do `BEMVINDO` existe para trazer
**pessoas novas** para a plataforma; cada resgate feito por uma conta falsa é dinheiro que não gera um cliente real e
reduz o número de cupons disponíveis para clientes legítimos.

**Ativos secundários:**

- **Experiência de cadastro do cliente legítimo (conversão):** cada verificação extra aumenta o atrito, e parte dos
  clientes reais desiste no meio do caminho.
- **Confiança nos dados de cadastro:** as métricas da plataforma (clientes novos, custo de aquisição) e as próprias
  decisões do motor antifraude dependem de os cadastros corresponderem a pessoas reais.
- **Privacidade dos dados pessoais:** o motor coleta telefone, CPF e identificação do dispositivo; e o bot pode usar
  **CPFs de terceiros** obtidos em vazamentos, envolvendo pessoas que nem participam da interação.

Esses ativos **competem entre si**: proteger o orçamento com verificações mais rígidas prejudica a conversão e aumenta a
coleta de dados pessoais. Por isso o motor antifraude não pode simplesmente "verificar tudo ao máximo".

| Ator                                            | Objetivo                                                                                          | Ações ou capacidades                                                                                                                                                                                                                             | Informações observáveis                                                                                                                                                                                             | Restrições ou custos                                                                                                                                                                                                           |
|-------------------------------------------------|---------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Bot caçador de cupons** (jogador A, software) | Maximizar o número de resgates do `BEMVINDO` com o menor custo por conta                          | Criar contas em lote; gerar e-mails descartáveis ou variações (`nome+1@...`); usar números virtuais de SMS e CPFs de terceiros; trocar o identificador do dispositivo (emulador); variar o endereço de entrega; repetir tentativas com variações | Se o cupom foi aceito ou recusado; o texto das mensagens de recusa e de verificação; quais verificações são pedidas e em que momento; se a conta foi bloqueada; taxa de sucesso por tipo de conta                   | Cada resgate exige um pedido real de pelo menos R$ 30 (o bot paga R$ 10 ou mais); números de SMS e CPFs têm custo e se esgotam; contas bloqueadas são perdidas; tempo de configuração e manutenção do script                   |
| **Motor antifraude** (jogador B, software)      | Garantir **um cupom por pessoa real**, recusando multicontas sem afastar clientes novos legítimos | Escolher o nível de verificação (leve ou rígida); pedir SMS e CPF; identificar o dispositivo; recusar o cupom; bloquear contas; ajustar limites e regras a partir das métricas; escolher o texto da mensagem de recusa                           | Sinais de identidade de cada conta; histórico de cadastros e resgates; volume de contas por dispositivo, endereço e cartão; taxas de aprovação, recusa e desistência no checkout; reclamações de clientes recusados | Custo de cada SMS e consulta de CPF; queda de conversão a cada verificação extra; **falsos positivos** (clientes reais recusados); **falsos negativos** (resgates fraudulentos aceitos); limites da LGPD sobre coleta de dados |
| **Fraudador** (humano, operador do bot)         | Obter comida com desconto ou revender pedidos com desconto                                        | Configurar, pausar e reprogramar o bot; comprar números e CPFs; escolher quantas contas criar                                                                                                                                                    | Relatórios do bot (sucessos, recusas, mensagens)                                                                                                                                                                    | Dinheiro investido em infraestrutura do bot; risco de bloqueio e de responsabilização legal                                                                                                                                    |
| **Cliente novo legítimo** (humano)              | Usar o cupom **uma vez**, com o mínimo de atrito                                                  | Criar uma conta; informar telefone e CPF quando pedido; desistir do cadastro; reclamar no suporte                                                                                                                                                | Mensagens do checkout; pedidos de verificação                                                                                                                                                                       | Tempo e paciência limitados; pode compartilhar dispositivo ou endereço com outras pessoas (família, república)                                                                                                                 |
| **Equipe de produto/marketing** (humano)        | Adquirir muitos clientes novos dentro do orçamento                                                | Definir valor e orçamento do cupom; cobrar do motor antifraude menos atrito ou menos fraude                                                                                                                                                      | Métricas de aquisição, conversão e custo por cliente novo                                                                                                                                                           | Orçamento limitado; metas de crescimento                                                                                                                                                                                       |
| **Restaurante parceiro**                        | Receber mais pedidos                                                                              | Aceitar e preparar pedidos                                                                                                                                                                                                                       | Volume de pedidos                                                                                                                                                                                                   | Não controla o cupom; é pouco afetado diretamente (recebe o valor cheio)                                                                                                                                                       |

### 1.3 Pressupostos e como podem falhar

O motor antifraude só funciona se alguns pressupostos forem verdadeiros. Cada um deles pode falhar **por ação
intencional do bot** (e não apenas por acaso), e é daí que saem as ameaças da seção 4.

| ID | Pressuposto                                                                                                                                                                                              | Como pode falhar                                                                                                                                                                                                                                                                                                                                    |
|----|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| P1 | **Cada conta corresponde a uma pessoa real diferente.** A regra "um cupom por conta" só equivale a "um cupom por pessoa" se criar uma conta tiver algum custo para quem a cria.                          | Na verificação leve, uma conta nova depende só de um e-mail novo. O bot gera e-mails descartáveis ou variações do mesmo endereço (`nome+1@gmail.com`, `nome+2@gmail.com`) a custo praticamente zero, e cada um vira um "cliente novo" para o sistema.                                                                                               |
| P2 | **Telefone, CPF e dispositivo são caros ou difíceis de obter em quantidade.** A verificação rígida parte do princípio de que uma pessoa tem poucos números de telefone, um único CPF e poucos aparelhos. | Existem números virtuais que recebem SMS por alguns reais, chips pré-pagos baratos, listas de CPFs vazados e emuladores que geram um novo identificador de dispositivo a cada execução. O custo por conta sobe, mas pode continuar menor que os R$ 20 de desconto.                                                                                  |
| P3 | **Um mesmo dispositivo ou endereço de entrega indica a mesma pessoa.** O motor usa esses sinais para ligar várias contas a um único dono.                                                                | Falha nos **dois sentidos**: (a) pessoas diferentes compartilham aparelho e endereço (família, república, colegas de trabalho), e o motor recusa um **cliente legítimo** (falso positivo); (b) o bot varia o endereço (vizinho, portaria, ponto de retirada próximo) e troca o identificador do dispositivo, escapando da ligação (falso negativo). |

### 1.4 Diagrama de contexto

![Diagrama de contexto](diagramas/contexto.png)

Fonte editável: [`diagramas/contexto.mmd`](diagramas/contexto.mmd)

### 1.5 Por que é adversarial (e não apenas erro ou acidente)

Uma conta duplicada ou um cupom aplicado duas vezes nem sempre indicam um adversário. Três situações parecidas ajudam a
mostrar a diferença:

| Situação                                                                     | Tipo            | Por quê                                                                                                                      |
|------------------------------------------------------------------------------|-----------------|------------------------------------------------------------------------------------------------------------------------------|
| Cliente esquece a senha, cria uma segunda conta e usa o cupom de novo        | **Acidente**    | Não há intenção de explorar a regra nem adaptação: se o cupom for recusado, a pessoa simplesmente paga o valor cheio.        |
| Falha no código aplica o `BEMVINDO` duas vezes no mesmo pedido               | **Erro**        | O problema é do próprio sistema; corrigido o bug, ele não volta a acontecer. Ninguém do outro lado está tentando provocá-lo. |
| Bot cria 200 contas por semana e muda de tática quando começa a ser recusado | **Adversarial** | Há um agente com intenção, objetivo conflitante e capacidade de se adaptar.                                                  |

O resgate do `BEMVINDO` é adversarial porque reúne as características estudadas na disciplina:

1. **Dois agentes que tomam decisões:** o bot decide quantas contas criar e com quais sinais de identidade; o motor
   antifraude decide o nível de verificação e se aceita ou recusa o cupom.
2. **Objetivos conflitantes:** cada resgate fraudulento é um ganho para o bot e uma perda no orçamento da plataforma. O
   conflito é **parcial**, não total: um pedido feito com cupom fraudulento ainda gera comissão para a plataforma e
   venda para o restaurante. Por isso o motor não quer bloquear todo pedido suspeito a qualquer custo, e ainda precisa
   preservar a experiência do cliente legítimo.
3. **Regra explorável:** "um cupom por conta" depende de os pressupostos P1–P3 se manterem; o bot ganha exatamente
   quando consegue quebrá-los.
4. **Resposta observável e adaptação:** toda recusa, mensagem ou pedido de verificação **informa** o bot sobre o que foi
   detectado, e ele pode trocar a tática (e-mails descartáveis → números virtuais → emuladores). Da mesma forma, o motor
   observa as métricas de cadastros e resgates e ajusta as próprias regras. Nenhuma das duas decisões é tomada uma única
   vez: elas **evoluem em rodadas**, cada uma reagindo à anterior (seção 3).

Um erro ou acidente, uma vez corrigido, deixa de acontecer. Já aqui, **cada defesa muda o comportamento do outro lado**,
que é exatamente o que caracteriza um sistema adversarial.

---

## 2. Modelo estratégico estático

> Responsável: **Mirieli**

**Ordem do par:** `(payoff de A, payoff de B)` — escala: 3 = melhor, 0 = pior.

| Jogador A \ Jogador B | B1: Verificação leve | B2: Verificação rígida |
|-----------------------|---------------------:|------------------------:|
| **A1: Conta única**   | `(2, 3)` | `(1, 1)` |
| **A2: Multicontas**   | `(3, 0)` | `(2, 1)` |

### 2.1 O que representa cada ação

O **Jogador A** representa o bot, que busca maximizar a quantidade de cupons `BEMVINDO` obtidos, reduzindo o custo necessário para criar contas aceitas pelo sistema.

- **A1: Conta única:** o bot utiliza apenas uma conta e se comporta como um usuário legítimo, realizando apenas um resgate do cupom.
- **A2: Multicontas:** o bot cria várias contas para tentar resgatar o cupom `BEMVINDO` repetidamente.

O **Jogador B** representa o motor antifraude do PedeJá, que busca impedir o uso indevido do cupom sem prejudicar excessivamente os usuários legítimos.

- **B1: Verificação leve:** a plataforma realiza apenas uma verificação simples, utilizando o e-mail para validar a conta.
- **B2: Verificação rígida:** a plataforma utiliza verificações adicionais, como SMS, CPF e identificação do dispositivo.

### 2.2 Justificativa dos payoffs

- **A1 + B1 = `(2, 3)`:** o bot utiliza uma única conta e não realiza fraude. Para o bot, o benefício é limitado, pois consegue apenas um cupom. Para o motor antifraude, é uma situação favorável, pois há pouca necessidade de verificação e o cadastro é simples para usuários legítimos.

- **A1 + B2 = `(1, 1)`:** o bot utiliza apenas uma conta, mas precisa passar por uma verificação mais rígida. Isso aumenta o custo e a dificuldade do cadastro sem haver uma tentativa de fraude, prejudicando a experiência do usuário.

- **A2 + B1 = `(3, 0)`:** o bot consegue criar várias contas com facilidade e utilizar o cupom repetidamente. Essa é a melhor situação para o bot e a pior para o motor antifraude, pois o orçamento de aquisição é explorado por meio de multicontas.

- **A2 + B2 = `(2, 1)`:** o bot continua tentando utilizar multicontas, mas encontra mecanismos adicionais de verificação. O custo do ataque aumenta, reduzindo sua vantagem. Para o motor antifraude, a situação é melhor do que B1, pois a verificação rígida dificulta a fraude.

### 2.3 Melhores respostas

- Se B joga B1, a melhor resposta de A é **A2 (multicontas)**, pois `3 > 2`.
- Se B joga B2, a melhor resposta de A é **A2 (multicontas)**, pois `2 > 1`.
- Se A joga A1, a melhor resposta de B é **B1 (verificação leve)**, pois `3 > 1`.
- Se A joga A2, a melhor resposta de B é **B2 (verificação rígida)**, pois `1 > 0`.

### 2.4 Estratégia dominante

Para o **Jogador A**, a estratégia **A2 (multicontas)** é dominante, pois apresenta um payoff maior tanto quando o motor utiliza verificação leve quanto quando utiliza verificação rígida.

Para o **Jogador B**, não existe uma estratégia dominante, pois sua melhor escolha depende da ação do bot.

### 2.5 Equilíbrio (nenhum jogador melhora mudando sozinho)

O equilíbrio ocorre em **A2 + B2 = `(2, 1)`**.

Nesse cenário, o bot utiliza multicontas e o motor antifraude utiliza verificação rígida.

O bot não melhora ao mudar sozinho para A1, pois seu payoff cairia de `2` para `1`. Da mesma forma, o motor antifraude não melhora ao mudar sozinho para B1, pois seu payoff cairia de `1` para `0`.

Portanto, nenhum dos jogadores melhora sua situação alterando sua estratégia individualmente.

### 2.6 O equilíbrio é bom para o sistema e para usuários legítimos?

Não é um equilíbrio ideal para o sistema nem para os usuários legítimos.

Embora a verificação rígida dificulte a ação do bot, ela também aumenta a quantidade de verificações exigidas dos usuários. Isso pode gerar maior atrito no cadastro e dificuldades para usuários legítimos.

Assim, o equilíbrio representa uma situação de conflito entre o bot e o motor antifraude. O PedeJá precisa aumentar a proteção contra multicontas sem prejudicar excessivamente a experiência dos usuários legítimos.
---

## 3. Modelo estratégico dinâmico

> Responsável: **Vitoria**

A matriz da seção 2 é uma **fotografia**: mostra o que acontece em cada combinação de ações (A1/A2 × B1/B2). Aqui ela
vira um **filme**: as mesmas duas decisões são repetidas em rodadas, e em cada rodada os dois agentes (o **bot caçador
de cupons** e o **motor antifraude**) leem a resposta do outro antes de decidir de novo. Cada rodada corresponde a uma
janela de tempo (por exemplo, uma semana) em que o bot tenta resgatar o cupom `BEMVINDO` e o motor observa as métricas.
As três rodadas seguem a ordem **AM1 → AM2 → AM3** (pressupostos **P1 → P2 → P3**) da Ficha do sistema.

**Valores de referência (hipotéticos, coerentes com a seção 1):** desconto de R$ 20 por resgate; orçamento mensal de R$
100.000 (≈ 5.000 resgates); comissão de 20% sobre o pedido de R$ 30 (R$ 6). Seja **c** o custo do bot para criar uma
conta aceita: o ganho do bot por resgate é
**R$ 20 − c**, e o prejuízo líquido da plataforma por resgate fraudulento é ≈ **R$ 14** (R$ 20 de desconto − R$ 6 de
comissão). Estado inicial: verificação leve (B1) e mensagens de recusa detalhadas.

Ciclo: **ação → resposta → observação → adaptação**

|            Rodada | Ação do participante                                                                                                                                                                                                                            | Resposta do sistema ou defensor                                                                                                                                                                                                                                            | O que se torna observável?                                                                                                                                                                                                                                                                                                                                                                                        | Adaptação para a rodada seguinte                                                                                                                                                                                                                                                                                                                                       |
|------------------:|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 <br/>(AM1 / P1) | **Bot (A2, multicontas):** cria ≈ 200 contas em uma semana com e-mails descartáveis e variações `nome+N@...` e resgata o `BEMVINDO` em cada uma. Custo por conta ≈ R$ 0.                                                                        | **Motor em B1 (verificação leve):** só confere se o e-mail é novo; aceita todos os cupons.                                                                                                                                                                                 | **Bot:** 100% de aceitação, então e-mail novo basta e o checkout não olha dispositivo nem telefone. <br/>**Motor:** pico de cadastros vindos de poucos domínios e padrões `nome+N`, contas sem segunda compra, endereços de entrega repetidos; 200 resgates = R$ 4.000 (4% do orçamento mensal).                                                                                                                  | **Bot:** funcionou a custo ≈ 0, então mantém a tática e aumenta o volume. <br/>**Motor:** o pico dispara a mudança para **B2** (SMS + CPF + identificação do dispositivo). Mesmo objetivo (um cupom por pessoa), nova ação.                                                                                                                                            |
| 2 <br/>(AM2 / P2) | **Bot:** repete a tática e é barrado no pedido de telefone. Mantém o objetivo e **muda a ação**: números virtuais de SMS (≈ R$ 3), CPFs vazados (≈ R$ 2) e emulador com novo identificador de dispositivo a cada conta. **c sobe para ≈ R$ 5.** | **Motor em B2 (verificação rígida):** exige SMS, CPF e dispositivo; recusa contas que repetem telefone, CPF ou dispositivo. Para não frustrar clientes legítimos, **a mensagem de recusa é específica** ("este CPF já foi usado", "este dispositivo já resgatou o cupom"). | **Bot:** sabe quais sinais o checkout exige e **qual sinal foi recusado em cada tentativa** (a resposta virou informação); ainda lucra ≈ R$ 15 por resgate (R$ 20 − R$ 5). <br/>**Motor:** resgates fraudulentos caem, mas não a zero; aparecem faixas de números virtuais e o mesmo CPF em vários aparelhos. **Efeito colateral:** a conclusão do cadastro cai de 70% para 55% e o suporte recebe mais chamados. | **Bot:** como ainda compensa, não desiste; passa a **sondar**, trocando um sinal por vez e lendo a mensagem de recusa. <br/>**Motor:** acrescenta regras de ligação por **dispositivo e endereço** (P3) e bloqueia faixas de telefone virtual conhecidas. Mantém as mensagens detalhadas para reduzir reclamações (o que abre a rodada 3).                             |
| 3 <br/>(AM3 / P3) | **Bot:** cada conta nova varia **um único sinal** em relação à anterior (novo dispositivo emulado; depois endereço do vizinho ou da portaria) e lê a recusa até achar a combinação aceita.                                                      | **Motor (regras por dispositivo/endereço):** recusa e informa qual sinal repetiu. As mesmas regras também recusam **famílias e repúblicas** que dividem aparelho ou endereço (**falso positivo**).                                                                         | **Bot:** a mensagem funciona como um **oráculo**: em poucas tentativas descobre que endereço e dispositivo são os sinais decisivos. <br/>**Motor:** sequências de tentativas em que só um campo muda (padrão de sondagem), mais reclamações e recusas concentradas em endereços compartilhados. Parte das contas do bot com endereços variados **ainda passa**.                                                   | **Bot:** troca vários sinais de uma vez e testa em maior volume (mais contas "queimadas" por resgate bem-sucedido, c ≈ R$ 8). <br/>**Motor:** substitui a mensagem detalhada por uma genérica ("não foi possível aplicar o cupom"), limita tentativas por dispositivo e sessão e cria um canal de contestação para falsos positivos (controles detalhados na seção 5). |

### Balanço de custos por rodada (valores hipotéticos)

| Rodada | Custo e ganho do bot                | Custo do motor                                                                                              | Efeito sobre o cliente legítimo                                   | O que fica de herança para a rodada seguinte                                                                  |
|-------:|-------------------------------------|-------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
|      1 | c ≈ R$ 0; ganho ≈ R$ 20 por resgate | R$ 4.000 do orçamento em ≈ 200 resgates fraudulentos (prejuízo líquido ≈ R$ 2.800 já descontada a comissão) | Nenhum atrito                                                     | O motor ficou sabendo do padrão de e-mails e endereços; o bot ficou sabendo que B1 só olha o e-mail           |
|      2 | c ≈ R$ 5; ganho ≈ R$ 15 por resgate | SMS e consulta de CPF em **todo** cadastro (inclusive de legítimos); mais suporte                           | Conversão do cadastro 70% → 55%                                   | O motor não volta a B1 sem reabrir a fraude; as mensagens detalhadas já divulgadas criam a brecha da rodada 3 |
|      3 | c ≈ R$ 8; ganho ≈ R$ 12 por resgate | Falsos positivos, reclamações e atendimento; custo de manter regras por dispositivo/endereço                | Famílias e repúblicas recusadas; parte desiste do cupom ou do app | Mensagem genérica sem feedback obriga o bot a inferir pelo resultado binário (aceito/recusado)                |

### Como as rodadas cumprem o que o modelo dinâmico exige

- **A resposta também produz informação.** Rodada 1: a aceitação total ensina ao bot que e-mail novo basta. Rodada 2: a
  mensagem "este CPF já foi usado" revela qual sinal foi recusado. Rodada 3: a mesma mensagem vira um oráculo para a
  sondagem.
- **O bot mantém o objetivo e muda a ação.** O objetivo é sempre maximizar resgates com o menor custo; a ação vai de
  e-mails descartáveis → números virtuais, CPFs e emulador → sondagem de um sinal por vez → combinação de vários sinais.
- **O defensor também observa e se adapta.** O motor sai de B1 para B2 a partir de métricas agregadas (picos de
  cadastro, resgates sem segunda compra) e depois muda regras e mensagens a partir de falsos positivos e de padrões de
  sondagem.
- **Decisões passadas limitam as seguintes.** O motor não volta a B1 sem reabrir a rodada 1; contas, números e CPFs já
  usados ficam marcados; a escolha de mensagens detalhadas na rodada 2 é o que torna a rodada 3 possível.
- **A defesa tem custo para o legítimo.** Na rodada 2 a conversão cai 15 pontos percentuais; na rodada 3 surgem falsos
  positivos em endereços compartilhados.

A rodada 1 equivale à célula **(A2, B1)** da matriz estática e a rodada 2 à célula **(A2, B2)**; a rodada 3 não cabe em
uma célula, porque o bot passa a escolher suas ações **como sondagem**, para descobrir as regras do motor. É essa
diferença que o modelo dinâmico acrescenta.

### 3.1 Diagrama do ciclo adaptativo

![Ciclo adaptativo](diagramas/ciclo-adaptativo.png)

Fonte editável: [`diagramas/ciclo-adaptativo.mmd`](diagramas/ciclo-adaptativo.mmd)

### 3.2 Síntese

- **Quem observa quem?** O **bot observa o motor de forma ativa**: cada tentativa é um teste, e a resposta do checkout
  (aceito, recusado, mensagem, verificação pedida, conta bloqueada) chega na hora. O motor observa o bot de forma
  indireta: só enxerga rastros agregados (volume de cadastros, sinais repetidos, taxas de resgate, reclamações), e com
  atraso. Ele não sabe, de antemão, se uma conta é bot ou cliente legítimo.
- **O que cada lado consegue mudar?** O **bot** muda a fonte das contas (e-mail → telefone, CPF e dispositivo →
  endereço), o ritmo, o volume e a forma de testar. O **motor** muda o nível de verificação (B1/B2), as regras de
  ligação por dispositivo e endereço, os limites de tentativas, o texto das mensagens e o canal de contestação. Nenhum
  dos dois muda o que o outro controla: o bot não altera a regra "um cupom por conta" nem o valor do desconto; o motor
  não controla quem cria contas nem o custo de números e CPFs no mercado.
- **O que dispara uma adaptação?** **No bot:** uma recusa ou pedido de verificação novo, ou a queda do lucro por conta
  (R$ 20 − c) abaixo do esperado. **No motor:** pico de cadastros, resgates sem segunda compra, sinais repetidos (CPF,
  dispositivo, endereço) e, no sentido contrário, **queda de conversão e aumento de reclamações**, que o levam a
  afrouxar ou a mudar o texto das mensagens.
- **Qual é o custo da adaptação para cada lado?**

  | | Bot | Motor antifraude |
                          |-|-|-|
  | Custo da adaptação | Mais dinheiro por conta (R$ 0 → R$ 5 → R$ 8); contas e números "queimados"; tempo para reescrever o script | Custo de SMS e consulta de CPF em todo cadastro; engenharia e manutenção das regras; suporte; limites da LGPD sobre coleta de dados |
  | Quem mais paga | O fraudador | **Também o cliente legítimo** (atrito, falso positivo) e a equipe de produto (conversão) |

- **Em que ponto pode surgir uma corrida armamentista?** A partir da **rodada 2 para a 3**: cada lado passa a responder
  ao último movimento do outro com um movimento mais caro (verificação rígida → números virtuais; mensagens detalhadas →
  sondagem; mensagem genérica → testes em maior volume). O custo do bot sobe a cada rodada, mas só enquanto **c <
  R$ 20**: acima disso o resgate deixa de compensar e a corrida acaba. Já o custo do motor é pago por **todos** os cadastros, legítimos e fraudulentos, e cada endurecimento extra só se justifica enquanto a fraude evitada (≈ R$
  14 por resgate) for maior que o atrito causado. Se o mercado de números e CPFs ficar mais barato para o bot com a
  escala, o bot tende a vencer a corrida de custos; por isso a defesa não pode ser só "endurecer mais" (ver seção 5).

---

## 4. Ameaças e riscos

> Responsável: **Maria Eduarda**

Esta seção parte dos pressupostos **P1–P3** (seção 1.3) e das rodadas da seção 3 para mostrar **onde** o bot caçador de cupons consegue explorar o PedeJá, **o que** pode dar errado em cada ponto e **qual ameaça tem prioridade**. A cadeia usada é a da disciplina: o **ativo** (o que tem valor) sofre uma **ameaça** (o que de ruim pode acontecer), que só se concretiza porque existe uma **fraqueza** ou um **pressuposto que falha** (a vulnerabilidade), explorada por meio de um **ponto de exploração** (por onde o bot entra).

### 4.1 Pontos de exploração

| ID | Ponto de exploração | Tipo (interface, regra, componente, fluxo) | Descrição |
|-|-|-|-|
| PE1 | Formulário de cadastro de conta (e verificação de telefone/CPF na verificação rígida) | Interface | Tela e endpoint de criação de conta. Na **verificação leve (B1)** pede só e-mail e senha; na **verificação rígida (B2)** pede também código por SMS, CPF e coleta o identificador do dispositivo. É a **porta de entrada das multicontas**: tudo o que o motor antifraude sabe sobre uma conta nasce aqui, e o bot controla todos os dados que digita. Pode ser chamado em lote por um script, sem passar pelo app. |
| PE2 | Regra de elegibilidade do cupom no checkout ("uma vez por conta") | Regra | Regra que decide se o `BEMVINDO` vale para o pedido: conta sem pedido anterior + pedido acima de R$ 30. Ela confere **contas**, não **pessoas** (P1). Por isso cada conta nova aceita no PE1 vira automaticamente um resgate de R$ 20, e o ganho do bot cresce junto com o número de contas. |
| PE3 | Mensagens de recusa e de pedido de verificação exibidas no checkout | Fluxo / resposta observável | Resposta que o checkout devolve a cada tentativa: cupom aceito, recusado com motivo ("este CPF já foi usado", "este dispositivo já resgatou o cupom") ou pedido de verificação extra. Foi pensada para ajudar o cliente legítimo a entender a recusa, mas é a **principal fonte de informação do bot**: cada mensagem diz qual sinal de identidade foi detectado (rodadas 2 e 3 da seção 3). |

Os três pontos formam uma sequência: o bot **entra** pelo PE1, **lucra** pelo PE2 e **aprende** pelo PE3, usando o que aprendeu para voltar ao PE1 com contas melhores.

### 4.2 Diagrama de superfície de ataque

![Superfície de ataque](diagramas/superficie-de-ataque.png)

Fonte editável: [`diagramas/superficie-de-ataque.mmd`](diagramas/superficie-de-ataque.mmd)

**Como ler o diagrama:** à esquerda está o **bot caçador de cupons** com os **insumos** que compra ou gera fora do PedeJá (e-mails, números de SMS, CPFs, emulador, endereços). No centro estão os três **pontos de exploração** (laranja) e os componentes internos que eles alimentam (azul): a base de contas e o **motor antifraude**. As setas grossas mostram o ciclo do bot (**1.** cria contas no PE1 → **2.** aplica o cupom no PE2 → **3.** lê a resposta no PE3 e volta ao passo 1). As setas tracejadas ligam cada ponto ao **ativo** (verde) que a ameaça atinge, com o ID da ameaça e do pressuposto. O **cliente novo legítimo** usa as mesmas interfaces que o bot; por isso toda defesa colocada nelas também o afeta.

### 4.3 Cenários de ameaça

> Um **[ator]** pode realizar **[ação]** por meio de **[ponto de exploração]**, aproveitando
> **[fraqueza ou pressuposto]**, causando **[impacto]** sobre **[ativo ou propriedade]**.

- **AM1 — Multicontas com e-mails descartáveis.** Um **bot caçador de cupons** pode **criar contas em massa com e-mails descartáveis e variações `nome+N@...` e resgatar o `BEMVINDO` uma vez em cada uma** por meio do **formulário de cadastro (PE1) e da regra de elegibilidade "uma vez por conta" (PE2)**, aproveitando **o pressuposto P1 (cada conta corresponde a uma pessoa real), que na verificação leve é conferido apenas pelo e-mail**, causando **o gasto de R$ 20 por conta falsa sem trazer nenhum cliente novo (≈ R$ 14 de prejuízo líquido por resgate; R$ 4.000 em uma semana na rodada 1)** sobre a **distribuição justa do orçamento de aquisição**.

- **AM2 — Passar pela verificação rígida com sinais comprados.** Um **bot caçador de cupons** pode **completar a verificação rígida usando números virtuais de SMS, CPFs vazados de terceiros e um emulador que gera um novo identificador de dispositivo a cada conta** por meio do **formulário de cadastro com verificação de telefone e CPF (PE1)**, aproveitando **o pressuposto P2 (telefone, CPF e dispositivo são caros ou difíceis de obter em quantidade), que falha porque o custo por conta (c ≈ R$ 5) continua menor que os R$ 20 do desconto**, causando **resgates fraudulentos mesmo com a defesa mais forte ativa, cadastros feitos em nome de pessoas que nem usam o app e a perda do atrito que a B2 já cobrou dos clientes legítimos (conversão 70% → 55%) sem o benefício esperado** sobre o **orçamento de aquisição, a confiança nos dados de cadastro e a privacidade dos titulares dos CPFs**.

- **AM3 — Sondagem das mensagens de recusa.** Um **bot caçador de cupons** pode **sondar o motor antifraude trocando um sinal de identidade por tentativa (dispositivo, depois endereço do vizinho ou da portaria) e ler a mensagem de recusa até descobrir qual sinal o denunciou** por meio das **mensagens de recusa e de pedido de verificação do checkout (PE3)**, aproveitando **a fraqueza das mensagens detalhadas ("este CPF já foi usado", "este dispositivo já resgatou o cupom") e o pressuposto P3 (mesmo dispositivo ou endereço indica a mesma pessoa), que o bot contorna variando exatamente o sinal indicado**, causando **a perda de eficácia de cada nova regra do motor (o bot aprende a contorná-la em poucas tentativas) e, como reação, regras mais duras por dispositivo e endereço que recusam famílias e repúblicas (falsos positivos)** sobre a **distribuição justa do orçamento de aquisição e a experiência de cadastro do cliente legítimo**.

As três ameaças são **a mesma intenção em momentos diferentes da corrida** (seção 3): AM1 acontece enquanto o motor está em B1; AM2 é a resposta do bot à mudança para B2; AM3 é a resposta do bot à forma como o motor comunica as recusas. Nenhuma delas é um erro ou acidente: todas dependem de um agente que observa a resposta e muda a ação.

### 4.4 Avaliação de riscos

Probabilidade e impacto: 1 = baixo, 2 = médio, 3 = alto. Risco = probabilidade × impacto (de 1 a 9).

Para que as notas não fiquem arbitrárias, o grupo usou estes critérios, ligados aos custos do bot e aos ativos da seção 1:

| Nota | Probabilidade (o bot consegue e compensa fazer?) | Impacto (se acontecer, quão ruim é?) |
|-:|-|-|
| 1 | Exige recursos raros ou caros; o custo por conta (c) chega perto ou passa de R$ 20 | Perda pontual do orçamento (menos de 1% ao mês), facilmente detectada; nenhum efeito sobre clientes legítimos |
| 2 | Exige comprar insumos ou montar ferramentas (números, CPFs, emulador), mas c continua bem abaixo de R$ 20 | Perda relevante do orçamento **ou** dano a um ativo secundário (dados de cadastro, conversão), sem anular a defesa |
| 3 | Custo ≈ zero, ferramentas públicas, automatizável por qualquer script; já aparece nas rodadas da seção 3 | Atinge o ativo principal **e** pelo menos um secundário, **ou** anula a defesa atual do motor (o bot passa a contorná-la sem custo extra) |

As notas consideram o PedeJá **como descrito na seção 3**: começa na verificação leve, passa para a rígida e mantém mensagens de recusa detalhadas.

| ID | Cenário de ameaça | Ponto de exploração | Pressuposto ou fraqueza | Ativo afetado | Probabilidade | Impacto | Risco |
|-|-|-|-|-|-:|-:|-:|
| AM1 | Bot cria contas em massa com e-mails descartáveis e resgata o `BEMVINDO` em cada uma | PE1, PE2 | P1 — e-mail novo = pessoa nova | Distribuição justa do orçamento de aquisição | 3 | 2 | **6** |
| AM2 | Bot passa pela verificação rígida com números virtuais, CPFs vazados e emulador | PE1 | P2 — telefone, CPF e dispositivo seriam caros | Orçamento de aquisição; confiança nos dados de cadastro; privacidade dos titulares dos CPFs | 2 | 3 | **6** |
| AM3 | Bot sonda o motor trocando um sinal por vez e lendo a mensagem de recusa | PE3 | Fraqueza: mensagens de recusa detalhadas; P3 — mesmo dispositivo/endereço = mesma pessoa | Orçamento de aquisição (via perda de eficácia das regras); experiência de cadastro do cliente legítimo | 3 | 3 | **9** |

**Justificativa das notas:**

- **AM1 — probabilidade 3:** e-mails descartáveis e variações `nome+N@` são gratuitos e ilimitados, e um script cria contas em lote (c ≈ R$ 0, rodada 1). **Impacto 2:** o prejuízo é real (R$ 4.000 em uma semana, 4% do orçamento mensal), mas atinge só o orçamento e deixa um rastro fácil de ver (pico de cadastros, poucos domínios, contas sem segunda compra). Foi o que fez o motor reagir já na primeira rodada.
- **AM2 — probabilidade 2:** o bot precisa comprar números de SMS e CPFs e manter um emulador. Continua lucrativo (c ≈ R$ 5 contra R$ 20 de desconto), mas exige mais esforço e dinheiro que o AM1. **Impacto 3:** derrota a defesa mais forte que o motor tem (B2), cuja conta o cliente legítimo já pagou com a queda de conversão. Além disso, atinge três ativos e envolve dados de terceiros que nem participam da interação.
- **AM3 — probabilidade 3:** não exige nenhum insumo novo. A mensagem é exibida em toda recusa, e uma única tentativa já revela qual sinal foi detectado (rodada 3). **Impacto 3:** é a ameaça que **anula todas as outras defesas**. Qualquer regra nova do motor (B2, ligação por dispositivo e endereço) é descoberta e contornada em poucas tentativas. E a reação natural do motor (regras mais duras) gera falsos positivos contra famílias e repúblicas.

O **empate entre AM1 e AM2 (risco 6)** é desfeito pela ordem das rodadas: o AM1 é tratado primeiro porque é o mais barato para o bot e o mais fácil de detectar (basta sair de B1). O AM2 exige medidas mais caras e só aparece depois disso.

### 4.5 Ameaça prioritária: AM3 — sondagem das mensagens de recusa (risco 9)

O AM3 é a prioridade porque tem o maior risco e porque é ele que dá ao bot a capacidade de **se adaptar rápido**: enquanto as mensagens contarem qual sinal foi detectado, qualquer defesa contra AM1 e AM2 dura poucas tentativas. A resposta abaixo é a mesma adaptação do motor no fim da rodada 3 (seção 3), detalhada aqui. Os controles de cada ameaça estão na seção 5.

1. **Como o sistema poderia responder:**
   - trocar todas as mensagens de recusa por **uma única mensagem genérica** ("Não foi possível aplicar o cupom neste pedido"), sem dizer qual sinal causou a recusa. O motivo real fica **só no registro interno** do motor;
   - **limitar as tentativas de resgate** por dispositivo, sessão e cartão (por exemplo, 3 tentativas em 24 h). Depois disso, o cupom deixa de ser oferecido naquela sessão;
   - **detectar o padrão de sondagem**: uma sequência de contas ou tentativas em que só um campo muda (dispositivo, endereço) passa a ser recusada em conjunto, e não uma por uma;
   - criar um **canal de contestação** para quem for recusado (por exemplo, enviar um comprovante de endereço ou falar com o suporte), para que o cliente legítimo não fique sem saída.
2. **Que informação essa resposta revelaria:**
   - o bot continua vendo o **resultado binário** (aceito ou recusado). Ainda dá para aprender por tentativa e erro, só que mais devagar e mais caro;
   - a **troca repentina** da mensagem detalhada pela genérica mostra ao bot que **a sondagem foi percebida**;
   - o limite de tentativas pode ser descoberto: se a 4ª tentativa do mesmo aparelho sempre falha, o bot conclui que o limite é 3;
   - o canal de contestação mostra **que tipo de prova o PedeJá aceita** para reverter uma recusa.
3. **Como o adversário se adaptaria na rodada seguinte:**
   - **espalhar as tentativas** por muitos dispositivos emulados e sessões, ficando abaixo do limite em cada um;
   - trocar **vários sinais ao mesmo tempo** e inferir a regra pela **taxa de aceitação de lotes** de contas (testa 50 contas com endereço variado e 50 sem, e compara), em vez de ler a mensagem;
   - tentar **abusar do canal de contestação** com comprovantes falsos ou de terceiros;
   - com isso o custo por resgate sobe (c ≈ R$ 8 ou mais), mas continua abaixo de R$ 20. Por isso o bot não desiste, o que leva de volta à corrida armamentista da seção 3.2.
4. **Efeitos colaterais sobre usuários legítimos:**
   - o cliente recusado **não sabe o motivo** (por exemplo, alguém da família já usou o cupom no mesmo endereço) e não consegue corrigir sozinho. Isso gera mais chamados no suporte e mais desistências;
   - o limite de tentativas pune quem **erra a digitação** do CPF ou do telefone algumas vezes;
   - a contestação é **mais um passo**: o cliente espera a análise ou faz o primeiro pedido sem desconto, justamente na compra que o cupom deveria facilitar.
5. **Risco que continua existindo após a resposta:**
   - a sondagem não acaba, só fica mais lenta e cara. A probabilidade do AM3 cai de 3 para 2 (o bot precisa de muitos dispositivos e sessões para aprender) e o impacto cai de 3 para 2 (o bot não descobre mais qual regra pegou cada conta). **Risco residual estimado: 2 × 2 = 4**;
   - o **AM2 não é afetado** pela mensagem genérica: enquanto números de SMS, CPFs e emulador custarem menos que R$ 20 por conta, ainda há resgates fraudulentos;
   - os **falsos positivos do P3** (aparelho e endereço compartilhados) continuam. A contestação só reduz o dano depois que ele aconteceu.
6. **O que o sistema precisa continuar preservando:**
   - **um cupom por pessoa real**: a distribuição justa do orçamento de aquisição continua sendo o objetivo, e nenhuma resposta pode ser "liberar tudo" só para reduzir reclamações;
   - **um caminho para o cliente legítimo**: atrito baixo no cadastro e sempre uma forma de contestar a recusa, sem ficar bloqueado sem explicação;
   - **o mínimo de dados pessoais** (LGPD): endurecer a defesa não justifica coletar mais dados do que o necessário para verificar a identidade;
   - **a capacidade do motor de observar**: o motivo real de cada recusa e as tentativas de sondagem precisam continuar registrados internamente, porque são esses dados que permitem ao motor se adaptar na rodada seguinte (seções 5 e 6).

---

## 5. Redesenho e resiliência

> Responsável: **Eduardo**

O redesenho do **PedeJá** busca preservar a **distribuição justa do orçamento de aquisição: um desconto por pessoa
real**, equilibrando a redução do abuso, os custos da defesa e a experiência do **cliente novo legítimo**. O benefício
permanece em **R$ 20 na primeira compra acima de R$ 30**.

Os controles respondem às ameaças **AM1–AM3**, aos pressupostos **P1–P3** e às adaptações da seção 3. Conforme a
avaliação da seção 4, a **AM3 — sondagem das mensagens de recusa — é prioritária**, com risco inicial **3 × 3 = 9**.
Para ela, o redesenho mantém os quatro controles da seção 4.5: **mensagem genérica, limite de tentativas, detecção de
sondagem e canal de contestação**.

As medidas são propostas para o sistema hipotético. Sua eficácia e seus efeitos sobre os clientes legítimos deverão ser
avaliados na simulação do Trabalho 2.

### 5.1 Controles associados às ameaças

| Ameaça                                                   | Controle contextualizado                                                                                                                                                                                                                                                                                        | Mudança de incentivo                                                                                                          | Sinal observável / métrica                                                                                    | Próxima adaptação esperada do adversário                                                                                                             | Risco residual                                                                                                                                                   |
|----------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **AM1 — criação de contas em massa**                     | No **PE1** e no **PE2**, combinar limites por conta, sessão e conjuntos de sinais com o histórico de cadastros e resgates. Exigir **B2** diante de combinações suspeitas e intensificar a análise quando houver consumo anormal do orçamento.                                                                   | Reduzir resgates por período e aumentar o esforço de distribuir contas, dificultando a exploração de **P1**.                  | Concentração e ritmo de cadastros e resgates; descontos concedidos; acionamento de limites.                   | Distribuir tentativas no tempo e entre sinais distintos; recorrer a **AM2**.                                                                         | Ataques distribuídos podem passar; limites podem atrasar clientes legítimos.                                                                                     |
| **AM2 — contorno da verificação rígida**                 | No **PE1**, verificar telefone, CPF e dispositivo; no **PE2**, avaliar relações entre contas e histórico de resgates, inclusive após aprovação em **B2**. Combinações suspeitas exigem análise adicional.                                                                                                       | Dificultar a reutilização de recursos e exigir a substituição de vários sinais, elevando o custo por conta aceita.            | Reutilização e combinações de sinais; resgates associados; aprovação, recusa e abandono após B2.              | Usar recursos distintos por conta e reduzir ligações observáveis.                                                                                    | Dados de terceiros e contas sem vínculos reconhecidos podem passar; relações legítimas podem parecer suspeitas.                                                  |
| **AM3 — sondagem das mensagens de recusa (prioritária)** | No **PE3**, usar **mensagem genérica**, preservando o motivo interno; aplicar **limite de tentativas** por dispositivo, sessão e cartão; realizar **detecção de sondagem** por sequências de contas e alterações de sinais; oferecer **canal de contestação**. Intervalos progressivos complementam os limites. | Reduzir a informação revelada e a velocidade dos testes, elevando o tempo e os recursos necessários para descobrir as regras. | Sequências de tentativas; sinais alterados; limites e intervalos acionados; contestações e decisões revistas. | Alternar sessões e dispositivos, espaçar testes, variar vários sinais, inferir regras pelo resultado aceito/recusado e tentar abusar da contestação. | **Probabilidade 2 × impacto 2 = 4**, conforme a seção 4.5. O resultado continua informativo, testes distribuídos podem passar e a contestação pode sofrer abuso. |

### 5.2 Tratamento prioritário da AM3

Os quatro controles da seção 4.5 atuam em conjunto:

1. **Mensagem genérica:** as recusas do cupom usam uma mensagem pública única, como “Não foi possível aplicar o cupom
   neste pedido”, acompanhada da opção de contestação. O motivo específico fica no registro interno. Isso reduz a
   informação entregue ao bot, mas não elimina a aprendizagem pelo resultado aceito/recusado nem pelas verificações
   solicitadas.

2. **Limite de tentativas:** limitar as tentativas por dispositivo, sessão e cartão sintético. O exemplo da seção 4.5,
   **3 tentativas em 24 horas**, será uma configuração inicial para teste. Atingido o limite, novas tentativas ficam
   temporariamente indisponíveis no escopo correspondente. Intervalos progressivos podem complementar esse controle
   diante de repetição suspeita. Esses parâmetros não são valores comprovadamente ideais e deverão ser comparados na
   simulação.

3. **Detecção de sondagem:** analisar sequências de contas e tentativas relacionadas, incluindo alterações de um único
   sinal e de vários sinais. Quando houver evidência combinada suficiente, o motor poderá recusar o conjunto de
   tentativas relacionadas, aplicar espera ou encaminhar para revisão. O compartilhamento isolado de endereço ou
   dispositivo não será tratado como prova de fraude, conforme **P3**.

4. **Canal de contestação:** permitir que o cliente solicite revisão da recusa com evidência adicional. A revisão poderá
   manter, reverter ou considerar inconclusiva a decisão. Não haverá aprovação automática, pois o bot também pode tentar
   explorar esse canal. No Trabalho 2, toda evidência será simulada, sem documentos pessoais reais.

Mantém-se o **risco residual estimado de 2 × 2 = 4** da seção 4.5. A redução de probabilidade representa a necessidade
de mais recursos e tentativas distribuídas para aprender as regras. A redução de impacto representa a menor precisão da
informação obtida em cada recusa, dificultando o contorno direcionado.

Essa classificação é uma **estimativa qualitativa**, não uma medição nem uma garantia de eficácia. Se os experimentos
indicarem outra avaliação, as seções 4.5 e 5 deverão ser atualizadas em conjunto. A mensagem genérica, isoladamente, não
resolve **AM2** nem os falsos positivos associados a **P3**.

### 5.3 Proteção do cliente legítimo

Propõe-se manter **B1 — verificação leve** quando não houver indícios suficientes de abuso e exigir **B2 — verificação
rígida** diante de combinações suspeitas. A decisão sobre o cupom deve considerar conjuntamente as verificações e o
histórico: a aprovação em B2 não encerra a análise de elegibilidade.

Essa escolha procura reduzir exigências desnecessárias. Na rodada 2, a conclusão do cadastro cai de **70% para 55%**,
uma redução de **15 pontos percentuais** no cenário hipotético, não uma previsão dos controles propostos.

Conforme **P3**, compartilhar endereço ou dispositivo não comprova fraude, assim como apresentar sinais diferentes não
comprova pessoas distintas. A ausência de segunda compra também não demonstra abuso isoladamente. Quando a suspeita
decorrer de sinais compartilhados e a evidência for insuficiente, deve-se priorizar verificação adicional ou revisão
antes da recusa definitiva.

As mensagens genéricas dificultam que o cliente compreenda a recusa. Por isso, o canal de contestação deve estar
acessível no checkout. Ainda assim, a revisão gera espera, custo de atendimento e possibilidade de desistência. Erros de
preenchimento devem permitir correção sem revelar critérios internos do motor, e o efeito dos limites sobre essas
tentativas precisa ser avaliado.

Para conter o dano durante novas ondas de abuso, propõe-se acompanhar o valor e a velocidade dos resgates. Um limiar de
alerta deve acionar verificação ou revisão adicional das combinações suspeitas, sem suspender automaticamente todos os
cupons. Esse mecanismo pode retardar o consumo indevido, mas não garante um teto de perdas, pois parte do abuso pode
permanecer sem identificação.

### 5.4 Efeitos sobre os incentivos e os payoffs

Na simplificação da seção 3, o benefício líquido do desconto para o bot é:

**G_bot = R$ 20 − c**

**c** representa o custo médio para obter uma conta aceita e concluir um resgate, incluindo os recursos empregados nas
tentativas frustradas necessárias para esse resultado. Esses custos devem ser contabilizados uma única vez.

Com custos aproximados de R\$ 0, R\$ 5 e R\$ 8, o benefício líquido do desconto permanece em R\$ 20, R\$ 15 e R\$ 12,
respectivamente. Esse benefício representa a economia com o desconto após os custos do abuso, não o lucro total de uma
operação de revenda de pedidos.

Portanto, elevar o custo não elimina necessariamente o incentivo. O benefício é zero em c = R\$ 20 e negativo acima
disso, dentro dessa simplificação.

Os controles procuram alterar os payoffs da seção 2 da seguinte forma:

- **A1/B1:** preservar o baixo atrito da conta única.
- **A1/B2:** reduzir o dano de recusas indevidas por meio da revisão; na política adaptativa, evitar exigir B2 sem
  indícios suficientes.
- **A2/B1:** reduzir a velocidade dos resgates repetidos por limites, intervalos e análise de histórico.
- **A2/B2:** elevar o custo de substituir sinais e reduzir resgates indevidos pela análise entre contas, considerando o
  custo da defesa.

O redesenho combina B1 e B2 com controles adicionais. Por isso, esses efeitos descrevem mudanças pretendidas nos
resultados das combinações, sem atribuir novos valores à matriz nem concluir uma estratégia dominante ou um equilíbrio
antes da avaliação.

Além de elevar **c**, limites e intervalos procuram reduzir a quantidade de resgates obtidos por período. Para o motor,
o benefício depende de a redução do abuso compensar verificações, manutenção, atendimento e perda de conversão. A
diferença aproximada de R\$ 14 entre desconto e comissão, para pedidos próximos e superiores a R\$ 30, não
representa economia garantida por recusa.

### 5.5 Avaliação e resiliência

A avaliação deve acompanhar:

- **Orçamento:** quantidade, valor e velocidade dos resgates; acionamento dos alertas.
- **Indícios de abuso:** relações entre contas, concentração de sinais, sequências de sondagem e acionamento de limites
  e intervalos.
- **Experiência do cliente:** conclusão de cadastros e pedidos, abandono após B2 ou espera, tempo de revisão e decisões
  revertidas.
- **Custo da defesa:** verificações, atendimento e manutenção das regras.

Recusas não equivalem a fraudes detectadas, nem resgates aceitos comprovam legitimidade. Contestações ajudam a
identificar possíveis falsos positivos, mas não revelam todos os erros. Na simulação, o avaliador poderá calcular esses
erros com os rótulos sintéticos; o motor não terá acesso a esses rótulos.

Para a **AM3**, será necessário comparar a configuração com mensagens detalhadas à configuração com os quatro controles
da seção 4.5. O objetivo é verificar se a sondagem exige mais tentativas, tempo e recursos e se essa redução de vantagem
compensa o atrito e o atendimento adicionais. Os resultados subsidiarão a revisão da estimativa de risco residual **4**.

**Nenhuma defesa é definitiva:** o bot pode distribuir tentativas, substituir sinais, explorar a contestação e aprender
com as respostas do checkout. A resiliência exige observar resultados, ajustar controles, revisar decisões e acompanhar
novas adaptações, considerando a privacidade e a finalidade dos dados utilizados.

Permanecem riscos de multicontas aceitas, clientes legítimos recusados, uso de dados de terceiros e aprendizagem do bot.
O objetivo é reduzir a vantagem do abuso sem comprometer a distribuição justa do cupom e a experiência do cliente
legítimo.

---

## 6. Arquitetura proposta para o Trabalho 2

> Responsável: **Eduardo**

Esta seção complementa a seção 5 e serve de base para o Trabalho 2. Usa os nomes da Ficha do sistema (**A1/A2, B1/B2,
P1–P3, AM1–AM3, PE1–PE3**) e inclui os quatro controles da ameaça prioritária **AM3**, descritos na seção 4.5.

### 6.1 Escopo e tecnologia

No Trabalho 2 será implementado um **simulador simplificado do resgate do cupom `BEMVINDO` no PedeJá**, em que os dois
agentes jogam rodadas. Cada rodada corresponde a uma janela de tempo simulada, por exemplo, uma semana.

Nela, o **bot caçador de cupons** escolhe **A1** — conta única, sem ataque — ou **A2** — multicontas — e tenta resgatar
o cupom. O **motor antifraude** escolhe **B1** ou **B2**, avalia a elegibilidade e decide aceitar, recusar, pedir
verificação extra ou impor espera quando os controles adicionais estiverem ativos.

O estado permanece entre rodadas: uma conta que já concluiu a primeira compra não recupera a elegibilidade ao começar
uma nova rodada.

**Demonstração:** três rodadas, com número ampliável, em dois modos:

- **Guiado:** reproduz a sequência **AM1 → AM2 → AM3** da seção 3 como roteiro didático. As mudanças previstas pelo
  roteiro são identificadas como programadas.
- **Adaptativo:** os agentes só mudam de comportamento quando suas observações acionam as regras configuradas, sem
  sequência garantida.

**O simulador terá:**

- clientes, contas, pedidos e sinais de identidade **sintéticos**, incluindo clientes legítimos que compartilham
  endereço ou dispositivo (**P3**);
- a regra do cupom: **R$ 20 de desconto no primeiro pedido com valor estritamente superior a R$ 30**, debitado do
  orçamento somente quando o pedido é concluído;
- três configurações de defesa para comparação: **B1 fixa**, **B2 fixa** e o **redesenho da seção 5**, que escolhe B1/B2
  por indícios e acrescenta os controles propostos;
- os quatro controles da **AM3**: **mensagem genérica, limite de tentativas, detecção de sondagem e canal de
  contestação**;
- intervalos progressivos, análise de relações entre contas e alerta de orçamento;
- as métricas da seção 5.5, incluindo falsos positivos e falsos negativos calculados pelo avaliador;
- registro dos custos, tentativas e tempo necessários para o bot obter resgates.

Ficam fora do escopo os mesmos itens da Ficha: pagamento e fraude de cartão, entrega, outros cupons e ataques à
infraestrutura. SMS, CPF, dispositivo e cartão são representados por identificadores e verificações simulados. O cartão
serve apenas como sinal de correlação, sem processamento de pagamento.

**Tecnologia:** **Python com Streamlit**, executado localmente em um único processo. Os agentes são funções ou classes
baseadas em regras, sem modelos de IA. Pandas organiza tabelas e indicadores; configurações e sementes aleatórias
registradas permitem repetir os experimentos. A escolha permite interface web, execução e gráficos com pouco código e
sem serviços externos, mantendo o foco na lógica da interação.

**Separação de informação:** o bot conhece suas próprias ações, recursos e respostas públicas. O motor vê sinais
apresentados, histórico operacional e resultados de revisões, mas não recebe o rótulo “fraudador” nem a identidade
sintética que vincula cada conta ao seu controlador real. Essa ligação é mantida separadamente para geração dos cenários
e avaliação.

### 6.2 Componentes

São divisões lógicas do mesmo programa, não serviços separados.

| Componente                    | Responsabilidade                                                                                                   | Entradas                                                              | Saídas                                                                                           |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Interface web                 | Configurar o experimento, executar rodadas e mostrar resultados.                                                   | Parâmetros e comandos do usuário.                                     | Painéis, tabelas e arquivos CSV.                                                                 |
| Gerador de cenários           | Criar clientes, contas, pedidos e sinais sintéticos, incluindo compartilhamento legítimo.                          | Sementes, quantidades e parâmetros de comportamento.                  | Dados sintéticos, agenda inicial de ações e rótulos separados para avaliação.                    |
| Controlador de rodadas        | Ordenar eventos, avançar o tempo simulado, executar ações dos clientes sintéticos e manter o estado entre rodadas. | Agenda, configuração e estado atual.                                  | Chamadas aos componentes e fechamento de cada rodada.                                            |
| Bot caçador de cupons         | Executar A1 ou A2 e adaptar recursos, ritmo e sinais conforme suas observações.                                    | Estratégia atual, recursos próprios e respostas públicas do checkout. | Cadastros, tentativas de resgate, contestações e mudanças de estratégia.                         |
| Cadastro e checkout do PedeJá | Representar PE1 e PE2: aplicar as regras do cupom e concluir pedidos.                                              | Dados da conta, pedido, orçamento e decisão do motor.                 | Resposta pública, estado do pedido e resgate concluído.                                          |
| Motor antifraude              | Escolher B1/B2, analisar relações e sondagem, aplicar limites, intervalos e mensagens e adaptar a política.        | Eventos operacionais observáveis e regras vigentes.                   | Aprovação, recusa, verificação extra ou espera; motivo interno.                                  |
| Revisão de contestações       | Reavaliar recusas com evidência simulada adicional, sem consultar os rótulos do avaliador.                         | Contestação, histórico e evidência apresentada.                       | Decisão mantida, revertida ou inconclusiva; custo e atraso.                                      |
| Registro de eventos           | Guardar ações, decisões, custos e mudanças em ordem temporal, separando informações por destinatário.              | Eventos dos demais componentes.                                       | Histórico operacional interno, respostas públicas por conta e registros exclusivos de avaliação. |
| Avaliador                     | Comparar decisões e resgates com a identidade sintética e calcular métricas.                                       | Eventos, custos e rótulos sintéticos.                                 | Falsos positivos e negativos, abuso aceito, orçamento, abandono e custos.                        |

**Fluxo principal:** o controlador executa uma ação; o cadastro ou checkout consulta o motor; a resposta pública retorna
ao participante; os eventos são registrados; o orçamento é debitado apenas se houver conclusão do pedido com desconto.
Uma recusa pode gerar contestação. Ao final da rodada, cada agente adapta suas regras usando apenas as informações
disponíveis para ele.

A reversão de uma recusa permite uma nova avaliação do checkout, mas não registra um resgate automaticamente. As regras
de primeira compra, valor do pedido e disponibilidade de orçamento continuam sendo verificadas.

### 6.3 Eventos registrados (observabilidade)

Todo evento grava a rodada, o instante simulado, as entidades envolvidas e a versão da política. Nas decisões sobre o
cupom, o **resultado público** fica separado do **motivo interno**.

Os gatilhos abaixo são propostas configuráveis para o modo adaptativo. Não representam mudanças obrigatórias a cada
ocorrência.

| Evento                                                           | Dados principais                                                             | Métrica relacionada                                          | Uso na observação ou adaptação                                                                                     |
|------------------------------------------------------------------|------------------------------------------------------------------------------|--------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| `cadastro_iniciado`, `cadastro_concluido`, `cadastro_abandonado` | Conta, sinais apresentados e etapa alcançada.                                | Conclusão de cadastros; concentração de sinais (**AM1**).    | Pico de cadastros com combinações suspeitas pode levar à exigência de B2.                                          |
| `relacao_detectada`                                              | Contas relacionadas e sinais compartilhados.                                 | Relações entre contas (**AM2**).                             | Evidência combinada pode levar à verificação ou revisão. Compartilhamento isolado não basta (**P3**).              |
| `verificacao_solicitada`, `verificacao_concluida`                | B1/B2, tipo, resultado e custo.                                              | Abandono após B2; custo da defesa.                           | Abandono elevado pode motivar revisão das exigências, em conjunto com os indícios de abuso.                        |
| `pedido_iniciado`, `pedido_concluido`, `pedido_abandonado`       | Pedido, valor, etapa e uso do cupom.                                         | Conclusão de pedidos; abandono após verificação ou espera.   | Queda de conversão pode motivar reavaliação do rigor das regras.                                                   |
| `cupom_decidido`                                                 | Tentativa, resultado público, mensagem e motivo interno.                     | Aprovação, recusa e sequências de tentativas (**AM3**).      | Alimenta a análise temporal das respostas e das alterações de sinais.                                              |
| `sondagem_suspeita_detectada`                                    | Tentativas relacionadas, sinais alterados, janela temporal e regra acionada. | Frequência de padrões suspeitos de sondagem (**AM3**).       | Pode acionar limites, intervalos, recusa do conjunto relacionado ou revisão, conforme a evidência.                 |
| `limite_acionado`, `intervalo_imposto`                           | Escopo, janela e instante da próxima tentativa permitida.                    | Acionamento de limites e intervalos.                         | Aumento de contestações, reversões e abandono após esses controles pode motivar revisão dos limiares.              |
| `resgate_concluido`                                              | Conta, pedido, desconto e saldo restante.                                    | Quantidade, valor e velocidade dos resgates.                 | Alimenta o acompanhamento do orçamento e seus alertas.                                                             |
| `alerta_orcamento`                                               | Valor consumido, janela e condição acionada.                                 | Alertas de consumo.                                          | Pode intensificar a análise das combinações suspeitas, sem recusa coletiva automática.                             |
| `contestacao_aberta`, `contestacao_resolvida`                    | Decisão original, evidência simulada, resultado, tempo e custo.              | Tempo de revisão; decisões revertidas; custo do atendimento. | Aumento de reversões pode motivar revisão das regras que originaram as recusas.                                    |
| `politica_alterada`                                              | Versões anterior e nova, métricas e gatilho da mudança.                      | Adaptação do defensor.                                       | Documenta por que o motor alterou a política.                                                                      |
| `estrategia_bot_alterada`                                        | Estratégias anterior e nova e observações que motivaram a mudança.           | Adaptação do adversário.                                     | Registro exclusivo de avaliação, indisponível ao motor.                                                            |
| `custo_bot_registrado`                                           | Recurso empregado, tentativa associada e custo.                              | Custo por resgate obtido; benefício líquido do desconto.     | Permite ao avaliador contabilizar tentativas bem-sucedidas e frustradas sem dupla contagem. Indisponível ao motor. |

O bot reage às respostas públicas: aceitação frequente pode manter a tática; novos pedidos de verificação podem levar à
substituição de sinais (**AM2**); mensagens detalhadas permitem sondagem direcionada (**AM3**); mensagens genéricas e
espera podem levar a outras combinações ou ao espaçamento das tentativas. Essas mudanças obedecem a regras e custos
configurados.

O motor recebe somente eventos operacionais do PedeJá. Um evento de sondagem indica **suspeita**, não confirmação de
fraude. Contestações e reversões também são sinais imperfeitos: o motor não sabe diretamente quantos clientes legítimos
foram afetados.

O avaliador utiliza os rótulos sintéticos para medir os erros e o abuso aceito, distinguindo decisões iniciais das
decisões após contestação. Esses resultados aparecem no painel de avaliação, mas não são enviados automaticamente ao
motor.

O risco residual **2 × 2 = 4** será apresentado como a estimativa qualitativa das seções 4.5 e 5.2. As métricas do
experimento servirão para discutir essa estimativa, sem tratá-la como um resultado numérico produzido automaticamente
pela simulação.

### 6.4 Estrutura do projeto

Organização proposta das pastas e arquivos do simulador:

```text
pedeja-simulador/
├── app.py                      # Interface web: streamlit run app.py
├── requirements.txt            # streamlit, pandas
├── README.md                   # Instalação, execução e descrição dos experimentos
├── config/
│   └── cenarios.json           # Rodadas, orçamento, limiares, custos, sementes e modos
├── simulador/
│   ├── modelos.py              # Conta, Pedido, Tentativa, Decisão, Resgate, Política, Evento
│   ├── cenarios.py             # Dados sintéticos, comportamento dos clientes e agenda
│   ├── rodadas.py              # Relógio simulado, execução de ações e estado
│   ├── checkout.py             # PE1 e PE2, regras do cupom e conclusão dos pedidos
│   ├── eventos.py              # Eventos e separação das informações por destinatário
│   ├── agentes/
│   │   ├── bot.py              # A1/A2 e regras de adaptação
│   │   ├── motor.py            # B1/B2, relações, sondagem, limites e mensagens
│   │   └── revisao.py          # Revisão de contestações com evidência simulada
│   └── avaliacao/
│       └── metricas.py         # Erros, orçamento, custos e resultados do bot
├── tests/
│   ├── test_regras_cupom.py    # Valor > R$ 30, primeira compra e débito único
│   ├── test_agentes.py         # Adaptações por gatilho e manutenção de estado
│   ├── test_controles_am3.py   # Mensagens, limites, sondagem e contestação
│   ├── test_separacao.py       # Informações disponíveis para cada agente
│   └── test_metricas.py        # Métricas e custos sem dupla contagem
└── saidas/                    # CSV exportados, fora do controle de versão
```

**Regras de dependência:** `app.py` chama `rodadas.py`, que coordena `checkout.py` e os agentes. O bot e o motor recebem
somente as entradas descritas em 6.2 e nunca importam `avaliacao/`.

A ligação entre pessoa sintética e conta fica em uma estrutura separada, acessível ao gerador e ao avaliador. As
entradas do motor e da revisão excluem essa ligação e os rótulos de legitimidade ou fraude. O motor também não recebe a
estratégia nem as despesas do bot.

Os parâmetros ficam em `config/cenarios.json`; a lógica permanece nos módulos. O limite inicial de **3 tentativas em 24
horas simuladas** será configurável, assim como os intervalos progressivos e as condições para detectar sondagem.

Os testes verificarão as regras do cupom, a persistência do histórico entre rodadas, os quatro controles da AM3 e a
separação de informação. Para o valor do pedido, serão incluídos os casos R\$ 30,00, sem elegibilidade, e R\$ 30,01,
elegível quanto ao valor, respeitando a regra “acima de R\$ 30”.

---

## 7. Conclusão: pergunta final

> Responsável: **Guilherme**

> **Depois que o sistema responder, o que o outro lado aprenderá e tentará fazer em seguida?**

_[Responder para o PedeJá: depois da última resposta do motor antifraude (seção 3 / ameaça prioritária da seção 4), o que o bot aprende e qual é a próxima ação provável? E o que o motor antifraude aprende com isso?]_

---

## 8. Fundamentação conceitual

> Responsável: **Guilherme**

_[Definições curtas, com referência, dos conceitos usados no trabalho: sistema adversarial, jogo, payoff, melhor resposta, estratégia dominante, equilíbrio de Nash, jogo repetido, corrida armamentista, superfície de ataque, ativo, ameaça × vulnerabilidade × ataque × caso de abuso × impacto × risco, risco residual.]_

---

## 9. Referências

Ver [`fontes/referencias.md`](fontes/referencias.md).

---

## 10. Declaração de uso de IA generativa

> Responsável pelo texto: **Guilherme**. **Cada integrante preenche a própria linha** no seu próprio commit (se não usou
> IA, escreva "não utilizou").

_[Texto introdutório — Guilherme.]_

| Integrante                               | Ferramenta           | Tarefa em que foi utilizada                                                                            | Como o conteúdo foi verificado                                                              |
|------------------------------------------|----------------------|--------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| Ariessa Velasques Oliveira               |                      |                                                                                                        |                                                                                             |
| Maria Eduarda Sanchez Chessio            |                      |                                                                                                        |                                                                                             |
| Mirieli Rodrigues dos Santos de Oliveira |                      |                                                                                                        |                                                                                             |
| Vitoria Pereira Garcia                   |                      |                                                                                                        |                                                                                             |
| Guilherme Jaques                         |                      |                                                                                                        |                                                                                             |
| Eduardo Dutra Ferreira                   | ChatGPT e NotebookLM | Apoio à pesquisa, esclarecimento de dúvidas, revisão textual e estruturação do arquivo Markdown (.md). | Revisão manual do conteúdo e conferência de sua coerência com as demais seções do trabalho. |

---

## 11. Contribuições individuais

| Integrante                               | Seções / artefatos                                                 | Fala na apresentação                                   |
|------------------------------------------|--------------------------------------------------------------------|--------------------------------------------------------|
| Ariessa Velasques Oliveira               | Seções 0 e 1; diagrama de contexto; integração; montagem do vídeo  | Sistema, atores e pressupostos                         |
| Maria Eduarda Sanchez Chessio            | Seção 4; diagrama de superfície de ataque; revisão de consistência | Ameaças e riscos                                       |
| Mirieli Rodrigues dos Santos de Oliveira | Seção 2                                                            | Modelo estático                                        |
| Vitoria Pereira Garcia                   | Seção 3; diagrama do ciclo adaptativo                              | Modelo dinâmico                                        |
| Guilherme Jaques                         | Seções 7, 8, 9, 10; template dos slides                            | Fundamentos e conclusão                                |
| Eduardo Dutra Ferreira                   | Seções 5 e 6                                                       | Redesenho e resiliência; arquitetura para o Trabalho 2 |

Histórico completo: ver commits do repositório.
