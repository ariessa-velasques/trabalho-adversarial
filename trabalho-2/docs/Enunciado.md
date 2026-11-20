# Trabalho 2 – Implementação de um Sistema Adversarial com Agentes

**Modalidade:** grupos de 4 a 6 estudantes  
**Entrega:** apresentação em vídeo gravado + repositório GitHub com código-fonte, documentação e demonstração funcional.

## 1. Objetivo

Implementar um protótipo funcional do sistema adversarial proposto no Trabalho 1, utilizando **agentes de software**,
conforme os conceitos, materiais e práticas apresentados nas aulas do professor Paulo.

O foco é demonstrar, na prática, como agentes com objetivos conflitantes interagem, observam resultados e adaptam suas
estratégias ao longo de sucessivas rodadas.

## 2. Requisitos

A implementação deverá contemplar:

1. **Escopo bem delimitado:** selecionar uma única interação adversarial relevante. Não é necessário implementar o
   sistema completo.
2. **Agentes funcionais:** implementar pelo menos dois agentes com objetivos conflitantes, ações e regras de decisão
   explícitas.
3. **Rodadas adversariais:** executar pelo menos três rodadas conectadas, demonstrando o ciclo **ação → resposta →
   observação → adaptação**.
4. **Adaptação:** demonstrar como o comportamento de pelo menos um agente muda em função dos resultados das rodadas
   anteriores.
5. **Evidências:** registrar ações, decisões e resultados de cada rodada, permitindo compreender a evolução da
   interação.

**Importante:** não basta simular três ações independentes ou apresentar uma sequência previamente roteirizada. A
implementação deve demonstrar efetivamente a interação adversarial e a adaptação dos agentes.

## 3. Entrega e apresentação

O grupo deverá disponibilizar:

- Repositório GitHub com código executável, instruções de execução e descrição sucinta da arquitetura dos agentes.
- Demonstração prática do protótipo, evidenciando as rodadas adversariais e as adaptações realizadas.
- Breve análise dos resultados, incluindo limitações e possíveis melhorias.

## 4. Critérios de avaliação

| Critério                                               |  Pontos |
|--------------------------------------------------------|--------:|
| Delimitação do escopo e coerência com a proposta       |      15 |
| Implementação e funcionamento dos agentes              |      30 |
| Demonstração das rodadas adversariais e adaptação      |      35 |
| Qualidade da demonstração e análise dos resultados     |      15 |
| Organização do repositório e contribuições individuais |       5 |
| **Total**                                              | **100** |

A avaliação será individualizada, considerando a compreensão demonstrada por cada integrante e suas contribuições
identificáveis no repositório. Isso significa que os 100 pontos serão individualizados, não apenas os 5.

**Pergunta central:** *Como as decisões de um agente influenciam o comportamento do adversário nas rodadas seguintes?*