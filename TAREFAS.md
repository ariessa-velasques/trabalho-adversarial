# Divisão de tarefas — Grupo 9

**Prazo final:** terça, 06/10 às 23:59

## Princípios

- Os **jogadores A e B são agentes de software** (bot caçador de cupons × motor antifraude), como o professor pediu. Pessoas (fraudador, cliente legítimo) aparecem como atores, não como jogadores.
- **Tudo parte da Ficha do sistema** (seção 0 do README), decidida em conjunto na reunião inicial. Depois dela, cada pessoa trabalha **em paralelo**, sem esperar ninguém.
- **Nenhuma tarefa depende de outro integrante.** A Ficha já fixa os IDs dos pressupostos (P1–P3), pontos de exploração (PE1–PE3) e ameaças (AM1–AM3): cada seção detalha esses itens, mas **não renomeia nem remove** IDs.
- As únicas etapas que juntam o trabalho de todos (integração, revisão de consistência, montagem do vídeo e entrega) ficam com **Ariessa e Maria Eduarda**.
- Cada integrante **faz os próprios commits** (a nota é individual e considera o histórico do GitHub). Não façam commit pelos colegas.
- **Commitem ao longo dos dias**, não tudo no final: o professor avalia a evolução passo a passo, e um commit único de última hora conta pouco.
- Cada integrante **grava a fala da própria parte** no vídeo.
- Na dúvida sobre nomes de atores, ações ou ativos: usem **exatamente** o que está na Ficha do sistema.

## Etapa 0 — Reunião inicial (todos) — até quinta, 01/10

- [x] Escolher o sistema e **uma interação específica**: **cupom de primeira compra (`BEMVINDO`) no app de delivery PedeJá**.
- [x] Preencher a **Ficha do sistema** (seção 0 do README): atores, ativo, regra explorável, resposta observável, as 4 ações do jogo (A1, A2, B1, B2), o vocabulário comum e as âncoras P1–P3, PE1–PE3, AM1–AM3.
- [x] Todos leem a Ficha, validam na reunião e confirmam que entenderam a própria tarefa.

---

## Tarefas individuais — de 01/10 a sábado, 03/10

### Ariessa Velasques Oliveira — Coordenação e Seção 1

- [x] Criar o repositório no GitHub, subir esta estrutura e adicionar todos como colaboradores.
- [x] Registrar a Ficha do sistema no README durante a reunião.
- [x] **Seção 1 — Descrição do sistema adversarial:** sistema e interação, atores e objetivos, ativo preservado, tabela de atores, detalhar os pressupostos P1–P3 e como falham, por que é adversarial.
- [x] **Diagrama de contexto** (`diagramas/contexto.mmd` → `contexto.png`).
- [ ] Integração final do README (com Maria Eduarda).
- [ ] **Montagem do vídeo** com as gravações de todos e publicação no YouTube.

### Maria Eduarda Sanchez Chessio — Seção 4 e revisão de consistência

- [x] **Seção 4 — Ameaças e riscos:** detalhar PE1–PE3, escrever AM1–AM3 no formato exigido, tabela de risco (probabilidade × impacto), escolher a prioritária e responder os 6 itens.
- [x] **Diagrama de superfície de ataque** (`diagramas/superficie-de-ataque.mmd` → `.png`).
- [ ] Revisão de consistência (domingo, 04/10): conferir se atores, ações, pressupostos e ativos batem entre as seções 1 a 6 (rastreabilidade = 25 pts).

### Mirieli Rodrigues dos Santos de Oliveira (@mirielii) — Seção 2

- [x] **Seção 2 — Modelo estratégico estático**, usando as ações A1/A2/B1/B2 da Ficha:
  - matriz 2×2 com payoffs de 0 a 3 e a ordem do par informada;
  - o que representa cada ação e justificativa de cada uma das 4 células;
  - melhores respostas, estratégia dominante (se houver), equilíbrio e se ele é bom para usuários legítimos.
- [ ] Slides + gravação da fala do modelo estático.

### Vitoria Pereira Garcia (@vitoriapgarcia7) — Seção 3

- [x] **Seção 3 — Modelo estratégico dinâmico:** tabela com ≥ 3 rodadas (ação → resposta → observação → adaptação), mostrando que o defensor também se adapta e que a defesa gera custo ao usuário legítimo (dica: as rodadas podem seguir P1 → P2 → P3 / AM1 → AM2 → AM3 da Ficha).
- [x] **Diagrama do ciclo adaptativo** (`diagramas/ciclo-adaptativo.mmd` → `.png`).
- [x] Responder as 5 perguntas de síntese (quem observa quem, o que muda, gatilho, custo, corrida armamentista).
- [ ] Slides + gravação da fala do modelo dinâmico.

### Guilherme Jaques (@Novato320) — Seções 7, 8, 9, 10 e template da apresentação

- [ ] **Seção 7 — Conclusão: pergunta final** ("depois que o sistema responder, o que o outro lado aprenderá e tentará fazer em seguida?"), respondida para o PedeJá com base nas ameaças AM1–AM3 da Ficha.
- [ ] **Seção 8 — Fundamentação conceitual:** definições curtas e referenciadas (jogo, payoff, melhor resposta, estratégia dominante, equilíbrio de Nash, jogo repetido, corrida armamentista, superfície de ataque, ativo, ameaça × vulnerabilidade × ataque × caso de abuso, risco e risco residual).
- [ ] **Seção 9 — `fontes/referencias.md`:** organizar as referências (material da disciplina, teoria dos jogos, modelagem de ameaças, fontes públicas sobre o sistema escolhido).
- [ ] **Seção 10 — Declaração de uso de IA:** escrever o texto introdutório (cada integrante preenche a própria linha da tabela).
- [ ] Criar o **template no Canva** e compartilhar com o grupo **até quinta, 01/10** (antes de qualquer conteúdo); preencher `apresentacao/roteiro.md`.
- [ ] Slides + gravação da fala de abertura e conclusão.

### Eduardo Dutra Ferreira (@ed-dferreira) — Seções 5 e 6

- [ ] **Seção 5 — Redesenho e resiliência (15 pts)** para AM1–AM3 (a partir da Ficha e da rodada 3 da Vitoria: mensagem genérica, limite de tentativas, canal de contestação): para cada ameaça, controle contextualizado, mudança de incentivo do bot, sinal/métrica observado pelo motor, próxima adaptação esperada do bot e risco residual. Explicar por que nenhuma defesa é definitiva.
- [ ] **Seção 6 — Arquitetura para o Trabalho 2 (curta):** escopo, tecnologia escolhida (sugestão: Python + SQLite), componentes e eventos registrados (logs que alimentam as métricas da seção 5).
- [ ] Slides + gravação da fala de redesenho e arquitetura.

---

## Tarefas de todos

- [ ] Preencher **a própria linha** da declaração de uso de IA (seção 10 do README).
- [ ] **Ler o relatório inteiro** antes da apresentação: o professor pode perguntar qualquer parte a qualquer integrante, independentemente de quem escreveu.
- [ ] Falar **sem ler** na gravação (o professor percebe e isso pesa na nota individual).
- [ ] Montar os próprios slides no Canva compartilhado e **gravar a própria fala**; enviar à Ariessa até segunda, 05/10, às 18h.

## Etapa final

| Data | Atividade | Responsáveis |
|-|-|-|
| dom 04/10 | Merge das seções; revisão de consistência dos IDs; exportar PNGs dos diagramas | Ariessa, Maria Eduarda |
| dom 04/10 | Cada um preenche seus slides no Canva | Todos |
| seg 05/10 | Cada um grava a sua fala e envia até 18h | Todos |
| seg 05/10 | Montar o vídeo e publicar no YouTube | Ariessa |
| ter 06/10 | Revisão final, checklist do enunciado, PDF no Drive, links no README, entrega | Ariessa, Maria Eduarda |

## Fluxo de trabalho no Git

1. `git clone <url>` e `git checkout -b <seu-nome>/secao-X`
2. Edite **apenas a sua seção** do README e os seus arquivos (evita conflitos).
3. Commits pequenos e frequentes: `git commit -m "secao 2: justificativa dos payoffs"`
4. `git push -u origin <seu-nome>/secao-X` e abra um Pull Request. Ariessa ou Maria Eduarda fazem o merge.

Para exportar diagramas: `npx -p @mermaid-js/mermaid-cli mmdc -i diagramas/x.mmd -o diagramas/x.png` (ou colar o `.mmd` em https://mermaid.live e baixar o PNG).

## Checklist de entrega

- [x] interação específica e bem delimitada
- [x] atores, objetivos, ativos, capacidades, informações e pressupostos
- [ ] matriz de payoffs explicada
- [x] ≥ 3 rodadas de ação, resposta, observação e adaptação
- [x] 3 diagramas (PNG + fonte editável)
- [x] ≥ 3 ameaças ligadas ao sistema
- [x] probabilidade, impacto e risco
- [x] resposta à ameaça prioritária, próxima adaptação e risco residual
- [ ] referências, declaração de IA e contribuições individuais
- [ ] commits de todos os integrantes
- [ ] PDF dos slides e vídeo no YouTube com links no README
