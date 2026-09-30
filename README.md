# Trabalho 1 — Análise de um Sistema Adversarial

**Sistema analisado:** _[NOME DO SISTEMA]_ — **Interação:** _[INTERAÇÃO ESPECÍFICA]_

**Grupo 9**

| Integrante | GitHub |
|-|-|
| Ariessa Velasques Oliveira | _[@usuário]_ |
| Maria Eduarda Sanchez Chessio | @mariasanchez0 |
| Mirieli Rodrigues dos Santos de Oliveira | @mirielii |
| Vitoria Pereira Garcia | @vitoriapgarcia7 |
| Guilherme Jaques | @Novato320 |
| Eduardo Dutra Ferreira | @ed-dferreira |

**Links:** [Slides (PDF)](_[link do Google Drive]_) · [Vídeo (YouTube)](_[link]_)

> **Pergunta central:** O que torna esse sistema adversarial, como os participantes tomam decisões e como a interação evolui ao longo das rodadas?

## Sumário

0. [Ficha do sistema (decisão do grupo)](#0-ficha-do-sistema-decisão-do-grupo)
1. [Descrição do sistema adversarial](#1-descrição-do-sistema-adversarial)
2. [Modelo estratégico estático](#2-modelo-estratégico-estático)
3. [Modelo estratégico dinâmico](#3-modelo-estratégico-dinâmico)
4. [Ameaças e riscos](#4-ameaças-e-riscos)
5. [Redesenho e resiliência](#5-redesenho-e-resiliência)
6. [Arquitetura proposta para o Trabalho 2](#6-arquitetura-proposta-para-o-trabalho-2)
7. [Fundamentação conceitual](#7-fundamentação-conceitual)
8. [Referências](#8-referências)
9. [Declaração de uso de IA generativa](#9-declaração-de-uso-de-ia-generativa)
10. [Contribuições individuais](#10-contribuições-individuais)

---

## 0. Ficha do sistema (decisão do grupo)

> Preenchida em conjunto na reunião inicial. **Todas as seções usam estes nomes** — não renomeiem atores, ativos ou ações sem atualizar esta ficha.

| Item | Decisão |
|-|-|
| Sistema | |
| Interação específica | |
| Ator/jogador A (adversário) | |
| Ator/jogador B (defensor/sistema) | |
| Outros atores | |
| Ativo ou propriedade preservada | |
| Regra/métrica explorável | |
| Resposta observável | |
| Decisão central do jogo (A1/A2 × B1/B2) | A1 = ; A2 = ; B1 = ; B2 = |
| Fora do escopo | |

---

## 1. Descrição do sistema adversarial

> Responsável: **Ariessa**

### 1.1 Sistema e interação analisada

_[Descrever o sistema e delimitar a interação específica.]_

### 1.2 Atores, objetivos e ativos

_[Principais atores, objetivo de cada um, e o ativo/propriedade a preservar: justiça, confiança, privacidade, disponibilidade, distribuição correta de um recurso...]_

| Ator | Objetivo | Ações ou capacidades | Informações observáveis | Restrições ou custos |
|-|-|-|-|-|
| | | | | |
| | | | | |
| | | | | |

### 1.3 Pressupostos e como podem falhar

| ID | Pressuposto | Como pode falhar |
|-|-|-|
| P1 | _[detalhar a partir da Ficha]_ | |
| P2 | | |
| P3 | | |

### 1.4 Diagrama de contexto

![Diagrama de contexto](diagramas/contexto.png)

Fonte editável: [`diagramas/contexto.mmd`](diagramas/contexto.mmd)

### 1.5 Por que é adversarial (e não apenas erro ou acidente)

_[Explicar a presença de intenção, objetivos conflitantes e adaptação.]_

---

## 2. Modelo estratégico estático

> Responsável: **Mirieli**

**Ordem do par:** `(payoff de A, payoff de B)` — escala: 3 = melhor, 0 = pior.

| Jogador A \ Jogador B | B1: _[ação]_ | B2: _[ação]_ |
|-|-:|-:|
| **A1: _[ação]_** | `( , )` | `( , )` |
| **A2: _[ação]_** | `( , )` | `( , )` |

### 2.1 O que representa cada ação

### 2.2 Justificativa dos payoffs

_[Justificar cada uma das 4 células, com base nos objetivos e custos da seção 1.]_

### 2.3 Melhores respostas

- Se B joga B1, a melhor resposta de A é ...
- Se B joga B2, a melhor resposta de A é ...
- Se A joga A1, a melhor resposta de B é ...
- Se A joga A2, a melhor resposta de B é ...

### 2.4 Estratégia dominante

### 2.5 Equilíbrio (nenhum jogador melhora mudando sozinho)

### 2.6 O equilíbrio é bom para o sistema e para usuários legítimos?

---

## 3. Modelo estratégico dinâmico

> Responsável: **Vitoria**

Ciclo: **ação → resposta → observação → adaptação**

| Rodada | Ação do participante | Resposta do sistema ou defensor | O que se torna observável? | Adaptação para a rodada seguinte |
|-:|-|-|-|-|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

_[Deixar explícito: a resposta também produz informação; o atacante mantém o objetivo e muda a ação; o defensor também observa e se adapta; decisões passadas limitam as próximas; custo da defesa para usuários legítimos.]_

### 3.1 Diagrama do ciclo adaptativo

![Ciclo adaptativo](diagramas/ciclo-adaptativo.png)

Fonte editável: [`diagramas/ciclo-adaptativo.mmd`](diagramas/ciclo-adaptativo.mmd)

### 3.2 Síntese

- **Quem observa quem?**
- **O que cada lado consegue mudar?**
- **O que dispara uma adaptação?**
- **Qual é o custo da adaptação para cada lado?**
- **Em que ponto pode surgir uma corrida armamentista?**

---

## 4. Ameaças e riscos

> Responsável: **Maria Eduarda**

### 4.1 Pontos de exploração

| ID | Ponto de exploração | Tipo (interface, regra, componente, fluxo) | Descrição |
|-|-|-|-|
| PE1 | Formulário de cadastro | Interface | _[detalhar]_ |
| PE2 | Regra de elegibilidade do cupom | Regra | |
| PE3 | Mensagens de recusa/verificação | Fluxo | |

### 4.2 Diagrama de superfície de ataque

![Superfície de ataque](diagramas/superficie-de-ataque.png)

Fonte editável: [`diagramas/superficie-de-ataque.mmd`](diagramas/superficie-de-ataque.mmd)

### 4.3 Cenários de ameaça

> Um **[ator]** pode realizar **[ação]** por meio de **[ponto de exploração]**, aproveitando **[fraqueza ou pressuposto]**, causando **[impacto]** sobre **[ativo ou propriedade]**.

- **AM1:**
- **AM2:**
- **AM3:**

### 4.4 Avaliação de riscos

Probabilidade e impacto: 1 = baixo, 2 = médio, 3 = alto. Risco = probabilidade × impacto.

| ID | Cenário de ameaça | Ponto de exploração | Pressuposto ou fraqueza | Ativo afetado | Probabilidade | Impacto | Risco |
|-|-|-|-|-|-:|-:|-:|
| AM1 | | PE1, PE2 | P1 | | | | |
| AM2 | | PE1 | P2 | | | | |
| AM3 | | PE3 | P3 / mensagens detalhadas | | | | |

### 4.5 Ameaça prioritária: _[ID]_

1. **Como o sistema poderia responder:**
2. **Que informação essa resposta revelaria:**
3. **Como o adversário se adaptaria na rodada seguinte:**
4. **Efeitos colaterais sobre usuários legítimos:**
5. **Risco que continua existindo após a resposta:**
6. **O que o sistema precisa continuar preservando:**

---

## 5. Redesenho e resiliência

> Responsável: **Ariessa** (a partir das ameaças AM1–AM3 da Ficha — não depende das notas de risco da seção 4)

| Ameaça | Controle contextualizado | Mudança de incentivo | Sinal observável / métrica | Próxima adaptação esperada do adversário | Risco residual |
|-|-|-|-|-|-|
| AM1 | | | | | |
| AM2 | | | | | |
| AM3 | | | | | |

_[Discutir por que nenhuma defesa é definitiva e como os controles alteram os payoffs da seção 2.]_

---

## 6. Arquitetura proposta para o Trabalho 2

> Responsável: **Eduardo**

### 6.1 Escopo mínimo implementável

### 6.2 Componentes

| Componente | Responsabilidade | Entradas | Saídas |
|-|-|-|-|
| | | | |

### 6.3 Fluxo principal da interação

### 6.4 Modelo de dados (entidades principais)

### 6.5 Regras de negócio e métricas exploráveis

### 6.6 Eventos registrados (observabilidade)

_[Quais eventos/logs o sistema grava e que permitem ao defensor observar e se adaptar.]_

### 6.7 Dados sintéticos para testes

---

## 7. Fundamentação conceitual

> Responsável: **Guilherme**

_[Definições curtas, com referência, dos conceitos usados no trabalho: sistema adversarial, jogo, payoff, melhor resposta, estratégia dominante, equilíbrio de Nash, jogo repetido, corrida armamentista, superfície de ataque, ameaça × vulnerabilidade × impacto × risco.]_

---

## 8. Referências

Ver [`fontes/referencias.md`](fontes/referencias.md).

---

## 9. Declaração de uso de IA generativa

> Responsável pelo texto: **Guilherme**. **Cada integrante preenche a própria linha** no seu próprio commit (se não usou IA, escreva "não utilizou").

_[Texto introdutório — Guilherme.]_

| Integrante | Ferramenta | Tarefa em que foi utilizada | Como o conteúdo foi verificado |
|-|-|-|-|
| Ariessa Velasques Oliveira | | | |
| Maria Eduarda Sanchez Chessio | | | |
| Mirieli Rodrigues dos Santos de Oliveira | | | |
| Vitoria Pereira Garcia | | | |
| Guilherme Jaques | | | |
| Eduardo Dutra Ferreira | | | |

---

## 10. Contribuições individuais

| Integrante | Seções / artefatos | Fala na apresentação |
|-|-|-|
| Ariessa Velasques Oliveira | Seções 0, 1, 5; diagrama de contexto; integração; montagem do vídeo | Introdução, sistema, redesenho |
| Maria Eduarda Sanchez Chessio | Seção 4; diagrama de superfície de ataque; revisão de consistência | Ameaças e riscos |
| Mirieli Rodrigues dos Santos de Oliveira | Seção 2 | Modelo estático |
| Vitoria Pereira Garcia | Seção 3; diagrama do ciclo adaptativo | Modelo dinâmico |
| Guilherme Jaques | Seções 7, 8, 9; template dos slides | Fundamentos e conclusão |
| Eduardo Dutra Ferreira | Seção 6 | Arquitetura para o Trabalho 2 |

Histórico completo: ver commits do repositório.
