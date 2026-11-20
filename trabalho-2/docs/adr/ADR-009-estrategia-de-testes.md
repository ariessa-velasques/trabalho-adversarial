# ADR-009: Estratégia de testes com pytest, sem rede no caminho padrão

## Status

Aceita — 18/11/2026

## Contexto

O §6.4 lista as áreas de teste esperadas: regras do cupom, adaptação/estado dos agentes, controles da AM3, separação de
informação e métricas sem dupla contagem. O `AGENTS.md` confirma essas áreas e determina `uv run pytest`.

Não há linter, typechecker nem CI configurados; portanto, nenhuma ADR pode afirmar que essas verificações passam.

O modo adversarial depende de rede e de chave, o que não pode contaminar a suíte padrão.

## Decisão

1. Usar **pytest**, executado com `uv run pytest`.
2. **Unitários (núcleo puro, sem Agno):**
    - cupom: R$ 30,00 inelegível, R$ 30,01 elegível, primeira compra, débito único na conclusão, orçamento esgotado;
    - políticas: gatilhos de adaptação do bot e do motor;
    - controles da AM3: mensagem genérica, limite de 3 tentativas/24 h simuladas, detecção de sondagem, contestação;
    - métricas: falsos positivos/negativos e custos sem dupla contagem.
3. **Integração:** três rodadas conectadas no modo determinístico, verificando persistência de estado e mudança de
   comportamento entre rodadas.
4. **Contrato do adaptador Agno:** um agente mínimo executa, chama a ferramenta esperada e devolve decisão estruturada
   válida; sem rede.
5. **Fronteira:** `test_separation.py` verifica imports proibidos (`agents/`, `models/checkout.py` ↛ `evaluation/`) e
   campos proibidos nos DTOs públicos.
6. **Golden/replay:** mesma seed e mesma configuração produzem o mesmo hash da sequência de eventos.
7. Testes que exigem LLM são marcados com `@pytest.mark.llm` e **pulados** sem chave; nunca fazem parte da suíte padrão.
8. Não afirmar cobertura, lint ou tipagem: isso não está configurado.

## Consequências

### Positivas

- A suíte roda offline, rápido e de forma determinística.
- As regras de negócio são testadas sem o framework, o que reduz o acoplamento e facilita a manutenção.
- O teste de fronteira transforma a regra do `AGENTS.md` em verificação executável.
- O contrato do adaptador detecta quebra de API do Agno cedo.

### Negativas

- A qualidade da decisão do LLM não é testada pela suíte; só o contrato e o replay.
- O teste de importação por AST pode dar falso positivo em imports dinâmicos.
- Sem CI, os testes dependem de execução local disciplinada.

### Neutras

- O `pytest.ini`/configuração do `pyproject.toml` registra o marcador `llm`.
- Os testes de integração usam a mesma configuração versionada da demo.

## Alternativas consideradas

- **`unittest`:** rejeitado. Menos ergonômico para fixtures e parametrização.
- **Hypothesis:** adiado. Útil para propriedades, mas adiciona complexidade antes de a lógica estabilizar.
- **Testes com LLM como juiz:** rejeitado. Não determinísticos, com custo e sem ganho para o escopo.
- **Só testes de integração:** rejeitado. Esconde a causa das falhas e torna a borda do cupom difícil de isolar.

## Referências

- `docs/Trabalho1.md`, §6.4 (áreas de teste).
- `AGENTS.md` (pytest e áreas esperadas).
- ADR-006 (separação), ADR-007 (reprodutibilidade), ADR-010 (MVC simples).
